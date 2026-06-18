import { useAppStore } from '../state/store';
import { DetailsPanel } from './DetailsPanel';
import { HelpOverlay } from './HelpOverlay';
import { SeedForm } from './SeedForm';
import { Toolbar } from './Toolbar';

interface Props {
  onResetCamera(): void;
  onScreenshot(): void;
  onExport(): void;
  onExportScene(): void;
}

const STATUS_TEXT = {
  rust: 'Rust 后端已连接，场景数据已加载。',
  fallback: '使用本地回退数据运行。',
  loading: '正在唤醒古树...',
} as const;

export function Hud({ onResetCamera, onScreenshot, onExport, onExportScene }: Props) {
  const seed = useAppStore((state) => state.seed);
  const source = useAppStore((state) => state.source);
  const warning = useAppStore((state) => state.warning);
  const selectedDetail = useAppStore((state) => state.selectedDetail);
  const helpOpen = useAppStore((state) => state.helpOpen);
  const setSeed = useAppStore((state) => state.setSeed);
  const toggleHelp = useAppStore((state) => state.toggleHelp);
  const setHelpOpen = useAppStore((state) => state.setHelpOpen);
  const hoverLabel = useAppStore((state) => {
    const id = state.selection.hoveredId;
    if (!id || !state.scene) return null;
    return state.scene.details.find((detail) => detail.id === id)?.title ?? id;
  });

  return (
    <section className="hud">
      <h1 className="hud__title">Dream Builder · 智慧树</h1>
      <div className="hud__status">{STATUS_TEXT[source ?? 'loading']}</div>
      <div className="hud__line">
        {hoverLabel ? `当前悬停：${hoverLabel}` : '移动鼠标探索符文、水晶与叶簇。'}
      </div>

      <DetailsPanel detail={selectedDetail} />

      {warning ? <div className="hud__error">{warning}</div> : null}

      <SeedForm seed={seed} onRegenerate={setSeed} />
      <Toolbar
        onResetCamera={onResetCamera}
        onScreenshot={onScreenshot}
        onExport={onExport}
        onExportScene={onExportScene}
        onToggleHelp={toggleHelp}
      />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </section>
  );
}
