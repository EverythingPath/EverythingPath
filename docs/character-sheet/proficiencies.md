## Proficiencies

Decided by [Decide how the builder treats the remaining CRB attack feats and open attack rulings](https://github.com/AndreasUnunger/EverythingPath/issues/237). It reverses [Decide which rules checks the builder warns about](https://github.com/AndreasUnunger/EverythingPath/issues/215) where that never recorded proficiencies and showed nothing for proficiency clauses.

- **Tracked.** Weapons, armor (light, medium and heavy) and shields (shield and tower shield). A buckler counts as a shield.
- **Derived, never stored.** A Character's proficiencies are the union of the grants on its active sheet entries (the classes of its Class Levels, Racial Traits, feats, class features and traits), plus the player's additions, minus the player's removals. Multiclassing adds the new class's grants.

```ts
type ProficiencyGrant =
  | {
      category:
        | 'simple'
        | 'martial'
        | 'firearm' // firearm: every weapon in the firearms group
        | 'light'
        | 'medium'
        | 'heavy'
        | 'shield'
        | 'towerShield';
    }
  | { baseType: string; asMartial?: true } // asMartial: "treat dwarven weapons as martial"; counts only with `martial`
  | { group: WeaponGroup } // "Close Weapon Group"
  | { choice: true }; // the entry's choice: a feat's `choice`, a Class Level's `proficiencyChoice`
type ManualProficiency = Exclude<ProficiencyGrant, { choice: true }>;
```

- **What a grant covers.**
  - A weapon is covered by a grant of its `proficiency` category (`simple` or `martial`), its `baseType`, its `group`, or `firearm` for the firearms group. An exotic weapon is covered only by name or group. A weapon with `proficiency: 'always'` (natural attacks, the unarmed strike, alchemical throwables) is always covered.
  - A bastard sword or dwarven waraxe counts as martial in two hands (CRB), so a `martial` grant covers it there. In one hand only a grant naming its `baseType` covers it, Exotic Weapon Proficiency included.
  - A shield's bash is `martial` (CRB weapon table).
  - Armor's `category` gives its proficiency: `light`, `medium` or `heavy`; `buckler`, `lightShield` and `heavyShield` need `shield`, and `tower` needs `towerShield`.
- **Choices.**
  - Martial and Exotic Weapon Proficiency grant the feat's chosen `baseType`. Simple Weapon Proficiency grants all simple weapons.
  - Cleric, warpriest and inquisitor Favored Weapon, and the commoner's "1 simple weapon", are a `choice` grant on the class. The player picks a `baseType` in `proficiencyChoice` on the class's first Class Level. An empty choice grants nothing and shows no warning. The deity stays free text, so nothing checks the choice against it.
- **Manual changes.** The base entry's `proficiencies` holds the player's additions and removals, each shown as manual. A removal wins over every grant covering the same weapon, armor or shield. Removal exists because Archetype proficiency changes stay prose (see "Archetypes and prestige classes").
- **Effects.**
  - A routine line with a weapon the Character isn't proficient with takes −4 on attack.
  - Active armor or a shield the Character isn't proficient with adds its armor check penalty to every attack line and to the Str- and Dex-based skills that involve moving (CRB). Those skills already take the armor check penalty (see "Armor and shields"), so it never counts twice.
  - Each penalty is named in the breakdown ("not proficient: longsword"). Being nonproficient raises no warning.
  - **One-handed exotic.** A bastard sword or dwarven waraxe held in one hand without a grant naming it shows an advisory warning (CRB FAQ `#v5748eaic9qut`). The line is still computed as written: one-handed, with the −4.
- **Prerequisites.** Proficiency clauses are checked (see "Prerequisites").
- **Import of grants.**
  - Foundry's `system.weaponProf` and `system.armorProf` string arrays become `proficiencies`. They sit on all 49 system classes, 9 races, 24 pf1-content racial traits, a few traits, 5 class features and the proficiency feats. A race's move onto its weapon familiarity trait (see "Racial traits").
  - The keys `simple`, `martial`, `lgt`, `med`, `hvy`, `shl` and `twr` map to categories. Free-text names match a `baseType` ignoring case and spelling, and the Curation Overlay fixes the ~38 variants that still fail.
  - Martial and Exotic Weapon Proficiency are corrected to `{ choice: true }`, because v11.11 wrongly grants all martial weapons and a placeholder.
  - The Curation Overlay resolves the class strings. "Close Weapon Group" becomes a group grant, "Firearms" the `firearm` category, "Monk Quality" the monk weapons list, and "1 simple weapon" and "Favored Weapon" a choice. "Bombs" is dropped, as it is no weapon item, and "No Metal Armor" stays text.
  - Since [#720](https://github.com/AndreasUnunger/EverythingPath/issues/720) the importer also gives a race its own `weaponProf` list when no standard trait carries it (the Drow Noble's hand crossbow, rapier and short sword), and gives a creature type its category keys (Outsider's `simple` and `martial`). See [Race facts](../catalog-import/README.md#race-facts).
  - The Curation Overlay also writes weapon familiarity for every admitted race (CRB, APG and ARG traits), with "treat elven weapons as martial" and its kin as an explicit list of `asMartial` base types, and the CRB class-feature grants. Other prose grants aren't structured: the player adds them.
- **Import of item proficiency.**
  - A system-pack weapon's `proficiency` is its `system.subType`, and a missing one is `simple`. pf1-content magic weapons mostly lack it (315 of 436 disagree with their base), so a specific weapon takes its Base Item's through `baseTypes` (see "Specific magic items").
  - Foundry's forced `proficient: true` (natural attacks, the unarmed strike, alchemical throwables) becomes `always`.
  - Armor's `category` comes from `system.equipmentSubtype`: `lightArmor`, `mediumArmor` and `heavyArmor`; `lightShield`, `heavyShield`, `towerShield`, and `other` for a buckler. pf1-content shields with an empty subtype take their Base Item's. The armor check penalty is `system.armor.acp`.
