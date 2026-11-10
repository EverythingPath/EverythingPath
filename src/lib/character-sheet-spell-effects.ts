import {
  UNARMED_STRIKE_ID,
  type ItemPart,
  type SpellEffectItemTarget,
} from './character-sheet-attack-types';
import type {
  CatalogModifier,
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
  ModifierTarget,
  SheetCatalogEntryDetail,
  SheetEntry,
  SheetWarning,
} from './character-sheet';
import {
  defaultCastingTables,
  findCastingTableRow,
  MAX_LEVEL,
  type ReviewedCastingTables,
} from './character-sheet-casting-tables';
import {
  itemPartLabel,
  listItemParts,
  partDamageTypes,
} from './character-sheet-items';
import { castableLevels } from './character-sheet-spellcasting';

type SpellEffectEntry = Extract<SheetEntry, { kind: 'spellEffect' }>;
type SpellEffectDetail = Extract<
  SheetCatalogEntryDetail,
  { kind: 'spellEffect' }
>;
type ModifierCondition = NonNullable<CatalogModifier['condition']>;
type SpellEffectTargetEnd = 'otherEnd' | 'bash';
type SpellEffectTargetKind =
  | 'weapon'
  | 'natural'
  | 'unarmed'
  | 'ammunition'
  | 'armor'
  | 'shield';
type SpellEffectTargetStatus =
  | 'missing'
  | 'available'
  | 'inactive'
  | 'unavailable';
type SpellEffectTargetOption = {
  entry: string;
  end: SpellEffectTargetEnd | null;
  name: string;
  kind: SpellEffectTargetKind;
  active: boolean;
  suitable: boolean;
};

function spellEffectDetail(
  definition: CharacterSheetCatalogEntry | undefined,
): SpellEffectDetail | undefined {
  return definition?.detail?.kind === 'spellEffect'
    ? definition.detail
    : undefined;
}

/** Where a default caster level comes from: "summoner 4 casts 2nd-level spells". */
type CasterLevelSource = {
  classTag: string;
  classLevel: number;
  spellLevel: number;
  casterLevel: number;
};

/** The lower caster level wins, then the earlier class level, then the tag. */
function compareCasterLevelSources(a: CasterLevelSource, b: CasterLevelSource) {
  return (
    a.casterLevel - b.casterLevel ||
    a.classLevel - b.classLevel ||
    (a.classTag < b.classTag ? -1 : a.classTag > b.classTag ? 1 : 0)
  );
}

/**
 * The lowest caster level at which any listed class casts the Spell: for each
 * class with reviewed casting, the caster level at its first class level whose
 * table has an entry at that spell level (CRB Chapter 3 spells per day; a
 * paladin's −3 offset puts its 1st-level spells at caster level 1).
 */
function lowestLegalCasterLevel(
  levels: Readonly<Record<string, number>>,
  castingTables: ReviewedCastingTables = defaultCastingTables,
) {
  let lowest: CasterLevelSource | null = null;
  for (const [classTag, casting] of Object.entries(castingTables.classes)) {
    const spellLevel = levels[classTag];
    if (spellLevel === undefined) continue;
    for (let classLevel = 1; classLevel <= MAX_LEVEL; classLevel++) {
      const row = findCastingTableRow(casting.table, classLevel, castingTables);
      if (!castableLevels(casting, row, castingTables).includes(spellLevel))
        continue;
      const candidate = {
        classTag,
        classLevel,
        spellLevel,
        casterLevel: Math.max(1, classLevel + casting.casterLevelOffset),
      };
      if (!lowest || compareCasterLevelSources(candidate, lowest) < 0)
        lowest = candidate;
      break;
    }
  }
  return lowest;
}

/** What the default caster level reads of a Spell Effect's definition. */
type DefaultCasterLevelDetail = Pick<
  SpellEffectDetail,
  'spellKey' | 'defaultCasterLevel'
>;

/** The Spell a Spell Effect names by rule identity, when the sheet has it. */
function findSpellEffectSpell(
  spellKey: string | undefined,
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  if (!spellKey) return undefined;
  return catalogEntries.find(
    (row) => row.ruleIdentity === spellKey && row.detail?.kind === 'spell',
  );
}

function defaultCasterLevelSource(
  spellKey: string | undefined,
  catalogEntries: readonly CharacterSheetCatalogEntry[],
  castingTables?: ReviewedCastingTables,
) {
  const spell = findSpellEffectSpell(spellKey, catalogEntries);
  const levels = spell?.detail?.kind === 'spell' ? spell.detail.levels : null;
  return levels ? lowestLegalCasterLevel(levels, castingTables) : null;
}

/**
 * #236 "Spell Effects": the caster level a new Spell Effect records and a
 * cleared one restores. It reads only the Spell's class lists, never another
 * caster's sheet; an unlinked effect uses its defined default.
 */
export function spellEffectDefaultCasterLevel(
  detail: DefaultCasterLevelDetail,
  catalogEntries: readonly CharacterSheetCatalogEntry[],
  castingTables?: ReviewedCastingTables,
) {
  return defaultCasterLevel(
    detail,
    defaultCasterLevelSource(detail.spellKey, catalogEntries, castingTables),
  );
}

function defaultCasterLevel(
  detail: DefaultCasterLevelDetail,
  source: CasterLevelSource | null,
) {
  return source?.casterLevel ?? detail.defaultCasterLevel ?? 1;
}

/**
 * One day or less is a Temporary Effect; longer spells are permanent. A
 * Spell Effect without its definition counts as temporary.
 */
export function spellEffectDuration(
  detail: Pick<SpellEffectDetail, 'lastsOverOneDay'> | undefined,
) {
  return detail?.lastsOverOneDay === true
    ? ('permanent' as const)
    : ('temporary' as const);
}

function isAcTarget(target: string | undefined) {
  return target === 'ac' || (target?.startsWith('ac.') ?? false);
}

function usesTarget(condition: ModifierCondition | undefined) {
  return condition?.weapon === '$target';
}

/**
 * What a Spell Effect must target, or null when it targets no item: its
 * recorded `itemTarget`, else armor or a shield for an AC `$target`
 * Modifier, else a weapon for any other `$target` use or keen edge's
 * threat doubling.
 */
function spellEffectItemTarget(
  definition: CharacterSheetCatalogEntry | undefined,
): SpellEffectItemTarget | null {
  const detail = spellEffectDetail(definition);
  if (!definition || !detail) return null;
  if (detail.itemTarget) return detail.itemTarget;
  if (
    definition.modifiers.some(
      (modifier) =>
        usesTarget(modifier.condition) && isAcTarget(modifier.target),
    )
  )
    return 'armorOrShield';
  const targeted =
    detail.doublesThreat === true ||
    definition.modifiers.some((modifier) => usesTarget(modifier.condition)) ||
    (definition.situationalNotes ?? []).some((note) =>
      usesTarget(note.condition),
    );
  return targeted ? 'weapon' : null;
}

/**
 * What a Spell Effect may target: the kind of item part and, for keen edge's
 * threat doubling, a piercing or slashing weapon (CRB p. 302, like keen).
 */
type SpellEffectTargetRequirement = {
  itemTarget: SpellEffectItemTarget;
  damageTypes: readonly string[] | null;
};

const threatDoublingDamageTypes = ['piercing', 'slashing'] as const;

function spellEffectTargetRequirement(
  definition: CharacterSheetCatalogEntry | undefined,
): SpellEffectTargetRequirement | null {
  const itemTarget = spellEffectItemTarget(definition);
  if (!itemTarget) return null;
  return {
    itemTarget,
    damageTypes: spellEffectDetail(definition)?.doublesThreat
      ? threatDoublingDamageTypes
      : null,
  };
}

// CRB Table 6–4: an unarmed strike deals bludgeoning damage.
const unarmedDamageTypes = ['bludgeoning'] as const;

/** A part with no recorded damage type suits any damage requirement. */
function suitsDamage(
  requirement: SpellEffectTargetRequirement,
  damageTypes: readonly string[],
) {
  return (
    !requirement.damageTypes ||
    damageTypes.length === 0 ||
    damageTypes.some((type) => requirement.damageTypes?.includes(type))
  );
}

const suitableKinds: Record<
  SpellEffectItemTarget,
  readonly SpellEffectTargetKind[]
> = {
  weapon: ['weapon', 'ammunition', 'unarmed'],
  natural: ['natural', 'unarmed'],
  armorOrShield: ['armor', 'shield'],
};

function optionKind(
  detail: Extract<SheetCatalogEntryDetail, { kind: 'item' }>,
  part: ItemPart,
): SpellEffectTargetKind | null {
  if (part === 'primary' && detail.armor) return detail.armor.slot;
  if (detail.weapon?.naturalAttack) return 'natural';
  if (detail.weapon) return 'weapon';
  return detail.ammunition ? 'ammunition' : null;
}

function suitsKind(
  requirement: SpellEffectTargetRequirement,
  kind: SpellEffectTargetKind,
) {
  return suitableKinds[requirement.itemTarget].includes(kind);
}

/** Every item part and the unarmed strike a Spell Effect could target. */
function listSpellEffectTargetOptions(
  input: CharacterSheetInput,
  requirement: SpellEffectTargetRequirement | null,
): SpellEffectTargetOption[] {
  const suits = (kind: SpellEffectTargetKind, damageTypes: readonly string[]) =>
    requirement === null ||
    (suitsKind(requirement, kind) && suitsDamage(requirement, damageTypes));
  const items = input.entries.flatMap((entry) => {
    if (entry.kind !== 'item') return [];
    const definition = input.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    const detail =
      definition?.detail?.kind === 'item' ? definition.detail : undefined;
    if (!detail) return [];
    const name = definition?.name ?? 'Item';
    return listItemParts(detail).flatMap((part) => {
      const kind = optionKind(detail, part);
      if (!kind) return [];
      return [
        {
          entry: entry._id,
          end: part === 'primary' ? null : part,
          name: itemPartLabel(name, part),
          kind,
          active: entry.active,
          suitable: suits(kind, partDamageTypes(detail, part)),
        },
      ];
    });
  });
  return [
    ...items,
    {
      entry: UNARMED_STRIKE_ID,
      end: null,
      name: 'Unarmed strike',
      kind: 'unarmed',
      active: true,
      suitable: suits('unarmed', unarmedDamageTypes),
    },
  ];
}

type TargetResolution = {
  status: SpellEffectTargetStatus;
  option: SpellEffectTargetOption | null;
};

function resolveTarget(
  onItem: SpellEffectEntry['state']['onItem'],
  options: readonly SpellEffectTargetOption[],
): TargetResolution {
  if (!onItem) return { status: 'missing', option: null };
  const option = options.find(
    (candidate) =>
      candidate.entry === onItem.entry &&
      candidate.end === (onItem.end ?? null),
  );
  if (!option) return { status: 'unavailable', option: null };
  return { status: option.active ? 'available' : 'inactive', option };
}

/** Where a Spell Effect's `$target` Modifiers and notes land. */
type SpellEffectBinding = {
  entry: string;
  part: ItemPart;
  /** The targeted armor or shield, whose AC leaf takes AC Modifiers. */
  armorSlot: 'armor' | 'shield' | null;
};

/** Finds each Spell Effect sheet entry's binding (see `spellEffectBindings`). */
export type SpellEffectBindingLookup = (
  entry: SheetEntry,
) => SpellEffectBinding | null;

/**
 * The binding of each Spell Effect sheet entry in one calculation input,
 * listing its target options once; null when an entry's target is missing,
 * gone or not equipped: `$target` Modifiers then contribute nothing.
 */
export function spellEffectBindings(
  input: CharacterSheetInput,
): SpellEffectBindingLookup {
  const options = listSpellEffectTargetOptions(input, null);
  return (entry) => {
    if (entry.kind !== 'spellEffect' || !entry.state.onItem) return null;
    const { status, option } = resolveTarget(entry.state.onItem, options);
    if (status !== 'available' || !option) return null;
    return {
      entry: option.entry,
      part: option.end ?? 'primary',
      armorSlot:
        option.kind === 'armor' || option.kind === 'shield'
          ? option.kind
          : null,
    };
  };
}

/**
 * A Modifier or note bound to worn armor or a shield: its AC target becomes
 * that item's own leaf and its weapon condition is gone, with the condition
 * itself when nothing else remains.
 */
type ArmorBound<Value> = Omit<Value, 'target' | 'condition'> & {
  target: `ac.${'armor' | 'shield'}`;
  armorItem?: { entryId: string; component: 'enhancement' };
  condition?: Omit<ModifierCondition, 'weapon' | 'weaponSelection'>;
};

/** A Modifier or note bound to a weapon part: it applies on that part's lines. */
type WeaponBound<Value> = Value & { itemPart?: ItemPart };

/**
 * #236 "Spells on an item": a `$target` Modifier or note applies to its
 * target's attacks; on an AC target it lands on the targeted armor's or
 * shield's own leaf. Unbound, it keeps its weapon condition with no target
 * and contributes nothing.
 */
export function bindSpellEffectTarget<
  Value extends { target?: string; condition?: ModifierCondition },
>(
  value: Value,
  binding: SpellEffectBinding | null,
): WeaponBound<Value> | ArmorBound<Value> {
  const condition = value.condition;
  if (!binding || !condition || !usesTarget(condition)) return value;
  if (isAcTarget(value.target)) {
    if (!binding.armorSlot || binding.part !== 'primary') return value;
    const { weapon: _weapon, weaponSelection: _selection, ...rest } = condition;
    const { condition: _condition, target: _target, ...fields } = value;
    const bound: ArmorBound<Value> = {
      ...fields,
      ...('bonusType' in value && value.bonusType === 'enhancement'
        ? {
            armorItem: {
              entryId: binding.entry,
              component: 'enhancement' as const,
            },
          }
        : {}),
      target: `ac.${binding.armorSlot}` satisfies ModifierTarget,
      ...(Object.keys(rest).length ? { condition: rest } : {}),
    };
    return bound;
  }
  return {
    ...value,
    condition: { ...condition, weaponSelection: binding.entry },
    itemPart: binding.part,
  };
}

/** Keen edge doubles its target's threat range, on its lines only. */
export function spellEffectThreatDoublers(
  input: CharacterSheetInput,
  weapon: { entryId: string; part: ItemPart; ammunitionEntryId?: string },
  { permanentOnly = false }: { permanentOnly?: boolean } = {},
) {
  const doublers = spellEffectRows(input).filter(
    ({ entry, detail }) =>
      entry.active &&
      detail.doublesThreat &&
      !(permanentOnly && spellEffectDuration(detail) === 'temporary'),
  );
  if (!doublers.length) return [];
  const bindingFor = spellEffectBindings(input);
  return doublers.flatMap(({ entry, definition }) => {
    const binding = bindingFor(entry);
    const matches =
      binding !== null &&
      ((binding.entry === weapon.entryId && binding.part === weapon.part) ||
        (weapon.ammunitionEntryId !== undefined &&
          binding.entry === weapon.ammunitionEntryId));
    return matches
      ? [{ sheetEntryId: entry._id, name: definition.name ?? 'Spell Effect' }]
      : [];
  });
}

function spellEffectRows(input: CharacterSheetInput) {
  return input.entries.flatMap((entry) => {
    if (entry.kind !== 'spellEffect') return [];
    const definition = input.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    const detail = spellEffectDetail(definition);
    return definition && detail ? [{ entry, definition, detail }] : [];
  });
}

/**
 * The highest enhancement active Spell Effects give each targeted item part,
 * for its +10 bonus-equivalent check (CRB p. 469 counts spells). A target
 * counts whether or not the item is equipped, like the item's own state.
 */
export function spellEffectTargetedEnhancements(
  input: CharacterSheetInput,
  evaluate: (
    modifier: CatalogModifier,
    entry: SpellEffectEntry,
    definition: CharacterSheetCatalogEntry,
  ) => number | null,
) {
  const highest = new Map<string, number>();
  const options = listSpellEffectTargetOptions(input, null);
  for (const { entry, definition } of spellEffectRows(input)) {
    if (!entry.active || !entry.state.onItem) continue;
    const { option } = resolveTarget(entry.state.onItem, options);
    if (!option) continue;
    const key = `${option.entry}:${option.end ?? 'primary'}`;
    for (const modifier of definition.modifiers) {
      if (
        modifier.bonusType !== 'enhancement' ||
        !usesTarget(modifier.condition)
      )
        continue;
      const value = evaluate(modifier, entry, definition);
      if (value !== null && value > (highest.get(key) ?? 0))
        highest.set(key, value);
    }
  }
  return (entryId: string, part: ItemPart) =>
    highest.get(`${entryId}:${part}`) ?? 0;
}

/**
 * Advisories from state, active or not: a target that is no longer on the
 * sheet, and one the effect can't normally target. A missing target is a
 * missing choice, not a warning.
 */
export function spellEffectWarnings(
  input: CharacterSheetInput,
): SheetWarning[] {
  return spellEffectRows(input).flatMap(
    ({ entry, definition }): SheetWarning[] => {
      const requirement = spellEffectTargetRequirement(definition);
      const onItem = entry.state.onItem;
      if (!requirement || !onItem) return [];
      const { itemTarget } = requirement;
      const name = definition.name ?? 'Spell Effect';
      const { status, option } = resolveTarget(
        onItem,
        listSpellEffectTargetOptions(input, requirement),
      );
      const warning = {
        subject: entry._id,
        target: { kind: 'entry' as const, entryId: entry._id },
      };
      if (status === 'unavailable')
        return [
          {
            ...warning,
            kind: 'rules',
            check: 'spellEffectTargetUnavailable',
            fingerprint: JSON.stringify([onItem.entry, onItem.end ?? null]),
            message: `${name}'s target is no longer on the sheet. Choose another target; until then it adds nothing.`,
          },
        ];
      if (option && !option.suitable && suitsKind(requirement, option.kind))
        return [
          {
            ...warning,
            kind: 'rules',
            check: 'spellEffectTargetUnsuitable',
            fingerprint: JSON.stringify([
              itemTarget,
              option.kind,
              requirement.damageTypes,
            ]),
            message: `${name} can be cast only on piercing or slashing weapons, not on ${option.name}.`,
          },
        ];
      if (option && !option.suitable)
        return [
          {
            ...warning,
            kind: 'rules',
            check: 'spellEffectTargetUnsuitable',
            fingerprint: JSON.stringify([itemTarget, option.kind]),
            message: `${name} normally can't target ${option.name}.`,
          },
        ];
      return [];
    },
  );
}

/**
 * Each Spell Effect on the sheet: its recorded and default caster levels,
 * linked Spell, duration class and, for one that enhances an item, its
 * target, the target's state and the parts it could target.
 */
export function resolveSpellEffects(input: CharacterSheetInput) {
  return spellEffectRows(input).map(({ entry, definition, detail }) => {
    const spell = findSpellEffectSpell(detail.spellKey, input.catalogEntries);
    const source = defaultCasterLevelSource(
      detail.spellKey,
      input.catalogEntries,
      input.resources?.castingTables,
    );
    const requirement = spellEffectTargetRequirement(definition);
    const itemTarget = requirement?.itemTarget ?? null;
    const options = requirement
      ? listSpellEffectTargetOptions(input, requirement)
      : [];
    const onItem = entry.state.onItem;
    const { status, option } = resolveTarget(onItem, options);
    return {
      entryId: entry._id,
      name: definition.name ?? 'Spell Effect',
      active: entry.active,
      casterLevel: entry.state.casterLevel,
      defaultCasterLevel: defaultCasterLevel(detail, source),
      defaultSource: source
        ? {
            classTag: source.classTag,
            classLevel: source.classLevel,
            spellLevel: source.spellLevel,
          }
        : null,
      spell: spell
        ? { name: spell.name ?? 'Spell', ruleIdentity: spell.ruleIdentity }
        : null,
      duration: spellEffectDuration(detail),
      target: itemTarget
        ? {
            itemTarget,
            onItem: onItem
              ? { entry: onItem.entry, end: onItem.end ?? null }
              : null,
            status,
            name: option?.name ?? null,
            suitable: option?.suitable ?? true,
            options,
          }
        : null,
    };
  });
}
