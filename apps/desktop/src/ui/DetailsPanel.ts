import type { DetailInfo } from '../types/tree';

export interface DetailsPanelOptions {
  initialSeed: number;
  onResetCamera: () => void;
  onRegenerate: (seed: number) => void;
  onScreenshot: () => void;
  onExport: () => void;
}

export class DetailsPanel {
  private readonly status: HTMLDivElement;
  private readonly hover: HTMLDivElement;
  private readonly detailTitle: HTMLHeadingElement;
  private readonly detailBody: HTMLParagraphElement;
  private readonly meter: HTMLSpanElement;
  private readonly error: HTMLDivElement;
  private readonly seedInput: HTMLInputElement;
  private readonly help: HTMLDivElement;

  constructor(root: HTMLElement, opts: DetailsPanelOptions) {
    const hud = document.createElement('section');
    hud.className = 'hud';
    hud.innerHTML = `
      <h1 class="hud__title">Dream Builder Fantasy Tree</h1>
      <div class="hud__status" data-role="status">正在唤醒古树...</div>
      <div class="hud__line" data-role="hover">移动鼠标探索符文、水晶与叶簇。</div>
      <article class="hud__detail">
        <h2 data-role="detail-title">未选择细节</h2>
        <p data-role="detail-body">点击发光细节。
这里会显示后端信息。</p>
        <div class="hud__meter"><span data-role="meter"></span></div>
      </article>
      <div class="hud__error" data-role="error" hidden></div>
      <form class="hud__seed" data-role="seed-form">
        <label class="hud__seed-label" for="hud-seed">种子</label>
        <input class="hud__seed-input" id="hud-seed" type="number" min="0" max="4294967295" step="1" inputmode="numeric" data-role="seed-input" value="${opts.initialSeed}" />
        <button class="hud__button hud__button--ghost" type="submit">重新生成</button>
      </form>
      <div class="hud__actions">
        <button class="hud__button" type="button" data-role="reset">重置视角</button>
        <button class="hud__button hud__button--ghost" type="button" data-role="screenshot">截图</button>
        <button class="hud__button hud__button--ghost" type="button" data-role="export">导出 glTF</button>
        <button class="hud__button hud__button--ghost hud__button--icon" type="button" data-role="help" aria-label="键盘帮助">?</button>
      </div>
      <div class="hud__help" data-role="help" hidden>
        <strong>键盘快捷键</strong>
        <ul>
          <li><kbd>R</kbd> 重置视角</li>
          <li><kbd>H</kbd> 隐藏 / 显示面板</li>
          <li><kbd>F</kbd> 全屏</li>
          <li><kbd>S</kbd> 截图保存 PNG</li>
          <li><kbd>Esc</kbd> 取消选中</li>
          <li><kbd>?</kbd> 显示 / 关闭本帮助</li>
        </ul>
      </div>
    `;

    const note = document.createElement('div');
    note.className = 'corner-note';
    note.textContent = '鼠标拖拽旋转，滚轮缩放，点击交互细节。按 ? 查看快捷键。';

    root.append(hud, note);

    this.status = queryRole(hud, 'status', HTMLDivElement);
    this.hover = queryRole(hud, 'hover', HTMLDivElement);
    this.detailTitle = queryRole(hud, 'detail-title', HTMLHeadingElement);
    this.detailBody = queryRole(hud, 'detail-body', HTMLParagraphElement);
    this.meter = queryRole(hud, 'meter', HTMLSpanElement);
    this.error = queryRole(hud, 'error', HTMLDivElement);
    this.seedInput = queryRole(hud, 'seed-input', HTMLInputElement);
    this.help = queryRole(hud, 'help', HTMLDivElement);

    queryRole(hud, 'reset', HTMLButtonElement).addEventListener('click', opts.onResetCamera);
    queryRole(hud, 'screenshot', HTMLButtonElement).addEventListener('click', opts.onScreenshot);
    queryRole(hud, 'export', HTMLButtonElement).addEventListener('click', opts.onExport);
    queryRole(hud, 'help', HTMLButtonElement).addEventListener('click', () => this.toggleHelp());

    const form = queryRole(hud, 'seed-form', HTMLFormElement);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = Number.parseInt(this.seedInput.value, 10);
      if (Number.isFinite(value) && value >= 0) {
        opts.onRegenerate(value);
      }
    });
  }

  setStatus(message: string): void {
    this.status.textContent = message;
  }

  setHover(label: string | null): void {
    this.hover.textContent = label ? `当前悬停：${label}` : '移动鼠标探索符文、水晶与叶簇。';
  }

  setSelected(detail: DetailInfo | null): void {
    if (!detail) {
      this.detailTitle.textContent = '未选择细节';
      this.detailBody.textContent = '点击发光细节。\n这里会显示后端信息。';
      this.meter.style.setProperty('--energy', '0%');
      return;
    }

    this.detailTitle.textContent = detail.title;
    this.detailBody.textContent = wrapText(detail.description);
    this.meter.style.setProperty('--energy', `${Math.round(detail.energy * 100)}%`);
  }

  setError(message: string | null): void {
    this.error.hidden = !message;
    this.error.textContent = message ?? '';
  }

  setSeed(seed: number): void {
    if (Number.parseInt(this.seedInput.value, 10) !== seed) {
      this.seedInput.value = String(seed);
    }
  }

  toggleHelp(): void {
    this.help.hidden = !this.help.hidden;
  }
}

function wrapText(value: string): string {
  const normalized = value.trim();
  const lines: string[] = [];
  let current = '';

  for (const char of normalized) {
    current += char;
    if (current.length >= 18 || /[。；，]/.test(char)) {
      lines.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    lines.push(current.trim());
  }

  return lines.join('\n');
}

function queryRole<T extends HTMLElement>(
  root: HTMLElement,
  role: string,
  ctor: new (...args: never[]) => T,
): T {
  const element = root.querySelector(`[data-role="${role}"]`);
  if (!(element instanceof ctor)) {
    throw new Error(`Missing UI element for role: ${role}`);
  }
  return element;
}
