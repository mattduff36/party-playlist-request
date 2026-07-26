# Quality gate debt (PRD-05)

Measured on `dev/prd-05-canonical-database-ci-20260726` after PRD-04 integration.

| Gate | Current | Target |
| --- | --- | --- |
| `npm run test:unit` | Pass (blocking in CI) | Keep blocking |
| `npm run build` | Pass with ignore flags (blocking in CI) | Pass without ignore flags |
| `npm run type-check` | ~114 errors | Zero; CI hard-fail |
| `npm run lint` | ~267 errors / ~154 warnings | Zero errors; CI hard-fail |
| `next.config.ts` `typescript.ignoreBuildErrors` | `true` | Remove when type-check clean |
| `next.config.ts` `eslint.ignoreDuringBuilds` | `true` | Remove when lint clean |

## Why ignore flags remain

Removing `ignoreBuildErrors` / `ignoreDuringBuilds` now would fail `next build` on widespread pre-existing Pusher/state/test typing and ESLint `no-explicit-any` debt unrelated to the database migration slice. PRD-05 documents the debt and wires CI steps for visibility (`continue-on-error: true` on type-check/lint until green).

## Incomplete before preview merge

1. Clear type-check + lint (or narrowly suppress with justification — not preferred).
2. Flip CI `continue-on-error` to `false` for type-check and lint.
3. Remove both ignore flags from `next.config.ts`.
4. Optionally add `test:api` + Playwright smoke + Dependabot (PRD stretch).

## Do not

- Globally suppress TypeScript/ESLint categories to fake green.
- Re-introduce request-time DDL to paper over missing migrations.
