const STORAGE_KEY = 'dream-builder.onboarding-seen';

export class OnboardingHint {
  private element: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    if (this.hasSeenBefore()) return;

    const card = document.createElement('aside');
    card.className = 'onboarding';
    card.innerHTML = `
      <h2>欢迎来到梦境之树</h2>
      <ul>
        <li>鼠标拖拽 / 滚轮 → 旋转 / 缩放</li>
        <li>点击发光的叶簇、符文、水晶 → 查看细节</li>
        <li>键盘：<kbd>R</kbd> 重置 · <kbd>S</kbd> 截图 · <kbd>F</kbd> 全屏 · <kbd>H</kbd> 隐藏面板 · <kbd>Esc</kbd> 取消选中 · <kbd>?</kbd> 帮助</li>
      </ul>
      <button type="button" data-role="dismiss">开始探索</button>
    `;
    const button = card.querySelector('[data-role="dismiss"]');
    if (button instanceof HTMLButtonElement) {
      button.addEventListener('click', () => this.dismiss());
    }
    root.appendChild(card);
    this.element = card;
  }

  dispose(): void {
    this.element?.remove();
    this.element = null;
  }

  private dismiss(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage may be unavailable; the hint just shows again next launch
    }
    this.element?.remove();
    this.element = null;
  }

  private hasSeenBefore(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
