# Archetype and prestige class coverage without Archives of Nethys

Research for [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219) (#219), with notes from #224 and #241. Date of research: 2026-10-05.

#219 chose a one-off, very slow Archives of Nethys (AoN) collection of 119 prestige classes and about 1,318 archetypes. It runs only after the owner has contacted AoN (#254). This note answers: **if AoN declines, how big is the gap, and which open, licensed sources could fill it?** No source was scraped. Pages were read singly (see [Method and limits](#method-and-limits)). All counts are estimates unless said otherwise.

## Answer

- **Size of the target.** The AoN-derived `pf1e-archetypes` module (1,315 archetype items, 119 prestige classes) is a close proxy for AoN's own totals (about 1,318 and 119). It spreads them over about 100 books: 740 archetypes in the RPG hardcovers, 452 in Player Companions and 108 in Campaign Setting books. Prestige classes are concentrated in five books (*Adventurer's Guide* 25, *Paths of Prestige* 20, *Paths of the Righteous* 14, *Core Rulebook* 10, *Advanced Player's Guide* 6).
- **Paizo's own PRD covers only about a third of archetypes.** It is frozen at 2015-09-30 and holds roughly **448 archetypes and 17 prestige classes** (34% and 14%). Paizo has since handed the online rules to AoN.
- **PCGen's data is the best structured open source.** It adds about **656 archetypes and 63 prestige classes** that the PRD lacks (another 50% and 53%). Its repository is LGPL-2.1, each book carries the OGL and the Community Use notice, and it holds feature text, levels and page numbers. It stops around 2017, so it misses most 2017 to 2019 books.
- **Residual gap with PRD plus PCGen: about 210 archetypes (16%) and 32 prestige classes (27%)**, in about 50 books. They are mostly 2017 to 2019 Player Companions and Campaign Setting books, and 19 prestige classes from *Paths of Prestige* (2012). d20pfsrd (OGL, HTML only) very probably covers much of it; that is a spot check only (4 pages).
- **Not usable as a source:** PSRD-Data (no licence, frozen 2015) and the `pf1e-archetypes` module (GPL-3.0 wrapper, but its text is copied from AoN, so it moves the provenance question rather than answering it). Both are still useful as name and page checklists.

## What the target is

| Figure | Value | Source |
| --- | ---: | --- |
| Official prestige classes on AoN | 119 | [#219](https://github.com/AndreasUnunger/EverythingPath/issues/219) resolution |
| Official archetypes on AoN | about 1,318 | [#219](https://github.com/AndreasUnunger/EverythingPath/issues/219) resolution |
| `pf1e-archetypes` archetype items on `main` | 1,315 (1,310 with a source) | [repository at 92ddcb6](https://gitlab.com/tristangoucher/pf1e-archetypes/-/tree/92ddcb60027e3088e5afd0645183c031ec3e9bb4/src/pf-archetypes), counted by this research |
| `pf1e-archetypes` prestige class items on `main` | 119 (104 with a source) | [repository at 92ddcb6](https://gitlab.com/tristangoucher/pf1e-archetypes/-/tree/92ddcb60027e3088e5afd0645183c031ec3e9bb4/src/pf-prestige-classes), counted by this research |
| `pf1e-archetypes` README claim (release 11.0.1) | 1,268 archetypes, 119 prestige classes | [README](https://gitlab.com/tristangoucher/pf1e-archetypes/-/raw/main/README.md) |

The AoN index pages do not publish per-book counts: the [Sources page](https://aonprd.com/Sources.aspx) says a source's items load only when it is selected, and the [prestige class index](https://aonprd.com/PrestigeClasses.aspx) shows no source books (it lists about 170 entries, which include 3.5 and NPC material). Per-book counts below therefore come from the module's per-item `sources` field, which was copied from AoN (see [pf1e-archetypes module](#pf1e-archetypes-foundry-module)). The module is an estimate of AoN's per-book split:

- It records only the **first** source of each item, and 5 archetypes and 15 prestige classes have no source at all.
- Its own README warns that "it's possible we missed some".
- Cross-check, Fighter: the module has 66 archetypes, d20pfsrd lists 72 ([d20pfsrd Fighter page](https://www.d20pfsrd.com/classes/core-classes/fighter/archetypes/paizo-fighter-archetypes/)), and PCGen has about 60. Treat per-book counts as plus or minus 10%.

## Per-book table

How to read the table.

- **Book, Year.** Title and release date from the pf1 system's source registry ([`sources.mjs` at v11.11](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/module/registry/sources.mjs)). It is GPL code used here only as a lookup. The book title links to its Paizo product page where the registry has a URL (hardcovers only); for the rest the count's source is the data set below.
- **Arch., PrC.** Archetypes and prestige classes whose first listed source is that book, from the [`pf1e-archetypes` module at 92ddcb6](https://gitlab.com/tristangoucher/pf1e-archetypes/-/tree/92ddcb60027e3088e5afd0645183c031ec3e9bb4/src). Estimates.
- **PRD.** `yes` means the book is in Paizo's Reference Document, so its Open Game Content is available from Paizo's own site. `PrC` means only its prestige classes are in scope for the archetype column (the *Core Rulebook* has no archetypes). `yes*` means the book is listed in the PRD's Section 15 and index, but this research did not confirm archetype or prestige class pages for it. Source: [PRD Open Game License page](http://legacy.aonprd.com/openGameLicense.html) and [PRD index](http://legacy.aonprd.com/). The PRD content for the *Advanced Race Guide* (racial archetypes) was confirmed on [one page](http://legacy.aonprd.com/advancedRaceGuide/coreRaces/dwarves.html).
- **PCGen (arch / PrC).** Items found in PCGen's Pathfinder data by exact normalised name match, counted only for books outside the PRD. Source: [PCGen `data/pathfinder/paizo` at 25523db](https://github.com/PCGen/pcgen/tree/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo). Name matching ignores the class, so it can overstate coverage by a few items where one name serves two classes.
- **Residual (arch / PrC).** Items in neither the PRD nor PCGen. A residual of 1 or 2 in a book is often a name-normalisation miss rather than a true gap.

Totals appear under each table. Grand totals: 1,310 archetypes and 104 prestige classes with a source, plus 5 and 15 without (see [Unattributed items](#unattributed-items)).

### RPG line (hardcovers)

| Book | Year | Arch. | PrC | PRD | PCGen (arch / PrC) | Residual (arch / PrC) |
| --- | ---: | ---: | ---: | :---: | :---: | :---: |
| [Core Rulebook](https://paizo.com/products/btpy88yj) | 2009 |  | 10 | PrC | - / - | - / - |
| [Advanced Player's Guide](https://paizo.com/products/btpy8fo1) | 2010 | 82 | 6 | yes | - / - | - / - |
| [Ultimate Combat](https://paizo.com/products/btpy8mcz) | 2011 | 80 |  | yes | - / - | - / - |
| [Ultimate Magic](https://paizo.com/products/btpy8k8r) | 2011 | 53 |  | yes | - / - | - / - |
| [Advanced Race Guide](https://paizo.com/products/btpy8rv2) | 2012 | 71 |  | yes | - / - | - / - |
| [Monster Codex](https://paizo.com/products/btpy9926) | 2014 | 9 |  | yes* | - / - | - / - |
| [Advanced Class Guide](https://paizo.com/products/btpy978v) | 2015 | 105 |  | yes | - / - | - / - |
| [Occult Adventures](https://paizo.com/products/btpy9egu) | 2015 | 43 |  | yes | - / - | - / - |
| [Horror Adventures](https://paizo.com/products/btpy9n5a) | 2016 | 38 |  |  | 36 / - | 2 / - |
| [Ultimate Intrigue](https://paizo.com/products/btpy9j6p) | 2016 | 76 |  |  | 75 / - | 1 / - |
| [Villain Codex](https://paizo.com/products/btpy9oo7) | 2016 | 7 |  |  | - / - | 7 / - |
| [Adventurer's Guide](https://paizo.com/products/btpy9sjo) | 2017 | 39 | 25 |  | 38 / 25 | 1 / - |
| [Book of the Damned](https://paizo.com/products/btpy9tok) | 2017 |  | 3 |  | - / 2 | - / 1 |
| [Ultimate Wilderness](https://paizo.com/products/btpy9ujo) | 2017 | 125 |  |  | 124 / - | 1 / - |
| [Planar Adventures](https://paizo.com/products/btpya1am) | 2018 | 12 |  |  | - / - | 12 / - |
| **Subtotal (15 books)** | | **740** | **44** | PRD 443 / 16 | 273 / 27 | **24 / 1** |

### Campaign Setting

| Book | Year | Arch. | PrC | PRD | PCGen (arch / PrC) | Residual (arch / PrC) |
| --- | ---: | ---: | ---: | :---: | :---: | :---: |
| Pathfinder Chronicles: Guide to the River Kingdoms | 2010 | 1 |  |  | - / - | 1 / - |
| Inner Sea Magic | 2011 | 19 | 1 |  | 18 / 1 | 1 / - |
| Pathfinder Society Field Guide | 2011 | 7 |  |  | 7 / - | - / - |
| [The Inner Sea World Guide](https://paizo.com/products/btpy8ief) | 2011 |  | 2 |  | - / 2 | - / - |
| Paths of Prestige | 2012 |  | 20 |  | - / 1 | - / 19 |
| Chronicle of the Righteous | 2013 |  | 1 |  | - / 1 | - / - |
| Inner Sea Combat | 2014 | 20 | 2 |  | 19 / 2 | 1 / - |
| [Inner Sea Gods](https://paizo.com/products/btpy94wj) | 2014 |  | 3 |  | - / 3 | - / - |
| Occult Mysteries | 2014 |  | 1 |  | - / 1 | - / - |
| Technology Guide | 2014 | 5 | 1 | yes* | - / - | - / - |
| Inner Sea Monster Codex | 2015 | 2 |  |  | 1 / - | 1 / - |
| Occult Realms | 2015 | 1 |  |  | - / - | 1 / - |
| Horror Realms | 2016 | 3 |  |  | - / - | 3 / - |
| Inner Sea Intrigue | 2016 | 16 | 2 |  | 16 / 2 | - / - |
| Path of the Hellknight | 2016 | 2 |  |  | - / - | 2 / - |
| Planes of Power | 2016 | 2 |  |  | - / - | 2 / - |
| Aquatic Adventures | 2017 | 9 |  |  | 8 / - | 1 / - |
| Qadira, Jewel of the East | 2017 | 3 |  |  | - / - | 3 / - |
| Construct Handbook | 2018 | 11 |  |  | - / - | 11 / - |
| Distant Realms | 2018 | 5 |  |  | - / - | 5 / - |
| Inner Sea Taverns | 2018 | 2 |  |  | 2 / - | - / - |
| Concordance of Rivals | 2019 |  | 1 |  | - / - | - / 1 |
| **Subtotal (22 books)** | | **108** | **34** | PRD 5 / 1 | 71 / 13 | **32 / 20** |

### Player Companion

| Book | Year | Arch. | PrC | PRD | PCGen (arch / PrC) | Residual (arch / PrC) |
| --- | ---: | ---: | ---: | :---: | :---: | :---: |
| Elves of Golarion | 2008 |  | 1 |  | - / 1 | - / - |
| Qadira, Gateway to the East | 2009 |  | 1 |  | - / 1 | - / - |
| Inner Sea Primer | 2010 | 5 |  |  | - / - | 5 / - |
| Halflings of Golarion | 2011 |  | 1 |  | - / - | - / 1 |
| Dragon Empires Primer | 2012 | 4 |  |  | 4 / - | - / - |
| Knights of the Inner Sea | 2012 | 4 |  |  | 4 / - | - / - |
| Pirates of the Inner Sea | 2012 | 4 | 1 |  | 4 / 1 | - / - |
| Varisia, Birthplace of Legends | 2012 | 1 |  |  | 1 / - | - / - |
| Animal Archive | 2013 | 4 |  |  | 4 / - | - / - |
| Demon Hunter's Handbook | 2013 | 1 |  |  | 1 / - | - / - |
| Dragonslayer's Handbook | 2013 | 3 |  |  | 3 / - | - / - |
| Dungeoneer's Handbook | 2013 | 6 |  |  | 6 / - | - / - |
| Faiths & Philosophies | 2013 | 1 |  |  | 1 / - | - / - |
| Kobolds of Golarion | 2013 | 3 |  |  | 3 / - | - / - |
| Pathfinder Society Primer | 2013 |  | 1 |  | - / 1 | - / - |
| People of the North | 2013 | 1 |  |  | 1 / - | - / - |
| Advanced Class Origins | 2014 | 12 |  |  | 12 / - | - / - |
| Alchemy Manual | 2014 | 1 |  |  | 1 / - | - / - |
| Bastards of Golarion | 2014 | 2 |  |  | 2 / - | - / - |
| Champions of Balance | 2014 | 2 | 1 |  | 2 / 1 | - / - |
| Champions of Corruption | 2014 | 2 |  |  | 2 / - | - / - |
| Giant Hunter's Handbook | 2014 | 3 |  |  | 3 / - | - / - |
| People of the River | 2014 | 4 |  |  | 4 / - | - / - |
| People of the Sands | 2014 |  | 2 |  | - / 2 | - / - |
| People of the Stars | 2014 | 3 |  |  | 3 / - | - / - |
| Ranged Tactics Toolbox | 2014 | 4 |  |  | 4 / - | - / - |
| The Harrow Handbook | 2014 | 6 |  |  | 6 / - | - / - |
| Undead Slayer's Handbook | 2014 | 4 | 1 |  | 4 / 1 | - / - |
| Agents of Evil | 2015 | 3 |  |  | 3 / - | - / - |
| Black Markets | 2015 | 5 |  |  | 5 / - | - / - |
| Cohorts and Companions | 2015 | 7 |  |  | 7 / - | - / - |
| Dirty Tactics Toolbox | 2015 | 8 |  |  | 8 / - | - / - |
| Familiar Folio | 2015 | 13 |  |  | 12 / - | 1 / - |
| Heroes of the Streets | 2015 | 10 |  |  | 10 / - | - / - |
| Heroes of the Wild | 2015 | 1 |  |  | - / - | 1 / - |
| Melee Tactics Toolbox | 2015 | 4 |  |  | 4 / - | - / - |
| Monster Summoner's Handbook | 2015 | 7 |  |  | 7 / - | - / - |
| Occult Origins | 2015 | 10 |  |  | 10 / - | - / - |
| Weapon Master's Handbook | 2015 | 6 |  |  | 6 / - | - / - |
| Arcane Anthology | 2016 | 10 |  |  | 9 / - | 1 / - |
| Armor Master's Handbook | 2016 | 7 |  |  | 7 / - | - / - |
| Blood of Shadows | 2016 | 4 |  |  | 4 / - | - / - |
| Blood of the Beast | 2016 | 15 |  |  | 15 / - | - / - |
| Divine Anthology | 2016 | 3 |  |  | 2 / - | 1 / - |
| Haunted Heroes Handbook | 2016 | 10 |  |  | 9 / - | 1 / - |
| Legacy of Dragons | 2016 | 13 |  |  | 11 / - | 2 / - |
| Magic Tactics Toolbox | 2016 | 10 |  |  | 10 / - | - / - |
| Paths of the Righteous | 2016 |  | 14 |  | - / 14 | - / - |
| Spymaster's Handbook | 2016 | 2 |  |  | 2 / - | - / - |
| Antihero's Handbook | 2017 | 9 |  |  | - / - | 9 / - |
| Blood of the Coven | 2017 | 10 |  |  | - / - | 10 / - |
| Blood of the Sea | 2017 | 9 |  |  | - / - | 9 / - |
| Elemental Master's Handbook | 2017 | 9 | 1 |  | 9 / 1 | - / - |
| Healer's Handbook | 2017 | 16 |  |  | 15 / - | 1 / - |
| Heroes of the Darklands | 2017 | 12 |  |  | - / - | 12 / - |
| Heroes of the High Court | 2017 | 14 |  |  | 14 / - | - / - |
| Legacy of the First World | 2017 | 15 |  |  | 15 / - | - / - |
| Monster Hunter's Handbook | 2017 | 8 |  |  | 8 / - | - / - |
| People of the Wastes | 2017 | 15 |  |  | - / - | 15 / - |
| Potions & Poisons | 2017 | 11 |  |  | - / - | 11 / - |
| Psychic Anthology | 2017 | 10 |  |  | - / - | 10 / - |
| Blood of the Ancients | 2018 | 18 |  |  | - / - | 18 / - |
| Disciple's Doctrine | 2018 | 11 |  |  | 11 / - | - / - |
| Heroes from the Fringe | 2018 | 10 |  |  | - / - | 10 / - |
| Martial Arts Handbook | 2018 | 15 |  |  | 15 / - | - / - |
| Merchant's Manifest | 2018 | 4 |  |  | 3 / - | 1 / - |
| Plane-Hopper's Handbook | 2018 | 5 |  |  | - / - | 5 / - |
| Chronicle of Legends | 2019 |  | 1 |  | - / - | - / 1 |
| Heroes of Golarion | 2019 | 6 |  |  | 6 / - | - / - |
| Wilderness Origins | 2019 | 17 |  |  | - / - | 17 / - |
| **Subtotal (70 books)** | | **452** | **25** | PRD 0 / 0 | 312 / 23 | **140 / 2** |

### Adventure Path volumes and other title-only sources

| Book | Year | Arch. | PrC | PRD | PCGen (arch / PrC) | Residual (arch / PrC) |
| --- | ---: | ---: | ---: | :---: | :---: | :---: |
| [Carrion Crown #3: Broken Moon](https://paizo.com/products/btpy8g7c) | 2011 |  | 1 |  | - / - | - / 1 |
| [Reign of Winter #5: Rasputin Must Die!](https://paizo.com/products/btpy8wbv) | 2013 | 1 |  |  | - / - | 1 / - |
| [Giantslayer #5: Anvil of Fire](https://paizo.com/products/btpy98t7) | 2015 | 2 |  |  | - / - | 2 / - |
| [Tyrant's Grasp #1: The Dead Roads](https://paizo.com/products/btq01ws3) | 2019 | 3 |  |  | - / - | 3 / - |
| [Tyrant's Grasp #6: Midwives to Death](https://paizo.com/products/btq01zno) | 2019 | 2 |  |  | - / - | 2 / - |
| Pathfinder #124: City in the Deep | ? | 1 |  |  | - / - | 1 / - |
| Pathfinder #5: Sins of the Saviors | ? | 1 |  |  | - / - | 1 / - |
| **Subtotal (7 books)** | | **10** | **1** | PRD 0 / 0 | 0 / 0 | **10 / 1** |

### Unattributed items

The module gives no source for 5 archetypes and 15 prestige classes, so they are not in the tables. Of the prestige classes, 7 are found in PCGen. The 8 that are not (names only, sources not guessed): Umbral Court Agent, Spherewalker, Shackles Pirate, Ritualist, Mortal Usher, Justicar, Inheritor's Crusader and Feysworn. Their books need identifying before any transcription list is final. Four of the five unsourced archetypes are also absent from PCGen.

## Open, licensed sources

Summary, then one subsection per source.

| Source | Licence status | Machine-usable | Archetypes (est.) | Prestige classes (est.) | Verdict |
| --- | --- | --- | ---: | ---: | --- |
| Paizo PRD (legacy, now AoN-hosted) | OGL 1.0a, mechanics only | HTML, regular structure | about 448 | about 17 | Usable, partial |
| PCGen Pathfinder data | Repo LGPL-2.1; per-book OGL and Community Use notices | Plain-text `.lst`, structured | about 1,100 of 1,315 name-matched | about 87 of 119 | Best structured fallback |
| d20pfsrd | OGL 1.0a for all non-Product-Identity content | HTML only | probably most (4-page spot check) | not checked | Usable for late books, to be verified |
| PSRD-Data | None (GitHub reports no licence) | JSON and SQLite | about 221 | few | Ruled out |
| `pf1e-archetypes` module | GPL-3.0 repo; text copied from AoN | Foundry YAML, structured | 1,315 | 119 | Checklist only |
| Other datasets | None found with a clear licence | | | | |

### Paizo PRD and PFSRD

- **What it is.** Paizo's Reference Document. `paizo.com/pathfinderRPG/prd/` now answers `301` to [legacy.aonprd.com](http://legacy.aonprd.com/), whose banner says Paizo "has now partnered with Archives of Nethys to provide the online version of the Pathfinder RPG rules at pfrd.info". So the successor of the PRD is itself AoN-run. There is no separate "PFSRD" for 1e beyond this; the 2e SRD is not relevant.
- **Frozen.** The Section 15 list names about 20 Paizo books: the *Core Rulebook*, five Bestiaries, *GameMastery Guide*, *Advanced Player's Guide*, *Advanced Race Guide*, *Advanced Class Guide*, *Monster Codex*, *Mythic Adventures*, *NPC Codex*, *Occult Adventures*, *Pathfinder Unchained*, *Ultimate Magic*, *Ultimate Campaign*, *Ultimate Combat*, *Ultimate Equipment* and *Technology Guide*. Nothing is later than 2015. Source: [PRD Open Game License page](http://legacy.aonprd.com/openGameLicense.html). The index states the content includes errata "as of 9/30/2015" (per the page summary).
- **Licence text.** The page declares: "Except for material designated as Product Identity ..., the game mechanics of this Paizo Publishing game product are Open Game Content, as defined in the Open Game License version 1.0a". Section 6 of the OGL requires copying the exact Section 15 notices and Section 10 a copy of the licence, as #224 found.
- **Archetype-bearing books in the PRD:** *Advanced Player's Guide*, *Ultimate Magic*, *Ultimate Combat*, *Advanced Race Guide*, *Advanced Class Guide*, *Occult Adventures* and (unconfirmed) *Monster Codex* and *Technology Guide*. Prestige classes: *Core Rulebook*, *Advanced Player's Guide*, and (unconfirmed) *Technology Guide*. The RPG hardcovers after 2015 are not in it: *Ultimate Intrigue*, *Horror Adventures*, *Ultimate Wilderness*, *Adventurer's Guide*, *Villain Codex*, *Planar Adventures*, *Book of the Damned*.
- **Usability.** Static HTML with a consistent layout (class page, `Archetypes` heading, one subheading per archetype). It has no data download and no stated reuse terms beyond the OGL. Reading it in bulk would be scraping, which is a separate decision from this research.

### d20pfsrd

- **Terms (as published).** [Legal page](https://www.d20pfsrd.com/extras/legal/): "All content of this site not designated as Product Identity is declared Open Game Content as described in Section 1(d) of the Open Game License Version 1.0a." Product Identity is limited to d20pfsrd logos, company names, artwork, trade dress and graphic design. Artwork may not be used without written permission. The page states no limit on bulk reuse, no scraping clause and no site-specific terms of use; the footer links only an Open Gaming Network privacy policy. `robots.txt` returns `410 Gone`. This is a reading of the published text, not legal advice, and bulk reuse is not expressly addressed either way.
- **What the OGL still requires.** The site's Open Game Content is only as open as its sources. Paizo's own declaration covers mechanics, not Product Identity, so Section 15 notices for each source book would still be needed. #224 found d20pfsrd's Section 15 sheet covers 210 books.
- **Coverage evidence.** The Fighter archetype index has 72 Paizo entries. A search turned up pages for three archetypes (Aerochemist, Arcane Warden, Antiquarian) whose module source is *Blood of the Ancients* (2018) at d20pfsrd ([Arcane Warden](https://www.d20pfsrd.com/classes/core-classes/wizard/archetypes/paizo-wizard-archetypes/arcane-warden-wizard-archetype/), [Antiquarian](https://www.d20pfsrd.com/classes/hybrid-classes/investigator/archetypes/paizo-investigator-archetypes/antiquarian-investigator-archetype/), [Aerochemist](https://www.d20pfsrd.com/classes/base-classes/alchemist/archetypes/paizo-alchemist-archetypes/aerochemist-alchemist-archetype/)). So it covers at least some of the 2017 to 2019 books that PCGen lacks. Its completeness for the residual books was **not** measured.
- **Machine use.** HTML only. It mixes third-party material, so source attribution per page would be needed. Reuse would still be page-by-page reading, like AoN.

### PSRD-Data

- **Licence: none.** The [GitHub API](https://api.github.com/repos/devonjones/PSRD-Data) returns `license: null`; the repository has no LICENSE file in its root listing. Last push 2015-10-30. The README is not present at the root.
- **Content.** Directories per PRD book (core rulebook, APG, ARG, ACG, UC, UM, UCampaign, UE, Mythic Adventures, Monster Codex, NPC Codex, Technology Guide, GMG and four bestiaries), each with a `class_archetype` folder; the brief puts it at about 221 archetypes. It is derived from the same PRD, so it can only ever add what the PRD has, in a less usable licence position. Prose only.
- **Derivative.** [psrd-db](https://www.npmjs.com/package/psrd-db) on npm distils it and declares `OGL`, latest 1.0.3 (2022). It inherits the PRD's coverage limit.

### `pf1e-archetypes` Foundry module

- **Licence.** The repository's [LICENSE](https://gitlab.com/tristangoucher/pf1e-archetypes/-/raw/main/LICENSE) and `package.json` say GPL-3.0. The author cannot grant rights in Paizo's text. The repository's own [Legal.txt](https://gitlab.com/tristangoucher/pf1e-archetypes/-/blob/main/Legal.txt) says the content uses Paizo material "under Paizo's Community Use Policy" and that "We are expressly prohibited from charging you to use or access this content". It ships an `OGL.txt` with a Section 15 naming about 20 books, far fewer than the roughly 100 books it draws on.
- **Provenance.** The README says descriptions are "From AON", and [CREDITS](https://gitlab.com/tristangoucher/pf1e-archetypes/-/blob/main/CREDITS.md) says "JoshyNeurotic ... provided the database of archetypes". There is no record of any permission from AoN.
- **Currency.** Latest tagged release 11.0.1 on 2025-04-09 ([releases API](https://gitlab.com/api/v4/projects/tristangoucher%2Fpf1e-archetypes/releases)); `main` last changed 2026-01-02 and its changelog lists an unreleased or newer 12.0.0.
- **Shape.** Each archetype item has `associations.classes`, `sources` with product ID and page (1,310 of 1,315 have a page), prose, and `links.supplements` with a level per feature. Features were not given structured "replaces" fields (README: replaces are prose). So it saves transcription effort but needs the same curation as an AoN scrape.
- **Verdict.** Not an independent source. Using its text carries the AoN question with extra intermediaries. Its book, class, page and level columns are useful as a **coverage checklist** (names and page numbers are facts, which is how this note uses them).

### PCGen Pathfinder data

- **Licence.** The [repository licence](https://github.com/PCGen/pcgen/blob/master/LICENSE) is LGPL-2.1 (GitHub API: `LGPL-2.1`). Each book's `.pcc` carries `ISOGL:YES`, `COPYRIGHT:` lines naming the OGL, the SRD, the book and the PCGen data team, and an `INFOTEXT` quoting the Community Use Policy; each book folder also holds an `OGL.txt` ([example: APG](https://github.com/PCGen/pcgen/tree/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/advanced_players_guide)). That is the closest thing to a per-book Section 15 registry seed, but it is PCGen's text and needs the same verification #224 requires.
- **Product Identity is flagged.** About 2,500 data lines across 272 files carry `NAMEISPI:YES`, including 60 archetype lines, so some names are marked Product Identity (not OGL). An import must honour that or drop those names.
- **Coverage.** 1,257 archetype entries by book folder (1,221 distinct names), and 98 prestige classes. Book folders cover the RPG line through *Adventurer's Guide* and *Ultimate Wilderness* (2017), most Player Companions to 2016, and many Campaign Setting books. Missing are most of 2017 to 2019 and *Paths of Prestige*.
- **Shape.** Archetypes are `CATEGORY:Archetype` entries with class, `SOURCEPAGE`, full `DESC` text, prerequisites, and one linked ability entry per feature. "Replaces" and "alters" are in the feature text and in PCGen's own prerequisite logic, not as simple fields. The prestige classes have level-by-level formulas and `PRESKILL` / `PREABILITY` requirements. It is a decent seed, not a ready-made fit for the replaces-by-level model in #219.
- **Currency.** Cloned 2026-10-05; the HEAD commit is dated 2026-10-02. Whether the Paizo files themselves are still maintained was not checked.
- **Counts depend on a name match** between this data and the module, so they carry the error bars stated above.

### Other candidates

- **Archives of Nethys** itself: no download, no stated reuse terms in this research; [it moved to Paizo's Community Use Policy in July 2026](https://www.archivesofnethys.com/movingforward.html) (per #224). That is the planned source, not an open alternative.
- **Pf1-content and the pf1 Foundry system:** no archetypes or prestige classes (#219).
- **Fantasy Grounds "Class and Archetype Module", Roll20 compendium, Hero Lab, Pathbuilder:** proprietary or licence not stated; not evaluated further.
- A web search for a JSON or database export of Pathfinder 1e archetypes under a clear licence found nothing beyond the above. The search was a single pass, so absence is not proof.

## The gap

Definition. The gap is what is in neither the PRD nor PCGen (matched by name). Totals are estimates.

| Layer | Archetypes | Prestige classes |
| --- | ---: | ---: |
| Target (module, as AoN proxy) | 1,315 | 119 |
| In the PRD | about 448 | about 17 |
| Not in the PRD, found in PCGen | about 656 (+1 unsourced) | about 63 (+7 unsourced) |
| **Residual, with no open source except AoN** | **about 210 (16%)** | **about 32 (27%)** |

Where the residual sits, in books to transcribe from the owner's copies (or to verify against d20pfsrd):

| Group | Books (archetypes unless marked PrC) | Arch. | PrC |
| --- | --- | ---: | ---: |
| 2017 to 2019 Player Companions (14 books) | *Blood of the Ancients* 18, *Wilderness Origins* 17, *People of the Wastes* 15, *Heroes of the Darklands* 12, *Potions & Poisons* 11, *Psychic Anthology* 10, *Heroes from the Fringe* 10, *Blood of the Coven* 10, *Blood of the Sea* 9, *Antihero's Handbook* 9, *Plane-Hopper's Handbook* 5, *Merchant's Manifest* 1, *Healer's Handbook* 1; PrC: *Chronicle of Legends* 1 | 128 | 1 |
| 2010 to 2016 Player Companions (8 books) | *Inner Sea Primer* 5, *Legacy of Dragons* 2, *Heroes of the Wild* 1, *Familiar Folio* 1, *Divine Anthology* 1, *Arcane Anthology* 1, *Haunted Heroes Handbook* 1; PrC: *Halflings of Golarion* 1 | 12 | 1 |
| RPG hardcovers, 2016 to 2018 (7 books) | *Planar Adventures* 12, *Villain Codex* 7, *Horror Adventures* 2, *Ultimate Wilderness* 1, *Ultimate Intrigue* 1, *Adventurer's Guide* 1; PrC: *Book of the Damned* 1 | 24 | 1 |
| Campaign Setting (14 books) | *Construct Handbook* 11, *Distant Realms* 5, *Qadira, Jewel of the East* 3, *Horror Realms* 3, *Planes of Power* 2, *Path of the Hellknight* 2, and six more with 1 each; PrC: *Paths of Prestige* 19, *Concordance of Rivals* 1 | 32 | 20 |
| Adventure Path volumes and title-only sources (7) | *Tyrant's Grasp* #1 3 and #6 2, *Giantslayer* #5 2, *Reign of Winter* #5 1, *Pathfinder* #5 1 and #124 1; PrC: *Carrion Crown* #3 1 | 10 | 1 |
| No source in the module | see [Unattributed items](#unattributed-items) | 4 | 8 |
| **Total** (50 books plus unsourced) | | **210** | **32** |

Use the per-book tables above as the worklist. A residual of 1 or 2 in a book should be checked for a name mismatch before anyone transcribes anything.

Observations.

- The gap is **recency**, not a type of content. PCGen's data effectively ends in 2016 to 2017, and the PRD in 2015. The 2017 to 2019 books (the end of the Player Companion and Campaign Setting lines) are the main hole. A d20pfsrd check of exactly those books would decide whether anything needs transcription at all.
- *Paths of Prestige* alone is 19 of the 32 missing prestige classes. The other 13 are five single entries from five books and eight with no source in the module.
- The numbers above say nothing about quality. A source that covers a book may still disagree with the printed text or errata; #219 requires hand review of every record and a sampled spot check per book whatever the source.

## Options

| Option | Coverage (est.) | What it costs | Main risk |
| --- | --- | --- | --- |
| **A. Wait for AoN's answer** (current plan) | 100% of the 119 and about 1,318 | A slow collection after the owner's contact; #254 | Depends on AoN's reply; moved to Community Use Policy only in 2026-07 |
| **B. PRD plus PCGen, transcribe the residual** | about 84% of archetypes, about 73% of prestige classes from open data; the rest by hand from the owner's copies, in about 50 books | Parsing two formats, mapping PCGen to the #219 archetype model, a Section 15 and Product Identity pass, transcribing about 210 archetypes and 32 prestige classes | PCGen data quality; OGL covers mechanics only; name matching errors in this estimate |
| **C. B plus d20pfsrd for the residual books** | Possibly near 100% | As B, minus most transcription, plus reading d20pfsrd pages (the same kind of slow collection as AoN, with an OGL grant) | Completeness for 2017 to 2019 books is unverified; HTML only; mixed third-party content |
| **D. Copy the `pf1e-archetypes` data** | 1,315 and 119, structured | Lowest effort | Provenance is AoN copied by a third party; the GPL label does not cover Paizo's text; the module's own README tells users to re-check AoN |

Suggested order of work, if AoN declines (a recommendation from this research, not a decision):

1. Keep A as the plan until #254 resolves.
2. In the meantime, treat the module's names, classes, books, pages and levels as a **checklist** to measure any alternative against. Facts are all that is used.
3. If A fails, take B, then use C to shrink the transcription list before any manual work. Do the d20pfsrd spot check on a full list of the roughly 50 residual books first, one index page per class, to size it.
4. Whatever the route, the #224 and #241 gates apply unchanged: Section 15 notices per admitted book, hold and report entries without them, and honour Product Identity markers.

## Method and limits

- **Data sets read.** Cloned once each (single shallow or sparse clones, no site crawling): PCGen `data/pathfinder/paizo` at 25523db (2026-10-02), the `pf1e-archetypes` repository at 92ddcb6 (2026-01-02), and the pf1 system's `sources.mjs` at v11.11. These are open repositories, not websites.
- **Pages read.** AoN: `Archetypes.aspx`, `PrestigeClasses.aspx` and `Sources.aspx` (index pages only; one archetype page returned HTTP 500 and was not retried). PRD: the legacy index, the Open Game License page, and three book pages (ARG dwarves, Monster Codex boggards, a missing Technology Guide URL that returned 404). d20pfsrd: the legal page, `robots.txt`, one Fighter archetype index, plus one web search. PSRD-Data and `psrd-db`: repository metadata through the GitHub and npm APIs.
- **Counting.** The module's `sources[0].id` per archetype and prestige class item, resolved against `sources.mjs`. PCGen archetypes are entries with `CATEGORY:Archetype` and prestige classes are `CLASS:` entries with `TYPE` containing `Prestige`. The match between the two is exact on normalised names (lower case, punctuation removed), and for archetypes it uses the parenthesised name from the module's `Class (Name)` titles. Throwaway scripts; none were committed.
- **Known weaknesses.** Name match ignores the class and can over-count PCGen coverage; the module records only the first source; the module may itself miss items; PRD coverage of *Monster Codex* and *Technology Guide* archetypes is unconfirmed; the *Technology Guide* page I tried 404'd on the legacy PRD; d20pfsrd was only spot-checked; PSRD-Data's count of 221 is taken from the brief, because the GitHub API call to count it failed.
- **Not covered.** Paizo product pages for per-book archetype counts (the store pages list no counts), the licence of PCGen's individual contributors, whether Paizo's Community Use Policy changes the picture for any of these sources, and the legal sufficiency of any of this. #241 explicitly leaves licence sufficiency undecided, and this note does not decide it.
