import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFallbackTreeScene } from '../data/fallbackTree';
import type { FallbackRequest } from '../workers/protocol';

class TestWorker extends EventTarget {
  static instances: TestWorker[] = [];
  static startupFails = false;
  static postFails = false;
  readonly requests: FallbackRequest[] = [];
  readonly terminate = vi.fn();

  constructor() {
    super();
    if (TestWorker.startupFails) throw new Error('worker blocked');
    TestWorker.instances.push(this);
  }

  postMessage(request: FallbackRequest): void {
    if (TestWorker.postFails) throw new Error('worker unavailable');
    this.requests.push(request);
  }

  reply(index: number): void {
    const request = this.requests[index];
    if (!request) throw new Error('missing request');
    this.dispatchEvent(
      new MessageEvent('message', {
        data: { id: request.id, scene: createFallbackTreeScene(request.seed) },
      }),
    );
  }
}

describe('fallback Worker lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    TestWorker.instances = [];
    TestWorker.startupFails = false;
    TestWorker.postFails = false;
    vi.stubGlobal('Worker', TestWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('matches out-of-order replies and clears every request timer', async () => {
    const { createFallbackScene } = await import('../workers/fallbackClient');
    const first = createFallbackScene(11);
    const second = createFallbackScene(22);
    const worker = TestWorker.instances[0];
    worker?.reply(1);
    worker?.reply(0);

    expect(await first).toEqual(createFallbackTreeScene(11));
    expect(await second).toEqual(createFallbackTreeScene(22));
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each(['startup', 'postMessage'])('recovers when %s throws', async (stage) => {
    TestWorker.startupFails = stage === 'startup';
    TestWorker.postFails = stage === 'postMessage';
    const { createFallbackScene } = await import('../workers/fallbackClient');

    await expect(createFallbackScene(11)).resolves.toEqual(createFallbackTreeScene(11));
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each(['error', 'messageerror', 'timeout', 'invalid-payload'])(
    'settles all pending requests after %s and retires the broken Worker',
    async (failure) => {
      const { createFallbackScene } = await import('../workers/fallbackClient');
      const firstResolved = vi.fn();
      const secondResolved = vi.fn();
      void createFallbackScene(11).then(firstResolved);
      void createFallbackScene(22).then(secondResolved);
      const worker = TestWorker.instances[0];
      if (failure === 'invalid-payload') {
        worker?.dispatchEvent(new MessageEvent('message', { data: { id: 1, scene: null } }));
      } else if (failure !== 'timeout') {
        worker?.dispatchEvent(new Event(failure, { cancelable: true }));
      }
      await vi.advanceTimersByTimeAsync(5_000);

      expect(firstResolved).toHaveBeenCalledWith(createFallbackTreeScene(11));
      expect(secondResolved).toHaveBeenCalledWith(createFallbackTreeScene(22));
      expect(worker?.terminate).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      await expect(createFallbackScene(33)).resolves.toEqual(createFallbackTreeScene(33));
      expect(TestWorker.instances).toHaveLength(1);
    },
  );
});
