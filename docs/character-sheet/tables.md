## Tables

```ts
// Existing table, narrowed. Level and ability scores are derived from the sheet.
character: {
  name: string,
  ownerId?: string,                   // absent only for retained ownerless states; see "Ownership and campaigns"
  campaignId?: Id<'campaign'>,        // absent = in no campaign; a Character is in at most one
  description: string,                // labelled "Notes" in the UI
  kind: 'pc' | 'npc',
  isActive: boolean,
  sheetMode: 'militiaOnly' | 'full',  // presentation only, see "Two presentations"
  familiarBaseCreatureKey?: FamiliarBaseCreatureKey,
  familiarBaseScoresPending?: true, // only a newly created familiar awaiting recorded base scores
  sheetPermanentFacts?: {           // prepared permanent ledger projection; no general stat cache
    level: number, racialHitDice: number,
    strength: number, dexterity: number, constitution: number,
    intelligence: number, wisdom: number, charisma: number,
  },
}
// indexes: by_campaignId, by_ownerId_and_campaignId (#706; also serves owner-only lookups)

// Logical loaded shape; global identities have immutable definition bodies per Catalog Release.
// Campaign and Character definitions remain editable. Scope decides who sees an entry.
type RuleIdentity = string;            // durable equality identity; never dereferenced for an original definition
catalogEntry: {
  scope: 'global' | 'campaign' | 'character',
  campaignId?: Id<'campaign'>,         // campaign scope only; character-scope entries follow their Character
  characterId?: Id<'character'>,       // character scope
  name: string,
  ruleIdentity: RuleIdentity,          // new rule = new identity; copies inherit transitively, even after edits
  sourceKey?: string,                  // inherited shared Source; absent = ruleIdentity, never copiedFrom traversal
  stacksWithItself: boolean,           // official text says duplicates stack
  modifiers: Modifier[],               // bounded; empty is fine (a rope)
  situationalNotes?: SituationalNote[], // situational text with no number, see "Situational notes"
  detail: CatalogEntryDetail,          // discriminated on `kind`
  description?: string,                // sanitized rules text
  sources: Array<{ book: string; pages?: string }>, // feeds OGL Section 15
  externalKey?: string,                // global scope: `<repo>/<_id>`, finds the stable identity; pack is an ordinary field
  retired?: boolean,                   // global scope: absent from current content; hidden from pickers, kept for sheets
  copiedFrom?: Id<'catalogEntry'>,     // immediate copy origin, independent of transitive ruleIdentity; grants no access
  copiedFromFingerprint?: string,     // immediate origin at copy time; compare only while viewer can access it
  racialStatisticsCopy?: true,        // prepared Character-only race customization, hidden from the race picker
  unsupported?: string[],              // importer notes: unmappable targets, formulas outside the grammar
  prerequisites?: Prerequisite[],      // feats, traits, prestige classes, archetypes; all must hold, see "Rules checks"
  prerequisiteText?: string,           // original readable line, including unsupported clauses
  countsAsRaces?: RuleIdentity[]      // "count as both elves and humans"; equality only, no original payload needed
    | { oneOf: RuleIdentity[] },      // "count as either": the sheet entry's `choice` picks one
  grantsSlots?: Array<{ kind: 'feat' | 'trait'; count: number;   // bonus feats (fighter, human), Additional Traits
    featTypes?: string[];              // a bonus feat must carry one of these Foundry feat types, such as 'combat'; reviewed schedules give Fighter, Cavalier, Magus and Inquisitor rows theirs (S3)
    feats?: Id<'catalogEntry'>[];      // a bonus feat must be one of these (the half-elf's Skill Focus)
    ignoresPrerequisites?: boolean }>, // monk bonus feats, ranger combat style
  proficiencies?: ProficiencyGrant[],  // classes, Racial Traits, feats, class features, traits; see "Proficiencies"
}
// indexes: by_scope, by_campaignId_and_scope, by_characterId, by_sourceKey, by_externalKey, by_copiedFrom

// One row per thing a Character has, except Grants with no recorded state (see "Grants and dormant entries").
characterSheetEntry: {
  characterId: Id<'character'>,        // access follows the Character; no campaignId, because Characters move
  kind: EntryKind,                     // immutable, indexed
  catalogEntryId?: Id<'catalogEntry'>, // required for catalog-backed kinds, absent for state-only kinds
  active: boolean,                     // off drops its Modifiers and keeps the row
  grantKey?: GrantKey,                 // present = a Grant's stored state; absent = a Selection or state-only entry
  kept?: true,                         // counts even while dormant, with a warning; see "Grants and dormant entries"
  gainedAtClassLevel?: Id<'characterSheetEntry'>, // Selections (feats, traits, prompt picks): the Class Level that dates them;
                                       // a Grant's position comes from its Grant Key
  choiceOrder?: number,                // order among choices at that Class Level; set in order added, editable
  selectionSlot?: { id: string; position: number }, // feat/trait group and zero-based position; advisory capacity
  notes?: string,
  state: SheetEntryState,              // discriminated on `kind`
}
// indexes: by_characterId, by_characterId_and_kind, by_catalogEntryId

// A warning someone on the sheet marked as intended. The only stored part of the rules checks.
acceptedWarning: {
  characterId: Id<'character'>,
  check: string,                       // the check's key, such as 'pointBuy' or 'prerequisites.current'
  subject: string,                     // what it is about: a sheet entry id, or 'sheet'
  fingerprint: string,                 // semantic facts; reference remapping alone never reopens the warning
  acceptedBy: string,
  acceptedAt: number,
}
// indexes: by_characterId
```

The builder stops using the old `spell` and `characterSpell` tables at activation; a separate cleanup clears their rows and removes them (see "Migration and release"). Spells are `spell` Catalog Entries (see "Spellcasting").

### Entry kinds

```ts
// Catalog-backed: the sheet entry points at a Catalog Entry of the same kind.
type CatalogKind =
  | 'base'
  | 'race'
  | 'racialTrait'
  | 'class'
  | 'archetype'
  | 'classFeature'
  | 'feat'
  | 'trait'
  | 'item'
  | 'itemAbility'
  | 'spell'
  | 'spellEffect'
  | 'condition'
  | 'manual';
// State-only: no Catalog Entry; the resolver emits built-in Modifiers from state.
type StateKind =
  | 'classLevel'
  | 'abilityDamage'
  | 'abilityDrain'
  | 'attackRoutine';
type EntryKind = Exclude<CatalogKind, 'class' | 'itemAbility'> | StateKind; // a class is reached through Class Levels,
// an Item Ability through the item listing it

type CatalogEntryDetail =
  | { kind: 'base' }
  | {
      kind: 'race';
      racialHitDice: number; // 0 for every core race
      racialTraits: Id<'catalogEntry'>[]; // the standard Racial Traits it grants, see "Racial traits"
      racialProgression?: {
        creatureType: CreatureType; // needed when racialHitDice > 0
        hitDie: number;
        bab: 'full' | 'threeQuarters' | 'half';
        saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
        skillRanksPerHitDie: number;
        classSkills: SkillKey[];
      };
    }
  | {
      kind: 'racialTrait';
      raceEntryIds: Id<'catalogEntry'>[]; // the races it belongs to
      replaces: Id<'catalogEntry'>[]; // standard Racial Traits it replaces; non-empty = alternate
      favoredClassCount?: 2; // Multitalented; set by the Curation Overlay
      bonusSkillRanksPerLevel?: number;
    } // 1 for the human's Skilled, from Foundry `bonusSkillRanks`
  | {
      kind: 'class';
      classKind: 'base' | 'prestige' | 'npc';
      counterpartOf?: Id<'catalogEntry'>; // an Unchained Class: its original class
      hitDie: number;
      bab: 'full' | 'threeQuarters' | 'half';
      saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
      skillRanksPerLevel: number;
      classSkills: SkillKey[];
      alignments?: Alignment[]; // absent = any; set by the Curation Overlay
      casting?: Casting; // a casting class, see "Spellcasting"
      castingAdvances?: Array<{
        classLevel: number;
        count: number; // prestige "+1 level of existing spellcasting class"
        kind: 'any' | 'arcane' | 'divine';
      }>;
      featuresByLevel: Array<{
        classLevel: number;
        catalogEntryId: Id<'catalogEntry'>;
      }>;
      picksByLevel: Array<{ classLevel: number; list: string; count: number }>;
    } // "choose a rage power"; empty = no prompts
  | {
      kind: 'archetype';
      classEntryIds: Id<'catalogEntry'>[]; // the base class it varies; both versions where its source names both
      replaces: Array<{
        classLevel: number;
        catalogEntryId: Id<'catalogEntry'>;
        scope?: 'whole' | 'part';
      }>; // exact rows; absent scope = part
      adds: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }>;
      featureChanges?: Array<
        | { featureIdentity: RuleIdentity; scope: 'whole' }
        | { featureIdentity: RuleIdentity; scope: 'part'; part: string }
      >;
      classSkillsAdded?: SkillKey[];
      classSkillsRemoved?: SkillKey[];
      skillRanksPerLevel?: number;
    } // absent = the class's own
  | {
      kind: 'classFeature';
      parentFeature?: RuleIdentity;
      part?: string; // shared parent and independently replaceable part
      duplicateUpgrade?: Id<'catalogEntry'>; // advisory prompt only; never automatically upgrades
      spellcasting?: {
        // set by the importer or the Curation Overlay
        extraSlot?: 'domain' | 'school' | 'spirit'; // one extra slot per spell level from 1st
        grants?: {
          list: 'domain' | 'subDomain' | 'bloodline';
          key: string; // a Foundry `learnedAt` list: its Spells are granted
          atClassLevel?: number[];
        }; // schedule-style: the class level granting spell level 1, 2…; absent = slot-style
        school?: SchoolKey;
      };
    } // an arcane school: the specialist school
  | {
      kind: 'feat';
      featTypes?: string[]; // Foundry feat types: 'combat', 'general', 'teamwork'…
      repeatable?: 'no' | 'newChoice' | 'yes' | 'unreviewed'; // missing/unreviewed invents no duplicate restriction
      additionalTraits?: true;
    } // typed NPC entitlement; grantsSlots supplies +2 traits
  | { kind: 'trait'; traitType: string } // Foundry `traitType`: 'combat', 'faith', 'region', 'drawback'…
  | {
      kind: 'item';
      consumable: boolean; // later: slot
      price?: number; // gp, from an imported release body (#762); not calculated
      weight?: number; // lb., from an imported release body (#762); not calculated
      weapon?: {
        baseType: string; // Foundry `baseTypes`: what Weapon Focus names
        groups?: readonly WeaponGroup[]; // Foundry `weaponGroups`; a weapon can belong to several
        proficiency: 'simple' | 'martial' | 'exotic' | 'always'; // always: Foundry's forced `proficient: true`; see "Proficiencies"
        handedness: 'light' | 'oneHanded' | 'twoHanded' | 'ranged';
        dice: string; // "1d12", from `sizeRoll(1, 12, @size)`
        damageTypes: Array<'bludgeoning' | 'piercing' | 'slashing'>; // the damage part's types: keen and other damage-type-limited abilities
        threat: number;
        mult: number; // lowest threat roll (20, 19, 18) and multiplier
        rangeIncrement?: number;
        strRating?: number; // feet; composite bows
        reload?: 'free' | 'move' | 'fullRound'; // crossbows
        finesse: boolean; // Foundry `system.properties.fin`: Weapon Finesse applies
        monk?: boolean; // the CRB p. 144 monk quality (Curation Overlay): a monk may flurry with it
        thrown: boolean; // has a thrown attack (a `twak` action): dagger, spear, javelin
        otherEnd?: { dice: string; threat: number; mult: number }; // a double weapon's second end
        natural?: 'primary' | 'secondary';
      }; // a natural weapon; the type is written from the rules
      armor?: {
        slot: 'armor' | 'shield'; // see "Armor and shields"
        category:
          | 'light'
          | 'medium'
          | 'heavy'
          | 'buckler'
          | 'lightShield'
          | 'heavyShield'
          | 'tower'; // also its proficiency
        bonus: number;
        maxDex: number | null; // null = no cap
        armorCheckPenalty: number;
        asf: number;
      }; // armor check penalty; spell failure, in %
      baseItem?: Id<'catalogEntry'>; // a specific magic item's Base Item
      magic?: ItemEnchantment & { otherEnd?: ItemEnchantment }; // its defaults, copied into the sheet entry
      material?: MaterialKey;
    } // a specific item's, display only; see "Special materials"
  | {
      kind: 'itemAbility'; // see "Item Abilities"
      appliesTo:
        | 'melee'
        | 'ranged'
        | 'weapon'
        | 'armor'
        | 'shield'
        | 'armorOrShield'; // from the pf1-content tag
      bonusEquivalent: number; // +0 for flat-priced; a tiered ability is one entry per tier
      damageDice?: Array<{
        dice: string;
        damageType?: string;
        on: 'hit' | 'crit'; // crit: burst, thundering; ×3 → 2 dice, ×4 → 3
        situation?: Situation;
      }>; // holy "vs. evil", bane "vs. the chosen foe"
      doublesThreat?: true; // keen
      weaponDamageTypes?: Array<'bludgeoning' | 'piercing' | 'slashing'>; // keen: piercing or slashing; Curation Overlay
      choice?: 'creatureType';
    } // bane's designated foe, kept on the ItemAbilityRef
  | {
      kind: 'spell'; // the Spell itself; grants no Modifiers
      levels: Record<ClassTag, number>; // Foundry `learnedAt.class`; the record's own `level` is ignored
      grantedLevels: Partial<
        Record<'domain' | 'subDomain' | 'bloodline', Record<string, number>>
      >; // the rest of `learnedAt`
      school: SchoolKey;
      subschools: string[];
      descriptors: string[];
    } // the stat block stays in the description
  | {
      kind: 'spellEffect';
      spellKey?: string; // the Spell's rule identity
      lastsOverOneDay: boolean;
      defaultCasterLevel: number; // Foundry's buff `level`, used when spellKey is absent
      doublesThreat?: true; // keen edge, on its `onItem` weapon; Curation Overlay
      itemTarget?: 'weapon' | 'natural' | 'armorOrShield';
    } // what `onItem` may name: the target picker's filter and an advisory check
  | { kind: 'condition'; conditionKey?: ConditionKey }
  | { kind: 'manual' };

type SheetEntryState =
  | {
      kind: 'classLevel';
      classEntryId: Id<'catalogEntry'> | null; // one chosen definition per class across its levels; null = Unspecified
      position: number; // character level this row is, 1-based
      castingAdvances: Array<{
        classEntryId: Id<'catalogEntry'> | null;
      } | null>; // prestige levels: the class each advance goes to; null = not recorded yet
      hpGained: number | null;
      favoredClassBonus:
        | null
        | { choice: 'hp' }
        | { choice: 'skill' }
        | { choice: 'alt'; note: string };
      abilityIncrease: AbilityKey | null;
      skillRanks: Partial<Record<SkillKey, number>>;
      proficiencyChoice: string | null;
    } // a `baseType` for the class's `choice` grant (Favored Weapon);
  // read on the class's first Class Level
  | {
      kind: 'base'; // the one base-scores entry also holds sheet-wide facts
      alignment: Alignment | null;
      deity: string | null; // deity: a free-text name
      abilityMethod:
        | { kind: 'pointBuy'; budget: number }
        | { kind: 'rolled'; budget?: number };
      traitCount: number;
      campaignTraitRequired: boolean;
      proficiencies: {
        added: ManualProficiency[];
        removed: ManualProficiency[];
      };
    } // the player's own, see "Proficiencies"
  | {
      kind: 'race';
      racialHpGained: number | null; // hit points from all racial Hit Dice together
      racialSkillRanks: Partial<Record<SkillKey, number>>;
      favoredClassIds: Id<'catalogEntry'>[];
    }
  | { kind: 'racialTrait'; choice: string | null } // the ability of "+2 to one ability score", Dragon Soul's race
  | {
      kind: 'feat';
      choice: string | null; // Weapon Focus's weapon (a `baseType`, Bite or Claw included), Skill Focus's skill…
      slot: 'general' | { grantedBy: SelectionReference; slotIndex?: number };
    } // whose `grantsSlots` it fills: a Grant by
  // its Grant Key, a Selection by its id
  | { kind: 'abilityDamage'; ability: AbilityKey; points: number }
  | { kind: 'abilityDrain'; ability: AbilityKey; points: number }
  | {
      kind: 'item';
      quantity: number; // later: charges
      masterwork: boolean;
      enhancement: number; // 0 = none; see "Weapons and armor"
      abilities: ItemAbilityRef[];
      material: MaterialKey | null;
      otherEnd?: ItemEnchantment & { material: MaterialKey | null }; // a double weapon's second end
      bash?: ItemEnchantment;
    } // a shield's bash, apart from its AC enhancement
  | {
      kind: 'spell';
      castingClassId: Id<'catalogEntry'>; // the Spellcasting it is recorded for
      level: number | null;
    } // null = the class's level for it; set for off-list Spells
  | {
      kind: 'spellEffect';
      casterLevel: number; // pre-filled, see "Spell Effects"
      onItem?: {
        entry: Id<'characterSheetEntry'> | 'unarmed'; // the weapon or armor it enhances, see "Spells on an item"
        end?: 'otherEnd' | 'bash';
      };
    }
  | {
      kind: 'classFeature';
      oppositionSchools: SchoolKey[]; // arcane schools only; empty otherwise
      weaponGroup: WeaponGroup | null;
    } // Weapon Training's chosen group
  | {
      kind: 'attackRoutine';
      name: string;
      main?: {
        weapon: RoutineWeapon;
        hands: 'two' | 'one';
        thrown: boolean; // absent = natural attacks only
        ammo?: Id<'characterSheetEntry'>;
      }; // a ranged weapon's ammunition, see "Ammunition"
      off?:
        | { kind: 'weapon'; weapon: RoutineWeapon; thrown: boolean }
        | { kind: 'otherEnd'; thrown: boolean }; // two-weapon fighting; other end of the main Double weapon
      natural: Id<'characterSheetEntry'>[]; // natural weapons attacking too
      options: Id<'catalogEntry'>[];
    } // switched-on Routine Options, see "Attacks"
  | {
      kind: Exclude<
        EntryKind,
        | 'classLevel'
        | 'base'
        | 'race'
        | 'racialTrait'
        | 'feat'
        | 'abilityDamage'
        | 'abilityDrain'
        | 'item'
        | 'attackRoutine'
        | 'spell'
        | 'spellEffect'
        | 'classFeature'
      >;
    };

type RoutineWeapon = Id<'characterSheetEntry'> | 'unarmed'; // an item entry, or the built-in unarmed strike
type GrantKey = {
  source: RuleIdentity | string; // durable race/class/Archetype identity, or canonical parent Grant Key id / Selection id
  classLevel?: number; // level within the class; class and Archetype features
  entry: RuleIdentity;
}; // granted rule's identity; neither field reads copiedFrom
type ItemEnchantment = {
  masterwork: boolean;
  enhancement: number;
  abilities: ItemAbilityRef[];
};
type ItemAbilityRef = { id: Id<'catalogEntry'>; choice: string | null }; // choice: bane's designated foe
type MaterialKey =
  | 'adamantine'
  | 'mithral'
  | 'darkwood'
  | 'dragonhide'
  | 'coldIron'
  | 'alchemicalSilver';
```
