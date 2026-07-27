/**
 * Production fail-closed helpers for secret/config fallbacks (PRD-01).
 * Non-production (development/test) may use documented local defaults.
 */

export function isProductionRuntime(
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  return nodeEnv === 'production';
}

/**
 * Resolve a required secret. In production, missing or known-insecure
 * fallback values fail closed. Outside production, `devFallback` is allowed.
 */
export function resolveSecretEnv(
  name: string,
  options?: {
    insecureFallbacks?: string[];
    devFallback?: string;
    /** Override for tests — defaults to process.env.NODE_ENV */
    nodeEnv?: string;
  }
): string {
  const value = process.env[name]?.trim() || '';
  const insecure = options?.insecureFallbacks || [];
  const isInsecure = !value || insecure.includes(value);
  const production = isProductionRuntime(options?.nodeEnv ?? process.env.NODE_ENV);

  if (isInsecure) {
    if (production) {
      throw new Error(`${name} must be configured in production (fail-closed)`);
    }
    if (options?.devFallback !== undefined) {
      return options.devFallback;
    }
    throw new Error(`${name} is required`);
  }

  return value;
}

export function resolveOptionalEnv(
  name: string,
  devFallback: string,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProductionRuntime(nodeEnv)) {
    throw new Error(`${name} must be configured in production (fail-closed)`);
  }
  return devFallback;
}
