## Weapons and armor

Decided by [Decide how enhancement and special abilities attach to weapons and armor](https://github.com/AndreasUnunger/EverythingPath/issues/236).

- **State on the item.** An item's enhancement, masterwork, material and Item Abilities are state on its sheet entry, never separate entries or a Catalog Copy. Two longswords are two sheet entries, each with its own enchantment.
- **Always on.** Command-word abilities such as _flaming_ count as always on. Switching them during play is out of scope, so a burst weapon's dice always show (A12 needs no ruling).
- **Per end and per bash.** A double weapon's `otherEnd` ("the double weapon is treated as two separate weapons", FAQ) applies when a routine's `offHand.kind` is `'otherEnd'`. A shield's `bash` is its own enchantment (see "Armor and shields"). Everything below holds for each end and each bash.
- **Not modelled.** Class features that enchant a weapon for a while (paladin divine bond, magus arcane pool, warpriest sacred weapon) are play-time state. Their text stays on the class feature. Gold-piece prices are never computed.
- **Editing.** There is no prototype. The item editor follows the routine side panel (a bottom sheet on phone): an enhancement stepper, a masterwork toggle, a material select, an Item Ability picker filtered by `appliesTo`, and the construction warnings inline.
- **Prepared item state (#408).** Item entry state, `otherEnd` and `bash` each store `masterwork`, `enhancement`, `material` and `abilities: { catalogEntryId, choice? }[]` (the reference field is `catalogEntryId`, so Catalog Copy remapping, dependency discovery and sheet-load authorization already follow it). Item details add `baseItem` (a Catalog Entry reference, added to the shared reference-field list) and `magic` defaults; `itemAbility` is a separate Catalog Entry variant with `appliesTo`, `bonusEquivalent`, `damageDice` (`situation` may be `$choice`, the chosen foe), `doublesThreat`, `weaponDamageTypes`, `choice: 'creatureType'` and `foeEnhancement` (bane's +2, applied as a conditional enhancement above the part's own rather than a separately typed bonus, so highest-only stacking cannot swallow it). The calculator resolves Base Items once per calculation; armor from the Base Item is marked so a specific item's material still applies to numbers that don't include it. `editEquipment` patches one part, including the whole ability list. Representative Base Items (armor, shields with bash statistics), checked CRB Item Abilities and official specific items are browse-only seeds, not a curated Catalog Release. No production migration or cutover is performed. See [the calculation contract](../attack-calculation.md#item-parts-ends-bash-and-materials-408).

### Enhancement and masterwork

- **Enhancement.** A weapon's is a built-in `enhancement` Modifier on `attack` and `damage` with `weapon: '$self'`. Armor's and a shield's are in "Armor and shields".
- **Masterwork.** The `masterwork` flag is kept, but an item with enhancement +1 or more, or of a masterwork material, counts as masterwork whatever the flag. Nothing warns about magic that isn't masterwork.
  - A masterwork weapon has a built-in +1 `enhancement` Modifier on `attack` only, with `weapon: '$self'`. Highest-only stacking suppresses it under any enhancement bonus, so no special rule is needed.
  - Masterwork armor or a masterwork shield has −1 armor check penalty, kept when it is magic.
  - Masterwork armor or shields never add to a shield bash or to armor used as a weapon.

### Armor and shields

- **Effective bonus.** Each active armor or shield combines its base bonus with its strongest applicable enhancement, including its saved enhancement and Spell Effects targeting that object. The resulting armor or shield bonus competes on `ac.armor` or `ac.shield`. Bracers +4 therefore beat +1 leather (2+1), while +3 leather (2+3) wins (CRB pp. 310, 504). The breakdown retains the evaluated components and their Sources; a losing item's enhancement cannot add independently. "Worn" is the sheet entry's `active` flag. Touch AC and CMD omit these bonuses. Equipped penalties and caps remain even when an item's AC bonus loses.
- **Legacy slot enhancements.** An enhancement on an armor/shield leaf without an explicit recipient competes with saved enhancement on ordinary items on that leaf; it never enhances bracers. Without an ordinary item it supplies a zero-base candidate of that leaf's type. Multiple ordinary items retain this slot-wide compatibility behavior, which cannot identify the intended recipient. Explicit recipients are required before claiming unambiguous multi-armor targeting. Sanctify Armor and the Magic Vestment buff remain held; this does not migrate or admit their content.
- **Support boundaries.** Regular clothing is permitted by Magic Vestment's text but is not offered by the current armor/shield target picker. Bracers still cannot receive armor Item Abilities. The calculator does not deactivate a losing entry's non-AC properties under the bracers' "ceases functioning" wording. These are separate gaps, not claims of complete item behavior.
- **Max Dex.** Dex to AC is capped by the lowest `maxDex` among active armor and shields.
- **Armor check penalty.** The sum of active armor's and shields' `armorCheckPenalty`, after masterwork and material.
- **Spell failure** is shown, not computed.
- **Tower shield.** Its −2 on attacks is a Curation Overlay Modifier on the tower shield entry.
- **Shield bash.** Foundry gives each shield a "Bash" melee action (heavy steel shield: 1d4 bludgeoning), and the shield's `weapon` detail is mapped from it. So a shield can be a routine weapon, usually off hand: a light shield's bash is light, a heavy shield's one-handed.
  - A bash uses the `bash` enchantment. The shield's own enhancement stays on `ac.shield` ("An enhancement bonus on a shield does not improve the effectiveness of a shield bash made with it, but the shield can be made into a magic weapon in its own right", CRB).
  - _Bashing_ is a shield Item Ability with `sourceKey: 'bashing'`. Its +1 on attack and damage are Modifiers with `weapon: '$self'` that bind to the bash wherever the ability is listed (the shield or its bash, neither flagged), and the hand-written rule its Source names deals bash damage two size categories larger than the wielder's size: a Medium light shield 1d6, a heavy one 1d8 (#764).
  - Losing the shield's AC bonus after a bash stays text. With Shield Master the shield's enhancement also reaches the bash, as a weapon enhancement bonus that doesn't stack with the `bash` enchantment's (see "Attacks").
- **Spikes.** Armor spikes and shield spikes are separate weapon items in Gear, as in Foundry.

### Item Abilities

- **Entries.** Each weapon, armor or shield ability, such as _flaming_, _keen_ or _fortification_, is an `itemAbility` Catalog Entry. They come from pf1-content's `pf-special-qualities` pack, 333 prose-only records, because Foundry has no way to attach an ability to an item. An item lists them as `ItemAbilityRef`s.
- **Modifiers.** An ability's Modifiers bind to the item listing it.
  - Weapon Modifiers carry `weapon: '$self'`: _bane_'s +2 enhancement on attack and damage in its Situation.
  - A Modifier with no weapon condition applies while the item is active: _shadow_'s +5 competence on Stealth.
  - Situational ones work as anywhere else: _arrow catching_'s +1 deflection vs. ranged attacks.
  - _Speed_ has `sourceKey: 'haste'`, so its extra attack comes from the haste rule and doesn't stack with _haste_. It is the speed weapon's own: only an active item whose attacking part (the weapon, the end or the bash) lists it gives the routine an extra attack, with that weapon or end (#764).
- **Choice.** _Bane_'s designated foe is the `ItemAbilityRef`'s `choice`. Until it is chosen, its Modifiers and dice contribute nothing and the field shows a blue outline.
- **Dice.** `hit` dice are an extra damage part, or Situational damage with a `situation` (see "Attacks"): a shared key, the chosen foe, or a local or option Situation of the item carrying the die (_huntsman_'s tracked creature, #764). `crit` dice (_flaming burst_, _thundering_) apply only on a critical hit, one more die per multiplier step above ×2. They read the weapon's printed multiplier, not Weapon Mastery's raised one, so never more than ×4 (A13). Extra dice are never multiplied on a critical (CRB).
- **Keen.** `doublesThreat` feeds the threat-range rule in "Attacks".
- **No sheet statistic.** _Fortification_, damage reduction, spell resistance, energy resistance, _defending_, _brilliant energy_ and _ghost touch_ are Situational Notes on the ability. Overcoming damage reduction (+3 as cold iron and silver, _holy_ as good) isn't computed.
- **Tiers.** A tiered ability is one entry per tier (_fortification_ light, moderate and heavy), as pf1-content already splits _spell resistance_ 13, 15, 17 and 19.
- **Import.** The importer reads `appliesTo` from the pack's tag (Melee, Ranged, Universal Weapon, Armor, Shield, and Universal Armor & Shield Qualities as `armorOrShield`, #764) and `bonusEquivalent` from the price prose: 241 plain +1 to +5, 72 flat gold prices as +0, and a few tiered.
- **Drafting.** The situational-notes drafter (parser plus agent) drafts each ability's dice, Modifiers and notes from its description, seeded by the 19 conditionals of Foundry's `*Weapon Enchant Conditional Modifiers` helper (see "Situational notes"). Each record is `drafted` or `checked`, and the note gate covers every `itemAbility`. CRB abilities are checked before launch, the coverage bar of [Decide which attack options an Attack Routine supports](https://github.com/AndreasUnunger/EverythingPath/issues/229). The rest ship `drafted`.

### Specific magic items

- **Upstream.** pf1-content has 387 magic weapons and 228 magic armors and shields as standalone records.
  - Their weapon data is broken: a placeholder `sizeRoll(1, 4, @size)` melee action with no critical, even on bows.
  - The only link to a base is free-text `baseTypes`.
  - Enhancement and abilities are prose ("This is a +1 flaming burst longsword").
- **Base Item.** A specific item is an `item` Catalog Entry with `baseItem`.
  - Its `weapon` detail always comes from the Base Item, never from Foundry's placeholder, its `proficiency` included.
  - Its `armor` detail comes from the record's own numbers when it has them (the _mithral shirt_ and _celestial armor_ bake theirs in), else from the Base Item (_dwarven plate_ has no armor block). A shield with an empty subtype takes its `category` from the Base Item.
  - Released Base Items use explicit stable keys, resolved to stored IDs with missing/duplicate/wrong-kind checks. The bounded #761 bridge maps Frost Brand to Greatsword; its launch inventory includes that requirement. The remaining specific-item identities stay with their curation owners. Old native-shaped releases and pf1-content weapon placeholders refuse conversion until reimported with a supported profile.
  - Reaver's Scythe's native 19–20 range already includes keen. Its release remains explicitly refused until the model can preserve the non-stacking interaction with Improved Critical; it cannot calculate 17–20 from that payload.
- **Defaults.** `magic` holds the default masterwork, enhancement, abilities and other end, drafted from the prose and checked in the Curation Overlay. Adding the item to a sheet copies them into the sheet entry's state, which is then the truth and stays editable, like a Spell Effect's pre-filled caster level.
- **On the entry.** The description, price, unique powers (_flame tongue_'s ray) and the item's own Modifiers stay on the Catalog Entry.
- **Conditional enhancement.** _Sun blade_ (+4 vs. evil), _mace of smiting_ (+5 vs. constructs), _oathbow_ (vs. a sworn enemy), _holy avenger_ (+5 _holy_ in a paladin's hands), _dwarven thrower_ (in a dwarf's hands) and _sword of the planes_ get Situational `enhancement` Modifiers on attack and damage with `weapon: '$self'`, written by the Curation Overlay.
  - Target conditions use shared or local Situations. Wielder conditions use a local Situation too, not a new condition kind.
  - A player who wants the bonus on the face of the sheet sets the state's enhancement.

### Spells on an item

- **Target.** A Spell Effect that enhances one weapon or armor records `onItem`: a sheet entry or the unarmed strike, and optionally the other end or the bash. This covers _magic weapon_, _greater magic weapon_, _magic vestment_ and _magic fang_.
  - `weapon: '$target'` limits a Modifier to attacks with that weapon or end.
  - A `$target` Modifier on an AC target lands on that item's leaf, `ac.armor` or `ac.shield` (_magic vestment_).
  - Highest-only `enhancement` stacking settles _magic weapon_ against the weapon's own +1.
  - _Keen edge_'s `doublesThreat` applies to its `onItem` weapon (see "Attacks").
  - Until `onItem` is filled, its `$target` Modifiers contribute nothing and the field shows a blue outline.
- **Unarmed and natural.** `weapon: '$unarmedOrNatural'` limits a Modifier to the unarmed strike and natural attacks (_amulet of mighty fists_; the prepared catalog seeds the +1 to +5 amulets browse-only, CRB p. 496). A monk's unarmed strike counts as both a manufactured and a natural weapon for these (CRB monk).
- **Implemented (#416).** `onItem` is `{ entry, end? }`: an item sheet entry or `'unarmed'`, and optionally `otherEnd` or `bash`. `editSheetEntry` records it (`null` clears it) and refuses only impossible targets: an entry that is no item on this sheet, an other end on a weapon without one, a bash on a shield that can't bash, or an end on the unarmed strike. The resolver binds each `$target` Modifier and Situational Note to that part (`condition.weaponSelection` plus the sourced `itemPart`): it applies on lines attacking with that part, or firing that ammunition, and never on sheet-level attack statistics. An AC `$target` Modifier lands on the targeted worn armor's `ac.armor` or shield's `ac.shield`. A target that is missing, no longer on the sheet or not equipped binds nothing. Enhancement competes highest-only with the part's own, masterwork and the launcher's; targeted notes and keen edge's `doublesThreat` join the part's own Item Abilities, threat doubling still applying once. The +10 bonus-equivalent check counts the higher of the part's enhancement and its targeted enhancement. `spellEffects[i].target` reports `itemTarget`, `onItem`, `status` (`missing`, `available`, `inactive`, `unavailable`), the target's name, suitability and every offered part. Advisories: `spellEffectTargetUnavailable` when the recorded target is gone, and `spellEffectTargetUnsuitable` when it doesn't match `itemTarget` (which otherwise follows the Modifiers: AC means armor or shield, else a weapon) or, for keen edge's `doublesThreat`, deals neither piercing nor slashing damage (CRB p. 302). An unsuitable weapon target still binds; an AC Modifier on anything but worn armor or a shield contributes nothing. The sheet calls `onItem` the Spell Effect's Target: the calculation reports it in `spellEffects[i].target` and the client's `setTarget` writes it. A missing target is a missing choice, not a warning. Temporary targeted effects drop out of permanent calculations with every other Temporary Effect.

### Ammunition

- A routine's ranged main weapon may name `ammo`, an ammunition item. Its enhancement and Item Abilities apply to that routine's lines.
  - Its enhancement competes with the launcher's by highest-only ("Only the higher of the two enhancement bonuses applies", CRB).
  - The launcher's abilities still apply, since bows pass them to their ammunition (CRB).
  - Without `ammo` nothing changes.
- Ammunition items have the same state, `quantity` included. Foundry's 120 ammunition records carry no enhancement. Some magic ammunition is a weapon record (_screaming bolt_, +2) and imports as an item like any other.

### Special materials

- **Table.** Item state's `material` is applied by a hand-written CRB table. Other books' materials are text.

  | Material          | Effect                                                                                          |
  | ----------------- | ----------------------------------------------------------------------------------------------- |
  | Mithral           | armor: −3 armor check penalty (minimum 0), +2 max Dex, −10% spell failure; masterwork           |
  | Darkwood          | shield: −2 armor check penalty; masterwork                                                      |
  | Adamantine        | masterwork; armor: damage reduction 1, 2 or 3 for light, medium or heavy, as a Situational Note |
  | Dragonhide        | masterwork                                                                                      |
  | Alchemical silver | −1 damage (minimum 1)                                                                           |
  | Cold iron         | nothing on the sheet                                                                            |

- **Mithral.** Its −3 doesn't stack with masterwork's −1. The CRB is silent, and _elven chain_ and the _mithral shirt_ only fit no stacking. "One category lighter" stays text: per the FAQ it doesn't change the actual category.
- **One material.** Only the most prevalent material applies, so an item has one. A double weapon's other end has its own.
- **Specific items.** A specific item's material (Foundry `material.normal`) is display-only in its catalog detail, because its numbers already include it. The table applies only when state sets a material on an item whose Catalog Entry has none.
