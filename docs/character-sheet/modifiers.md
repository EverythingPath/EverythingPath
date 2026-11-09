## Modifiers

```ts
type Modifier = {
  target: Target;
  bonusType: BonusType;
  value: number | { formula: string }; // negative = penalty
  condition?: ModifierCondition;
  stacksWithinEntry?: true;
}; // text says it adds to its own entry's other bonuses, see "Stacking"

type ModifierCondition = {
  // every part present must hold
  situation?: Situation; // "vs. traps": never in a total (see "Conditional Modifiers")
  whileActive?: Id<'catalogEntry'>; // "while raging": applies while an active entry of that Catalog Entry exists
  weapon?:
    | '$self'
    | '$choice'
    | '$group' // only attacks with this item, the entry's chosen weapon (Weapon Focus),
    | '$target'
    | '$unarmedOrNatural'; // a weapon of the entry's chosen group (Weapon Training), the Spell
  // Effect's `onItem` weapon, or the unarmed strike and natural attacks
  option?: true; // only inside a routine that has this entry switched on (see "Attacks")
  castingClass?: '$choice' | ClassTag; // only this Spellcasting (Magical Knack)
  school?: '$choice' | SchoolKey; // only Spells of this school (Spell Focus)
};

type Situation =
  | SituationKey
  | { local: string } // see "Situational notes"
  | { option: Id<'catalogEntry'> }; // "Only when using Combat Expertise", see "Attacks"
type SituationalNote = {
  target?: Target;
  situation?: Situation;
  text: string;
  condition?: ModifierCondition;
}; // optional scope/prerequisite; no target = shown with its entry
```

### Targets

Targets form a closed list of statistics. Any bonus type may go on any target, because the rules set no restriction.

- **Abilities:** `ability.str`, `ability.dex`, `ability.con`, `ability.int`, `ability.wis`, `ability.cha`, and `ability.$choice`, the ability the sheet entry's `choice` names. An unchosen `ability.$choice` contributes nothing.
- **AC:**
  - `ac.armor`, `ac.shield` and `ac.natural` are separate targets, because the rules count enhancement separately for each thing enhanced.
  - `ac.other` covers every other AC bonus.
- **Saves:** `save.fort`, `save.ref`, `save.will`
- **Skills:** `skill.<key>`
- **Combat:** `bab`, `attack.melee`, `attack.ranged`, `damage.melee`, `damage.ranged`, `cmb`, `cmd`, `init`
- **Hit points:** `hp`
- **Spellcasting:** `casterLevel`, `spellDC`, `concentration`. Each applies to every Spellcasting unless a `castingClass` condition narrows it.

The parent targets `ac`, `saves`, `skills`, `attack` and `damage` exist because rules text uses them. They expand into their leaves before stacking: `ac` expands to `ac.other`. Touch AC and flat-footed AC are never targets. They are derived from the AC leaves (see "Derived statistics").

### Bonus types

`alchemical`, `armor`, `circumstance`, `competence`, `deflection`, `dodge`, `enhancement`, `inherent`, `insight`, `luck`, `morale`, `naturalArmor`, `profane`, `racial`, `resistance`, `sacred`, `shield`, `size`, `trait` (APG, admitted because imported traits use it), `untyped`, plus `base` for base scores and built-in bases.

### Formulas

A formula uses a closed grammar:

- **Operators and functions:** integers, `+ - * /`, `floor`, `ceil`, `min` and `max`. Arithmetic may produce fractional intermediate values; round the complete formula contribution down before stacking, including negative results (Core Rulebook p. 11, Rounding). Explicit `ceil` still rounds its argument up: `ceil(5 / 2)` contributes 3, while `@level / 2` at level 1 contributes 0. Numeric Modifiers retain their recorded value.
- **Variables:** `@level`, `@classLevel.<classKey>`, `@hitDice`, `@ability.<key>.mod`, `@bab`, `@skillRanks.<skill>` and, on an Item Ability, `@item.enhancement`.
- **`@skillRanks.<skill>`** is a skill's recorded ranks as the sheet totals them, racial Hit Dice ranks included (`recordedSkillRankFacts`), never the skill's total; `<skill>` is the skill key without `skill.`, such as `spl`. A category skill reads its own key, so Perform is `@skillRanks.prf`. It is a stage-0 input, readable by every target, and an unknown skill is unsupported. Skill Focus gives +3 on its skill, or +6 with 10 or more ranks in it (Core Rulebook p. 134), with nothing to select: `3 + 3 * min(1, floor(@skillRanks.spl / 10))` is +3 at 0 and 9 ranks and +6 at 10 (#724). Two copies for one skill share a Source, so they don't stack. While a companion's recorded ranks don't count (`recordedSkillRankFacts` is null), the variable contributes nothing with a warning.
- **`@casterLevel`:** in a Spell Effect's Modifiers, the caster level recorded on its sheet entry. _Shield of faith_ grants +2 deflection, another +1 at each six caster levels, and a maximum of +5 at level 18: `min(5, 2 + floor(@casterLevel / 6))` (Core Rulebook, Shield of Faith; spell description in the removed legacy spell dataset). In a `casterLevel` Modifier, the Spellcasting's caster level before `casterLevel` Modifiers, so Magical Knack is `min(2, @hitDice − @casterLevel)`, capped at Hit Dice as written (S13). Anywhere else it is unsupported.
- **`@item.enhancement`:** in an Item Ability's Modifiers, the effective enhancement bonus of the item part listing it (a double weapon's end, a shield's bash): the higher of its own and any targeted enhancement Spell Effect bound to that part as its attacks receive it (only while the effect's own prerequisite, Situation and weapon scope hold for that part), so _greater magic weapon_ counts and a temporary effect stays out of the permanent projection; 0 without one or when malformed. _Huntsman_ gives "the weapon's enhancement bonus on Survival checks made to track any creature the weapon has damaged in the past day" as an enhancement Modifier on Survival under a local Situation (#764). Anywhere else it is unsupported, and the catalog formula check refuses it outside Item Ability records.
- **`@casterLevel.<classKey>`** is that class's Spellcasting's caster level, and **`@casterLevel.arcane`** the highest caster level among arcane Spellcastings, for Arcane Strike and other caster-level scaling. Both are 0 without one.

A formula may read only stages earlier than its target's stage (see "Resolution stages"). Runtime evaluation parses an AST without executing the expression. Structural character/class levels are available before ability scores; Hit Dice and BAB are stage-3 inputs and cannot feed ability scores or BAB itself. Caster levels resolve before other dependent statistics, so qualified caster-level reads are allowed on dependent saves, skills, attacks, damage, HP and casting checks, but not on ability, BAB or caster-level targets. Recorded Spell Effect caster level and a casting Modifier's pre-modifier caster level are the explicit early-input exceptions. Scoped class/casting keys may contain dots; the entire suffix is one key, never an object-property path. Absent valid class/casting keys read as zero. Parsing bounds length, token count and nesting; unsafe integer literals, non-finite results and division by zero contribute nothing with a warning. A formula outside the grammar is stored and flagged as unsupported. It contributes nothing and shows a warning. About 22% of the dataset's changes are formulas, so the importer parses them ([Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207)).

Named class/casting inputs read only own keys. Inherited properties such as `constructor` are unsupported; a deliberately recorded own key with that spelling remains a valid class key. The importer and runtime use the same parser and target-stage classification, with import-specific variable mapping and admission checks. Current/permanent projections share a calculation-local cache of parsed expressions and parse failures; each contribution still evaluates against its own entry, stage and projection. Constitution HP built-ins join the HP stage after ability resolution, so each projection requires one resolver pass.

### Conditional Modifiers

Decided by [Prototype attacks and conditional modifiers on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/216) (variant 3, tag `prototype-approved/attacks-conditionals`).

- **Weapon conditions** apply only inside the attacks of the matching weapon: `$self` for a weapon's own enhancement, `$choice` for Weapon Focus's chosen weapon, matched on `baseType`, and `$group` for fighter Weapon Training, matched against any of the weapon's `groups` and the entry's chosen `weaponGroup`. `$target` and `$unarmedOrNatural` are in "Spells on an item". They never reach the sheet-level attack statistics.
- **Option conditions** apply only inside the routines that switch the entry on (see "Routine Options").
- **While-active conditions** apply automatically while an active entry of the named Catalog Entry is on the sheet, such as Superstition while Raging. Otherwise the Modifier waits and adds nothing.
- **Situational Modifiers** never enter a total. A Situation is a key from a reviewed vocabulary, such as `traps`, `fear`, `spells`, `giants` or `orcsGoblinoids`, with display text such as "vs. traps", or a local Situation that only its own entry names (see "Situational notes"). `resolveSheet(…, { situations: [situation] })` resolves the sheet as if the Situation held. Its Modifiers then apply and stack like any other, so raging Will vs. spells is +6, not +8: Superstition's +3 morale suppresses Raging's +2 morale.
- Every statistic reports `conditional`, the in-scope contributions left out of its total, each with its condition text and Situation, or with the while-active wording it waits on. Strict weapon, Routine Option, casting-class and school mismatches are reported separately in optional `excluded`. Derived statistics carry the conditional contributions their composition would take: a conditional dodge bonus reaches touch AC and CMD, but not flat-footed AC.
- **Every situational note in the imported content becomes structured.** Foundry has only text notes on a statistic, so the Curation Overlay writes one record per note (see "Situational notes").

### Situational notes

Decided by [Decide how the Curation Overlay structures every situational note](https://github.com/AndreasUnunger/EverythingPath/issues/228). Foundry stores situational bonuses only as text notes on a statistic (`contextNotes`): 278 in the system packs and 3,367 in pf1-content at the pins. The ticket's resolution records the survey of them.

- **Situations.** There are two tiers:
  - A **shared Situation** is a key in the reviewed vocabulary, for a circumstance more than one entry names: fear, poison, mind-affecting, traps, creature types and subtypes, combat maneuvers, schools and descriptors. Notes that word it differently ("vs. fear", "vs fear effects") get one key once a reviewer confirms the match.
  - A **local Situation** is free text owned by one entry ("vs male creatures of your race") and matches nothing else. About 80% of the notes' circumstances occur only once. A local Situation is promoted to a key when a second entry names the same circumstance.
  - Keys are flat, and none implies another. "vs. charm" doesn't include "vs. enchantment", and "vs. spells" doesn't include spell-like abilities, because the rules don't settle either. Asking for several Situations at once combines them.
- **Situational notes.** About 24% of notes carry no number: immunities, rerolls, "can always take 10". Each becomes a `SituationalNote`, a text line with a target and a Situation. It shows in that Situation's group in the breakdown and never changes a number. A note naming a statistic the sheet doesn't have (critical confirmation, ability checks, speed, stabilizing), or naming none, has no target and shows with its entry.
- **Note records.** The Curation Overlay holds one record per note, bound to `externalKey`, Foundry target and exact note text. A note repeated on many entries still gets a record per entry, because formulas depend on the entry's class.
  - A record holds a list of outputs: Situational Modifiers, situational notes, and while-active or weapon Modifiers where the text says so. So one note can split (Duergar's "+4 vs bull rush and trip while on ground" is two Modifiers) or produce nothing when another record covers it.
  - Targets come from the text. `allSavingThrows` maps to `saves`, `skills` to `skills`, `meleeWeapon` to `attack.melee`, `cl` to `casterLevel`, `conChecks` to `concentration` and `spellEffect` to `spellDC`. The 39 notes with an empty target are mapped the same way.
  - Formulas are rewritten into the closed grammar: `@class.level` becomes `@classLevel.<the granting class>`, and `if(gte(…))` becomes `min` and `floor`. Formulas reading `@resources.*` or `@item.level` stay unsupported.
- **Action conditionals.** Foundry's structured action `conditionals` on 14 weapon and ability records (the double-barrelled firearms, Grab) get records the same way, as Situational Modifiers with `weapon: '$self'`. The two library records of UI helpers (`*Common Conditional Modifiers` and `*Weapon Enchant Conditional Modifiers`) are not imported, because the CRB attack rules are written by hand. The second's 19 conditionals seed the Item Ability drafts (see "Item Abilities").
- **Drafting and review.** A drafter script writes the records. A parser drafts notes that lead with a value and a bonus type (about 2,200), and an agent drafts the rest from the note and the entry's description.
  - Each record is `drafted` or `checked`, and both apply. The status isn't shown on the sheet.
  - A record is checked against the entry's imported description, which is Paizo's text, not against the printed book.
- **Prose-only bonuses.** Situational bonuses with no Foundry note (Superstition, a feat's "+2 vs. bull rush") are ordinary overlay Modifier records for prose-only entries, outside the note gate. A one-off drafter pass over every description looks for "vs.", "against" and "when" wordings and drafts what it finds.
- **Note gate.** The import fails if any note or action conditional lacks a record of either status. A record whose note text changed upstream no longer applies, so its note counts as missing. A pin bump runs the drafter for the gaps and commits the new records with its import report, which lists records by status.

The Item Ability policy below extends required coverage to every `itemAbility` entry. The #303 operator workflow adds a separate conservative drafting policy: a drafted record with any `unresolved` or `review` diagnostic contributes no output until checked. Diagnosed drafts for required notes, action conditionals and Item Abilities fail coverage; optional prose-pass diagnostics remain outside that gate. A checked record may retain review diagnostics for context, but unresolved mechanics still fail required coverage. Unresolved raw-mechanics Notes are review placeholders that must be replaced before a record can apply. Unsupported note formulas also require checking, retaining their runtime formula warnings and readable text after review. Required gate status counts and optional prose-pass status counts are reported separately. These safeguards supplement #228's original missing-record gate rather than changing the meaning of either status.

The concrete operator record format, strict output schema, helper-seed bindings, gap-only resume and separate prose-description pass are documented in [Note curation operators](../catalog-import/curation.md). `catalog:preview` writes itemised coverage and admission reports before a failing exit. The bounded #303 fixtures demonstrate this workflow without claiming corpus execution or source-content review.
