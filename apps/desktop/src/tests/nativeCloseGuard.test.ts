import { describe, expect, test, vi } from 'vitest';
import { installNativeCloseGuard } from '../ipc/nativeCloseGuard';

function setup() {
  let handler: ((event: { preventDefault(): void }) => Promise<void>) | null = null;
  const unsubscribe = vi.fn<() => void | Promise<void>>();
  const window = {
    onCloseRequested: vi.fn(async (next: NonNullable<typeof handler>) => {
      handler = next;
      return unsubscribe;
    }),
    close: vi.fn(async () => {}),
  };
  return { window, unsubscribe, request: () => handler?.({ preventDefault: vi.fn() }) };
}

describe('native close settings guard', () => {
  test('coalesces close requests, waits for persistence, then releases the listener before close', async () => {
    const native = setup();
    let resolve!: () => void;
    const flush = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const dispose = await installNativeCloseGuard(native.window, flush, vi.fn());
    const close = native.request();
    await native.request();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(native.window.close).not.toHaveBeenCalled();
    resolve();
    await close;

    expect(native.unsubscribe).toHaveBeenCalledTimes(1);
    expect(native.window.close).toHaveBeenCalledTimes(1);
    expect(native.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
      native.window.close.mock.invocationCallOrder[0] ?? 0,
    );
    dispose();
    expect(native.unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('preserves the window and permits retry after a failed save', async () => {
    const native = setup();
    const error = new Error('save failed');
    const flush = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const dispose = await installNativeCloseGuard(native.window, flush, onError);
    await native.request();
    expect(onError).toHaveBeenCalledWith(error);
    expect(native.window.close).not.toHaveBeenCalled();
    expect(native.unsubscribe).not.toHaveBeenCalled();
    await native.request();
    expect(native.window.close).toHaveBeenCalledTimes(1);
    dispose();
  });

  test('waits for native listener removal before issuing the final close request', async () => {
    const native = setup();
    let removed!: () => void;
    native.unsubscribe.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          removed = resolve;
        }),
    );
    const dispose = await installNativeCloseGuard(native.window, async () => {}, vi.fn());
    const request = native.request();
    await Promise.resolve();
    expect(native.unsubscribe).toHaveBeenCalledTimes(1);
    expect(native.window.close).not.toHaveBeenCalled();
    removed();
    await request;
    expect(native.window.close).toHaveBeenCalledTimes(1);
    await dispose();
  });

  test('does not close after its owner unmounts while persistence is pending', async () => {
    const native = setup();
    let resolve!: () => void;
    const dispose = await installNativeCloseGuard(
      native.window,
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
      vi.fn(),
    );
    const pending = native.request();
    dispose();
    resolve();
    await pending;
    expect(native.window.close).not.toHaveBeenCalled();
    expect(native.unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('restores the guard if the platform rejects the final close request', async () => {
    const native = setup();
    native.window.close.mockRejectedValueOnce(new Error('close failed'));
    const onError = vi.fn();
    const dispose = await installNativeCloseGuard(native.window, async () => {}, onError);
    await native.request();
    expect(native.window.onCloseRequested).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    dispose();
  });
});
