import { StrictMode } from 'react';
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

void (async () => {
  const EntryPoint = isM2EvidenceWorkbench
    ? (await import('./playtest/M2EvidenceWorkbench')).M2EvidenceWorkbench
    : (await import('./App')).App;

  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <EntryPoint />
      </AppErrorBoundary>
    </StrictMode>,
  );
})();
