/**
 * Typed message protocol shared between the main thread and the fallback Worker.
 * Each request carries an `id` the response echoes back, so concurrent requests
 * can be matched to their resolvers.
 */
import type { TreeScene } from '@dream-builder/ipc-contracts';

export interface FallbackRequest {
  id: number;
  seed: number;
}

export interface FallbackResponse {
  id: number;
  scene: TreeScene;
}
