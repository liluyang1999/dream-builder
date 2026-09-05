import type { Unsubscribe } from './asyncSubscriptionScope';

interface CloseRequest {
  preventDefault(): void;
}

interface NativeWindow {
  onCloseRequested(handler: (event: CloseRequest) => Promise<void>): Promise<Unsubscribe>;
  close(): Promise<void>;
}

/** Flush preferences before titlebar/menu close, using the existing close permission. */
export async function installNativeCloseGuard(
  window: NativeWindow,
  flush: () => Promise<void>,
  onError: (error: unknown) => void,
): Promise<Unsubscribe> {
  let disposed = false;
  let closing = false;
  let unlisten: Unsubscribe | null = null;
  const stopListening = async () => {
    const stop = unlisten;
    unlisten = null;
    await stop?.();
  };

  const onClose = async (event: CloseRequest): Promise<void> => {
    event.preventDefault();
    if (disposed || closing) return;
    closing = true;
    try {
      await flush();
      if (disposed) return;
      // Tauri's default onCloseRequested continuation calls destroy(), which
      // has a separate permission. Remove our guard and request normal close.
      await stopListening();
      if (disposed) return;
      await window.close();
    } catch (error) {
      if (!disposed) {
        if (!unlisten) {
          try {
            unlisten = await window.onCloseRequested(onClose);
            if (disposed) await stopListening();
          } catch (subscriptionError) {
            onError(subscriptionError);
          }
        }
        onError(error);
      }
    } finally {
      closing = false;
    }
  };

  unlisten = await window.onCloseRequested(onClose);
  return () => {
    disposed = true;
    return stopListening();
  };
}
