// @vitest-environment node

import { describe, expect, test } from 'vitest';
import type { PerformanceReport } from '../performance/performanceMetrics';
import {
  type M2EvidenceBundle,
  type M2PlaytestObservation,
  M2_EVIDENCE_SCHEMA_VERSION,
  M2_PERFORMANCE_TARGET,
  evaluateM2EvidenceBundle,
} from '../playtest/m2Evidence';

describe('evaluateM2EvidenceBundle', () => {
  test('passes one privacy-minimized five-player bundle at the documented boundaries', () => {
    const bundle = passingBundle();
    const fifthObservation = requiredObservation(bundle, 4);
    bundle.observations[4] = {
      ...fifthObservation,
      milestones: {
        ...fifthObservation.milestones,
        firstRouteSeconds: 91,
      },
      misidentifiedToolAsGoal: true,
    };

    const evaluation = evaluateM2EvidenceBundle(bundle);

    expect(evaluation.passed).toBe(true);
    expect(evaluation.summary).toMatchObject({
      observationCount: 5,
      eligibleObservationCount: 5,
      firstRoutePassCount: 4,
      completionPassCount: 5,
      unrecoverableStuckCount: 0,
    });
    expect(check(evaluation, 'first-route')).toMatchObject({
      passed: true,
      actual: '4/5',
      required: '至少 4/5',
    });
    expect(check(evaluation, 'target-viewport')).toMatchObject({
      passed: true,
      actual: '1220×744 @ 2.63x',
      required: '1220×744 @ 2.63x',
    });
    expect(check(evaluation, 'performance-budget').passed).toBe(true);
  });

  test('rejects browser, short, phase-incomplete, slow or visibly stuttering performance evidence', () => {
    const bundle = passingBundle();
    const report = performanceReport();
    report.context.runtime = 'browser';
    report.context.source = 'fallback';
    report.completedTargetDuration = false;
    report.durationMs = 30_000;
    report.phases = report.phases.filter((phase) => phase.name !== 'cleansing');
    report.session.averageFps = 40;
    report.session.onePercentLowFps = 20;
    report.session.framesOver50Ms = 800;
    bundle.performanceReport = report;
    bundle.targetDevice.sustainedStutterObserved = true;

    const evaluation = evaluateM2EvidenceBundle(bundle);

    expect(evaluation.passed).toBe(false);
    expect(check(evaluation, 'native-performance-report').passed).toBe(false);
    expect(check(evaluation, 'performance-phases').passed).toBe(false);
    expect(check(evaluation, 'performance-budget').passed).toBe(false);
    expect(check(evaluation, 'sustained-stutter').passed).toBe(false);
  });

  test('fails eligibility, completion, hint and recoverability gates without hiding raw failures', () => {
    const bundle = passingBundle();
    const firstObservation = requiredObservation(bundle, 0);
    bundle.observations[0] = {
      ...firstObservation,
      firstExposureConfirmed: false,
      hintReceived: true,
      hintNote: '主持人指出了第一枚光种。',
      outcome: 'time-limit',
      milestones: {
        ...firstObservation.milestones,
        completionSeconds: null,
      },
    };
    const secondObservation = requiredObservation(bundle, 1);
    bundle.observations[1] = {
      ...secondObservation,
      unrecoverableStuck: true,
      technicalIssueNote: '倒木旁无法通过行走或 R 恢复。',
    };

    const evaluation = evaluateM2EvidenceBundle(bundle);

    expect(evaluation.passed).toBe(false);
    expect(evaluation.summary).toMatchObject({
      eligibleObservationCount: 4,
      completionPassCount: 4,
      unrecoverableStuckCount: 1,
      hintReceivedCount: 1,
    });
    expect(check(evaluation, 'sample-eligibility').passed).toBe(false);
    expect(check(evaluation, 'completion')).toMatchObject({
      passed: false,
      actual: '4/5',
    });
    expect(check(evaluation, 'recoverability').passed).toBe(false);
  });

  test('rejects duplicate or identifying participant fields and raw performance samples', () => {
    const bundle = passingBundle() as unknown as Record<string, unknown> & {
      observations: Array<Record<string, unknown>>;
      performanceReport: Record<string, unknown>;
    };
    bundle.observations[1] = {
      ...bundle.observations[1],
      participantCode: 'P01',
      name: '不应保存的姓名',
    };
    bundle.performanceReport.samples = [{ frameTimeMs: 16.7 }];

    const evaluation = evaluateM2EvidenceBundle(bundle);

    expect(evaluation.passed).toBe(false);
    expect(check(evaluation, 'privacy-minimization').passed).toBe(false);
    expect(evaluation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'duplicate-participant-code',
        'prohibited-participant-field',
        'raw-performance-samples',
      ]),
    );
  });

  test('rejects a hand-written partial object that only imitates passing headline metrics', () => {
    const bundle = passingBundle();
    bundle.performanceReport = {
      schemaVersion: 1,
      durationMs: 600_000,
      targetDurationMs: 600_000,
      completedTargetDuration: true,
      context: {
        runtime: 'tauri',
        source: 'rust',
        viewport: { width: 1280, height: 800, devicePixelRatio: 2.5 },
      },
      session: {
        frameCount: 35_400,
        averageFps: 59,
        onePercentLowFps: 45,
        framesOver50Ms: 20,
      },
      phases: [{ name: 'scene-load' }, { name: 'cleansing' }],
    };

    const evaluation = evaluateM2EvidenceBundle(bundle);

    expect(evaluation.passed).toBe(false);
    expect(check(evaluation, 'bundle-schema').passed).toBe(false);
    expect(evaluation.issues.map((issue) => issue.code)).toContain('invalid-performance-report');
  });
});

function check(evaluation: ReturnType<typeof evaluateM2EvidenceBundle>, id: string) {
  const result = evaluation.checks.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing check: ${id}`);
  return result;
}

function passingBundle(): M2EvidenceBundle {
  return {
    schemaVersion: M2_EVIDENCE_SCHEMA_VERSION,
    createdAt: '2026-07-23T05:00:00.000Z',
    build: {
      appVersion: '1.0',
      worktreeId: 'local-dirty-3f7d6454',
      artifactSha256: '3f7d64540a0cd3861f6c32553d46ffd4dcfa506d2a857dfcccef1fc514bbf6e1',
    },
    targetDevice: {
      id: 'M2-WIN-I7-10850H-GTX1650TI',
      cpu: 'Intel Core i7-10850H',
      gpu: 'NVIDIA GeForce GTX 1650 Ti Max-Q',
      gpuDriver: '32.0.15.7357',
      memoryGb: 31.8,
      displayWidth: 3840,
      displayHeight: 2160,
      refreshRateHz: 59,
      scalePercent: 250,
      devicePixelRatio: 2.625,
      viewportWidth: 1220,
      viewportHeight: 744,
      sustainedStutterObserved: false,
    },
    performanceReport: performanceReport(),
    observations: Array.from({ length: 5 }, (_, index) => observation(index + 1)),
  };
}

function observation(index: number): M2PlaytestObservation {
  return {
    participantCode: `P${String(index).padStart(2, '0')}`,
    sessionDate: '2026-07-23',
    firstExposureConfirmed: true,
    designDocsUnreadConfirmed: true,
    outcome: 'completed' as const,
    milestones: {
      firstMovementSeconds: 5,
      firstRouteSeconds: 60,
      lightSeedSeconds: [120, 260, 410] as [number, number, number],
      memoryState: 'read' as const,
      nodeArrivalSeconds: 450,
      completionSeconds: 600,
    },
    misidentifiedToolAsGoal: false,
    unrecoverableStuck: false,
    hintReceived: false,
    resetCount: 0,
    purificationErrors: 1,
    longStallLocations: '',
    technicalIssueNote: '',
    hintNote: '',
    restatedGoal: '收集光种并让森林恢复。',
    confusionNote: '',
    favoriteMomentNote: '智慧树复苏。',
  };
}

function performanceReport(): PerformanceReport {
  return {
    schemaVersion: 1,
    startedAt: '2026-07-23T04:00:00.000Z',
    endedAt: '2026-07-23T04:10:00.000Z',
    durationMs: 600_000,
    targetDurationMs: 600_000,
    completedTargetDuration: true,
    context: {
      runtime: 'tauri' as 'tauri' | 'browser',
      seed: 424242,
      reducedMotion: false,
      source: 'rust' as 'rust' | 'fallback' | 'unknown',
      viewport: { width: 1220, height: 744, devicePixelRatio: 2.625 },
      userAgent: 'test-webview',
      renderer: 'ANGLE (NVIDIA GeForce GTX 1650 Ti)',
      webgl2: true,
      timeToFirstFrameMs: 240,
    },
    session: {
      frameCount: 33_000,
      averageFps: M2_PERFORMANCE_TARGET.minAverageFps,
      onePercentLowFps: M2_PERFORMANCE_TARGET.minOnePercentLowFps,
      meanFrameTimeMs: 16.9,
      minFrameTimeMs: 15,
      p50FrameTimeMs: 16.5,
      p95FrameTimeMs: 18,
      p99FrameTimeMs: 33,
      maxFrameTimeMs: 120,
      framesOver16_67Ms: 10_000,
      framesOver33_33Ms: 500,
      framesOver50Ms: 330,
    },
    renderPeaks: {
      drawCalls: 120,
      triangles: 8_000,
      geometries: 80,
      textures: 20,
      jsHeapBytes: 90_000_000,
    },
    phases: [phase('scene-load', 1_200, 90), phase('cleansing', 6_000, 60)],
    markers: [],
    droppedMarkers: 0,
    droppedPhases: 0,
    limitations: [
      'GPU frame time is not available from this WebGL probe.',
      'Frame times are CPU-observed animation intervals and can include browser scheduling delays.',
      'Only bounded aggregate histograms, capped phases, and capped event markers are retained; raw frames are not stored.',
    ],
  };
}

function phase(name: string, durationMs: number, maxFrameTimeMs: number) {
  const frameCount = Math.round(durationMs / 16.7);
  return {
    name,
    durationMs,
    startedOffsetMs: 100,
    endedOffsetMs: 100 + durationMs,
    frameCount,
    averageFps: Math.round(((frameCount * 1_000) / durationMs) * 100) / 100,
    onePercentLowFps: 30,
    meanFrameTimeMs: 17,
    minFrameTimeMs: 15,
    p50FrameTimeMs: 16.5,
    p95FrameTimeMs: 20,
    p99FrameTimeMs: 33,
    maxFrameTimeMs,
    framesOver16_67Ms: 10,
    framesOver33_33Ms: 2,
    framesOver50Ms: 1,
  };
}

function requiredObservation(bundle: M2EvidenceBundle, index: number): M2PlaytestObservation {
  const observation = bundle.observations[index];
  if (!observation) throw new Error(`Missing observation ${index}`);
  return observation;
}
