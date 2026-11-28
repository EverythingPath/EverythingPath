// pbl-released-gear (PRD #251): the gear resolver tests' seam over entries
// imported with importReleasedEntries. It builds the sheets the eight gear
// batch adapters built (tests/fixtures/<batch>/sheet.ts), from imported
// entries instead of a batch preview, and looks entries up by key or name
// within one of the gear key lists (released-gear-keys.ts), as the batch
// tests looked them up within their preview.
import { z } from 'zod';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { preparedItemWeapon } from '../../src/lib/catalog/imported-item';
import {
  abilityKeys,
  abilityTargets,
  catalogModifierTargets,
  modifierConditionSchema,
  modifierTargets,
  personalBonusTypes,
  resolveSheet,
  situationalNoteSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { armorCategory } from '../../src/lib/character-sheet-armor-categories';
import {
  defaultAttackRoutineConfiguration,
  type WeaponDetail,
} from '../../src/lib/character-sheet-attacks';
import { gearSelections, type GearSelection } from './released-gear-keys';
import type { ReleasedEntry } from './released-entries';

export type ReleasedEntries = ReadonlyMap<string, ReleasedEntry>;

const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets),
  bonusType: z.enum(personalBonusTypes),
  value: z.number(),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
});
const handedness = {
  light: 'light',
  '1h': 'oneHanded',
  '2h': 'twoHanded',
} as const;
const proficiency = z.enum(['simple', 'martial', 'exotic']);

function imported(entries: ReleasedEntries, key: string) {
  const row = entries.get(key);
  if (!row) throw new Error(`${key} was not imported`);
  return importedCatalogEntrySchema.parse(row);
}
function sheetModifiers(entry: ReturnType<typeof imported>) {
  return {
    modifiers: entry.modifiers.map((modifier) =>
      modifierSchema.parse(modifier),
    ),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            situationalNoteSchema.parse(note),
          ),
        }
      : {}),
  };
}

/**
 * The weapon sheets of the weapons-and-ammo batches' adapter
 * (tests/fixtures/weapons-and-ammo-42x/sheet.ts), over imported entries.
 */
export function weaponSheets(entries: ReleasedEntries) {
  /** A melee weapon's imported detail as the sheet's weapon. */
  function sheetWeapon(key: string): WeaponDetail {
    const entry = imported(entries, key);
    const weapon =
      entry.detail.kind === 'item' ? entry.detail.weapon : undefined;
    if (weapon && 'baseType' in weapon) return preparedItemWeapon({ weapon });
    if (!weapon?.dice || !(weapon.handedness in handedness))
      throw new Error(`${key} is not a mapped melee weapon`);
    return {
      baseType: (weapon.baseTypes[0] ?? entry.name).toLowerCase(),
      proficiency: proficiency.parse(weapon.proficiency),
      groups: weapon.groups,
      handedness: handedness[weapon.handedness as keyof typeof handedness],
      attackType: 'melee',
      dice: weapon.dice,
      damageTypes: weapon.damageTypes,
      threat: weapon.threat,
      mult: weapon.mult,
      finesse: weapon.finesse,
      strengthDamage: 'melee',
    };
  }
  /** A ranged weapon's imported detail as the sheet's weapon. */
  function rangedWeapon(key: string): WeaponDetail {
    const entry = imported(entries, key);
    const weapon =
      entry.detail.kind === 'item' ? entry.detail.weapon : undefined;
    if (weapon && 'baseType' in weapon) return preparedItemWeapon({ weapon });
    if (
      !weapon?.dice ||
      weapon.handedness !== 'ranged' ||
      !weapon.rangeIncrement
    )
      throw new Error(`${key} is not a mapped ranged weapon`);
    return {
      baseType: (weapon.baseTypes[0] ?? entry.name).toLowerCase(),
      proficiency: proficiency.parse(weapon.proficiency),
      groups: weapon.groups,
      handedness: 'light',
      attackType: 'ranged',
      dice: weapon.dice,
      damageTypes: weapon.damageTypes,
      threat: weapon.threat,
      mult: weapon.mult,
      strengthDamage: 'crossbow',
      rangeIncrement: weapon.rangeIncrement,
    };
  }
  /** The item's imported Modifiers and Notes, with its weapon when asked. */
  function itemDefinition(
    key: string,
    { weapon = false }: { weapon?: boolean } = {},
  ): CharacterSheetCatalogEntry {
    const entry = imported(entries, key);
    if (entry.detail.kind !== 'item') throw new Error(`${key} is not an item`);
    return {
      _id: entry.externalKey,
      name: entry.name,
      ruleIdentity: entry.externalKey,
      stacksWithItself: false,
      ...sheetModifiers(entry),
      detail: {
        kind: 'item',
        consumable: entry.detail.consumable,
        ...(weapon ? { weapon: sheetWeapon(key) } : {}),
      },
    };
  }
  /**
   * A sheet with base scores (Strength and Dexterity as given, 10
   * elsewhere), a base attack bonus, the weapon Proficiency categories and
   * base types added by hand, an Attack Routine for each listed weapon and
   * the other items carried.
   */
  function weaponSheet({
    weapons = [],
    items = [],
    strength = 10,
    dexterity = 10,
    bab = 0,
    categories = [],
    baseTypes = [],
  }: {
    weapons?: readonly string[];
    items?: readonly string[];
    strength?: number;
    dexterity?: number;
    bab?: number;
    categories?: readonly ('simple' | 'martial')[];
    baseTypes?: readonly string[];
  }): CharacterSheetInput {
    const routines: SheetEntry[] = weapons.map((key) => ({
      _id: `routine:${key}`,
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: key,
        weaponEntryId: `item:${key}`,
        ...defaultAttackRoutineConfiguration(sheetWeapon(key)),
      },
    }));
    return {
      characterKind: 'pc',
      entries: [
        baseRow([
          ...categories.map((category) => ({ category })),
          ...baseTypes.map((baseType) => ({ baseType })),
        ]),
        {
          _id: 'bab-row',
          kind: 'manual',
          active: true,
          catalogEntryId: 'bab',
          state: { kind: 'manual' },
        },
        ...itemRows([...weapons, ...items]),
        ...routines,
      ],
      catalogEntries: [
        baseDefinition({ strength, dexterity }),
        {
          _id: 'bab',
          ruleIdentity: 'fixture-bab',
          modifiers: [{ target: 'bab', bonusType: 'untyped', value: bab }],
        },
        ...weapons.map((key) => itemDefinition(key, { weapon: true })),
        ...items.map((key) => itemDefinition(key)),
      ],
    };
  }
  return { sheetWeapon, rangedWeapon, itemDefinition, weaponSheet };
}

/**
 * The armor sheet of the armors-and-shields-424 batch adapter, over imported
 * entries: the item's armor block, Modifiers and Notes (its bash weapon left
 * out), worn, with the armor and shield Proficiency categories added by hand.
 */
export function armorSheet(
  entries: ReleasedEntries,
  {
    items,
    dexterity = 10,
    proficiencies = [],
  }: {
    items: readonly string[];
    dexterity?: number;
    proficiencies?: readonly (
      | 'light'
      | 'medium'
      | 'heavy'
      | 'shield'
      | 'towerShield'
    )[];
  },
): CharacterSheetInput {
  const definition = (key: string): CharacterSheetCatalogEntry => {
    const entry = imported(entries, key);
    const detail = entry.detail;
    if (detail.kind !== 'item' || !detail.armor)
      throw new Error(`${key} is not armor or a shield`);
    if (!armorCategory(detail.armor.category))
      throw new Error(`${key} has no known armor category`);
    return {
      _id: entry.externalKey,
      name: entry.name,
      ruleIdentity: entry.externalKey,
      stacksWithItself: false,
      ...sheetModifiers(entry),
      detail: {
        kind: 'item',
        consumable: detail.consumable,
        armor: { ...detail.armor, category: detail.armor.category as never },
      },
    };
  };
  return {
    characterKind: 'pc',
    entries: [
      baseRow(proficiencies.map((category) => ({ category }))),
      ...itemRows(items),
    ],
    catalogEntries: [baseDefinition({ dexterity }), ...items.map(definition)],
  };
}

/**
 * The item sheet of the items-430 and items-431 batch adapters, over
 * imported entries: each item's Modifiers, Notes and armor block (its splash
 * weapon block left out), active, with base scores 10 unless given and no
 * class levels.
 */
export function itemSheet(
  entries: ReleasedEntries,
  {
    items,
    scores = {},
  }: {
    items: readonly string[];
    scores?: Partial<Record<(typeof abilityKeys)[number], number>>;
  },
): CharacterSheetInput {
  const definition = (key: string): CharacterSheetCatalogEntry => {
    const entry = imported(entries, key);
    const detail = entry.detail;
    if (detail.kind !== 'item') throw new Error(`${key} is not an item`);
    return {
      _id: entry.externalKey,
      name: entry.name,
      ruleIdentity: entry.externalKey,
      stacksWithItself: false,
      ...sheetModifiers(entry),
      detail: {
        kind: 'item',
        consumable: detail.consumable,
        ...(detail.armor
          ? {
              armor: {
                ...detail.armor,
                category: detail.armor.category as never,
              },
            }
          : {}),
      },
    };
  };
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...itemRows(items),
    ],
    catalogEntries: [baseDefinition(scores), ...items.map(definition)],
  };
}

type Proficiency = Extract<
  SheetEntry,
  { kind: 'base' }
>['state']['proficiencies'];
function baseRow(
  added: NonNullable<Proficiency>['added'],
): Extract<SheetEntry, { kind: 'base' }> {
  return {
    _id: 'base-row',
    kind: 'base',
    active: true,
    catalogEntryId: 'base',
    state: { kind: 'base', proficiencies: { added, removed: [] } },
  };
}
function baseDefinition(
  scores: Partial<Record<(typeof abilityKeys)[number], number>>,
): CharacterSheetCatalogEntry {
  return {
    _id: 'base',
    ruleIdentity: 'fixture-base',
    modifiers: abilityKeys.map((ability) => ({
      target: abilityTargets[ability],
      bonusType: 'base',
      value: scores[ability] ?? 10,
    })),
  };
}
function itemRows(keys: readonly string[]): SheetEntry[] {
  return keys.map((key) => ({
    _id: `item:${key}`,
    kind: 'item',
    active: true,
    catalogEntryId: key,
    state: { kind: 'item' },
  }));
}

/** A shared Situation, or a local one bound to the sheet entry it belongs to. */
export type Situation = string | { local: string; sheetEntryId: string };

/**
 * Lookups within one gear key list, as the batch tests made them within
 * their preview: an entry by key or name (only among the list's keys), its
 * Modifiers as resolver rows, its Situations and one resolved statistic.
 * `distinct` drops repeated Situations, as some batch tests did.
 */
export function gearSelection(
  entries: ReleasedEntries,
  selection: GearSelection,
  { distinct }: { distinct: boolean },
) {
  const keys: readonly string[] = gearSelections[selection];
  const rows = keys.map((key) => {
    const row = entries.get(key);
    if (!row) throw new Error(`${key} was not imported`);
    return row;
  });
  function entry(name: string) {
    const matches = rows.filter(
      (row) => row.externalKey === name || row.name === name,
    );
    const [row] = matches;
    if (!row || matches.length > 1)
      throw new Error(`Expected one ${name} in ${selection}`);
    if (row.detail.kind !== 'item') throw new Error('Expected an item');
    return { ...row, detail: row.detail };
  }
  function modifiers(name: string) {
    const row = entry(name);
    return row.modifiers.map((raw) => ({
      ...outputSchema.options[0]
        .omit({ kind: true })
        .extend({ target: z.enum(modifierTargets) })
        .parse(raw),
      sheetEntryId: row.externalKey,
      catalogEntryId: row.externalKey,
      source: row.externalKey,
      entryName: row.name,
      builtIn: false,
    }));
  }
  const unique = <T>(list: T[]) =>
    distinct
      ? [...new Map(list.map((row) => [JSON.stringify(row), row])).values()]
      : list;
  /** The entry's shared and local Situations, bound to `sheetEntryId`. */
  function situations(name: string, sheetEntryId = entry(name).externalKey) {
    const out: Situation[] = [];
    for (const row of modifiers(name)) {
      const scope = row.condition?.situation;
      if (!scope) continue;
      if (typeof scope === 'string') out.push(scope);
      else if ('local' in scope) out.push({ local: scope.local, sheetEntryId });
      else throw new Error('Expected a shared or local Situation');
    }
    return unique(out);
  }
  /** The local Situation labels of the entry's Modifiers, in order. */
  function localSituations(name: string) {
    return unique(
      modifiers(name).flatMap((row) => {
        const scope = row.condition?.situation;
        if (!scope) return [];
        if (typeof scope === 'string' || !('local' in scope))
          throw new Error('Expected a local Situation');
        return [scope.local];
      }),
    );
  }
  /** The local Situation labels of the entry's Modifiers on one target. */
  function situationsOn(name: string, target: string) {
    return modifiers(name).flatMap((row) => {
      const scope = row.condition?.situation;
      return row.target === target && scope && typeof scope === 'object'
        ? 'local' in scope
          ? [scope.local]
          : []
        : [];
    });
  }
  /** One resolved statistic of the entry's Modifiers, its Situations selected or not. */
  function resolved(name: string, target: string, selected = false) {
    return resolveSheet(modifiers(name), {
      situations: selected ? situations(name) : [],
    })[target as 'cmb'].total;
  }
  /** One resolved statistic with the given local Situation labels selected. */
  function resolvedWith(name: string, target: string, labels: string[] = []) {
    return resolveSheet(modifiers(name), {
      situations: labels.map((local) => ({
        local,
        sheetEntryId: entry(name).externalKey,
      })),
    })[target as 'cmb'].total;
  }
  return {
    rows,
    entry,
    modifiers,
    situations,
    localSituations,
    situationsOn,
    resolved,
    resolvedWith,
  };
}
