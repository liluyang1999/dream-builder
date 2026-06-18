import { forwardRef } from 'react';
import { GlassSurface, type GlassSurfaceProps } from './GlassSurface';

/** A padded glass container for grouped content. */
export const GlassPanel = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassPanel(
  { className, ...rest },
  ref,
) {
  return (
    <GlassSurface
      ref={ref}
      className={className ? `lg-panel ${className}` : 'lg-panel'}
      {...rest}
    />
  );
});
