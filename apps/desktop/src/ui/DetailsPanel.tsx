import type { DetailInfo } from '@dream-builder/ipc-contracts';
import type { CSSProperties } from 'react';

export function DetailsPanel({ detail }: { detail: DetailInfo | null }) {
  if (!detail) {
    return (
      <article className="hud__detail">
        <h2>未选择细节</h2>
        <p>点击发光的叶簇、符文或水晶，这里会显示后端返回的信息。</p>
      </article>
    );
  }

  const percent = Math.round(detail.energy * 100);
  const meterStyle = { '--energy': `${percent}%` } as CSSProperties;

  return (
    <article className="hud__detail">
      <h2>{detail.title}</h2>
      <p>{detail.description}</p>
      <div className="hud__meter">
        <span style={meterStyle} />
      </div>
      <div className="hud__energy-label">能量 {percent}%</div>
    </article>
  );
}
