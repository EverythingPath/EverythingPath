# Party structures: the Scaled Fist's features (#679)

A #716 structure batch for the party (batch name `party-curation-4`; discriminator 679, the owning curation issue: [#679](https://github.com/AndreasUnunger/EverythingPath/issues/679) owns the monk Archetypes). The import emits the Scaled Fist monk archetype and its five owned features behind `--pcgen` since #716 E1, every row held on the structure gate. This batch writes the structure records for three of the five features, in `scripts/catalog/reviewed-curation.json` `structures`, written `drafted`. The orchestrator's record step checked all three on a captured review, run `t3-review-62af97b910787b6a6ddb8b72175cf414f43802ef88889962ea15eafd9a047f7c`, through a review receipt ([curation](curation.md#structure-records-716)).

Source: PCGen at `25523dbc` (`player_companion/legacy_of_dragons/lod_abilities_class.lst`). The PRD capture `prd-2026-10-20` has no page for Scaled Fist or Legacy of Dragons, so PCGen is the only source. Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `97106876` gives.

## The records

| Entry                                            | Fields                 | Settles           |
| ------------------------------------------------ | ---------------------- | ----------------- |
| `everythingpath/monk-scaled-fist-draconic-might` | `description` (`:277`) | its owned feature |
| `…-monk-scaled-fist-bonus-feats`                 | `description` (`:278`) | its owned feature |
| `…-monk-scaled-fist-draconic-mettle`             | `description` (`:279`) | its owned feature |

Each description is PCGen's DESC word for word: complete, with no tokens. No feature line carries a Product Identity flag.

- **Draconic Might** binds no modifier. PCGen swaps Wisdom for Charisma on the monk's AC bonus, the Stunning Fist and Quivering Palm DCs and the ki pool (`BONUS:VAR`, `:277`), but the monk's AC Bonus row (`pf1/4zVndIJ8NMWWzl1T`) and its increments convert no modifier: their formulas are `unsupported`. The sheet has no Wisdom bonus for a Charisma form to replace, and the mapper gives none. All four stay prose.
- **Bonus Feats** adds seven feats to the monk's bonus-feat list at 1st, 6th and 10th level. The monk's named list has no default slot ([README](README.md), "Bonus feat slots"), so the additions stay prose.
- **Draconic Mettle**'s +2 applies only against fear, paralysis and sleep effects, so it stays prose.

## Left to the owner

- **The archetype root** (`everythingpath/monk-scaled-fist`) is held on Product Identity: `DESCISPI:YES` (`:275`), owner decision 3. No record is written for it. Its `alters:bonus-feat` item stays open too.
- **Draconic Fury and Draconic Breath** (`:281`, `:282`): PCGen splits their text into fragments, one energy word for each energy type it tracks, and `%1` tokens (`MonkLVL/2`; `MonkLVL` and `10+MonkLVL/2+CHA`). No PRD page exists, so no allowed source gives a complete description. They have mechanics, so `noMechanics` doesn't fit. No record; both rows stay held on structure.

## What the sheet computes

Nothing new. No record gives a number. At Monk 1, Draconic Might and Bonus Feats apply as text; Draconic Mettle starts at Monk 3.

## After the record step

The record step checked the three records (run `t3-review-62af97b910787b6a6ddb8b72175cf414f43802ef88889962ea15eafd9a047f7c`). The three features pass their structure gate and are admitted under #227 on their declared book, PZO9470. They are not omitted behind the root. Unchanged: the root stays held on Product Identity, and Draconic Fury and Draconic Breath stay held on structure. All three are the owner's.

## Tests

[`party-structures-679.test.ts`](../../tests/catalog/party-structures-679.test.ts) runs on the pinned tree:

- The committed records have exactly these fields, items and hashes. No record exists for the root, Fury or Breath.
- As committed, checked, the three gates pass, the records apply (none invalid) and the rows are admitted on PZO9470. The rows keep `modifiers: []`. Fury and Breath stay held on structure, and the root on Product Identity.
- The committed records carry the record step's receipt. Drafted in memory, all five features are held on structure and the root on Product Identity. This is the only case that depends on the records' status.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `ce81c7ba`: **0**.
<!-- /prep:shared-store-count -->
