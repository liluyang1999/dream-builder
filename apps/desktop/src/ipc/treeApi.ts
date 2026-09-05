/**
 * The IPC client: the one place that talks to the Rust backend.
 *
 * Teaching points:
 * - A class whose methods are decorated with `@measure`/`@logged` — a real use
 *   of standard decorators for cross-cutting concerns.
 * - Every payload crossing the boundary is validated with a zod schema
 *   (`parseWith`); only validated data flows into the typed core.
 * - Graceful fallback: without Tauri (plain browser) we synthesize a scene with
 *   the Worker-backed generator.
 */
import {
  type DetailInfo,
  type MagicField,
  type Settings,
  type TreeScene,
  detailInfoSchema,
  magicFieldSchema,
  parseWith,
  settingsSchema,
  treeSceneSchema,
} from '@dream-builder/ipc-contracts';
import { invoke } from '@tauri-apps/api/core';
import { type UnlistenFn, listen } from '@tauri-apps/api/event';
import { createFallbackScene } from '../workers/fallbackClient';
import { errorMessage } from './errorMessage';
import { logged, measure } from './instrument';
import { isTauriRuntime } from './runtime';

export type SceneSource = 'rust' | 'fallback';

export interface SceneLoadResult {
  scene: TreeScene;
  source: SceneSource;
  warning: string | null;
}

/** Event emitted by the Rust backend with each magic-field tick. */
export const MAGIC_FIELD_EVENT = 'magic-field';

class TreeApiClient {
  private settingsWrite: Promise<void> = Promise.resolve();
  @measure
  @logged
  async loadScene(seed: number): Promise<SceneLoadResult> {
    if (!isTauriRuntime()) {
      return {
        scene: await createFallbackScene(seed),
        source: 'fallback',
        warning: '当前在浏览器开发环境中运行，使用本地回退树数据。',
      };
    }
    try {
      const raw = await invoke('generate_tree', { seed });
      const parsed = parseWith(treeSceneSchema, raw);
      if (!parsed.ok) {
        return {
          scene: await createFallbackScene(seed),
          source: 'fallback',
          warning: `Rust 返回的数据未通过校验：${parsed.reason}`,
        };
      }
      return { scene: parsed.value, source: 'rust', warning: null };
    } catch (error) {
      return {
        scene: await createFallbackScene(seed),
        source: 'fallback',
        warning: `无法调用 Rust 后端：${errorMessage(error)}`,
      };
    }
  }

  @logged
  async loadDetail(
    id: string,
    scene: TreeScene,
    source: SceneSource = 'rust',
  ): Promise<DetailInfo> {
    if (source === 'rust' && isTauriRuntime()) {
      const raw = await invoke('detail_info', { seed: scene.seed, id });
      const parsed = parseWith(detailInfoSchema, raw);
      if (!parsed.ok) {
        throw new Error(`细节数据无效：${parsed.reason}`);
      }
      if (parsed.value.id !== id) throw new Error('细节数据与当前选择不一致。');
      return parsed.value;
    }
    const detail = scene.details.find((item) => item.id === id);
    if (!detail) {
      throw new Error(`未知细节：${id}`);
    }
    return detail;
  }

  async getSettings(): Promise<Settings | null> {
    if (!isTauriRuntime()) return null;
    try {
      const parsed = parseWith(settingsSchema, await invoke('get_settings'));
      return parsed.ok ? parsed.value : null;
    } catch {
      return null;
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    if (!isTauriRuntime()) return;
    const write = this.settingsWrite
      .catch(() => {})
      .then(async () => {
        await invoke('save_settings', { settings });
      });
    this.settingsWrite = write;
    await write;
  }

  async exportScene(path: string, seed: number): Promise<void> {
    await invoke('export_scene', { path, seed });
  }

  /** Subscribe to backend magic-field pushes. Returns an unsubscribe fn. */
  async listenMagicField(handler: (field: MagicField) => void): Promise<UnlistenFn> {
    if (!isTauriRuntime()) return () => {};
    return listen<unknown>(MAGIC_FIELD_EVENT, (event) => {
      const parsed = parseWith(magicFieldSchema, event.payload);
      if (parsed.ok) handler(parsed.value);
    });
  }

  /** Subscribe to a `menu:<id>` event forwarded from the native menu/tray. */
  async listenMenu(id: string, handler: () => void): Promise<UnlistenFn> {
    if (!isTauriRuntime()) return () => {};
    return listen(`menu:${id}`, () => handler());
  }
}

export const treeApi = new TreeApiClient();
