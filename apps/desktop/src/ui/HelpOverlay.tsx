import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';

const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['R', '重置视角'],
  ['H', '隐藏 / 显示面板'],
  ['F', '全屏'],
  ['S', '截图保存 PNG'],
  ['G', '随机重新生成'],
  ['Esc', '取消选中'],
  ['?', '显示 / 关闭本帮助'],
];

export function HelpOverlay({ open, onClose }: { open: boolean; onClose(): void }) {
  if (!open) return null;
  return (
    <GlassPanel className="hud__help" role="dialog" aria-label="键盘快捷键">
      <strong>键盘快捷键</strong>
      <ul>
        {SHORTCUTS.map(([key, label]) => (
          <li key={key}>
            <kbd>{key}</kbd> {label}
          </li>
        ))}
      </ul>
      <GlassButton onClick={onClose}>关闭</GlassButton>
    </GlassPanel>
  );
}
