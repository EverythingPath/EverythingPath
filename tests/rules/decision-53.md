Part of [Untangle the Weekly Draft board architecture](https://github.com/AndreasUnunger/EverythingPath/issues/33).

## Question

What test architecture should protect the Weekly Draft refactor while old modules are replaced?

[Which module owns rules-derived phase projections?](https://github.com/AndreasUnunger/EverythingPath/issues/37) already requires full militia-rules coverage, a CI-enforced rules coverage catalog, Phase View outcome tests, Resolution Preview and Weekly Resolution tests, focused Convex adapter tests, and presentation-only UI tests. Treat those requirements as fixed.

Decide the catalog's code location and check format; the shared contract suite for the production Convex and in-memory persistence adapters; which current controller, hook, mutation-harness, and integration tests should be removed or retained; and the migration compatibility and multi-player end-to-end cases that must survive every extraction step.


## Resolution

The user confirmed the recommendations in both discussion rounds. Protect the refactor with tests through the agreed module interfaces, a machine-readable rules coverage catalog, and a required two-player browser suite.

### Rules coverage catalog and CI

Put the canonical catalog at `tests/rules/coverage-catalog.ts` and generate a readable report from it. Each entry carries a stable rule ID, a source reference into `militia-rules.md` or `militia-tables.md`, the expected Phase View or Resolution Preview behavior, important edge cases, and stable IDs of named behavior tests.

CI checks the catalog against collected test results: referenced tests must exist and pass; skipped, todo, missing, or failed tests never establish coverage. Check source fingerprints so a changed rules section requires catalog review. Fail for missing rule mappings, stale source references, or browser/Convex projection differences. A fingerprint or test link establishes traceability, not semantic completeness: review against the full corpus establishes that every testable rule and its important cases have been identified.

During extraction, track known coverage gaps explicitly and require each step to preserve established coverage and cover the behavior it moves. Do not conceal gaps with skipped tests or claim an incomplete catalog is complete. Full reviewed rules coverage is a cutover prerequisite, as required by [Which module owns rules-derived phase projections?](https://github.com/AndreasUnunger/EverythingPath/issues/37). The existing audit and product-exception decisions determine the rule inventory and any authorized departures; this ticket does not resolve those decisions.

### Test surfaces and shared adapter contract

- Shared pure Rules Projection tests exercise rule outcomes and edge cases. Run representative domain fixtures through browser and Convex entry paths to detect mapping or projection divergence.
- Weekly Draft Workspace tests exercise semantic edits, Phase Views, readiness, pending/accepted/failed outcomes, and Confirmation through the external interface. They do not assert hook wiring or internal object-merging algorithms.
- Weekly Resolution tests retain Resolution Preview and authoritative change-plan assertions.
- Focused Convex integration tests cover document/domain mapping, authorization, accepted revisions, atomic writes, and the draft/history lifecycle rather than duplicating the full rule suite.
- UI tests cover formatting, explicit clearing, interaction, feedback, and presentation. Rule calculations belong in projection tests.

Define the persistence contract scenarios once and run them against factories for both the deterministic in-memory adapter and the production Convex adapter. The production adapter must exercise actual Convex persistence; mocking a successful mutation return is insufficient. Use an isolated test deployment for deployed adapter verification. Control delays, failures, retries, and delivery order through the test harness at the transport seam, without replacing server transaction behavior. Keep `convex-test` for focused transactional integration.

The common scenarios include disjoint stale edits accepted, same-target edits rejected, atomic multi-slot edits, action-detail edits rejected after action replacement, one revision per accepted semantic edit, idempotent retries, submission-order acknowledgement, monotonic responses, and rejection of delayed edits for closed drafts. Workspace scenarios additionally protect immediate local Phase View navigation while edits are pending, page-exit warnings, failure feedback, Confirmation waiting for earlier edits and pausing new local edits, exact reviewed-revision rejection, and edit-versus-Confirmation and simultaneous-Confirmation races. Browser mechanics are exercised through the Workspace/browser surface with each persistence adapter where applicable.

### Existing tests: retain behavior, replace implementation coupling

- Retain and expand `src/lib/week-advancement.test.ts` and relevant Weekly Resolution outcome tests. Assess their expected outcomes against the written rules and recorded product exceptions rather than preserving an existing defect.
- Retain and expand `convex/weekBoard.history.integration.test.ts` as a transactional integration foundation. Preserve meaningful authorization, preview/outcome, stale Confirmation, concurrent Confirmation, immutable-history, and atomic-failure cases. Adapt fixtures and assertions to the new lifecycle; legacy rollback mechanics are not a requirement to preserve.
- Replace `src/lib/week-board-mutation-harness.test.ts` incrementally. Its hand-built database and mocked authorization do not prove transaction rollback or access control. Move rule cases to pure module-interface tests and persistence cases to adapter contracts or Convex integration.
- Rewrite `use-week-board-controller.test.tsx`, `use-week-board-mutations.test.tsx`, and `week-board-controller-sync.test.ts` around Workspace and persistence outcomes. Preserve local navigation, explicit clears, pending-edit protection, ordering, acknowledgement, and draft isolation. Exact autosave calls, batching schedules, flush methods, and helper object shapes are internal details; preserve only their effects required by the accepted contract.
- Keep presentation and interaction tests at the UI surface. Move calculation assertions to the Rules Projection when those calculations move.

Delete an old test only once its meaningful scenario passes at its replacement interface, or a linked decision explicitly supersedes the old behavior. This avoids both lost coverage and a permanent duplicate suite around retired modules.

### Required two-player browser gate

Before merging extraction changes, require a small two-player browser suite against an isolated Convex deployment. Use separate authenticated browser contexts and verify shared edits, independent Phase Views, conflicting edits and visible recovery, Confirmation races, and delayed edits after week advancement. Assert eventual agreement and the resulting single successor draft/history outcome, not arbitrary sleeps or internal calls.

Detailed failure permutations remain in the controlled contract suite. The browser suite proves real subscription delivery and user interaction. Runner setup, isolated deployment setup/cleanup, test identities, and CI wiring are required implementation prerequisites: the inspected repository currently has Vitest and `convex-test`, but no browser runner or `.github` workflow directory.

### Extraction and cutover gates

Every extraction preserves the established behavioral and multiplayer gates and adds coverage for its moved behavior. The extraction-order decision must place the required test infrastructure before steps that rely on it.

Cutover rehearsal must verify the preservation and reset contract from [How can the Weekly Draft contract migrate live campaign data safely?](https://github.com/AndreasUnunger/EverythingPath/issues/52): preserved authoritative campaign state and week context/carry metadata; exactly one fresh draft; empty unfinished choices and new history; restartable initialization without duplicate drafts or effects; no unintended Upkeep, queued-effect application, or week advancement; server-side rejection of legacy writes; and recovery to the old implementation/data before editing reopens. Exercise new edits and Confirmation in isolation, not against production campaign state as a test.

No old-client compatibility conversion or history reconstruction suite is required by the paused-cutover decision. After reopening, restoring an old backup is not automatic rollback.

### Scope

This records a planning decision only. No test infrastructure, application code, deployment, or production data was changed. The remaining audit, product-exception, and extraction-order questions already have tickets; no new fog or decision ticket was exposed.
