import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useRef } from 'react';
import { MEMORY_FRAGMENT_PLACEMENT } from '../game/forestLayout';
import { useModalFocus } from '../interaction/useModalFocus';
import { useAppStore } from '../state/store';

export function MemoryOverlay() {
  const activeMemoryId = useAppStore((state) => state.activeMemoryId);
  const closeMemory = useAppStore((state) => state.closeMemory);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = activeMemoryId === MEMORY_FRAGMENT_PLACEMENT.id;

  useModalFocus({
    open,
    dialogRef,
    initialFocusRef: closeButtonRef,
    onEscape: closeMemory,
  });

  if (!open) return null;

  return (
    <div className="memory-overlay">
      <GlassPanel
        ref={dialogRef}
        className="memory-overlay__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-title"
      >
        <div className="memory-overlay__eyebrow">森林记忆 · 1 / 1</div>
        <h2 id="memory-title">{MEMORY_FRAGMENT_PLACEMENT.title}</h2>
        {MEMORY_FRAGMENT_PLACEMENT.passages.map((passage) => (
          <p key={passage}>{passage}</p>
        ))}
        <div className="memory-overlay__saved">记忆已写入当前存档</div>
        <GlassButton ref={closeButtonRef} variant="primary" onClick={closeMemory}>
          回到森林
        </GlassButton>
      </GlassPanel>
    </div>
  );
}
