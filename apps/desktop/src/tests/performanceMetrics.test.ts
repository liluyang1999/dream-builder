// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  MAX_PERFORMANCE_MARKERS,
  MAX_PERFORMANCE_PHASES,
  PERFORMANCE_REPORT_VERSION,
  PerformanceMetricsRecorder,
} from '../performance/performanceMetrics';

const context = {
  runtime: 'browser' as const,
  seed: 424242,
  reducedMotion: false,
  source: 'fallback' as const,
  viewport: { width: 1280, height: 720, devicePixelRatio: 1 },
  userAgent: 'test-browser',
  renderer: 'test-gpu',
  webgl2: true,
  timeToFirstFrameMs: 240,
};

describe('PerformanceMetricsRecorder', () => {
  test('builds deterministic bounded frame and render statistics', () => {
    const recorder = new PerformanceMetricsRecorder({
      startedAtEpochMs: 1_000,
      startedAtMonotonicMs: 100,
      targetDurationMs: 600_000,
    });

    recorder.recordFrame(sample(10, 4, 1_000, 100), 110);
    recorder.recordFrame(sample(20, 8, 2_000, 200), 130);
    recorder.recordFrame(sample(40, 12, 3_000, 300), 170);
    recorder.recordFrame(sample(100, 6, 1_500, 250), 200);

    const report = recorder.buildReport({
      endedAtEpochMs: 1_200,
      endedAtMonotonicMs: 300,
      context,
    });

    expect(report.schemaVersion).toBe(PERFORMANCE_REPORT_VERSION);
    expect(report.durationMs).toBe(200);
    expect(report.completedTargetDuration).toBe(false);
    expect(report.session).toMatchObject({
      frameCount: 4,
      averageFps: 20,
      onePercentLowFps: 10,
      meanFrameTimeMs: 42.5,
      p50FrameTimeMs: 20,
      p95FrameTimeMs: 100,
      p99FrameTimeMs: 100,
      maxFrameTimeMs: 100,
      framesOver16_67Ms: 3,
      framesOver33_33Ms: 2,
      framesOver50Ms: 1,
    });
    expect(report.renderPeaks).toEqual({
      drawCalls: 12,
      triangles: 3_000,
      geometries: 14,
      textures: 9,
      jsHeapBytes: 300,
    });
    expect(report.limitations).toContain('GPU frame time is not available from this WebGL probe.');
    expect('samples' in report).toBe(false);
  });

  test('tracks a cleansing phase separately and leaves resources to the game state machine', () => {
    const recorder = new PerformanceMetricsRecorder({
      startedAtEpochMs: 2_000,
      startedAtMonotonicMs: 0,
      targetDurationMs: 600_000,
    });
    recorder.beginPhase('cleansing', 20);
    recorder.recordFrame(sample(18, 5, 1_200, null), 38);
    recorder.recordFrame(sample(72, 9, 2_400, null), 110);
    recorder.endPhase('cleansing', 120);

    const report = recorder.buildReport({
      endedAtEpochMs: 2_200,
      endedAtMonotonicMs: 200,
      context,
    });

    expect(report.phases).toEqual([
      expect.objectContaining({
        name: 'cleansing',
        durationMs: 100,
        frameCount: 2,
        maxFrameTimeMs: 72,
      }),
    ]);
  });

  test('ignores invalid frames and caps markers without unbounded event growth', () => {
    const recorder = new PerformanceMetricsRecorder({
      startedAtEpochMs: 3_000,
      startedAtMonotonicMs: 0,
      targetDurationMs: 600_000,
    });
    recorder.recordFrame(sample(Number.NaN, 1, 1, null), 1);
    recorder.recordFrame(sample(-1, 1, 1, null), 2);
    for (let index = 0; index < MAX_PERFORMANCE_MARKERS + 7; index += 1) {
      recorder.mark(`event-${index}`, index);
    }
    for (let index = 0; index < MAX_PERFORMANCE_PHASES + 3; index += 1) {
      recorder.beginPhase(`phase-${index}`, index);
      recorder.endPhase(`phase-${index}`, index + 1);
    }

    const report = recorder.buildReport({
      endedAtEpochMs: 3_100,
      endedAtMonotonicMs: 100,
      context,
    });

    expect(report.session.frameCount).toBe(0);
    expect(report.markers).toHaveLength(MAX_PERFORMANCE_MARKERS);
    expect(report.droppedMarkers).toBe(7);
    expect(report.phases).toHaveLength(MAX_PERFORMANCE_PHASES);
    expect(report.droppedPhases).toBe(3);
  });
});

function sample(
  frameTimeMs: number,
  drawCalls: number,
  triangles: number,
  jsHeapBytes: number | null,
) {
  return {
    frameTimeMs,
    drawCalls,
    triangles,
    geometries: 14,
    textures: 9,
    jsHeapBytes,
  };
}
