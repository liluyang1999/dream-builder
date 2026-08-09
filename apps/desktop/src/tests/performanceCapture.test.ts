// @vitest-environment node

import { describe, expect, test, vi } from 'vitest';
import {
  PerformanceCaptureController,
  type PerformanceCaptureEnvironment,
} from '../performance/performanceCapture';

const baseContext = {
  runtime: 'browser' as const,
  seed: 424242,
  reducedMotion: false,
  source: 'fallback' as const,
  viewport: { width: 1280, height: 720, devicePixelRatio: 1 },
  userAgent: 'test-browser',
};

describe('PerformanceCaptureController', () => {
  test('auto-stops at the target duration and keeps a report enriched by the scene probe', () => {
    const harness = createHarness();
    const controller = new PerformanceCaptureController({
      environment: harness.environment,
      targetDurationMs: 1_000,
      publishIntervalMs: 0,
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.observeFirstSceneFrame(240);
    controller.setRendererInfo('Test GPU', true);

    controller.start(baseContext);
    harness.monotonicMs = 10;
    harness.epochMs = 1_010;
    controller.recordFrame(sample(16));

    expect(controller.getSnapshot()).toMatchObject({
      status: 'recording',
      elapsedMs: 10,
      targetDurationMs: 1_000,
      report: {
        context: {
          renderer: 'Test GPU',
          webgl2: true,
          timeToFirstFrameMs: 240,
        },
        session: { frameCount: 1 },
      },
    });

    harness.monotonicMs = 1_000;
    harness.epochMs = 2_000;
    harness.fireTimer();

    expect(controller.getSnapshot()).toMatchObject({
      status: 'complete',
      elapsedMs: 1_000,
      report: {
        completedTargetDuration: true,
        durationMs: 1_000,
        session: { frameCount: 1 },
      },
    });
    expect(listener).toHaveBeenCalled();
  });

  test('ignores capture-only events while idle and can clear a completed report', () => {
    const harness = createHarness();
    const controller = new PerformanceCaptureController({ environment: harness.environment });

    controller.mark('before-start');
    controller.beginPhase('cleansing');
    controller.recordFrame(sample(20));
    expect(controller.getSnapshot().report).toBeNull();

    controller.start(baseContext);
    harness.monotonicMs = 80;
    harness.epochMs = 1_080;
    controller.stop();
    expect(controller.getSnapshot().status).toBe('complete');

    controller.clear();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'idle',
      elapsedMs: 0,
      report: null,
    });
    expect(harness.timerCancelled).toBe(true);
  });
});

function sample(frameTimeMs: number) {
  return {
    frameTimeMs,
    drawCalls: 4,
    triangles: 1_000,
    geometries: 12,
    textures: 8,
    jsHeapBytes: null,
  };
}

interface CaptureHarness {
  environment: PerformanceCaptureEnvironment;
  monotonicMs: number;
  epochMs: number;
  timerCancelled: boolean;
  fireTimer(): void;
}

function createHarness(): CaptureHarness {
  let timer: (() => void) | null = null;
  const harness: CaptureHarness = {
    monotonicMs: 0,
    epochMs: 1_000,
    timerCancelled: false,
    fireTimer() {
      timer?.();
    },
    environment: {
      monotonicNow: () => harness.monotonicMs,
      epochNow: () => harness.epochMs,
      setTimer(callback: () => void) {
        timer = callback;
        return callback;
      },
      clearTimer() {
        harness.timerCancelled = true;
        timer = null;
      },
    },
  };
  return harness;
}
