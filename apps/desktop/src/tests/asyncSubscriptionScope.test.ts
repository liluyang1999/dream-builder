import { describe, expect, test, vi } from 'vitest';
import { createAsyncSubscriptionScope } from '../ipc/asyncSubscriptionScope';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('createAsyncSubscriptionScope', () => {
  test('closes subscriptions that resolved before cleanup', async () => {
    const unsubscribe = vi.fn();
    const scope = createAsyncSubscriptionScope();

    scope.add(Promise.resolve(unsubscribe));
    await Promise.resolve();
    scope.close();
    scope.close();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('immediately closes a subscription that resolves after cleanup', async () => {
    const pending = deferred<() => void>();
    const unsubscribe = vi.fn();
    const scope = createAsyncSubscriptionScope();

    scope.add(pending.promise);
    scope.close();
    pending.resolve(unsubscribe);
    await Promise.resolve();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('reports subscription and cleanup failures without leaking later cleanups', async () => {
    const onError = vi.fn();
    const laterCleanup = vi.fn();
    const scope = createAsyncSubscriptionScope(onError);

    scope.add(Promise.reject(new Error('listen failed')));
    scope.add(
      Promise.resolve(() => {
        throw new Error('cleanup failed');
      }),
    );
    scope.add(Promise.resolve(laterCleanup));
    await Promise.resolve();
    scope.close();

    expect(onError).toHaveBeenCalledTimes(2);
    expect(laterCleanup).toHaveBeenCalledTimes(1);
  });
});
