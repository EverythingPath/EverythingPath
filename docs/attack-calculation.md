# Prepared Attack Routine calculation

Tickets #321, #322 and #323 extend the public `calculateCharacterSheet` seam.
Fixtures in `src/lib/character-sheet-attacks.test.ts` and
`src/lib/character-sheet-natural-attacks.test.ts` use printed numbers and the
settled decisions #229, #235 and #237. The research branch's full attack-rules
corpus is not present on this base; source page numbers and retained CRB URLs
are recorded beside the fixtures without fetching network content. The natural
type/size table is from **Bestiary p. 301 (non-CRB)**. CRB p. 182 supplies
natural/unarmed combat rules; the March 2015 CRB FAQ supplies the damage-dice
progression chart.

| Rule                                                    | Source                                                                                                         | Fixture outcome                                                                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal/light off hand, without/with Two-Weapon Fighting | CRB p. 202, [Table 8–7](https://legacy.aonprd.com/coreRulebook/combat.html#two-weapon-fighting)                | Main/off penalties −6/−10, −4/−8, −4/−4, −2/−2                                                                                                 |
| Improved/Greater off-hand attacks                       | CRB pp. 125, 127, [feats](https://legacy.aonprd.com/coreRulebook/feats.html)                                   | Independent additional attacks at −5 and −10; neither implies another feat                                                                     |
| Off-hand Strength and Double Slice                      | CRB pp. 122, 179, [Double Slice](https://legacy.aonprd.com/coreRulebook/feats.html#double-slice)               | Positive bonus halved and rounded down; negative modifier in full; Double Slice restores full positive bonus                                   |
| Double weapon ends                                      | CRB pp. 143, 147, 202, [weapons](https://legacy.aonprd.com/coreRulebook/equipment.html#weapons); #237 A10      | Gnome hooked hammer primary 1d8/×3 bludgeoning; other end 1d6/×4 piercing; other end light for two-weapon penalties                            |
| Double weapon Strength                                  | #237 A10 and the data model                                                                                    | Both-end full attack primary Str ×1; single end held in two hands Str ×1½; off end ×½, or ×1 with Double Slice                                 |
| Composite bow Strength                                  | CRB pp. 145–146, [weapons](https://legacy.aonprd.com/coreRulebook/equipment.html#weapons)                      | Positive Strength capped at rating; −2 attack if Strength is below rating; negative Strength damage in full                                    |
| Crossbow reload                                         | CRB pp. 145–146, [weapons](https://legacy.aonprd.com/coreRulebook/equipment.html#weapons), Rapid Reload p. 132 | Move/full-round reload allows one shot per full attack; matching Rapid Reload makes hand/light free, heavy move; reloading needs a free hand   |
| Thrown rate and Strength                                | #237 A9; Quick Draw, CRB p. 131; shuriken, p. 147                                                              | One throw per held hand without Quick Draw; Quick Draw redraws whatever the other hand holds; shuriken as ammunition; main Str ×1 in two hands |
| Range increments                                        | CRB p. 180, [combat](https://legacy.aonprd.com/coreRulebook/combat.html#ranged-attacks)                        | −2 per increment beyond the first; over five thrown or ten projectile increments is refused, and recorded drift warns once per routine         |
| Ranged Situations                                       | CRB pp. 131, 182, Point-Blank Shot and Precise Shot                                                            | `within30ft` gives +1 ranged attack/damage from Point-Blank Shot; `shootingIntoMelee` gives −4 ranged attack unless Precise Shot is active     |

Automatic rules recognize active feat entries by durable `ruleIdentity` only:
`two-weapon-fighting`, `improved-two-weapon-fighting`,
`greater-two-weapon-fighting`, and `double-slice`. A renamed Catalog Copy keeps
that identity and its behavior. A matching display name with another identity
does not qualify. Switched-off and dormant feats contribute nothing. The four
feats are ordinary #313 Selections in the representative selection catalog,
with combat feat types and typed CRB prerequisites. The prerequisite engine
reports current and recorded-build mismatches without blocking an active choice.
Greater Two-Weapon Fighting without Improved Two-Weapon Fighting therefore
keeps its −10 extra attack and warns about the missing prerequisite; it does
not invent the Improved feat's −5 attack. Imported opaque external keys need an explicit
curation mapping to these canonical identities rather than matching names.
Ranged rules additionally recognize `quick-draw`, `rapid-reload` and
`precise-shot`. Rapid Reload's Selection records the chosen crossbow `baseType`
in `state.choice`. The calculator matches that choice and the weapon's base
type against its typed hand/light/heavy crossbow list, ignoring case, spacing,
hyphens and underscores; a different, missing or non-crossbow choice does not
change reload speed.
`point-blank-shot` contributes ordinary conditional Modifiers in the shared
`within30ft` Situation. Neither Situation implies the other, and these previews
never write Character state. Shooting into melee stays in the collapsed,
unmarked Combat situations group.

Every full attack lists main-hand BAB iteratives before the off-hand chain. The
initial off-hand line uses the same BAB. When Two-Weapon Fighting determines
the penalties, both hands' penalty breakdowns identify its active Selection;
without it they identify the routine. Extra off-hand penalties identify their
own feat row. The resolver also supplies a full-attack penalty summary, or no
summary when two-weapon fighting cannot be calculated. Double Slice's added damage identifies its feat
row while the normal Strength contribution continues to identify the ability.
Each hand uses its own mode and proficiency penalty. Double ends inherit the
main weapon's proficiency identity and hands, but use independent enhancement
and masterwork state. Masterwork adds attack only. The primary end's state is
never inherited as the other end's state.

An advisory off-hand composite-bow configuration caps its positive Strength
contribution at the bow's rating before halving it. Double Slice restores that
capped bonus; a Strength penalty remains in full. A crossbow never gains Strength
damage, and an ordinary bow only takes a negative Strength modifier.

Missing or unusable off-hand references retain their recorded choice, emit a
warning owned by the Attack Routine, and omit their lines and two-weapon
penalties. Choosing the same Gear row for both hands requires the explicit
`{ kind: 'otherEnd', mode }` choice; another copy of a weapon uses another Gear
row through `{ kind: 'weapon', weaponEntryId, mode }`. A separate
off hand with a two-handed main weapon, a two-handed off-hand weapon, or an
inconsistent double-end hand/mode choice remains calculable with an advisory.
Off-hand warnings are evaluated even when the main weapon is missing or switched
off, preserving unchanged Accepted Warnings. Warning copy names the affected
off-hand weapon and says that off-hand attacks are skipped. Weapon proficiency
uses carry the real routine ID and an explicit hand; warning subjects and
fingerprints distinguish the hands while their targets name the routine.

`resolveAttackLine` and `resolveDamageBonus` receive each calculation's hand,
end and `usesBothEnds` facts. #407's Power Attack uses them: a both-end primary
full attack gets the ordinary bonus, its off end half, and a single end in two
hands the +50% bonus specified by #237 A10. Double Slice never changes Power
Attack's off-hand multiplier. #414's flurry of blows reuses these seams
(below); material mechanics are #408's.

Routines optionally record `ammunitionEntryId` and `rangeIncrements` (a
positive integer, default 1, at most 10, or 5 when either hand throws). Main
and off-hand weapon references describe the weapons already held; there is no
separate held-count or free-hand input. A thrown hand with Quick Draw, or
throwing ammunition such as shuriken, redraws with the throwing hand and keeps
its iteratives whatever the other hand holds; without either it throws only
the weapon it already holds. Only reloading needs the other hand free. The
calculator derives that from the routine and Equipment: an off-hand weapon or
the other end of a double weapon occupies it, as does an active shield other
than a buckler while the routine uses one hand; a two-handed grip keeps the
other hand on the launcher, free to reload. The off hand's other hand always
holds the main weapon. A launcher whose reload is not a free action, or that
has no free hand to reload, keeps one attack in the full attack for that hand.
Reload and thrown limits apply independently to the main and off hand.
The calculator supplies readable `attackRateNotes`; the UI displays these
beside the separate single/full sequences without reimplementing their rules.

An ammunition item is identified by `detail.ammunition: true`. The routine's
choice names its Gear row, not its Catalog Entry. Missing, switched-off,
unavailable or non-ammunition references remain recorded with one routine-owned
advisory while either hand is ranged. They do not fabricate an ammunition item
or erase the launcher's attack. The routine's one ammunition choice is fired by
each ranged hand: main and off-hand ranged lines retain `weaponEntryId`,
`launcherEntryId` and `ammunitionEntryId`; non-ranged lines have null
launcher/ammunition identities. Two launchers needing different ammunition
share the one recorded choice; a separate routine records the other.
This preserves both items for #408's enhancement and Item Ability combination
(see below). Adding representative arrows or bolts creates only
Gear; selecting ammunition does not consume quantities or create a routine.

Every attack line carries `rangePenalty`: −2 per increment beyond the first for
a ranged or thrown line, otherwise null. The UI reads it from the line rather
than searching the attack breakdown. The routine's range belongs to both hands,
so a recorded count beyond its maximum (for example after the mode later
changes to thrown) emits one `attackRangeExceeded` warning for the routine,
keyed by the count and maximum, while keeping the penalty.

The editor form keeps the range as a text draft, separate from the saved whole
number, differentiates an empty field from malformed input, refuses a count
beyond the routine's maximum with its own message, and saves only a safe
positive integer. The server refuses the same submitted values.
Unrelated field edits and resending the unchanged choice leave retained
ammunition references intact, even when the row is gone or no longer an item.
New choices must identify a Gear item of this Character; `ammunitionEntryId:
null` clears the choice. Failed field writes retain the draft for retry and incoming edits
refresh untouched fields. View-model and controller seams are covered by
`attack-routine-view-model.test.ts`, `use-attack-routine-form.test.ts` and
`use-character-sheet-attacks.test.ts` in `src/components/character-sheet/`.

Natural weapons remain ordinary `item` entries with
`weapon.naturalAttack: { type, role? }`. Twelve generic types have complete
printed size profiles, damage types and default primary/secondary roles in
`src/lib/character-sheet-natural-attacks.ts`. Missing generic dice, handedness
and critical facts receive the type's defaults. Creature-specific Medium dice
and role overrides remain possible. Custom dice step with the FAQ chart;
unrecognized size conversions and the Fine-size table's dash produce an
unresolved warning and no guessed line. A routine's `naturalAttackEntryIds`
names additional distinct sheet entries; duplicate references do not duplicate
attacks. Selecting the main natural attack again produces a routine-owned
warning and skips its additional line. Each claw is its own entry. Missing, inactive or non-natural references
remain recorded with routine-owned advisories, even when the main is unavailable.

Natural attacks never gain BAB iteratives. A Character possessing one active
natural attack gets full BAB and 1½ positive Strength; possessing several but
choosing only one does not get that bonus. A sole possessed natural form with
several entries becomes primary (for example two hooves). Otherwise the printed
role or creature-specific override applies. Secondary attacks use −5 and half
their positive Strength bonus, rounded down. A negative Strength modifier
applies in full, consistent with CRB p. 179's full Strength penalty for off-hand
damage: the natural multiplier reduces a bonus, not a penalty. A −3 modifier
therefore contributes −3 to both primary and secondary natural damage.
Multiattack changes only the penalty to
−2 and identifies its active Selection in the breakdown. Manufactured weapons
and unarmed strikes make all accompanying natural lines secondary in a full
attack. They incur no two-weapon penalty merely from natural attacks. The single
attack remains the main weapon alone, using its standalone role. Natural
weapons are always proficient, including proficiency prerequisites.

Claws, slams and tentacles share a free-limb advisory. `availableLimbs` defaults
to two before subtracting manufactured-weapon hand occupancy. A two-handed or
double weapon occupies two limbs; an unarmed strike occupies none because it can use the body.
Overbooking remains calculable with a warning. A natural weapon in the off-hand
field warns and skips that field; naturals belong in natural attack choices.
A natural main with one manufactured or unarmed weapon in the off-hand field
instead calculates a mixed sequence: the natural becomes secondary and the
lone weapon uses full Strength and ordinary iteratives without two-weapon
penalties or the two-weapon feat chain. That lone weapon's calculated lines and
proficiency-use facts identify it as the main weapon (`hand: 'main'`), preserving
the future Power Attack multiplier while retaining the recorded field choice.

`weaponEntryId: 'unarmed'` selects the built-in unarmed strike, including as an
off-hand weapon. It creates no Gear record. Unarmed strikes are always
proficient, count as light for two-weapon fighting, and use printed Small 1d2,
Medium 1d3 and Large 1d4 damage with FAQ stepping at other sizes. Their lines
record `damageKind: 'nonlethal'`, or `'lethalOrNonlethal'` with an active
`improved-unarmed-strike` Selection. The CRB −4 for intentionally dealing the
other damage kind remains text; it is not an automatic attack penalty.

The calculator accepts source-backed
`ResolveOptions.monkUnarmedStrike: { dice, size?, sheetEntryId }`. Its dice
are measured at the supplied size (default Medium), then stepped to the
Character's size. It gives either unarmed hand full Strength and lethal or
nonlethal damage. Double Slice adds nothing to damage already using full
Strength. Automatic monk-level unarmed damage remains a later slice;
callers supply the printed monk damage value. Flurry of blows is #414's
(below). The familiar hook is
`ResolveOptions.naturalAttackAbility: 'greaterStrengthDexterity'`: only natural
attack bonuses choose the greater modifier, while damage still uses Strength.
The companion loader's familiar projection inputs enable that hook
(`familiarAttackOptions`, see `docs/character-familiar-calculations.md`).

Each line identifies `attackKind`, optional `naturalRole` and damage kind,
alongside hand/end and source breakdowns. Natural forms use ordinary `baseType`
weapon identity, preserving the Weapon Focus-family seam. Weapon-scoped
Modifiers resolve against each line's own entry, base type, groups and attack
kind, so natural/unarmed bonuses and an additional weapon's bonuses do not
inherit another line's weapon context. Vital Strike, Arcane
Strike and Power Attack reach these lines through #407's Routine Options below. Player-added entries record racial
and companion natural weapons; automatic virtual Grants are not yet selectable
persisted routine references. Representative natural entries and
Multiattack/Improved Unarmed Strike are prepared fixtures, not a curated Catalog
Release. The provisional pin includes the new table/types; no cutover occurs.

## Routine Options and automatic feats (#407)

`calculateCharacterSheet` applies per-routine Routine Options and the
always-on attack feats. Fixtures in
`src/lib/character-sheet-routine-options.test.ts` use printed numbers through
the public calculator; persisted writes are covered by
`convex/characterSheetAttacks.options.integration.test.ts`. The feats are
ordinary #313 Selections in the representative selection catalog, recognized by
durable `ruleIdentity`, with typed CRB prerequisites.

| Rule                            | Source                              | Fixture outcome                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Power Attack                    | CRB p. 131; FAQ July 2013; #237 A10 | −1/+2, and −1/+2 more at BAB +4, +8, +12…; ×1½ two-handed, one-handed in two hands or a sole primary natural attack; ×½ off hand or secondary natural; ×1 for a light weapon in two hands, a two-handed weapon in one hand and a double weapon's primary end; melee lines only; its CMB penalty is a Situation                                                                                                   |
| Deadly Aim                      | CRB p. 121                          | Data only: −1/+2 per step on ranged and thrown lines, no hand multiplier                                                                                                                                                                                                                                                                                                                                         |
| Combat Expertise                | CRB p. 119                          | Data only: −1 per step on melee lines; its CMB penalty and +1 dodge AC per step are a Situation                                                                                                                                                                                                                                                                                                                  |
| Arcane Strike                   | CRB p. 118; #237 A7                 | Data only: +1, +1 more per five arcane caster levels (+5 at 20th), on every line, natural and unarmed included                                                                                                                                                                                                                                                                                                   |
| Rapid Shot                      | CRB p. 132                          | One extra main-hand shot at the highest bonus and −2 on every full-attack line; no effect with a melee main weapon or a reload- or draw-limited hand                                                                                                                                                                                                                                                             |
| Manyshot                        | CRB p. 130                          | The first full-attack line of a bow fires two arrows (`projectiles: 2`); precision and critical damage once                                                                                                                                                                                                                                                                                                      |
| Vital Strike, Improved, Greater | CRB pp. 136, 128, 126; #237 A6      | The single attack's weapon dice ×2/×3/×4 (best switched-on feat), natural and unarmed included; full attacks unchanged; extra dice never multiplied                                                                                                                                                                                                                                                              |
| Lunge                           | CRB p. 130                          | +5 ft. reach noted on the routine; −2 AC is a Situation                                                                                                                                                                                                                                                                                                                                                          |
| Medusa's Wrath                  | CRB p. 130                          | Two extra unarmed strikes at the highest base attack bonus after the main hand's first attack; an off-hand unarmed strike repeats as a primary-hand attack (the primary two-weapon penalty and full Strength); offered only on routines with an unarmed strike. Its seeded prerequisites name Gorgon's Fist and Scorpion Style, which are not seeded, so the seeded Selection always warns; this is expected     |
| Haste equivalence               | CRB p. 293; FAQ June 2013 (_speed_) | Any number of active `haste` Sources add one main-hand attack at the highest bonus to a full attack that is not reload- or draw-limited; temporary effects stay out of the permanent projection. _Speed_ on the routine's attacking part counts only for that routine; on the off-hand weapon or end alone it adds one off-hand attack at that hand's best bonus, in a flurry at that weapon's highest flurry bonus (#764)                                                                                                                                                                                                                  |
| Weapon Finesse                  | CRB p. 136                          | Melee lines with light, natural or unarmed weapons, or a weapon whose `finesse` property is set (the rapier, whip, spiked chain and elven curve blade), use Dexterity when Dexterity plus every carried shield's armor check penalty beats Strength; the penalty then applies once. A nonproficient shield's penalty is already on every attack roll, so it is neither added again nor counted against Dexterity |
| Threat doubling                 | CRB pp. 127, 469; #237 A15          | Improved Critical for the chosen weapon `baseType` doubles the threat range once (19–20 → 17–20, 18–20 → 15–20); further expanders are suppressed                                                                                                                                                                                                                                                                |
| Two-Weapon Rend                 | CRB p. 136                          | One `twoWeaponRend` entry (1d10 + 1½ positive Strength, a penalty in full) on routines with a calculable two-weapon off hand; never a single attack, never beside natural-main mixing                                                                                                                                                                                                                            |

**State and writers.** `attackRoutine.state.options` lists switched-on feat
Catalog Entry IDs. `createAttackRoutine` and `editAttackRoutine` accept the
whole list (`options: []` clears it); duplicates collapse. The sheet loader
authorizes every submitted reference; a new choice must be a feat that is a
Routine Option, while resending a retained choice keeps it for repair after
the feat leaves. Switching on an option whose feat has no active Selection is
accepted: the choice is recorded with the `missingRoutineOption` advisory
below and takes effect once the feat is selected or switched on. A feat is a Routine Option when its rule identity is one of
the hand-written options above or any of its Modifiers carries
`condition.option`; no separate catalog flag is stored. Catalog Copy remapping,
dependency discovery and release impact already treat `options` as a reference
field.

**Matching and advisories.** A recorded option applies through an active feat
Selection with the same Catalog Entry, or a copy with the same rule identity.
Without one it stays switched on with a routine-owned `missingRoutineOption`
warning ("isn't on the sheet" or "is switched off") and has no effect; a
recorded definition that is gone or is no Routine Option warns
`invalidRoutineOption`. Neither blocks the routine.

**Situations.** Modifiers carrying `condition.option` apply inside a routine's
lines through `ResolveOptions.routineOptions`. On any other target (AC, CMB)
the calculator rewrites them to the Situation `{ option: catalogEntryId }`,
so the AC breakdown shows "Only when using Combat Expertise" and the existing
Situation preview recomputes it.

**Calculated output.** Each routine adds `options` (offered and switched-on
options with `switchedOn`, `available` and `applicable`), `optionNotes`
(reach, Manyshot and "no effect" explanations) and `twoWeaponRend`. Lines may
carry `extraAttack` (`haste`, `rapidShot`, `medusasWrath`), `projectiles` and
`vitalStrike` (the multiplied dice are already in `damageDice`). The Rend
damage has its own breakdown target `{ kind: 'twoWeaponRend', entryId }`.
Keen and keen edge join the same threat doubling through #408's Item
Abilities and #416's item-targeted Spell Effects. Weapon Finesse reads the weapon
detail's `finesse` property, never the weapon's name; no representative Base
Item carries it yet (the dagger qualifies as a light weapon), and imported
weapons will set it from Foundry's `properties.fin`.

## Flurry of blows (#414)

Both admitted flurries are Routine Options of the counting class feature:
`monk-flurry` (CRB p. 57) and `unchained-monk-flurry` (Pathfinder Unchained
p. 14). Fixtures in `src/lib/character-sheet-flurry.test.ts` use printed
numbers through the public calculator; persisted writes and the class-version
switch are covered by `convex/characterSheetFlurry.integration.test.ts`. The
pure rules live in `src/lib/character-sheet-flurry.ts`; the line assembly is
in `character-sheet-attacks.ts`.

| Rule                         | Source                                    | Fixture outcome                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core flurry base attack      | CRB p. 57; FAQ naz                        | The monk class's BAB row is replaced by the monk level; other classes add normally. Fighter 19/monk 1: +20, flurry +18/+18/+13/+8/+3                                                    |
| Core flurry attacks          | CRB p. 56 Table: Monk; p. 57              | Iteratives from the flurry BAB plus one extra (two from 8th, three from 15th) at the highest, −5 and −10, −2 on every attack; all twenty printed rows                                   |
| NPC Codex monks              | NPC Codex, Monk                           | Careful Initiate, Cruel Devotee, Harrying Brute, Axe Dancer, Cautious Hunter, Sword Savant and Ageless Master match their printed single and flurry lines and damage                    |
| Power Attack, Combat Expertise | FAQ o72; owner (#414)                   | Steps from the flurry BAB: fighter 19/monk 1 takes −6/+12 (single −5/+10); Combat Expertise's data steps gain the difference on each melee flurry line, and its dodge bonus follows: monk 4 flurries at −2 for +2 AC (outside the flurry −1/+1) |
| Core Strength and off hand   | CRB p. 57; #237 A1, A2                    | Full Strength on every line; Power Attack ×½ only with an off-hand weapon (an unarmed off hand is ×1); a quarterstaff in two hands: Str ×1, Power Attack ×1½                           |
| Core two-weapon chain        | #237 A3                                   | No Table 8–7 penalties, Improved or Greater Two-Weapon Fighting attacks, Double Slice or Two-Weapon Rend                                                                                 |
| Unchained flurry attacks     | PU p. 14                                  | Ordinary BAB iteratives plus one extra at the highest base attack bonus, two from Unchained monk 11th; no penalty and no BAB substitution                                               |
| Unchained Strength, off hand | PU p. 14; #237 A4; owner (#414)           | Ordinary Strength and Power Attack per hand (off-hand weapon ×½, two hands ×1½); an unarmed off hand takes full Strength; no two-weapon penalties or chain attacks; Double Slice and Rend apply |
| Haste                        | FAQ qk0; PU p. 14                         | Haste's attack stacks at the highest bonus and takes a core flurry's −2                                                                                                                  |
| Mixed versions               | owner (#414)                              | Each flurry counts only its own version's monk levels; the family grants one Flurry of Blows, from the version recorded first                                                           |

**Lines.** The main weapon makes every flurry attack; a separate off-hand
weapon, the main weapon's other end or an off-hand unarmed strike makes the
extra attacks (#237). Without one, the extras follow the iterative at their
bonus, as Table: Monk prints them; with one, the main hand's iteratives come
first and the off hand's extras follow, laid out as two-weapon fighting.
Haste and Medusa's Wrath follow the first attack. Each extra carries
`extraAttack: { kind: 'flurry', sheetEntryId, name }`, crediting the class
feature; its −5 or −10 is labelled "Flurry of Blows extra attack N". The core
−2 is a contribution of the class feature, and the substituted BAB row keeps
the `builtin:class:monk` identity with the label "Flurry of Blows: monk level
N". The single attack never flurries. A reload- or draw-limited main hand
makes one attack and no extras; a limited off hand makes one extra.

**Routine output.** `flurry` is null unless a switched-on flurry applies.
Otherwise it records `version`, the class feature's `sheetEntryId` and
`name`, its own version's `monkLevel`, `baseAttackBonus` (the flurry BAB
breakdown), `extraAttacks`, `attackPenalty` (−2 or 0) and `combatExpertise`.
That last is null unless Combat Expertise is switched on in a melee flurry;
then it credits the feat and gives its `dodgeBonus` from the flurry's base
attack bonus (FAQ o72; owner, #414), equal to the penalty on the flurry's
lines. The option notes add a summary ("Flurry of Blows: base attack bonus
+20 with monk level 1, 1 extra attack, −2 on every attack.") and, with Combat
Expertise, its dodge bonus ("Combat Expertise: +2 dodge bonus to AC while
flurrying, from the flurry's base attack bonus."). `twoWeaponPenaltySummary`
is null in a flurry, and `twoWeaponRend` is null in a core flurry.

**Options and warnings.** `isRoutineOptionDefinition` accepts a class feature
only with a flurry rule identity, and options match counting class-feature
Grants as they match feat Selections. A recorded flurry whose Grant does not
count (another version's, or one an Archetype replaces) stays switched on with
`missingRoutineOption` and the `not-counting` problem. Incompatible choices
are kept with routine-owned advisories, subject `<routine>:flurry`:
`flurryNaturalAttacks` (natural attacks stay recorded and leave the flurry;
a natural main weapon leaves the option without effect), `flurryWeapon` (a
weapon without the monk quality keeps its flurry lines) and `flurryArmor`
(active armor or a shield). The sheet tracks no carried load, so the CRB's
medium or heavy load has no warning. `switchClassVersion` maps each recorded
flurry option to the target class's flurry feature and advances the routine's
revision.

**Weapons.** The CRB p. 144 monk quality is the weapon fact `monk: true`,
curated from the CRB list (kama, nunchaku, quarterstaff, sai, shuriken,
siangham); the unarmed strike always qualifies. The representative Base Items
add the quarterstaff (CRB pp. 142, 148) and kama (pp. 143, 147) and mark the
shuriken.

**Not computed.** Ki pool extra attacks, style strikes, Rapid Shot with a
shuriken flurry (noted as having no effect), the zen archer's and monk of the
empty hand's flurries, brawler's flurry and Feral Combat Training stay text.
The sheet's "Only when using Combat Expertise" AC Situation belongs to no
routine, so it keeps the sheet BAB; a flurry routine reports its own dodge
bonus instead. The seeded Zen Archer (APG p. 115) only replaces the monk's
Flurry of Blows, so its bow flurry stays text. Monk unarmed damage is still supplied by
the caller (`monkUnarmedStrike`).

## Item parts, ends, bash and materials (#408)

`calculateCharacterSheet` resolves every specific item through its Base Item
before calculating, then applies each item part's own state. Fixtures in
`src/lib/character-sheet-items.test.ts` use printed numbers through the public
calculator; persisted writes are covered by
`convex/characterSheetItems.integration.test.ts`. The deep module is
`src/lib/character-sheet-items.ts`.

| Rule                       | Source                         | Fixture outcome                                                                                                                                                                                                         |
| -------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base Item resolution       | #236; CRB pp. 464–478 (below)  | A specific weapon's `weapon` detail, proficiency included, always comes from its `baseItem`, never its placeholder; armor uses its own numbers, else the Base Item's; a shield without a category takes the Base Item's |
| Defaults copied once       | #236                           | `detail.magic` (masterwork, enhancement, material, abilities, `otherEnd`, `bash`) is cloned into the sheet entry's state on addition; the state is then the truth                                                       |
| Enhancement and masterwork | CRB p. 149; #236               | Per part: enhancement on attack and damage; masterwork, or a masterwork material, +1 attack only; highest-only stacking suppresses masterwork under enhancement                                                         |
| Double-weapon ends         | FAQ; #236                      | `otherEnd` has independent enhancement, masterwork, material and abilities; weapon-scoped ability Modifiers bind to their own end through `itemPart`                                                                    |
| Shield bash                | CRB pp. 152–153; #236          | A shield with `weapon` detail attacks with its `bash` state; its AC enhancement stays on `ac.shield`; a masterwork shield adds nothing to a bash without enhancement; _bashing_ (#764) adds +1 enhancement to the bash, highest-only against its own and Shield Master's, and steps its dice two sizes up (Medium light 1d3 → 1d6, heavy 1d4 → 1d8)                                                    |
| Shield Master              | CRB p. 134; FAQ; #237          | The bash takes no two-weapon penalty (the other hand keeps its own); the shield's AC enhancement reaches bash attack and damage as an enhancement bonus, highest-only against the bash's own                            |
| Ammunition and launcher    | CRB p. 468; #236               | The routine's ammunition competes highest-only with the launcher's enhancement on every ranged line; both items' abilities and dice apply                                                                               |
| Extra dice                 | CRB pp. 469–471; #237 A12, A13 | `hit` dice are `extraDamage` parts; `crit` dice add one die per printed multiplier step above ×2 (×3 → 2d10, ×4 → 3d10); extra dice are never multiplied, and Vital Strike leaves them unchanged                        |
| Situational dice           | CRB p. 470 (holy)              | Dice with a Situation (holy's `evil`, or _huntsman_'s local tracked creature on its own weapon, #764) carry `situation` and `applies: false` until that Situation is previewed                                                                                                          |
| Bane                       | CRB p. 469; #236               | Contributes nothing until its foe is chosen; then a conditional enhancement of the part's enhancement +2 on attack and damage and 2d6 in the shared Situation named by the foe (`undead` → "vs. undead")                |
| Keen                       | CRB pp. 127, 470; #237 A15     | `doublesThreat` joins the threat-range rule: keen alone 19–20 → 17–20; with Improved Critical the range doubles once and keen is listed as suppressed; an end's keen affects that end only                              |
| Materials                  | CRB pp. 154–155; #236          | Adamantine, darkwood, dragonhide and mithral are masterwork; alchemical silver gives any weapon −1 damage (minimum 1 stays text); cold iron changes nothing on the sheet                                                |

**Lines.** Every attack line carries `extraDamage: ExtraDamagePart[]`
(`dice`, `damageType`, `on`, `situation`, `applies`, the carrying item and the
Item Ability). The line's item contributions use the existing breakdown
leaves, so the UI reads attack and damage totals as before. Weapon-scoped
Modifiers on a line now know the attacking part and fired ammunition
(`ResolveOptions.weapon.part`, `ammunitionEntryId`): `$self` matches the item
part, and also the routine's ammunition. A `$self` Modifier with no `itemPart`
(a Modifier on the item's own definition rather than one of its Item
Abilities) matches every part of its item, so a specific double weapon's own
conditional enhancement reaches both ends; an Item Ability's Modifier carries
its `itemPart` and reaches that end only.

**Item Ability Modifiers and notes.** An active item's abilities source their
own Modifiers and Situational Notes with the item's sheet entry ID and the
ability's Catalog Entry ID. Modifiers without a weapon condition apply while
the item is worn (_shadow_'s +5 competence on Stealth); notes such as
_defending_ and _light fortification_ show with the item. A
`CHOSEN_FOE_SITUATION` (`$choice`) Situation is the chosen foe. An ability whose required choice is empty
contributes nothing.

**Construction warnings.** Checked for every item, equipped or not (#236:
they come from state only), per part with subject `entryId`,
`entryId:otherEnd` or `entryId:bash`, so acceptances stay per end:
`equipmentEnhancement` (over +5, from state only; the primary part keeps the
#306 subject and fingerprint), `itemAbilityWithoutEnhancement`,
`itemBonusEquivalent` (over +10), `itemDuplicateAbility`,
`itemAbilityAppliesTo` (wrong item kind or keen's damage types) and the
unresolved `itemAbilityUnavailable` and `itemBaseItemUnresolved`. An empty bane
foe is a missing choice (`choiceMissing`), not a warning. Prices are never
computed and no live enhancement pools are tracked. `itemConstructionWarnings`
takes a `targetedEnhancement` seam through which #416 counts an `onItem` Spell
Effect's enhancement toward the +10 cap.

**Specific item materials.** A specific item's own `material` is display only
when its own armor numbers include it (the _mithral shirt_); when its armor
comes from the Base Item (_dwarven plate_) or it is a weapon, the material's
table effects apply, since the Base Item's numbers don't include them. A state
material is used only when the definition has none. The item editor states
the material as "included in its numbers" only in the first case and as
"applied to its numbers" otherwise (`bakedMaterial.includedInNumbers`).
Adamantine armor reports `materialNote` ("damage reduction 3/—") rather than
a number. Alchemical silver follows the CRB p. 154 reading (owner decision,
2026-10-05): "On a successful attack with a silvered weapon, the wielder takes
a −1 penalty on the damage roll (minimum 1)" names no damage type, so every
silvered weapon or ammunition takes −1 damage. #236's slashing-or-piercing
restriction came from the data-model table, not from a decision.

**Output.** `itemParts` lists each item, equipped or not, with its parts
(`primary`, `otherEnd`, `bash`), its Base Item, its own material
(`bakedMaterial`), and each part's kind, enhancement, recorded and
effective masterwork, material, bonus equivalent and abilities (name,
`bonusEquivalent`, `choice`, `choiceMissing`, `available`, `appliesTo`,
`requiresChoice`). The sheet read hands Item Ability references back as
Catalog Entry IDs. Targeted Spell Effects (`onItem`) follow below.

**Editing.** The routine panel's Weapon details edit the main weapon's ends,
a separate off hand and a shield's bash, and the ammunition the routine
fires; the Gear panel edits every part of armor and shields, equipped or
not. Materials and bane's foe are free text of at most 64 characters, checked
in the form and by the writer.

**Specific item citations.** Specific items cite their own CRB page: _flame
tongue_ and _frost brand_ p. 473, _screaming bolt_ p. 476. The _mithral
shirt_ and _dwarven plate_ (specific armor, pp. 464–465) and the _darkwood
shield_ (specific shields, pp. 466–467) still cite their section's range:
their own pages are unverified.

## Spell Effects on items (#416)

A Spell Effect's sheet entry records `onItem`, the item part it enhances, and
the resolver binds its `$target` Modifiers and Situational Notes to that part.
The deep module is `src/lib/character-sheet-spell-effects.ts`; fixtures in
`src/lib/character-sheet-spell-effects.test.ts` use printed numbers through
the public calculator, and persisted writes are covered by
`convex/characterSheetSpellEffects.integration.test.ts`. Spell pages follow
the printed CRB layout and await an owner check.

| Rule                      | Source                    | Fixture outcome                                                                                                                                                    |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Caster level default      | CRB Chapter 3; #236       | The lowest caster level any listed class casts the Spell at: magic weapon 1, greater magic weapon 5, haste 4 (summoner 2nd), bless weapon 1 (paladin 4, offset −3) |
| Magic weapon              | CRB p. 307                | +1 enhancement on the target's attack and damage only; nothing until a target is chosen, and never on sheet-level attack statistics                                |
| Highest-only enhancement  | CRB p. 307; #236          | Against a +1 weapon magic weapon changes nothing; greater magic weapon at CL 8 (+2) wins; a masterwork weapon's +1 attack doesn't add                              |
| Ends, bash and ammunition | CRB pp. 152, 307, 468     | A targeted other end or bash takes it alone; greater magic weapon on arrows competes with the launcher's enhancement                                               |
| Unarmed and natural       | CRB pp. 306–307, 496      | Magic weapon on the unarmed strike, magic fang on a bite; mighty fists' `$unarmedOrNatural` enhancement competes highest-only                                      |
| Keen edge                 | CRB p. 302; #237 A15      | Doubles its target's threat range once, alongside keen or Improved Critical                                                                                        |
| Magic vestment            | CRB p. 307                | An AC `$target` enhancement lands on the worn armor's `ac.armor` or shield's `ac.shield`, highest-only with its own                                                |
| Targeted notes            | CRB pp. 239, 249          | Align weapon's and bless weapon's notes show on the target's lines beside its own Item Abilities' dice                                                             |
| Bonus equivalent over +10 | CRB p. 469; #236          | Counts the higher of the part's own and its targeted enhancement                                                                                                   |
| Temporary Effects         | CRB spell durations; #298 | Effects lasting a day or less, keen edge included, leave permanent lines; a permanent magic fang stays                                                             |

**Targets.** `onItem` names an item sheet entry or `'unarmed'`, with an
optional `otherEnd` or `bash`. A binding sets the Modifier's
`condition.weaponSelection` and its sourced `itemPart`; `$target` matches the
line whose attacking entry and part are the target, or whose fired
ammunition is. A target that is missing, gone or not equipped binds nothing.
`spellEffects[i].target.options` lists every item part and the unarmed strike
with its kind (`weapon`, `natural`, `unarmed`, `ammunition`, `armor`,
`shield`) and whether it suits the effect's `itemTarget` and, for keen
edge, deals piercing or slashing damage (CRB p. 302; a part with no recorded
damage type suits). An unsuitable choice stays recorded with the
`spellEffectTargetUnsuitable` advisory. Its weapon `$target` Modifiers and
notes, and keen edge's threat doubling, still apply on the chosen part's
lines. An AC `$target` Modifier lands only on worn armor's or a shield's own
AC leaf, so on a weapon, an ammunition, the unarmed strike or a shield's
bash it contributes nothing. A recorded target that left the sheet keeps its
choice with `spellEffectTargetUnavailable`.

**Representative seeds.** Prepared sheets carry browse-only Spell Effects for
magic weapon, greater magic weapon, keen edge, magic fang, greater magic fang,
magic vestment, align weapon, bless weapon, bull's strength, mage armor,
shield of faith and haste, with the Spells they name
(`convex/lib/representativeSpellEffectCatalog.ts`). Haste and mage armor
name the already seeded Spells; haste's `haste` Source gives the extra
attack.
