/**
 * Main-thread client for the fallback Worker.
 *
 * Falls back to synchronous generation when `Worker` is unavailable (unit tests
 * under jsdom, or any non-DOM context), so callers get a uniform Promise API.
 */
import type { TreeScene } from '@dream-builder/ipc-contracts';
import { createFallbackTreeScene } from '../data/fallbackTree';
import type { FallbackRequest, FallbackResponse } from './protocol';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (scene: TreeScene) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./fallback.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<FallbackResponse>) => {
      const { id, scene } = event.data;
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve(scene);
      }
    });
  }
  return worker;
}

/** Generate a fallback scene, off-thread when possible. */
export function createFallbackScene(seed: number): Promise<TreeScene> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(createFallbackTreeScene(seed));
  }
  const id = nextId++;
  return new Promise<TreeScene>((resolve) => {
    pending.set(id, resolve);
    getWorker().postMessage({ id, seed } satisfies FallbackRequest);
  });
}
