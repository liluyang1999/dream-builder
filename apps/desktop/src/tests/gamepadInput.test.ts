import { describe, expect, test } from 'vitest';
import { type GamepadLike, combinePlayerIntents, sampleStandardGamepad } from '../game/playerInput';

function gamepad({
  axes = [0, 0],
  pressed = [],
}: { axes?: number[]; pressed?: number[] } = {}): GamepadLike {
  return {
    connected: true,
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: pressed.includes(index),
      value: pressed.includes(index) ? 1 : 0,
    })),
  };
}

describe('standard gamepad input', () => {
  test('applies a deadzone and maps the left stick to movement intent', () => {
    expect(sampleStandardGamepad(gamepad({ axes: [0.1, -0.1] }))).toMatchObject({
      forward: 0,
      right: 0,
    });

    const sample = sampleStandardGamepad(gamepad({ axes: [0.7, -0.82] }));
    expect(sample.forward).toBeGreaterThan(0.7);
    expect(sample.right).toBeGreaterThan(0.6);
    expect(sample.direction).toBe('north');
  });

  test('maps standard A, B, Menu, and D-pad buttons', () => {
    const sample = sampleStandardGamepad(gamepad({ pressed: [0, 1, 9, 15] }));
    expect(sample).toMatchObject({
      interactPressed: true,
      sprint: true,
      cancelPressed: true,
      menuPressed: true,
      direction: 'east',
    });
  });

  test('combines keyboard and analog input without exceeding normalized bounds', () => {
    expect(
      combinePlayerIntents(
        { forward: 1, right: 0, sprint: false },
        { forward: 0.5, right: -0.4, sprint: true },
      ),
    ).toEqual({ forward: 1, right: -0.4, sprint: true });
  });
});
