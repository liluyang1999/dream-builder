import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dream Builder UI crashed', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="crash-screen" role="alert">
        <div className="crash-screen__mark" aria-hidden="true">
          ✦
        </div>
        <span>旅程已安全暂停</span>
        <h1>森林暂时迷路了</h1>
        <p>你的自动存档仍保存在本机。重新载入通常可以回到最近的安全点。</p>
        <button type="button" onClick={() => window.location.reload()}>
          重新载入游戏
        </button>
        <details>
          <summary>诊断信息</summary>
          <code>{this.state.error.message || '未知界面错误'}</code>
        </details>
      </main>
    );
  }
}
