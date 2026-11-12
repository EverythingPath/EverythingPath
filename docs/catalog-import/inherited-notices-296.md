# Notice corrections and named gaps: #296

Reviewed **2026-10-13** by **Opus (AI curator) for the owner**; the Ultimate Combat correction was applied on 2026-10-14, after [#749](https://github.com/AndreasUnunger/EverythingPath/issues/749) replaced the whole-file preservation freezes that blocked it. [Ticket #296](https://github.com/AndreasUnunger/EverythingPath/issues/296) asks for the notice corrections that [#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) and [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) settled, as amended by [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698). The evidence is [`scripts/catalog/legal/inherited-notices-296.json`](../../scripts/catalog/legal/inherited-notices-296.json): source lines and hashes, the PRD comparison, both reviewed records, the content each touches, every re-bound assessment by batch, and the holds.

## Dispositions

| Item                                                             | Disposition                                                                                                                                              | Hold                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Ultimate Combat authors (`PZO1118`)                              | Corrected and applied: new Registry record from PRD line 387. pf1-content `OGL.txt:478–479` carry Ultimate Magic's authors (`OGL.txt:484`, PRD line 385) | `notice-296-ultimate-combat-author-defect`      |
| AoN Occult Mysteries block (`PZO9269`)                           | Verified; nothing to correct. The Registry uses the book's own line (`OGL.txt:290`), never AoN's Numeria block (`OGL.txt:288`). Left unchanged           | existing 8 `PZO9269` complete-chain holds       |
| Kingmaker Player's Guide (`PZO9000-6E`)                          | Not transcribed: no copy of the free PDF                                                                                                                 | `notice-296-free-pdf-untranscribed-PZO9000-6E`  |
| Serpent's Skull Player's Guide (`PZO9000-7E`)                    | Not transcribed: no copy of the free PDF                                                                                                                 | `notice-296-free-pdf-untranscribed-PZO9000-7E`  |
| We Be Goblins! (`PZO9500-5`)                                     | Not transcribed: no copy of the free PDF                                                                                                                 | `notice-296-free-pdf-untranscribed-PZO9500-5`   |
| Pathfinder Society Roleplaying Guild Guide (`PZOPSS0000E`)       | Not transcribed: no copy of the free PDF                                                                                                                 | `notice-296-free-pdf-untranscribed-PZOPSS0000E` |
| Dynamite, Thornkeep, PFS #4-12, Horror Realms, Shattered Star #4 | Kept unchanged (`known-notice-holds.json`)                                                                                                               | existing                                        |

## Notable cases

- **Content holds cleared: none.** In before/after full-corpus previews, 617 held candidates require `PZO1118`. The correction takes it out of all 617 candidates' missing notices, and 229 have no missing notice left. Every candidate stays held by its unresolved or missing assessment and its batch's `PZO1118` complete-chain hold (66 registrations). Admitted rows (86), failures and required notices (`PZO1110`) are unchanged.
- **Re-bound assessments: 519**, all unresolved, across 66 batches (`feats-330` to `feats-366`, `spells-516` to `spells-546`), listed in `corrections[0].rebinding.byBatch`. `buildAssessmentBinding` ran over the full preview with the corrected Registry. Only `noticeFingerprints.PZO1118` changed, from the missing-notice value to the new record's fingerprint. Thirteen `spells-537`–`545` assessments already differed from a full-corpus content closure; their content, mapping and evidence fingerprints are unchanged.
- **Defect hold.** The two pf1-content lines and their #293 records stay verbatim. The dedicated hold keeps the known error enforced if the chain holds ever clear.
- **Occult Mysteries.** The `PZO9269` seed duplicates #280's `7da6fc0f…` text. That is left for #737. An alias would make the code resolve to nothing. The evidence keeps the seed promotion unapplied.
- **Evidence.** Paizo's PRD URL redirects (HTTP 301) to `legacy.aonprd.com`, and the file matches the bytes #294/#295 recorded. No other AoN page, no PCGen file and no PDF was used.

## Shared files

`section15-registry.json` +1 record. `attribution-assessments.json`: 519 `PZO1118` fingerprints. `held-notices.json`: +5 holds. `notice-reviews.json` and the legal README: the Ultimate Combat entry and sentence.

## Commands

Run on the final tree with `CI=true VITEST_MAX_WORKERS=1`, through the resource caps.

| Check                                           | Result                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm -s typecheck`                             | Pass                                                                                                                    |
| `pnpm -s lint`                                  | Pass                                                                                                                    |
| `pnpm -s check:initial-migration-writers`       | Pass; 183 registrations                                                                                                 |
| `pnpm catalog:pin`                              | Pass; `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`                                         |
| `pnpm catalog:format --check`                   | Pass                                                                                                                    |
| `pnpm catalog:notice-deps`                      | Pass; 43,989 dependencies, 6,689 candidates, 81 inventories, 0 gaps                                                     |
| Batch test and `notice-holds`                   | Pass; 11 tests                                                                                                          |
| `pnpm test tests/catalog` (16G scope)           | Pass; 173 files, 2,624 tests, 840 s                                                                                     |
| Full-corpus `catalog:preview`, before and after | Expected exit 1 both times: 86 admitted, 23,168 held, 4,684 existing failures; only `missingNotices` differs (617 rows) |
