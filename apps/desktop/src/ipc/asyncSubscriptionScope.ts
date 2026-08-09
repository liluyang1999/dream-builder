export type Unsubscribe = () => void;

export interface AsyncSubscriptionScope {
  add(subscription: Promise<Unsubscribe>): void;
  close(): void;
}

/**
 * Own a group of asynchronously-created subscriptions.
 *
 * Tauri's `listen` resolves its cleanup function asynchronously. React may
 * unmount an effect before that promise resolves, especially under StrictMode.
 * This scope closes late arrivals immediately and makes cleanup idempotent.
 */
export function createAsyncSubscriptionScope(
  onError: (error: unknown) => void = () => {},
): AsyncSubscriptionScope {
  let closed = false;
  const cleanups = new Set<Unsubscribe>();

  const report = (error: unknown): void => {
    try {
      onError(error);
    } catch {
      // Cleanup must continue even if an observer itself throws.
    }
  };

  const runCleanup = (cleanup: Unsubscribe): void => {
    try {
      cleanup();
    } catch (error) {
      report(error);
    }
  };

  return {
    add(subscription) {
      void subscription.then(
        (cleanup) => {
          if (closed) {
            runCleanup(cleanup);
          } else {
            cleanups.add(cleanup);
          }
        },
        (error: unknown) => {
          if (!closed) report(error);
        },
      );
    },
    close() {
      if (closed) return;
      closed = true;
      const pendingCleanups = [...cleanups];
      cleanups.clear();
      for (const cleanup of pendingCleanups) runCleanup(cleanup);
    },
  };
}
