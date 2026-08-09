import { GlassCard } from '@dream-builder/liquid-glass';
import { CHECKPOINT_PLACEMENTS } from '../game/forestLayout';
import { LIGHT_SEED_IDS, MEMORY_FRAGMENT_IDS } from '../game/gameProgress';
import { useAppStore } from '../state/store';

export function QuestPanel() {
  const progress = useAppStore((state) => state.progress);
  const prompt = useAppStore((state) => state.interactionPrompt);
  const checkpointLabel =
    CHECKPOINT_PLACEMENTS.find(({ id }) => id === progress.activeCheckpoint)?.label ?? '未知';

  const copy =
    progress.nodeState === 'restored'
      ? '智慧树已经苏醒，遗迹门为下一段旅程亮起。'
      : progress.nodeState === 'cleansing'
        ? '根系正在共鸣。依次回应遗迹显示的四拍方向。'
        : progress.nodeState === 'ready'
          ? '三枚光种正在共鸣。前往东侧遗迹节点完成净化。'
          : '沿林间微光寻找三枚光种，让失色的智慧树重新生长。';

  return (
    <GlassCard className="hud__quest" role="status" aria-live="polite">
      <div className="hud__quest-header">
        <strong>森林复苏</strong>
        <span>
          {progress.collectedCount}/{LIGHT_SEED_IDS.length}
        </span>
      </div>
      <div className="hud__quest-seeds" aria-label={`已收集 ${progress.collectedCount} 枚光种`}>
        {LIGHT_SEED_IDS.map((id) => (
          <span key={id} className={progress.seeds[id] === 'collected' ? 'is-collected' : ''} />
        ))}
      </div>
      <p>{copy}</p>
      <div className="hud__quest-meta">
        <span>安全点：{checkpointLabel}</span>
        <span>
          记忆：{progress.memoriesRead.length}/{MEMORY_FRAGMENT_IDS.length}
        </span>
      </div>
      {prompt ? <div className="hud__prompt">{prompt}</div> : null}
    </GlassCard>
  );
}
