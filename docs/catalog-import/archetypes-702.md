# Wizard Archetypes, batch 1: the Exploiter Wizard (#702)

The first #716 structure batch ([#702](https://github.com/AndreasUnunger/EverythingPath/issues/702), slice E2a). E1 emits the Exploiter Wizard and its two added features behind `--pcgen`, held on the structure gate ([README](README.md#pcgen-sources-716), "Import emission"). This batch writes the three structure records that settle that gate, in `scripts/catalog/reviewed-curation.json` `structures`, all `drafted`. Only the orchestrator's record step checks them through a review receipt ([curation](curation.md#structure-records-716)), so until then the committed rows stay held.

Sources: PCGen at `25523dbc` (`roleplaying_game/advanced_class_guide/acg_abilities_class.lst`), the PRD capture `prd-2026-10-20` (`advancedClassGuide/classOptions/wizard.html`, `advancedClassGuide/classes/arcanist.html`, `coreRulebook/classes/wizard.html`), Foundry pf1 v11.11 (`packs/class-abilities`), and the reviewed facts and pool decision in [`archetype-additions.ts`](../../scripts/catalog/pcgen/archetype-additions.ts) (#771C).

## Dispositions

| Key | Gate item it settles | Record | After the record step |
| --- | --- | --- | --- |
| `everythingpath/wizard-exploiter-wizard` | `uncheckedCasting` `casting:arcane-school` (binds `detail.casting`) | R1 | admitted under #227 (PZO1129) |
| `everythingpath/wizard-exploiter-wizard-arcane-reservoir` | its `ownedFeature` | R2 | admitted under #227 (PZO1129) |
| `everythingpath/wizard-exploiter-wizard-exploiter-exploit` | its `ownedFeature` | R3 | admitted under #227 (PZO1129) |

No holds. No new notice: the rows declare PZO1129, whose Section 15 hold the owner cleared on 2026-10-30 (`legal/notice-clearances.json`).

## The records

Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `dd9ee2e9` gives.

- **R1**, `structure everythingpath/wizard-exploiter-wizard [detail.casting] sha256:e58b36d0…89dc`: `detail.casting` = `{"extraSlots":{"remove":["school"]}}`. PCGen sets `FACT:Wizard_CF_ArcaneSchool|true` on the archetype (`:4052`) and its `.MOD` line (`:4704`); the PRD says "This ability replaces arcane school" (wizard.html:351). The specialist's additional slot is part of arcane school (coreRulebook/classes/wizard.html:394), so it goes with it. Nothing else about the wizard's casting changes.
- **R2**, `structure everythingpath/wizard-exploiter-wizard-arcane-reservoir [description] sha256:fd57edff…cc29`: `description` is wizard.html:350, word for word, without its heading. PCGen's DESC (`:4057`) keeps the unfilled tokens `%1` and `%2`. The maximum (3 + Wizard level) and the daily points (3 + 1/2 Wizard level) stay prose (facts `reservoir-maximum`, `reservoir-daily`).
- **R3**, `structure everythingpath/wizard-exploiter-wizard-exploiter-exploit [description, detail.picksByLevel] sha256:e6e56c05…b0a7`: `description` is wizard.html:351, word for word, without its heading and with its link as plain text (PCGen's `:4058` keeps `%1`–`%4`). `detail.picksByLevel` is five pool prompts, at classLevel 1, 5, 9, 13 and 17 ("at 1st level and every 4 levels thereafter", wizard.html:351; PCGen's `1+(WizardLVL-1)/4`), each `list: "Arcanist Exploit"`, `count: 1`, with the same 24 members.

**R3's members** are the 24 ordinary ACG exploits (arcanist.html:461-510; PCGen `:98-121`), in arcanist.html order, each the Foundry class ability of that name associated with the Arcanist and admitted on the base: Acid Jet `bDES4OvFrtuMmPsW`, Arcane Barrier `q7y6hIc0NEwjGTKG`, Arcane Weapon `8LTtHB6wiIh5tB6J`, Bloodline Development `h2HnbWEh7rlY0JcF`, Consume Magic Items `YoKXg3OTiARGNZyo`, Counterspell `IPJqsPrrMnudA70e`, Dimensional Slide `P17L09Wh6jFpIPWh`, Energy Shield `B1abP8HNMYf9SLdn`, Familiar (ARC) `YQgJJcgq11g7TBWP`, Flame Arc `gxiVBtQ9S1naEMJq`, Force Strike `MP8rPf56VvijFsQj`, Ice Missile `zfsU3oRTcd2mPFX1`, Item Crafting `aPV8b5DEOfJLtwLx`, Lightning Lance `giiZFEuN7c0s8UbA`, Metamagic Knowledge `z2fcXtp99PkuabS5`, Metamixing `kUjXL9ec9TGCoJYq`, Potent Magic `ByZBsqXi9uhbPSJn`, Quick Study (ARC) `bQIHXFmVTfQv6rD3`, School Understanding `k1OBZUPyNyodotBI`, See Magic `BQ0p8MFQV8FAlmQt`, Spell Disruption `1dZxb8Eii34a6YS4`, Spell Resistance (ARC) `CO1zRIeXTn6L5yQY`, Spell Tinkerer `lguuanLKWDVYPleV` and Swift Consume `c5anvABG4nXco4pn` (all `pf1/`). For Familiar and Spell Resistance the arcanist's records are the `(ARC)` ones: `pf1/j2nzWYfwgxmipOyz` is the rogue talent Familiar (classes Rogue, Rogue (Unchained), Ninja) and `pf1/8q8RNXP17DVDS6Y1` the oracle's Spell Resistance, and the launch inventory's exploit aliases bind the same two `(ARC)` keys (`launch-inventory-build.ts`). The pool takes no greater exploit (`:127-142`), no Blade Adept exploit (`:2398-2402`) and not White Mage's Fast Healing (`:2657`), as `archetype-additions.ts` decides.

## What the sheet computes

[`characterSheetExploiterWizard702.integration.test.ts`](../../convex/characterSheetExploiterWizard702.integration.test.ts) builds a Wizard 1 with the Exploiter through the public saved-sheet API from the settled release rows (the pinned tree, the records checked in memory, released and converted by the app's candidate conversion):

- Arcane Bond and Arcane School are dormant; the Exploiter Exploit is granted and active.
- The Wizard's spellcasting has no extra slot (`extraSlots: []`, `extra` 0 at every level), and the Exploiter's casting carries `extraSlots.remove: ["school"]`.
- Acid Jet is accepted at the exploit's 1st-level prompt and counts; Alter Enhancements (a greater exploit) and Scribe Scroll (no exploit) are refused with `outsidePool`, and nothing is saved.

**The slot question.** The dormant Arcane School drops no slot because it has none to drop: the imported Arcane School (`pf1/20JWTam2dn7jjZFV`) carries no Spellcasting fact, and no imported row grants the school slot, so a released Wizard 1 has no school slot with R1 or without it (the test's second case). R1 is the reviewed casting change itself. It removes a school slot that any other feature grants, and it settles the gate's casting item.

**Prose only:** the reservoir's maximum and daily points and the +1 caster level or DC spend; the exploits' effects and DCs; the energy-dice and arcanist-level defects (`archetype-additions.ts`, #771).

**Label:** admission gives the three rows no curation gap. A release would still label them unverified: they're outside the launch inventory, and the verification projection has no row for them (`labelDefinitions`, `release-verification.ts`).

## Tests

- [`archetypes-702.test.ts`](../../tests/catalog/archetypes-702.test.ts): the committed records' fields, items and hashes; with them checked in memory, the gate passes, all three apply and all three rows are admitted under #227, as are all 24 members; the members resolve through a release's `writeBatch` and identity allocation; the committed state is admitted only when all three are checked, else held on structure. That last case is the only one that depends on the records' status.
- [`pcgen-owner-emission.test.ts`](../../tests/catalog/pcgen-owner-emission.test.ts): its gate-state cases run with `structures: []`, and its test-only records replace the committed ones for their subjects. No assertion changed, so later structure batches don't edit it.

## Preservation

Previews on the base and with the three records checked in a scratch overlay (`--pcgen`): 18,604 → 18,607 admitted, 5,224 → 5,221 held, 170 dependent omissions and 910 failures before and after. Only the three Exploiter rows change: held on structure review → admitted under #227, declared book PZO1129. Every other key's state and reason is unchanged. The structure report then has 3 checked records applied, none invalid or stale, and 10 of 11 items and 18 of 20 owned features still held (the other four owners).

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `284c6cee`: **26** (pf1 26).
<!-- /prep:shared-store-count -->

The batch adds 26 files to the shared store: the 24 members' Foundry records, Alter Enhancements, and Magic Missile, which Force Strike links to. Dispel Magic and Detect Magic, which Counterspell, Spell Disruption and See Magic link to, were already on the base. The tree list is [`tests/fixtures/archetypes-702/data.ts`](../../tests/fixtures/archetypes-702/data.ts).
