export type RuneDirection = 'north' | 'east' | 'south' | 'west';

export const PURIFICATION_SEQUENCE = [
  'north',
  'east',
  'north',
  'west',
] as const satisfies readonly RuneDirection[];

export interface PurificationAttempt {
  step: number;
  mistakes: number;
}

export type PurificationOutcome = 'advanced' | 'reset' | 'completed';

export function createPurificationAttempt(): PurificationAttempt {
  return { step: 0, mistakes: 0 };
}

export function applyPurificationInput(
  attempt: PurificationAttempt,
  direction: RuneDirection,
): { attempt: PurificationAttempt; outcome: PurificationOutcome } {
  if (attempt.step >= PURIFICATION_SEQUENCE.length) {
    return { attempt, outcome: 'completed' };
  }

  if (direction !== PURIFICATION_SEQUENCE[attempt.step]) {
    return {
      attempt: { step: 0, mistakes: attempt.mistakes + 1 },
      outcome: 'reset',
    };
  }

  const nextAttempt = { ...attempt, step: attempt.step + 1 };
  return {
    attempt: nextAttempt,
    outcome: nextAttempt.step === PURIFICATION_SEQUENCE.length ? 'completed' : 'advanced',
  };
}
