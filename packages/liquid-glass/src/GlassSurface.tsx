/** The base translucent surface. Other components compose on top of it. */
import { type HTMLAttributes, type PointerEvent, forwardRef } from 'react';

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** Track the pointer to drive the specular highlight. */
  interactive?: boolean;
  /** Enable the high-quality caustic shimmer layer (no-op below `high`). */
  refraction?: boolean;
  /** Use the smaller corner radius. */
  small?: boolean;
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassSurface(
  {
    interactive = false,
    refraction = true,
    small = false,
    className,
    onPointerMove,
    children,
    ...rest
  },
  ref,
) {
  const classes = ['lg-surface'];
  if (small) classes.push('lg-surface--sm');
  if (className) classes.push(className);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (interactive) {
      const rect = event.currentTarget.getBoundingClientRect();
      const mx = ((event.clientX - rect.left) / rect.width) * 100;
      const my = ((event.clientY - rect.top) / rect.height) * 100;
      event.currentTarget.style.setProperty('--lg-mx', `${mx}%`);
      event.currentTarget.style.setProperty('--lg-my', `${my}%`);
    }
    onPointerMove?.(event);
  }

  return (
    <div
      ref={ref}
      className={classes.join(' ')}
      data-lg-specular={interactive ? 'on' : 'off'}
      data-lg-refraction={refraction ? 'on' : 'off'}
      onPointerMove={handlePointerMove}
      {...rest}
    >
      {children}
    </div>
  );
});
