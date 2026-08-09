import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useEffect, useRef, useState } from 'react';
import { useModalFocus } from '../interaction/useModalFocus';

const SEEN_KEY = 'dream-builder.onboarded.v2';

export function resetOnboardingHint(): void {
  try {
    globalThis.localStorage?.removeItem(SEEN_KEY);
  } catch {
    // Storage may be unavailable; the chapter reset itself still succeeds.
  }
}

export function OnboardingHint() {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      if (!globalThis.localStorage?.getItem(SEEN_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable — skip onboarding.
    }
  }, []);

  function dismiss(): void {
    setVisible(false);
    try {
      globalThis.localStorage?.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
  }

  useModalFocus({
    open: visible,
    dialogRef,
    initialFocusRef: startButtonRef,
  });

  if (!visible) return null;

  return (
    <div className="onboarding">
      <GlassPanel
        ref={dialogRef}
        className="onboarding__card"
        role="dialog"
        aria-modal="true"
        aria-label="欢迎"
      >
        <h2>欢迎来到智慧树之森</h2>
        <p>
          用 WASD、方向键或手柄左摇杆移动守林人，按住 Shift 或手柄 B / 扳机奔跑；拖拽旋转镜头，
          滚轮调整距离。
        </p>
        <p>靠近林间光种、覆苔回声或遗迹节点并按 E 或手柄 A 互动；发亮的地面符文会记录安全点。</p>
        <p>按 ? 可随时查看完整操作。</p>
        <GlassButton ref={startButtonRef} variant="primary" onClick={dismiss}>
          开始探索
        </GlassButton>
      </GlassPanel>
    </div>
  );
}
