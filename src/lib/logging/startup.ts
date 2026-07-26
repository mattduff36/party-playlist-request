/**
 * Gate module-init / singleton console noise during `next build` prerender.
 * Runtime server start still logs unless SILENCE_STARTUP_LOGS is set.
 */

export function shouldLogStartup(): boolean {
  if (
    process.env.SILENCE_STARTUP_LOGS === '1' ||
    process.env.SILENCE_STARTUP_LOGS === 'true'
  ) {
    return false;
  }

  // Next.js sets this while collecting page data / generating static pages
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return false;
  }

  return true;
}

/** True when production auto-start of collectors/checks should run (not during build). */
export function shouldAutoStartRuntimeServices(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  );
}

export function startupLog(...args: unknown[]): void {
  if (shouldLogStartup()) {
    // eslint-disable-next-line no-console -- intentional gated startup diagnostics
    console.log(...args);
  }
}
