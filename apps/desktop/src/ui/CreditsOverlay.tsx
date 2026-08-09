import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useEffect, useRef, useState } from 'react';
import { isTauriRuntime } from '../ipc/runtime';
import { useAppStore } from '../state/store';
import { APP_CHANNEL, APP_VERSION } from '../version';

export function CreditsOverlay() {
  const open = useAppStore((state) => state.creditsOpen);
  const setOpen = useAppStore((state) => state.setCreditsOpen);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  const openDiagnostics = async () => {
    if (!isTauriRuntime()) {
      setDiagnosticsStatus('浏览器预览没有原生日志目录。');
      return;
    }
    try {
      const [{ appLogDir }, { openPath }] = await Promise.all([
        import('@tauri-apps/api/path'),
        import('@tauri-apps/plugin-opener'),
      ]);
      await openPath(await appLogDir());
      setDiagnosticsStatus('已打开诊断日志目录。');
    } catch {
      setDiagnosticsStatus('无法打开日志目录，请从 Windows 应用日志继续诊断。');
    }
  };

  return (
    <div className="credits-overlay">
      <GlassPanel
        className="credits-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-title"
      >
        <span className="game-menu__eyebrow">Dream Builder</span>
        <h2 id="credits-title">智慧树之森</h2>
        <p>
          一段关于聆听、寻找与复苏的离线卡通森林旅程。程序化智慧树由相同种子稳定重建，
          游玩数据只保存在本机。
        </p>
        <dl className="credits-overlay__facts">
          <div>
            <dt>版本</dt>
            <dd>
              {APP_VERSION} · {APP_CHANNEL}
            </dd>
          </div>
          <div>
            <dt>技术</dt>
            <dd>Tauri · Rust · React · Three.js</dd>
          </div>
          <div>
            <dt>隐私</dt>
            <dd>无需账号，不连接游戏服务器</dd>
          </div>
        </dl>
        <p className="credits-overlay__thanks">感谢每一位走进森林、帮助它变得更温暖的守林人。</p>
        {diagnosticsStatus ? <p role="status">{diagnosticsStatus}</p> : null}
        <div className="game-menu__actions">
          <GlassButton onClick={() => void openDiagnostics()}>打开诊断日志</GlassButton>
          <GlassButton ref={closeButtonRef} variant="primary" onClick={() => setOpen(false)}>
            返回
          </GlassButton>
        </div>
      </GlassPanel>
    </div>
  );
}
