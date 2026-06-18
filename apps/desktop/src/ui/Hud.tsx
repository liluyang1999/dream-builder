import { GlassBadge, GlassPanel } from '@dream-builder/liquid-glass';
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
  rust: 'Rust 已连接',
  fallback: '本地回退',
  loading: '加载中…',
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
      <GlassPanel interactive className="hud__panel">
        <div className="hud__header">
          <h1 className="hud__title">智慧树</h1>
          <GlassBadge className={source === 'rust' ? 'hud__badge--ok' : 'hud__badge--warn'}>
            {STATUS_TEXT[source ?? 'loading']}
          </GlassBadge>
        </div>

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
      </GlassPanel>

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </section>
  );
}
