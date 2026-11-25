# Notice batch notice-ownline-1: ten books on their own Section 15 line

Reviewed by **Sol (AI curator) for the owner**, 2026-11-17.

The full-corpus `--pcgen` preview held 97 rows only because one book's notice was missing, though the pinned PCGen `OGL.txt` of each of those ten books carries the book's own Section 15 line. The owner's decision of 2026-10-31 counts such a line ([curation.md](curation.md#cleared-holds): "the books outside the #716 crosswalk whose PCGen `OGL.txt` carries their own Section 15 line"), so the ten books join `scripts/catalog/pcgen-notice-books.json`, as Reign of Winter part 1 (PZO9067) did in [party-data-539](party-data-539.md). The batch takes #328's number, the lowest owning curation issue among its rows (the races-328 batch's evidence on Bestiary 6's races).

PCGen `25523dbc`, pf1 v11.11 (`module/registry/sources.mjs`). No book PDFs; Archives of Nethys not used. No notice text is written: the `OGL.txt` and `.pcc` files are copied byte for byte into the pinned store, and the matcher ships each block as it stands.

## The books

Each own line is the block's one non-PCGen line whose title names the book, with the book's year. Its volume number is the code's number and the `.pcc`'s SOURCESHORT. The volumes name themselves by their Adventure Path title. Five of them (8, 9, 10, 16 and 17) use that title's earliest form, "Pathfinder <n>: <subtitle>".

| Code | Book (SOURCELONG) | Own line | Code match | Rows admitted |
|---|---|---|---|--:|
| PZO1137 | Bestiary 6 | `roleplaying_game/bestiary_6/OGL.txt:76` | automatic | 46 |
| PZO90115 | Ironfang Invasion, Chapter 1 - Trail of the Hunted | `ironfang_invasion/ap115/OGL.txt:57` | reviewed | 13 |
| PZO9061 | Shattered Star, Part 1 - Shards of Sin | `shattered_star/ap61/OGL.txt:57` | reviewed | 15 |
| PZO9055 | Skull and Shackles, Chapter 1 - The Wormwood Mutiny | `skull_and_shackles/ap55/OGL.txt:42` | reviewed | 8 |
| PZO90117 | Ironfang Invasion, Chapter 3 - Assault on Longshadow | `ironfang_invasion/ap117/OGL.txt:51` | reviewed | 3 |
| PZO9008 | Curse of the Crimson Throne, Chapter 2 - Seven Days to the Grave | `curse_of_the_crimson_throne/ap8/OGL.txt:39` | reviewed | 1 |
| PZO9009 | Curse of the Crimson Throne, Chapter 3 - Escape from Old Korvosa | `curse_of_the_crimson_throne/ap9/OGL.txt:45` | reviewed | 1 |
| PZO9010 | Curse of the Crimson Throne, Chapter 4: A History of Ashes | `curse_of_the_crimson_throne/ap10/OGL.txt:39` | reviewed | 2 |
| PZO9016 | Second Darkness, Chapter 4 - Endless Night | `second_darkness/ap16/OGL.txt:39` | reviewed | 1 |
| PZO9017 | Second Darkness, Chapter 5: A Memory of Darkness | `second_darkness/ap17/OGL.txt:39` | reviewed | 1 |

- **Codes.** Bestiary 6's code matches Foundry's book by name. Its Registry title is the unreviewed `PZO1137` seed, as Faiths of Purity's is. The nine volumes' codes are reviewed, as PZO9067's is, because PCGen writes "Chapter n - " or "Part n - " where Foundry writes "#n: ". Each rationale cites the `.pcc`'s SOURCELONG, KEY, SOURCESHORT, SOURCEWEB and SOURCEDATE against Foundry's name, url and date. The code rows stay drafted; the record step checked the confirmations.
- **Recorded, not resolved.** PZO9061's and PZO9055's SOURCEWEB product ids and SOURCEDATEs differ from Foundry's urls and dates; their paths name the same volume. ap55 and ap9 each have a `_pfs/_.pcc` inside the folder, not listed as a pack. ap10's chain line 35 reads "Open Game License v 1.0" and is shipped as it stands, as `pcgen:PZO1002-PGE`'s is.
- **Bestiary 6 is tied through `_bestiary_6.pcc`.** The space-named `_bestiary_6 _for_players.pcc` that the path schema refuses is not listed, and the schema is unchanged.
- **Own-line aliases.** `section15-inputs-716.json` gains the nine volumes' line titles. Bestiary 6 matches on its book title.
- `section15-match.ts`, rerun, drafted ten `matched` confirmations and their unreviewed `pcgen:<code>` records. No hold, held notice or #716 hold changes.

## The record step

The record step checked all ten confirmations on a captured review (run `t3-review-6ba04bb6164d511d5e55eee49e376e09797001a9dfb6b75687eaa3cc02a033b2`, receipts in `scripts/catalog/review-receipts.json`), which made each `pcgen:<code>` record reviewed: `section15-confirmation PZO1137`, `PZO9008`, `PZO9009`, `PZO9010`, `PZO90115`, `PZO90117`, `PZO9016`, `PZO9017`, `PZO9055` and `PZO9061`. The nine volumes' code rows are not among them and stay drafted, so the #227 matcher reads only Bestiary 6's folder.

**While drafted**, Bestiary 6's automatic code already gave the #227 matcher its `b6_abilities_class.lst` lines. The book reprints domains, subdomains and domain powers (its "Updated Version" block), so 13 class features admitted before the batch also required PZO1137 and were held on it: the Scalykind and Void domains, the Dark Tapestry, Dragon and Stars subdomains, and Chastisement, Dragonbreath, Feed on Fear, Intense Celebration, It Came from Beyond, The Stars are Right, Tyrannical Strike and Venomous Saliva. With the confirmation checked they are admitted again.

## What is admitted

- **Full-corpus `catalog:preview --pcgen` against the base `c58b2a7c`** (23,668 entries, 538 resources). No entry changes; `catalog.json`, `comparison.json`, `curation.json` and `unsupported.json` are byte-identical. 18,789 / 5,196 / 152 / 784 become 18,880 / 5,099 / 158 / 784 (admitted / held / dependent omissions / failures). Exactly the 97 rows held only on these notices change: 91 are admitted (per book in the table), and six become dependent omissions. The 13 class features are admitted, as on the base, and no row admitted on the base loses admission. Nineteen rows that also lack a book outside the batch stay held on that book alone.
- **The six dependent omissions** and what each waits on:
  - Munavri and its ability-score row wait on Munavri's racial traits, held on PZO9284 and PZO9289.
  - Yaddithian and its ability-score row wait on its Defensive Abilities trait, a broken-reference failure (an unresolved link), one of the corpus's 784.
  - Wereraptor-Kin (Aerieborn) waits on the Skinwalker race's ability-score row, and Change Shape (Skinwalker, Fly Speed) on Change Shape (Skinwalker - Aerieborn); both lead to rows held on PZO9439.
- **Party build:** 25 of 961 rows and names fail; characters 3, 4c, 10 and 13 are served. No failing row is on a batch book.
- **Regeneration:** the notice authority (the confirmations' and the Registry's hashes), the launch inventory (identity `604729db…` on `e669e401`; the optional notice rows of PZO1137 and PZO9055 are verified, and 96,188 outstanding is unchanged, as neither row is required), party scope (unchanged), the verification projection (5,947 rows, as on the base; Dwarf Caiman's notice evidence is verified, as notice/PZO9055 is) and the launch-document pin. `attribution-227-matches.json` is unchanged from the drafted state. The calculation identity does not move.

## What still waits after both notice batches

A preview with this batch over the sibling notice batch notice-alias-1 ([notice-alias-227.md](notice-alias-227.md), 37 aliased books; 19,719 / 4,250 / 168 / 784) admits 12 more rows that each lacked a book from both batches: ten of this batch's 19 and Munavri with its ability-score row. Of the 960 rows held on a book of either batch on the base, 39 still wait, for four causes:

- **A notice of a book outside both batches**: 16 rows are held on one directly (PZO9439, the Skinwalker heritages' book, 7; Gods and Magic, PZO9202, 4; one each on PZO90100, PZO9084, PZO9099, PZO9269 and PZO9216 with PZO9445 and PZO9536), and 16 are dependent omissions of a row held so.
- **A broken reference**: 4 dependent omissions, Reborn Samsaran (through Reborn Magic) and Yaddithian (through its Defensive Abilities trait), each with its ability-score row.
- **An association-only match**: 2 dependent omissions, Rimesoul and Mistsoul, which wait through the Undine race and its Water Domain on the Rivers and Flotsam subdomains, held because only their class association names a book.
- **A missing Attribution Assessment**: 1 dependent omission, Defoliant Shot (Siege), which waits on Defoliant.

## Tests

[`notice-ownline-1.test.ts`](../../tests/catalog/notice-ownline-1.test.ts): the ten rows and their `.pcc`, each confirmation's own line in the pinned `OGL.txt` (its hash and first eight words), checked with the record step's receipt, its `pcgen:` record reviewed, and the gate over the batch's rows and reference closure (`tests/fixtures/notice-ownline-328/entries.json`). As committed, the rows held only on these notices are admitted per book, the 13 class features with them, and no row is admitted on a book outside the batch. With the confirmations drafted in memory, every batch row and the 13 class features are held. `pcgen-books`, `section15-match` and `launch-document` name the new state. The inherited-notice tests' [`gate-resolved-notices.ts`](../../tests/catalog/gate-resolved-notices.ts) lists PZO1137 beside PZO9419 and PZO9416: the gate resolves it through the reviewed `pcgen:PZO1137` block while the legal page still lists the unreviewed seed, and `inherited-notices-270` expects its fixture held on no missing notice.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `e669e401`: **19** (pcgen 19).
<!-- /prep:shared-store-count -->
