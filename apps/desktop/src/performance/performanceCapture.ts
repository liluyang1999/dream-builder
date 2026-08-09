import {
  type PerformanceFrameSample,
  PerformanceMetricsRecorder,
  type PerformanceReport,
  type PerformanceReportContext,
} from './performanceMetrics';

export const PERFORMANCE_CAPTURE_TARGET_DURATION_MS = 10 * 60 * 1_000;
const DEFAULT_PUBLISH_INTERVAL_MS = 500;
const MAX_USER_AGENT_LENGTH = 256;
const MAX_RENDERER_LENGTH = 160;

export type PerformanceCaptureStatus = 'idle' | 'recording' | 'complete';

export type PerformanceCaptureStartContext = Omit<
  PerformanceReportContext,
  'renderer' | 'webgl2' | 'timeToFirstFrameMs'
>;

export interface PerformanceCaptureSnapshot {
  status: PerformanceCaptureStatus;
  elapsedMs: number;
  targetDurationMs: number;
  report: PerformanceReport | null;
}

export interface PerformanceCaptureEnvironment {
  monotonicNow(): number;
  epochNow(): number;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(handle: unknown): void;
}

interface PerformanceCaptureOptions {
  environment?: PerformanceCaptureEnvironment;
  targetDurationMs?: number;
  publishIntervalMs?: number;
}

export class PerformanceCaptureController {
  private readonly environment: PerformanceCaptureEnvironment;
  private readonly targetDurationMs: number;
  private readonly publishIntervalMs: number;
  private readonly listeners = new Set<() => void>();
  private recorder: PerformanceMetricsRecorder | null = null;
  private context: PerformanceReportContext | null = null;
  private startedAtMonotonicMs = 0;
  private startedAtEpochMs = 0;
  private lastPublishedAtMonotonicMs = 0;
  private stopTimer: unknown | null = null;
  private renderer: string | null = null;
  private webgl2: boolean | null = null;
  private timeToFirstFrameMs: number | null = null;
  private snapshot: PerformanceCaptureSnapshot;

  constructor(options: PerformanceCaptureOptions = {}) {
    this.environment = options.environment ?? browserPerformanceEnvironment;
    this.targetDurationMs = positiveOrDefault(
      options.targetDurationMs,
      PERFORMANCE_CAPTURE_TARGET_DURATION_MS,
    );
    this.publishIntervalMs = nonNegativeOrDefault(
      options.publishIntervalMs,
      DEFAULT_PUBLISH_INTERVAL_MS,
    );
    this.snapshot = createIdleSnapshot(this.targetDurationMs);
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): PerformanceCaptureSnapshot => this.snapshot;

  start(context: PerformanceCaptureStartContext): void {
    if (this.snapshot.status === 'recording') return;

    this.cancelStopTimer();
    this.startedAtMonotonicMs = this.environment.monotonicNow();
    this.startedAtEpochMs = this.environment.epochNow();
    this.lastPublishedAtMonotonicMs = this.startedAtMonotonicMs;
    this.context = {
      ...context,
      userAgent: context.userAgent.slice(0, MAX_USER_AGENT_LENGTH),
      renderer: this.renderer,
      webgl2: this.webgl2,
      timeToFirstFrameMs: this.timeToFirstFrameMs,
    };
    this.recorder = new PerformanceMetricsRecorder({
      startedAtEpochMs: this.startedAtEpochMs,
      startedAtMonotonicMs: this.startedAtMonotonicMs,
      targetDurationMs: this.targetDurationMs,
    });
    this.recorder.mark('capture-started', this.startedAtMonotonicMs);
    this.publish('recording', this.startedAtMonotonicMs, this.startedAtEpochMs);
    this.stopTimer = this.environment.setTimer(() => this.stop(), this.targetDurationMs);
  }

  stop(): void {
    if (this.snapshot.status !== 'recording' || !this.recorder || !this.context) return;
    const nowMonotonicMs = this.environment.monotonicNow();
    const nowEpochMs = this.environment.epochNow();
    this.recorder.mark('capture-stopped', nowMonotonicMs);
    this.cancelStopTimer();
    this.publish('complete', nowMonotonicMs, nowEpochMs);
  }

  clear(): void {
    this.cancelStopTimer();
    this.recorder = null;
    this.context = null;
    this.snapshot = createIdleSnapshot(this.targetDurationMs);
    this.emit();
  }

  recordFrame(sample: PerformanceFrameSample): void {
    if (this.snapshot.status !== 'recording' || !this.recorder) return;
    const nowMonotonicMs = this.environment.monotonicNow();
    this.recorder.recordFrame(sample, nowMonotonicMs);

    if (nowMonotonicMs - this.startedAtMonotonicMs >= this.targetDurationMs) {
      this.stop();
      return;
    }
    if (nowMonotonicMs - this.lastPublishedAtMonotonicMs >= this.publishIntervalMs) {
      this.publish('recording', nowMonotonicMs, this.environment.epochNow());
    }
  }

  mark(name: string): void {
    if (this.snapshot.status !== 'recording' || !this.recorder) return;
    this.recorder.mark(name, this.environment.monotonicNow());
  }

  beginPhase(name: string): void {
    if (this.snapshot.status !== 'recording' || !this.recorder) return;
    this.recorder.beginPhase(name, this.environment.monotonicNow());
  }

  endPhase(name: string): void {
    if (this.snapshot.status !== 'recording' || !this.recorder) return;
    this.recorder.endPhase(name, this.environment.monotonicNow());
  }

  observeFirstSceneFrame(monotonicMs = this.environment.monotonicNow()): void {
    if (this.timeToFirstFrameMs !== null || !Number.isFinite(monotonicMs) || monotonicMs < 0)
      return;
    this.timeToFirstFrameMs = roundMetric(monotonicMs);
    this.updateActiveContext({ timeToFirstFrameMs: this.timeToFirstFrameMs });
  }

  setRendererInfo(renderer: string | null, webgl2: boolean): void {
    this.renderer = renderer?.trim().slice(0, MAX_RENDERER_LENGTH) || null;
    this.webgl2 = webgl2;
    this.updateActiveContext({ renderer: this.renderer, webgl2 });
  }

  private updateActiveContext(update: Partial<PerformanceReportContext>): void {
    if (!this.context || this.snapshot.status !== 'recording') return;
    this.context = { ...this.context, ...update };
  }

  private publish(
    status: Exclude<PerformanceCaptureStatus, 'idle'>,
    endedAtMonotonicMs: number,
    endedAtEpochMs: number,
  ): void {
    if (!this.recorder || !this.context) return;
    const report = this.recorder.buildReport({
      endedAtEpochMs,
      endedAtMonotonicMs,
      context: this.context,
    });
    this.lastPublishedAtMonotonicMs = endedAtMonotonicMs;
    this.snapshot = {
      status,
      elapsedMs: report.durationMs,
      targetDurationMs: this.targetDurationMs,
      report,
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private cancelStopTimer(): void {
    if (this.stopTimer === null) return;
    this.environment.clearTimer(this.stopTimer);
    this.stopTimer = null;
  }
}

const browserPerformanceEnvironment: PerformanceCaptureEnvironment = {
  monotonicNow: () => globalThis.performance?.now() ?? Date.now(),
  epochNow: () => Date.now(),
  setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimer: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const performanceCapture = new PerformanceCaptureController();

function createIdleSnapshot(targetDurationMs: number): PerformanceCaptureSnapshot {
  return {
    status: 'idle',
    elapsedMs: 0,
    targetDurationMs,
    report: null,
  };
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}
