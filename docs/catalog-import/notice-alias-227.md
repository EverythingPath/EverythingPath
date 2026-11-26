# Notice aliases: 37 same-title reviewed Registry lines (#227)

A notice batch (batch name `notice-alias-1`; discriminator 227, the owning issue: [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227) owns the Section 15 notice rule). 37 books have a Section 15 notice that is already a reviewed pf1-content line in the Section 15 Registry, titled as Foundry names the book, but the line was keyed by its text hash only, so the book's code read as missing and every row that requires it was held. This batch lists each code in its line's `aliases`, under the existing rule for [reviewed Registry aliases](curation.md) (`findRegistryAliasProblems`, [`registry-aliases.ts`](../../scripts/catalog/legal/registry-aliases.ts)), as party-admission-a did for five books. An alias is a reviewed identity: no notice text is created or edited.

Sources: Foundry PF1 v11.11 `module/registry/sources.mjs` (each code's name, type and date) and the committed Registry. Each record was found by trying every Registry record as the code's only alias: exactly one passes for each code, it is `reviewed`, it had no aliases, and no record named the code before.

## The aliases

Each record gains `aliases: [<code>]` and one provenance line, `Product-code alias <code> (notice-alias-1, 2026-11-16): …`, naming Foundry's name, type and date and how the title matches. The title is Foundry's name after its product line, except where noted.

| Codes                                                                                                                                              | Product line                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| PZO1136 Villain Codex, PZO1139 Book of the Damned, PZO1141 Planar Adventures                                                                       | none (core; the name alone)                                                       |
| PZO9210 Pathfinder Chronicles: Dungeon Denizens Revisited                                                                                          | none (Foundry's name carries it)                                                  |
| PZO9000-13E Wrath of the Righteous Player's Guide                                                                                                  | none (player's guide), apostrophe typography aside                                |
| PZO9484 Antihero's Handbook, PZO9485, PZO9486, PZO9487, PZO9490, PZO9492 Plane-Hopper's Handbook                                                   | Pathfinder Player Companion (PZO9484 and PZO9492 with the typographic apostrophe) |
| PZO9403, PZO9408                                                                                                                                   | Pathfinder Companion                                                              |
| PZO9227, 9235, 9238, 9244, 9246, 9257, 9261, 9265, 9270, 9273, 9274, 9275, 9276, 9283, 9284, 9285, 9286, 9287, 9289, 9291, 9293, 9295, 9298, 92109 | Pathfinder Campaign Setting                                                       |

Every notice's first copyright year is the book's Foundry year.

## What moves

- **Attribution Assessments.** 462 notice fingerprints on 442 assessments are re-bound, each from the missing notice's fingerprint (461, on the 37 codes) or the record's previous fingerprint (1, an assessment that also binds Planar Adventures' line by its key) to the aliased record's. No other value changes.
- **PZO9235 (Pathfinder Society Field Guide)** is a #716 book. With the alias, `section15-match.ts` finds its Registry line by code (`titleMatch: code`, was `automatic`), so its confirmation, still `mismatch` (`own-line-missing`), is rewritten `drafted`, as PZO9268, 9443 and 9452 were. A mismatch never makes `pcgen:` notices count, so its rows rely on the Registry line and admit. Its re-check is the record step's.
- **Generated:** the notice authority and the authority's Registry binding (`catalog:launch-legal-authority --write`), the launch inventory (`catalog:launch-inventory --write`: eight notice rows verified, five of them required, so required launch failures fall from 96,218 to 96,188) and the verification projection (`--verify --write`). `attribution-227-matches.json` and the party scope are unchanged.
- **Admission** (full `--pcgen` preview against the base `2e64f6db`): 820 rows held only on batch books' notices are admitted and 7 dependents of them follow, 18,785 to 19,612. 19 more such rows now wait on other held rows (books outside the batch, a missing assessment). No admitted row is lost, and no row still holds on a batch book's notice.

## Tests

[`notice-alias-1.test.ts`](../../tests/catalog/notice-alias-1.test.ts) runs on the committed Registry and the pinned `sources.mjs`:

- The batch's provenance lines name exactly these 37 codes, each on its pinned record.
- Each record is reviewed pf1-content, aliased to its code alone, and passes the alias rule on its own; without the batch's alias it had none, and the code named no record. Each code reads as reviewed with no holds.
- Removing the batch's aliases changes the notice reading of exactly these 37 codes, of all Foundry books and Registry identifiers.
- The 462 assessment bindings of the batch's codes and records bind the aliased record, none the missing notice.

The family tests name the new state: `launch-document.test.ts` the inventory identity and failure count; the inherited-notice batches that reviewed these lines (`inherited-notices-265`, `-278`, `-280`, `-281`, `-282`, `-285`, `-289`, `-294`) allow a later product-code alias, as party-admission-a's did; and [`aliased-notice-admissions.ts`](../../tests/catalog/aliased-notice-admissions.ts) adds the two confirmed launch rows the aliases admit, Disfiguring Touch (PZO1139, `spells-516`) and Jump (PZO9283, `spells-536`).

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `c58b2a7c`: **0**.
<!-- /prep:shared-store-count -->
