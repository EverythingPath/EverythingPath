# Party batch party-data-2: Arcane Pool, the PZO9491 hold, PZO9067 and Bloodline Arcana

Reviewed by **Sol (AI curator) for the owner**, 2026-11-14.

Four causes kept characters 5, 8 and 9 out of the party release, and none needed an owner answer (party measure of 2026-11-14, items K1, K2, K3 and K6). The batch takes #539's number, the lowest owning curation issue among its keys (Snowball #539, Weapon Training #625, Arcane Pool #640; Bloodline Arcana has no key of its own), as [class-abilities-party-608](class-abilities-party-608.md) took #608's.

PRD capture `prd-2026-10-20`, PCGen `25523dbc`, pf1 v11.11. No book PDFs; Archives of Nethys not used.

## K1. Arcane Pool (Magus), character 8: admitted

`pf1/mpe3JHJMINddqLWr` was held on a false #227 scripted match: besides its own row (`um_abilities_class.lst:40`, `KEY:Magus ~ Arcane Pool`) the matcher read seven archetypes' replacement pools named Arcane Pool (Skirnir, Esoteric, Greensting Slayer, Eldritch Archer, Puppetmaster, Armored Battlemage and Iron-Ring Striker, the last in the Martial Arts Handbook), so it required PZO9493, which has no reviewed notice, and the Magus was omitted with it.

It now has a confirmed, content-bound Attribution Assessment in [#640's inventory](class-abilities-640.md), in the class-feature launch-subset form of the precedent:

- **Body:** the Ultimate Magic text word for word, PRD `ultimateMagic/spellcasters/magus.html:395-398` (heading aside; the PRD's links read as their labels); table `:367`. PCGen `um_abilities_class.lst:40` states the same rules, with the pool `max(floor(MagusArcanePoolLVL/2),1)+INT` and the bonus `min(1+((MagusArcanePoolLVL-1)/4),5)`, as Foundry's `uses.maxFormula` and the body do. Granted at Magus 1: Foundry `magus.xZLcyrEKYZoJPS2k.yaml:58-59`, PCGen `um_abilities_globalvar.lst:10`.
- **Notices:** PZO1117 (the Magus's book, as for Magus Arcana) and PZO1131 (the record's action keeps `activation.unchained`); both reviewed, no hold. The archetypes' books aren't required: none of their rules is in this body.
- **Records:** a checked `description` record with `outputs: []` (the body sits in other batches' fixtures, so no Note), the assessment, evidence `class-abilities-640-mpe3JHJMINddqLWr`, the inventory candidate with `currentBinding`, and the entry in `tests/fixtures/class-abilities-640/binding-preview.json`. Outstanding (never holds): the pool, the enhancement and the properties, and the launch row's recorded-choice mechanism, owner #640.
- **Recorded, not resolved:** Foundry's record imports no sources (importer gap, reported).

## K2. Weapon Training, character 9: the PZO9491 hold retired

`class-abilities-625-owner-owed-PZO9491` held Weapon Training for "no Registry record and no reviewed Section 15 text". Since party-admission-a (`227638e2`, 2026-11-12) the reviewed pf1-content line `pf1-content/notice/be3193ca…` ("Pathfinder Player Companion: Heroes from the Fringe", `OGL.txt:388`) carries the alias PZO9491, so the hold no longer holds. As #596 run B retired the PZO9410 and PZO9481 holds, the requirement row reads `existing-reviewed`, the items move to `onlyAliasReviewedBooks`, `droppedHolds` records the drop, the evidence, the assessment's rationale and evidence fingerprint and `currentBinding` follow, and the `retained-hold` exception in `attribution-227.json` keeps only `-owner-owed-PZO9493`. Weapon Training and the Fighter stay held and omitted on PZO9493, the owner's.

## K3. Snowball, characters 5 and 8: PZO9067, admitted

The owner's 2026-10-31 decision adds "the books outside the #716 crosswalk whose PCGen `OGL.txt` carries their own Section 15 line" ([curation.md](curation.md#cleared-holds)). Reign of Winter part 1 (`adventure_path/reign_of_winter/ap67`) is outside both crosswalks and its `OGL.txt:49` is its own line: "Pathfinder Adventure Path #67: The Snows of Summer Copyright 2013, Paizo Publishing, LLC; Author: Neil Spicer." It was left out only because its code isn't an automatic title match (PCGen "Part 1:", Foundry "#1:").

As for Ironfang Invasion chapter 2 (PZO90116): one `pcgen-notice-books.json` row with a reviewed code (drafted rationale: the `.pcc`'s KEY "Pathfinder Adventure Path #67", SOURCESHORT AP67 and date match Foundry's PZO9067 "Reign of Winter #1: The Snows of Summer", 2013-02-01), one own-line alias in `section15-inputs-716.json`, the `.pcc` and `OGL.txt` in the shared store, and `section15-match.ts` rerun, which drafted the confirmation as `matched` and `pcgen:PZO9067` as `unreviewed`. Recorded, not resolved: the `.pcc`'s SOURCEWEB product (`btpy8w7d`) isn't Foundry's url (`btpy8ubg`).

The record step then checked `section15-confirmation PZO9067` on a captured review (run `t3-review-8a163712…`, receipt in `review-receipts.json`, report under `scripts/catalog/review-reports/`), which made `pcgen:PZO9067` reviewed. Snowball is admitted; the test also shows it held on PZO9067 while the confirmation is drafted. The `pcgen-notice-books.json` code row stays drafted, as PZO90116's does, so the #227 matcher still gives the folder no book.

## K6. Bloodline Arcana, character 5: matched

The sheet's word has no record: Foundry folds the arcana into the Efreeti Bloodline (`efreeti-bloodline.Ce5bdKql2WZR8AsL.yaml`, its "Bloodline Arcana:" paragraph), which character 5 already has. The `unmatched` entry is removed and the match recorded as the note of the bloodline's entry in `party-builds.json`; an exception would claim the catalog lacks it. The scope's builds hash moves; its rows and edges don't.

## Labels

Arcane Pool and the Magus read **unverified** ("unproven mechanism"; "structure not verified"): the sheet calculates none of the pool. Extra Arcane Pool, admitted with them, is **unverified** too, and outside the launch inventory. Snowball, now admitted, reads **unverified**, outside the launch inventory. Weapon Training stays held. Efreeti Bloodline is unchanged (unverified).

## Preservation

- Shared files gain only this batch's rows: `reviewed-curation.json` 1 record, `attribution-assessments.json` 1 assessment and Weapon Training's rationale and evidence fingerprint, `attribution-evidence.json` 1 entry and Weapon Training's, `section15-registry.json` `pcgen:PZO9067` (reviewed by the record step), `section15-confirmations-716.json` the PZO9067 confirmation (checked by it) and `review-receipts.json` its receipt. No `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change.
- **Full-corpus `catalog:preview --pcgen` before and after**, 23,655 entries and 538 resources. No entry changes. Arcane Pool, the Magus and Extra Arcane Pool (`pf1/3lfNiysSNv1ahV4F`, omitted on Arcane Pool) become admitted; Weapon Training and its three increments keep their hold with the PZO9493 reason alone. No admitted row loses admission: 18,659 / 5,313 / 152 / 784 become 18,662 admitted, 5,312 held, 150 omitted and 784 failures. Curation records unchanged (2,985 checked, 697 missing).
- **After the record step**, against the prep commit's preview (which reproduces those totals): no entry changes and no admission is lost. The 13 rows held only on "lacks reviewed notices: PZO9067" become admitted, the checked block counting for every candidate of its book: Snowball, Flurry of Snowballs, Ice Spears, Irriseni Mirror Sight and nine pf1-content items of the volume. 18,675 admitted, 5,299 held, 150 omitted, 784 failures.
- **Party build:** 53 of 955 rows and names failed before the batch, 50 of 954 at the prep commit and 49 of 954 now. Character 5 fails 1 row of 113 (2 at the prep commit), character 8 fails 4 of 102 (5), character 9 fails 5 of 50 (5). Characters 3, 10 and 13 are served, as before.
- The calculation identity does not move (`catalog:pin`: `sha256:406caa62…`).

## Tests

[`party-data-539.test.ts`](../../tests/catalog/party-data-539.test.ts): Arcane Pool through the shared launch-subset checks, held on PZO9493 without its assessment and admitted with it, with the Magus closure (`tests/fixtures/party-data-539/dependents.json`); Weapon Training's gate reason and exception; PZO9067's row, checked confirmation and pinned line, and Snowball admitted on it, held while it is drafted; character 5's builds and the committed scope. `class-abilities-625`, `pcgen-books`, `section15-match`, `schedule-admission` and `launch-document` name the new state.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `f2de0758`: **3** (pcgen 2, pf1 1).
<!-- /prep:shared-store-count -->
