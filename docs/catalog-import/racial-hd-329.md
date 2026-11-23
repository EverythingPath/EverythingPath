# Creature-type seed curation review: #329

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**, following [#329](https://github.com/AndreasUnunger/EverythingPath/issues/329), [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), the [Racial Hit Dice contract](../character-sheet/racial-hit-dice.md), and the [global import contract](../character-sheet/global-catalog-import.md).

The exact thirteen-key inventory contains **13 creature-type supporting resources held for attribution review and zero Catalog Entries**. There are zero supported/admitted, dependently omitted, wholly unsupported/prose-only, or excluded candidates. Each key has one disposition. The Foundry records have `type: class`, but they supply editable racial progression seeds, not selectable classes, races or advancing racial levels. A hold does not establish mechanics completeness. No admitted-resource demonstration is available; the isolated custom-race demonstration below proves the consuming behavior without accepting held content.

## Evidence and attribution

- System: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Content: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Exact inventory and per-key review](../../scripts/catalog/legal/racial-hd-329.json): pinned YAML paths, whole-file and raw-description SHA-256 hashes, source locations, descriptions, progression, proficiency and type-trait facts, raw references, notice requirements, holds and independent mechanics limitations.
- [Attribution evidence](../../src/lib/catalog/data/attribution-evidence.json) and [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json): 14 new evidence records and 13 unresolved assessments. Assessments bind the final imported resources, identity mapping, evidence and notice identities. Previous assessments and evidence remain unchanged.
- [Curation Overlay](../../scripts/catalog/reviewed-curation.json): three additional checked, exact-description bindings. Existing records, shared Situations, remaps and Item Ability policies are unchanged.

Twelve records have no source citation and keep empty player-facing `sources`. Their individual holds are `racial-hd-329-whole-content-<upstream-id>`: complete descriptions, structured data and linked-origin leads have no permitted comparison bounding their possible origins. Outsider alone cites `PZO1112`, p. 309. That citation is preserved, but does not prove the origin of its complete content. Its same whole-content hold also names the existing Bestiary chain hold, `notice-264-complete-chain-7b8bd4df6ed85ccfbf802a13d2060aec55ba16e32eccb6d7e4b3693c910b7e4c`.

The named notice identity is `pf1-content/notice/7b8bd4df6ed85ccfbf802a13d2060aec55ba16e32eccb6d7e4b3693c910b7e4c`, observed at pinned `OGL.txt` line 52. Upstream bibliographic metadata identifies the Bestiary title as a lead only; no runtime module is imported or copied. The isolated title notice does not establish a complete inherited book chain or a reviewed product-code alias. Required notice lists are explicitly incomplete: empty lists on unsourced records do not mean notice-free content. No Registry alias, notice text or permanent notice is added. No book PDFs are available, so complete-book comparison remains a named hold. Archives of Nethys was not used.

Supplement UUIDs are retained only in `unsupported.gameContent`. The importer neither materializes their definitions nor follows them in the assessment's imported-content closure. Their raw identities and complete source hashes are recorded in evidence; linked-origin comparison remains outstanding. This review does not invent an accepted transitive closure.

## Exact dispositions and supported seed facts

All rows are **Held: whole-content attribution unresolved**; Outsider additionally carries the Bestiary notice-chain hold. `F/R/W` are the seeded good saves; a dash means all three are poor. These are editable defaults, not a claim that every creature of that type must use them. The inventory links each value to its own pinned source.

| Exact key | Type | Hit Die | BAB | Good saves | Base ranks/HD | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `pf1/0jjH2XJVd6dzlaSm` | Fey | d6 | half | R/W | 6 | Held |
| `pf1/6Uh8PAjR3BE7dult` | Monstrous Humanoid | d10 | full | R/W | 4 | Held |
| `pf1/AbOSfjvKMqpNihdM` | Plant | d8 | three quarters | F | 2 | Held |
| `pf1/AjUleVwKSsSaDI4N` | Magical Beast | d10 | full | F/R | 2 | Held |
| `pf1/D1vugd9jeyAQrLVX` | Ooze | d8 | three quarters | — | 2 | Held |
| `pf1/H8FbMUps5Z0gQdvV` | Construct | d10 | full | — | 2 | Held |
| `pf1/S38eYYsK7pRhPbwg` | Humanoid | d8 | three quarters | R | 2 | Held |
| `pf1/WJqmmfXscPVpcISH` | Animal | d8 | three quarters | F/R | 2 | Held |
| `pf1/WiROthmRgcwDncDM` | Aberration | d8 | three quarters | W | 4 | Held |
| `pf1/X2WLdbFFedaah6VC` | Dragon | d12 | full | F/R/W | 6 | Held |
| `pf1/cV7yHt8i5YCV0ZTd` | Outsider | d10 | full | R/W | 6 | Held |
| `pf1/g3gX00gTvJU478ju` | Vermin | d8 | three quarters | F | 2 | Held |
| `pf1/mp1Zmbx0OAzSW4oW` | Undead | d8 | three quarters | W | 4 | Held |

## Mechanics, descriptions and remaining work

The bounded drafter finds **zero required notes, action conditionals or Item Abilities**. The separate description pass finds Construct, Outsider and Undead. All three are checked with explicit no-output rationales: their progression is already structured, while this supporting-resource contract does not automatically grant creature-type traits. Three concrete review diagnostics remain inspectable in unsupported curation data. All thirteen complete descriptions were also reviewed, including the ten that do not trigger the optional prose predicate. Required coverage passes, and the three checked descriptions have no unresolved-description records; that result does not erase the limitations below.

There are no selectable prerequisite clauses, shared-effect Sources or ordinary numerical Modifiers to invent. Base progression belongs to the resource's structural fields. No Situation-bearing output is added, so no local labels or shared Situation declarations are needed. Gear, companion-version inputs and level-20 class feature schedules are inapplicable to this batch.

- **Aberration:** the prose supplies a Knowledge skill chosen by the player, absent from structured `classSkills`. No particular Knowledge skill is inferred; the chosen skill can be entered in editable progression.
- **Humanoid and Outsider:** Humanoid has one good save, usually Reflex; Outsider has two, usually Reflex and Will, plus four theme-dependent class skills. These remain editable choices. Humanoid prose qualifies its class skills as applying without a character class, permits class-derived HD/ranks, and describes exchanging a single humanoid HD for class features. No automatic replacement or alternative progression is invented.
- **Proficiencies:** every resource's natural/simple/martial/mentioned-weapon and armor/shield clauses are recorded per key. Outsider's structured `weaponProf: [simple, martial]` remains inert game-content evidence rather than structured proficiencies. This is the importer gap tracked by [#720](https://github.com/AndreasUnunger/EverythingPath/issues/720), independently outstanding from attribution. Since #720 the Outsider resource carries `proficiencies: [{ category: 'simple' }, { category: 'martial' }]`, and every resource's class skills are runtime keys such as `skill.per`; this review's `mappedFacts` and `sourceProgression` follow them. Individual armor, weapon and Animal war-training/secondary-attack qualifications stay prose; the seed does not grant them automatically.
- **Construct:** bonus HP remains a manually entered race `hp` Modifier under the consuming contract. Its size formula is unmapped and contributes nothing. Its flattened list gives Fine/Diminutive/Tiny a dash, whereas the later HTML table gives each 10; that contradiction remains unresolved. No value or automatic default is selected.
- **Undead:** Cha-for-Con HP is manually supplied under the contract. The seed does not substitute Charisma for Constitution in Fortitude saves or special-ability DCs. Immunities, healing and resurrection exceptions remain prose.
- **Mindless creatures:** absent Intelligence is explicitly unsupported by the consuming contract, including the source caveats on Plant, Ooze, Construct, Vermin and Undead. Those uses do not change the disposition or intended scope of the entire seed.

Vision, breathing/eating/sleeping, immunity, resurrection and other type traits are source facts, not automatic Grants or blanket bonuses. Missing promised proficiency mapping is not relabeled as an attribution hold. Importer fixes remain with #719/#720; this batch changes no application or tooling code.

## Public behavior and isolated persistence evidence

[Focused catalog tests](../../tests/catalog/racial-hd-329.test.ts) use [byte-exact pinned fixtures](../../tests/fixtures/racial-hd-329/README.md) and verify every source/description hash, all thirteen mapped progressions, runtime seed parity, individual evidence, source metadata and held admission. With six base scores of 10 and three fixed racial HD, the public current/permanent projections produce Dragon BAB 3, saves 3/3/3 and 18 racial ranks; Fey BAB 1, saves 1/3/3 and 18 ranks; Construct BAB 3, saves 1/1/1 and 6 ranks. Each has character level 0, actual HD 3, two general feats and rank cap 3. Recorded racial HP is 7; no maximized or inferred HP is supplied. All thirteen types have independent expected-value rows.

[An isolated Convex test](../../convex/racialHd329.integration.test.ts) creates an authored Character-scoped race, selects it through the public API and records Dragon's seed with three fixed HD, racial HP 7 and Perception ranks 2. The existing Unspecified Class Level remains intact: character level 1, actual HD 4, BAB 3, base saves 3/3/3 and racial rank budget 18. The player then edits every progression field; the saved sheet preserves those edits and racial HP/ranks, and repeated saving does not reapply defaults. Client catalog-preview calculation exactly matches the authorized saved-sheet calculation. Another campaign member can edit/read it; an outsider is refused reads and writes. Incomplete Class Level HP remains unavailable rather than being inferred. No held resource is admitted, copied into a playable race, activated or published by this test.

## Commands and results

The bounded commands select exactly the ticket's thirteen keys. No checkout-verification override is used. Large reports and drafts are temporary local output, removed after review; the committed inventory, evidence and byte-exact fixtures retain the review evidence.

```sh
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
mkdir -p .scratch/curation-329
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/racial-hd-329.json', 'utf8'));
fs.writeFileSync('.scratch/curation-329/keys.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-329/keys.json --out .scratch/curation-329/drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-329/keys.json --records .scratch/curation-329/drafts/records.json --descriptions --out .scratch/curation-329/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-329/keys.json --records scripts/catalog/reviewed-curation.json --out .scratch/curation-329/reviewed-drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-329/keys.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-329/reviewed-prose
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-329/keys.json --out .scratch/curation-329/final-preview
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-329-checks/final-full-preview
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-329-checks/full-drafts
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/racial-hd-329.test.ts convex/racialHd329.integration.test.ts
pnpm test tests/catalog
pnpm test --maxWorkers=4
pnpm test tests/catalog/preview.test.ts --maxWorkers=1
pnpm test --maxWorkers=2
git diff --check
```

| Check | Observed result |
| --- | --- |
| Source verification | Both pinned commits/manifests verified |
| Initial bounded draft | Exit 0; no added required records |
| Separate prose pass | Exit 0; three description drafts, subsequently checked |
| Reviewed draft and prose resumes | Exit 0; 90 retained records, zero added/replaced; three checked descriptions |
| Bounded import inventory | All 13 accounted: 13 resources, zero entries/excluded/unassigned; bounded coverage complete |
| Bounded required curation | Pass: zero required/missing/stale/unresolved mechanics; three checked descriptions |
| Final bounded admission | Exit 0: zero admitted, 13 held, zero dependent omissions/exceptions/failures |
| Full import/admission | Exit 1: 23,037 entries, 538 resources, zero admitted, 23,184 held, 4,790 failures |
| Final full-artifact binding/admission reassessment | All 13 bindings current; all 13 held, zero batch failures; same 4,790 corpus failures |
| Full-corpus drafter | Exit 0: 3,774 records, 3,684 new drafts, zero replaced/missing; 770 unresolved mechanics outside the batch |
| `pnpm -s typecheck` | Pass |
| `pnpm -s lint` | Pass |
| `pnpm -s check:initial-migration-writers` | Pass: 168 registrations |
| `pnpm catalog:pin` | Pass: `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| Focused catalog and saved-sheet tests | Pass: two files, 16 tests; final run 5.50 seconds |
| `pnpm test tests/catalog` | Pass: 20 files, 338 tests; 30.86 seconds |
| Initial foreground full `pnpm test --maxWorkers=4` | Exit 1: 496 files and 6,247 tests passed; one existing preview-command test exceeded its five-second timeout; 585.55 seconds |
| Existing preview-command file in isolation | Pass: one file, 39 tests; 18.35 seconds; formerly timed-out case 1,277 ms |
| Final foreground full `pnpm test --maxWorkers=2` | Pass: 497 files, 6,248 tests; 599.68 seconds |
| `git diff --check` | Pass |

Full-corpus failures remain 3,684 missing required curation records outside this batch, 715 unaccounted inventory records and 391 structure/reference failures. Both before and after this review the total is 4,790. This batch has zero such failures in the full artifact as well as the bounded preview. Named holds do not themselves fail the gate; a passing bounded gate is not a passing whole-corpus release gate or proof of accepted attribution. The full drafter succeeds without a batch bound, but its new drafts are unreviewed scratch output, not additions to the shipping overlay.

Checking the three descriptions adds explicit unsupported review diagnostics to the resource content. An intermediate binding check caught the resulting fingerprint change. The assessments were refreshed against the final extraction, then independently verified. Humanoid's class-dependent qualifiers were also added to its evidence after the source sample. The full CLI had loaded the preceding evidence snapshot, so its complete artifact was reconstructed from the emitted reports, verified against its exact extraction fingerprint and reassessed through `assessCatalogAdmission` with the final reviewed inputs. All thirteen content, mapping, evidence and notice bindings matched; the final reassessment's counts are reported separately above. This independent current-input reassessment supplies the final full gate evidence; no additional full CLI run was performed after the binding refresh.

Final bounded fingerprints: extraction `0b0b0f783771797ae52499941b6cb20ad700ff26a217d43f777fac57b4ed58b9`; reviewed inputs `0a3dc8aed7efc76fd0611686d9b023c08e30f0b11a556aee63b81d0b133f7642`; legal resources `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`; admission-report SHA-256 `1b982b4bfb0ab0c90f3ed987c69b9602c3693560d4776172be94e74662eb9d7c`.

Final full extraction fingerprint `5325a7e509e93c9af7eb656411d957f64911061f60be161fc479394a38ec8d04`; final reassessed admission-report SHA-256 `bc4df1a6b1a4269ab0fbfd2c7404e23af658ff90e2d3600eee815f8a2bfeaa5a`. Reviewed-input and legal fingerprints equal the final bounded values.

The four-worker run failed only `tests/catalog/preview.test.ts:541`, which runs four CLI processes while verifying default output and preservation after invalid input. It took 5,106 ms against a 5,000 ms timeout. That same file passed in the completed catalog suite. No assertion failed in this batch's tests. Host load averages observed after the run were 9.23/21.32/17.23. Timing contention is an inference, not a demonstrated product defect. The isolated file passes all 39 tests, with that case taking 1,277 ms. The complete two-worker retry passes, with that case taking 4,010 ms. No timeout budgets, tests or application code were changed. Its final summary follows.

```text
Test Files  497 passed (497)
     Tests  6248 passed (6248)
  Start at  13:43:41
  Duration  599.68s
```

The start time is local Europe/Stockholm on 2026-10-07. The foreground process exited 0. No catalog data or test changes were made during this run; later changes only complete this report.

## Timing and review observations

The independent source reviewer sampled **all thirteen** candidates, all three checked description records, exact source/description hashes, the Bestiary notice-line hash, progression and proficiency facts, final evidence bindings, and the report's worked examples. No invented or unjustified numeric output, Sources or Situations were found. Humanoid qualifiers and its evidence consistency were corrected during review. Book-level attribution was not accepted by this sample.

The configured tools do not expose the requested Opus or Fable models; implementation and independent review used the inherited Sol model. The source/report sample therefore does not claim to be the prescribed Fable review. This is the remaining workflow limitation.

An interim lint run encountered the new sheet fixture before its imports were wired; final lint passes after implementation completion. The initial full run used four workers following #328; the timeout-only retry uses two. No tests are skipped or timeout budgets extended. Forced `rm` cleanup was rejected by the command guard; path-checked Python cleanup then removed only the two task scratch directories successfully. No application/tooling fixes, release publication, Git/GitHub mutations or changes to private/env files were made.

Approximate phase timing on 2026-10-07 (UTC; concurrent windows overlap):

| Phase | Window | Elapsed |
| --- | --- | --- |
| Initial brief, policy and consuming-contract review | Before the first clock reading at 11:23 | About 5 minutes |
| Source review, drafts, evidence/binding work and isolated tests | About 11:21–11:32 | About 11 minutes |
| Commands and validation, including both full-suite attempts | 11:23–11:54 | About 31 minutes |
| Report and independent source/results sample | 11:30–11:54 | About 24 minutes, including validation waits |
| Final report and scratch cleanup | 11:54–11:56 | About 2 minutes |

These overlapping windows must not be added; total elapsed work was about 38 minutes. The two full-suite attempts alone took 19.75 minutes. The scratch drafts, complete previews and validation logs were removed after their relevant evidence and results were recorded here. The 25 changed files contain only reviewed data, this report, exact-source fixtures and focused tests; all changes remain uncommitted.
