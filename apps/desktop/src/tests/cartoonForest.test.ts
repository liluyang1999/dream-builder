import { describe, expect, test } from 'vitest';
import { createForestDecorations } from '../scene/CartoonForest';

describe('cartoon forest decoration layout', () => {
  test('is deterministic for a scene seed', () => {
    expect(createForestDecorations(424242, 'balanced')).toEqual(
      createForestDecorations(424242, 'balanced'),
    );
    expect(createForestDecorations(7, 'balanced')).not.toEqual(
      createForestDecorations(424242, 'balanced'),
    );
  });

  test('scales decoration density with the selected quality budget', () => {
    const low = createForestDecorations(1, 'low');
    const balanced = createForestDecorations(1, 'balanced');
    const high = createForestDecorations(1, 'high');

    expect(low.grass).toHaveLength(58);
    expect(balanced.grass).toHaveLength(120);
    expect(high.grass).toHaveLength(190);
    expect(high.flowers.length).toBeGreaterThan(low.flowers.length);
  });

  test('keeps the central tree clearing free of decorative blockers', () => {
    const decorations = createForestDecorations(424242, 'high');
    for (const transform of [
      ...decorations.grass,
      ...decorations.shrubs,
      ...decorations.stones,
      ...decorations.flowers,
    ]) {
      expect(Math.hypot(transform.x, transform.z)).toBeGreaterThan(1.65);
    }
  });
});
