# Feats batch #338 — pf1-content, batch 5

Reviewed by **Sol (AI curator) for the owner**, 2026-10-08, under [#338](https://github.com/AndreasUnunger/EverythingPath/issues/338), PRD [#251](https://github.com/AndreasUnunger/EverythingPath/issues/251), Implementation Decision 17 and its acceptance appendix. Exactly **one admitted candidate and 99 specifically held candidates**; zero dependent omissions, whole-entry unsupported/prose-only dispositions or exclusions. No Catalog Release is published. Attribution admission, curation coverage and calculation completeness are separate results.

## Evidence and review boundary

The [single batch inventory and review](../../scripts/catalog/legal/feats-338.json) records all 100 ticket identities, pinned source locations and byte/description hashes, individual dispositions, notice minima and holds, comparisons, inherited rules, mechanics and prerequisite/proficiency facts. [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence](../../src/lib/catalog/data/attribution-evidence.json) bind the actual normalized bodies, identity mapping, evidence and existing notice identities. The [Curation Overlay](../../scripts/catalog/reviewed-curation.json) retains exact raw description bindings and checked outputs. No remaps, Registry notices, legal resources or product code change.

Read-only inputs are Foundry PF1 v11.11 (`418761d2e16a6037c0156bb4a241f7cea5a2986d`) and pf1-content 11.4.0 (`02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`). All 100 structured source arrays are empty and remain empty. Comparisons use 18 PCGen files pinned at `25523dbcf10e86c280fc0f447167ea43d67419d3`, with file hashes and 21 individual feat comparisons retained in the inventory. No book PDFs are available, no printed-book comparison is claimed, and Archives of Nethys was not used.

Skill Focus (Intimidate) is confirmed CRB content. [PCGen CRB feats, line 156](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst#L156) contains the exact +3/+6 benefit and 10-rank threshold; its `STACK:NO`, `MULT:YES` and Base-skill choice encode the Special paragraph's nonstacking/different-skill repeatability. The ordinary Intimidate skill is independently identified in CRB skills line 42. The comparison accounts for the introduction, fixed skill variant and equivalent Foundry rank formula, with no appended Combat Trick or linked rule body. Existing reviewed PZO1110 notice coverage is reused. This confirms attribution; automatic rank dispatch and imported repeatability remain outstanding.

The other 99 candidates have individually named whole-content holds. Permitted comparisons provide leads and exact partial matches without establishing complete origins. Eleven candidates still lack any identified notice minimum. The inventory explicitly names additional boundaries such as the expanded creature/template table in Summon Good Monster, the Society guide/version for Improved Day Job, Exceptional Aid's Society exception, the missing Client rules for Colleague, and Blackfire pact/esoteric-component material. Missing calculations are not reasons for these attribution holds.

Inherited-rule review records 124 evidence rows across 88 candidates, including all 11 Combat Trick entries requiring PZO1131. Required minima use only existing identities: CRB/PZO1110, Bestiary/PZO1112, Bestiary 2/PZO1116, Bestiary 3/PZO1120, APG/PZO1115, Ultimate Magic/PZO1117, Ultimate Combat/PZO1118, ARG/PZO1121, Ultimate Campaign/PZO1125, Mythic Adventures/PZO1126, ACG/PZO1129, Pathfinder Unchained/PZO1131 and Ultimate Intrigue/PZO1134. Twelve non-CRB complete-chain holds are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json), including the known compilation identities where needed. Agent of Fear's inherited appearance features are Vigilante/Ultimate Intrigue, confirmed against pinned PCGen feature and feat text. Notice minima are not a claim that every possible book is identified.

The fix-round audit rechecked all 100 descriptions and structured fields against the inherited-rule rule, with the exact key list and unresolved origins retained in `inheritedNoticeAudit`. Improved Drow Nobility, Improved Shadowy Resistance, Improved Fiendish Sorcery and Triton Portal now require PZO1121 and `feats-338-notice-PZO1121-complete-chain`, supported by pinned PCGen ARG race-ability rows 416, 448, 742 and 769. The same audit added Ultimate Combat's explicitly restated swift-action style baseline to Blood Frenzy Style, Bestiary blindsight to Owl Style, and Bestiary 2/3 creature dependencies to Summon Good Monster; Triton Portal also requires the Bestiary creatures it summons. Ten further feats now include CRB minima for explicit spell resistance, feint/disarm/sunder, spell-slot, size/damage or temporary-HP rules. These minima do not establish whole-content attribution.

All 100 content, mapping, evidence and notice bindings were rebuilt from fresh exact-batch CLI output. Seventeen candidate assessments changed only their notice/evidence bindings; normalized content and mapping bindings remain unchanged. The admitted Skill Focus inventory, source hashes, evidence, normalized body, overlay and complete assessment are exactly unchanged. Raw fixture files and normalized bodies were regenerated and remain byte-equivalent.

## Exact dispositions

Each held row has its unique `feats-338-whole-content-<upstream-id>` hold, actual missing evidence and source comparison boundary in the inventory. Prose-only submechanics do not replace a candidate's attribution disposition.

| Stable key | Candidate | Disposition and observed notice minima |
| --- | --- | --- |
| `pf1-content/7bCi7mC6Y31vC06S` | Fleeting Spell | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/7cSn25GzzMx5ixqx` | Green Faith Acolyte | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/7eTYCX2xwYPUqDZC` | Piercing Spell | Held: whole-content comparison incomplete; PZO1117, PZO1110. |
| `pf1-content/7er84TQPDKSKPJIX` | Exceptional Aid | Held: whole-content comparison incomplete; PZO1115, PZO1110. |
| `pf1-content/7fYuIg9Wa0kJhpR5` | Storm Breaker | Held: whole-content comparison incomplete; PZO1112. |
| `pf1-content/7hzxx7OjiiCGxqeN` | Aural Insight | Held: whole-content comparison incomplete; PZO1112, PZO1110. |
| `pf1-content/7i2uVUYd0h6qqKGP` | Owl Style | Held: whole-content comparison incomplete; PZO1110, PZO1112. |
| `pf1-content/7juKTgNQrri6lVHZ` | Figment's Fluidity | Held: whole-content comparison incomplete; PZO1115. |
| `pf1-content/7kXzR7h9UIjVVw2w` | Raging Concentration | Held: whole-content comparison incomplete; PZO1129. |
| `pf1-content/7lVIDnHnrYYsYi9m` | Feint Defender | Held: whole-content comparison incomplete; PZO1131, PZO1110. |
| `pf1-content/7lnI1o2zwwdcoJnT` | Snapping Turtle Shell | Held: whole-content comparison incomplete; PZO1118, PZO1131. |
| `pf1-content/7m3FCJtk0QtLeU08` | Skyseeker Impact | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/7mcNePI93Co2JbPF` | Skill Focus (Intimidate) | Admitted: confirmed CRB comparison; PZO1110. |
| `pf1-content/7myQ3foxqbgbqpgU` | Shaitan Skin | Held: whole-content comparison incomplete; PZO1118, PZO1115, PZO1110, PZO1131. |
| `pf1-content/7nTyaTRj7UYKFwdf` | Deep Breath | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/7os5oGMwIB7V3He0` | Lifebound | Held: whole-content comparison incomplete; PZO1115. |
| `pf1-content/7pQ5ew0XWvQaT826` | Disarming Strike | Held: whole-content comparison incomplete; PZO1115, PZO1131, PZO1110. |
| `pf1-content/7qWrIvngZEuYJsIi` | We are the Wall | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/7s5emlnRYQJu9t0y` | Primal Bloom | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/7sBsxsQ4gLdo6LtV` | Rubble Skirmisher | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/7u09cg6eiXLLuhbo` | Esoteric Enchantment | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/7uQl13dutfpV2QVS` | Flagbearer | Held: whole-content comparison incomplete; PZO1110, PZO1131. |
| `pf1-content/7uUyZf0h8AzrX9uQ` | Fey Performance | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/7vPlu3V5epRurzlQ` | Inspired Alchemy | Held: whole-content comparison incomplete; PZO1115, PZO1129. |
| `pf1-content/7wKFKyTQ97nci84x` | Saving Shield | Held: whole-content comparison incomplete; PZO1115, PZO1131. |
| `pf1-content/7x1byHLp7haAp2Kw` | Empty Quiver Style | Held: whole-content comparison incomplete; PZO1110, PZO1118. |
| `pf1-content/7xEMAu5OURbVbAzR` | Mystic Stride | Held: whole-content comparison incomplete; PZO1117, PZO1110. |
| `pf1-content/7xn4GuXR7I9Ocaz8` | Nightmare Chains | Held: whole-content comparison incomplete; PZO1112. |
| `pf1-content/7xq3GoMtw0AxfodD` | Read the Room | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/7yGCHvRnctkWk7hc` | Improved Shadowy Resistance | Held: whole-content comparison incomplete; PZO1110, PZO1121. |
| `pf1-content/7zNdjxhVsyonOLfl` | Sacred Summons | Held: whole-content comparison incomplete; PZO1117, PZO1110. |
| `pf1-content/80vvCMGUFQ1mnyPu` | Stunning Fist (Mythic) | Held: whole-content comparison incomplete; PZO1126, PZO1110. |
| `pf1-content/81m93aPu01G6JN3u` | Racial Heritage (Mythic) | Held: whole-content comparison incomplete; PZO1126, PZO1115. |
| `pf1-content/83IUg26MqrB9ZtpN` | Improved Day Job | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/86WJUgilNgbeQXBH` | Disengaging Feint | Held: whole-content comparison incomplete; PZO1118, PZO1110, PZO1131. |
| `pf1-content/87XQiDFDidOPNcnE` | Apocalyptic Spell | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/89GcUu0pefcNfiYd` | Taskmaster | Held: whole-content comparison incomplete; PZO1110, PZO1131. |
| `pf1-content/8A5sOTDf8TcYcit3` | Contingent Channeling | Held: whole-content comparison incomplete; PZO1118, PZO1110. |
| `pf1-content/8H3JpY7wvILavyQR` | Perfect Center | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8HeeXrqcRf9izsTi` | Shielded Staff Ambush | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8HktdAvoTOMuLCqN` | Improved Drow Nobility | Held: whole-content comparison incomplete; PZO1110, PZO1121. |
| `pf1-content/8IeU7xLBAeTGVhH1` | Threatening Illusion | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8JdkzS1uOOlo4mbH` | Improved Fiendish Sorcery | Held: whole-content comparison incomplete; PZO1117, PZO1115, PZO1110, PZO1121. |
| `pf1-content/8KUTke2PnCwhGWMs` | Command Animals | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8L2spYZBXBoYPHXQ` | Fiendish Facade | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/8LWVbhO84S1C98O7` | Dimensional Agility | Held: whole-content comparison incomplete; PZO1118, PZO1110. |
| `pf1-content/8OByNc9LgQW9rbdn` | Summon Good Monster | Held: whole-content comparison incomplete; PZO1110, PZO1112, PZO1116, PZO1120. |
| `pf1-content/8OTcij4932nzIzRG` | Living Fortress | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8OliKSsFDQ4SJzbB` | Linnorm Style | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8RzIeYtbx0UtXUge` | Gnome Weapon Focus | Held: whole-content comparison incomplete; PZO1131. |
| `pf1-content/8Tr1v14whKtCW6YS` | Precipice Strike | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8VWrHUcibOZXgSJk` | Brute Assault | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8Vk5Fih3kAgjcUkE` | Stouthearted | Held: whole-content comparison incomplete; PZO1129, PZO1110. |
| `pf1-content/8W2d3R4FDNPzS4TS` | Pinning Rend | Held: whole-content comparison incomplete; PZO1118, PZO1110, PZO1131. |
| `pf1-content/8WmgLeVMlIb0PduB` | Piercing Gambit | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8ZH7NIEgfl2VWhiE` | Pure Faith | Held: whole-content comparison incomplete; PZO1117, PZO1110. |
| `pf1-content/8ZvLLfdHLiSxT2gM` | Cartwheel Dodge | Held: whole-content comparison incomplete; PZO1118, PZO1110. |
| `pf1-content/8c5lRyjVby1x3Uht` | Mobility (Mythic) | Held: whole-content comparison incomplete; PZO1126, PZO1110. |
| `pf1-content/8cG6jw3PwAWSswjZ` | Vile Leadership | Held: whole-content comparison incomplete; PZO1110, PZO1125. |
| `pf1-content/8d692lYaF5LANOp5` | Greater Beast Hunter | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8dLShByVQsHTDRmp` | Swift Iron Style | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8dXL9enEFbCXps0y` | Thrune Trusted Agent | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8fqHXrzWbqx1KSXI` | Agent of Fear | Held: whole-content comparison incomplete; PZO1134. |
| `pf1-content/8go7Y4Exf5kPKdel` | Fearsome Spell | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8jHSTBlp9U8lVksX` | Flagellant | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8klLISVAhZaORVGY` | Aspiring Noble | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/8l769WycvRuJP5BR` | Colleague | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/8lFkBBpwJsUc6RjK` | Hydroponic Adaptation | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/8lQDCIkC91IaL6bT` | Amplified Rage | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8niIB9O6b9A7mpsA` | Fortitude of Giants | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8nydywvlQQUOaO3X` | Unraveling Blood | Held: whole-content comparison incomplete; PZO1110, PZO1121. |
| `pf1-content/8ozUaQzeHfznCz5W` | Triton Portal | Held: whole-content comparison incomplete; PZO1110, PZO1115, PZO1121, PZO1112. |
| `pf1-content/8pL1KdStgKXCpZ1a` | Infernal Legist | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8uIm6rln5uALhVjp` | Walking Sleight | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/8yCBpbIFdYDJQr5J` | Tidal Swiftness | Held: whole-content comparison incomplete; PZO1115. |
| `pf1-content/8zr8UPy0B1JcdHp3` | Secret of Magical Discipline | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/94Z1f558q9ThnQZX` | Unblinking Flame Feint | Held: whole-content comparison incomplete; PZO1131, PZO1110. |
| `pf1-content/94fmZNDHH0J8ivyr` | Al-Zabriti-Trained Horse | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/99nJ5bhobSjKY4z5` | Blackfire Summoning | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/9Ag9jqvvt0aHeNQp` | Blood Frenzy Style | Held: whole-content comparison incomplete; PZO1110, PZO1118. |
| `pf1-content/9AkGzkQcltYub4CL` | Spellcut | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9CHpFMg8zbvQpWrO` | Intimidating Prowess (Mythic) | Held: whole-content comparison incomplete; PZO1126, PZO1110. |
| `pf1-content/9Ck7Q7cN4YHk5knc` | Reviving Channel | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9CxdA7vteOVJvXv8` | Shapeshifter Foil | Held: whole-content comparison incomplete; PZO1118, PZO1110. |
| `pf1-content/9DgQ03JpNPvPNVmh` | Sisterhood Dedication | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/9ETCsMI5tRlogbp2` | Undead Master | Held: whole-content comparison incomplete; PZO1117, PZO1110. |
| `pf1-content/9EWasYXjy1UwLGp3` | Orc Snarl | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9FdasZwHD7j3DcQh` | Shrouded in Mystery | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9G86I5OcFsXKRK1I` | True Breed | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9GTR0hH5PUgKJZFA` | Structural Strike | Held: whole-content comparison incomplete; PZO1110, PZO1129. |
| `pf1-content/9H0MsZr5VztfEAbn` | Mindful Meditation | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9H6UC6zca8qkcehU` | Dirty Grapple | Held: whole-content comparison incomplete; PZO1110, PZO1115. |
| `pf1-content/9I5I367ZHaiq7NAG` | Merciless Rush | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9J481bDyFVAnCYwk` | Swift Sprint | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9KPpZm9saA3MAlfX` | Multiweapon Fighting | Held: whole-content comparison incomplete; PZO1112, PZO1110. |
| `pf1-content/9NKsSplycGxpA3ZV` | Cannon Master | Held: whole-content comparison incomplete; PZO1110, PZO1118. |
| `pf1-content/9P4CubZrJ73u9zpf` | Muddled Morals | Held: whole-content comparison incomplete; origin unidentified. |
| `pf1-content/9P9SlKlY48XwycfI` | Topple Foe | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9VBxeJWRESTGtW0O` | Spell Drinker | Held: whole-content comparison incomplete; PZO1110. |
| `pf1-content/9cnHk5PluNEk2lq3` | Corpse Companion | Held: whole-content comparison incomplete; PZO1112, PZO1110. |

## Mechanics and remaining work

The initial bounded drafter found 68 description candidates and no required raw note/action-conditional/Item Ability records. The separate prose pass and explicit review now supply **100 checked description records, 120 Modifiers across 33 feats and readable rule Notes**. Required coverage passes with zero missing, stale or unresolved required mechanics. Eighty-two descriptions retain 84 unresolved diagnostics identifying missing calculations. Eighteen entries have no recorded numeric calculation gap; that does not clear their separate facts or attribution gaps.

Shared Situations are reused for poison, death and negative energy wherever their scope matches. Compound style, ally, duration, chosen-target and race conditions remain local; selecting a broader shared Situation cannot activate them. Rule identity supplies the ordinary Source, and same-Source copies do not multiply the contribution. No new shared Situation or source backfill is introduced.

Numeric examples include Rubble Skirmisher's +2 CMB/CMD in naturally occurring difficult terrain, Pure Faith's +4 sacred poison saves, Blood Frenzy Style's +2 Strength/+2 Constitution/−2 AC, Shrouded in Mystery's separate +3 Bluff and +2 Will limits, Mindful Meditation's `1 + min(4, floor(HD/5))` Will bonus, Mobility (Mythic)'s +2 increment over ordinary Mobility +4, and Sisterhood Dedication's +1 increment over its style's +1 Reflex/Will. Living Fortress supplies the source's **+2 increment**, giving +4 with Hardy's +2. The first independent resolver test rejected a proposed total +4 contribution because distinct racial Sources stack to +6.

Critical-confirmation benefits, such as Greater Beast Hunter's +4, remain exact entry Notes under the consuming [attack contract](../character-sheet/attacks.md); there is no confirmation target. Multiweapon Fighting's primary/off-hand penalty reductions remain Notes because generic attack Modifiers cannot dispatch by hand. Opponent/ally effects such as Exceptional Aid, Saving Shield, Taskmaster, Esoteric Enchantment and Snapping Turtle Shell's enemy confirmation penalty stay off the bearer's unrelated statistics. Restricted caster-level, target damage, resistance, temporary HP, archetype/casting and companion transformations retain explicitly named gaps where the existing interface cannot calculate them. Topple Foe's literal CMB/CMD inconsistency and ally/history progression remain unresolved.

All 100 imported repeatability facts remain `unreviewed`. Fifty candidates have specifically recorded prerequisite gaps, including Greater Beast Hunter and Cannon Master's wrong skill-rank branches, Shrouded in Mystery and Spell Drinker's flattened alternatives, Nightmare Chains' broken HD threshold and Multiweapon Fighting's anatomical threshold. Missing supported class/racial-feature, proficiency, alignment, source-choice and selection facts are recorded individually. Source proficiency arrays are absent; no grant is invented. These are importer/fact follow-ups, including the existing #719/#720 lane where applicable, and no product fix is bundled. Class schedules, gear Base Items/end state and companion-source batches are not applicable.

## Demonstration and audit

The [fixtures](../../tests/fixtures/feats-338/README.md) contain all 100 byte-exact pinned YAML files, three separately documented supporting sources (Hardy, Mobility and Sisterhood Style), full normalized bodies, source provenance and reduced manifests. A tracked `.gitkeep` preserves the fixture's required system pack directory. Exact ticket-order key SHA-256 is `2933f6ad6cd8ee5781b1372a74e846bc81fd47ffe4f3951cae84a2984201ba55`. No fabricated missing definition is substituted.

[21 catalog tests](../../tests/catalog/feats-338.test.ts) pin inventory, bytes, actual normalized facts, all four assessment bindings, enforced notice holds, shared/local Situations, real numeric values and Source behavior. They prove rank-tier alternatives resolve to +3/+6 rather than +9, Mindful Meditation uses HD rather than level, and increments compose correctly with supporting rules. [One isolated saved-sheet integration test](../../convex/feats338.integration.test.ts) uses the admitted Skill Focus body, public selections/saved reads and the application catalog preview; a separately marked held Rubble Skirmisher body demonstrates CMB/CMD preview. Ordinary CMD 11 becomes 13 only in its terrain Situation. Another member can edit, while outsiders, unauthenticated users and cross-campaign references fail. The fixture adapter omits the unusable repeatability sentinel without inventing a reviewed replacement; rank Situations are explicit manual previews, not automatic dispatch. There is no remote backend, global publication, production seed or activation.

The main review sampled more than 25 raw descriptions and audited every numeric-producing output; the test author independently sampled approximately 11. It removed overly broad confirmation/hand mappings, corrected the real Hardy stacking failure and fixed nine review records that represented absent optional fields as empty arrays. All source bodies and affected bindings were refreshed. The repository's named Opus/Fable models were unavailable in this environment, so available Codex subagents implemented and tested the records. The orchestrator's Fable sampling/landing review remains separate.

## Commands and observed checks

Commands use the two pinned read-only checkout paths, a git-ignored worktree scratch directory and a worktree-local `TMPDIR` with a CommonJS package marker. Environment files and private E2E material are not accessed. Reproduction creates its own candidate file from the committed inventory; scratch is deleted after checks.

```sh
mkdir -p .scratch/curation-338/tmp
export TMPDIR="$PWD/.scratch/curation-338/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-338.json', 'utf8'));
fs.writeFileSync('.scratch/curation-338/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-338/candidates.json --descriptions --out .scratch/curation-338/drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-338/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-338/checked
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-338/candidates.json --out .scratch/curation-338/reviewed-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-338/reviewed-full
pnpm -s catalog:format --check
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/feats-338.test.ts convex/feats338.integration.test.ts --maxWorkers=1
pnpm test tests/catalog --maxWorkers=2
git diff --check
```

| Check | Observed result |
| --- | --- |
| Pinned source verification | Both commits/manifests verified; no fixture override |
| Original review bounded draft and separate descriptions | Exit 0; 68 initial prose drafts; explicit review covers all 100 |
| Final checked-record resume | Exit 0; 1,224 retained records, zero new/replaced/missing or unresolved required mechanics; all 100 batch descriptions checked |
| Final bounded inventory and curation | Exit 0; 100 accounted feats, coverage complete, 100 checked descriptions; zero required missing/stale/unresolved; 82 separately unresolved descriptions |
| Final bounded admission | Pass: one admitted, 99 held, zero failures/dependent omissions/retained exceptions |
| Final full import/admission | Exit 1: 23,037 entries and 538 resources; 54 admitted, 23,128 held, two dependent omissions, zero retained exceptions, 4,731 existing failures |
| Batch within full gate | One admitted, 99 held, zero failures or dependent omissions |
| Complete-artifact assessment audit | Pass: all 100 content/mapping/evidence/notice bindings match fresh bounded and full output |
| `pnpm -s typecheck` | Pass |
| `pnpm -s lint` | Pass |
| `pnpm -s check:initial-migration-writers` | Pass: 183 registrations |
| `pnpm catalog:pin` | Pass: `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm -s catalog:format --check` | Pass |
| Focused catalog and saved-sheet tests | Pass: 22 tests in two files, 5.23 seconds |
| `pnpm test tests/catalog --maxWorkers=2` | Pass: 877 tests in 49 files, 60.23 seconds; release-operator passed without retry |
| `git diff --check` | Pass |

The full gate's existing failures are 3,625 missing required curation records, 715 unaccounted inventory records and 391 structure/reference failures, all outside this batch. Full inventory coverage remains incomplete. Full required-note coverage is 103 checked of 3,728; descriptions are 1,121 checked of 10,501. These wider results are not a passing release-readiness claim.

Final full extraction fingerprint: `a30951a40a72df947dd65c482aac88dad481100ca9b9f4e308cc5a5b83a3a6ca`. Bounded extraction fingerprint: `656c7e17fd1d6e07914f470c6fad246a828cfd2fbde9b9d5073304ee9bd3a9e7`. Both reports use reviewed-input fingerprint `23b1923b197eb7b52db54d4e24e05fbb2eec69c6ebd5574d61ce6add4e751976` and legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Full admission-report SHA-256: `7f1d6d771fcfcbb1493623f1b7b33714ad30ab269101af1585b0f29705e2b7c5`; bounded admission-report SHA-256: `9bfd9f2d866d2f5124bc8834611150a99a38ea78a56a756c72b39e84d0432aad`.

Final assessment bindings are verified against complete normalized bodies. This batch has no description/catalog resource dependency closure; reduced source fixtures preserve complete candidate bodies without a missing dependency being mistaken for accepted coverage. The full preview additionally reports existing failures outside this batch; they are not converted into editorial holds or silently repaired.

The original review took approximately 31 minutes. The fix round used about six minutes for policy/source audit and corrections, five minutes for CLI refresh and binding checks, and two minutes for report review; verification overlapped these phases. No printed-book evidence or importer calculations were added.

Workflow findings: the sampled review found four missing inherited race-ability notices despite the written notice rule. The fix audit now records every batch key and independently pins expanded minima in the existing regression. Fresh normalized bodies, mapping fingerprints and Skill Focus admission remained unchanged. The complete import still has the previously recorded outside-batch failures. The catalog suite passed all 877 tests with two workers; release-operator passed without a retry. Generated files use an ignored worktree scratch directory and local temporary directory. All task scratch files were removed after the independent complete-artifact audit.

No product or tool changes, commits, pushes, GitHub mutations or full test-suite run. The orchestrator owns the post-rebase full-suite landing gate.
