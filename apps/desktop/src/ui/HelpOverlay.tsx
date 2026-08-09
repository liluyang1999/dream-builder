import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useEffect, useState } from 'react';

const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['WASD', '移动守林人'],
  ['Shift', '奔跑'],
  ['E', '收集光种 / 聆听记忆 / 激活节点'],
  ['拖拽', '环绕角色旋转镜头'],
  ['滚轮', '拉近 / 拉远镜头'],
  ['R', '返回安全点并重置镜头'],
  ['H', '隐藏 / 显示面板'],
  ['F', '全屏'],
  ['P', '截图保存 PNG'],
  ['G', '随机重新生成'],
  ['Esc', '取消选中'],
  ['?', '显示 / 关闭本帮助'],
  ['左摇杆', '手柄移动；B / 扳机奔跑'],
  ['A', '手柄互动 / 确认'],
  ['Menu', '暂停 / 继续'],
];

export function HelpOverlay({
  open,
  onClose,
  onOpenPerformance,
  onRestartChapter,
}: {
  open: boolean;
  onClose(): void;
  onOpenPerformance(): void;
  onRestartChapter(): void;
}) {
  const [confirmingRestart, setConfirmingRestart] = useState(false);

  useEffect(() => {
    if (!open) setConfirmingRestart(false);
  }, [open]);

  if (!open) return null;

  const close = () => {
    setConfirmingRestart(false);
    onClose();
  };

  const restart = () => {
    onRestartChapter();
    close();
  };

  return (
    <GlassPanel className="hud__help" role="dialog" aria-modal="true" aria-label="键盘与手柄操作">
      <strong>探索操作</strong>
      <ul>
        {SHORTCUTS.map(([key, label]) => (
          <li key={key}>
            <kbd>{key}</kbd> {label}
          </li>
        ))}
      </ul>
      {confirmingRestart ? (
        <div className="hud__restart" role="alert">
          <p>这会清除本章进度、检查点和已读记忆，并重新显示入门提示；画面与辅助设置不会改变。</p>
          <div className="hud__restart-actions">
            <GlassButton variant="primary" onClick={restart}>
              确认重开
            </GlassButton>
            <GlassButton onClick={() => setConfirmingRestart(false)}>取消</GlassButton>
          </div>
        </div>
      ) : (
        <GlassButton onClick={() => setConfirmingRestart(true)}>重新开始本章</GlassButton>
      )}
      <GlassButton onClick={onOpenPerformance}>性能记录</GlassButton>
      <GlassButton onClick={close}>关闭</GlassButton>
    </GlassPanel>
  );
}
