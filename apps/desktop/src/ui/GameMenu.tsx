import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useEffect, useRef, useState } from 'react';
import { INITIAL_GAME_PROGRESS } from '../game/gameProgress';
import { useModalFocus } from '../interaction/useModalFocus';
import { useAppStore } from '../state/store';

interface Props {
  onNewGame(): void;
  onOpenHelp(): void;
  onQuit(): void;
}

export function GameMenu({ onNewGame, onOpenHelp, onQuit }: Props) {
  const sessionMode = useAppStore((state) => state.sessionMode);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const creditsOpen = useAppStore((state) => state.creditsOpen);
  const helpOpen = useAppStore((state) => state.helpOpen);
  const progress = useAppStore((state) => state.progress);
  const startGame = useAppStore((state) => state.startGame);
  const resumeGame = useAppStore((state) => state.resumeGame);
  const returnToTitle = useAppStore((state) => state.returnToTitle);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const setCreditsOpen = useAppStore((state) => state.setCreditsOpen);
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const confirmNewGameRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const hasProgress = !sameProgress(progress, INITIAL_GAME_PROGRESS);
  const visible = sessionMode !== 'playing' && !settingsOpen && !creditsOpen && !helpOpen;
  const paused = sessionMode === 'paused';

  useModalFocus({
    open: visible,
    dialogRef,
    initialFocusRef: primaryRef,
    onEscape: () => {
      if (confirmingNewGame) setConfirmingNewGame(false);
      else if (paused) resumeGame();
    },
  });

  useEffect(() => {
    if (!visible) {
      setConfirmingNewGame(false);
      return;
    }
    (confirmingNewGame ? confirmNewGameRef : primaryRef).current?.focus();
  }, [visible, confirmingNewGame]);

  if (!visible) return null;

  if (confirmingNewGame) {
    return (
      <div className="game-menu">
        <GlassPanel
          ref={dialogRef}
          className="game-menu__panel game-menu__panel--confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="new-game-title"
          aria-describedby="new-game-description"
        >
          <span className="game-menu__eyebrow">新旅程</span>
          <h2 id="new-game-title">重新唤醒这片森林？</h2>
          <p id="new-game-description">当前章节进度会被替换。画面、音频与操作设置会保留。</p>
          <div className="game-menu__actions">
            <GlassButton
              ref={confirmNewGameRef}
              variant="primary"
              onClick={() => {
                setConfirmingNewGame(false);
                onNewGame();
              }}
            >
              确认开始新旅程
            </GlassButton>
            <GlassButton onClick={() => setConfirmingNewGame(false)}>取消</GlassButton>
          </div>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="game-menu">
      <GlassPanel
        ref={dialogRef}
        className="game-menu__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-menu-title"
      >
        <div className="game-menu__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="game-menu__eyebrow">{paused ? '旅程暂停' : 'Dream Builder'}</span>
        <h1 id="game-menu-title">{paused ? '聆听森林的呼吸' : '智慧树之森'}</h1>
        <p className="game-menu__lead">
          {paused
            ? '你的进度已经自动保存。准备好后，从最近的脚步继续。'
            : '成为能听见森林记忆的小小守林人，让失色的智慧树重新发光。'}
        </p>

        <div className="game-menu__actions">
          {paused ? (
            <GlassButton ref={primaryRef} variant="primary" onClick={resumeGame}>
              继续旅程
            </GlassButton>
          ) : (
            <GlassButton ref={primaryRef} variant="primary" onClick={startGame}>
              {hasProgress ? '继续旅程' : '进入森林'}
            </GlassButton>
          )}

          {!paused && hasProgress ? (
            <GlassButton onClick={() => setConfirmingNewGame(true)}>开始新旅程</GlassButton>
          ) : null}
          <GlassButton onClick={() => setSettingsOpen(true)}>设置</GlassButton>
          {paused ? <GlassButton onClick={onOpenHelp}>操作帮助</GlassButton> : null}
          {!paused ? (
            <GlassButton onClick={() => setCreditsOpen(true)}>制作信息</GlassButton>
          ) : null}
          {paused ? <GlassButton onClick={returnToTitle}>返回标题</GlassButton> : null}
          <GlassButton onClick={onQuit}>退出游戏</GlassButton>
        </div>

        <small className="game-menu__footer">
          {paused ? '按 Esc 也可继续' : '单人 · 离线 · 自动保存'}
        </small>
      </GlassPanel>
    </div>
  );
}

function sameProgress(
  left: typeof INITIAL_GAME_PROGRESS,
  right: typeof INITIAL_GAME_PROGRESS,
): boolean {
  return (
    left.collectedCount === right.collectedCount &&
    left.nodeState === right.nodeState &&
    left.activeCheckpoint === right.activeCheckpoint &&
    left.memoriesRead.length === right.memoriesRead.length
  );
}
