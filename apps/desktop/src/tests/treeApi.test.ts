import { describe, expect, test } from 'vitest';
import { loadDetailInfo, loadTreeScene } from '../tauri/treeApi';

describe('treeApi browser fallback', () => {
  test('loads a validated fallback scene outside Tauri', async () => {
    const result = await loadTreeScene(19);

    expect(result.source).toBe('fallback');
    expect(result.warning).toContain('浏览器开发环境');
    expect(result.scene.seed).toBe(19);
    expect(result.scene.branches.length).toBeGreaterThan(0);
  });

  test('returns local detail info and rejects unknown ids outside Tauri', async () => {
    const result = await loadTreeScene(19);
    const knownRune = result.scene.runes[0];
    if (!knownRune) throw new Error('expected at least one rune in fallback scene');
    const detail = await loadDetailInfo(knownRune.id, result.scene);

    await expect(loadDetailInfo('missing-id', result.scene)).rejects.toThrow('未知细节');
    expect(detail.id).toBe(knownRune.id);
  });
});
