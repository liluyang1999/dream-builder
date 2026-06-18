import * as THREE from 'three';
import { reduceSelectionState, type SelectionState } from './selectionState';

export interface InteractionCallbacks {
  onHoverChange: (id: string | null) => void;
  onSelect: (id: string) => void;
  onSelectionClear?: () => void;
}

export class InteractionController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.Camera;
  private readonly objects: THREE.Object3D[];
  private readonly callbacks: InteractionCallbacks;
  private state: SelectionState = { hoveredId: null, selectedId: null };

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    objects: THREE.Object3D[],
    callbacks: InteractionCallbacks,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.objects = objects;
    this.callbacks = callbacks;

    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('click', this.handleClick);
  }

  get selectedId(): string | null {
    return this.state.selectedId;
  }

  update(): void {
    for (const object of this.objects) {
      const id = readDetailId(object);
      const baseScale = readBaseScale(object);
      const target = id === this.state.selectedId ? 1.18 : id === this.state.hoveredId ? 1.1 : 1;
      object.scale.lerp(baseScale.clone().multiplyScalar(target), 0.16);
      setEmissiveBoost(object, target > 1 ? target : 1);
    }
  }

  deselect(): void {
    if (!this.state.selectedId) return;
    this.state = reduceSelectionState(this.state, { type: 'selection-clear' });
    this.callbacks.onSelectionClear?.();
  }

  dispose(): void {
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('click', this.handleClick);
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const id = this.pick(event);
    const next = id
      ? reduceSelectionState(this.state, { type: 'hover', id })
      : reduceSelectionState(this.state, { type: 'hover-clear' });

    if (next.hoveredId !== this.state.hoveredId) {
      this.state = next;
      this.callbacks.onHoverChange(next.hoveredId);
    } else {
      this.state = next;
    }
  };

  private readonly handlePointerLeave = (): void => {
    const next = reduceSelectionState(this.state, { type: 'hover-clear' });
    if (next.hoveredId !== this.state.hoveredId) {
      this.callbacks.onHoverChange(null);
    }
    this.state = next;
  };

  private readonly handleClick = (): void => {
    if (!this.state.hoveredId) {
      this.deselect();
      return;
    }
    this.state = reduceSelectionState(this.state, { type: 'click', id: this.state.hoveredId });
    if (this.state.selectedId) {
      this.callbacks.onSelect(this.state.selectedId);
    }
  };

  private pick(event: PointerEvent): string | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObjects(this.objects, true)[0];
    return hit ? readDetailId(hit.object) : null;
  }
}

function readDetailId(object: THREE.Object3D | null): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const id = current.userData.detailId;
    if (typeof id === 'string' && id.trim().length > 0) {
      return id;
    }
    current = current.parent;
  }
  return null;
}

function readBaseScale(object: THREE.Object3D): THREE.Vector3 {
  const base = object.userData.baseScale;
  return base instanceof THREE.Vector3 ? base : new THREE.Vector3(1, 1, 1);
}

function setEmissiveBoost(object: THREE.Object3D, multiplier: number): void {
  object.traverse((child) => {
    const maybeMesh = child as THREE.Mesh | THREE.Sprite;
    const materials = materialList(maybeMesh.material);
    for (const material of materials) {
      if ('emissiveIntensity' in material && typeof material.emissiveIntensity === 'number') {
        const base = typeof material.userData.baseEmissive === 'number' ? material.userData.baseEmissive : material.emissiveIntensity;
        material.userData.baseEmissive = base;
        material.emissiveIntensity = base * multiplier;
      }
      if ('opacity' in material && typeof material.opacity === 'number') {
        material.opacity = Math.min(1, multiplier > 1 ? 0.95 : 0.82);
      }
    }
  });
}

function materialList(material: unknown): THREE.Material[] {
  if (!material) return [];
  return Array.isArray(material) ? material : [material as THREE.Material];
}
