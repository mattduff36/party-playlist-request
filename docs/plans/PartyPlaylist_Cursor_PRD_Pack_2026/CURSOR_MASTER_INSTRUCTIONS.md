# Cursor Master Instructions for PartyPlaylist PRDs

Use this file together with exactly one PRD from this pack.

## Role

Act as the senior TypeScript, Next.js, PostgreSQL and application-security engineer responsible for implementing the supplied PRD in the existing PartyPlaylist repository.

## Behaviour

- This is a coding task. Do not transform the PRD into another prompt.
- Read repository rules, but this PRD pack takes precedence where generic prompt-optimiser behaviour conflicts with direct implementation.
- Inspect the actual source before deciding a file is safe to remove or modify.
- Do not ask broad planning questions. Make a reasoned implementation choice inside the stated constraints. Ask only when a missing credential, inaccessible service or irreversible production decision makes implementation impossible.
- Show concise progress summaries while working.
- Do not claim tests passed unless they were run and passed.
- When an existing test encodes insecure or obsolete behaviour, update the test and explain why.

## Required lifecycle

1. Create the PRD-specific development branch before editing.
2. Establish a baseline with the relevant lint, type-check, tests and build commands.
3. Implement in small coherent steps.
4. Add security and regression tests.
5. Run the PRD verification commands.
6. Review the final diff for secrets, logging, tenant leakage and accidental unrelated edits.
7. Commit locally.
8. Produce the required completion report and stop. Do not push.

## Source precedence

1. The current PRD
2. Current source and database migrations
3. `PartyPlaylist_Codebase_Review_2026.docx`
4. `PartyPlaylist_Product_Plan_2026.docx`
5. Historical repository documentation

Historical documents contain claims that no longer match the July 2026 source. Never mark a finding resolved solely because an old document says it was fixed.
