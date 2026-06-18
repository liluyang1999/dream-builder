export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type DetailKind = 'rune' | 'crystal' | 'leaf';

export interface BranchSegment {
  id: string;
  start: Vec3;
  end: Vec3;
  radiusStart: number;
  radiusEnd: number;
  twist: number;
  level: number;
}

export interface LeafCluster {
  id: string;
  position: Vec3;
  radius: number;
  density: number;
  hue: number;
}

export interface RuneMark {
  id: string;
  position: Vec3;
  normal: Vec3;
  glyph: string;
  intensity: number;
}

export interface CrystalCluster {
  id: string;
  position: Vec3;
  scale: number;
  hue: number;
}

export interface DetailInfo {
  id: string;
  kind: DetailKind;
  title: string;
  description: string;
  energy: number;
}

export interface TreePalette {
  bark: string;
  leaves: string;
  glow: string;
  crystal: string;
  backgroundTop: string;
  backgroundBottom: string;
}

export interface TreeScene {
  seed: number;
  branches: BranchSegment[];
  leafClusters: LeafCluster[];
  runes: RuneMark[];
  crystals: CrystalCluster[];
  details: DetailInfo[];
  palette: TreePalette;
}

export interface MagicPulse {
  id: string;
  center: Vec3;
  radius: number;
  strength: number;
}

export interface MagicField {
  tick: number;
  wind: Vec3;
  pulses: MagicPulse[];
}
