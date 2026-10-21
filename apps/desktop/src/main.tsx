import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from './ui/AppErrorBoundary';
import './styles.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('找不到根节点 #app');
}

const root = createRoot(container);
const isM2EvidenceWorkbench =
  new URLSearchParams(window.location.search).get('tool') === 'm2-evidence';

// Let React own loading and failures so a missing entry chunk reaches recovery UI.
const EntryPoint = lazy(async () => ({
  default: isM2EvidenceWorkbench
    ? (await import('./playtest/M2EvidenceWorkbench')).M2EvidenceWorkbench
    : (await import('./App')).App,
}));

root.render(
  <StrictMode>
    <AppErrorBoundary>
      <Suspense
        fallback={
          <div className="scene-loading" role="status">
            正在载入森林……
          </div>
        }
      >
        <EntryPoint />
      </Suspense>
    </AppErrorBoundary>
  </StrictMode>,
);
