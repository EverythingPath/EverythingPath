# Engineering standards

Every change is reviewed against these, together with `.claude/skills/deslop/style.md`. Moved verbatim from `AGENTS.md`; the militia product description is in [`product/militia-board.md`](product/militia-board.md).

## Roll Input Copy

- State each roll's dice notation (for example "1d20") once, in the roll field's own description. Headings and summaries name the roll, its DC, and its conditions without the dice.
- Write copy about the decision in front of the player. Boilerplate that restates how the table works, such as "Rolled at the table." or "The rules use the dice total; these modifiers are kept with the roll for the table.", is left out.
- Show a conditional roll input only while its condition holds, as the rules engine reads the entered check: for example a Notoriety roll on a natural 1, or a Training roll when the check succeeds. A hidden roll is never required and never changes the outcome.

## Validation Philosophy (Rules-Aware, Not Rules-Blocking)

- Form validation should use `react-hook-form` with `zod` schemas and field-level error messages.
- Use `zod` for structural/data-integrity validation (types, required values, parseability) before mutations.
- Validation UI must match the application design system (typography, borders, spacing, and tone) whenever new UI is added.
- Do not rely on browser-native validation UX; avoid native popups and use in-app, styled validation and warning presentation.
- Validation should explicitly differentiate `required/empty` errors from `invalid type/format` errors where both cases are possible.
- Validation messaging may expand within its own field container but must not misalign adjacent controls in the same row.
- Rule validation should be advisory by default, not hard-blocking.
- The system must allow out-of-rules but table-valid states (for example homebrew adjustments, narrative rewards, GM exceptions, or legacy campaign drift).
- Rule mismatches should be shown as warnings with clear context, not automatic rejection.
- Hard validation should be limited to data integrity and technical correctness (for example required fields, valid IDs, correct data types, and numeric parseability).
- Inputs that are structurally invalid (for example text in numeric fields, malformed references, impossible enum values) must still be blocked.
- Where useful, users should be able to mark or annotate intentional overrides so future sessions understand why state differs from baseline rules.

## UI Implementation Preference

- Prefer `shadcn/ui` components for all UI implementation by default; deviate only when a requirement cannot be met with `shadcn/ui`.
- Keep synchronization, shared-state storage, local derivation, and internal identifiers or versions out of user-facing copy. Describe only the product behavior or outcome the user needs.

## Engineering Guardrails

- After feature changes, run `pnpm -s typecheck`, `pnpm -s lint`, and relevant tests before concluding work.
- Before adding or expanding generated datasets, snapshots, manifests or reports, follow `docs/agents/generated-artifacts.md`.
- Follow React guidance from “You Might Not Need an Effect”: avoid `useEffect` for derived state or internal data flow when it can be expressed with render logic, memoization, event handlers, or keyed resets.
- Prefer feature architecture that separates concerns: keep route/page components thin and mostly presentational, move orchestration/derived state into focused controller hooks, isolate backend writes behind mutation/service hooks, and keep rule logic in shared pure utilities rather than scattered across UI components.
- When rules provide deterministic numeric defaults, prefill those values in the UI automatically (while still allowing user override and syncing), instead of requiring manual re-entry.
