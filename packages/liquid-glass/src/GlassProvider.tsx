/**
 * Provides theme + quality context and injects the shared SVG filter used by
 * the high-quality caustic shimmer. Wrap your app (or a subtree) in this.
 */
import { type ReactNode, createContext, useContext, useMemo } from 'react';
import type { GlassQuality, GlassTheme } from './theme';
import { detectGlassQuality } from './useGlassQuality';

interface GlassContextValue {
  quality: GlassQuality;
  theme: GlassTheme;
}

const GlassContext = createContext<GlassContextValue>({ quality: 'balanced', theme: 'auto' });

export function useGlass(): GlassContextValue {
  return useContext(GlassContext);
}

export interface GlassProviderProps {
  theme?: GlassTheme;
  /** Explicit quality, or `'auto'` to detect from the environment. */
  quality?: GlassQuality | 'auto';
  className?: string;
  children: ReactNode;
}

export function GlassProvider({
  theme = 'auto',
  quality = 'auto',
  className,
  children,
}: GlassProviderProps) {
  const resolvedQuality = useMemo<GlassQuality>(
    () => (quality === 'auto' ? detectGlassQuality() : quality),
    [quality],
  );
  const value = useMemo<GlassContextValue>(
    () => ({ quality: resolvedQuality, theme }),
    [resolvedQuality, theme],
  );

  return (
    <GlassContext.Provider value={value}>
      <div
        className={className ? `lg-root ${className}` : 'lg-root'}
        data-lg-theme={theme}
        data-lg-quality={resolvedQuality}
      >
        <GlassFilters />
        {children}
      </div>
    </GlassContext.Provider>
  );
}

/** Hidden SVG defs: a fractal-noise displacement used for the caustic shimmer. */
function GlassFilters() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
      <title>liquid-glass filters</title>
      <defs>
        <filter id="lg-caustics" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.02"
            numOctaves={2}
            seed={7}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={8}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
