import { type ButtonHTMLAttributes, type PointerEvent, forwardRef } from 'react';

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` is a solid accent button; `ghost` is translucent glass. */
  variant?: 'primary' | 'ghost';
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variant = 'ghost', className, type = 'button', onPointerMove, children, ...rest },
  ref,
) {
  const classes = ['lg-button'];
  if (variant === 'primary') {
    classes.push('lg-button--primary');
  } else {
    classes.push('lg-surface', 'lg-surface--sm');
  }
  if (className) classes.push(className);

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>): void {
    if (variant === 'ghost') {
      const rect = event.currentTarget.getBoundingClientRect();
      const mx = ((event.clientX - rect.left) / rect.width) * 100;
      const my = ((event.clientY - rect.top) / rect.height) * 100;
      event.currentTarget.style.setProperty('--lg-mx', `${mx}%`);
      event.currentTarget.style.setProperty('--lg-my', `${my}%`);
    }
    onPointerMove?.(event);
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes.join(' ')}
      data-lg-specular={variant === 'ghost' ? 'on' : 'off'}
      onPointerMove={handlePointerMove}
      {...rest}
    >
      {children}
    </button>
  );
});
