import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useRef, useSyncExternalStore } from 'react';
import { useModalFocus } from '../interaction/useModalFocus';
import { isTauriRuntime } from '../ipc/runtime';
import {
  type PerformanceCaptureSnapshot,
  performanceCapture,
} from '../performance/performanceCapture';
import type { PerformancePhaseReport, PerformanceReport } from '../performance/performanceMetrics';
import { useAppStore } from '../state/store';

const STATUS_LABELS = {
  idle: '尚未记录',
  recording: '记录中',
  complete: '报告已生成',
} as const;

export function PerformancePanel({ open, onClose }: { open: boolean; onClose(): void }) {
  const snapshot = useSyncExternalStore(
    performanceCapture.subscribe,
    performanceCapture.getSnapshot,
    performanceCapture.getSnapshot,
  );
  const seed = useAppStore((state) => state.seed);
  const source = useAppStore((state) => state.source);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  useModalFocus({
    open,
    dialogRef,
    initialFocusRef: primaryActionRef,
    onEscape: onClose,
  });

  if (!open) return null;

  const report = snapshot.report;
  const sceneLoad = report ? findSlowestPhase(report, 'scene-load') : null;
  const cleansing = report ? findSlowestPhase(report, 'cleansing') : null;

  const start = () => {
    performanceCapture.start({
      runtime: isTauriRuntime() ? 'tauri' : 'browser',
      seed,
      reducedMotion,
      source: source ?? 'unknown',
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      userAgent: navigator.userAgent,
    });
  };

  return (
    <GlassPanel
      ref={dialogRef}
      className="performance-panel"
      role="dialog"
      aria-modal="true"
      aria-label="性能记录"
    >
      <div className="performance-panel__header">
        <div>
          <span>本地诊断工具</span>
          <strong>10 分钟性能记录</strong>
        </div>
        <span className={`performance-panel__status is-${snapshot.status}`} aria-live="polite">
          {STATUS_LABELS[snapshot.status]}
        </span>
      </div>

      <p className="performance-panel__intro">
        仅保存固定大小的帧时间汇总、渲染峰值与有限状态标记；不记录玩家路径或逐帧轨迹。
      </p>

      <CaptureProgress snapshot={snapshot} />
      {report ? (
        <ReportSummary report={report} sceneLoad={sceneLoad} cleansing={cleansing} />
      ) : null}

      <p className="performance-panel__note">
        记录中请完整游玩并触发一次净化。若要测量加载峰值，请在开始后重新生成一次世界。GPU
        帧时间无法由当前 WebGL 探针取得。
      </p>

      <div className="performance-panel__actions">
        {snapshot.status === 'recording' ? (
          <GlassButton
            ref={primaryActionRef}
            variant="primary"
            onClick={() => performanceCapture.stop()}
          >
            停止并生成报告
          </GlassButton>
        ) : (
          <GlassButton ref={primaryActionRef} variant="primary" onClick={start}>
            {snapshot.status === 'complete' ? '重新记录' : '开始 10 分钟记录'}
          </GlassButton>
        )}
        {snapshot.status === 'complete' && report ? (
          <GlassButton onClick={() => downloadReport(report)}>导出 JSON</GlassButton>
        ) : null}
        {snapshot.status === 'complete' ? (
          <GlassButton onClick={() => performanceCapture.clear()}>清除报告</GlassButton>
        ) : null}
        <GlassButton onClick={onClose}>关闭</GlassButton>
      </div>
    </GlassPanel>
  );
}

function CaptureProgress({ snapshot }: { snapshot: PerformanceCaptureSnapshot }) {
  const percent = Math.min(100, (snapshot.elapsedMs / snapshot.targetDurationMs) * 100);
  return (
    <div className="performance-panel__progress">
      <div>
        <span>{formatDuration(snapshot.elapsedMs)}</span>
        <span>{formatDuration(snapshot.targetDurationMs)}</span>
      </div>
      <progress value={percent} max={100} aria-label="性能记录进度" />
    </div>
  );
}

function ReportSummary({
  report,
  sceneLoad,
  cleansing,
}: {
  report: PerformanceReport;
  sceneLoad: PerformancePhaseReport | null;
  cleansing: PerformancePhaseReport | null;
}) {
  return (
    <div className="performance-panel__summary">
      <Metric label="平均 FPS" value={formatMetric(report.session.averageFps)} />
      <Metric label="1% Low" value={`${formatMetric(report.session.onePercentLowFps)} FPS`} />
      <Metric label="P95 帧时" value={`${formatMetric(report.session.p95FrameTimeMs)} ms`} />
      <Metric label="最长帧" value={`${formatMetric(report.session.maxFrameTimeMs)} ms`} />
      <Metric label="Draw Calls 峰值" value={String(report.renderPeaks.drawCalls)} />
      <Metric label="三角形峰值" value={report.renderPeaks.triangles.toLocaleString()} />
      <Metric
        label="JS 堆峰值"
        value={
          report.renderPeaks.jsHeapBytes === null
            ? '不可用'
            : formatBytes(report.renderPeaks.jsHeapBytes)
        }
      />
      <Metric
        label="首个场景帧"
        value={
          report.context.timeToFirstFrameMs === null
            ? '不可用'
            : `${formatMetric(report.context.timeToFirstFrameMs)} ms`
        }
      />
      <Metric
        label="加载峰值"
        value={
          sceneLoad
            ? sceneLoad.frameCount > 0
              ? `${formatMetric(sceneLoad.maxFrameTimeMs)} ms`
              : '无帧样本'
            : '未触发'
        }
      />
      <Metric
        label="净化峰值"
        value={cleansing ? `${formatMetric(cleansing.maxFrameTimeMs)} ms` : '未触发'}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="performance-panel__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function findSlowestPhase(report: PerformanceReport, name: string): PerformancePhaseReport | null {
  return report.phases
    .filter((phase) => phase.name === name)
    .reduce<PerformancePhaseReport | null>(
      (slowest, phase) =>
        !slowest || phase.maxFrameTimeMs > slowest.maxFrameTimeMs ? phase : slowest,
      null,
    );
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatMetric(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}

function formatBytes(value: number): string {
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function downloadReport(report: PerformanceReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dream-builder-performance-${report.startedAt.replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
