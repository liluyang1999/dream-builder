import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../state/store';

export function ChapterCompleteOverlay({ onScreenshot }: { onScreenshot(): void }) {
  const open = useAppStore((state) => state.chapterCompleteOpen);
  const memoriesRead = useAppStore((state) => state.progress.memoriesRead.length);
  const dismiss = useAppStore((state) => state.dismissChapterComplete);
  const returnToTitle = useAppStore((state) => state.returnToTitle);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    continueButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div className="chapter-complete">
      <GlassPanel
        className="chapter-complete__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chapter-complete-title"
      >
        <div className="chapter-complete__halo" aria-hidden="true">
          ✦
        </div>
        <span className="game-menu__eyebrow">第一章 · 完成</span>
        <h2 id="chapter-complete-title">森林重新记起了光</h2>
        <p>智慧树的根脉再次流动，遗迹门已经亮起。你可以留在这里漫游、寻找取景角度，或回到标题。</p>
        <div className="chapter-complete__summary">
          <span>3 / 3 光种</span>
          <span>{memoriesRead > 0 ? '记忆已聆听' : '仍有记忆可寻找'}</span>
          <span>5 处安全点</span>
        </div>
        <div className="chapter-complete__actions">
          <GlassButton ref={continueButtonRef} variant="primary" onClick={dismiss}>
            继续漫游
          </GlassButton>
          <GlassButton onClick={onScreenshot}>保存这一刻</GlassButton>
          <GlassButton
            onClick={() => {
              dismiss();
              returnToTitle();
            }}
          >
            返回标题
          </GlassButton>
        </div>
        <small>章节进度已经自动保存</small>
      </GlassPanel>
    </div>
  );
}
