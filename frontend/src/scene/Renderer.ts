import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly domElement: HTMLCanvasElement;

  private readonly composer: EffectComposer;
  private readonly resizeObserver: ResizeObserver;
  private readonly host: HTMLElement;

  constructor(host: HTMLElement) {
    if (!canCreateWebGL()) {
      throw new Error('当前环境不支持 WebGL，无法渲染 3D 场景。');
    }

    this.host = host;
    this.scene.fog = new THREE.FogExp2(0x071018, 0.045);

    this.camera.position.set(3.8, 2.6, 5.2);
    this.camera.lookAt(0, 2.1, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.domElement = this.renderer.domElement;
    host.appendChild(this.domElement);

    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.8;
    this.controls.maxDistance = 8.5;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(0, 2.15, 0);

    this.addLights();

    const size = new THREE.Vector2(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1));
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(size, 0.82, 0.68, 0.18));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  render(): void {
    this.controls.update();
    this.composer.render();
  }

  resetCamera(): void {
    this.camera.position.set(3.8, 2.6, 5.2);
    this.controls.target.set(0, 2.15, 0);
    this.controls.update();
  }

  captureFrame(): Promise<Blob | null> {
    this.composer.render();
    return new Promise((resolve) => {
      this.domElement.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.domElement.remove();
  }

  private resize(): void {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x91ffe3, 0x1c120d, 1.2));

    const key = new THREE.DirectionalLight(0xf7dfaa, 2.4);
    key.position.set(-3.4, 5.2, 3.6);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x7d6cff, 1.8);
    rim.position.set(3.4, 3.8, -4.4);
    this.scene.add(rim);

    const core = new THREE.PointLight(0xf7c76b, 3.8, 6.5);
    core.position.set(0, 1.35, 0.25);
    this.scene.add(core);
  }
}

function canCreateWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
