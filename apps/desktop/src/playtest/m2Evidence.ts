import { PERFORMANCE_REPORT_VERSION } from '../performance/performanceMetrics';
import {
  type PerformanceReportSummary,
  inspectPerformanceReport,
} from '../performance/performanceReportValidation';

export const M2_EVIDENCE_SCHEMA_VERSION = 2;
export const M2_REQUIRED_OBSERVATION_COUNT = 5;
export const M2_MAX_COMPLETION_SECONDS = 12 * 60;
export const M2_FIRST_ROUTE_SECONDS = 90;
export const M2_PERFORMANCE_TARGET = {
  durationMs: 10 * 60 * 1_000,
  minAverageFps: 55,
  minOnePercentLowFps: 30,
  maxFramesOver50MsRatio: 0.01,
} as const;

const PARTICIPANT_CODE_PATTERN = /^P\d{2}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE_LENGTH = 500;
const PROHIBITED_PARTICIPANT_FIELDS = new Set([
  'name',
  'fullname',
  'email',
  'phone',
  'account',
  'address',
  'coordinates',
  'path',
  'rawinput',
  'keystrokes',
]);

export type M2ObservationOutcome =
  | 'completed'
  | 'time-limit'
  | 'abandoned'
  | 'technical-stop'
  | 'discomfort';

export type M2MemoryState = 'not-found' | 'found' | 'read';

export interface M2ObservationMilestones {
  firstMovementSeconds: number | null;
  firstRouteSeconds: number | null;
  lightSeedSeconds: [number | null, number | null, number | null];
  memoryState: M2MemoryState;
  nodeArrivalSeconds: number | null;
  completionSeconds: number | null;
}

export interface M2PlaytestObservation {
  participantCode: string;
  sessionDate: string;
  firstExposureConfirmed: boolean;
  designDocsUnreadConfirmed: boolean;
  outcome: M2ObservationOutcome;
  milestones: M2ObservationMilestones;
  misidentifiedToolAsGoal: boolean;
  unrecoverableStuck: boolean;
  hintReceived: boolean;
  resetCount: number;
  purificationErrors: number;
  longStallLocations: string;
  technicalIssueNote: string;
  hintNote: string;
  restatedGoal: string;
  confusionNote: string;
  favoriteMomentNote: string;
}

export interface M2BuildIdentity {
  appVersion: string;
  worktreeId: string;
  artifactSha256: string;
}

export interface M2TargetDevice {
  id: string;
  cpu: string;
  gpu: string;
  gpuDriver: string;
  memoryGb: number;
  displayWidth: number;
  displayHeight: number;
  refreshRateHz: number;
  scalePercent: number;
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  sustainedStutterObserved: boolean;
}

export interface M2EvidenceBundle {
  schemaVersion: typeof M2_EVIDENCE_SCHEMA_VERSION;
  createdAt: string;
  build: M2BuildIdentity;
  targetDevice: M2TargetDevice;
  performanceReport: unknown;
  observations: M2PlaytestObservation[];
}

export interface M2EvidenceIssue {
  code: string;
  path: string;
  message: string;
}

export interface M2EvidenceCheck {
  id: string;
  label: string;
  passed: boolean;
  actual: string;
  required: string;
}

export interface M2EvidenceSummary {
  observationCount: number;
  eligibleObservationCount: number;
  firstRoutePassCount: number;
  completionPassCount: number;
  unrecoverableStuckCount: number;
  hintReceivedCount: number;
}

export interface M2EvidenceEvaluation {
  passed: boolean;
  checks: M2EvidenceCheck[];
  issues: M2EvidenceIssue[];
  summary: M2EvidenceSummary;
}

export function evaluateM2EvidenceBundle(input: unknown): M2EvidenceEvaluation {
  const issues: M2EvidenceIssue[] = [];
  const root = expectRecord(input, '$', issues, 'invalid-bundle');
  const schemaVersion = expectNumber(root, 'schemaVersion', '$.schemaVersion', issues);
  if (schemaVersion !== M2_EVIDENCE_SCHEMA_VERSION) {
    addIssue(
      issues,
      'invalid-schema-version',
      '$.schemaVersion',
      `证据包版本必须为 ${M2_EVIDENCE_SCHEMA_VERSION}。`,
    );
  }

  const createdAt = expectString(root, 'createdAt', '$.createdAt', issues);
  if (!isIsoTimestamp(createdAt)) {
    addIssue(issues, 'invalid-created-at', '$.createdAt', 'createdAt 必须是 ISO 8601 时间。');
  }

  validateBuildIdentity(root.build, issues);
  const targetDevice = parseTargetDevice(root.targetDevice, issues);
  const observations = parseObservations(root.observations, issues);
  const performanceReport = parsePerformanceReport(root.performanceReport, issues);

  const participantCodes = observations.map((observation) => observation.participantCode);
  const uniqueParticipantCodes = new Set(participantCodes);
  if (uniqueParticipantCodes.size !== participantCodes.length) {
    addIssue(
      issues,
      'duplicate-participant-code',
      '$.observations',
      '同一个证据包中的匿名参与者编号必须唯一。',
    );
  }

  const eligibleObservations = observations.filter(
    (observation) =>
      PARTICIPANT_CODE_PATTERN.test(observation.participantCode) &&
      observation.firstExposureConfirmed &&
      observation.designDocsUnreadConfirmed,
  );
  const firstRoutePassCount = observations.filter(
    (observation) =>
      observation.milestones.firstRouteSeconds !== null &&
      observation.milestones.firstRouteSeconds <= M2_FIRST_ROUTE_SECONDS &&
      !observation.misidentifiedToolAsGoal,
  ).length;
  const completionPassCount = observations.filter(
    (observation) =>
      observation.outcome === 'completed' &&
      observation.milestones.completionSeconds !== null &&
      observation.milestones.completionSeconds <= M2_MAX_COMPLETION_SECONDS &&
      !observation.hintReceived,
  ).length;
  const unrecoverableStuckCount = observations.filter(
    (observation) => observation.unrecoverableStuck,
  ).length;
  const hintReceivedCount = observations.filter((observation) => observation.hintReceived).length;
  const slowFrameRatio =
    performanceReport.frameCount > 0
      ? performanceReport.framesOver50Ms / performanceReport.frameCount
      : Number.POSITIVE_INFINITY;

  const privacyIssueCodes = new Set([
    'duplicate-participant-code',
    'prohibited-participant-field',
    'raw-performance-samples',
  ]);
  const structuralIssueCodes = new Set([
    'invalid-bundle',
    'invalid-schema-version',
    'invalid-created-at',
    'invalid-build',
    'invalid-target-device',
    'invalid-observation',
    'invalid-performance-report',
  ]);
  const privacyPassed = !issues.some((issue) => privacyIssueCodes.has(issue.code));
  const schemaPassed = !issues.some((issue) => structuralIssueCodes.has(issue.code));
  const checks: M2EvidenceCheck[] = [
    gate(
      'bundle-schema',
      '证据包结构',
      schemaPassed,
      schemaPassed ? `v${schemaVersion}` : `${issueCount(issues, structuralIssueCodes)} 项结构错误`,
      `v${M2_EVIDENCE_SCHEMA_VERSION} 且字段完整`,
    ),
    gate(
      'privacy-minimization',
      '隐私最小化',
      privacyPassed,
      privacyPassed ? '仅匿名编号与聚合数据' : '含重复身份、禁止字段或原始帧',
      '无姓名/账号/路径/原始输入/逐帧样本',
    ),
    gate(
      'sample-count',
      '样本数量',
      observations.length === M2_REQUIRED_OBSERVATION_COUNT,
      `${observations.length} 人`,
      `${M2_REQUIRED_OBSERVATION_COUNT} 人`,
    ),
    gate(
      'sample-eligibility',
      '首次接触资格',
      eligibleObservations.length === M2_REQUIRED_OBSERVATION_COUNT &&
        uniqueParticipantCodes.size === M2_REQUIRED_OBSERVATION_COUNT,
      `${eligibleObservations.length}/${M2_REQUIRED_OBSERVATION_COUNT}`,
      `${M2_REQUIRED_OBSERVATION_COUNT}/${M2_REQUIRED_OBSERVATION_COUNT} 首次接触且未读设计文档`,
    ),
    gate(
      'first-route',
      '首次路线可理解性',
      firstRoutePassCount >= 4,
      `${firstRoutePassCount}/${M2_REQUIRED_OBSERVATION_COUNT}`,
      `至少 4/${M2_REQUIRED_OBSERVATION_COUNT}`,
    ),
    gate(
      'completion',
      '无提示完成',
      completionPassCount === M2_REQUIRED_OBSERVATION_COUNT,
      `${completionPassCount}/${M2_REQUIRED_OBSERVATION_COUNT}`,
      `${M2_REQUIRED_OBSERVATION_COUNT}/${M2_REQUIRED_OBSERVATION_COUNT} 在 ${M2_MAX_COMPLETION_SECONDS / 60} 分钟内`,
    ),
    gate(
      'no-hints',
      '无口头提示',
      hintReceivedCount === 0,
      `${hintReceivedCount} 人收到提示`,
      '0 人收到操作或路线提示',
    ),
    gate(
      'recoverability',
      '可恢复性',
      unrecoverableStuckCount === 0,
      `${unrecoverableStuckCount} 个不可恢复卡死`,
      '0 个',
    ),
    gate(
      'native-performance-report',
      '原生十分钟报告',
      performanceReport.schemaVersion === PERFORMANCE_REPORT_VERSION &&
        performanceReport.runtime === 'tauri' &&
        performanceReport.source === 'rust' &&
        performanceReport.completedTargetDuration &&
        performanceReport.durationMs >= M2_PERFORMANCE_TARGET.durationMs &&
        performanceReport.targetDurationMs >= M2_PERFORMANCE_TARGET.durationMs,
      `${performanceReport.runtime || '未知'} / ${performanceReport.source || '未知'} / ${formatDuration(performanceReport.durationMs)}`,
      `Rust + Tauri，连续 ${formatDuration(M2_PERFORMANCE_TARGET.durationMs)}`,
    ),
    gate(
      'performance-phases',
      '关键性能阶段',
      performanceReport.phaseNames.includes('scene-load') &&
        performanceReport.phaseNames.includes('cleansing'),
      performanceReport.phaseNames.length > 0 ? performanceReport.phaseNames.join('、') : '未记录',
      '同时包含 scene-load 与 cleansing',
    ),
    gate(
      'target-viewport',
      '目标窗口与缩放',
      performanceReport.viewportWidth === targetDevice.viewportWidth &&
        performanceReport.viewportHeight === targetDevice.viewportHeight &&
        Math.abs(performanceReport.devicePixelRatio - targetDevice.devicePixelRatio) <= 0.01,
      `${formatNumber(performanceReport.viewportWidth)}×${formatNumber(performanceReport.viewportHeight)} @ ${formatNumber(performanceReport.devicePixelRatio)}x`,
      `${targetDevice.viewportWidth}×${targetDevice.viewportHeight} @ ${formatNumber(targetDevice.devicePixelRatio)}x`,
    ),
    gate(
      'performance-budget',
      'M2 帧率预算',
      performanceReport.averageFps >= M2_PERFORMANCE_TARGET.minAverageFps &&
        performanceReport.onePercentLowFps >= M2_PERFORMANCE_TARGET.minOnePercentLowFps &&
        slowFrameRatio <= M2_PERFORMANCE_TARGET.maxFramesOver50MsRatio,
      `${formatNumber(performanceReport.averageFps)} / ${formatNumber(performanceReport.onePercentLowFps)} FPS；>50 ms ${formatPercent(slowFrameRatio)}`,
      `平均 ≥${M2_PERFORMANCE_TARGET.minAverageFps}；1% Low ≥${M2_PERFORMANCE_TARGET.minOnePercentLowFps} FPS；>50 ms ≤${formatPercent(M2_PERFORMANCE_TARGET.maxFramesOver50MsRatio)}`,
    ),
    gate(
      'sustained-stutter',
      '人工持续卡顿观察',
      !targetDevice.sustainedStutterObserved,
      targetDevice.sustainedStutterObserved ? '观察到' : '未观察到',
      '未观察到',
    ),
  ];

  return {
    passed: checks.every((check) => check.passed),
    checks,
    issues,
    summary: {
      observationCount: observations.length,
      eligibleObservationCount: eligibleObservations.length,
      firstRoutePassCount,
      completionPassCount,
      unrecoverableStuckCount,
      hintReceivedCount,
    },
  };
}

export function isM2EvidenceBundle(input: unknown): input is M2EvidenceBundle {
  if (!isRecord(input)) return false;
  const evaluation = evaluateM2EvidenceBundle(input);
  const schemaCheck = evaluation.checks.find((check) => check.id === 'bundle-schema');
  return schemaCheck?.passed === true;
}

function validateBuildIdentity(input: unknown, issues: M2EvidenceIssue[]): void {
  const build = expectRecord(input, '$.build', issues, 'invalid-build');
  const appVersion = expectString(build, 'appVersion', '$.build.appVersion', issues);
  const worktreeId = expectString(build, 'worktreeId', '$.build.worktreeId', issues);
  const artifactSha256 = expectString(build, 'artifactSha256', '$.build.artifactSha256', issues);
  if (!appVersion || !worktreeId || !SHA256_PATTERN.test(artifactSha256)) {
    addIssue(
      issues,
      'invalid-build',
      '$.build',
      '构建信息必须包含版本、工作树标识与 64 位 SHA-256。',
    );
  }
}

function parseTargetDevice(input: unknown, issues: M2EvidenceIssue[]): M2TargetDevice {
  const device = expectRecord(input, '$.targetDevice', issues, 'invalid-target-device');
  const parsed: M2TargetDevice = {
    id: expectString(device, 'id', '$.targetDevice.id', issues),
    cpu: expectString(device, 'cpu', '$.targetDevice.cpu', issues),
    gpu: expectString(device, 'gpu', '$.targetDevice.gpu', issues),
    gpuDriver: expectString(device, 'gpuDriver', '$.targetDevice.gpuDriver', issues),
    memoryGb: expectNumber(device, 'memoryGb', '$.targetDevice.memoryGb', issues),
    displayWidth: expectNumber(device, 'displayWidth', '$.targetDevice.displayWidth', issues),
    displayHeight: expectNumber(device, 'displayHeight', '$.targetDevice.displayHeight', issues),
    refreshRateHz: expectNumber(device, 'refreshRateHz', '$.targetDevice.refreshRateHz', issues),
    scalePercent: expectNumber(device, 'scalePercent', '$.targetDevice.scalePercent', issues),
    devicePixelRatio: expectNumber(
      device,
      'devicePixelRatio',
      '$.targetDevice.devicePixelRatio',
      issues,
    ),
    viewportWidth: expectNumber(device, 'viewportWidth', '$.targetDevice.viewportWidth', issues),
    viewportHeight: expectNumber(device, 'viewportHeight', '$.targetDevice.viewportHeight', issues),
    sustainedStutterObserved: expectBoolean(
      device,
      'sustainedStutterObserved',
      '$.targetDevice.sustainedStutterObserved',
      issues,
    ),
  };
  if (
    !parsed.id ||
    !parsed.cpu ||
    !parsed.gpu ||
    !parsed.gpuDriver ||
    !allPositive([
      parsed.memoryGb,
      parsed.displayWidth,
      parsed.displayHeight,
      parsed.refreshRateHz,
      parsed.scalePercent,
      parsed.devicePixelRatio,
      parsed.viewportWidth,
      parsed.viewportHeight,
    ])
  ) {
    addIssue(
      issues,
      'invalid-target-device',
      '$.targetDevice',
      '目标设备字段必须完整，数值必须为正数。',
    );
  }
  return parsed;
}

function parseObservations(input: unknown, issues: M2EvidenceIssue[]): M2PlaytestObservation[] {
  if (!Array.isArray(input)) {
    addIssue(issues, 'invalid-observation', '$.observations', 'observations 必须是数组。');
    return [];
  }
  return input.map((value, index) => parseObservation(value, index, issues));
}

function parseObservation(
  input: unknown,
  index: number,
  issues: M2EvidenceIssue[],
): M2PlaytestObservation {
  const path = `$.observations[${index}]`;
  const observation = expectRecord(input, path, issues, 'invalid-observation');
  for (const key of Object.keys(observation)) {
    if (PROHIBITED_PARTICIPANT_FIELDS.has(key.toLowerCase())) {
      addIssue(
        issues,
        'prohibited-participant-field',
        `${path}.${key}`,
        `参与者记录不得包含可识别或原始行为字段 "${key}"。`,
      );
    }
  }

  const participantCode = expectString(
    observation,
    'participantCode',
    `${path}.participantCode`,
    issues,
  );
  const sessionDate = expectString(observation, 'sessionDate', `${path}.sessionDate`, issues);
  const outcomeValue = expectString(observation, 'outcome', `${path}.outcome`, issues);
  const outcome = isObservationOutcome(outcomeValue) ? outcomeValue : 'technical-stop';
  if (!isObservationOutcome(outcomeValue)) {
    addIssue(issues, 'invalid-observation', `${path}.outcome`, '未知的试玩结果。');
  }
  if (!PARTICIPANT_CODE_PATTERN.test(participantCode)) {
    addIssue(
      issues,
      'invalid-observation',
      `${path}.participantCode`,
      '匿名参与者编号必须使用 P01–P99。',
    );
  }
  if (!DATE_PATTERN.test(sessionDate)) {
    addIssue(issues, 'invalid-observation', `${path}.sessionDate`, '试玩日期必须使用 YYYY-MM-DD。');
  }

  const milestones = parseMilestones(observation.milestones, path, issues);
  const parsed: M2PlaytestObservation = {
    participantCode,
    sessionDate,
    firstExposureConfirmed: expectBoolean(
      observation,
      'firstExposureConfirmed',
      `${path}.firstExposureConfirmed`,
      issues,
    ),
    designDocsUnreadConfirmed: expectBoolean(
      observation,
      'designDocsUnreadConfirmed',
      `${path}.designDocsUnreadConfirmed`,
      issues,
    ),
    outcome,
    milestones,
    misidentifiedToolAsGoal: expectBoolean(
      observation,
      'misidentifiedToolAsGoal',
      `${path}.misidentifiedToolAsGoal`,
      issues,
    ),
    unrecoverableStuck: expectBoolean(
      observation,
      'unrecoverableStuck',
      `${path}.unrecoverableStuck`,
      issues,
    ),
    hintReceived: expectBoolean(observation, 'hintReceived', `${path}.hintReceived`, issues),
    resetCount: expectNumber(observation, 'resetCount', `${path}.resetCount`, issues),
    purificationErrors: expectNumber(
      observation,
      'purificationErrors',
      `${path}.purificationErrors`,
      issues,
    ),
    longStallLocations: expectNote(
      observation,
      'longStallLocations',
      `${path}.longStallLocations`,
      issues,
    ),
    technicalIssueNote: expectNote(
      observation,
      'technicalIssueNote',
      `${path}.technicalIssueNote`,
      issues,
    ),
    hintNote: expectNote(observation, 'hintNote', `${path}.hintNote`, issues),
    restatedGoal: expectNote(observation, 'restatedGoal', `${path}.restatedGoal`, issues),
    confusionNote: expectNote(observation, 'confusionNote', `${path}.confusionNote`, issues),
    favoriteMomentNote: expectNote(
      observation,
      'favoriteMomentNote',
      `${path}.favoriteMomentNote`,
      issues,
    ),
  };
  if (
    !Number.isInteger(parsed.resetCount) ||
    parsed.resetCount < 0 ||
    !Number.isInteger(parsed.purificationErrors) ||
    parsed.purificationErrors < 0
  ) {
    addIssue(issues, 'invalid-observation', path, '重置次数与净化错误次数必须是非负整数。');
  }
  return parsed;
}

function parseMilestones(
  input: unknown,
  observationPath: string,
  issues: M2EvidenceIssue[],
): M2ObservationMilestones {
  const path = `${observationPath}.milestones`;
  const milestones = expectRecord(input, path, issues, 'invalid-observation');
  const lightSeedInput = milestones.lightSeedSeconds;
  const lightSeedSeconds: [number | null, number | null, number | null] =
    Array.isArray(lightSeedInput) && lightSeedInput.length === 3
      ? [
          nullableNonNegativeNumber(lightSeedInput[0], `${path}.lightSeedSeconds[0]`, issues),
          nullableNonNegativeNumber(lightSeedInput[1], `${path}.lightSeedSeconds[1]`, issues),
          nullableNonNegativeNumber(lightSeedInput[2], `${path}.lightSeedSeconds[2]`, issues),
        ]
      : [null, null, null];
  if (!Array.isArray(lightSeedInput) || lightSeedInput.length !== 3) {
    addIssue(
      issues,
      'invalid-observation',
      `${path}.lightSeedSeconds`,
      '光种时间必须包含三个位置。',
    );
  }
  const memoryStateValue = expectString(milestones, 'memoryState', `${path}.memoryState`, issues);
  const memoryState = isMemoryState(memoryStateValue) ? memoryStateValue : 'not-found';
  if (!isMemoryState(memoryStateValue)) {
    addIssue(issues, 'invalid-observation', `${path}.memoryState`, '未知的记忆状态。');
  }
  return {
    firstMovementSeconds: nullableNonNegativeNumber(
      milestones.firstMovementSeconds,
      `${path}.firstMovementSeconds`,
      issues,
    ),
    firstRouteSeconds: nullableNonNegativeNumber(
      milestones.firstRouteSeconds,
      `${path}.firstRouteSeconds`,
      issues,
    ),
    lightSeedSeconds,
    memoryState,
    nodeArrivalSeconds: nullableNonNegativeNumber(
      milestones.nodeArrivalSeconds,
      `${path}.nodeArrivalSeconds`,
      issues,
    ),
    completionSeconds: nullableNonNegativeNumber(
      milestones.completionSeconds,
      `${path}.completionSeconds`,
      issues,
    ),
  };
}

function parsePerformanceReport(
  input: unknown,
  issues: M2EvidenceIssue[],
): PerformanceReportSummary {
  const inspection = inspectPerformanceReport(input);
  for (const validationIssue of inspection.issues) {
    addIssue(
      issues,
      'invalid-performance-report',
      `$.performanceReport${validationIssue.path.slice(1)}`,
      validationIssue.message,
    );
  }
  if (inspection.summary.hasRawSamples) {
    addIssue(
      issues,
      'raw-performance-samples',
      '$.performanceReport.samples',
      'M2 证据不得保存逐帧样本。',
    );
  }
  return inspection.summary;
}

function expectRecord(
  input: unknown,
  path: string,
  issues: M2EvidenceIssue[],
  code: string,
): Record<string, unknown> {
  if (isRecord(input)) return input;
  addIssue(issues, code, path, `${path} 必须是对象。`);
  return {};
}

function expectString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: M2EvidenceIssue[],
  code = 'invalid-observation',
): string {
  const value = record[key];
  if (typeof value === 'string') return value.trim();
  addIssue(issues, code, path, `${path} 必须是字符串。`);
  return '';
}

function expectNote(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: M2EvidenceIssue[],
): string {
  const value = expectString(record, key, path, issues);
  if (value.length > MAX_NOTE_LENGTH) {
    addIssue(issues, 'invalid-observation', path, `观察文字不得超过 ${MAX_NOTE_LENGTH} 字符。`);
    return value.slice(0, MAX_NOTE_LENGTH);
  }
  return value;
}

function expectNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: M2EvidenceIssue[],
  code = 'invalid-observation',
): number {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  addIssue(issues, code, path, `${path} 必须是有限数字。`);
  return Number.NaN;
}

function expectBoolean(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: M2EvidenceIssue[],
  code = 'invalid-observation',
): boolean {
  const value = record[key];
  if (typeof value === 'boolean') return value;
  addIssue(issues, code, path, `${path} 必须是布尔值。`);
  return false;
}

function nullableNonNegativeNumber(
  value: unknown,
  path: string,
  issues: M2EvidenceIssue[],
): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  addIssue(issues, 'invalid-observation', path, `${path} 必须是非负秒数或 null。`);
  return null;
}

function gate(
  id: string,
  label: string,
  passed: boolean,
  actual: string,
  required: string,
): M2EvidenceCheck {
  return { id, label, passed, actual, required };
}

function addIssue(issues: M2EvidenceIssue[], code: string, path: string, message: string): void {
  if (issues.some((issue) => issue.code === code && issue.path === path)) return;
  issues.push({ code, path, message });
}

function issueCount(issues: M2EvidenceIssue[], codes: ReadonlySet<string>): number {
  return issues.filter((issue) => codes.has(issue.code)).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: string): boolean {
  return value.length > 0 && Number.isFinite(Date.parse(value));
}

function isObservationOutcome(value: string): value is M2ObservationOutcome {
  return ['completed', 'time-limit', 'abandoned', 'technical-stop', 'discomfort'].includes(value);
}

function isMemoryState(value: string): value is M2MemoryState {
  return ['not-found', 'found', 'read'].includes(value);
}

function allPositive(values: number[]): boolean {
  return values.every((value) => Number.isFinite(value) && value > 0);
}

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '未知时长';
  return `${formatNumber(milliseconds / 60_000)} 分钟`;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.?0+$/, '') : '—';
}

function formatPercent(ratio: number): string {
  return Number.isFinite(ratio) ? `${(ratio * 100).toFixed(2)}%` : '—';
}
