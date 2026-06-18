import './styles.css';
import { FantasyTreeApp } from './scene/FantasyTreeApp';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  document.body.textContent = '无法启动应用：缺少 #app 根节点。';
} else {
  const app = new FantasyTreeApp(root);
  app.start().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    root.innerHTML = `<main class="fatal"><h1>渲染初始化失败</h1><p>${escapeHtml(message)}</p></main>`;
  });

  window.addEventListener('beforeunload', () => {
    app.dispose();
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[char] ?? char;
  });
}
