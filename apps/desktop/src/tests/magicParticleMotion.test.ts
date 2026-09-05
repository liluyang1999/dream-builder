import { describe, expect, test } from 'vitest';
import { advanceMagicParticlePositions } from '../scene/magicParticleMotion';

function simulate(framesPerSecond: number): Float32Array {
  const positions = new Float32Array([0, 1, 0]);
  const phases = new Float32Array([0]);
  for (let frame = 1; frame <= framesPerSecond; frame += 1) {
    advanceMagicParticlePositions(
      positions,
      phases,
      frame / framesPerSecond,
      1 / framesPerSecond,
      null,
      false,
    );
  }
  return positions;
}

describe('magic particle motion', () => {
  test('keeps one second of drift consistent across 30, 60, and 144 Hz displays', () => {
    const reference = simulate(60);
    for (const rate of [30, 144]) {
      const positions = simulate(rate);
      for (let axis = 0; axis < positions.length; axis += 1) {
        expect(Math.abs((positions[axis] ?? 0) - (reference[axis] ?? 0))).toBeLessThan(0.003);
      }
    }
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores non-advancing or invalid delta %s',
    (delta) => {
      const positions = new Float32Array([0, 1, 0]);
      advanceMagicParticlePositions(positions, new Float32Array([0]), 1, delta, null, false);
      expect([...positions]).toEqual([0, 1, 0]);
    },
  );

  test('bounds a resume-after-suspension step', () => {
    const positions = new Float32Array([0, 1, 0]);
    const bounded = positions.slice();
    const phases = new Float32Array([0]);
    advanceMagicParticlePositions(positions, phases, 10, 10, null, false);
    advanceMagicParticlePositions(bounded, phases, 10, 0.1, null, false);
    expect(positions).toEqual(bounded);
  });
});
