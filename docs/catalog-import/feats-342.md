# Feats batch #342 — pf1-content, batch 9

Reviewed by **Sol (AI curator) for the owner**, 2026-10-08, under [#342](https://github.com/AndreasUnunger/EverythingPath/issues/342), PRD [#251](https://github.com/AndreasUnunger/EverythingPath/issues/251) Implementation Decision 17 and its acceptance appendix. Exactly **100 candidates: 2 admitted and 98 specifically held**. Zero dependent omissions, whole-entry unsupported/prose-only dispositions, exclusions or retained exceptions. No Catalog Release is published.

## Evidence and attribution

The [single inventory and mechanics review](../../scripts/catalog/legal/feats-342.json) records every key, disposition, byte/description hash, source location, complete source description and structured field, comparison, prerequisite/proficiency review, notice minimum, named hold and calculation gap. Complete source pins are Foundry PF1 v11.11 `418761d2e16a6037c0156bb4a241f7cea5a2986d` and pf1-content 11.4.0 `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`; both were verified before catalog commands. Every candidate source array is empty and remains empty. Attribution evidence does not backfill user-facing Sources. Stable identities/remaps are unchanged.

Permitted comparison used PCGen at `25523dbcf10e86c280fc0f447167ea43d67419d3`. Eighteen comparison files have recorded hashes, and 48 candidates have literal comparison leads. Forty-six are partial comparisons; only the two ordinary CRB Skill Focus variants have a complete semantic comparison. No book PDFs are available. Archives of Nethys was not used. The PRD and content contracts establish scope and behavior, not attribution.

Skill Focus (Handle Animal) and Skill Focus (Disable Device) compare against [PCGen CRB Skill Focus, line 156](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst#L156). The exact +3/+6 Benefit at 10 ranks, chosen-skill introduction and encoded `MULT:YES`, `STACK:NO`, `CHOOSE:SKILL|TYPE=Base` cover the complete Special section. Independent ordinary CRB skill rows are [Handle Animal, line 40](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_skills.lst#L40) and [Disable Device, line 36](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_skills.lst#L36). There is no appended Combat Trick, adapted skill or linked rule body. This follows the ordinary CRB admission precedents #338/#339 and reuses the existing reviewed CRB/PZO1110 identity. PCGen campaign copyright lines are comparison provenance, not additional entry-specific inherited dependencies or fresh book-chain approval. Automatic rank dispatch and repeatability remain mechanics gaps.

All 100 [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence records](../../src/lib/catalog/data/attribution-evidence.json) bind the complete pinned extraction, evidence and current notices. Reduced fixtures never establish release attribution. The 98 unresolved assessments enforce individual `feats-342-whole-content-<upstream-id>` holds; unknown origins stay unknown. Twenty non-CRB complete-chain notice holds, covering 21 observed notice minima including CRB, are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json). No previous hold is cleared. Existing Registry text, aliases, resources and permanent notice superset are unchanged; no new aliases reconcile unresolved variants.

## Inherited-rule audit

All 100 complete descriptions and structured fields were audited. Twenty-nine supporting snapshots (25 pinned raw records and four PCGen row occurrences in three files) document selected dependencies. All 15 appended Combat Trick descriptions require PZO1131, including feats without a Combat Trick tag. Mythic feats require PZO1126. Shatterspell requires PZO1118 for spell sunder and PZO1131 for stamina; Variant Prayer Scroll requires PZO1120 for Jiang-Shi and PZO1110 for its spells; Ritual Mask requires PZO1132 for occult rituals/medium powers and PZO1129 for shaman abilities. Strange Yield requires PZO1123 for Ultimate Equipment Table 7-17 and PZO1140 from its Gathlain source citation.

Wyvaran Spellcasting explicitly cites PZO9226 and PZO9267 for Scalykind/Dragon domain rules; its pinned Wyvaran record also cites PZO9280. Scaled Disciple's Dragon subdomain is corroborated by the pinned PCGen Inner Sea Gods p.224 row, so it requires PZO9267. Deific Obedience's literal PCGen row and Evangelist schedule corroborate PZO9267. Strength in Defeat requires the specific Half-Drow (Darkborn) input, whose pinned record cites PZO9491 and PZO9442; those unresolved product-code chains remain held with no invented Registry alias. These are observed minima, never an assertion of complete origins for held candidates.

`catalog:notice-deps` passes with no dependency gaps, waivers or stale waivers. There are no advisory warnings for this batch. The 36 warnings in older batches remain their owners' work; this batch does not clear the inherited-notice audit holds for #333–#336 or #516–#519. No record-level `3.5` tag occurs. The owner policy holds such tags, never excludes them; the importer excludes whole 3.5 packs only.

## Exact dispositions

Each held row records its exact whole-content hold and missing evidence in the inventory. Notice requirements below are minima for held content; prose-only submechanics do not change whole-entry disposition.

| Stable key | Candidate | Disposition | Observed notice minima |
| --- | --- | --- | --- |
| `pf1-content/F9IAOMmLVUzbWBqY` | Intimidating Bane | Held: complete attribution/notice evidence missing | PZO1118, PZO1115, PZO1110 |
| `pf1-content/FAf2o9ivDcmfijMe` | Confusing Stare | Held: complete attribution/notice evidence missing | PZO1132, PZO1110 |
| `pf1-content/FBX9S7rtQ70aaIgP` | Crane Wing | Held: complete attribution/notice evidence missing | PZO1118, PZO1110, PZO1131 |
| `pf1-content/FDQoE1u3zwziZzmg` | Sin Seer | Held: complete attribution/notice evidence missing | PZO1117, PZO1110 |
| `pf1-content/FEKZXquPPDk2nv3R` | Cut from the Air | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FGM4u4RIPfEa3XSo` | Cartogramancer | Held: complete attribution/notice evidence missing | PZO1134, PZO1110 |
| `pf1-content/FGOCJ6hzQAypSLig` | Coven-Touched | Held: complete attribution/notice evidence missing | PZO1115, PZO9280 |
| `pf1-content/FH4TaBjSFfdXH0Fh` | Indomitable Mountain Peak | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FHgr2SkKwzM76xax` | Horse Sense | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FHwdn0OHWoBzXxqc` | Shatterspell | Held: complete attribution/notice evidence missing | PZO1121, PZO1118, PZO1131 |
| `pf1-content/FIT8Ya1y6UV9xlHi` | Stock-Striker Style | Held: complete attribution/notice evidence missing | PZO1118 |
| `pf1-content/FJUZ0VwIHXiI6HKn` | Cloud Step | Held: complete attribution/notice evidence missing | PZO1115, PZO1110 |
| `pf1-content/FKTmKcWAVPqYHaRT` | Sharp Senses | Held: complete attribution/notice evidence missing | PZO1115, PZO1110 |
| `pf1-content/FLF3xite6IebjGrL` | Elemental Jaunt | Held: complete attribution/notice evidence missing | PZO1121, PZO1110, PZO1115 |
| `pf1-content/FNsnOcT1CwgSZ9i9` | Devilish Pride | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FPumBUPWiOc6ocVA` | Variant Prayer Scroll | Held: complete attribution/notice evidence missing | PZO1120, PZO1110 |
| `pf1-content/FQSd3ZE48uqmPZST` | Upsetting Vengeance | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FRUVWHEI4t4hX2w8` | Cunning Killer | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FRjSkpb8sGkt7VNx` | Lightning Reflexes (Mythic) | Held: complete attribution/notice evidence missing | PZO1126, PZO1110 |
| `pf1-content/FT4EdKtDVPH10JvN` | Signature Deed | Held: complete attribution/notice evidence missing | PZO1118 |
| `pf1-content/FZ9LSndkgnTTynLm` | Horse Master | Held: complete attribution/notice evidence missing | PZO1118, PZO1115, PZO1110, PZO1131 |
| `pf1-content/FhhinvHJvHrHGc3G` | Terrifying Assault | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/Fir5fuh0SqWX6wtw` | Disengaging Shot | Held: complete attribution/notice evidence missing | PZO1118, PZO1110, PZO1131 |
| `pf1-content/FjUMqXq3lqy1QiRW` | Nature Magic | Held: complete attribution/notice evidence missing | PZO1129, PZO1110 |
| `pf1-content/FkuLvwczla3jZ0eC` | Intense Blows | Held: complete attribution/notice evidence missing | PZO1110, PZO1131 |
| `pf1-content/Fn0sjepeoBsMeScN` | Terrifying Mask | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FnlIuKvSNhnrKniV` | Reflexive Crystalline Dust | Held: complete attribution/notice evidence missing | PZO1141 |
| `pf1-content/Fnrr3ZQtRugP4SFl` | False Trail | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FoH6mHqWlkYnWLF6` | Deific Obedience | Held: complete attribution/notice evidence missing | PZO9267 |
| `pf1-content/FpM4NWzDDJMt0NcJ` | Minor Spell Expertise | Held: complete attribution/notice evidence missing | PZO1115, PZO1110 |
| `pf1-content/FqTvsz0tj8LalOVz` | Murderous Sniper | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FqzR9b2PnzAil3El` | Divine Protection | Held: complete attribution/notice evidence missing | PZO1129, PZO1110 |
| `pf1-content/FrDEa6ZNhEFmfCRe` | Scaled Disciple | Held: complete attribution/notice evidence missing | PZO1110, PZO9267 |
| `pf1-content/FrJ9sZbWnZC6wNEx` | Destroyer's Blessing | Held: complete attribution/notice evidence missing | PZO1121, PZO1110, PZO1131 |
| `pf1-content/FtftynWKE4dMvwtT` | Janni Style | Held: complete attribution/notice evidence missing | PZO1118, PZO1110, PZO1131 |
| `pf1-content/FuXXGRlxX6r14mov` | Ability Mastery | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/Fw3nnXTNQJprnZZR` | Water Skinned | Held: complete attribution/notice evidence missing | PZO1121 |
| `pf1-content/FwxoL5PgQcg5wXXs` | Fire Hand | Held: complete attribution/notice evidence missing | PZO1121, PZO1110, PZO1131 |
| `pf1-content/FyYtAMjNpfUKppiF` | Omnipresent Mentor | Held: complete attribution/notice evidence missing | PZO1134, PZO1110 |
| `pf1-content/Fz547hoRnsfKHkyt` | Twin Fang Strike | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/FzaG7T6dKfpILikX` | Sabotage Specialist | Held: complete attribution/notice evidence missing | PZO1134, PZO1110 |
| `pf1-content/FzgYIJkO0HLUUyhr` | Blustering Bluff | Held: complete attribution/notice evidence missing | PZO1134, PZO1110 |
| `pf1-content/FzsUZbC5NBUHzbkV` | Snake Style | Held: complete attribution/notice evidence missing | PZO1118, PZO1110, PZO1131 |
| `pf1-content/G02Q3ltpYqvmVdGm` | Master Combat Performer | Held: complete attribution/notice evidence missing | PZO1118 |
| `pf1-content/G0hVIjOcoZM6daTy` | Harder They Fall | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/G0iS8KFVmOh1Vemk` | Favored Defense | Held: complete attribution/notice evidence missing | PZO1115, PZO1110 |
| `pf1-content/G0jXVBiEM8P9OrZK` | Smash from the Air | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/G0vFD0poziCO3Mco` | Stumbling Bash | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/G166WP6v0sUhlFy2` | Vengeful Death Vow | Held: complete attribution/notice evidence missing | Origin not bounded |
| `pf1-content/G1ouaif2DZKo3kGr` | Hellish Shackles | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/G1wGLIjaPwXR1adm` | Battle Cry | Held: complete attribution/notice evidence missing | PZO1129, PZO1110, PZO1131 |
| `pf1-content/G3ZXAW3g0jHmxFaa` | Reverse Somersault Throw | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/G3hvgEOC1fr321Vz` | Whirling Hold | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/G3yPmoVa0D7uIbEF` | Skill Focus (Handle Animal) | Admitted: confirmed ordinary CRB comparison | PZO1110 |
| `pf1-content/G44jAJNMGpqdDRml` | Cunning Caster | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/G4oitGaGpJWGCF4c` | Greater Channel Smite | Held: complete attribution/notice evidence missing | PZO1118, PZO1110 |
| `pf1-content/G5WSVf9vIzDy8P27` | Wyvaran Spellcasting | Held: complete attribution/notice evidence missing | PZO1110, PZO9226, PZO9267, PZO9280 |
| `pf1-content/G5eYFdj6Wzn7VO25` | Gun Twirling | Held: complete attribution/notice evidence missing | PZO1118, PZO1110 |
| `pf1-content/G5imLkn7j81m0p5w` | Spiritualist's Call | Held: complete attribution/notice evidence missing | PZO1132 |
| `pf1-content/G6JChuMKm61aE8NM` | Improved Possession | Held: complete attribution/notice evidence missing | PZO1110, PZO1112 |
| `pf1-content/G6T9M03H992ifjoq` | Kobold Flood | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/G8ieeQzREc6pxkZi` | Improved Disarm (Mythic) | Held: complete attribution/notice evidence missing | PZO1126, PZO1110 |
| `pf1-content/G8lam7xmCSeCwmHl` | Expert Driver | Held: complete attribution/notice evidence missing | PZO1118 |
| `pf1-content/G91IU8qGRQtguruy` | Shared Insight | Held: complete attribution/notice evidence missing | PZO1115, PZO1110 |
| `pf1-content/GD9p63eAGY4TppNL` | Shark Leap | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GD9xIfjHijOQuxNV` | Flexible Wizardry | Held: complete attribution/notice evidence missing | PZO1129, PZO1110 |
| `pf1-content/GDqMCbYvnGWjvJ1g` | Ritual Mask | Held: complete attribution/notice evidence missing | PZO1132, PZO1129 |
| `pf1-content/GEGSG0GUF5criHIN` | Noble Scion (Oppara) | Held: complete attribution/notice evidence missing | PZO1110, PZO1132 |
| `pf1-content/GERM6mEyQmJicki0` | Diplomatic Ruse | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GFDpDZGjX8bjRO6a` | Tyrant's Rebuke | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GG9cjvltryzq4pVF` | Trapper's Setup | Held: complete attribution/notice evidence missing | PZO1118, PZO1110 |
| `pf1-content/GGLGXLgTw0IaBPSI` | Bristling Drag | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GGldJN9ezbPwiCM8` | Outslug Style | Held: complete attribution/notice evidence missing | PZO1110, PZO1129 |
| `pf1-content/GIlA5yikFa2nMfMp` | Life Lure | Held: complete attribution/notice evidence missing | PZO1117, PZO1110 |
| `pf1-content/GJiXfYNbcSCbigH2` | Strange Yield | Held: complete attribution/notice evidence missing | PZO1123, PZO1140 |
| `pf1-content/GJwMe37zzAqMFMhd` | Befuddling Initiative | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GMLs9ZAYcozggioA` | Thuvian Grenadier | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GN6tgww9K0rumZV7` | Tree Hanger | Held: complete attribution/notice evidence missing | PZO1121, PZO1110, PZO1131 |
| `pf1-content/GNTfwVIU6nQI1BL2` | Heavy Gravity Acclimation | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GNjhp5O8pKdOTacT` | Fabulist | Held: complete attribution/notice evidence missing | PZO1118, PZO1110 |
| `pf1-content/GO2UrQa2rvXNVtpT` | Focused Overseer | Held: complete attribution/notice evidence missing | PZO1125 |
| `pf1-content/GPug5Xucoq4JgnJm` | Bloodstone Manhunter | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GRDwQqsvtspPHrHj` | Desperate Swing | Held: complete attribution/notice evidence missing | PZO1121, PZO1110, PZO1131 |
| `pf1-content/GRJ3mfsDf9SZ2VRH` | Extra Impromptu Sneak Attack | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GSfSG50EylXqK4yg` | Psychic Defender | Held: complete attribution/notice evidence missing | PZO1132 |
| `pf1-content/GT15HcCVnR4eb4g5` | Bag of Bones | Held: complete attribution/notice evidence missing | PZO1112, PZO1110 |
| `pf1-content/GT7XbeOhKUS8fDN0` | Jackal Heritage | Held: complete attribution/notice evidence missing | PZO1110 |
| `pf1-content/GVjFNXqADJ9ey0aN` | Martial Versatility | Held: complete attribution/notice evidence missing | PZO1121, PZO1110, PZO1131 |
| `pf1-content/GZhvvVMoMONUqrcx` | Heroic Will | Held: complete attribution/notice evidence missing | PZO1121, PZO1110 |
| `pf1-content/Ga7V6a4VSOh1B3X8` | Jabbing Dancer | Held: complete attribution/notice evidence missing | PZO1129, PZO1110, PZO1131 |
| `pf1-content/GcRUuGEVM5phniRN` | Disruptive (Mythic) | Held: complete attribution/notice evidence missing | PZO1126, PZO1110 |
| `pf1-content/GdKDOBJJVUMBbGsY` | Shared Ownership | Held: complete attribution/notice evidence missing | Origin not bounded |
| `pf1-content/GeH7tN9Wa9RMPaes` | Giant Steps | Held: complete attribution/notice evidence missing | PZO1121, PZO1110 |
| `pf1-content/Ggdpn0yvFTasaJYN` | Create Sanguine Elixir | Held: complete attribution/notice evidence missing | PZO1117, PZO1110 |
| `pf1-content/Gh3KmIsY9tcDItvL` | Spinning Throw | Held: complete attribution/notice evidence missing | PZO1118, PZO1110, PZO1115, PZO1131 |
| `pf1-content/Gh5GBGDcnhy6BrLg` | Redistributed Might | Held: complete attribution/notice evidence missing | PZO1110, PZO1129 |
| `pf1-content/GjXeTboo2ZfulGuq` | Antagonize | Held: complete attribution/notice evidence missing | PZO1117, PZO1110 |
| `pf1-content/GkXR16mJaUmUbjhJ` | Strength in Defeat | Held: complete attribution/notice evidence missing | PZO9491, PZO9442 |
| `pf1-content/GkcekdZwcwMwI6ss` | Skill Focus (Disable Device) | Admitted: confirmed ordinary CRB comparison | PZO1110 |
| `pf1-content/Glr7G4tA1G2pGqdg` | Blunt Blade | Held: complete attribution/notice evidence missing | PZO1115, PZO1129 |

## Mechanics and separate prose pass

The required note/action-conditional/Item Ability inventory is empty for these feats. The drafter retained existing checked records and added no required drafts. The separate `--descriptions` pass added 62 drafts. Independent complete review then supplied **100 checked description records**, including the other 38 descriptions, and **36 numeric Modifiers**. Complete Benefit, Normal, Special and appended Combat Trick rules remain readable Notes; flavor/prerequisite text stays in the full description. No placeholder becomes checked. Optional unresolved description calculations remain separate from required coverage and attribution.

Shared Situations are used when they cover the full scope: Tree Hanger's ordinary CMD +2 uses `trip`; Jackal Heritage's +2 racial saves use `mindAffecting`. Local Situations retain complete extra restrictions for tail hanging, active styles, bane type, pistol-whip firearm choice and prone check, ranks, Power Attack timing, chosen noble family, Perform specialization and current-HP threshold. Crane Wing also retains awareness, non-flat-footed state and loss/reset until the beginning of the next turn. Ordinary Snake Style Sense Motive +2 and Jackal Heritage Perception +2 are unconditional. Source identity remains the exact rule; copies suppress duplicate contributions.

The numeric schedules include Cunning Killer's `min(4, 1 + floor(BAB / 6))`, Intense Blows' `1 + floor(BAB / 4)` and Strength in Defeat's +1/+2/+3 at levels 1/8/15. They apply only under their complete local Situations. Skill Focus supplies manual +3 below 10 ranks and +6 at 10 or more; the raw `ifelse(gte(...),6,3)` remains unsupported and contributes nothing. Selecting both alternatives uses the stronger +6, not +9. No automatic rank dispatch is claimed.

**78 candidates retain named outstanding calculations.** Target-only effects never become owner Modifiers: Battle Cry and Shared Insight affect allies; Spiritualist's Call affects the phantom; Stumbling Bash and Vengeful Death Vow affect opponents. SLA/DC/resource/companion/table/replacement/routine calculations remain individually named in the inventory. Two notable source gaps are preserved:

- Ability Mastery's raw unconditional +2 enhancement Strength conflicts with the complete chosen-ability, activation, qualifying worn item and 24-hour rules. The current overlay appends and cannot remove that raw change. Its imported value is recorded as erroneous and is never demonstrated as correct.
- Bag of Bones says +5 competence Escape Artist, then “increases to +4” at 10 HD. The conflict needs permitted publication evidence; no corrected value is guessed or emitted.

Other replacement/nonstacking gaps include Sharp Senses replacing keen senses, Janni Style charge/flanking replacements, Divine Protection's existing Charisma nonstacking and Bloodstone Manhunter's favored-enemy nonstacking. Adding blanket bonuses would miscalculate those cases. Fire Hand's torch proficiency, Master Combat Performer's performance-weapon proficiency, Noble Scion's selected-family proficiency/class-skill facts and Fabulist's class-skill grant have no supported overlay write; they remain named outstanding facts. Proficiency prerequisites grant nothing by themselves.

Every normalized prerequisite atom and referenced identity was compared with the complete authored line. Numeric ability/BAB/skill/class/character-level facts and supported identities are retained. Fifty-two candidates have uncheckable clauses. Four named parser/representation corrections remain: Elemental Jaunt's racial alternatives, Jabbing Dancer's BAB/class alternatives, Diplomatic Ruse's Keleshite restriction and Ritual Mask's “one or more” ritual phrase. Every imported feat still has the `repeatable: unreviewed` sentinel; the overlay cannot write repeatability. The isolated adapter omits it without guessing a replacement. Missing calculations/facts are not converted to attribution holds, and no importer or product code is changed.

## Public-boundary demonstration

The [fixtures](../../tests/fixtures/feats-342/README.md) contain the 100 byte-exact candidate YAML files, 28 unique supporting files, complete-source normalized bodies, hashes and explicit reduced manifests. Exact ticket-order key SHA-256: `aa926bab4c697295fee06b30cccd2f20ec7e782522fefbe3e51b5a6ee34600eb`.

[Catalog tests](../../tests/catalog/feats-342.test.ts) pin all source bytes, the exact inventory, mapped facts, complete-source attribution bindings, enforced notices, changed-content invalidation, shared/local Situations, manual rank values and Source suppression. For each admitted Skill Focus, the public resolver also selects both the +3 and +6 rank Situations together and asserts a total of +6. The public resolver exercises every level 1–20 for Strength in Defeat and BAB 0–20 for the two BAB schedules, while ordinary totals remain unaffected. Tests pin the conflicting source amounts as outstanding.

[Two isolated saved-sheet tests](../../convex/feats342.integration.test.ts) select both admitted Skill Focus bodies through public writers, compare saved/current/permanent and catalog-preview outcomes, then demonstrate a separately marked held Tree Hanger fixture. A campaign member can edit; outsiders, unauthenticated callers and cross-campaign references are refused. Wrong-selection local Situations cannot apply. Deactivation removes the benefit. These Character-scoped fixture definitions do not publish held content, construct a Catalog Release or change global admission. No remote deployment, production data or activation is involved.

## Commands and observed results

Source arguments for catalog commands are the two verified pinned checkouts named above. Candidate selection and command output stayed in ignored worktree scratch and are removed after reporting. Checks run sequentially, one heavy job at a time; no full `pnpm test` run.

| Command | Observed result |
| --- | --- |
| `catalog:curate --candidates …` | Initial exact-batch draft: 1,921 retained records; zero new/replaced drafts, missing records or unresolved required mechanics. |
| `catalog:curate --candidates … --descriptions` | Initial separate prose pass adds 62 drafts. Final pass retains 2,021 records, adds/replaces zero drafts, with zero missing or unresolved required mechanics. |
| `catalog:preview --candidates …` | Pass: exactly 100 entries, two admitted, 98 held, zero failures/dependent omissions/retained exceptions. Required coverage is 0/0; all 100 descriptions are checked. The 78 optional calculation gaps stay named. |
| Full-source `catalog:preview` | 23,109 entries and 538 resources; 58 admitted, 23,196 held, two dependent omissions, zero exceptions. Nonzero exit reports 4,689 failures outside these 100 candidates. All 100 normalized bodies and all 400 current binding fields were verified; this batch has zero failures. |
| Full-corpus `catalog:curate` | Exit 0: 5,604 records, 3,583 scratch drafts, zero replacements/missing; 758 unresolved mechanics elsewhere. No corpus drafts are committed. |
| `pnpm -s typecheck` | Pass after the final label/test refinements. |
| `pnpm -s lint` | Pass after the final label/test refinements. |
| `pnpm -s check:initial-migration-writers` | Pass: 183 registrations. |
| `pnpm catalog:pin` | Pass: `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`. |
| `pnpm catalog:notice-deps` | Pass: 3,507 dependencies / 2,203 candidates / 25 inventories; zero gaps, waived or stale dependencies. The 36 older advisories include none from #342. |
| `pnpm test tests/catalog convex/feats342.integration.test.ts --maxWorkers 2` | Pass: 72 files and 1,673 tests, including 12 batch catalog tests and two isolated saved-sheet tests (88.18 seconds). |
| `pnpm -s catalog:format --check` and `git diff --check` | Pass: catalog files are canonical; no whitespace errors. |

Full-source extraction fingerprint after the scoped label refinements: `8b4e24bbf3ec817f69481581c60c4e803c18f1f806e7bcc57313f240d73b91b8`. The subsequent bounded preview validates the refreshed assessment bindings.

## Timing and workflow

Elapsed phase windows are recorded from the launcher start at 19:31:38 UTC. Setup, source verification and initial required/prose drafts took **1m48s** (to 19:33:26). Complete content, comparison, inherited-notice and mechanics review, artifact assembly and first binding/fixture preparation took **12m01s** (to 19:45:27). Verification, source-driven refinements, reporting and cleanup took **29m21s** (to 20:14:48 UTC). These are combined elapsed windows: attribution/mechanics work and verification overlapped, so finer separate timings are not reconstructed.

Initial isolated fixture tests exposed a missing empty system `packs` directory and overbroad copied manifests; the fixtures now use the existing minimal precedent manifests and retain the empty directory. Typecheck exposed a detail-kind narrowing issue in the new fixture adapter, which was corrected. A final source audit tightened Crane Wing's full defensive Situation and Stock-Striker's prone-only CMB Situation, then regenerated the full-source bodies/evidence/bindings and reran the bounded gates. None required a product or importer fix. Full-corpus admission failures and the drafter's 758 unrelated mechanics remain outside this batch, as do the older notice advisories. One test's 3.2-second binding check is within its 5-second timeout; no timeout was raised.

All prior overlay records, shared Situations, assessments, evidence, Registry notices and notice holds were compared by identity against the worktree baseline and preserved exactly. Changes are additive batch artifacts, left uncommitted. No Git/GitHub writes, environment-file access, private E2E access, product implementation, deployment or #413 work occurred. TMPDIR remains the supplied external `.ep-tmp` directory. The launcher captures the final response at its `-o` answer path; no answer file is written into the repository.

## Review fix round 1

Reviewer: **Sol (AI curator) for the owner**, 2026-10-08. Finding 1 is resolved by the parameterized public-resolver assertion described above: both admitted Skill Focus entries return +6 when their +3 and +6 rank Situations are selected together. No product behavior changed. Findings 2 and 3 were accepted without changes: unknown origins remain unknown and held, and the readable source-label spacing is preserved. Admission remains **two admitted / 98 held**; all prior artifacts, fingerprints, holds and outstanding mechanics are unchanged.

Checks ran sequentially with the supplied external TMPDIR:

| Command | Observed result |
| --- | --- |
| `CI=true pnpm test tests/catalog/feats-342.test.ts convex/feats342.integration.test.ts --maxWorkers 2` | Pass: two files, 14 tests (12 catalog, two saved-sheet), 5.16 seconds. |
| `CI=true pnpm -s typecheck` | Pass. |
| `CI=true pnpm -s lint` | Pass. |
| `git diff --check` | Pass. |

The measured verification window was **2m44s**, from 20:20:49 to 20:23:33 UTC; reading and report preparation were not separately timed. No workflow problems arose. No full suite, full-corpus operators, source gathering or new curation ran during this bounded correction. Only the catalog test and this report changed, and both remain uncommitted.
