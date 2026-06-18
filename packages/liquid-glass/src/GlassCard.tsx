import { forwardRef } from 'react';
import { GlassSurface, type GlassSurfaceProps } from './GlassSurface';

/** A smaller, lighter glass container — for sub-sections within a panel. */
export const GlassCard = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassCard(
  { className, small = true, ...rest },
  ref,
) {
  return (
    <GlassSurface
      ref={ref}
      small={small}
      className={className ? `lg-card ${className}` : 'lg-card'}
      {...rest}
    />
  );
});
