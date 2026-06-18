/**
 * Web Worker: generates the deterministic fallback scene off the main thread.
 *
 * Teaching points:
 * - Heavy/pure computation belongs off the UI thread; the worker keeps the
 *   render loop smooth.
 * - We type the worker global through a narrow interface instead of pulling in
 *   the conflicting `webworker` lib alongside `dom`.
 */
import { createFallbackTreeScene } from '../data/fallbackTree';
import type { FallbackRequest, FallbackResponse } from './protocol';

interface WorkerScope {
  postMessage(data: FallbackResponse): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<FallbackRequest>) => void): void;
}

const ctx = self as unknown as WorkerScope;

ctx.addEventListener('message', (event) => {
  const { id, seed } = event.data;
  const scene = createFallbackTreeScene(seed);
  ctx.postMessage({ id, scene });
});
