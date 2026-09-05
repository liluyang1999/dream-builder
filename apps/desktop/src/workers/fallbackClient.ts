/**
 * Main-thread client for the fallback Worker.
 *
 * A failed or stalled Worker is retired for this session. Its bounded pending
 * requests recover with the same small deterministic generator on the UI thread.
 */
import { type TreeScene, treeSceneSchema } from '@dream-builder/ipc-contracts';
import { createFallbackTreeScene } from '../data/fallbackTree';
import type { FallbackRequest } from './protocol';

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_PENDING_REQUESTS = 16;
let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<
  number,
  { seed: number; resolve(scene: TreeScene): void; timer: ReturnType<typeof setTimeout> }
>();

function retireWorker(): void {
  workerFailed = true;
  worker?.terminate();
  worker = null;
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.resolve(createFallbackTreeScene(request.seed));
  }
  pending.clear();
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./fallback.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'number') {
        retireWorker();
        return;
      }
      const request = pending.get(data.id);
      if (!request) return;
      const parsed = treeSceneSchema.safeParse('scene' in data ? data.scene : undefined);
      if (!parsed.success || parsed.data.seed !== request.seed) {
        retireWorker();
        return;
      }
      pending.delete(data.id);
      clearTimeout(request.timer);
      request.resolve(parsed.data);
    });
    worker.addEventListener('error', (event) => {
      event.preventDefault();
      retireWorker();
    });
    worker.addEventListener('messageerror', retireWorker);
  }
  return worker;
}

/** Generate a fallback scene, off-thread when possible. */
export function createFallbackScene(seed: number): Promise<TreeScene> {
  if (typeof Worker === 'undefined' || workerFailed || pending.size >= MAX_PENDING_REQUESTS) {
    return Promise.resolve(createFallbackTreeScene(seed));
  }
  const id = nextId++;
  return new Promise<TreeScene>((resolve) => {
    pending.set(id, { seed, resolve, timer: setTimeout(retireWorker, REQUEST_TIMEOUT_MS) });
    try {
      getWorker().postMessage({ id, seed } satisfies FallbackRequest);
    } catch {
      retireWorker();
    }
  });
}
