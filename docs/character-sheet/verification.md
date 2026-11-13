## Verification

Resolver tests (pure) must cover:

- each stacking rule;
- untyped penalties summing and typed penalties taking the worst;
- a shared `sourceKey` keeping only the strongest entry, and `stacksWithItself` lifting that;
- the same-entry rule, and `stacksWithinEntry` adding to the entry's largest bonus even of a non-stacking type (_Elixir of the Peaks_ in mountains at altitude);
- parent targets competing with their leaves;
- the touch, flat-footed, CMD and flat-footed CMD compositions above;
- ability damage changing the modifier but not the score;
- drain changing the score;
- `permanentOnly` excluding short spells, conditions, consumables and damage;
- formulas reading only earlier stages;
- an unsupported formula contributing nothing;
- moving and deleting Class Levels;
- a situational Modifier staying out of the total and stacking like any other once its Situation is asked for (raging Will vs. spells);
- a local Situation matching only itself, and two Situations asked for together combining;
- while-active and weapon conditions;
- a multiclass caster's separate Spellcastings, caster level offsets, and prestige advances split across classes;
- bonus spells only at levels with a table entry, from permanent scores, never adding to spells known;
- one extra slot per level of each `extraSlot` kind however many features have it, and granted Spells appearing once their level is castable;
- castable spell levels from spells known or prepared (sorcerer and arcanist cantrips), slot-style grants following prestige advances, schedule-style grants following only the class's own levels, and "domain slot only";
- an advance qualifying only for classes taken before the prestige class's first level, for both the pre-fill and the warning;
- the Spell Effect caster level pre-fill, and `@casterLevel` in a Spell Effect and in Magical Knack;
- attack bonus, iterative attacks, two-weapon penalties, Str multipliers, composite bows, crossbows, Power Attack and haste, and the single attack taking no two-weapon penalty;
- an `option` Modifier applying only in routines that switch it on, its other targets only in its option's Situation, and a routine keeping an option whose entry left;
- Power Attack scaling, Rapid Shot, Manyshot, Vital Strike on the single attack only (natural and unarmed included), Lunge, and Medusa's Wrath adding two unarmed strikes at the highest bonus and offered only with an unarmed strike;
- flurry for each monk: the main weapon making every attack and the off-hand weapon the extra ones; core flurry with full Str, Str ×1 but Power Attack +50% for a two-handed monk weapon, Power Attack halved only on off-hand weapon attacks, and no extra attacks from the Two-Weapon Fighting chain, Double Slice or Two-Weapon Rend; unchained flurry with Str ×1½ in two hands and ×½ off hand, Power Attack scaling to match, and no two-weapon penalties;
- Improved and Greater Two-Weapon Fighting, Double Slice, Rapid Reload, Weapon Finesse choosing the higher ability, and Improved Critical, _keen_ and _keen edge_ together doubling once;
- natural attacks alone and alongside weapons: all secondary, Multiattack's −2, no two-weapon penalty on the weapons without an off-hand weapon, and the limb warning;
- unarmed strike with monk scaling and sizes off the FAQ dice chart, and special-ability dice as a damage part or Situational damage, crit dice capped at the printed ×4;
- thrown mode with Str ×1 in two hands and ×½ off hand, one throw per hand without Quick Draw, the full rate with it, and shuriken exempt;
- a double weapon's other end as a light off hand, and its primary end taking Str ×1 and plain Power Attack;
- Two-Weapon Rend's extra line after the full attack only, and Shield Master removing the two-weapon penalty from a shield bash;
- shooting into melee as a Combat situation removed by Precise Shot, and Point-Blank Shot only in `within30ft`;
- the `$group` weapon condition, `@casterLevel.<classKey>` and `@casterLevel.arcane`, and Combat situations staying out of the marker;
- proficiencies: grants from Class Levels, Racial Traits, feats, class features and traits, multiclass grants adding up, a Martial Weapon Proficiency or Favored Weapon choice, an empty choice granting nothing, `asMartial` counting only with `martial`, a bastard sword covered by `martial` only in two hands, `always` weapons, and manual additions and removals with a removal beating a grant;
- nonproficiency: −4 on a weapon's lines, a nonproficient armor's or shield's armor check penalty on every attack line and never twice on skills, each named in the breakdown;
- Racial Traits: choosing and changing a race, an alternate removing and restoring what it replaces, an unchosen `ability.$choice`, `countsAsRaces` and `oneOf`, and the favored class count following Multitalented;
- a masterwork weapon's +1 on attack only, suppressed by any enhancement;
- armor and shield bonuses with their enhancement on their own leaves and off touch AC, two suits highest-only, the lowest max Dex capping Dex to AC but not CMD, and armor check penalties summing into skills;
- a specific weapon taking its `weapon` detail from its Base Item, and its `magic` defaults copied into the sheet entry;
- Item Ability dice on a hit, crit-only dice scaling with the multiplier, and _bane_ contributing nothing until its `choice` is set;
- _magic weapon_ through `onItem` competing highest-only with the weapon's own enhancement, and contributing nothing without `onItem`;
- ammunition's enhancement competing highest-only with the launcher's, with both items' abilities applying;
- each end of a double weapon with its own enchantment, and a shield bash using `bash`, not the shield's AC enhancement;
- the special materials table, mithral's −3 not stacking with masterwork's −1, and a specific item's material changing nothing;
- `sheetWarnings`: each check in "Rules checks", including the cumulative rank cap, the retroactive Int budget, prerequisites at recorded level and now, `ignoresPrerequisites`, `newChoice` duplicates, the item construction checks per end and per bash, `proficiency` clauses met by any grant, the one-handed exotic warning with no other warning for being nonproficient, and an Accepted Warning reopening when its fingerprint changes;
- Prerequisites at recorded level: a Strength item added at level 8 meeting a level-3 feat's Str 13; BAB and ranks from the prefix, never the current totals; a level-4 feat seeing that level's ability increase but not a later choice at the same level, until the choices are reordered; a choice's grants sharing its position; mutually required feats warning only on the first; a prestige class checked before its first level's benefits; no recorded-level check without a usable Class Level link, while the current check still runs; an Unspecified Class Level adding only a level and a Hit Die; separate acceptances per check, reopening on a relevant clause, input, position or catalog correction, not on an unrelated edit or a release number alone.

Integration tests (convex-test) must cover:

- a backfilled Character's Militia Character Facts equal its old flat values;
- a sheet edit that doesn't change the facts leaves the `canonicalMilitiaState` revision untouched;
- editing a militia-only Character's score adjusts its base score;
- a full Character's level can't be edited through Characters & officers;
- campaign scoping of every catalog and sheet read;
- deleting is refused for a Character in a campaign;
- an Accepted Warning follows its Character between campaigns and is deleted with its subject.

Ownership and access-change handoff checks must demonstrate:

- private Characters are visible and editable only by their current owner; campaign Characters are editable by every current organization member, with no owner-only editing privilege;
- any current member can assign a campaign Character to themselves or another current member without either person's approval; a deleted account, a recipient without access and a transfer outside a campaign are rejected;
- only the current owner can request departure or a move, including immediately after claiming ownership; joining or moving preserves identity, requires destination access and does not add a roster assignment;
- every actual departure, requested or automatic, removes roster, officer and team-manager assignments through an automatic-reason Militia Correction, marks affected Staged Action Choices for review, makes a Militia-only Character Full and preserves its sheet through the homebrew detachment contract;
- loss of organization access returns every affected Character of a surviving owner to no campaign; access is revoked during cleanup failures and retries, and completion does not require that user's campaign access;
- account deletion leaves campaign Characters editable and visibly needing an owner, lets remaining members claim or assign them, and deletes private Characters;
- delayed, repeated or reordered lifecycle events check current authoritative state before acting: a known deleted account uses account-deletion policy, changed ownership is respected, and a real completed private departure followed by account deletion remains private-Character deletion;
- app-controlled campaign and organization deletion return surviving-owner Characters and refuse to proceed with any ownerless Character until assignment;
- external organization deletion returns surviving-owner Characters and retains ownerless Characters with their required sheet dependencies for app-operator recovery, with no user browsing or former-member claim rights;
- failed detachment or recovery retains source data and dependencies, retrying does not duplicate Characters or departure effects, and a normal private Character cannot be ownerless;
- departure and deletion preserve all frozen and superseded Resolution Records; current surviving-organization members can read but not edit deleted-campaign history, deleted-organization history is inaccessible to users, and historical references cannot open a private sheet.

Homebrew-departure handoff checks must demonstrate:

- complete dependency closure through future class features, prompt options and whole-class spell lists without sheet rows, Base Items, Item Abilities and replacement rules, including cycles and shared dependencies; unrelated campaign definitions stay behind;
- off, kept and dormant entries, orphaned Spells, saved Grants, slots and Accepted Warnings survive with their links, and dormant entries restore with their saved state when their source returns;
- remapping preserves totals, stacking, prerequisites and warning acceptance, including edited copies sharing rule identity; global references stay live, existing character customizations survive, and equality-only references need no inaccessible original payload;
- original-change advisories reveal nothing without the viewer's original access, and restored access resumes comparison with the copy-time fingerprint without updating the copy;
- repeated A-to-B-to-A moves keep carried versions and identities without accumulating duplicate copies or roster assignments; divergent definitions are not merged by name or ancestry;
- a new Class Level continues the chosen version; an explicit class-wide switch updates every level while preserving row IDs, order, HP, skill ranks, choices and casting links, with Grant dormancy/restoration and the existing Unchained policy intact;
- lifecycle copies of already-retained held uses preserve holds, reporting and notice obligations, while new selections, new Grants, ordinary copies and held revisions remain unavailable;
- failed preparation, failed publication, a lost response and retries produce no partial sheet or duplicated departure effects; voluntary failure leaves the prior relationship and roster intact;
- sheet/local-definition edits, Catalog Release activation, ownership reassignment, membership loss and account deletion during a move are reconciled against authoritative state, with immediate access revocation where required, no stale overwrite, complete publication, retained source dependencies and unchanged frozen history.

Catalog-release handoff checks must demonstrate:

- an overlay-only input change needs a manual release bump; changed inputs or output under an existing number fail, and unrelated application changes do not import;
- halfway batch failure, activation failure and a lost activation response leave one coherent authoritative release and recover idempotently;
- concurrent edits, newly added dependencies and campaign moves appear in candidate facts without freezing gameplay or losing intervening militia changes;
- indirect users, including Catalog Copies with global references, update while unrelated Characters and unchanged facts leave militia reviews untouched;
- notice-only releases leave facts and reviews unchanged, while changed facts make affected reviews stale at publication;
- copies keep their own fields, follow retained global references and warn only when the viewer can access the original and its definition differs from the fingerprint recorded at copy time;
- rollback preserves later player edits and a newly selected entry with its required dependencies, without reapplying defaults;
- current views never mix releases, already-open clients remain usable, and finished-week snapshots stay unchanged.

Initial-migration handoff checks must demonstrate:

- halfway batch failure and duplicate-free resume, with private candidates and complete legacy reads;
- a write racing gate closure, and rejection of a Character change after its batch;
- abort, intervening edits/new Characters and restart against current source, with obsolete workers fenced;
- exact facts equality without source/facts revision changes, while an old Ruleset Version preview requires a fresh review;
- preservation of IDs, ownership, overrides, assignments, saved Weekly Draft inputs and frozen history;
- failed frontend build or publication leaving the compatible existing contract available;
- stale tabs and delayed writes receiving maintenance or reload-required rejection without automatic replay;
- failed/lost activation and reopening responses recovering idempotently without mixed authority;
- failed smoke checks leaving coherent new reads, and forward repair preserving edits accepted after reopening;
- authorization and campaign-scoped references in the new paths, and spell retirement without repopulation.

The handoff includes a rehearsal on representative isolated data, identified application build and catalog manifest, batch/coverage and invariant reports, a reader/writer coverage inventory, and an operator runbook for start, status, resume, abort, activate and reopen. Declare the maintenance budget before starting; if it cannot be met before activation, the runbook directs an explicit abort. An abandoned worker must not leave users indefinitely paused.

These are acceptance cases for the implementation, not claims of runtime behavior already implemented or tested.
