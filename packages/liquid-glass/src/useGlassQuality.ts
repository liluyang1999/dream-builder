/** Capability-based quality detection with graceful degradation. */
import type { GlassQuality } from './theme';

/**
 * Pick a quality tier from the current environment:
 * - no `backdrop-filter` support → `low` (opaque fallback)
 * - reduced-motion or few CPU cores → `balanced`
 * - otherwise → `high`
 */
export function detectGlassQuality(): GlassQuality {
  if (typeof window === 'undefined') return 'balanced';

  const supportsBackdrop =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    (CSS.supports('backdrop-filter', 'blur(1px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  if (!supportsBackdrop) return 'low';

  const reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fewCores =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency <= 4;

  return reducedMotion || fewCores ? 'balanced' : 'high';
}
