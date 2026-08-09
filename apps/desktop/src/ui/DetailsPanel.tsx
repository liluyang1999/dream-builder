import type { DetailInfo } from '@dream-builder/ipc-contracts';
import { GlassCard } from '@dream-builder/liquid-glass';
import type { CSSProperties } from 'react';

export function DetailsPanel({ detail }: { detail: DetailInfo | null }) {
  if (!detail) return null;

  const percent = Math.round(detail.energy * 100);
  const meterStyle = { '--energy': `${percent}%` } as CSSProperties;

  return (
    <GlassCard className="hud__detail">
      <h2>{detail.title}</h2>
      <p>{detail.description}</p>
      <div className="hud__meter">
        <span style={meterStyle} />
      </div>
      <div className="hud__energy-label">能量 {percent}%</div>
    </GlassCard>
  );
}
