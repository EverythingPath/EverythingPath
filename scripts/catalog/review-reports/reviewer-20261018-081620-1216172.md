Reviewed `26f0af5` offline, excluding #375. No blockers identified. Tests were inspected, not executed.

1. **Should-fix — The 16 identity tests overstate mechanical coverage.** Beast Master automatically resolves its `partialFormula` conflict while retaining the unchanged replacement (`tests/catalog/rule-keyed-identities.test.ts:193`, `:460`), then uses empty feature modifiers (`:282`). Foundry’s `combat-style-feat.BO7BEFHDcf6qBaYV.yaml:14` computes the full feat count. Keep that conflict held or supply a reviewed adjustment and assert the surviving value. Casting comparisons also discard actual property values (`rule-keyed-identities.test.ts:873`); assert ability, progression and list values.

2. **Nit — Increment names omit the table’s benefit.** `scripts/catalog/pcgen/schedules.ts:809` produces “Bravery (6th level)” instead of “Bravery +2” (`schedules.ts:181`). Keys, parent/part metadata and empty modifiers otherwise match the binding design.

I confirm **every one of the 31 separate-identity decisions**. None needs reverting. References below are real rows in pinned PCGen `25523dbc`; filenames identify the source pairs.

- Perfect Scholar: confirmed (`isi_abilities_class.lst:193`;`isi_abilities_class_pu.lst:12`).
- Tempest Druid: confirmed (`ism_abilities_class.lst:233`;`ag_abilities_class.lst:785`).
- Lore Warden: confirmed (`pfsfg_abilities_class.lst:253`;`ag_abilities_class.lst:836`).
- Enlightened Bloodrager: confirmed (`arca_abilities_class.lst:13`;`ag_abilities_class.lst:698`).
- Magaambyan Initiate: confirmed (`arca_abilities_class.lst:14`;`ag_abilities_class.lst:597`).
- Raging Cannibal: confirmed (`coc_abilities_class.lst:31`;`uw_abilities_class.lst:185`).
- Windstep Master: confirmed (`emh_abilities_class.lst:145`;`emh_abilities_class_pu.lst:25`).
- Storm Caller: confirmed (`emh_abilities_class.lst:269`;`:270`).
- Leshy Warden: confirmed (`ff_abilities_class.lst:56`;`uw_abilities_class.lst:495`).
- Pact Wizard: confirmed (`ff_abilities_class.lst:147`;`hhh_abilities_class.lst:235`).
- Invested Regent: confirmed (`hothc_abilities_class.lst:74`;`hothc_abilities_class_pu.lst:3`).
- Herb Witch: confirmed (`hotw_abilities_class.lst:144`;`uw_abilities_class.lst:1245`).
- Scaled Fist: confirmed (`lod_abilities_class.lst:275`;`lod_abilities_class_pu.lst:7`).
- Patient Ambusher: confirmed (`magtt_abilities_class.lst:92`;`uw_abilities_class.lst:643`).
- Serpent-Fire Adept: confirmed (`oo_abilities_class.lst:236`;`oo_abilities_class_pu.lst:7`).
- Viking: confirmed (`potn_abilities_class.lst:32`;`uw_abilities_class.lst:573`).
- River Druid: confirmed (`potr_abilities_class.lst:50`;`uw_abilities_class.lst:497`).
- Elementalist Oracle: confirmed (`psand_abilities_class.lst:55`;`uw_abilities_class.lst:827`).
- Bellflower Harvester: confirmed (`smh_abilities.lst:76`;`ag_abilities_class.lst:1098`).
- Ringleader: confirmed (`ui_abilities_class.lst:222`;`ag_abilities_class.lst:636`).
- Brazen Disciple: confirmed (`ag_abilities_class.lst:925`;`ag_abilities_pu.lst:53`).
- Black Asp: confirmed (`ui_abilities_class.lst:531`;`ui_abilities_class_pu.lst:15`).
- Sage Counselor: confirmed (`ui_abilities_class.lst:532`;`ui_abilities_class_pu.lst:16`).
- Consigliere: confirmed (`ui_abilities_class.lst:715`;`ui_abilities_class_pu.lst:27`).
- Phantom Thief: confirmed (`ui_abilities_class.lst:719`;`ui_abilities_class_pu.lst:28`).
- Leshy Caller: confirmed (`uw_abilities_class.lst:1186`;`uw_abilities_class_pu.lst:9`).
- Lion Blade: confirmed (`teog_classes.lst:5`;`isi_classes.lst:43`).
- Cyphermage: confirmed (`ism_classes.lst:64`;`ag_classes.lst:91`).
- Pathfinder Savant: confirmed (`sos_classes.lst:22`;`ag_classes.lst:297`).
- Student of War: confirmed (`sos_classes.lst:41`;`ag_classes.lst:447`).
- Steel Falcon: confirmed (`asol_classes.lst:10`;`ag_classes.lst:397`).

Other requested judgements:

- Reprints and PotS correctly remain held (`pcgen/identities.ts:715`;`pots_abilities_class.lst:7`;`pots_abilities_race.lst:117`). Mantis Zealot’s alignment and Delver’s prerequisite conflicts are justified (`ag_abilities_class.lst:1118`;`sos_classes.lst:8`). Hellknight/Red Mantis page holds are correct (`ag_classes.lst:170`,`:325`;Foundry `sources.mjs:214`).
- USH handling is correct: CRB identity plus held attribution conflict (`everythingpath-identities.json:3322`;`cr_classes.lst:345`;`ush_classes.lst:53`).
- Mobile Fighter/Beast Master partial-formula holds are correct (`pcgen-archetypes.test.ts:374`,`:543`); finding 1 concerns the fixture’s override.
- #741 aliases match pinned class IDs and both flurry IDs (`character-sheet-rule-keys.ts:12`;Foundry class/flurry YAML `_id` lines `:1`).
- #583 proves the warning, separate acceptance, copy persistence and clearing (`class-rules-control.test.tsx:710`); its published fixture is cross-checked (`pcgen-archetypes.test.ts:867`).