import { useEffect, useState } from 'react';

const SEEN_KEY = 'dream-builder.onboarded';

export function OnboardingHint() {
  const [visible, setVisible] = useState(false);

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

  if (!visible) return null;

  return (
    <div className="onboarding" role="dialog" aria-label="欢迎">
      <h2>欢迎来到智慧树</h2>
      <p>拖拽旋转视角，滚轮缩放。把鼠标移到发光的叶簇、符文与水晶上，点击查看它们的细节。</p>
      <p>按 ? 可随时查看键盘快捷键。</p>
      <button className="hud__button" type="button" onClick={dismiss}>
        开始探索
      </button>
    </div>
  );
}
