import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { InteractionController } from '../interaction/InteractionController';
import { KeyboardShortcuts } from '../interaction/keyboardShortcuts';
import { loadDetailInfo, loadMagicField, loadTreeScene } from '../tauri/treeApi';
import { DetailsPanel } from '../ui/DetailsPanel';
import { OnboardingHint } from '../ui/OnboardingHint';
import type { TreeScene } from '../types/tree';
import { MagicParticles } from './Particles';
import { Renderer } from './Renderer';
import { createTreeObjects, type TreeObjects } from './TreeFactory';

const DEFAULT_SEED = 424242;
const SEED_STORAGE_KEY = 'dream-builder.seed';
const MAGIC_FIELD_INTERVAL_MS = 350;

export class FantasyTreeApp {
  private readonly root: HTMLDivElement;
  private host: HTMLDivElement | null = null;
  private panel: DetailsPanel | null = null;
  private onboarding: OnboardingHint | null = null;
  private renderer: Renderer | null = null;
  private tree: TreeObjects | null = null;
  private particles: MagicParticles | null = null;
  private interaction: InteractionController | null = null;
  private shortcuts: KeyboardShortcuts | null = null;
  private frame = 0;
  private startedAt = 0;
  private sceneData: TreeScene | null = null;
  private currentSeed: number;
  private hudHidden = false;
  private lastFieldAt = 0;
  private readonly prefersReducedMotion: boolean;

  constructor(root: HTMLDivElement) {
    this.root = root;
    this.currentSeed = readStoredSeed() ?? DEFAULT_SEED;
    this.prefersReducedMotion = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async start(): Promise<void> {
    this.root.className = 'app-shell';
    this.root.innerHTML = '';

    this.host = document.createElement('div');
    this.host.className = 'scene-host';
    this.root.appendChild(this.host);

    this.panel = new DetailsPanel(this.root, {
      initialSeed: this.currentSeed,
      onResetCamera: () => this.renderer?.resetCamera(),
      onRegenerate: (seed) => void this.regenerate(seed),
      onScreenshot: () => void this.captureScreenshot(),
      onExport: () => void this.exportGltf(),
    });

    this.renderer = new Renderer(this.host);

    this.shortcuts = new KeyboardShortcuts({
      onResetCamera: () => this.renderer?.resetCamera(),
      onToggleHud: () => this.toggleHud(),
      onToggleFullscreen: () => void this.toggleFullscreen(),
      onScreenshot: () => void this.captureScreenshot(),
      onDeselect: () => this.deselect(),
      onShowHelp: () => this.panel?.toggleHelp(),
    });

    await this.buildScene(this.currentSeed);

    this.onboarding = new OnboardingHint(this.root);

    this.startedAt = performance.now();
    this.animate();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.shortcuts?.dispose();
    this.disposeContent();
    this.renderer?.dispose();
    this.onboarding?.dispose();
    this.shortcuts = null;
    this.renderer = null;
    this.onboarding = null;
  }

  async regenerate(seed: number): Promise<void> {
    if (!Number.isFinite(seed) || seed < 0) return;
    if (seed === this.currentSeed && this.sceneData) return;
    this.currentSeed = seed;
    writeStoredSeed(seed);
    this.deselect();
    this.disposeContent();
    await this.buildScene(seed);
  }

  private async buildScene(seed: number): Promise<void> {
    const renderer = this.renderer;
    const panel = this.panel;
    if (!renderer || !panel) return;

    const load = await loadTreeScene(seed);
    this.sceneData = load.scene;
    panel.setStatus(load.source === 'rust' ? 'Rust 后端已连接，场景数据已加载。' : '使用本地回退数据运行。');
    panel.setError(load.warning);
    panel.setSeed(load.scene.seed);

    this.tree = createTreeObjects(load.scene);
    renderer.scene.add(this.tree.group);

    this.particles = new MagicParticles(renderer.scene, load.scene);

    const tree = this.tree;
    this.interaction = new InteractionController(renderer.domElement, renderer.camera, tree.interactive, {
      onHoverChange: (id) => panel.setHover(id ? tree.labels.get(id) ?? id : null),
      onSelect: (id) => void this.selectDetail(id),
      onSelectionClear: () => panel.setSelected(null),
    });
  }

  private disposeContent(): void {
    this.interaction?.dispose();
    this.particles?.dispose();
    if (this.tree) {
      disposeObject(this.tree.group);
      this.tree.group.removeFromParent();
    }
    this.interaction = null;
    this.particles = null;
    this.tree = null;
  }

  private animate = (): void => {
    const renderer = this.renderer;
    if (!renderer) return;

    const now = performance.now();
    const elapsed = (now - this.startedAt) / 1000;

    if (!this.prefersReducedMotion) {
      this.tree?.group.rotateY(0.0008);
    }
    this.interaction?.update();
    if (!this.prefersReducedMotion) {
      this.particles?.update(elapsed, this.interaction?.selectedId ?? null);
    }

    if (this.sceneData && now - this.lastFieldAt > MAGIC_FIELD_INTERVAL_MS) {
      this.lastFieldAt = now;
      const seed = this.sceneData.seed;
      const tick = Math.floor(elapsed * 60);
      void loadMagicField(seed, tick).then((field) => {
        if (field) this.particles?.applyField(field);
      });
    }

    renderer.render();
    this.frame = requestAnimationFrame(this.animate);
  };

  private async selectDetail(id: string): Promise<void> {
    if (!this.sceneData || !this.panel) return;
    try {
      const detail = await loadDetailInfo(id, this.sceneData);
      this.panel.setSelected(detail);
      this.panel.setError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.panel.setError(`无法读取细节信息：${message}`);
    }
  }

  private toggleHud(): void {
    this.hudHidden = !this.hudHidden;
    this.root.classList.toggle('hud-hidden', this.hudHidden);
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await this.root.requestFullscreen();
      }
    } catch {
      // best-effort; some webviews may not allow fullscreen
    }
  }

  private async captureScreenshot(): Promise<void> {
    const renderer = this.renderer;
    if (!renderer) return;
    const restoreHud = !this.hudHidden;
    if (restoreHud) this.toggleHud();
    const blob = await renderer.captureFrame();
    if (restoreHud) this.toggleHud();
    if (!blob) return;
    downloadBlob(blob, `dream-builder-${this.currentSeed}-${Date.now()}.png`);
  }

  private async exportGltf(): Promise<void> {
    if (!this.tree) return;
    try {
      const exporter = new GLTFExporter();
      const result = (await exporter.parseAsync(this.tree.group, { binary: true })) as ArrayBuffer;
      const blob = new Blob([result], { type: 'model/gltf-binary' });
      downloadBlob(blob, `dream-builder-${this.currentSeed}.glb`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.panel?.setError(`导出 glTF 失败：${message}`);
    }
  }

  private deselect(): void {
    this.interaction?.deselect();
    this.panel?.setSelected(null);
  }
}

function readStoredSeed(): number | null {
  try {
    const raw = window.localStorage.getItem(SEED_STORAGE_KEY);
    if (!raw) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStoredSeed(seed: number): void {
  try {
    window.localStorage.setItem(SEED_STORAGE_KEY, String(seed));
  } catch {
    // localStorage may be unavailable in some webviews; ignore
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    for (const material of materialList(mesh.material)) {
      const map = (material as THREE.MeshBasicMaterial).map;
      if (map) {
        map.dispose();
      }
      material.dispose();
    }
  });
}

function materialList(material: unknown): THREE.Material[] {
  if (!material) return [];
  return Array.isArray(material) ? material : [material as THREE.Material];
}
