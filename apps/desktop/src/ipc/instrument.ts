/**
 * Method decorators for cross-cutting instrumentation.
 *
 * Teaching points:
 * - These are **standard (TC39 Stage 3) decorators** — note the
 *   `(target, context)` signature and `ClassMethodDecoratorContext`, distinct
 *   from the older "experimental" decorators.
 * - A decorator returns a *replacement* function with the same signature; here
 *   it wraps the original to log calls / measure duration, handling both sync
 *   and Promise-returning methods.
 */

type Method<This, Args extends unknown[], Return> = (this: This, ...args: Args) => Return;

/** Log each invocation of the decorated method at debug level. */
export function logged<This, Args extends unknown[], Return>(
  target: Method<This, Args, Return>,
  context: ClassMethodDecoratorContext<This, Method<This, Args, Return>>,
): Method<This, Args, Return> {
  const name = String(context.name);
  return function (this: This, ...args: Args): Return {
    console.debug(`[ipc] → ${name}`, ...args);
    return target.call(this, ...args);
  };
}

/** Measure wall-clock duration of the decorated method (awaits promises). */
export function measure<This, Args extends unknown[], Return>(
  target: Method<This, Args, Return>,
  context: ClassMethodDecoratorContext<This, Method<This, Args, Return>>,
): Method<This, Args, Return> {
  const name = String(context.name);
  return function (this: This, ...args: Args): Return {
    const start = performance.now();
    const finish = () => {
      console.debug(`[ipc] ${name} took ${(performance.now() - start).toFixed(1)}ms`);
    };
    const result = target.call(this, ...args);
    if (result instanceof Promise) {
      return result.finally(finish) as Return;
    }
    finish();
    return result;
  };
}
