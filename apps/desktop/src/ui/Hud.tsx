import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import { DetailsPanel } from './DetailsPanel';
import { HelpOverlay } from './HelpOverlay';
import { PerformancePanel } from './PerformancePanel';
import { QuestPanel } from './QuestPanel';
import { SeedForm } from './SeedForm';
import { Toolbar } from './Toolbar';

interface Props {
  onResetCamera(): void;
  onScreenshot(): void;
  onExport(): void;
  onExportScene(): void;
  onOpenMenu(): void;
  onRestartChapter(): void;
}

const STATUS_TEXT = {
  rust: '原生世界',
  fallback: '浏览器预览',
  loading: '世界加载中',
} as const;

export function Hud({
  onResetCamera,
  onScreenshot,
  onExport,
  onExportScene,
  onOpenMenu,
  onRestartChapter,
}: Props) {
  const [performanceOpen, setPerformanceOpen] = useState(false);
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

  useEffect(() => {
    if (helpOpen && performanceOpen) setPerformanceOpen(false);
  }, [helpOpen, performanceOpen]);

  return (
    <section className="hud">
      <GlassPanel interactive className="hud__panel">
        <div className="hud__header">
          <div>
            <span className="hud__eyebrow">第一章 · 微光归途</span>
            <h1 className="hud__title">智慧树之森</h1>
          </div>
        </div>

        <div className="hud__line">
          {hoverLabel ? `正在聆听：${hoverLabel}` : '沿微光探索；靠近目标时按 E 与森林共鸣。'}
        </div>

        <QuestPanel />
        <DetailsPanel detail={selectedDetail} />

        {warning ? <div className="hud__error">{warning}</div> : null}

        <Toolbar
          onResetCamera={onResetCamera}
          onScreenshot={onScreenshot}
          onOpenMenu={onOpenMenu}
          onToggleHelp={toggleHelp}
        />
        <details className="hud__creator-tools">
          <summary>森林工坊</summary>
          <div className="hud__creator-content">
            <div className="hud__runtime">运行方式：{STATUS_TEXT[source ?? 'loading']}</div>
            <SeedForm seed={seed} onRegenerate={setSeed} />
            <div className="hud__actions">
              <GlassButton onClick={onExport}>导出 3D 模型</GlassButton>
              <GlassButton onClick={onExportScene}>导出世界数据</GlassButton>
            </div>
          </div>
        </details>
      </GlassPanel>

      <HelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onOpenPerformance={() => {
          setHelpOpen(false);
          setPerformanceOpen(true);
        }}
        onRestartChapter={onRestartChapter}
      />
      <PerformancePanel open={performanceOpen} onClose={() => setPerformanceOpen(false)} />
    </section>
  );
}
