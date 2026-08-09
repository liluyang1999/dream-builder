import {
  MAX_PERFORMANCE_MARKERS,
  MAX_PERFORMANCE_PHASES,
  PERFORMANCE_REPORT_VERSION,
} from './performanceMetrics';

const MAX_MARKER_NAME_LENGTH = 80;
const MAX_USER_AGENT_LENGTH = 256;
const MAX_RENDERER_LENGTH = 160;
const MAX_CLOCK_DRIFT_MS = 5_000;

export interface PerformanceReportValidationIssue {
  path: string;
  message: string;
}

export interface PerformanceReportSummary {
  schemaVersion: number;
  runtime: string;
  source: string;
  durationMs: number;
  targetDurationMs: number;
  completedTargetDuration: boolean;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  averageFps: number;
  onePercentLowFps: number;
  framesOver50Ms: number;
  frameCount: number;
  phaseNames: string[];
  hasRawSamples: boolean;
}

export interface PerformanceReportInspection {
  valid: boolean;
  issues: PerformanceReportValidationIssue[];
  summary: PerformanceReportSummary;
}

interface FrameStatistics {
  frameCount: number;
  averageFps: number;
  onePercentLowFps: number;
  meanFrameTimeMs: number;
  minFrameTimeMs: number;
  p50FrameTimeMs: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  maxFrameTimeMs: number;
  framesOver16_67Ms: number;
  framesOver33_33Ms: number;
  framesOver50Ms: number;
}

export function inspectPerformanceReport(input: unknown): PerformanceReportInspection {
  const issues: PerformanceReportValidationIssue[] = [];
  const report = recordAt(input, '$', issues);
  const schemaVersion = numberAt(report.schemaVersion, '$.schemaVersion', issues);
  if (schemaVersion !== PERFORMANCE_REPORT_VERSION) {
    issue(issues, '$.schemaVersion', `必须为 ${PERFORMANCE_REPORT_VERSION}。`);
  }

  const startedAt = isoTimestampAt(report.startedAt, '$.startedAt', issues);
  const endedAt = isoTimestampAt(report.endedAt, '$.endedAt', issues);
  const durationMs = nonNegativeNumberAt(report.durationMs, '$.durationMs', issues);
  const targetDurationMs = positiveNumberAt(report.targetDurationMs, '$.targetDurationMs', issues);
  const completedTargetDuration = booleanAt(
    report.completedTargetDuration,
    '$.completedTargetDuration',
    issues,
  );
  if (
    Number.isFinite(durationMs) &&
    Number.isFinite(targetDurationMs) &&
    completedTargetDuration !== durationMs >= targetDurationMs
  ) {
    issue(issues, '$.completedTargetDuration', '必须与 durationMs / targetDurationMs 一致。');
  }
  if (startedAt !== null && endedAt !== null && Number.isFinite(durationMs)) {
    const epochDurationMs = endedAt - startedAt;
    if (epochDurationMs < 0 || Math.abs(epochDurationMs - durationMs) > MAX_CLOCK_DRIFT_MS) {
      issue(issues, '$.endedAt', '开始/结束时间与单调时钟记录时长不一致。');
    }
  }

  const context = recordAt(report.context, '$.context', issues);
  const runtime = stringAt(context.runtime, '$.context.runtime', issues);
  if (!['browser', 'tauri'].includes(runtime)) {
    issue(issues, '$.context.runtime', '必须为 browser 或 tauri。');
  }
  const source = stringAt(context.source, '$.context.source', issues);
  if (!['rust', 'fallback', 'unknown'].includes(source)) {
    issue(issues, '$.context.source', '必须为 rust、fallback 或 unknown。');
  }
  const seed = nonNegativeIntegerAt(context.seed, '$.context.seed', issues);
  booleanAt(context.reducedMotion, '$.context.reducedMotion', issues);
  const viewport = recordAt(context.viewport, '$.context.viewport', issues);
  const viewportWidth = positiveNumberAt(viewport.width, '$.context.viewport.width', issues);
  const viewportHeight = positiveNumberAt(viewport.height, '$.context.viewport.height', issues);
  const devicePixelRatio = positiveNumberAt(
    viewport.devicePixelRatio,
    '$.context.viewport.devicePixelRatio',
    issues,
  );
  boundedStringAt(context.userAgent, '$.context.userAgent', issues, MAX_USER_AGENT_LENGTH, false);
  nullableBoundedStringAt(context.renderer, '$.context.renderer', issues, MAX_RENDERER_LENGTH);
  nullableBooleanAt(context.webgl2, '$.context.webgl2', issues);
  nullableNonNegativeNumberAt(context.timeToFirstFrameMs, '$.context.timeToFirstFrameMs', issues);
  if (!Number.isFinite(seed)) {
    issue(issues, '$.context.seed', 'seed 必须可复现。');
  }

  const sessionRecord = recordAt(report.session, '$.session', issues);
  const session = frameStatisticsAt(sessionRecord, '$.session', durationMs, issues);
  const renderPeaks = recordAt(report.renderPeaks, '$.renderPeaks', issues);
  nonNegativeIntegerAt(renderPeaks.drawCalls, '$.renderPeaks.drawCalls', issues);
  nonNegativeIntegerAt(renderPeaks.triangles, '$.renderPeaks.triangles', issues);
  nonNegativeIntegerAt(renderPeaks.geometries, '$.renderPeaks.geometries', issues);
  nonNegativeIntegerAt(renderPeaks.textures, '$.renderPeaks.textures', issues);
  nullableNonNegativeNumberAt(renderPeaks.jsHeapBytes, '$.renderPeaks.jsHeapBytes', issues);

  const phaseNames = validatePhases(report.phases, durationMs, issues);
  validateMarkers(report.markers, durationMs, issues);
  nonNegativeIntegerAt(report.droppedMarkers, '$.droppedMarkers', issues);
  nonNegativeIntegerAt(report.droppedPhases, '$.droppedPhases', issues);
  validateLimitations(report.limitations, issues);

  const hasRawSamples = Object.hasOwn(report, 'samples');
  return {
    valid: issues.length === 0,
    issues,
    summary: {
      schemaVersion,
      runtime,
      source,
      durationMs,
      targetDurationMs,
      completedTargetDuration,
      viewportWidth,
      viewportHeight,
      devicePixelRatio,
      averageFps: session.averageFps,
      onePercentLowFps: session.onePercentLowFps,
      framesOver50Ms: session.framesOver50Ms,
      frameCount: session.frameCount,
      phaseNames,
      hasRawSamples,
    },
  };
}

function validatePhases(
  input: unknown,
  reportDurationMs: number,
  issues: PerformanceReportValidationIssue[],
): string[] {
  if (!Array.isArray(input)) {
    issue(issues, '$.phases', '必须是数组。');
    return [];
  }
  if (input.length > MAX_PERFORMANCE_PHASES) {
    issue(issues, '$.phases', `不得超过 ${MAX_PERFORMANCE_PHASES} 项。`);
  }
  return input.map((value, index) => {
    const path = `$.phases[${index}]`;
    const phase = recordAt(value, path, issues);
    const name = boundedStringAt(phase.name, `${path}.name`, issues, MAX_MARKER_NAME_LENGTH, false);
    const durationMs = nonNegativeNumberAt(phase.durationMs, `${path}.durationMs`, issues);
    const startedOffsetMs = nonNegativeNumberAt(
      phase.startedOffsetMs,
      `${path}.startedOffsetMs`,
      issues,
    );
    const endedOffsetMs = nonNegativeNumberAt(phase.endedOffsetMs, `${path}.endedOffsetMs`, issues);
    if (
      Number.isFinite(startedOffsetMs) &&
      Number.isFinite(endedOffsetMs) &&
      (endedOffsetMs < startedOffsetMs ||
        (Number.isFinite(reportDurationMs) && endedOffsetMs > reportDurationMs + 1) ||
        Math.abs(endedOffsetMs - startedOffsetMs - durationMs) > 1)
    ) {
      issue(issues, path, '阶段偏移、时长或报告总时长不一致。');
    }
    frameStatisticsAt(phase, path, durationMs, issues);
    return name;
  });
}

function validateMarkers(
  input: unknown,
  reportDurationMs: number,
  issues: PerformanceReportValidationIssue[],
): void {
  if (!Array.isArray(input)) {
    issue(issues, '$.markers', '必须是数组。');
    return;
  }
  if (input.length > MAX_PERFORMANCE_MARKERS) {
    issue(issues, '$.markers', `不得超过 ${MAX_PERFORMANCE_MARKERS} 项。`);
  }
  let previousOffsetMs = 0;
  input.forEach((value, index) => {
    const path = `$.markers[${index}]`;
    const marker = recordAt(value, path, issues);
    boundedStringAt(marker.name, `${path}.name`, issues, MAX_MARKER_NAME_LENGTH, false);
    const offsetMs = nonNegativeNumberAt(marker.offsetMs, `${path}.offsetMs`, issues);
    if (
      Number.isFinite(offsetMs) &&
      (offsetMs < previousOffsetMs ||
        (Number.isFinite(reportDurationMs) && offsetMs > reportDurationMs + 1))
    ) {
      issue(issues, `${path}.offsetMs`, '标记必须按时间排序并位于报告时长内。');
    }
    previousOffsetMs = Number.isFinite(offsetMs) ? offsetMs : previousOffsetMs;
  });
}

function validateLimitations(input: unknown, issues: PerformanceReportValidationIssue[]): void {
  if (
    !Array.isArray(input) ||
    input.length < 3 ||
    input.some((value) => typeof value !== 'string' || value.trim().length === 0)
  ) {
    issue(issues, '$.limitations', '必须保留完整的探针限制说明。');
  }
}

function frameStatisticsAt(
  record: Record<string, unknown>,
  path: string,
  durationMs: number,
  issues: PerformanceReportValidationIssue[],
): FrameStatistics {
  const statistics: FrameStatistics = {
    frameCount: nonNegativeIntegerAt(record.frameCount, `${path}.frameCount`, issues),
    averageFps: nonNegativeNumberAt(record.averageFps, `${path}.averageFps`, issues),
    onePercentLowFps: nonNegativeNumberAt(
      record.onePercentLowFps,
      `${path}.onePercentLowFps`,
      issues,
    ),
    meanFrameTimeMs: nonNegativeNumberAt(record.meanFrameTimeMs, `${path}.meanFrameTimeMs`, issues),
    minFrameTimeMs: nonNegativeNumberAt(record.minFrameTimeMs, `${path}.minFrameTimeMs`, issues),
    p50FrameTimeMs: nonNegativeNumberAt(record.p50FrameTimeMs, `${path}.p50FrameTimeMs`, issues),
    p95FrameTimeMs: nonNegativeNumberAt(record.p95FrameTimeMs, `${path}.p95FrameTimeMs`, issues),
    p99FrameTimeMs: nonNegativeNumberAt(record.p99FrameTimeMs, `${path}.p99FrameTimeMs`, issues),
    maxFrameTimeMs: nonNegativeNumberAt(record.maxFrameTimeMs, `${path}.maxFrameTimeMs`, issues),
    framesOver16_67Ms: nonNegativeIntegerAt(
      record.framesOver16_67Ms,
      `${path}.framesOver16_67Ms`,
      issues,
    ),
    framesOver33_33Ms: nonNegativeIntegerAt(
      record.framesOver33_33Ms,
      `${path}.framesOver33_33Ms`,
      issues,
    ),
    framesOver50Ms: nonNegativeIntegerAt(record.framesOver50Ms, `${path}.framesOver50Ms`, issues),
  };
  if (
    allFinite([
      statistics.minFrameTimeMs,
      statistics.p50FrameTimeMs,
      statistics.p95FrameTimeMs,
      statistics.p99FrameTimeMs,
      statistics.maxFrameTimeMs,
    ]) &&
    !(
      statistics.minFrameTimeMs <= statistics.p50FrameTimeMs &&
      statistics.p50FrameTimeMs <= statistics.p95FrameTimeMs &&
      statistics.p95FrameTimeMs <= statistics.p99FrameTimeMs &&
      statistics.p99FrameTimeMs <= statistics.maxFrameTimeMs
    )
  ) {
    issue(issues, path, '帧时间分位数必须单调递增。');
  }
  if (
    Number.isFinite(statistics.frameCount) &&
    (statistics.framesOver16_67Ms > statistics.frameCount ||
      statistics.framesOver33_33Ms > statistics.framesOver16_67Ms ||
      statistics.framesOver50Ms > statistics.framesOver33_33Ms)
  ) {
    issue(issues, path, '慢帧计数必须递减且不得超过总帧数。');
  }
  if (
    Number.isFinite(durationMs) &&
    durationMs > 0 &&
    Number.isFinite(statistics.frameCount) &&
    Number.isFinite(statistics.averageFps)
  ) {
    const derivedAverageFps = (statistics.frameCount * 1_000) / durationMs;
    if (Math.abs(derivedAverageFps - statistics.averageFps) > 0.15) {
      issue(issues, `${path}.averageFps`, '平均 FPS 与帧数 / 阶段时长不一致。');
    }
  }
  return statistics;
}

function recordAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): Record<string, unknown> {
  if (isRecord(value)) return value;
  issue(issues, path, '必须是对象。');
  return {};
}

function stringAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): string {
  if (typeof value === 'string') return value;
  issue(issues, path, '必须是字符串。');
  return '';
}

function boundedStringAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
  maxLength: number,
  allowEmpty: boolean,
): string {
  const text = stringAt(value, path, issues);
  if ((!allowEmpty && text.trim().length === 0) || text.length > maxLength) {
    issue(issues, path, `必须是 ${allowEmpty ? '不超过' : '1–'}${maxLength} 字符。`);
  }
  return text;
}

function nullableBoundedStringAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
  maxLength: number,
): string | null {
  if (value === null) return null;
  return boundedStringAt(value, path, issues, maxLength, false);
}

function booleanAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): boolean {
  if (typeof value === 'boolean') return value;
  issue(issues, path, '必须是布尔值。');
  return false;
}

function nullableBooleanAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): boolean | null {
  if (value === null) return null;
  return booleanAt(value, path, issues);
}

function numberAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  issue(issues, path, '必须是有限数字。');
  return Number.NaN;
}

function nonNegativeNumberAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): number {
  const number = numberAt(value, path, issues);
  if (Number.isFinite(number) && number < 0) {
    issue(issues, path, '不得为负数。');
  }
  return number;
}

function positiveNumberAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): number {
  const number = numberAt(value, path, issues);
  if (Number.isFinite(number) && number <= 0) {
    issue(issues, path, '必须大于 0。');
  }
  return number;
}

function nonNegativeIntegerAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): number {
  const number = nonNegativeNumberAt(value, path, issues);
  if (Number.isFinite(number) && !Number.isInteger(number)) {
    issue(issues, path, '必须是整数。');
  }
  return number;
}

function nullableNonNegativeNumberAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): number | null {
  if (value === null) return null;
  return nonNegativeNumberAt(value, path, issues);
}

function isoTimestampAt(
  value: unknown,
  path: string,
  issues: PerformanceReportValidationIssue[],
): number | null {
  const text = stringAt(value, path, issues);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    issue(issues, path, '必须是 ISO 8601 时间。');
    return null;
  }
  return timestamp;
}

function issue(issues: PerformanceReportValidationIssue[], path: string, message: string): void {
  if (issues.some((candidate) => candidate.path === path && candidate.message === message)) return;
  issues.push({ path, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function allFinite(values: number[]): boolean {
  return values.every(Number.isFinite);
}
