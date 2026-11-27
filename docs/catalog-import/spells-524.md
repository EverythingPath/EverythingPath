# Spell curation review: #524

Reviewed **2026-10-08** by **Sol (AI curator) for the owner**, following [#524](https://github.com/AndreasUnunger/EverythingPath/issues/524), [PRD #251 Decisions 10 and 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md), and the [#328](races-328.md) and [#522](spells-522.md) precedents.

Exactly **100 ticket keys** receive one disposition: **0 admitted, 96 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only and 4 excluded navigation folders**. No Catalog Release was published or activated. Attribution holds do not establish completed mechanics.

## Evidence and scope

- [Inventory, attribution and mechanics review](../../scripts/catalog/legal/spells-524.json) binds every ordered key to its pinned YAML path and hash, full description, all action metadata, source citations, inherited-rule evidence and independent mechanics disposition.
- [Fixture provenance](../../tests/fixtures/spells-524/provenance.json) distinguishes the exact 100 roots from unreviewed linked and class-lookup context. Context supplies reproducible extraction and legal binding; it expands no batch admission or review scope.
- [Curation Overlay](../../scripts/catalog/reviewed-curation.json), [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json), [evidence](../../src/lib/catalog/data/attribution-evidence.json), and [enforced notice holds](../../scripts/catalog/legal/held-notices.json) retain the per-entry comparisons, current bindings and named gaps.

The read-only source pins are Foundry PF1 v11.11, `418761d2e16a6037c0156bb4a241f7cea5a2986d`, and pf1-content 11.4.0, `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. The ordered ticket-key SHA256 is `34c21370b9171afaf5f55ba88d4586286626ae12d9b26c0956c0dbd7c06a3908`. No Foundry runtime or configuration was copied or executed. Fixtures retain **220 raw YAML files**: 100 ticket roots and 120 unreviewed dependencies (49 class lookups, 48 linked Spells, three class abilities, one race, ten racial-trait records, three trait ancestor folders, three weapon lookups, one buff, one feat and the excluded Mutant template). The full-context snapshot has **160 imported entries**: 96 roots and 64 importable context entries. Four root folders, three trait ancestor folders, 49 lookup-only classes, three weapon lookup records and the unassigned template account for the difference. All 160 entries match the fresh full-source public import, and all 96 assessment bindings have been checked against that import.

Permitted comparison uses freshly retrieved PCGen commit `25523dbcf10e86c280fc0f447167ea43d67419d3`: [CRB Spell data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). Seven direct CRB roots have literal comparison rows, line numbers and hashes. These rows are comparison leads; they do not bound expanded class lists, all actions or inherited content. **Undeath Sense** cites the CRB Detect Undead page while retaining a different identity and extended prose; no same-name or page-based admission is inferred. The PCGen Paizo Inc. notice wording is not declared equivalent to the existing Paizo Publishing, LLC notice. No book PDFs were available. Archives of Nethys was not used.

## Attribution and inherited notices

The review records **56 observed minimum notice identities** and **55 enforced notice/notice-chain holds**, alongside 96 individual `spells-524-whole-content-<ID>` unresolved Attribution Assessments. CRB reuses its existing reviewed identity. Direct citations and notice title matches supply evidence leads, without proving complete content origins or book notice chains. Each candidate names the missing comparison and required notice identities. Missing book/PDF comparisons remain named holds. The pinned bibliographic registry repeats `PZO90119` for both **Siege of Stone** and **Prisoners of the Blight**; both leads are recorded as unresolved, with no first-match attribution or invented corrected code.

Concrete inherited rules include:

- **Wooden Phalanx**, **Tomb Legion**, **Spectral Saluqi**, **Shadow Projection**, the genie/barghest summons and **Object Possession** depend on Bestiary creature/template rules. The granted restrictions and replacement clauses remain intact.
- **Forced Mutation** links an unsourced Mutant template. Pinned pf1-content Spellscar Fever identifies the ordinary Mutant as Bestiary 5 p.180, distinguishing the Mana Waste mutant. The known immutable Bestiary 5 notice identity is required; the template's complete origin comparison remains held.
- **Fey Boon** explicitly grants Occult Adventures kineticist talents, alongside CRB dwarf stonecunning, druid woodland stride and spells. **Defensive Grace** references ACG inspiration, precise strike, studied combat and studied strike. **Gird Ally**, **Shared Training** and **Shield Companion** require APG eidolon, teamwork and fiendish-servant rules.
- **Revealing Light** depends on Ultimate Equipment camouflage netting and the APG Camouflage rogue talent. The permitted fixed PCGen APG comparison supplies literal talent prose and p.130; it is an origin lead, without complete attribution admission. **Skim** names Ultimate Intrigue Research, and **Antitoxin Touch** names Ultimate Wilderness venom milking.
- Linked and plain-name CRB spells, conditions, aging, movement, checks and combat rules are recorded per key. **Fickle Winds** includes the plain-text Wind Wall dependency; it is not missed merely because the text lacks a UUID.

**Impede Speech, Sign of the Dawnflower, Traveling Dream, Hardening, Veil of Ash, Admonishing Ray, Water Shield, Apparent Master, Bolts of Bedevilment and Enhanced Diplomacy** have literal record-level `3.5` tags. The importer excludes whole 3.5 packs; under the owner's policy (2026-10-08, [importer contract](README.md)) record-level `3.5` tags are held, never excluded. All ten are held, with no new exclusion rule. The two **Summon Barghest** Spells retain the existing Dynamite group hold; **Teratoid Caress** retains its actual custom Pathfinder Comics #10 citation and a specifically named notice/content hold.

## Every-key disposition

| Exact key | Candidate | Upstream root citation | Contract disposition |
| --- | --- | --- | --- |
| `pf1/9f0jokh1rcmw36tj` | Deafening Song Bolt | PZO1115, p. 214 | Specifically held |
| `pf1/9f3hf9h3j8q8062b` | Waves of Exhaustion | PZO1110, p. 368 | Specifically held |
| `pf1/9fd7mcoint902oyb` | Wooden Phalanx | PZO1117, p. 249 | Specifically held |
| `pf1/9fdte3s6lnanf9rg` | Summon Nature's Ally II | PZO1110, p. 354 | Specifically held |
| `pf1/9gk4lozwcoafkiw2` | Sculpt Simulacrum | PZO1117, p. 236 | Specifically held |
| `pf1/9hBqwSiT8GIHl0Ht` | Necromancy | Foundry folder | Excluded: navigation folder |
| `pf1/9ha7fyq951iijvt8` | Vitriolic Mist | PZO1117, p. 248 | Specifically held |
| `pf1/9hi94t05i449j5ul` | Share Memory | PZO1117, p. 238 | Specifically held |
| `pf1/9hnhezzzzrn985o7` | Natural Rhythm | PZO1115, p. 233 | Specifically held |
| `pf1/9imc15es7vbtqdqz` | Air Walk, Communal | PZO1118, p. 222 | Specifically held |
| `pf1/9j2dpu038lp9rd1p` | Detect Radiation | PZO9272, p. 8 | Specifically held |
| `pf1/9jcelzrc91kpr5ew` | Miasmal Dread | PZO9280, p. 221 | Specifically held |
| `pf1/9jjocotdsznwkz97` | Tomb Legion | PZO9221, p. 61; PZO9403, p. 27 | Specifically held |
| `pf1/9jzo6vyf0lto84y0` | Straitjacket | PZO1135, p. 128 | Specifically held |
| `pf1/9kqq7i49ujvq8n5z` | Charge Object | PZO1132, p. 161 | Specifically held |
| `pf1/9n0hrflrshpxv4ns` | Weapons Against Evil | PZO9267, p. 245; PZO9416, p. 29 | Specifically held |
| `pf1/9nbvyqbihqvevu07` | Discern Value | PZO9430, p. 30 | Specifically held |
| `pf1/9nrm3dcs8laoo0jf` | Song of Kyonin | PZO9237, p. 60 | Specifically held |
| `pf1/9o8cy846de649qa3` | Mud Buddy | PZO1130, p. 105 | Specifically held |
| `pf1/9oosw4hf9kxh9b9s` | Pick Your Poison | PZO9267, p. 238; PZO9202, p. 11 | Specifically held |
| `pf1/9ozs6mdxa4ltwtuw` | Oppressive Boredom | PZO1117, p. 230 | Specifically held |
| `pf1/9p77cn0uzyru10m7` | Retrieve Item | PZO9220, p. 27 | Specifically held |
| `pf1/9pCd1KUeaQsiB6n6` | Phase Step | PZO9487, p. 17 | Specifically held |
| `pf1/9pbl3ktd5oqejl19` | Transformation | PZO1110, p. 360-361 | Specifically held |
| `pf1/9pn76tz05b9g0peq` | Object Possession | PZO1132, p. 179 | Specifically held |
| `pf1/9pu7hu8jhwwgxbcj` | Heckle | PZO9465, p. 26 | Specifically held |
| `pf1/9pv2xecdqfmpvyq9` | Shackle | PZO1138, p. 99; PZO9293, p. 61 | Specifically held |
| `pf1/9qikkia1ww55aeh8` | Charm Fey | PZO9298, p. 12 | Specifically held |
| `pf1/9ri40ee00k8brat1` | Sacrifice | PZO1139, p. 185, 47 | Specifically held |
| `pf1/9s3yjpizzisn7an1` | Spectral Saluqi | PZO9269, p. 58; PZO9403, p. 27 | Specifically held |
| `pf1/9s5oseou738k2qif` | Fickle Winds | PZO1117, p. 219 | Specifically held |
| `pf1/9smnjoxx4y6bb6iz` | Silver Darts | PZO1129, p. 192 | Specifically held |
| `pf1/9tvqcy1hqdmawdo2` | Jatembe's Ire | PZO9465, p. 13 | Specifically held |
| `pf1/9tww9fc9049h6iqc` | Cause Fear | PZO1110, p. 252 | Specifically held |
| `pf1/9u4mn2uxm862cpbb` | Shadow Projection | PZO1115, p. 243 | Specifically held |
| `pf1/9u7ebo95p6hmrb7p` | Black Spot | PZO9422, p. 28 | Specifically held |
| `pf1/9ueps4vao672p3iu` | Summon Genie, Lesser | PZO9441, p. 11 | Specifically held |
| `pf1/9v2s3xjlakjm1eq1` | Mage's Private Sanctum | PZO1110, p. 307 | Specifically held |
| `pf1/9vdjohbrj896e2ot` | Discern Lies | PZO1110, p. 270 | Specifically held |
| `pf1/9vld5joaodkatmj3` | Gird Ally | PZO9458, p. 22 | Specifically held |
| `pf1/9wl8ijy6argdvz5f` | Fire Storm | PZO1110, p. 282 | Specifically held |
| `pf1/ALOcJC0msKPAs0pq` | Defensive Grace | PZO9451, p. 31 | Specifically held |
| `pf1/AT9FKvCb4ejgDo7J` | Raiment of Command | PZO1002, p. 418; PZO9005, p. 61 | Specifically held |
| `pf1/B8KNC8vi2LZdlQHl` | Forced Mutation | PZO9486, p. 29 | Specifically held |
| `pf1/BEUIZyvOHWgTvbPl` | Impede Speech | PZO9401, p. 27 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/BQANb2OZFvudfj8n` | Sign of the Dawnflower | PZO9405, p. 25 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/BcZC63EPa8AuJBdq` | Spindrift Spritz, Mass | PZO9483, p. 14 | Specifically held |
| `pf1/CeMy8lBDh2nY6WLY` | Violent Misfire, Greater | PZO9486, p. 29 | Specifically held |
| `pf1/DElMwKX5Ub8hWCoT` | Realm Retribution | PZO9496, p. 14 | Specifically held |
| `pf1/DPKSnxvgdYVIsGpN` | Litany of Order | PZO9488, p. 13 | Specifically held |
| `pf1/DiKG5gRilq4bkGFu` | Skim | PZO9490, p. 17 | Specifically held |
| `pf1/DuaTNlfR9hzv5euv` | Symbol of Storms | PZO9490, p. 26 | Specifically held |
| `pf1/EmIafjKl7hvbinLh` | Transmutation | Foundry folder | Excluded: navigation folder |
| `pf1/FXrwYG5Ho5lo2cHN` | Litany of Dependability | PZO9488, p. 13 | Specifically held |
| `pf1/GX0BBBs6HMCZxOWU` | Hallucinatory Decor | PZO9488, p. 19 | Specifically held |
| `pf1/Gb4hdWgY8SL5Hl1z` | Instant Clot | PZO9482, p. 21 | Specifically held |
| `pf1/GeNvBJJptxIqFXZK` | Revealing Light | PZO9478, p. 31 | Specifically held |
| `pf1/GfQBO8w8QnNtLfNq` | Waft | PZO1140, p. 14 | Specifically held |
| `pf1/H6qZ8QjVBWGyucTK` | Fey Blight | PZO90119, p. 73 | Specifically held |
| `pf1/HBdrFlsq2J8hfyDn` | Wooden Wing Shield | PZO1140, p. 14 | Specifically held |
| `pf1/HH8UbV2ZYZ6zHgHQ` | Fastidiousness | PZO9488, p. 13 | Specifically held |
| `pf1/HK5dl4ECkzd6LDLY` | Unhallowed Blows | PZO9486, p. 29 | Specifically held |
| `pf1/HYi184FA3Iuw7db0` | Dwarven Veil | PZO9408, p. 22 | Specifically held |
| `pf1/IBAUx9cS2R5nsVrU` | Seed Spies | PZO1140, p. 14 | Specifically held |
| `pf1/IHFIFyvEVyfS68C2` | Toxic Blood | PZO9487, p. 11 | Specifically held |
| `pf1/IhpdSN24gmIvkHlC` | Traveling Dream | PZO9202, p. 13; PZO9002, p. 72 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/Ix6Dc5gXEobiIHKD` | Conjuration | Foundry folder | Excluded: navigation folder |
| `pf1/JYgzYISWlo5CQQg3` | Fey Boon | PZO90119, p. 73 | Specifically held |
| `pf1/JkZWJXPWSYLkLMOy` | Clay Skin | PZO9487, p. 17 | Specifically held |
| `pf1/JmX68u3q4lCxuB0l` | Carrying Wind | PZO9483, p. 17 | Specifically held |
| `pf1/JsrZMMiknX9ZVhuA` | Unhallowed Blows, Greater | PZO9486, p. 29 | Specifically held |
| `pf1/KLzmzuvO2wZadriO` | Grasping Vine | PZO1140, p. 25 | Specifically held |
| `pf1/LrY6Qc1hzRO2ZG8x` | Litany of Admonition | PZO9488, p. 13 | Specifically held |
| `pf1/M6rx2faMBFZFzuY9` | Summon Barghest II | DYN0010-A, p. 26 | Specifically held |
| `pf1/M6z9LD9YgCPjVVX3` | Shared Training | PZO9490, p. 13 | Specifically held |
| `pf1/MqG2GmkVOn3OgJgf` | Hardening | PZO1111, p. 207 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/MyyQSa5H4qYabx18` | Bloodsworn Retribution | PZO9408, p. 22 | Specifically held |
| `pf1/NE0tEwSvcr71GnPC` | Evocation | Foundry folder | Excluded: navigation folder |
| `pf1/NnbDuJ1RbfbuiiY0` | Spindrift Spritz | PZO9483, p. 14 | Specifically held |
| `pf1/O8h91bExN8WP93WW` | Veil of Ash | PZO9024, p. 61 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/OIWY4Cdh0u8HvgLb` | Hag's Seasoning | PZO9485, p. 21 | Specifically held |
| `pf1/Q1SwHEAnMZpQDN3W` | Waterproof | PZO9483, p. 14 | Specifically held |
| `pf1/QUXJYqzIFAzvXQ3e` | Admonishing Ray | PZO9405, p. 24 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/SJqQO3f3l2PXrVaH` | Blast of Wind | PZO9483, p. 17 | Specifically held |
| `pf1/SkM63G8HnKo8Fj6l` | Teratoid Caress | Pathfinder Comics #10, p.  | Specifically held |
| `pf1/SqXUsoE5MvrI4nZI` | Seismic Fissure | PZO9494, p. 27 | Specifically held |
| `pf1/TN5FLPMkVY59iHY2` | Water Shield | PZO9024, p. 61 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/TvgytShUvLYsIndg` | Undeath Sense | PZO1110, p. 269 | Specifically held |
| `pf1/UBp9cManySiQEhQD` | Rising Water | PZO9483, p. 14 | Specifically held |
| `pf1/UkSdEOtHdzeuRiUu` | Untold Wonder | PZO9491, p. 19 | Specifically held |
| `pf1/VUGSm3Nk8HnK6zXW` | False Age | PZO9491, p. 23 | Specifically held |
| `pf1/ViSMOM9zfKVQLvCQ` | Summon Barghest I | DYN0010-A, p. 26 | Specifically held |
| `pf1/X7s5DPoKoeejOEUn` | Redcap's Touch | PZO9491, p. 18 | Specifically held |
| `pf1/Y1Blrx6vP14T5G6G` | Antitoxin Touch | PZO9487, p. 11 | Specifically held |
| `pf1/Y1wgewApRHLDb3Hq` | Fool's Gold (AA) | PZO9465, p. 20 | Specifically held |
| `pf1/YD6Y3Nxf9OwUAzPD` | Apparent Master | PZO9507, p. 32 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/YM3MsPTQt0XuZkMT` | Shield Companion (AA) | PZO9429, p. 25 | Specifically held |
| `pf1/YX53WUresLyCwO0I` | Invigorating Repose | PZO9408, p. 22 | Specifically held |
| `pf1/Z2Jpbju6A5ASxiE2` | Bolts of Bedevilment | PZO1111, p. 206 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |
| `pf1/ZAi4VWhpaLp8LYNr` | Enhanced Diplomacy | PZO9405, p. 24 | Specifically held; record-level `3.5` tag (owner policy, 2026-10-08) |

## Mechanics and separate prose review

The bounded drafter finds **0 required notes, 0 action conditionals and 0 Item Abilities**. Its separate description predicate drafts 40 descriptions; the complete manual description/action pass supplies checked records for **all 96 Spells**, with **99 readable Note outputs**. The remaining 56 descriptions were inspected explicitly rather than being silently skipped by the predicate. Existing shared Situations `death`, `forests` and `spells` are reused where applicable; remaining labels have distinct local scopes. No new shared Source or rule identity is inferred.

Recorded Spells contribute **no Modifiers**, as the Spellcasting contract requires. Running effects belong to separate Spell Effects, conditions, selected features or Attack Routines. **55 Spells** retain explicit unfinished running mechanics, independent of their attribution holds. Numeric values in Notes are readable rules evidence, not claims that those calculations work. Prerequisite/proficiency facts that require running effects, such as Transformation's weapon proficiencies and Shared Training's feat waiver, remain outstanding rather than granting benefits from recording a Spell.

| Spell | Outstanding running mechanics |
| --- | --- |
| Deafening Song Bolt | Apply the deafened condition for 1d6 rounds; recorded Spell grants none. |
| Waves of Exhaustion | Running exhausted condition must apply its ability/speed effects, ignoring already exhausted targets. |
| Vitriolic Mist | Running acid protection and inherited Reflex interaction; no permanent modifiers. |
| Natural Rhythm | Natural Attack Routine damage needs cumulative +1 per successful hit against the same foe, maximum +5; any miss resets every attack’s bonus to +0. |
| Air Walk, Communal | Running Air Walk movement capability with allocated 10-minute duration intervals. |
| Miasmal Dread | Apply demoralize/shaken outcome to each foe whose DC the single Intimidate check meets. |
| Straitjacket | Running modified grapple restraint condition and supported concentration/action restrictions. |
| Weapons Against Evil | Weapon Attack Routine DR bypass must ignore evil creatures’ DR5 or less except epic; light remains prose. |
| Song of Kyonin | Clear exhausted/fatigued/nauseated/paralyzed/sickened/stunned conditions when performance ends or changes. |
| Pick Your Poison | Running poison-triggered -2 attacks/saves/checks until expiry; restore poison effects when penalty ends. |
| Transformation | Running +4 enhancement Strength/Dexterity/Constitution, +4 natural armor AC, +5 competence Fortitude; temporary simple/martial proficiencies and BAB=Character level with iteratives; suppress Spellcasting and spell activation/completion items. |
| Object Possession | Object-possession substituted animated-object statistics and Construction Point choices require running form integration. |
| Heckle | Running -2 attacks/saves and Intelligence/Wisdom/Charisma skill/ability checks; attitude one step hostile is manual. |
| Sacrifice | Conditional sacrifice bonuses on opposed Charisma checks and conjuration/escape DCs; nonstacking choices +1/+2/+4/+6/+8 with exact costs. |
| Fickle Winds | Running Wind Wall projectile protection and attack-rule handling. |
| Jatembe's Ire | Grappled condition resulting from successful tendril combat maneuvers. |
| Cause Fear | Running frightened on failed save, shaken1 round on successful save; HD6+ immunity and expiry. |
| Shadow Projection | Shadow form darkvision/defenses/fly/racial Stealth/Strength-damage Attack Routine and undead type; own HD/HP preserved, no spawn/ranks/HD grants; dying condition on projection death. |
| Black Spot | Running aura allies+2 weapon attacks/damage against cursed target and target-4 saves vs death effects; daily1 Constitution damage tracked separately. |
| Gird Ally | Running deflection AC bonus1+floor(CL/6), maximum4 atCL18; summoner may target eidolon. |
| Defensive Grace | Running rolled inspiration dodge AC per round and precision immunity; immediate dismissal cancels confirmed critical. |
| Raiment of Command | Running+5 Diplomacy/Intimidate, conditional+10 competence Disguise/Bluff known-authority impersonation; Intelligence3+ opponents-2 opposed checks. |
| Forced Mutation | Running-4 Constitution/Charisma and selected mutant deformity, with template limitations. |
| Realm Retribution | Target Attack Routines use chosen caster alignment component; warpriest treats ascleric6. |
| Litany of Order | Running sickened1 round after lawful-aura hits on chaotic-subtype target. |
| Skim | Running+8 reading-required skill/ability checks and Research checks; fourfold reading speed remains prose. |
| Instant Clot | Running bleed removal/immunity until next bleed dismisses Spell. |
| Revealing Light | Running removal of racial/visual-camouflage Stealth bonuses and+2 saves versus pattern subschool; 20-foot area. |
| Waft | Running inherited Levitate cumulative attack penalties except flying targets; wind treats size2smaller. |
| Fey Blight | Fey-choice running weapon-size/damage/attack-2, Dexterity drain/tree transformation, CharismaCL reduction floor6, concealment/20% Spell failure, broken items, suggestion, critical16–20/x3 and-5 spells saves, morale/performance suppression, Wisdom drain, exhausted, age ability losses, mental ability-2 floor3. |
| Wooden Wing Shield | Running+4 shield AC, immediately expires on movement. |
| Fastidiousness | Running+2 circumstance Fortitude vs inhaled/ingested disease only; daily duration. |
| Unhallowed Blows | Running+1 enhancement on unarmed/one natural weapon attacks and damage; lethal unarmed option receives no enhancement. |
| Dwarven Veil | Running+2 circumstance checks to influence dwarves. |
| Toxic Blood | Poison-inflicted Constitution damage tracking if attack spray resolves. |
| Fey Boon | Fey-choice running+1 weapon attack/damage, woodland stride/forest speed10, primary tail1d6(M)/1d4(S), darkvision60/stonecunning and underground+1AC/Reflex,  water breathing,+2insightAC/saves, friendly plant/animal attitudes, kineticist HD-level hydrokinesis/shroud or+2enhancement water-blast attack/damage, swift Haste1round/minute,+4enhancement attraction-dependent Charisma checks. |
| Carrying Wind | Running enhancement land/fly speeds10/20/30 atCL<10/10–14/15+; no-fly targets gain10poor/20average/30average flight instead. |
| Unhallowed Blows, Greater | Running one natural/unarmed weapon enhancement+1 per4CL maximum5, or all natural weapons+1; inherited lethal unarmed alternative has no enhancement. |
| Grasping Vine | Running conditional Disable Device-2 while vine handles trap/lock. |
| Litany of Admonition | Running staggered1round and litany exclusivity. |
| Shared Training | Temporary teamwork feat Grants with prerequisite waiver; one/two/three/four feats atCL<9/9/13/17, selected from caster’s existing feats. |
| Bloodsworn Retribution | Running oath-relevant morale attacks/saves/checks = sacrificed HP/5, sacrifice maximum25; selected qualification remains local. |
| Veil of Ash | Running blinded per-round on failed Fortitude, anatomy/eyes exceptions. |
| Hag's Seasoning | Temporary HP equal halfCL for successful bite/ingestion,1hour, once/day per beneficiary regardless of targets. |
| Teratoid Caress | Running sickened1round on save; failure2Dexterity/Charisma damage50/50, -1saves vs evil; divine good caster-4concentration; later triggers1abilitydamage. |
| Seismic Fissure | Prone condition for adjacent targets failing Reflex. |
| Water Shield | Running protection against acid/fire and Reflex interaction. |
| Untold Wonder | Running emotion penalties replaced by morale bonuses halfvalue; other morale bonuses+1; +2saves vs pattern subschool. |
| False Age | Running chosen adjacent age-category ability changes, with appearance adjustment; no invented numeric defaults without inherited age evidence. |
| Redcap's Touch | Running hat-wearer+2damage while occupying headslot; killing living creature heals1d4HP manual. |
| Fool's Gold (AA) | Running failed-first-Will-2saves vs caster’s magic while coin possessed; double failed harmful magic durations. |
| Apparent Master | Target conditional+5save when threatened/attacked by caster/allies. |
| Shield Companion (AA) | Shield Other inherited+1deflectionAC,+1resistance saves and shared-damage integration, companion/familiar/fiendish-servant targeting; explicit expanded class-level1 eligibility. |
| Bolts of Bedevilment | Running dazed1d3rounds following ranged ray hit/failed Will; one ray perround. |
| Enhanced Diplomacy | Single chosen Diplomacy/Intimidate+2competence, selected before roll; expires1minute or discharge. |

All structured action metadata is retained per key. Five discrepancies remain explicit:

- **Shackle:** Second action says two sets of restraints; description grants one set binding two targets. Preserve both without correction.
- **Fire Storm:** Structured initial damage (@cl)d6 has no20d6 cap stated by description.
- **Violent Misfire, Greater:** Structured floor(CL/2)d6 has no inherited10d6 cap.
- **Admonishing Ray:** Structured extra-attack count min(floor((CL-3)/4),3) permits four total rays at CL15; text caps three at CL11. Structured damage type is untyped, not the stated force effect, and action lacks nonlethal flag.
- **Undeath Sense:** Cited CRBp269 describes Detect Undead, but this extended Undeath Sense identity/prose remains unbounded.

The importer also reads Spell `system.types` rather than the pinned `system.descriptors`; 40 roots' actual descriptors remain recorded but absent from extracted descriptors. Shackle and Bolts of Bedevilment action effect/footer notes are manually inspected and preserved in metadata, although the current required-note collector does not collect Spell action notes. These importer gaps are reported for #719/#720; no product code is changed.

## Demonstration and validation

[Catalog tests](../../tests/catalog/spells-524.test.ts) replay pinned extraction, exact raw/prose hashes, inherited dependencies and notice holds, actual values and numeric drift through the public resolver. [Saved-sheet tests](../../convex/catalogSpells524.integration.test.ts) exercise an isolated Wizard collection using Transformation and Gird Ally through public writers, reads and catalog browsing, including member sharing, outsider rejection and campaign scoping. Pure checks additionally pin Natural Rhythm and Wooden Wing Shield. The focused run passes **22 tests** (21 catalog cases and one saved-sheet case). A Wizard with Intelligence 14 retains Transformation at level 6 and Gird Ally at level 2; recording them does not grant Transformation's +4 enhancement bonuses or Gird Ally's deflection AC.

There is **no legally admitted batch output** to demonstrate. The isolated retained catalog preview and saved-sheet fixture exercise public consumers while all 96 legal holds remain enforced. This is in-memory test data; no remote deployment or production data is changed.

The full-source gate reports **89 batch holds and seven structural/reference failures**. The bounded gate reports **61 holds and 35 failures**; 28 are selection-only missing dependencies. These are technical gate results alongside the editorial disposition of 96 held Spells, rather than additional dispositions or attribution substitutes.

| Full-source blocked Spell | Unsupported imported reference |
| --- | --- |
| Forced Mutation | Unassigned Mutant template `4pbHKe1aYEcjBEs4` |
| Skim | Linguistics rule journal page `SqLm3Deag2FpP8ty` |
| Revealing Light | Stealth rule journal page `wRWHk7tCUHR99PzD` |
| Waft | Fly rule journal page `iH69GIwm8BjecrPN` |
| Fey Blight | Exhausted condition journal page `ITxxh53qgl74wWcE` |
| Grasping Vine | Disable Device journal page `cSdUATLHBFfw3v4s` |
| Veil of Ash | Blinded condition journal page `A9KUpd2bsdZZsQqj` |

The descriptions strip unresolved links to readable labels, while raw fixtures and source evidence preserve the exact references. These importer gaps remain outstanding; the batch introduces no product fix.

Filtering the rebased shared data by the exact #524 candidate keys and batch identities establishes the real base inventory: **1,825 non-batch overlay records**, **2,038 assessments**, **2,017 evidence identities**, **858 existing notice holds** and **29 shared Situations**. The batch adds 96 records, 96 assessments, 96 evidence identities and 55 notice holds. Registry text, aliases, remaps and product code are unchanged.

Commands ran with the two pinned read-only checkouts and worktree-local `TMPDIR`. Both verified CLI previews write reports before their expected nonzero gate result. No environment file or private E2E material was accessed. Candidate selections and command output were temporary, and scratch was removed after review.

```sh
mkdir -p .scratch/curation-524-fix2/tmp
export TMPDIR="$PWD/.scratch/curation-524-fix2/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
python - <<'KEYS'
import json
from pathlib import Path
review = json.loads(Path('scripts/catalog/legal/spells-524.json').read_text())
Path('.scratch/curation-524-fix2/keys.json').write_text(
    json.dumps([row['externalKey'] for row in review['candidates']], indent=2) + '\n'
)
KEYS
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-524-fix2/keys.json --out .scratch/curation-524-fix2/drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-524-fix2/keys.json --descriptions --out .scratch/curation-524-fix2/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-524-fix2/keys.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-524-fix2/checked
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-524-fix2/full-drafts
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-524-fix2/keys.json --out .scratch/curation-524-fix2/final-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-524-fix2/final-full
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm -s catalog:format --check
pnpm test tests/catalog/spells-524.test.ts
pnpm test tests/catalog/spells-522.test.ts
pnpm test tests/catalog convex/catalogSpells524.integration.test.ts --maxWorkers=2 --testTimeout=30000
```

| Check | Result |
| --- | --- |
| Typecheck | Passed for app and Convex. |
| Full lint | Passed, including ESLint and unused-code lint. |
| Initial migration writers | Passed: 183 registrations. |
| Catalog pin | Passed: `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`. |
| Catalog format | Passed. |
| Fresh bounded drafts and prose resume | Passed: 1,921 retained records; zero new/replaced drafts, stale records, missing required records or unresolved required mechanics. All 96 descriptions are checked; 55 retain outstanding running mechanics. |
| Bounded description resume | Passed: 1,921 records retained, zero new/replaced drafts, zero missing or unresolved required mechanics. |
| Full-corpus drafter | Passed: 5,504 records, 3,583 new drafts, zero replaced, zero missing, 758 unresolved mechanics. Output remained temporary. |
| Bounded import/admission/curation | Expected nonzero admission result: zero admitted, 61 held, 35 structural/reference failures. Required curation passes, with all 96 descriptions checked and 55 explicit outstanding running effects. |
| Full-source import/admission/curation | Expected nonzero result: globally 56 admitted, 23,126 held, two dependent omissions and 4,689 failures. Batch roots are 89 held and seven failures. The full curation gate has 3,583 missing required records outside this batch (104 of 3,687 checked); 1,817 of 10,831 description candidates are checked. This does not claim a passing full-corpus admission or curation gate. |
| Isolated regression tests | Passed at the default five-second timeout: all 21 #524 tests and all 21 #522 tests. The #524 binding replay took 2.924 seconds; #522 took 3.102 seconds. Assertions remain unchanged after the loader switch. |
| Catalog suite and batch saved-sheet integration | Passed: 1,436 tests in 67 files with two workers and a 30-second timeout, including the batch saved-sheet integration and both regression files. The full application suite was not run. |
| Fresh binding and fixture audit | Passed: all 96 assessment bindings and all 160 fixture entries exactly match the verified full-source CLI output; zero mismatches. Base inventory is recorded above. |

The full-source CLI catalog SHA256 is `18db965d343f9e9f4cc5262b2173b396bce904b1b526144a24365c93b0bc5f8a`. All 160 fixture entries and 96 current assessment bindings match that exact CLI output.

Workflow limitations are explicit: book PDFs were unavailable, the record-level `3.5` question was left to the owner (decided 2026-10-08: held, never excluded), the pinned `PZO90119` titles are ambiguous, and seven reference types remain unsupported. Full-source CLI checks were run sequentially. The reported rebased loaded-run failures did not recur: #524 and #522 passed alone at the default five-second timeout and in the refreshed catalog suite with two workers and a 30-second timeout. No binding assertions were relaxed. The full-source audit verifies freshness separately from test load.

Approximate phase timing: source and contract preparation **4 minutes** (08:17–08:21 UTC); drafting, attribution and mechanics review **28 minutes** (08:20–08:48); checks and fixture comparison **24 minutes** (08:46–09:10); report and cleanup **5 minutes**, interleaved with checks. Total elapsed time was about **54 minutes**; phase windows overlap because the source audit, artifact work and tests were delegated concurrently.
