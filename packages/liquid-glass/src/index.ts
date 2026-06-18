/**
 * @dream-builder/liquid-glass — a small, reusable React component library that
 * renders iOS 26-style "liquid glass" surfaces with theme + quality tiers.
 *
 * Importing this entry also injects the stylesheet, so consumers only need:
 *   import { GlassProvider, GlassPanel } from '@dream-builder/liquid-glass';
 */
import './liquid-glass.css';

export type { GlassQuality, GlassTheme } from './theme';
export { detectGlassQuality } from './useGlassQuality';
export { GlassProvider, useGlass, type GlassProviderProps } from './GlassProvider';
export { GlassSurface, type GlassSurfaceProps } from './GlassSurface';
export { GlassPanel } from './GlassPanel';
export { GlassCard } from './GlassCard';
export { GlassButton, type GlassButtonProps } from './GlassButton';
export { GlassBadge } from './GlassBadge';
