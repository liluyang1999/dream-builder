import { GlassButton } from '@dream-builder/liquid-glass';

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
      <GlassButton variant="primary" onClick={onResetCamera}>
        重置视角
      </GlassButton>
      <GlassButton onClick={onScreenshot}>截图</GlassButton>
      <GlassButton onClick={onExport}>导出 glTF</GlassButton>
      <GlassButton onClick={onExportScene}>导出场景</GlassButton>
      <GlassButton aria-label="键盘帮助" onClick={onToggleHelp}>
        ?
      </GlassButton>
    </div>
  );
}
