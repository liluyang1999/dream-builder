/** Public theme + quality types for the Liquid Glass system. */

/** Color scheme. `auto` follows the OS via `prefers-color-scheme`. */
export type GlassTheme = 'auto' | 'light' | 'dark';

/**
 * Visual quality tier — trades effects for performance.
 * - `high`: full effects incl. caustic shimmer.
 * - `balanced`: blur + specular, no shimmer.
 * - `low`: opaque tint fallback (no backdrop-filter).
 */
export type GlassQuality = 'high' | 'balanced' | 'low';
