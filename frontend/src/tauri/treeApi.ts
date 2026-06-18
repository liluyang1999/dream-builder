import { invoke } from '@tauri-apps/api/core';
import { createFallbackTreeScene } from '../data/fallbackTree';
import { validateTreeScene } from '../data/validateTreeScene';
import type { DetailInfo, MagicField, TreeScene } from '../types/tree';

export interface SceneLoadResult {
  scene: TreeScene;
  source: 'rust' | 'fallback';
  warning: string | null;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export async function loadTreeScene(seed: number): Promise<SceneLoadResult> {
  if (!isTauriRuntime()) {
    return {
      scene: createFallbackTreeScene(seed),
      source: 'fallback',
      warning: '当前在浏览器开发环境中运行，使用本地回退树数据。',
    };
  }

  try {
    const scene = await invoke<TreeScene>('generate_tree', { seed });
    const validation = validateTreeScene(scene);
    if (!validation.ok) {
      return {
        scene: createFallbackTreeScene(seed),
        source: 'fallback',
        warning: `Rust 返回的数据未通过校验：${validation.reason}`,
      };
    }

    return { scene, source: 'rust', warning: null };
  } catch (error) {
    return {
      scene: createFallbackTreeScene(seed),
      source: 'fallback',
      warning: `无法调用 Rust 后端：${errorMessage(error)}`,
    };
  }
}

export async function loadDetailInfo(id: string, scene: TreeScene): Promise<DetailInfo> {
  if (isTauriRuntime()) {
    return invoke<DetailInfo>('detail_info', { seed: scene.seed, id });
  }

  const detail = scene.details.find((item) => item.id === id);
  if (!detail) {
    throw new Error(`未知细节：${id}`);
  }
  return detail;
}

export async function loadMagicField(seed: number, tick: number): Promise<MagicField | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    return await invoke<MagicField>('magic_field', { seed, tick });
  } catch {
    return null;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
