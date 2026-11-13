# Feats batch #344 — pf1-content, batch 11

Reviewed by **Sol (AI curator) for the owner**, 2026-10-09, under [#344](https://github.com/AndreasUnunger/EverythingPath/issues/344), PRD [#251](https://github.com/AndreasUnunger/EverythingPath/issues/251) Implementation Decision 17 and its acceptance appendix. Exactly **100 candidates: zero admitted and 100 specifically held**. Zero dependent omissions, whole-entry unsupported/prose-only dispositions, exclusions or retained exceptions. Five Mythic variants retain explicit out-of-scope automation notes rather than acquiring new game-system scope. No Catalog Release is published.

## Evidence and attribution

The [single inventory and mechanics review](../../scripts/catalog/legal/feats-344.json) records every exact ticket key, pinned raw-file/description hash, complete description and inert field, disposition, comparison lead, prerequisite/proficiency facts, inherited notice minimum, content hold and unfinished mechanic. Stable identities and remaps are unchanged. Foundry PF1 v11.11 `418761d2e16a6037c0156bb4a241f7cea5a2986d` and pf1-content 11.4.0 `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d` were verified by commands without an override. Both source trees have zero writable non-symlink entries. All 100 upstream Sources arrays are absent/empty and remain empty; no comparison evidence becomes user-facing Sources. There are zero record-level `3.5` tags; such a tag would be a hold, never an exclusion.

PCGen comparison uses commit `25523dbcf10e86c280fc0f447167ea43d67419d3`. **85 candidates have partial literal feat leads; 15 have no literal feat row** in that pinned Paizo corpus. Every located lead retains its exact row, location and whole-file/row hashes. Ninety-two comparison snapshots and 22 supporting YAML snapshots are retained. Seven PCGen snapshots also establish named inherited rules. Campaign manifests and pinned source bibliographies identify primary comparison books, not complete notice chains. No entry has a complete ordinary CRB comparison; non-CRB book-only evidence remains unavailable. No book PDF, Archives of Nethys or other comparison site was used. PRD/feature contracts establish scope and behavior, not attribution.

All 100 [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence records](../../src/lib/catalog/data/attribution-evidence.json) bind complete-source normalized bodies, mapping, evidence and notices. Every unresolved assessment names `feats-344-whole-content-<upstream-id>`. Required notices are **observed minima**, never claims of complete origin coverage. **52 complete-chain notice holds**, covering the 52 non-CRB minima alongside the existing CRB identity, are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json). Registry lines, aliases, raw-line provenance and legal resources are unchanged. No older content or notice hold is cleared, including the inherited-rule audits for #333–#336 and #516–#519.

Raw JSON equality checks preserve all **2,434 pre-existing assessments, 2,413 evidence records, 1,076 notice holds and 2,221 overlay records**, including rationale whitespace and all existing Situations. New records append by identity in canonical form.

## Inherited rules

All 100 complete descriptions and inert fields were reviewed. All **12 literal Combat Tricks** require PZO1131, even without a corresponding tag. All **three Completion Benefit** descriptions require PZO1125 for the Story framework; this does not identify primary publication. All **five Mythic variants** require PZO1126; four, rather than five, contain the word mythic in their operative descriptions, as the preliminary literal survey observed.

Djinni Spirit records APG Elemental Fist, UC Djinni rules and Unchained stamina separately. Mad Magic records ACG bloodrage and UC perfect clarity; the pinned Moment of Clarity record cites CRB and is preserved as such. Evolved Companion records APG summoner evolutions in addition to its ACG primary comparison. Phantom Fighter records OA phantom and APG Ectoplasmic Spell, including the exact PCGen APG row, plus CRB ghost touch. Undead Master (Mythic) records UM Undead Master independently of its Mythic variant.

Keen Scent retains the pinned Scent rule's multi-Bestiary citations, with Bestiary 1 as its observed minimum; no alternative edition is asserted to be the complete origin. Putrid Summons records Bestiary stench and CRB summoning/condition rules. Tail Weapon records Bestiary natural-attack mechanics and the literal Bestiary 2 serpentfolk comparison. Last Rites records GMG haunt and the pinned ARG resurrection-vulnerability citation. Rapid Recovery records every observed source code on its ambiguous Nanite Surge support rather than guessing one publication. Experienced Ghost Hunter retains the exact Planar Adventures Duskwalker supporting record. Bred Commander explicitly names Ultimate Campaign's mass-combat chapter. Rallying Blow explicitly restates mummy despair paralysis; the exact PCGen Bestiary rule and publication manifest establish its Bestiary 1 minimum. Core equipment-modifier rows separately support Channel Viciousness's vicious ability and Darkness Trick's flaming/brilliant energy abilities.

Special Delivery's Bonded Mind/Share Spells feat framework and Pathfinder Society permanent-possession exception remain **unidentified inherited origins** inside its named content hold. Marcher-Lord's Fey Obedience (Ragadahn) publication likewise remains unidentified from permitted text. Neither receives an invented book code or alias. Supporting YAML without source metadata is evidence of the rule body, never publication proof.

The structured `inheritedRuleNotices`, supporting source citations and `noticeHoldIds` are enforced by `catalog:notice-deps`. Warnings for this batch are checked against the complete text; older advisories remain with their owning batches.

## Exact dispositions

Every held row has its individual content hold and explanation in the inventory. Notice columns are minima, not origin bounds. Prose-only submechanics do not change the whole-entry held disposition.

| Stable key | Candidate | Disposition | Notice minima |
| --- | --- | --- | --- |
| `pf1-content/IPbUDmP3f4kPO9qG` | Juggle Load | Held: whole-content evidence unproven | PZO9415, PZO1110 |
| `pf1-content/ITAw9Xpklq238ScP` | Djinni Spirit | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1115, PZO1131 |
| `pf1-content/ITqwFw6U32n5YDML` | Keen Scent | Held: whole-content evidence unproven | PZO1115, PZO1110, PZO1112 |
| `pf1-content/IUHbImHrWLMXRhQs` | Dance of Chains | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/IUzKrBVsg404fxvF` | Compounded Pain | Held: whole-content evidence unproven | PZO1132, PZO1110 |
| `pf1-content/IYCPoKsmiPF9XYys` | Intoxicating Flattery | Held: whole-content evidence unproven | PZO1134, PZO1110 |
| `pf1-content/IYQKGt1UhPj7e7p7` | Improved Natural Poison Harvester | Held: whole-content evidence unproven | PZO1140, PZO1110 |
| `pf1-content/Ia2jzTn5oCsBMwg9` | Defended Movement | Held: whole-content evidence unproven | PZO9467, PZO1110, PZO1131 |
| `pf1-content/IapsYNlrnkJFlaFG` | Insightful Delivery | Held: whole-content evidence unproven | PZO1129, PZO1110 |
| `pf1-content/IbChM22QYqBIWbx2` | Ricochet Shot Deed | Held: whole-content evidence unproven | PZO1118, PZO1110 |
| `pf1-content/IbMVfEFNhX0Gqpzo` | Extraplanar Conjunction | Held: whole-content evidence unproven | PZO9280, PZO1110, PZO1112 |
| `pf1-content/IbXUxr2uSaPyh9hc` | Esoteric Linguistics | Held: whole-content evidence unproven | PZO1129, PZO1110 |
| `pf1-content/Ibw9oGMEm2iO0o7O` | Spirit Ally | Held: whole-content evidence unproven | PZO9471, PZO1110 |
| `pf1-content/IcDgu2teQslhNyvL` | Robust Stench | Held: whole-content evidence unproven | PZO9495, PZO1110 |
| `pf1-content/IeuaMaVp1PdiCz8d` | Hide Worker | Held: whole-content evidence unproven | PZO1140, PZO1110 |
| `pf1-content/Ifvt4Da1TJ08B5dH` | Saoc Brethren Initiate | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/IfzPoiKt1cBzJP76` | Team Up | Held: whole-content evidence unproven | PZO1115, PZO1110, PZO1131 |
| `pf1-content/IjaTNyflC8SxrxTy` | Feral Heart | Held: whole-content evidence unproven | PZO1125, PZO1110 |
| `pf1-content/IkY9OtoaCpKEGVCv` | Brute Style | Held: whole-content evidence unproven | PZO1135, PZO1110, PZO1118 |
| `pf1-content/IlaWfFKEyUImZyqL` | Hamatula Grasp | Held: whole-content evidence unproven | PZO9407, PZO1110 |
| `pf1-content/In5QP3qgs7Alsi04` | Ioun Resonance | Held: whole-content evidence unproven | PZO9495, PZO1110 |
| `pf1-content/InPLcJaPRwUAhPvC` | Hold the Blade | Held: whole-content evidence unproven | PZO9421, PZO1110 |
| `pf1-content/InqBwAJu1OZH2MTD` | Unseat (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110 |
| `pf1-content/Iq0wnVM5su2GlQ2R` | Throw Anything (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110 |
| `pf1-content/IqAWmPxwVYnhw72i` | Rallying Blow | Held: whole-content evidence unproven | PZO1110, PZO1112 |
| `pf1-content/IqqPIZhvFwbKieOw` | Cudgeler Sweep | Held: whole-content evidence unproven | PZO9455, PZO1110 |
| `pf1-content/IrGx6qRzbpbk5fxu` | Pass For Human | Held: whole-content evidence unproven | PZO1115, PZO1110 |
| `pf1-content/IrMhqjHOgNSOd2vW` | Redirected Shot | Held: whole-content evidence unproven | PZO9268, PZO1110, PZO1118, PZO1131 |
| `pf1-content/IsGNUF8XmxwTkxmI` | Opening Volley | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/IsOgnm716Swd9RfD` | Lighting the Way | Held: whole-content evidence unproven | PZO1110, PZO1125 |
| `pf1-content/ItlZ2Pj5HSM57yEb` | Mad Magic | Held: whole-content evidence unproven | PZO9451, PZO1110, PZO1129, PZO1118 |
| `pf1-content/IvO8jOBPfzAPOog1` | Wild Growth Hex | Held: whole-content evidence unproven | PZO1140, PZO1110, PZO1115 |
| `pf1-content/IwXxsUgBs5UhvWxf` | Blinding Sneak Attack | Held: whole-content evidence unproven | PZO9423, PZO1110 |
| `pf1-content/IxO3CFezH8oQ3VUO` | Channel Surge | Held: whole-content evidence unproven | PZO9457, PZO1110 |
| `pf1-content/Ixam2zxRd6IoOI82` | Kudzu Grappler | Held: whole-content evidence unproven | PZO1140, PZO1110 |
| `pf1-content/J0Ei2gDRVnGf5gCd` | Special Delivery | Held: whole-content evidence unproven | PZO1110, PZO1115, PZO1132 |
| `pf1-content/J0O4IfdXQrIBeE50` | Friendly Shroud | Held: whole-content evidence unproven | PZO9459, PZO1110 |
| `pf1-content/J0OrSFwDOvp2XNgJ` | Deathless Initiate | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/J1WnH6T8QVnjt3F8` | Focused Fey Expertise | Held: whole-content evidence unproven | PZO9478, PZO1110, PZO1112 |
| `pf1-content/J3IpquihEsm58vP4` | Putrid Summons | Held: whole-content evidence unproven | PZO1135, PZO1110, PZO1112 |
| `pf1-content/J3fOEFR8O1nIoXIe` | Fast Healer | Held: whole-content evidence unproven | PZO1115, PZO1110 |
| `pf1-content/J3wuUGFArbGNvA9E` | Stellar Wanderer | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/J4rmN6NRczsELiT9` | Quiet Death | Held: whole-content evidence unproven | PZO1134, PZO1110 |
| `pf1-content/J4w7nrpdzlYqLKOg` | Cranial Adjustment | Held: whole-content evidence unproven | PZO9461, PZO1110, PZO1132 |
| `pf1-content/J5edw8SYbo99nK2w` | Directed Disarm | Held: whole-content evidence unproven | PZO9452, PZO1110 |
| `pf1-content/J68M3IjsbQepuhwR` | Grand Master Performer | Held: whole-content evidence unproven | PZO9221, PZO1110 |
| `pf1-content/J97DPiHmXyUfcNLr` | Gorgon's Fist (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110 |
| `pf1-content/J9N5K79IaXDmJkAQ` | Experienced Ghost Hunter | Held: whole-content evidence unproven | PZO1110, PZO1141 |
| `pf1-content/JBVChVDTQxOcGEGD` | Spear Dancing Spiral | Held: whole-content evidence unproven | PZO9463, PZO1110 |
| `pf1-content/JC5uNLxTURjC3CJ8` | Reach Spell-Like Ability | Held: whole-content evidence unproven | PZO1135, PZO1110 |
| `pf1-content/JCxIAuj0ETT6MOCX` | Wily Warrior | Held: whole-content evidence unproven | PZO9469, PZO1110, PZO1125 |
| `pf1-content/JD1ox7C2ghErhCmg` | Devil's Foe | Held: whole-content evidence unproven | PZO9409, PZO1110 |
| `pf1-content/JFFVQrimZI6r59zX` | Sprightly Armor | Held: whole-content evidence unproven | PZO9467, PZO1110, PZO1131 |
| `pf1-content/JFUFEeKMPrmPeIFn` | Rapid Recovery | Held: whole-content evidence unproven | PZO9449, PZO1110, PZO1133, PZO9280, PZO9000-15E, PZO9251 |
| `pf1-content/JGkD6uoLAubgGjKe` | Familiar Focus | Held: whole-content evidence unproven | PZO9429, PZO1110 |
| `pf1-content/JL2J99cXWDWeQgVB` | Bookish Rogue | Held: whole-content evidence unproven | PZO1129, PZO1110 |
| `pf1-content/JLEjdb2agikSI1bk` | Uncanny Defense | Held: whole-content evidence unproven | PZO1121, PZO1110, PZO1131 |
| `pf1-content/JMV2SmDO6LyBNkO1` | Drinking Buddy | Held: whole-content evidence unproven | PZO92107, PZO1110 |
| `pf1-content/JReq4JlCG1IylOWq` | Improvisational Focus | Held: whole-content evidence unproven | PZO9493, PZO1110 |
| `pf1-content/JU8lnGIwz21ESKDi` | Defiant Luck | Held: whole-content evidence unproven | PZO1121, PZO1110, PZO1115 |
| `pf1-content/JWLLD7Y2eFUQlmGC` | Alignment Channel (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110 |
| `pf1-content/JWt3cKEiZFWnOXJ7` | Bolster Jinx | Held: whole-content evidence unproven | PZO9415, PZO1110 |
| `pf1-content/JYp3KC5jVI9sgsSL` | Pin Down | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/JZ4zPeCBqqQ4XDKI` | Evolved Companion | Held: whole-content evidence unproven | PZO1129, PZO1110, PZO1115 |
| `pf1-content/JZ8kCqp3Xe1TXxo3` | Blood Ties | Held: whole-content evidence unproven | PZO9411, PZO1110 |
| `pf1-content/Jb7UHhvoipN3tPfE` | Balor Whip | Held: whole-content evidence unproven | PZO1110, PZO1115 |
| `pf1-content/JbAgAWqoErAU9JjD` | Compulsion Mastery | Held: whole-content evidence unproven | PZO9463, PZO1110 |
| `pf1-content/JcrWK2u0aGQN0vdN` | Ki Channel | Held: whole-content evidence unproven | PZO9267, PZO1110 |
| `pf1-content/JgVMlg35jAHkzRXC` | Eclectic | Held: whole-content evidence unproven | PZO1115, PZO1110 |
| `pf1-content/JhPmcdU9GlS6imqM` | Unbalancing Blow | Held: whole-content evidence unproven | PZO9493, PZO1110, PZO1118 |
| `pf1-content/JiSXQmVAJbLXOy6b` | Bred Commander | Held: whole-content evidence unproven | PZO1110, PZO1125 |
| `pf1-content/JkMfttFr4G67Wicx` | Legalistic Reading | Held: whole-content evidence unproven | PZO9476, PZO1110 |
| `pf1-content/JlJT2s4OdHtzUSbQ` | Ordered Mind | Held: whole-content evidence unproven | PZO9420, PZO9267, PZO1110 |
| `pf1-content/JlTpUSYOGXIB08Bv` | Underhanded Teamwork | Held: whole-content evidence unproven | PZO9435, PZO1110, PZO1115 |
| `pf1-content/JlYrQzyyHuCqKEge` | Phantom Fighter | Held: whole-content evidence unproven | PZO1132, PZO1110, PZO1115 |
| `pf1-content/JlgThJpcAQCi5GHi` | Siphon Channel | Held: whole-content evidence unproven | PZO9267, PZO1110 |
| `pf1-content/JlkWmvlKmED8lkuM` | Tail Weapon | Held: whole-content evidence unproven | PZO1110, PZO1112, PZO1116 |
| `pf1-content/JmDbQ9dNAzAQNr7H` | Death from Below | Held: whole-content evidence unproven | PZO9434, PZO1110 |
| `pf1-content/Jphr6kIJa68yfe2S` | Diva Advance | Held: whole-content evidence unproven | PZO1138, PZO1110 |
| `pf1-content/JqbYYIlIXjyYItUT` | Quick Drag | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1115, PZO1131 |
| `pf1-content/JqqVqyIFvFmemS5B` | Volley Fire | Held: whole-content evidence unproven | PZO9452, PZO1110 |
| `pf1-content/Jsmgo2AkRUUc4sRW` | Motivating Display | Held: whole-content evidence unproven | PZO9439, PZO1110 |
| `pf1-content/Jv0B5hT5Ibt0lGkA` | Overwhelm | Held: whole-content evidence unproven | PZO9434, PZO1110 |
| `pf1-content/JviSQVoFf4MNmj42` | Flame Warrior | Held: whole-content evidence unproven | PZO1110, PZO1112 |
| `pf1-content/JwMygjmX7XO8DIfn` | Last Rites | Held: whole-content evidence unproven | PZO1110, PZO1114, PZO1121 |
| `pf1-content/JwNbPlbNiY6C63XM` | Spiritual Balance | Held: whole-content evidence unproven | PZO1132, PZO1110 |
| `pf1-content/Jwa3AMSlUuOEG7Ex` | Magical Heart | Held: whole-content evidence unproven | PZO9495, PZO1110 |
| `pf1-content/JyX9gOfjmDCkd4SZ` | Undead Master (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110, PZO1117 |
| `pf1-content/Jz9cggz7FKy4Esz2` | Spirit Talker | Held: whole-content evidence unproven | PZO1129, PZO1110, PZO1115 |
| `pf1-content/K18vW6ltCmfg7600` | Rapid Grappler | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/K1id8nMV3fXXYz6k` | Close Call | Held: whole-content evidence unproven | PZO9430, PZO1110 |
| `pf1-content/K4M3IpQp2wgkwjVi` | Arithmancy | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/K58XdsyGZLAH3NWu` | Channel Viciousness | Held: whole-content evidence unproven | PZO9267, PZO1110 |
| `pf1-content/K5a98x9vcYz3s8vS` | Darkness Trick | Held: whole-content evidence unproven | PZO1134, PZO1110 |
| `pf1-content/K5wpWsznKEHNPSUg` | Lesser Spell Synthesis | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/K6W2e28WzZmY2DOh` | Disposable Weapon | Held: whole-content evidence unproven | PZO1118, PZO1110 |
| `pf1-content/K6rgNzSTp55bWV5B` | Toppling Spell | Held: whole-content evidence unproven | PZO1117, PZO1110 |
| `pf1-content/K7NSrp2uPt6Anl0H` | Jawbreaker | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/K8DxdfDCLR6kRYTW` | Improved Forceful Charge | Held: whole-content evidence unproven | PZO1138, PZO1110 |
| `pf1-content/K8umTp9x4cgy8sCF` | Marcher-Lord of the Cerulean Abyss | Held: whole-content evidence unproven | PZO1110 |

## Mechanics and coverage

The [overlay](../../scripts/catalog/reviewed-curation.json) adds **100 checked description records**, including candidates outside the prose drafter's trigger. The required draft found zero raw notes, action conditionals or Item Ability records. The separate prose draft found 64 description candidates; manual complete-description review covers all 100. Required coverage passes with zero missing, stale or unresolved required records. **100 optional description diagnostics remain visible**: the inventory distinguishes exact mapped values from manual conditions, unsupported replacements/grants and intentionally unmodeled play-time rules. They are not attribution reasons and do not establish finished automation.

**31 numeric Modifiers on 14 candidates** preserve exact source values and restrictions. Defended Movement supplies +2 against attacks of opportunity and the stamina single-attack +4 end value; concurrent activation counts the same Source only once. Pass For Human is +10 only to human-disguise checks. Opening Volley is +4 only to the next melee attack against the ranged-damaged opponent before the end of the next turn. Directed Disarm retains two independent −4 circumstances with `stacksWithinEntry`, yielding −8 when both apply. Volley Fire retains manual ally-count values +1 through +4; multiple count selections do not exceed +4.

Feral Heart supplies +2 to the modeled Strength/Dexterity skills and +1 Reflex only while receiving a morale bonus on Strength or attacks. It does not alter ability scores; its ability-check target and condition delay remain gaps. Hide Worker retains the Craft(armor)/living-hide scope. Deathless Initiate, Hold the Blade, Cudgeler Sweep, Quiet Death, Throw Anything (Mythic), Improvisational Focus and Tail Weapon likewise retain local timing, weapon or check restrictions. No existing shared Situation matches these **complete** narrower scopes, so no broad shared condition is substituted and no new shared alias is invented.

Recipient effects never become bearer Modifiers: Intoxicating Flattery, Robust Stench, Lighting the Way, Cranial Adjustment, Grand Master Performer, Bolster Jinx, Motivating Display and Marcher-Lord retain their other-creature effects as readable Notes. Hamatula Grasp's −2 grapple replacement is not an additive penalty. Balor Whip remains a Note because its +2 must not stack with Improved Drag; unconditional separate Sources would add incorrectly. Rapid Grappler's −5 swift penalty and stamina +2 remain Notes, since selecting the stronger same-Source contribution would incorrectly produce +2 instead of −3.

Sprightly Armor's equipped armor enhancement dependency, Uncanny Defense's specific defensive-action dodge bonus, animal-companion evolution grants, phantom weapon/metamagic grants, chosen-spell/hex replacements, rank/resource schedules, natural attack grants, spell-slot alterations and recipient-bound calculations remain explicit row-level gaps. Senses, tactical actions, rerolls, timers, poison doses, cost discounts, current/temporary HP and Mythic resources stay readable prose under their feature scope. No flat bonus or permanent HP grant substitutes for these rules.

All authored prerequisite clauses and full-source parser atoms are retained. Supported ability/BAB/skill/class/level facts and exact identities remain intact; unchecked atoms are named as unresolved advisory facts, never assumed met. Repeatability remains `unreviewed`; the overlay cannot write this fact. Only Improvisational Focus grants weapon proficiency in operative prose, and its improvised-weapon grant/Weapon Focus equivalence is separately outstanding. Juggle Load, Sprightly Armor and Disposable Weapon's proficiency prerequisites grant nothing. Sources remain empty. Importer representation gaps belong to #719/#720; no importer or product code is changed.

## Public-boundary demonstration

The [fixtures](../../tests/fixtures/feats-344/README.md) preserve all 100 raw candidates, comparison/supporting snapshots and complete-source selected bodies. Exact ticket-order SHA-256 is `2baf45c61e4bcea7e5b8cea6d31b29d5486836b5cf4ffbfd86cab32d287e150f`. Reduced manifests retain only the candidate pack and an empty system packs directory; reduced extraction cannot silently establish complete release attribution.

[Catalog tests](../../tests/catalog/feats-344.test.ts) pin exact keys/bytes, checked outputs, current four-part attribution bindings, changed-content invalidation, all required notice holds and comparison/supporting hashes. Public resolver assertions pin +2/+4 AC, +10 human disguise, +4 timed melee, +1…+4 ranged ally counts, independent −4/−4 penalties, +2 balance and same-Source suppression. Negative checks keep recipient rules and unsafe replacements off bearer totals.

[The isolated saved-sheet test](../../convex/feats344.integration.test.ts) constructs Character-scoped **held** Pass For Human/Opening Volley fixtures, uses public selection/edit/read/catalog APIs, and compares saved/current/permanent statistics with catalog preview. Another campaign member can edit; unauthenticated callers, outsiders and cross-campaign references are refused. Local scopes apply only to the correct sheet entry and deactivation removes their contribution. No global release or production data is created. **An admitted-output demonstration is unavailable until these attribution/notice holds resolve**; held fixture behavior is not presented as admission.

## Commands and results

Every source command uses `--system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content`, with the exact 100-key selection for bounded runs. Drafts/previews and selections stay in task-owned ignored scratch, removed at handoff. The inherited `TMPDIR` stays outside worktrees under the parent's `.ep-tmp/`; no `/tmp`, environment file or private E2E data is touched. Final validation commands run sequentially, tests with `CI=true` and two workers. No full test suite runs.

`<selection>` below is the exact ticket inventory; `<output>` is an ignored, task-owned output directory. Both are deleted after verification.

| Command | Observed result |
| --- | --- |
| `pnpm -s catalog:curate --candidates <selection> --out <output>` plus pinned source arguments | Initial required pass: 0 required inputs; final pass: 2,321 records, 0 new/replaced/missing, 0 unresolved required mechanics. |
| Same command with `--descriptions` | Separate prose pass completed. Final pass has 0 new drafts; all 100 descriptions checked, with optional calculations explicitly outstanding. |
| `pnpm -s catalog:preview --candidates <selection> --out <output>` plus pinned source arguments | Passed: 100 entries, 0 resources, 0 admitted, 100 held, 0 dependent omissions/exceptions/failures. |
| Full-corpus `pnpm -s catalog:curate --out <output>` plus pinned source arguments | Exit 0, 5,904 records, 3,583 new drafts, 0 replacements/missing, 758 unresolved mechanics outside this batch. No importer crash. |
| Full-corpus `pnpm -s catalog:preview --out <output>` plus pinned source arguments | Exit 1: 23,109 entries and 538 resources; admission reports 59 admitted, 23,195 held, 2 dependent omissions, 0 exceptions and 4,689 failures outside #344. Final full-source extraction and public admission reassessment reproduce these counts, with zero #344 failures and all 100 current bindings. |
| `pnpm -s typecheck` | Passed, including the final evidence/fixture changes. |
| `pnpm -s lint` | Default 4 GiB app ESLint exhausted heap twice (exit 134). Equivalent whole-app ESLint rerun with an 8 GiB heap passed (exit 0); Convex ESLint and `pnpm -s lint:unused` both passed. This is the initial-run outcome; the correction round below changes the two heap budgets. |
| `pnpm -s check:initial-migration-writers` | Passed: 183 registered writers. |
| `pnpm catalog:pin` | Passed: pinned-source manifest `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`. |
| `pnpm catalog:notice-deps` | Passed: 0 gaps, waivers or stale dependencies; 36 advisories belong to older inventories, none to #344. Final audit also checks the mummy example and exact Core weapon properties. |
| `pnpm test tests/catalog convex/feats344.integration.test.ts --maxWorkers 2` | Passed: 78 files, 1,756 tests. Batch-only run passed 2 files / 6 tests. The final focused run passed 5 files / 50 tests, including prior-batch preservation and notice hold/dependency tests. |
| `pnpm -s catalog:format --check`, targeted Prettier and `git diff --check` | Canonical data, formatted TypeScript and whitespace checks passed. |

The initial 8 GiB app-lint run found an unused import and bracket notation in the new test; both were corrected before the final rerun. `node --max-old-space-size=8192 --max-semi-space-size=256 ./node_modules/eslint/bin/eslint.js . --ignore-pattern 'convex/**'` passed over the whole app. Typed schema loaders keep the bounded snapshots from becoming thousands of distinct TypeScript literal types. The test run excludes the full repository suite.

## Timing and workflow

Approximate active wall time: **38 minutes**, including sequential check waits. Local Stockholm time is UTC+02:00; the review date is October 9 despite October 8 UTC timestamps.

| Phase | Approximate local interval | Time |
| --- | --- | --- |
| Orientation, pinned-source verification and two draft passes | 00:14–00:16:35 | 2½ min |
| Complete-description review, comparisons, scoped outputs and initial binding | 00:16:35–00:28:39 | 12 min |
| Resolver/saved-sheet proofs, full/bounded gates, inherited-rule audit, lint recovery, report and handoff | 00:28:39–about 00:52 | 23½ min |

The largest workflow cost was sequential validation and the default lint heap failures. No book PDFs were available, so partial PCGen rows could not produce admissions. Tooling gaps remain attached to #719/#720; these holds do not turn unfinished mechanics into completed work.

The old #343 preservation test treated every future assessment as part of its historical 2,334-row baseline. The shared correction reviewed for #526 (commit `3bdf2e67`) is reused verbatim in `tests/catalog/feats-343.test.ts` and `tests/fixtures/feats-343/original-assessment-identities.json`. It pins the immutable 2,334-key baseline, original full-row fingerprint and 99 trailing-space rationales, with missing-identity, trimmed-value and later-addition cases. The duplicate #344 identity fixture is removed. This changes a test fixture/boundary only; all pre-existing reviewed data is value-equal to the launch baseline. No product, importer, resolver or backend implementation fix was necessary.

Name matches and primary comparison bibliographies do not bound full descriptions, appended rules, linked content or notice chains. Unidentified inherited origins stay named rather than receiving plausible aliases. Required-note success also does not mean optional description calculations are complete. The full preview separates failures outside this batch from the passing bounded result. All changes remain uncommitted for the orchestrator, with no Git/GitHub write, deployment or production activation. The launcher captures the final response at its supplied `-o` path; no answer file is created in the repository.


## Correction round 1 — shared preservation test and lint budget

The #343 historical-boundary correction approved for #526 at `3bdf2e67` is reused verbatim, including its shared identity fixture. The duplicate #344 identity fixture is removed. The test still checks 2,334 original identities, the exact full-row fingerprint `ad685721d0b6fb0d3d2250548c285d6013e7eb318dcf8f8e99dcad21f52dedeb` and 99 trailing-space rationales. Its additional cases reject missing original rows and whitespace changes while accepting later assessment additions. No assertions are weakened.

The shared landing gate exhausted the hardcoded 4 GiB application ESLint heap: the #526 gate dated 2026-10-09 00:33:47 reported `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`, after Mark-Compact retained 4,067.4 MB in a 4,170.9 MB heap. The initial #344 run independently hit this limit twice with exit 134, and #289 also exhausted 4 GiB. Identical scopes passed at 8 GiB in those runs. Under the brief's minimal tool-bug exception, only `lint:eslint:app` and `lint:eslint:convex` change `--max-old-space-size=4096` to `8192`. Scopes, rules, semi-space budget and command chaining are unchanged. There are no timeout, assertion or product-code changes.

| Correction check | Result |
| --- | --- |
| `CI=true pnpm test tests/catalog/feats-343.test.ts tests/catalog/feats-344.test.ts tests/catalog/notice-holds.test.ts tests/catalog/notice-dependencies.test.ts convex/feats343.integration.test.ts convex/feats344.integration.test.ts --maxWorkers 2` | Passed: 6 files, 54 tests. |
| `pnpm -s typecheck` | Passed. |
| `pnpm -s lint` | Passed, exit 0, using the corrected 8 GiB heap in both existing scopes; app ESLint, Convex ESLint and unused-code checks all completed. |
| `pnpm -s catalog:format --check` | Passed; no data rewritten. |
| `pnpm catalog:notice-deps` | Passed: 4,476 dependencies, zero gaps/waivers/stale dependencies; 36 existing advisories outside #344. |
| `pnpm catalog:pin` | Passed; unchanged `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`. |
| `pnpm -s check:initial-migration-writers` | Passed: 183 registrations. |
| Targeted Prettier write/check | Passed; `package.json` and the reviewed test were already formatted, so their bytes were unchanged by formatting. |
| Exact preservation/diff review | Passed: exactly six authorized paths differ from correction launch; 6,367 other launch files are byte-identical. Both shared files match the reviewed #526 copies byte-for-byte. The package diff contains only the two heap-flag replacements. |

All curation artifacts, source/binding fixtures, content, notice, evidence and assessment values are byte-identical to the initial handoff: **100 held, zero admissions**. Existing attribution holds and outstanding mechanics remain unchanged. This correction runs neither unchanged full-corpus import/preview nor the full suite; the initial full-batch outcomes above accompany the orchestrator's subsequent landing gate. The inherited external `TMPDIR` remains for launcher cleanup, and only task-owned correction scratch is removed.

Correction timing: approximately 40 seconds to read the brief and overlap evidence; 20 seconds for snapshot, copy and edits; 3 minutes for focused checks, standard lint and report/preservation review; under 1 second for scratch cleanup. The original full-batch phase timings remain above. The only new workflow blocker was the independently reproduced 4 GiB lint budget, corrected without changing any scope or rule.

## Correction round 2 — clean-checkout fixture portability

The orchestrator's clean gate at reviewed commit `c471f8c40437381a616406d7b4bf2f8da8e5d948` passed 7,870 tests but failed the #344 importer replay with `ENOENT` while scanning `tests/fixtures/feats-344/pf1/packs`. That directory existed empty locally and had no tracked file. This correction adds only the zero-byte `tests/fixtures/feats-344/pf1/packs/.gitkeep`, following the existing #343 fixture convention. The importer considers only directories when enumerating packs, so the placeholder introduces no pack or content. This was the only empty directory under the #344 fixture; no other placeholder is needed.

A fresh verification copy was built exclusively from the launch's tracked paths, excluding all `.env` paths and private E2E paths, with the installed dependencies linked separately. Empty directories were never copied. The unchanged importer replay first reproduced the exact missing-directory error in 5 ms. Adding the proposed placeholder to that copy made the same existing test pass. The complete catalog suite and both batch saved-sheet tests then passed there. No test assertion, setup, importer implementation, seed or source record changes.

| Correction check                                                                                                                                               | Result                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CI=true pnpm test tests/catalog convex/feats343.integration.test.ts convex/feats344.integration.test.ts --maxWorkers 2` in the tracked-file verification copy | Passed: 79 files, 1,760 tests, 102.59 seconds, including the actual #344 importer replay, #343 preservation, holds, notice dependencies and both saved-sheet tests.                                                                                                          |
| `CI=true pnpm -s typecheck`                                                                                                                                    | Passed in 6.75 seconds.                                                                                                                                                                                                                                                      |
| `CI=true pnpm -s lint`                                                                                                                                         | Passed in 116.28 seconds using the existing 8 GiB package budgets, including both ESLint scopes and unused-code checks.                                                                                                                                                      |
| `CI=true pnpm -s check:initial-migration-writers`                                                                                                              | Passed: 183 registrations, 0.78 seconds.                                                                                                                                                                                                                                     |
| `CI=true pnpm catalog:pin`                                                                                                                                     | Passed: unchanged `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`, 0.27 seconds.                                                                                                                                                                   |
| `CI=true pnpm catalog:notice-deps`                                                                                                                             | Passed: 4,476 dependencies, zero gaps, waivers or stale dependencies; 36 existing advisories outside #344, 1.03 seconds.                                                                                                                                                     |
| `CI=true pnpm -s catalog:format --check` and changed-addendum Prettier check                                                                                   | Passed; shared data was not rewritten. Canonical-data check took 0.53 seconds.                                                                                                                                                                                               |
| `git diff --check` and exact launch-byte preservation                                                                                                          | Passed: the existing report is preserved as a byte-exact prefix, and all 6,396 other inspected tracked paths are byte-identical to reviewed commit `c471f8c4`. Exactly the report and new placeholder change. Environment files and private paths were never read or copied. |

The inventory, overlay, assessments, evidence, hold registry, candidate and binding snapshots, permitted comparison/supporting sources, shared #343 preservation correction, tests and lint tooling remain byte-identical. Dispositions remain **100 held, zero admitted**; all 52 notice-chain holds and outstanding mechanics remain unchanged. Volley Fire, Tail Weapon and Marcher-Lord retain the accepted review judgements without further curation.

Correction timing: approximately one minute for orientation and tracked-file reproduction, under ten seconds for the placeholder, 1 minute 43 seconds for catalog/saved-sheet tests, 2 minutes 6 seconds for sequential static gates, and approximately one minute for this addendum, formatting, preservation and cleanup. The workflow defect was an empty directory omitted from the tracked fixture, now preserved without inventing content. No full suite, Git/GitHub write, deployment or source-tree write occurred. Task-owned scratch and the verification copy were removed; the inherited external `TMPDIR` remains for launcher cleanup. Changes remain uncommitted for the orchestrator's clean landing gate.
