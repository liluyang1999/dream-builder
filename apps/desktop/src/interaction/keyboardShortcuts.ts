export interface ShortcutCallbacks {
  onResetCamera: () => void;
  onToggleHud: () => void;
  onToggleFullscreen: () => void;
  onScreenshot: () => void;
  onDeselect: () => void;
  onShowHelp: () => void;
}

export class KeyboardShortcuts {
  private readonly handler: (event: KeyboardEvent) => void;

  constructor(private readonly callbacks: ShortcutCallbacks) {
    this.handler = (event) => this.handle(event);
    window.addEventListener('keydown', this.handler);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handler);
  }

  private handle(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.repeat) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }
    switch (event.key) {
      case 'r':
      case 'R':
        this.callbacks.onResetCamera();
        event.preventDefault();
        break;
      case 'h':
      case 'H':
        this.callbacks.onToggleHud();
        event.preventDefault();
        break;
      case 'f':
      case 'F':
        this.callbacks.onToggleFullscreen();
        event.preventDefault();
        break;
      case 's':
      case 'S':
        this.callbacks.onScreenshot();
        event.preventDefault();
        break;
      case 'Escape':
        this.callbacks.onDeselect();
        event.preventDefault();
        break;
      case '?':
      case '/':
        this.callbacks.onShowHelp();
        event.preventDefault();
        break;
    }
  }
}
