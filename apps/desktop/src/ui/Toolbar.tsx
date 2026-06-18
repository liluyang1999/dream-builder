interface Props {
  onResetCamera(): void;
  onScreenshot(): void;
  onExport(): void;
  onExportScene(): void;
  onToggleHelp(): void;
}

export function Toolbar({
  onResetCamera,
  onScreenshot,
  onExport,
  onExportScene,
  onToggleHelp,
}: Props) {
  return (
    <div className="hud__actions">
      <button className="hud__button" type="button" onClick={onResetCamera}>
        重置视角
      </button>
      <button className="hud__button hud__button--ghost" type="button" onClick={onScreenshot}>
        截图
      </button>
      <button className="hud__button hud__button--ghost" type="button" onClick={onExport}>
        导出 glTF
      </button>
      <button className="hud__button hud__button--ghost" type="button" onClick={onExportScene}>
        导出场景
      </button>
      <button
        className="hud__button hud__button--ghost hud__button--icon"
        type="button"
        aria-label="键盘帮助"
        onClick={onToggleHelp}
      >
        ?
      </button>
    </div>
  );
}
