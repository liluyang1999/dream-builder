import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useCallback, useEffect, useRef, useState } from 'react';
import { forestAudio } from '../audio/forestAudio';
import {
  PURIFICATION_SEQUENCE,
  type PurificationAttempt,
  type RuneDirection,
  applyPurificationInput,
  createPurificationAttempt,
} from '../game/purificationPuzzle';
import { useAppStore } from '../state/store';

const DIRECTION_COPY: Record<RuneDirection, { glyph: string; label: string }> = {
  north: { glyph: '↑', label: '向北' },
  east: { glyph: '→', label: '向东' },
  south: { glyph: '↓', label: '向南' },
  west: { glyph: '←', label: '向西' },
};

const PURIFICATION_BEATS = [
  { id: 'roots-rise', direction: PURIFICATION_SEQUENCE[0] },
  { id: 'stream-turns', direction: PURIFICATION_SEQUENCE[1] },
  { id: 'canopy-rises', direction: PURIFICATION_SEQUENCE[2] },
  { id: 'light-returns', direction: PURIFICATION_SEQUENCE[3] },
] as const;

export function PurificationOverlay() {
  const cleansing = useAppStore((state) => state.progress.nodeState === 'cleansing');
  const dispatchProgress = useAppStore((state) => state.dispatchGameProgress);
  const [attempt, setAttempt] = useState<PurificationAttempt>(createPurificationAttempt);
  const [feedback, setFeedback] = useState('按图示顺序回应四拍根脉。');
  const attemptRef = useRef(attempt);
  const northButtonRef = useRef<HTMLButtonElement>(null);

  const applyDirection = useCallback(
    (direction: RuneDirection) => {
      const result = applyPurificationInput(attemptRef.current, direction);
      attemptRef.current = result.attempt;
      if (result.outcome === 'completed') {
        dispatchProgress({ type: 'complete-cleansing' });
        return;
      }
      forestAudio.playCue(result.outcome === 'reset' ? 'ritual-error' : 'ritual-step');
      setAttempt(result.attempt);
      setFeedback(
        result.outcome === 'reset'
          ? '方向错了，回声散开；从第一拍重新开始，光种不会丢失。'
          : `共鸣 ${result.attempt.step}/${PURIFICATION_SEQUENCE.length}`,
      );
    },
    [dispatchProgress],
  );

  useEffect(() => {
    if (!cleansing) return;
    const initial = createPurificationAttempt();
    attemptRef.current = initial;
    setAttempt(initial);
    setFeedback('按图示顺序回应四拍根脉。');
    northButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dispatchProgress({ type: 'cancel-cleansing' });
        return;
      }
      const direction = directionFromKey(event.key);
      if (!direction) return;
      event.preventDefault();
      applyDirection(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cleansing, applyDirection, dispatchProgress]);

  if (!cleansing) return null;

  return (
    <div className="purification-overlay">
      <GlassPanel
        className="purification-overlay__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purification-title"
      >
        <div className="purification-overlay__eyebrow">遗迹净化 · 根脉共鸣</div>
        <h2 id="purification-title">让微光沿正确方向流动</h2>
        <p>依次输入下方四枚方向符文。方向错误只会重置这一轮，不会消耗已收集的光种。</p>

        <div className="purification-overlay__sequence" aria-label="净化顺序">
          {PURIFICATION_BEATS.map(({ id, direction }, index) => (
            <span
              key={id}
              className={
                index < attempt.step ? 'is-complete' : index === attempt.step ? 'is-current' : ''
              }
            >
              {DIRECTION_COPY[direction].glyph}
            </span>
          ))}
        </div>

        <div className="purification-overlay__pad" aria-label="方向输入">
          {(['north', 'west', 'south', 'east'] as const).map((direction) => (
            <GlassButton
              key={direction}
              ref={direction === 'north' ? northButtonRef : undefined}
              className={`purification-overlay__direction is-${direction}`}
              aria-label={DIRECTION_COPY[direction].label}
              onClick={() => applyDirection(direction)}
            >
              {DIRECTION_COPY[direction].glyph}
            </GlassButton>
          ))}
        </div>

        <div className="purification-overlay__feedback" role="status" aria-live="polite">
          {feedback}
        </div>
        <GlassButton onClick={() => dispatchProgress({ type: 'cancel-cleansing' })}>
          稍后再试
        </GlassButton>
      </GlassPanel>
    </div>
  );
}

function directionFromKey(key: string): RuneDirection | null {
  switch (key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      return 'north';
    case 'd':
    case 'arrowright':
      return 'east';
    case 's':
    case 'arrowdown':
      return 'south';
    case 'a':
    case 'arrowleft':
      return 'west';
    default:
      return null;
  }
}
