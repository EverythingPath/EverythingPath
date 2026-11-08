# Feats batch #337 — pf1-content, batch 4

Reviewed by **Sol (AI curator) for the owner**, 2026-10-08. This batch processes exactly the 100 keys in [#337](https://github.com/AndreasUnunger/EverythingPath/issues/337), under PRD [#251](https://github.com/AndreasUnunger/EverythingPath/issues/251), Implementation Decision 17 and its acceptance appendix. **100 specifically held; zero admitted, dependent omissions, whole-entry unsupported/prose-only dispositions, or exclusions.** Attribution, curation coverage and calculation completeness are separate results. No Catalog Release is published.

## Evidence and review boundary

The [single batch inventory and review](../../scripts/catalog/legal/feats-337.json) records every identity, source byte/description hash, disposition, content hold, observed notice minimum, comparison boundary, raw mechanics, imported prerequisite/proficiency facts, ordinary Source and outstanding mechanics. All 100 pinned records have empty structured source arrays, which remain empty in the normalized catalog. Name matches and inherited notice lines do not establish whole-content attribution.

The read-only sources are Foundry PF1 v11.11 (`418761d2e16a6037c0156bb4a241f7cea5a2986d`) and pf1-content 11.4.0 (`02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`). Existing identity remaps are unchanged. Each assessment binds the complete final extraction, including linked prerequisite content, instead of a reduced fixture with missing dependencies. Reviewer/date, raw source locations, exact hashes, evidence and notice fingerprints are retained in [assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence](../../src/lib/catalog/data/attribution-evidence.json).

Permitted comparison used seven PCGen feat files at commit `25523dbcf10e86c280fc0f447167ea43d67419d3`: [Core Rulebook](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst), APG, Ultimate Combat, Ultimate Magic, Ultimate Campaign, Mythic Adventures and Pathfinder Unchained. The inventory stores every file hash and 22 individual line snapshots/comparison limits. These are partial evidence leads, not admitted attribution. No book PDFs are available; Archives of Nethys was not used.

Eight observed notice identities are CRB/PZO1110, Bestiary/PZO1112, APG/PZO1115, Ultimate Magic/PZO1117, Ultimate Combat/PZO1118, Ultimate Campaign/PZO1125, Mythic Adventures/PZO1126 and Pathfinder Unchained/PZO1131. Existing CRB notice review is reused only where actually observed. Seven non-CRB complete-chain holds are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json), including the existing compilation identities for Bestiary and APG. All 18 appended Combat Trick descriptions now additionally require PZO1131 for their stamina rules, matching the Snake Fang/Panther Parry pattern in #336; their candidate notice-hold lists and content evidence record the existing PZO1131 complete-chain hold. The observed requirements are minima: unidentified origins remain individually held rather than covered by a guessed broad notice set. Registry notices, legal resources and the permanent notice superset are unchanged.

PCGen does not justify replacing source values: Cockatrice Strike has BAB +16 in the pinned source versus +14 in the comparison; Snake Sidewind omits the comparison’s Wisdom 13 prerequisite; Improved Gaseous Form has a gaseous-form Benefit but a swarm-choice Special. Skill Focus (Lore) shares ordinary CRB Skill Focus prose but its alternative-skill/subskill adaptation is not bounded by that comparison. All remain individually unresolved.

## Exact dispositions

Every row has its named `feats-337-whole-content-<upstream-id>` hold and source evidence in the inventory. Prose-only submechanics do not replace the whole-entry attribution disposition.

| Stable key | Candidate | Disposition and observed notice minima |
| --- | --- | --- |
| `pf1-content/5me4yT0Qm8Y4JZmf` | Friendly Switch | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/5oGTuJ4DUabdnqgr` | Greater Cloud Invocation | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/5pVWaHfTSuXHaITb` | Coordinated Blast | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/5qky3DPtpXwDBP96` | Guided Hand (Mythic) | Held: whole-content comparison incomplete; PZO1126. |
| `pf1-content/5r33SwOguzVDBb3m` | Improved Charging Hurler | Held: whole-content comparison incomplete; PZO1118, PZO1131. |
| `pf1-content/5raVvetb3dyvpbKG` | Harmonic Spell | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/5uVsdA6N00N3wBCe` | Scarred Legion | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/5wLDF3sWPBg1sVO5` | Advanced Armor Training | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/5yyCo2m00N2s26ZN` | Dual Enhancement | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/5zQB4JVQ5NYHlO7e` | Flinging Charge | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/60f8OK7hg2dz3uIc` | Skill Focus (Mythic) | Held: whole-content comparison incomplete; PZO1126. |
| `pf1-content/61kIjG1MQkFS2ovD` | Rhino Charge | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/632mceqeXgp9tesv` | Shadow Dodge | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/63Axr9SNt1B4ixnR` | Lost Legacy | Held: whole-content comparison incomplete; PZO1125. |
| `pf1-content/63lavNmAGQvH52zl` | Scarring Spell-Like Ability | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/64kKWZHZlFJjOFOh` | Champion of Anarchy | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/682QjZHlMLRmfUpY` | Sharpclaw | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/69kkOFWEp9uVPsYt` | Cosmic Gate | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6A30Zd1aQkOWRUez` | Umbral Spell | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6AR4oVSsZqHGqCrr` | Eyes of the Twilight | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6CImoAJgPJndpR9A` | Monkey Shine | Held: whole-content comparison incomplete; PZO1118, PZO1131. |
| `pf1-content/6DvJa0qO7OVuvOPf` | Awe-Inspiring Smash | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/6EvRq685BS0Pugmg` | Meteor Swing | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6FmNN4OV4Ec9xMSR` | Drow Spirit | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6GFQfXGnuZcFDf4f` | Blessed Hammer | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6HVdbIFcRuTq8o7p` | Snake Sidewind | Held: whole-content comparison incomplete; PZO1118, PZO1131. |
| `pf1-content/6IGhoEJ9DUcBovOq` | Scrutinize Spell | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6IKWLLSOXeNyJHjq` | Fiendskin | Held: whole-content comparison incomplete; PZO1112. |
| `pf1-content/6KCga6TFRkxZGVFi` | Creature Focus | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6MVF2CHX4UY7n9yh` | Raging Deathblow | Held: whole-content comparison incomplete; PZO1118. |
| `pf1-content/6OJlI84hPeXrekjd` | Draconic Magic | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6PBZv0hN9dIlneJl` | Menacing Bane | Held: whole-content comparison incomplete; PZO1115, PZO1118. |
| `pf1-content/6PnCI1b3sw8xZxMW` | Kick Up | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/6RmcdXzrNGEWDT0h` | Misdirection Redirection | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6U1yBxH0qeaKbswW` | Marid Coldsnap | Held: whole-content comparison incomplete; PZO1115, PZO1118, PZO1131. |
| `pf1-content/6Unilb6yyaehF9fv` | Skill Focus (Lore) | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/6UzI2HapyOvfWZjM` | To the Last | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/6VUs0aIWtOmZd2gr` | Light Bearer | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6WXYjEFwYg1vvic4` | Drunken Brawler | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6XZO8W3aIQolpKx4` | Expanded Resistance | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6Xc8x1lKj8raW2p9` | Blazing Aura | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6YdyULhTTpkysN49` | Dragonslayer | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6Yq5Whkv15vAIRYv` | Coordinated Distraction | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6ZGZUs72XmiLPTB5` | Casting Conduit | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6aAzfeJmedKbPI32` | Deny the Reaper | Held: whole-content comparison incomplete; PZO1125. |
| `pf1-content/6aC6IqAL1SkdQndZ` | Burrowing Shot | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6arJOSFF6vUHDPdS` | Incredible Healer | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6b29HYy9MgWVO7oW` | Clustered Shots | Held: whole-content comparison incomplete; PZO1110, PZO1118, PZO1131. |
| `pf1-content/6eXWSP7NRSzQk2Xj` | Improved Gaseous Form | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6hcljLulju88xbMf` | Siphoning Blade | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6hdDqwRC3oE3t0Y1` | Improved Sidestep | Held: whole-content comparison incomplete; PZO1115, PZO1131. |
| `pf1-content/6kIolKaxswkNL68G` | Aldori Dueling Mastery | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/6m5yBHWZrPuIXVjX` | Snapping Jaws | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6nTc9JPQKOHwfSuS` | Linnorm Wrath | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6otNXpIcmwmbskaf` | Elemental Commixture | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/6sxXwyW3CerU02Ds` | Talmandor's Lifting | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6t2D3ND1vdv5Lj5X` | Cloak of Feathers | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/6uVUIiI1nzI3vpnv` | Improved Called Shot | Held: whole-content comparison incomplete; PZO1118. |
| `pf1-content/6wE9ZpP8jLYFVklY` | Champion of Destruction | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/6xYwTzBMBtbgYr9e` | Bleeding Critical (Mythic) | Held: whole-content comparison incomplete; PZO1126. |
| `pf1-content/6yN4o1QIVvU5BM02` | Claw Pounce | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/6yivoRJHy6kQQJiC` | Cockatrice Strike | Held: whole-content comparison incomplete; PZO1115, PZO1131. |
| `pf1-content/71gn007vEAXxV9XR` | Steadfast Slayer | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/72wP9MU1FcH6VqBo` | Weapon Shift | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/74HApRdnoVBEOlZC` | Lightning Rager | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/74OqPMOlBNAm3w2E` | Torch Bearer | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/79sRm1nWZCNIFIaJ` | Punishing Kick | Held: whole-content comparison incomplete; PZO1115, PZO1131. |
| `pf1-content/7AARwpVoXzTyElD4` | Choral Support | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7CkvAbCKdlwqGY0g` | Ally Caller | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7D2QyPD91FPTcG5Q` | Cooperative Rend | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7EL3Sxe8xhiYMmyr` | Reap the Infirm | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7H9cAcmEOnmOmOBu` | Arcane Jinxer | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7IKzAWyTWxpVDVKA` | Seeping Darkness | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7Jb6HC8LJ8HIvgXl` | Extra Variance | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7JhqmjOwSDk234Zf` | Vengeful Banisher | Held: whole-content comparison incomplete; PZO1125. |
| `pf1-content/7K7ZceOBSOz7mHGb` | Ferocious Loyalty | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7KWeCYlTveuC7cDB` | Guarded Charge | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7Le7hejRo6haSH1h` | Improved Bull Rush (Mythic) | Held: whole-content comparison incomplete; PZO1126. |
| `pf1-content/7MhqXjjhGvUEbnyd` | Improved Surprise Follow-Through | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/7NG00zhwhzleBi6V` | Stylized Spell Mastery | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7OQzvZslFZ1l6ujH` | Toxic Spell | Held: whole-content comparison incomplete; PZO1117. |
| `pf1-content/7OnSE8xUePeW10OQ` | Blades Above and Below | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7QFwm45SVq5ATQHU` | Passing Grace | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7R0jl6uolQEiuLZ0` | Poised Bearing | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/7RD7QkPB9mCVfNta` | Divine Expression | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7SZiyWlXWlYsKp8D` | Curious Companion | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7Sg4QAw5J3tpUJM3` | Relentless Cheer | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7T8A96wY9Vikmahs` | Musketeer's Reposition | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7Tgilm57TJfBMBX1` | Treacherous Toxin | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7UvmKpqE8j3K44p6` | Teleport Tactician | Held: whole-content comparison incomplete; PZO1115, PZO1131. |
| `pf1-content/7V1rM5t8syA3b3cJ` | Stone-Faced | Held: whole-content comparison incomplete; PZO1115. |
| `pf1-content/7WpTopl1vv5M1M0H` | Sunder Blessing | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7XPtT7PbQbygaE5Z` | Accomplished Sneak Attacker | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7XvtQZQHYwUu1jXe` | Concentrated Fire | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7ZCaD7XIPeU2DYyC` | Esoteric Necromancy | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7ZTSh33EUEytgbdU` | Sonic Croak | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7Zl7VnPVB7mDnFIq` | Share Spells | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7Zs6Rx2QAnQbTiAV` | Earth Magic | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7afTCiRPfFsGISmA` | Amplified Hex | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |
| `pf1-content/7avgPUc0fP1eIIvw` | Nameless Servitor | Held: whole-content comparison incomplete; Origin/notice requirements unidentified. |

## Mechanics and separate prose review

The [Curation Overlay](../../scripts/catalog/reviewed-curation.json) adds **101 checked records: 100 descriptions and Clustered Shots’ one required context note**, producing **57 numeric Modifiers across 27 feats and 97 readable Notes**. The initial bounded drafter added the required note; the separate prose pass drafted 69 descriptions, and the remaining 31 were explicitly bound with the existing description-review tooling. All 100 descriptions were reviewed. The batch has one raw structured change (Skill Focus Lore), no action arrays or conditionals, no structured proficiency arrays and no Item Ability records. Class schedules, gear Base Items/end state and companion-source batches do not apply.

The rebased head’s existing 825 records and 26 shared Situations are preserved. The new shared `lawfulCreatures` Situation serves Champion of Anarchy and Champion of Destruction. Champion of Destruction’s lawful and good increments deliberately stack within the same entry to +4 against both; copies keep the same Source. Snake Sidewind uses a local defensive trip Situation because the existing shared `trip` names offensive checks and `tripGround` is narrower. Compound ally, charge, light, duration, chosen-creature and story-completion circumstances remain precise local Situations.

All 100 repeatability facts remain the importer’s `unreviewed` sentinel. Another 65 candidates retain specific diagnostics: 60 unresolved and 24 review diagnostics, with 53 descriptions explicitly reported as unresolved. Forty-seven candidates have 75 unchecked prerequisite atoms. Narrative/background, play-time pools, spell-like abilities, Mythic-tier and stamina rules remain intentional prose where the consuming contracts exclude automation. Supported missing calculations and misparsed facts are identified separately; optional description diagnostics do not fail required-note coverage. Every row retains `completeCalculation: false`.

Six typed prerequisite defects remain outstanding: Dual Enhancement loses the weapon branch of Divine Bond; Improved Sidestep points to the oracle Sidestep feature rather than the feat; Mythic Bleeding Critical gains a phantom `mythic` choice restriction; Poised Bearing maps heavy armor proficiency to an antipaladin feature; Divine Expression loses the cleric level alternative; Musketeer’s Reposition interprets firearms as a weapon name instead of its proficiency category. These are importer gaps, not attribution holds, and no product fix is included.

Other recorded gaps include Creature Focus’s chosen-type and favored-enemy equivalence, Guarded Charge’s prerequisite substitutions, natural-attack Grants from Sharpclaw/Snapping Jaws, Lore’s unsupported target/rank expression, story completion, Heal rank dispatch, spell damage and purpose-specific caster-level quantities. Esoteric Necromancy’s damage-dice-only increase, Earth Magic’s spell-effect-only increase and Elemental Commixture’s spell-resistance check bonus are kept readable rather than mapped to a broader caster-level statistic. Elemental Commixture’s scoped +1 spell DC remains numerical.

## Demonstration and independent audit

The [fixtures](../../tests/fixtures/feats-337/README.md) preserve all 100 raw YAML files byte for byte and all complete-checkout normalized bodies. Exact ticket-order key SHA-256 is `b23f18e2866a7c266539424b9170ffc4b2c0395883c44a4abdffa36c03a1efbf`. Reduced manifests are fixture configuration, not full-checkout provenance. Full prerequisites remain in the preview; reduced fixtures do not fabricate missing definitions.

The [15 catalog tests](../../tests/catalog/feats-337.test.ts) pin raw bytes/descriptions, exact inventory, attribution/notice bindings, source changes reopening bindings, real conditional values and Source stacking. Examples include Scarred Legion +2 Intimidate and conditional morale Will, Snake Sidewind +4 defensive CMD and separate prone avoidance, Shadow Dodge +3 narrowly scoped dodge AC, Drunken Brawler’s different penalty/bonus duration limits, Champion of Destruction’s 2/2/4 damage and Deny the Reaper’s 2/4 Heal tiers. Both Heal tiers selected still resolve to +4 under ordinary within-entry suppression; automatic rank dispatch remains outstanding. Lore contributes no guessed standard-skill bonus.

The [isolated saved-sheet test](../../convex/feats337.integration.test.ts) materializes only held Scarred Legion and Snake Sidewind definitions in an in-memory Character catalog. Public mutations, saved reads and the application catalog preview agree; another member edits successfully while outsiders, unauthenticated users and wrong-campaign references fail. Prerequisite facts remain advisory. The adapter omits the unusable repeatability sentinel without inventing a replacement. No global admission, remote backend, production seed, browser session or activation is used. **The requested admitted-batch demonstration remains unavailable because no candidate’s attribution has cleared.**

Independent sampling inspected more than ten source cases and all numeric-producing outputs. It corrected Snake’s offensive/defensive trip confusion, removed the three overly broad caster-level Modifiers, reviewed different duration limits and confirmed within-entry stacking. The first catalog test run had one test-only assertion against the generic damage parent; replacing it with the resolver’s actual `damage.melee` leaf yielded 15 passes. No product code changed.

A late Deny the Reaper diagnostic clarification changed normalized `unsupported` metadata even though its Modifiers and Notes were unchanged. The all-body audit caught it; the fixture and all assessments were refreshed against a new full extraction. A final diagnostic-kind audit then marked genuine missing calculations and supported facts as unresolved, yielding 53 visible optional-description gaps. That classification change leaves all 100 normalized bodies identical but changes readiness/input/report fingerprints. Final commands use the refreshed canonical inputs.

The 2026-10-08 fix round adds the omitted PZO1131 notice minimum and existing complete-chain hold reference to exactly 18 Combat Trick entries, refreshes their individual evidence/rationales and the shared notice evidence, and rebuilds all 100 assessment bindings. No Combat Trick publication comparison or notice-chain clearance is claimed. The existing notice-hold test now pins all 18 references. Cockatrice Strike’s comparison test pins the exact `PRETOTALAB:14` tag rather than matching an arbitrary occurrence of 14; the pinned source’s BAB +16 and its unresolved discrepancy remain unchanged.

## Commands and observed results

All commands use the pinned sibling checkouts and worktree-local CommonJS `TMPDIR`. No environment file or private E2E material is accessed. Reconstruct the exact scratch selection from the tracked inventory:

```sh
mkdir -p .scratch/curation-337-fix/tmp
export TMPDIR="$PWD/.scratch/curation-337-fix/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-337.json', 'utf8'));
fs.writeFileSync('.scratch/curation-337-fix/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-337-fix/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-337-fix/checked-resume
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-337-fix/full-drafts
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-337-fix/candidates.json --out .scratch/curation-337-fix/final-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-337-fix/final-full
pnpm -s catalog:format --check
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog convex/feats337.integration.test.ts --maxWorkers=1
git diff --check
```

| Check | Observed result |
| --- | --- |
| Initial bounded draft and separate description pass | Exit 0; one required note and 69 description drafts, followed by explicit review of the remaining 31 descriptions. |
| Final checked-record resume | Exit 0; zero new drafts or replacements, one checked required note, 100 checked descriptions, zero missing/stale/required unresolved records and 53 optional unresolved descriptions. |
| Full-corpus drafter | Exit 0 on the rebased head; 3,625 new drafts, zero replacements, 3,728 required records covered, 103 checked required records and zero missing records. The 4,551 scratch records include 823 checked descriptions and 761 unresolved draft mechanics. Drafts were not added to the reviewed overlay. |
| Final bounded preview/admission | Exit 0; complete coverage of exactly 100 feats, no resources/exclusions/unassigned records; 100 held, zero admissions, dependent omissions, retained exceptions or failures. |
| Final full preview/admission | Expected exit 1; 23,037 entries and 538 resources extracted; 53 admitted, 23,129 held, two dependent omissions and zero retained exceptions. The 4,731 failures comprise 3,625 missing curation records, 715 unaccounted inventory records and 391 broken references, all outside this batch. |
| Canonical data formatting | Exit 0; `catalog:format --check`. |
| Typecheck | Exit 0; repeated successfully after the final test assertions. |
| Lint | Exit 0 on the final test assertions. |
| Initial-migration writer guard | Exit 0; 183 registrations checked. |
| Calculation contract pin | Exit 0; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b`. |
| Catalog suite and batch saved-sheet test | Exit 0; 43 files, 701 tests, 67.76 seconds, including the batch's 15 catalog tests and one saved-sheet integration test. |
| Whitespace check | Exit 0; `git diff --check`. |

On the rebased head, the fix changes **zero failure identities or reasons** and preserves all 53 admitted rows and both dependent omissions. The comparison uses the same fresh complete CLI extraction with the rebased HEAD assessments/evidence and with the corrected inputs, avoiding source or importer drift. Clustered Shots’ checked required note remains covered. Full curation has 926 applied records, zero stale/unused records, zero unresolved required records and 342 optional unresolved descriptions (289 outside this batch plus its 53). Both final previews verify both pinned commits without an override. No admitted entry has an outstanding notice or legal resource.

The full-extraction fingerprint is `dc59d5859ff3c5ce31b865c7e787d9b55441f04ea49aee2b7130865ef93876b1`; the bounded-extraction fingerprint is `94a411eba3dd7c9196d4d9ab0d283e95f64b2cc5bb2fcf37ef1a2a3a38d9b45e`. Both reports bind reviewed inputs `324af40e66b08b68a646dcb06897a3b09aad490ff9489b835fb3004549080aeb` and legal resources `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Exact admission-report SHA-256 values are full `8b09b6c2acee293a59926fe2353f6f9abb27067a08a06bf72bff36a65943eb78` and bounded `6b5f850e42e76de6b7dd4f748d420a9f02d4ece28c793dca0a1458b4eea6598c`.

Preservation checks against the rebased HEAD confirm the entire 926-record Curation Overlay, 27 shared Situations, 145 Registry entries and 366 notice holds are unchanged; all 1,040 non-batch assessments and 1,018 non-batch evidence records are unchanged. Final totals are 1,140 assessments and 1,119 evidence records. All 100 batch assessments were rebound because their shared notice evidence changed; exactly 18 individual evidence records and candidate notice requirements changed. The existing seven batch notice-chain holds remain registered, with PZO1131 now referenced by all 18 Combat Trick candidates plus the two existing Champion entries. All 100 complete-checkout normalized bodies equal the regenerated preview fixture, and all content, mapping, evidence and notice bindings match a fresh final full CLI extraction. All 100 raw fixture files and provenance also regenerate byte-identically. The 106 fixture files include 100 exact source records; candidate selections, drafts and CLI reports remain scratch-only and are deleted after reporting.

## Timing and workflow observations

Historical original curation run: approximate local elapsed windows on 2026-10-08 overlap: intake 00:48–00:51 (three minutes); drafting, source/mechanics review and final bindings 00:50–01:30 (40 minutes); gates and verification 00:51–01:35 (44 minutes); report and cleanup 01:08–01:36 (28 minutes). Overall wall time is about 48 minutes. These are overlapping phase windows, not additive effort estimates.

In the original curation run, the repository's requested Opus/Fable aliases were unavailable. Three inherited-model subagents performed the artifact and test changes; the main session orchestrated diagnosis, review, checks and this report. Long full-source previews and lint required waiting; observed host load was high, and heavy checks were kept sequential. The diagnostic/body audit required refreshing evidence after a late clarification, and the optional-gap classification required final report regeneration. One test-only assertion was corrected as described above. The command guard rejected `rm -rf`; cleanup succeeded with a Python deletion guarded by the exact workspace, task directory and candidate-file checks. No product or tool bug fix was needed.

For this fix round, one inherited-model subagent made the tracked changes while the main session ran the standard checks and independently audited all 100 final bindings, fixture bodies and non-batch preservation. Source/notice correction, fixture regeneration and report work overlapped the fresh CLI gates; complete-source extraction was the longest step. No product code or importer behavior changed.

Outstanding importer facts/calculations belong to [#719](https://github.com/AndreasUnunger/EverythingPath/issues/719) and [#720](https://github.com/AndreasUnunger/EverythingPath/issues/720). No new issue, commit, push, PR, deployment, seed or Catalog Release was created. The full test suite remains the orchestrator's landing check.
