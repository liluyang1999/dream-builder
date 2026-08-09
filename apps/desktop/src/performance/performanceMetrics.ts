export const PERFORMANCE_REPORT_VERSION = 1;
export const MAX_PERFORMANCE_MARKERS = 128;
export const MAX_PERFORMANCE_PHASES = 32;

const FRAME_TIME_BUCKET_WIDTH_MS = 0.5;
const MAX_BUCKETED_FRAME_TIME_MS = 250;
const MAX_BUCKET_INDEX = MAX_BUCKETED_FRAME_TIME_MS / FRAME_TIME_BUCKET_WIDTH_MS;
const OVERFLOW_BUCKET_INDEX = MAX_BUCKET_INDEX + 1;
const MAX_MARKER_NAME_LENGTH = 80;

export interface PerformanceFrameSample {
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  jsHeapBytes: number | null;
}

export interface PerformanceReportContext {
  runtime: 'browser' | 'tauri';
  seed: number;
  reducedMotion: boolean;
  source: 'rust' | 'fallback' | 'unknown';
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  userAgent: string;
  renderer: string | null;
  webgl2: boolean | null;
  timeToFirstFrameMs: number | null;
}

export interface PerformanceFrameStatistics {
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

export interface PerformanceRenderPeaks {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  jsHeapBytes: number | null;
}

export interface PerformanceMarker {
  name: string;
  offsetMs: number;
}

export interface PerformancePhaseReport extends PerformanceFrameStatistics {
  name: string;
  durationMs: number;
  startedOffsetMs: number;
  endedOffsetMs: number;
}

export interface PerformanceReport {
  schemaVersion: typeof PERFORMANCE_REPORT_VERSION;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  targetDurationMs: number;
  completedTargetDuration: boolean;
  context: PerformanceReportContext;
  session: PerformanceFrameStatistics;
  renderPeaks: PerformanceRenderPeaks;
  phases: PerformancePhaseReport[];
  markers: PerformanceMarker[];
  droppedMarkers: number;
  droppedPhases: number;
  limitations: string[];
}

interface RecorderOptions {
  startedAtEpochMs: number;
  startedAtMonotonicMs: number;
  targetDurationMs: number;
}

interface BuildReportOptions {
  endedAtEpochMs: number;
  endedAtMonotonicMs: number;
  context: PerformanceReportContext;
}

interface ActivePhase {
  name: string;
  startedAtMonotonicMs: number;
  frames: FrameStatisticsAccumulator;
}

interface CompletedPhase extends ActivePhase {
  endedAtMonotonicMs: number;
}

export class PerformanceMetricsRecorder {
  private readonly sessionFrames = new FrameStatisticsAccumulator();
  private readonly renderPeaks: PerformanceRenderPeaks = {
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    jsHeapBytes: null,
  };
  private readonly markers: PerformanceMarker[] = [];
  private readonly activePhases = new Map<string, ActivePhase>();
  private readonly completedPhases: CompletedPhase[] = [];
  private droppedMarkers = 0;
  private droppedPhases = 0;

  constructor(private readonly options: RecorderOptions) {}

  recordFrame(sample: PerformanceFrameSample, _nowMonotonicMs: number): void {
    if (!isValidFrameTime(sample.frameTimeMs)) return;

    this.sessionFrames.record(sample.frameTimeMs);
    for (const phase of this.activePhases.values()) {
      phase.frames.record(sample.frameTimeMs);
    }
    this.updateRenderPeaks(sample);
  }

  beginPhase(name: string, nowMonotonicMs: number): void {
    const normalizedName = normalizeLabel(name);
    if (!normalizedName || this.activePhases.has(normalizedName)) return;
    if (this.activePhases.size + this.completedPhases.length >= MAX_PERFORMANCE_PHASES) {
      this.droppedPhases += 1;
      return;
    }

    this.activePhases.set(normalizedName, {
      name: normalizedName,
      startedAtMonotonicMs: clampTimestamp(nowMonotonicMs, this.options.startedAtMonotonicMs),
      frames: new FrameStatisticsAccumulator(),
    });
  }

  endPhase(name: string, nowMonotonicMs: number): void {
    const normalizedName = normalizeLabel(name);
    const phase = this.activePhases.get(normalizedName);
    if (!phase) return;

    this.activePhases.delete(normalizedName);
    this.completedPhases.push({
      ...phase,
      endedAtMonotonicMs: clampTimestamp(nowMonotonicMs, phase.startedAtMonotonicMs),
    });
  }

  mark(name: string, nowMonotonicMs: number): void {
    const normalizedName = normalizeLabel(name);
    if (!normalizedName) return;
    if (this.markers.length >= MAX_PERFORMANCE_MARKERS) {
      this.droppedMarkers += 1;
      return;
    }

    this.markers.push({
      name: normalizedName,
      offsetMs: roundMetric(Math.max(0, nowMonotonicMs - this.options.startedAtMonotonicMs)),
    });
  }

  buildReport({
    endedAtEpochMs,
    endedAtMonotonicMs,
    context,
  }: BuildReportOptions): PerformanceReport {
    const safeEndMonotonicMs = clampTimestamp(
      endedAtMonotonicMs,
      this.options.startedAtMonotonicMs,
    );
    const durationMs = roundMetric(safeEndMonotonicMs - this.options.startedAtMonotonicMs);
    const phases = [
      ...this.completedPhases,
      ...Array.from(this.activePhases.values(), (phase) => ({
        ...phase,
        endedAtMonotonicMs: safeEndMonotonicMs,
      })),
    ].map((phase) => this.buildPhaseReport(phase));

    return {
      schemaVersion: PERFORMANCE_REPORT_VERSION,
      startedAt: toIsoTimestamp(this.options.startedAtEpochMs),
      endedAt: toIsoTimestamp(endedAtEpochMs),
      durationMs,
      targetDurationMs: this.options.targetDurationMs,
      completedTargetDuration: durationMs >= this.options.targetDurationMs,
      context,
      session: this.sessionFrames.snapshot(durationMs),
      renderPeaks: { ...this.renderPeaks },
      phases,
      markers: this.markers.map((marker) => ({ ...marker })),
      droppedMarkers: this.droppedMarkers,
      droppedPhases: this.droppedPhases,
      limitations: [
        'GPU frame time is not available from this WebGL probe.',
        'Frame times are CPU-observed animation intervals and can include browser scheduling delays.',
        'Only bounded aggregate histograms, capped phases, and capped event markers are retained; raw frames are not stored.',
      ],
    };
  }

  private buildPhaseReport(phase: CompletedPhase): PerformancePhaseReport {
    const durationMs = roundMetric(
      Math.max(0, phase.endedAtMonotonicMs - phase.startedAtMonotonicMs),
    );
    return {
      name: phase.name,
      durationMs,
      startedOffsetMs: roundMetric(
        Math.max(0, phase.startedAtMonotonicMs - this.options.startedAtMonotonicMs),
      ),
      endedOffsetMs: roundMetric(
        Math.max(0, phase.endedAtMonotonicMs - this.options.startedAtMonotonicMs),
      ),
      ...phase.frames.snapshot(durationMs),
    };
  }

  private updateRenderPeaks(sample: PerformanceFrameSample): void {
    this.renderPeaks.drawCalls = maximumValid(this.renderPeaks.drawCalls, sample.drawCalls);
    this.renderPeaks.triangles = maximumValid(this.renderPeaks.triangles, sample.triangles);
    this.renderPeaks.geometries = maximumValid(this.renderPeaks.geometries, sample.geometries);
    this.renderPeaks.textures = maximumValid(this.renderPeaks.textures, sample.textures);
    if (sample.jsHeapBytes !== null && isFiniteNonNegative(sample.jsHeapBytes)) {
      this.renderPeaks.jsHeapBytes = Math.max(
        this.renderPeaks.jsHeapBytes ?? 0,
        sample.jsHeapBytes,
      );
    }
  }
}

class FrameStatisticsAccumulator {
  private readonly buckets = new Uint32Array(OVERFLOW_BUCKET_INDEX + 1);
  private frameCount = 0;
  private sumFrameTimeMs = 0;
  private minFrameTimeMs = Number.POSITIVE_INFINITY;
  private maxFrameTimeMs = 0;
  private framesOver16_67Ms = 0;
  private framesOver33_33Ms = 0;
  private framesOver50Ms = 0;

  record(frameTimeMs: number): void {
    if (!isValidFrameTime(frameTimeMs)) return;

    this.frameCount += 1;
    this.sumFrameTimeMs += frameTimeMs;
    this.minFrameTimeMs = Math.min(this.minFrameTimeMs, frameTimeMs);
    this.maxFrameTimeMs = Math.max(this.maxFrameTimeMs, frameTimeMs);
    const bucketIndex = frameTimeToBucket(frameTimeMs);
    this.buckets[bucketIndex] = (this.buckets[bucketIndex] ?? 0) + 1;
    if (frameTimeMs > 16.67) this.framesOver16_67Ms += 1;
    if (frameTimeMs > 33.33) this.framesOver33_33Ms += 1;
    if (frameTimeMs > 50) this.framesOver50Ms += 1;
  }

  snapshot(durationMs: number): PerformanceFrameStatistics {
    if (this.frameCount === 0) {
      return {
        frameCount: 0,
        averageFps: 0,
        onePercentLowFps: 0,
        meanFrameTimeMs: 0,
        minFrameTimeMs: 0,
        p50FrameTimeMs: 0,
        p95FrameTimeMs: 0,
        p99FrameTimeMs: 0,
        maxFrameTimeMs: 0,
        framesOver16_67Ms: 0,
        framesOver33_33Ms: 0,
        framesOver50Ms: 0,
      };
    }

    const p99FrameTimeMs = this.quantile(0.99);
    return {
      frameCount: this.frameCount,
      averageFps: durationMs > 0 ? roundMetric((this.frameCount * 1_000) / durationMs) : 0,
      onePercentLowFps: p99FrameTimeMs > 0 ? roundMetric(1_000 / p99FrameTimeMs) : 0,
      meanFrameTimeMs: roundMetric(this.sumFrameTimeMs / this.frameCount),
      minFrameTimeMs: roundMetric(this.minFrameTimeMs),
      p50FrameTimeMs: this.quantile(0.5),
      p95FrameTimeMs: this.quantile(0.95),
      p99FrameTimeMs,
      maxFrameTimeMs: roundMetric(this.maxFrameTimeMs),
      framesOver16_67Ms: this.framesOver16_67Ms,
      framesOver33_33Ms: this.framesOver33_33Ms,
      framesOver50Ms: this.framesOver50Ms,
    };
  }

  private quantile(fraction: number): number {
    const targetRank = Math.max(1, Math.ceil(this.frameCount * fraction));
    let seen = 0;
    for (let index = 0; index < this.buckets.length; index += 1) {
      seen += this.buckets[index] ?? 0;
      if (seen < targetRank) continue;
      if (index === OVERFLOW_BUCKET_INDEX) return roundMetric(this.maxFrameTimeMs);
      return roundMetric(index * FRAME_TIME_BUCKET_WIDTH_MS);
    }
    return roundMetric(this.maxFrameTimeMs);
  }
}

function frameTimeToBucket(frameTimeMs: number): number {
  if (frameTimeMs > MAX_BUCKETED_FRAME_TIME_MS) return OVERFLOW_BUCKET_INDEX;
  return Math.ceil(frameTimeMs / FRAME_TIME_BUCKET_WIDTH_MS);
}

function isValidFrameTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function maximumValid(current: number, candidate: number): number {
  return isFiniteNonNegative(candidate) ? Math.max(current, candidate) : current;
}

function clampTimestamp(value: number, lowerBound: number): number {
  return Number.isFinite(value) ? Math.max(value, lowerBound) : lowerBound;
}

function normalizeLabel(value: string): string {
  return value.trim().slice(0, MAX_MARKER_NAME_LENGTH);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function toIsoTimestamp(epochMs: number): string {
  const safeEpochMs = Number.isFinite(epochMs) ? epochMs : 0;
  return new Date(safeEpochMs).toISOString();
}
