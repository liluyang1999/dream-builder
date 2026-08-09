import { GlassButton } from '@dream-builder/liquid-glass';

interface Props {
  onResetCamera(): void;
  onScreenshot(): void;
  onOpenMenu(): void;
  onToggleHelp(): void;
}

export function Toolbar({ onResetCamera, onScreenshot, onOpenMenu, onToggleHelp }: Props) {
  return (
    <div className="hud__actions">
      <GlassButton variant="primary" onClick={onResetCamera}>
        回到安全点
      </GlassButton>
      <GlassButton onClick={onScreenshot}>留影</GlassButton>
      <GlassButton onClick={onOpenMenu}>菜单</GlassButton>
      <GlassButton aria-label="键盘帮助" onClick={onToggleHelp}>
        ?
      </GlassButton>
    </div>
  );
}
