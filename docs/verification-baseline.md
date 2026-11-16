# Verification baseline before Weekly Draft extraction

Recorded for [#58](https://github.com/AndreasUnunger/EverythingPath/issues/58)
on 2026-09-08, starting from `f509c91` on `feature/untangling`.
This verifies the supported legacy application. It does not establish canonical
rules completeness or readiness for extraction merges or cutover.

## Reproduce the checks

With dependencies installed from `pnpm-lock.yaml`, run:

```sh
pnpm -s typecheck
pnpm exec tsc --noEmit --incremental false -p convex/tsconfig.json
pnpm -s lint
pnpm -s test --reporter=json --outputFile=/tmp/everythingpath-issue-58-vitest.json
```

Results: application and Convex typechecks pass; lint passes without warnings;
33 test files collect and pass all 223 tests. The JSON results contain zero
failed, pending/skipped, or todo tests. Every `*.test.ts` and `*.test.tsx` file
under `src/` and `convex/` is present in the results, and every collected
assertion has status `passed`. No tests were deleted, disabled, or rewritten.
When rerunning, inspect collection and assertion statuses, not just the process
exit code; a skipped, todo, missing, or uncollected case establishes no coverage.

## Bootstrap findings and repairs

- Generated `api.js`, `api.d.ts`, `dataModel.d.ts`, `server.js`, and `server.d.ts`
  were already tracked by `f509c91`. They match the generated bindings preserved
  in #22's stash. Direct Node imports verified the API references, component
  proxy, and all seven server function builders; both typechecks and the eight
  `convex-test` integration cases also exercise the bindings. The audit's
  missing-import failures do not reproduce on this checkout.
- `convex/_generated/ai/guidelines.md` was missing. Restored it verbatim from
  #22's stash, `a06389ac8ab9e9a7301fec5f5c5408244ce902a2`, third parent, and read
  it before any backend implementation. SHA-256:
  `533ba2428f2dc572e825555e6e681d2e56e7e757c15a3fdd036a5d705413f020`.
  The recovered guidance and package manifest target Convex `^1.44.0`; the
  lockfile currently resolves that compatible range to `1.45.0`. Check the
  installed types before using version-dependent APIs in subsequent
  implementation. No backend implementation changed here.
- Initial `pnpm -s typecheck` failed with TS2307 in
  `agent/skills/setup-ts-deep-modules/dependency-cruiser.config.cjs`: the broad
  include pulled an agent-skill example into the application project and tried
  to resolve its optional `dependency-cruiser` import. Reused #22's existing
  `tsconfig.json` exclusion of `agent` and `.agents`. Application, backend, and
  test sources remain checked; no application dependency or shim was added.

## Coverage to preserve and expectations to replace

Follow [#53](https://github.com/AndreasUnunger/EverythingPath/issues/53),
[#55](https://github.com/AndreasUnunger/EverythingPath/issues/55), and
[#56](https://github.com/AndreasUnunger/EverythingPath/issues/56), as indexed by
[#57](https://github.com/AndreasUnunger/EverythingPath/issues/57). Passing legacy
characterization tests are not approval of their rules interpretations.
Replace expectations alongside the owning extraction and its consumer switch;
do not activate partial corrections through destructive legacy save paths.

| Existing tests | Preserve or replace during extraction |
| --- | --- |
| `src/lib/week-advancement.test.ts`, `weekly-resolution-contract.test.ts` | Preserve deterministic outcomes, preview/change-plan agreement, required adjustment reasons, and application of adjustments after the baseline. Reassess numeric fixtures against the accepted rules. |
| `convex/weekBoard.history.integration.test.ts` | Preserve preview-to-commit equality, stale Confirmation atomic failure, concurrent Confirmation exclusion, authorization and transaction rollback. Backward/forward rollback cycles and child-ID reconstruction characterize legacy history; the replacement requires immutable records and closed-draft isolation, not a rollback editor. |
| `src/lib/week-board-mutation-harness.test.ts` | Preserve meaningful roster, asset, event and shared-edit outcomes. Its hand-built database and mocked authorization cannot prove real atomicity or access control; move those cases to Convex/adapter contracts incrementally. |
| `src/components/week-board/use-week-board-controller.test.tsx`, `use-week-board-mutations.test.tsx`, `week-board-controller-sync.test.ts` | Preserve local navigation, explicit clears, pending-edit protection, ordering, acknowledgement, reviewed Confirmation and militia/draft isolation. Exact batching, flush calls and merge-object shapes are superseded by Workspace outcome tests. |
| Ledger, form and phase presentation tests under `src/components/` | Preserve validation distinctions, formatting, interactions and feedback. Move rule assertions to shared projection tests as the calculations move. |
| `week-resolution.test.ts`: “resolves Roll Twice and ignores nested Roll Twice results” and “does not apply base effect for duplicate event without a Twice clause” | Superseded: require replacement rolls for repeated Roll Twice and resolve no-Twice duplicates independently. Review “marks duplicate second result as Twice clause” and blanket duplicate suppression against each actual clause. Owning selection work: #73. |
| `week-resolution.test.ts`: “accumulates uneventful carry after week 1 and resets on eventful week” | Superseded: one current-rank bonus to the next eligible week's bounded chance, without accumulation; first-use context is independent of the displayed week. Owning work: #73. |
| Mutation harness: “does not dismiss a team on a failed Dismiss Team check” | Superseded: failed dismissal still removes the target and adds rolled Notoriety. Owning work: #68. |
| Mutation harness: “applies last-write-wins when multiple users update same slot” | Superseded: reject conflicting stale same-target edits, retain disjoint edits, and report visible recovery. Owning work: #79. |
| Mutation harness: “delivers pending orders when their due week is reached” | Special Orders require day-based delivery and explicit receipt; Broker Market keeps next-Activity timing. Separate those cases in #69. |
| Legacy action-capacity and strict staging fixtures | Rank 1 has one baseline action; shrinking capacity must retain occupied choices. Out-of-rules choices use reasoned shared Rules Exceptions, distinct from arithmetic adjustments. Implement through #61, #66 and the later persistence/UI switches. |

This list identifies concrete superseded expectations and useful existing
surfaces; it is not the full rule inventory. Persistent Double Agent duration
and its single penalty, militia-wide buyoff cooldown, narrative acknowledgements,
whole-count rounding without invented minima, and copper precision also require
the accepted #56 cases, whether or not legacy tests currently assert them.

## Remaining gates and build ownership

- [#59](https://github.com/AndreasUnunger/EverythingPath/issues/59) owns the full
  audit-derived rules catalog, stable test IDs, fingerprints, explicit gaps,
  collected-result validation and readable report.
- [#60](https://github.com/AndreasUnunger/EverythingPath/issues/60) owns the
  isolated deployed Convex and two-authenticated-player extraction gate.
  Passing `convex-test` and mocked UI tests do not prove real subscription
  delivery or multiplayer agreement. No browser/deployed-adapter suite ran here.
- [#22](https://github.com/AndreasUnunger/EverythingPath/issues/22) remains the
  owner of backend-free builds, explicit deployment, generated-code drift
  checking and disposable-preview rehearsal. Its WIP stash remains intact;
  only its TypeScript exclusions and generated guidance were reused here.
  No competing build or E2E bootstrap was introduced. The current generic
  `build` still invokes `convex dev --once`, so it was not used for this baseline.

No deployment, campaign writes, code generation, or live cutover was performed.
