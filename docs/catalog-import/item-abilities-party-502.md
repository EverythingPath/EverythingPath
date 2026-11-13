# Item Abilities for the party: Bane and Flaming

Reviewed by **Sol (AI curator) for the owner**, 2026-11-13.

This batch adds the curation records for the two Item Abilities the party's release needs: Bane for character 4 and Flaming for character 2. Without a record, an Item Ability is admitted but labelled unverified, and its body `{appliesTo: 'weapon'}` has no `bonusEquivalent`. The stored Item Ability needs one (`convex/schema.ts`, `itemAbilityDetailValidator`), so the candidate adapter refused both and stopped the party release in reconciliation. Bane is in the launch inventory's batch #502 (pf-special-qualities batch 2) and Flaming in #503 (batch 3); both batches' implementation owner is #764. The batch uses #502's number. It adds no assessment, evidence, hold or notice: both rows are already admitted under [the #227 rule](curation.md#the-227-admission-rule) on their declared book, PZO1123, and so is the governing PZO1110. Both books have reviewed Registry identities.

## Sources

| Key                            | Name    | Pinned body (pf1-content 11.4.0)                                                                                                                                                                                 | PCGen (`core_rulebook/cr_equipmods.lst`)                                                                                       | PRD                                                        |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `pf1-content/aaAmYJA3sBANIVeZ` | Bane    | `src/pf-special-qualities/Bane_aaAmYJA3sBANIVeZ.yaml` (PZO1123 p.136): L12-13 "Price +1 bonus"; L13-16 "+2 better than its actual bonus … an extra 2d6 points of damage against such foes"; L16-26 the foe table | L232: `PLUS:1`, "+2 enhancement bonus and deal +2d6 bonus damage against the chosen foe", `CHOOSE` creature types and subtypes | none: the capture `prd-2026-10-20` has no magic-item pages |
| `pf1-content/bcWTxWA8Yi0V3FGZ` | Flaming | `src/pf-special-qualities/Flaming_bcWTxWA8Yi0V3FGZ.yaml` (PZO1123 p.141): L12-13 "Price +1 bonus"; L13-16 "an extra 1d6 points of fire damage on a successful hit"                                               | L238: `PLUS:1`, "+1d6 fire damage"                                                                                             | none                                                       |

Each record also binds its seed in the pinned Weapon Enchant Conditional Modifiers helper: Bane's conditional `bnmukmzny3q5kkq8` (2d6, +2 enhancement on attack) and Flaming's `82a2c967wtlp9zil` (1d6 fire).

## Records

| Key     | Outputs                                                                      | Stays prose                                                   |
| ------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Bane    | `bonusEquivalent: 1`, `choice: 'creatureType'`, `foeEnhancement: 2`          | The extra 2d6 against the designated foe, as a Note on damage |
| Flaming | `bonusEquivalent: 1`, `damageDice: [{on: hit, dice: 1d6, damageType: fire}]` | "The fire does not harm the wielder." as a Note               |

- **Bane's foe.** The foe is the `ItemAbilityRef`'s choice. Until it is chosen, the ability contributes nothing. Once it is, the sheet adds the part's own enhancement +2 as an enhancement bonus on attack and damage, under the foe's Situation ([weapons and armor](../character-sheet/weapons-and-armor.md#item-abilities)).
- **Bane's 2d6.** The stored detail can hold a die under the chosen foe (`$choice`), but the overlay refuses a curated one: `parseCuration` rejects it as an unreviewed shared Situation, which #764 left open. So the die is a Note, with the body's two sentences joined so that it reads on its own, and the record's rationale names it.
- **Flaming's command word.** Flaming is a command-word ability, which the sheet counts as always on. The command sentences are therefore not Notes, as with Corrosive Burst.

**Labels.** Both rows now read **unverified**. They no longer carry the "no curation record" gap, but the verification projection (`campaign-mvp-v1.verification.json`) has no mechanism proof for either row, and a mechanism without a proof stays unverified. That is expected, not a defect.

## Preservation

- `reviewed-curation.json` gains exactly these two records (+76 lines, nothing removed). The only other shared data file change is the regenerated verification projection (`campaign-mvp-v1.verification.json`), which updates its derived fields for these two rows; no batch fixture copies either entry.
- Flaming's pinned body joins the shared store. The importer corpus `tests/fixtures/catalog/` holds a byte-identical copy, but the store loader doesn't read it.
- Full-corpus `catalog:preview --pcgen` before and after the records, on 23,655 entries: only these two entries change, and only their two admitted rows change, losing their "no curation record" gap. Admission stays at 18,647 admitted, 5,317 held, 160 dependent omissions and 784 failures. Required curation records go from 2,983 checked and 699 missing to 2,985 checked and 697 missing.
- No landed assessment is re-bound: no assessment's committed batch fixture holds either key (`cross-batch-bindings.test.ts`). The `protected-context.json` files that list them check only their recorded key union.
- The calculation identity does not move (`catalog:pin`).

## Tests

- [`item-abilities-party-502.test.ts`](../../tests/catalog/item-abilities-party-502.test.ts): the pinned bodies and helper by sha256; the two checked records and their seed bindings; the literal PCGen rows; the import of the pinned bodies without the records (no `bonusEquivalent`) and with them (the detail and Notes above); and, through the public resolver, a +1 longsword. With Flaming it attacks at +15 for 1d8+4 plus 1d6 fire. With Bane it gains nothing until the foe is chosen, nothing outside the foe's Situation, and +17 for 1d8+6 against the foe.
- [`itemAbilitiesParty502.integration.test.ts`](../../tests/catalog/itemAbilitiesParty502.integration.test.ts): the stored candidate adapter refuses both uncurated bodies, as at the base ("not supported by the prepared sheet resolver"), and accepts both curated ones with the detail and Notes above.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `8f2e14cc`: **1** (pf1-content 1).
<!-- /prep:shared-store-count -->
