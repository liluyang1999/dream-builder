import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const frame = vi.hoisted(() => ({
  callbacks: new Map<number, (state: unknown, delta: number) => void>(),
  gl: {
    render: vi.fn(),
    getContext: () => ({ getExtension: () => null, getParameter: () => 'test renderer' }),
    info: {
      autoReset: true,
      reset: vi.fn(),
      render: { calls: 4, triangles: 20 },
      memory: { geometries: 2, textures: 1 },
    },
  },
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: unknown) => unknown) => select({ gl: frame.gl }),
  useFrame: (callback: (state: unknown, delta: number) => void, priority: number) => {
    frame.callbacks.set(priority, callback);
  },
}));

import { PerformanceProbe } from '../scene/PerformanceProbe';

describe('PerformanceProbe rendering ownership', () => {
  beforeEach(() => {
    frame.callbacks.clear();
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  test('renders low-quality frames when no postprocessing composer owns the render loop', () => {
    render(<PerformanceProbe renderDirectly />);
    const state = { scene: {}, camera: {} };
    frame.callbacks.get(2)?.(state, 1 / 60);

    expect(frame.gl.render).toHaveBeenCalledExactlyOnceWith(state.scene, state.camera);
  });

  test('leaves postprocessed frames to the composer and restores renderer accounting', () => {
    const view = render(<PerformanceProbe renderDirectly={false} />);
    frame.callbacks.get(2)?.({ scene: {}, camera: {} }, 1 / 60);

    expect(frame.gl.render).not.toHaveBeenCalled();
    expect(frame.gl.info.autoReset).toBe(false);
    view.unmount();
    expect(frame.gl.info.autoReset).toBe(true);
  });
});
