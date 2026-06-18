import { type HTMLAttributes, forwardRef } from 'react';

/** A small translucent pill, e.g. for status labels. */
export const GlassBadge = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  function GlassBadge({ className, children, ...rest }, ref) {
    const classes = ['lg-surface', 'lg-badge'];
    if (className) classes.push(className);
    return (
      <span ref={ref} className={classes.join(' ')} {...rest}>
        {children}
      </span>
    );
  },
);
