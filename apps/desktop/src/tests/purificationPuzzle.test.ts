// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  PURIFICATION_SEQUENCE,
  applyPurificationInput,
  createPurificationAttempt,
} from '../game/purificationPuzzle';

describe('purification puzzle', () => {
  test('completes only after the full direction rhythm is entered in order', () => {
    let attempt = createPurificationAttempt();
    for (const [index, direction] of PURIFICATION_SEQUENCE.entries()) {
      const result = applyPurificationInput(attempt, direction);
      attempt = result.attempt;
      expect(result.outcome).toBe(
        index === PURIFICATION_SEQUENCE.length - 1 ? 'completed' : 'advanced',
      );
    }
    expect(attempt.step).toBe(PURIFICATION_SEQUENCE.length);
  });

  test('resets only the local sequence after a wrong direction', () => {
    const first = applyPurificationInput(createPurificationAttempt(), PURIFICATION_SEQUENCE[0]);
    const failed = applyPurificationInput(first.attempt, 'south');

    expect(failed).toEqual({
      attempt: { step: 0, mistakes: 1 },
      outcome: 'reset',
    });
  });

  test('returns new state without mutating the prior attempt', () => {
    const attempt = createPurificationAttempt();
    applyPurificationInput(attempt, PURIFICATION_SEQUENCE[0]);
    expect(attempt).toEqual({ step: 0, mistakes: 0 });
  });
});
