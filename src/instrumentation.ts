/**
 * Next.js instrumentation — runs once when a Node server instance starts.
 * Skipped by Next during `phase-production-build` (see Next.js ensureInstrumentationRegistered).
 */

export async function register(): Promise<void> {
  // Token vault uses Node crypto; skip Edge runtime.
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }

  const { assertTokenVaultConfiguredForProduction } = await import(
    './lib/crypto/token-vault'
  );
  // No-op when NODE_ENV !== 'production'; throws if TOKEN_ENCRYPTION_KEY_V1 missing/invalid.
  // Never logs key material.
  assertTokenVaultConfiguredForProduction();
}
