import { GlassButton, GlassPanel } from '@dream-builder/liquid-glass';
import { useAppStore } from '../state/store';

const RECOVERY_COPY = {
  migrated: {
    title: '存档已升级',
    body: '旧版旅程已安全迁移到当前格式。',
  },
  'recovered-backup': {
    title: '已恢复上一份存档',
    body: '检测到当前存档损坏，森林已从上一份有效快照恢复；损坏数据仍隔离保留在本机。',
  },
  'reset-corrupt': {
    title: '损坏存档已隔离',
    body: '当前和备份存档都无法读取，已安全创建新旅程；原始损坏数据仍保留在本机供诊断。',
  },
  'storage-unavailable': {
    title: '暂时无法使用本地存档',
    body: '本次仍可游玩，但关闭应用后进度可能无法保留。请检查磁盘与应用数据权限。',
  },
} as const;

export function ProgressRecoveryNotice() {
  const status = useAppStore((state) => state.progressRecoveryStatus);
  const dismiss = useAppStore((state) => state.dismissProgressRecovery);
  if (status === 'none') return null;

  const copy = RECOVERY_COPY[status];
  return (
    <div className="progress-recovery" role="status" aria-live="polite">
      <GlassPanel className="progress-recovery__panel">
        <div>
          <strong>{copy.title}</strong>
          <p>{copy.body}</p>
        </div>
        <GlassButton onClick={dismiss}>知道了</GlassButton>
      </GlassPanel>
    </div>
  );
}
