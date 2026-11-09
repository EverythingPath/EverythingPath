# Companion features #507: pf1-content pf-companion-features batch 1

Reviewed by **Opus (AI curator) for the owner**, 2026-10-20.

Exactly the issue's 12 keys were reviewed, the whole pinned `pf-companion-features` pack of pf1-content 11.4.0: **6 admitted, 6 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 0 exclusions, 0 record-level 3.5 holds**. The pack holds the Animal Companion record and the eleven animal companion features it grants. The importer maps them as companion supporting resources (`detail.kind: companionFeature`), not playable Catalog Entries ([README](README.md), companion sources; [global import contract](../character-sheet/global-catalog-import.md)). None of the records cites a source.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/pf-companion-features-507.json) records, per key, the complete pinned body and inert fields with their source hash; the PCGen Core Rulebook rows and leads; the inherited-rule notices, the linked bodies and their books; the companion review (granting record, effective druid level, beneficiary, schedule and class fields); every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## Family rulings (first batch of the family)

This is the family's first batch, so these choices are proposed as the family's precedent for review. Rulings 2, 3 and 5 follow the #505 rulings Sol confirmed for the pf1 companion-features family.

1. **Core Rulebook origin from PCGen, not cited sources.** pf1-content companion features carry no `sources`, so the Core Rulebook origin comes from PCGen rows filed under `SOURCELONG:Core Rulebook`: `core_rulebook/cr_abilities_companion.lst`, `cr_companionmods.lst`, `cr_classes_companion.lst`, `cr_races_companion.lst` and `cr_skills.lst`. A feature is admitted under the owner's Core Rulebook policy (2026-10-13, #735) when its row states the same rule. A word-for-word row, or one differing only in "druid" against PCGen's "master", is a complete comparison. A formula row (Str/Dex, natural armor) supports the mechanic when it equals the imported formula and the body states nothing more. A body with rules that no permitted source states is held, even when its count matches (Bonus Tricks, Sol review 2026-10-20).
2. **Unchained action costs hold.** A record whose bound closure keeps Unchained action-cost metadata requires the held `PZO1131`. That covers Evasion through its own Use action, and Animal Companion Feats through Spring Attack and Combat Reflexes in its closure. The hold is `pf-companion-features-507-notice-PZO1131-complete-chain`, and it's registered.
3. **Statistics belong to the companion.** The animal companion progression (#325, `src/lib/character-sheet-companion-progression.ts`) calculates Hit Dice, BAB, saves, natural armor, the Str/Dex bonus, bonus tricks and the feat, skill and ability-increase budgets, and lists features by name. So Natural Armor Bonus, STR/DEX Bonus, Bonus Tricks and Ability Score Increase carry Notes only. Their imported changes (`nac`, `str`, `dex`, `bonusFeats`) stay unmapped, so nothing is applied twice.
4. **A situational bonus the progression doesn't compute is a Modifier.** Devotion's +4 morale bonus on Will saves against enchantment is curated as a Modifier on `save.will` under the shared `enchantment` Situation, whose wording matches the body exactly. It applies only while that Situation is selected.
5. **Master benefits stay Notes.** Link's +4 circumstance bonus on wild empathy and Handle Animal checks belongs to the master. Its context note record is an explicit covered/no-output (no Modifier on the companion's `skill.han`), and the description Note states the rule.
6. **Effective druid level is a progression fact, not a prerequisite.** Each feature records the level at which the Animal Companion's `classAssociations` grant it, checked against PCGen's `PREVARGTEQ:MasterLevel,<n>` gates (`cr_abilities_companion.lst:46`) and the #325 progression through level 20.
7. **A level conflict holds.** When the pinned level and PCGen's Core Rulebook gate disagree and no permitted source decides between them, the feature and the record that schedules it are held (`pf-companion-features-507-improved-evasion-level`).
8. **Reviewed Notes replace Foundry artifacts.** Inline rolls, worksheet fields ("Tricks selected") and "the number noted here" pointers to Foundry changes are restated from the evidence. Ability Score Increase's miscounting inline roll is left out (see Notable cases).
9. **#716 P7 does not overlap.** P7a models the master classes' companion-granting features (Druid Nature Bond as an option, the Hunter's Animal Companion, and the Hunter's own Bonus Tricks `pf1/VNAsksfmUCMQsoZE`). It doesn't model these companion features.

## Dispositions

| Key                            | Name                   | Effective druid level | Disposition                                                                                                                                                            |
| ------------------------------ | ---------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pf1-content/5uKoaeTitZUnfnQ1` | Devotion               | 6                     | admitted                                                                                                                                                               |
| `pf1-content/FLDY1YB8IHw4G4gV` | Improved Evasion       | 15 (PCGen 16)         | held: `pf-companion-features-507-improved-evasion-level`                                                                                                               |
| `pf1-content/HYLK9yCcU73xaVNS` | Ability Score Increase | 4                     | admitted                                                                                                                                                               |
| `pf1-content/I9aVgYTVbwwmdZYz` | Bonus Tricks           | 1                     | held: `pf-companion-features-507-whole-content-I9aVgYTVbwwmdZYz`                                                                                                       |
| `pf1-content/Jcth45jjTCvvGBUS` | Evasion                | 3                     | held: `PZO1131` unreviewed and held, `pf-companion-features-507-notice-PZO1131-complete-chain` (own Use action)                                                        |
| `pf1-content/ZaBFpK3HT49DAUpE` | Share Spells           | 1                     | admitted                                                                                                                                                               |
| `pf1-content/fZ8uC8TAnvzYp9YQ` | Multiattack            | 9                     | held: `pf-companion-features-507-broken-reference-fZ8uC8TAnvzYp9YQ` (gate failure) and `PZO1112`, `pf-companion-features-507-notice-PZO1112-complete-chain`            |
| `pf1-content/g6t6hQoc95ASlz7D` | Link                   | 1                     | admitted                                                                                                                                                               |
| `pf1-content/nWKp65a3AOFqJOs6` | STR/DEX Bonus          | 1                     | admitted                                                                                                                                                               |
| `pf1-content/oczJR5oLDOOxV8mk` | Animal Companion       | 1-20                  | held: `pf-companion-features-507-improved-evasion-level`                                                                                                               |
| `pf1-content/rSxgmcPwAAmFL4r9` | Natural Armor Bonus    | 1                     | admitted                                                                                                                                                               |
| `pf1-content/w8QhU9qZ4VXxO4Ij` | Animal Companion Feats | 1                     | held: `pf-companion-features-507-whole-content-w8QhU9qZ4VXxO4Ij`, `pf-companion-features-507-broken-reference-w8QhU9qZ4VXxO4Ij` (gate failure) and `PZO1131` (closure) |

Every record requires `PZO1110`; Evasion and Animal Companion Feats also require `PZO1131`, and Multiattack requires `PZO1112`. Both notice holds are registered in [`held-notices.json`](../../scripts/catalog/legal/held-notices.json).

## Notable cases

- **Bonus Tricks** is held (Sol review, 2026-10-20). PCGen's Core Rulebook rows support its count, 1 + one per 3 effective druid levels (`cr_companionmods.lst:8`), and the Animal Trick pool (`cr_abilities_companion.lst:50`). No permitted pinned source states its other rules: no training time or Handle Animal checks, no count against the normal tricks-known limit, and the druid's irrevocable selection. Its hold is `pf-companion-features-507-whole-content-I9aVgYTVbwwmdZYz`. Only its evidence and assessment changed in the fix; its content and mapping fingerprints are unchanged, and it was re-bound over the committed full-corpus fixture (its closure is the record alone).
- **Word-for-word rows.** Devotion and Multiattack equal their PCGen Core Rulebook DESC (`cr_abilities_companion.lst:54`, `:55`). Share Spells and Link (`:52`, `:51`) differ only where the body says "The druid"/"A druid" and the row says "The master"/"A master". The literal wording is recorded, not resolved.
- **Improved Evasion** states the rule of `:57` (the body omits "normally"). Its body's "If your effective druid level is at least 15" and the Animal Companion schedule say 15, but PCGen's Core Rulebook schedule (`:46`) says 16. No PRD page or book PDF decides it, so both records stay held. The #325 progression names Improved evasion from 15, as the pinned body does. The calculation is unchanged here.
- **Ability Score Increase.** The rule (+1 to one ability score for every 4 Hit Dice, at effective druid levels 4, 9, 14 and 20) matches PCGen's pool (`:53`) and the Hit Dice schedule. The body's inline count `ceil((round(level * 0.75) + 1) / 4)` uses ceil where floor is meant: it gives 1 at levels 1-3 and 2 from level 5. The reviewed Note leaves the count out, and the #325 budget counts correctly.
- **Evasion** uses the class Evasion wording ("This character ... she", `cr_abilities_class.lst:2857`), not the companion row's (`:56`). The rule is the same. Its own Use action keeps `activation.unchained` (passive).
- **Multiattack** links the feat as `@Compendium[pf-content.pf-feats.RmhtvELGu73iR8yh]`, but that record is `pf1/RmhtvELGu73iR8yh` in the pf1 feats pack, so the importer strips the link and the gate fails the entry as a broken reference. It grants the Bestiary feat (pinned record p.315; PCGen `core_essentials/ce_feats.lst:19`, `SOURCELONG:Bestiary`), so `PZO1112` is required. Its imported `bonusFeats +1` change is unconditional where the body isn't, but it is unmapped.
- **Animal Companion Feats** is a compilation, not the Core Rulebook list. Against PCGen's 29 Core Rulebook animal companion feats (`:227-255`) it omits Improved Natural Attack and Weapon Finesse and adds 15 pf1-content feats whose records cite no source. It also links Improved Natural Armor in the wrong pack (`pf-content.pf-feats.Item.n1wLrcwaqOSDqrOo`; the record is `pf1/n1wLrcwaqOSDqrOo`), which is a second broken reference. `catalog:notice-deps` prints one advisory warning for it (it links Improved Natural Armor without `PZO1112`). That's a linked option, not an inherited rule, and the record is held whole.
- **Animal Companion.** Its body (abilities by druid level, the animal type, the nine animal skills and six class skills) and its class fields (BAB 3/4, good Fortitude and Reflex, `customHD` 2-16 Hit Dice) match PCGen's companion class, companion mod, wolf race and skill rows. Its `classAssociations` are inert game content, not references, so its closure is the record alone.

## Importer and data gaps

- **Wrong-pack links (follow-up, no owning ticket).** pf1-content links `pf-content.pf-feats.<id>` for two records that live in the pf1 system feats pack. The minimal reproductions are `Multiattack_fZ8uC8TAnvzYp9YQ.yaml` (`@Compendium[pf-content.pf-feats.RmhtvELGu73iR8yh]`) and `Animal_Companion_Feats_w8QhU9qZ4VXxO4Ij.yaml` (`@UUID[Compendium.pf-content.pf-feats.Item.n1wLrcwaqOSDqrOo]`). Both are stripped as `description.link`, and the gate fails the entries. They aren't spell or journal links, so they're outside #738. Both are listed in `danglingCatalogLinks` (`tests/catalog/cross-batch-bindings.ts`), as #368's and #382's were.
- Ability Score Increase's inline roll miscounts (see above). It's upstream data, recorded and not changed.

No importer or shared-loader code changed, and no gap for #738 or #739 arose.

## Outstanding mechanics

- Link's +4 to the master's wild empathy and Handle Animal checks regarding the companion isn't applied: no Grant from a companion to its master exists.
- Multiattack's natural-attack condition, its bonus feat and its second attack at −5 aren't calculated.
- Choosing and recording bonus tricks, and the allowed-feat list, aren't enforced from these resources.
- Evasion and improved evasion are save outcomes, shown as Notes on `save.ref`.

These are calculation gaps, not attribution holds.

## Companion validation

The Animal Companion schedule (`classAssociations` at levels 1, 3, 4, 6, 9 and 15) was checked against PCGen's gates and against the #325 progression through effective druid level 20, along with its `customHD` and the imported formulas. At every level the progression's Hit Dice equal `round(level × 0.75) + 1`, its bonus tricks equal `floor(level / 3) + 1`, and its ability-increase budget equals the 4/9/14/20 count. Natural armor and Str/Dex equal `2 × floor(level / 3)` and `floor(level / 3)` on the wolf, and its named features equal the schedule's.

## Cross-batch bindings and protected records

A full-corpus closure scan found **no landed assessment whose content closure reaches a batch key**, so no earlier assessment is re-bound. Two earlier inventories cite batch records only as evidence, and neither fixture holds a copy. #351's Andoren Falconry cites Animal Companion as a governing body, and #356's Devotion against the Unnatural cites Devotion as inherited-rule source evidence. Animal Companion Feats' closure reaches 41 feats from the pf1 feats pack and from pf1-content feats batches, but that direction needs no re-binding. None of the in-flight batches (#424, #426, #394, #716 P7) has a key in these closures, and none of their closures reaches a batch key. `cross-batch-bindings.test.ts` passes.

## Binding

Assessments are bound with `buildAssessmentBinding` over a full-corpus `catalog:preview` of the merged overlay, the authority, so Animal Companion Feats' 41 linked feats are bound as the whole corpus has them. The committed [preview fixture](../../tests/fixtures/pf-companion-features-507/preview.json) holds the 12 resources and that closure. The batch test reproduces every binding from a clean shared-store tree plus that fixture: 12 bound, 0 mismatches.

## Tests

- [`pf-companion-features-507.test.ts`](../../tests/catalog/pf-companion-features-507.test.ts) checks:
  - dispositions, notices, the registered holds and the Unchained closure set by key;
  - pinned bodies, overlay records, literal PCGen rows and the feat-list difference;
  - the schedule, Hit Dice and table through level 20 against the public companion progression;
  - Devotion's +4 under its Situation, and the reviewed Notes with no other statistic changed;
  - re-extraction from a clean tree: the gate's 6 admitted, 4 held and 2 broken-reference failures, binding reproduction and invalidation;
  - batch ownership.
- [`pfCompanionFeatures507.integration.test.ts`](../../tests/catalog/pfCompanionFeatures507.integration.test.ts) builds an isolated saved druid 6 with a linked wolf companion. Both projections show 6 Hit Dice, natural armor 6 and the features Link, Share spells, Evasion and Devotion. The companion sheet's character-scoped copies of Devotion, Share Spells and Link show their reviewed Notes and Devotion's conditional +4 on Will. The client catalog preview matches, and an outsider is refused.

## Preservation and gates

The shared canonical files gain only this batch's entries, all additions: 16 curation records (12 description records and 4 context-note records), 12 assessments, 12 evidence entries and two notice holds. No earlier row changed. `tests/catalog/cross-batch-bindings.ts` gains the two dangling links. Line counts against the base `405a7368`, shared-store files omitted:

```text
 docs/catalog-import/pf-companion-features-507.md         | new
 scripts/catalog/legal/held-notices.json                  |   +20
 scripts/catalog/legal/pf-companion-features-507.json     | new, 3817 lines
 scripts/catalog/reviewed-curation.json                   |  +291
 src/lib/catalog/data/attribution-assessments.json        |  +222
 src/lib/catalog/data/attribution-evidence.json           |   +36
 tests/catalog/cross-batch-bindings.ts                    |   +10
 tests/catalog/pf-companion-features-507.test.ts          | new
 tests/catalog/pfCompanionFeatures507.integration.test.ts | new
 tests/fixtures/pf-companion-features-507/data.ts         | new
 tests/fixtures/pf-companion-features-507/preview.json    | new, 2191 lines
 tests/fixtures/pf-companion-features-507/sheet.ts        | new
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `1faadea6`: **16** (pcgen 5, pf1-content 11).
<!-- /prep:shared-store-count -->

The batch adds to the shared store 11 pinned pf-companion-features records (Devotion was already on the base) and five PCGen files: `cr_abilities_companion.lst`, `cr_classes_companion.lst`, `cr_companionmods.lst`, `cr_races_companion.lst` and `core_essentials/ce_feats.lst`. `cr_abilities_class.lst` and `cr_skills.lst` were already on the base.

The complete preview of the reviewed tree reported **101 admitted, 23,153 held, 2 dependent omissions and 2,444 failures**. The base reported 94, 23,160, 2 and 2,448: the difference is the seven features then admitted, and four failures fewer for the batch's required context-note records. The review fix holds Bonus Tricks, which changes only its assessment and evidence, not the catalog, so the gate's counts become 100 admitted and 23,154 held. The full preview was not rerun for the fix; the batch test reproduces the gate (6 admitted). No failure is added. The two batch keys among the failures are the broken references above, which also failed on the base. The batch's 12 resources and 41 closure entries in that preview equal the committed fixture. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                  | Result                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` and `--descriptions` (prose pass)                                                                        | pass; 4 required drafts (the context notes) and 5 prose drafts, all replaced by checked records; a rerun against the overlay: 4 required and 12 description records checked, 0 missing, 0 stale |
| `catalog:preview --candidates …`                                                                                                         | exit 1; the two broken references (bounded and full alike)                                                                                                                                      |
| Full `catalog:curate`                                                                                                                    | pass; 0 missing, none for this batch; 3 stale records on the base, no batch key; about 15 min including the memory queue                                                                        |
| Full `catalog:preview`                                                                                                                   | exit 1; 2,444 failures, 2 of them this batch's broken references; 7 batch resources admitted, 3 held before the review fix (6 and 4 after it); about 4 min                                      |
| Full bind (`buildAssessmentBinding` over the full preview)                                                                               | 12 bound; 0 mismatches against the clean-tree reconstruction                                                                                                                                    |
| `pnpm test` of this batch's two files, `notice-holds`, `pinned-sources`, `cross-batch-bindings` and `batch-ownership-sweep` (one worker) | pass; 6 files / 155 tests                                                                                                                                                                       |
| `pnpm -s typecheck`                                                                                                                      | pass (earlier runs failed on the integration test's Modifier typing, fixed and re-run)                                                                                                          |
| `pnpm -s lint`                                                                                                                           | pass                                                                                                                                                                                            |
| `pnpm -s check:initial-migration-writers`                                                                                                | pass; 185 registrations                                                                                                                                                                         |
| `pnpm catalog:pin`                                                                                                                       | pass; `sha256:005ef0b9…`                                                                                                                                                                        |
| `pnpm catalog:notice-deps`                                                                                                               | pass; 0 gaps; 39 advisory warnings, one for this batch (Animal Companion Feats links Improved Natural Armor without `PZO1112`; a linked option, record held whole)                              |
| `pnpm catalog:format --check`                                                                                                            | pass                                                                                                                                                                                            |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
