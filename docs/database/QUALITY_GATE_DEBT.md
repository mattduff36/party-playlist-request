# Quality gate debt (PRD-05)

Measured on `dev/prd-05-canonical-database-ci-20260726` after FIX_THEN_MERGE corrective pass.

| Gate | Current | Target |
| --- | --- | --- |
| `npm run type-check` | **Pass (0 errors)** — CI hard-fail | Keep blocking |
| `npm run test:unit` | Pass — CI hard-fail | Keep blocking |
| `npm run build` | Pass with `eslint.ignoreDuringBuilds` | Pass without ignore flags |
| `npm run lint` | **~236 errors** (almost all `@typescript-eslint/no-explicit-any`) + warnings | Zero errors; CI hard-fail |
| `next.config.ts` `typescript.ignoreBuildErrors` | **Removed** | Keep removed |
| `next.config.ts` `eslint.ignoreDuringBuilds` | `true` (lint not green) | Remove when lint clean |

## What was reverted / not done

- **Reverted:** global ESLint demotion of `@typescript-eslint/no-explicit-any` / `no-require-imports` to `warn` (conflicts with PRD-05 “do not globally suppress categories to fake green”).
- **Reverted:** broad `tsconfig` excludes of `indexes.ts` / `constraints.ts`. Those foot-gun modules were **moved** to `src/lib/db/_quarantine/` instead (already excluded as quarantine).
- **Kept path-scoped:** ESLint ignore for `src/lib/db/_quarantine/**`; `scripts/**/*.{js,cjs}` may use `require` (legacy CJS ops scripts only).

## Why lint is not hard-fail yet

Clearing ~236 `no-explicit-any` findings without rule demotion requires a dedicated typing pass. A bulk `any`→`unknown` rewrite was attempted and **rolled back** after it produced ~455 new type-check errors. Prefer incremental real typing over suppressions.

## Incomplete before claiming PRD-05 quality-gate acceptance

1. Clear lint errors (primarily `no-explicit-any`) with real types — zero lint errors.
2. Flip CI lint `continue-on-error` to hard-fail.
3. Remove `eslint.ignoreDuringBuilds` from `next.config.ts`.

## Do not

- Globally demote TypeScript/ESLint categories to warn/off to fake green.
- Re-introduce `typescript.ignoreBuildErrors`.
- Re-introduce request-time DDL to paper over missing migrations.
