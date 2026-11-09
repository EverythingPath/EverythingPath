# Ironfang Militia Operations

Shared language for running an Ironfang militia through its weekly sequence at the table.

## Language

**Weekly Draft**:
The shared, in-progress collection of selections and entered rolls for the current militia week. Every player can see its contents before confirmation.
A campaign has exactly one open Weekly Draft, created when its current week begins. Confirmation closes that identity and atomically creates the next week's empty Weekly Draft; delayed edits tied to the closed identity cannot affect its successor.

**Weekly Draft Revision**:
A specific version of the Weekly Draft. Any synchronized change creates a newer revision.

**Militia Setup**:
The one-time recording of a militia's current table state, including a mid-campaign starting point, that opens its first Weekly Draft without resolving that week.

**Phase View**:
The phase of the current week that one player is viewing. It is local to that player and does not change which phase other players are viewing.

**Phase Readiness**:
A derived indication of whether a phase has all inputs needed for Weekly Resolution. It is recalculated whenever the Weekly Draft changes rather than stored separately.

**Persistent Phase Eligibility**:
The fixed determination, made when a week begins, of whether the Persistent Phase can be viewed that week. A week is eligible when at least one unresolved persistent event carries into it, and events created or resolved during that week do not change its eligibility.

**Resolution Preview**:
A non-authoritative forecast derived from a Weekly Draft Revision and current militia state. It may be partial while inputs are missing and is not stored independently from its inputs.

**Weekly Resolution**:
The deterministic application of the complete Weekly Draft when the week is finally confirmed, producing all weekly effects and the state needed for the next week.

**Confirmation**:
A request to atomically commit the entire week by applying Weekly Resolution for the exact Weekly Draft Revision the player reviewed. The whole request is rejected if the revision is stale or any change cannot be applied.

**Table Adjustment**:
An explicit, shared, typed departure that any player may stage after the rules baseline is calculated. It includes a reason so later sessions can distinguish intentional adjudication from calculation drift.

**Rules Baseline**:
The game outcome prescribed by the Ironfang militia rules before any Table Adjustments. It is authoritative when legacy calculation behavior conflicts with those rules.

**Resolution Record**:
The immutable history of one week: its source, ruleset version, change plan, warnings, Table Adjustments, and final outcome. A correction appends a new record that supersedes the earlier record rather than overwriting it.
For a confirmed week, its source is the complete confirmed Weekly Draft Revision. The Resolution Record replaces that closed draft as the authoritative historical artifact rather than retaining a separately editable or reopenable draft.
For each week, the newest record that has not been superseded is the effective record shown by default. Older records remain available as an audit trail, and records are never merged.

**Historical Week View**:
A read-only view of a finished week, derived from that week's effective Resolution Record. It does not read current militia state or preserve a separate copy of the old board.

**Ruleset Version**:
A monotonically increasing identifier for the Weekly Resolution behavior used to produce a Resolution Record. It changes when resolution behavior changes, not when presentation, persistence, or internal implementation changes.

**Historical Reconstruction**:
A manually authored Resolution Record for a past week that has no record. Its provenance distinguishes reconstructed history from a record created by Confirmation. Adding it recalculates each later week and the current militia state.

**Historical Correction**:
A change to a past week that already has a Resolution Record. It is prepared outside the closed Weekly Draft, recalculates that week and every later week, and appends superseding Resolution Records rather than changing existing records.

**Militia Correction**:
A reasoned change to the militia's current recorded facts outside Weekly Resolution. It preserves the current week and its prepared choices; choices it affects must be reviewed before Confirmation. It corrects one section of the militia at a time and never changes a finished week, unlike a Historical Correction, which rewrites a finished week.

**History Rewrite**:
The complete proposed result of a Historical Reconstruction or Historical Correction, including recalculated later weeks and current militia state. It becomes authoritative only through one explicit confirmation that publishes the whole rewrite atomically; an incomplete rewrite never changes shared campaign state.
A campaign can have at most one open History Rewrite. It is shared and editable by all players. Recalculation proceeds in week order and pauses at the first rules conflict so the conflict can be resolved before later weeks are recalculated.

**Rules Exception**:
An explicit, shared decision to keep a choice that the normal rules would not allow. It records a required reason and permits the choice itself; unlike a Table Adjustment, it does not change the calculated result.

**Action Slot**:
A shared position in the weekly Activity phase that contains zero or one Staged Action Choice. Any player may edit it until Weekly Confirmation.

**Staged Action Choice**:
The uncommitted militia action occupying an Action Slot, including its assigned team and action-specific details. It is visible and editable by all players until Weekly Confirmation.

**Officer**:
A character holding a militia officer role: a roster person with at least one role. An NPC is an Officer exactly while holding a role, independent of its NPC kind, which decides their team-manager limit; a stored character kind never makes one. Removing the last role changes that status, not the character's kind.

**Character**:
One person or creature, PC or NPC, whether they serve the militia, are fully built, or both. There is exactly one Character per person or creature; the militia roster and the character builder refer to the same Character. A Character is in at most one campaign at a time, and may be in none; adding it to a campaign moves that same Character rather than copying it, and leaving a campaign takes it off that campaign's militia roster.
_Avoid_: pfCharacter, ledger record (as a separate thing)

**Character Owner**:
The user who currently owns a Character, initially its creator: only they can take it out of a campaign, move it between campaigns, or see and edit it outside a campaign. Inside a campaign everyone can edit it, and any member can transfer ownership to any current member, including themselves, without the current owner's or recipient's approval. When an owner's account is deleted, their Characters in campaigns have no owner until a member takes or assigns them, and their Characters outside a campaign are deleted.

**Character Sheet**:
Everything a Character has (base ability scores, race, class levels, feats, gear, effects), from which their current statistics are derived. Every Character has one; a minimal sheet holds only base scores and level, and building it out is optional.
_Avoid_: Character record (for the stats), stat block

**Companion**:
A Character linked to an associated Character as an animal companion, familiar, cohort, eidolon or unchained eidolon, with its own Character Sheet and a Character Owner who need not own the associated Character. Replacement or loss of the rules support for the relationship makes it inactive while preserving the companion's sheet and recorded choices; losing one supporting source does not erase surviving contributions.

**Companion Relationship**:
The link between a Companion and its associated Character, either active or retained as inactive. A Companion has at most one active associated Character; an associated Character can have multiple active Companions.

**Supporting source**:
A recorded contribution from an associated Character that supports a Companion Relationship. Losing one supporting source preserves the relationship while another still supports it.
_Avoid_: granting source, Source (a Modifier's stacking origin)

**Companion Progression**:
The advancement a Companion receives through its granting rules, supplying actual Hit Dice and benefits without Class Levels. Contributing sources determine its effective progression level, the input used to look up advancement and budgets; this is neither Character level nor actual Hit Dice. Those rules determine whether it replaces the creature's baseline Hit Dice; a familiar's effective Hit Dice are a separate rules value. Losing one contribution preserves the others and the Companion's recorded choices.
_Avoid_: companion Class Levels, racial levels

**Evolution Pool**:
The evolution points an eidolon's summoner level supplies through its supporting source. The pool belongs to that source; the eidolon records each evolution against it. Spending beyond the pool, as after a summoner level drop, keeps every evolution and only warns.
_Avoid_: evolution budget on the eidolon, eidolon points

**Eidolon Subtype**:
The _Pathfinder Unchained_ origin of an Unchained eidolon, such as angel or demon. It decides the eidolon's alignment, the base forms it may take and the evolutions it gains free by summoner level. The subtype stays recorded on the eidolon, but it does not count under the original rules; after a change of subtype, the former subtype's choices are kept without counting until it returns.
_Avoid_: eidolon type, outsider subtype (the creature subtype)

**Version-unavailable choice**:
Recorded eidolon state that the eidolon's current version or subtype does not use: the Unchained subtype and its choices on an original eidolon, a former subtype's choices, or an evolution's choice or upgrade the version's evolution list does not offer. It stays recorded and visible without counting, and it counts again unchanged when the version or subtype returns. Unlike a Dormant entry it has no Keep, because the current rules have nothing to apply it to; the player can only discard a subtype or subtype choice.
_Avoid_: dormant entry (an entry the player can keep), retained choice

**Level Allocation**:
A companion's recorded share of an effective-level budget that a granting feature such as Beast Master divides among several Companions, looked up as that companion's progression level. The budget and every share belong to the granting feature on the associated Character. A shrinking budget keeps every share and only warns; nothing is trimmed or moved to another companion.
_Avoid_: dividing HD, component allocation (dividing a progression's outputs, as a Broodmaster does)

**Component Allocation**:
A companion's recorded shares of the separate components of one undivided progression row, such as the Hit Dice, skill ranks, feats, armor bonus, Strength and Dexterity bonuses, evolution points and maximum natural attacks a Broodmaster divides among a brood. The shares replace the per-HD outputs for that companion; statistics the rule keeps whole, such as a brood's BAB and saves, still read the whole row. The budget belongs to the granting feature on the associated Character; the shares sit on each companion's supporting source. A shrinking budget keeps every share and only warns.
_Avoid_: Level Allocation (dividing the input level before the lookup), reconstructing statistics from allocated HD

**Reduced Progression**:
A rule that transforms the class level a companion's supporting source reads, in ordered steps, before the one progression lookup, such as Master Summoner's Lesser Eidolon halving the summoner level, rounding down, to at least 1. No player divides anything; the associated Character keeps its actual Class Levels, and every eidolon ability keyed to summoner level reads the reduced level. A fallback for the unavailable class level is reduced the same way.
_Avoid_: Level Allocation (a player's share of a budget), halving the summoner's own levels

**Competing Progression Rules**:
Two rules that each change one supporting source's progression with no published precedence, such as Broodmaster and Master Summoner on one summoner. Neither is chosen: the source keeps its class level, the companion's progression is unresolved with a warning, and every recorded choice and share stays until one rule no longer applies.
_Avoid_: latest Archetype wins, rule precedence (a published order between rules)

**Group Purchase**:
A purchase made once for every companion sharing a divided budget, recorded with that budget on the associated Character's sheet and paid from it before the rest is divided, such as a Broodmaster's Larger Brood evolutions. Each companion's own purchases, such as its evolutions, stay on the companion.
_Avoid_: shared evolution, brood evolution on an eidolon

**Combined Form**:
A view of the statistics produced by combining Characters under a rule such as the Synthesist's fusion, while retaining their separate builds. It is calculated from both builds on each read, with each value naming the build it comes from, and is never stored. Viewing it does not mean the form is currently active and changes no combat state, roster, officer or Militia Character Fact.
_Avoid_: fused Character (there is no third Character), active fusion, saving the fused form

**Cohort Equivalence**:
The level at which a creature counts as a cohort under the monster cohort rules, distinct from its actual Hit Dice and Class Levels. It comes from a published mapping or an explicitly entered equivalence for an unlisted creature, plus the Class Levels the cohort gains afterwards; an ordinary cohort's equivalence is its Class Levels. A creature with Racial Hit Dice and no recorded equivalence has a missing equivalence, never one read from its Hit Dice. Militia Character Facts never read it.
_Avoid_: monster level, Challenge Rating (as cohort equivalence), cohort Hit Dice

**Leadership Score**:
The leader's character level plus Charisma modifier plus the recorded Leadership modifiers (CRB p. 129). Its table level bounds the level of a cohort attracted at that score. After recruitment only the limit of two levels below the leader bounds the cohort's Cohort Equivalence; a cohort above it keeps its Class Levels and warns, and the table level is information only. The modifiers are recorded on the cohort's supporting source, from that cohort's point of view.
_Avoid_: cohort level (the table's result, not the score), Leadership feat (the source, not the score)

**Catalog Entry**:
The definition of something a Character can have, such as an item, spell, feat, class, race, class feature, condition or a one-off adjustment. It holds the thing's rule facts and the Modifiers it grants, and is shared globally, across one campaign, or kept for one Character.
_Avoid_: item definition, effect

**Catalog Release**:
A manually numbered set of global Catalog Entry definitions and supporting resources made available together. One release is current for everyone.

**Retired content**:
Catalog content a Catalog Release no longer offers, because a rollback removed it or its attribution evidence was invalidated. Existing uses keep its last usable definition: a Character's Selections and Catalog Copies, and the Grants it already had when that release was activated. Nothing new can choose, copy or newly grant it, and moving a Character carries only its own uses. Only a later checked release restores it for selection.
_Avoid_: deleted content, withdrawn entry, removed definition

**Catalog Impact Run**:
The reconciliation of a prepared Catalog Release against current Character Sheets, recording which Characters may change and whether their candidate Militia Character Facts are ready. A completed run preserves that evidence and continues tracking later edits until publication; dirty work must be reconciled before its release can be selected. Publication selects its versioned Character facts with the definitions, resources, legal data and calculation identity.

**Candidate Reconciliation**:
Calculation and comparison of a Character's Militia Character Facts under a prepared Catalog Release while the current release remains authoritative.

**Dirty Candidate Work**:
A Character's candidate reconciliation that must be repeated because its relevant inputs changed or have not yet been evaluated.

**Catalog Copy**:
A campaign or Character Catalog Entry cloned from another entry, with independent fields but the original's rule identity for prerequisites and same-Source stacking, even after editing. Its global references follow the current Catalog Release, and original-change advisories require the viewer's access to the original.
_Avoid_: override, fork

**Campaign Catalog Preference**:
The campaign Catalog Copy chosen by Customize for campaign to replace its global original in future selections and Grants. Saving homebrew to the campaign catalog does not establish this preference, and arriving Characters keep their existing definitions until explicitly replaced.

**Curation Overlay**:
The project's reviewed corrections to the imported content, each citing the official text it relies on. It supplies what the dataset lacks, such as the Modifiers of prose-only feats, shared Sources and the conditions, can exclude an imported entry, and is reapplied whenever the content is imported again.
_Avoid_: patches, homebrew (homebrew belongs to one campaign)

**Section 15 Registry**:
The project's reviewed collection of source books' copyright notices, copied word for word, from which the legal page is built. Whether an entry's notices are covered is established by its Attribution Assessment, not by the registry; retained content with unresolved attribution or notices lies outside any completeness claim.
_Avoid_: OGL list, credits

**Attribution Assessment**:
The reviewed connection between a global Catalog Entry's content and the books and Section 15 notices it comes from: confirmed attribution names its books, reviewed notice coverage bounds every possible origin by a content comparison, and anything else is unresolved. An entry counts as covered only when its assessment is accepted and every notice it requires is present.
_Avoid_: Source (a Modifier's stacking origin), attribution pass

**Character Sheet Entry**:
One Catalog Entry on one Character's sheet. It holds only that Character's state for it, such as whether it is active, its quantity, an item's enhancement and Item Abilities, or notes. Two potions of the same kind are two Character Sheet Entries.

**Grant**:
An entry a Character has because something on its sheet gives it, such as a class feature from a Class Level, a standard Racial Trait from its race or a feature an Archetype adds. Whether it exists is worked out from its source each time; editing it only records the Character's state on it and never makes it the player's own. Each source gives its own Grant, so Evasion from rogue and from monk are two.
_Avoid_: automatic entry, edited grant

**Selection**:
An entry the player chose to add to a Character Sheet, such as a feat, trait, alternate Racial Trait, Archetype, prompt pick, item or recorded Spell. A source change never removes it, though one that fills a slot, prompt, race or class the Character no longer has goes dormant.
_Avoid_: choice (a feat's `choice` or a Class Level's choices), manual entry, pick

**Dormant entry**:
An entry the sheet still remembers, with all its state, but that counts for nothing because what it depends on is gone: a Grant its source no longer gives, or a player's entry filling a slot, prompt, race or class the Character no longer has. It comes back unchanged when that returns. The player can keep it, which makes it count anyway with an advisory warning, except a Grant of Retired content the Character didn't already have.
_Avoid_: removed entry, retained entry, suppressed entry (suppression is a stacking outcome)

**Accepted Warning**:
A rules warning on a Character Sheet that someone marked as intended, so it shows as accepted instead of as a warning. It needs no reason, unlike a Rules Exception. It reopens when the facts that raised it change, and anyone who can edit the sheet can reopen it.
_Avoid_: override, waiver, dismissed warning

**Modifier**:
A bonus or penalty that a Catalog Entry grants to one statistic. Its bonus type decides whether it stacks with others. Its value is a number or a formula over the Character's other statistics.

**Source**:
What a Modifier counts as coming from for stacking: its Catalog Entry's rule identity, shared by its Catalog Copies even after editing, unless official text makes several entries one effect, as with every haste effect. Of the active entries with one Source, only the strongest applies.

**Conditional Modifier**:
A Modifier that applies only under a condition: while another entry is active ("while raging"), only to attacks with one weapon (Weapon Focus), or only in a Situation. The first two apply by themselves; a situational one never enters a total.
_Avoid_: context note, rider

**Situation**:
A circumstance a Conditional Modifier or Situational Note names, such as "vs. traps" or "vs. poison". A number with situational bonuses carries a marker, and its breakdown shows what the total becomes in each Situation, with stacking applied. A shared Situation is one that several entries name and can stack across them. A local Situation is named by one entry only, such as "vs male creatures of your race", and matches nothing else. No Situation includes another: "vs. charm" is not "vs. enchantment", and "vs. spells" is not "vs. spell-like abilities". Explicitly selected Situations can combine, with stacking applied afresh. The Combat situations, such as fighting defensively, charging or shooting into melee, are Situations every Character has; they stay in a collapsed group and do not mark numbers.
_Avoid_: context

**Situational Note**:
Situational rules text with no number to add, such as an immunity, a reroll or "can always take 10". It shows in its Situation's part of a number's breakdown, with a marker even when there is no numeric bonus, or with its entry when it concerns nothing the sheet shows, and never changes a total. A prerequisite can leave it waiting even when its Situation is selected.
_Avoid_: note (alone), immunity record

**Attack Routine**:
A named way a Character attacks, kept on its sheet: the weapon and whether it is held in two hands or one, an optional off-hand weapon, its natural attacks, and the Routine Options switched on. It shows the single attack and the full attack in order. Each weapon added to Gear brings one.
_Avoid_: attack set, action

**Double weapon**:
A weapon whose two ends can supply the main and off-hand attacks in one Attack Routine. Each end has its own weapon statistics and recorded item properties.

**Other end**:
The second end of a Double weapon, selected as the Off hand in place of a separate Gear weapon. It counts as light for two-weapon penalties.

**Off hand**:
The optional second weapon or Other end used by an Attack Routine's full attack. Its attacks follow the main weapon's attacks; it contributes no attacks or two-weapon penalties to the single attack.

**Routine Option**:
A feat or class feature an Attack Routine can switch on, such as Power Attack or flurry of blows, changing only that routine's attacks. Its effects on anything else, such as Combat Expertise's bonus to AC, count as a Situation named after it.
_Avoid_: toggle, attack mode

**Item Ability**:
A magic weapon, armor or shield ability, such as flaming, keen or fortification, that an item on a Character Sheet carries alongside its enhancement bonus. It counts toward the item's bonus equivalent.
_Avoid_: enchantment, quality, property, special ability (alone)

**Base Item**:
The mundane item a specific magic item is built on, such as the longsword under a flame tongue, which supplies its weapon or armor statistics.
_Avoid_: base type (the weapon name Weapon Focus picks), parent item

**Proficiency**:
A weapon, armor or shield a Character is trained to use, granted by its class, race, feats and other entries, plus the player's own additions and removals. Lacking one costs a penalty on the sheet, never a warning.
_Avoid_: training (fighter Weapon Training is a class feature)

**Class Level**:
One level a Character has taken, with the class and the choices made at that level. Class Levels keep an editable recorded order, the build as recorded rather than proof of history, and character level is their number.

**Archetype**:
A variant of one base class that a Character takes for all its levels in that class. It replaces or alters some of the class's features and adds its own, while the levels stay levels of the base class. Exact feature-and-level replacements retain the original Grants through dormancy. Changes to the same independently replaceable part conflict; a whole-feature alteration also conflicts with a change to any of its parts. Independent parts can coexist. Conflicts warn while the Character remains editable.
_Avoid_: subclass, class variant

**Racial Trait**:
One ability a Character has from its race, such as darkvision or the human's bonus feat. A race grants its standard Racial Traits, each kept on the Character Sheet, and an alternate Racial Trait replaces one or more of them. No standard Racial Trait can be replaced twice.
_Avoid_: race trait (a character trait tied to a race), racial ability

**Prestige Class**:
A class a Character can enter only after meeting its requirements, which are prerequisites like a feat's. It can never be a favored class.

**Casting choice**:
The player's saved answer to an Archetype casting conflict: which selected Archetype's change applies to one casting property, such as the caster level or one Spell's list level, or whether a removal or the retained casting applies. Compatible changes keep combining, competing casting abilities are compared by modifier instead, and until the choice is made only the values depending on that property are unresolved. Accepting the conflict's warning is not a choice.
_Avoid_: casting override, winning Archetype (a whole package chosen for one conflict)

**Casting advance**:
A Prestige Class level's "+1 level of existing spellcasting class": the player assigns it, per level, to a casting class of its kind the Character had before entering the Prestige Class. It raises that Spellcasting's casting level and caster level, never its Class Levels, class features or schedule-style Granted Spells.
_Avoid_: prestige level, caster level bonus

**Prerequisites at recorded level**:
The prerequisite check of a choice, or of entering a Prestige Class, against the recorded build up to its place in the Class Levels, read with the Character's current facts. It shows what the recorded build supports, never whether the Character was actually eligible when the choice was made.
_Avoid_: as-taken check, historical prerequisites

**Unspecified Class Level**:
A Class Level whose class has not been recorded. It lets a minimal Character Sheet carry a level before it is built out, and it contributes nothing but Hit Dice.

**Unchained Class**:
A _Pathfinder Unchained_ version of a class, such as the unchained rogue: a class of its own that counts as another version of the original. Its levels count as levels of the original class, its features meet prerequisites that name the original's same-named features, and archetypes for the original apply to it where it still has the features they replace, except for the monk. One Character should hold levels in only one of the two versions.
_Avoid_: class variant, archetype

**Spell**:
A spell as a thing a caster can know, prepare or write in a spellbook, with its level for each class that casts it. It grants no Modifiers itself; what it does to a Character while running is a Spell Effect.
A recorded Spell belongs to one Spellcasting. Its explicit level survives list changes, and losing that Spellcasting preserves it under "Not under any Spellcasting".

**Spellcasting**:
One casting class's casting on a Character, such as their wizard casting: its casting level, caster level, spells per day, save DCs, concentration and the Spells recorded for it. A Character has one for each casting class they have levels in, and each is kept separate. Casting level selects its allowances from the class's casting table; caster level measures the power of its spells. Bonus spells use the permanent casting ability score, while save DCs and concentration use the current casting ability modifier.
_Avoid_: spellbook (a wizard's spellbook is one kind of record), caster

**Granted Spell**:
A Spell a Spellcasting has because a class feature grants it, such as a domain or bloodline spell. It is never recorded. A slot-style grant, such as a cleric's domain, follows every spell level the Spellcasting can cast, prestige advances included. A schedule-style grant, such as a sorcerer's bloodline, arrives at the class level its feature names and ignores prestige advances.
_Avoid_: bonus spell (extra spells per day from a high ability score)

**Spell Effect**:
What a running spell does to the Character it affects, as Modifiers, such as Haste's dodge bonus. It names its Spell, and one Spell may have several, such as Fire Shield's warm and cold shields.
Its caster level is recorded on the sheet, starting at the lowest caster level any class casts the Spell at; nothing links it to the caster's own sheet. One that enhances an item, such as magic weapon, also records its target: an item, its other end or bash, or the unarmed strike. Until a target is chosen it adds nothing. A used potion, oil or scroll is recorded as the Spell Effect it produces.
_Avoid_: buff, running spell

**Temporary Effect**:
A Spell Effect lasting 1 day or less, a condition, a consumable or ability damage. Every other Character Sheet Entry is permanent, including a Spell Effect lasting longer than a day, and ability drain.

**Ability Damage**:
Points that lower an ability's modifier by 1 for every 2 points, leaving the ability score unchanged. Unlike ability drain, which lowers the score itself.

**Militia-only Character**:
A Character presented with only what the militia needs: name, level and ability scores, edited in place. Its Character Sheet keeps anything it already holds, and edits made in this presentation land on that sheet. Only a Character in a campaign with a militia can be Militia-only; building it out makes it a Full Character for good.

**Full Character**:
A Character presented and edited through its whole Character Sheet. Its level and ability scores are read-only outside the sheet. A campaign can have Full Characters with or without a militia, and a Character in no campaign is always a Full Character.
_Avoid_: built character, pfCharacter

**Militia Character Facts**:
The values the militia rules read from each Character's ordinary form: character level, actual Hit Dice, ability scores without Temporary Effects (including effects received through linked Characters), which of those scores the sheet cannot calculate yet, and whether the Character is active. An unresolved value blocks Weekly Confirmation only when that week's rules read it. Viewing a Combined Form changes none of these facts, and confirmed weeks keep their own frozen copy.
_Avoid_: mirror stats, live stats

**Hit Dice**:
A Character's total actual Hit Dice, computed from its Class Levels, race and Companion Progression rather than recorded independently, with the applicable rules determining which contributions replace others rather than add. A roster person's Hit Dice override, zero included, replaces it for the militia rules.

**Racial Hit Dice**:
Hit Dice a Character has from its race, a number the race fixes and that never advances. Every core race has none. They count toward Hit Dice but never toward character level, and never earn a favored class bonus.
_Avoid_: racial levels, monster levels

**Write Gate**:
The shared permission to change recorded campaign, Character and supporting data during the initial Character Sheet release; closing it preserves the inputs for migration while saved data remains readable.
_Avoid_: cutover gate (the retired weekly-board migration has its own gate)

**Maintenance Window**:
The budgeted period in which the Write Gate is closed for an initial Character Sheet migration attempt, ending when editing explicitly reopens after an abort or post-activation verification.
_Avoid_: outage (saved data remains readable)

**Write Epoch**:
The generation attached to a loaded page and its changes, separating changes prepared before a Maintenance Window from edits made after reopening.
_Avoid_: revision (a Weekly Draft Revision describes draft contents)

**Migration Run**:
One recorded attempt to move existing Characters to Character Sheet authority, with its own identity, release evidence, maintenance budget and outcome.
_Avoid_: batch (one Migration Run may require many batches)

## Related documents

- [Legacy compatibility inventory](docs/legacy-compatibility-inventory.md): code kept only for data shapes older than the current writers produce, and when each path can be removed.
