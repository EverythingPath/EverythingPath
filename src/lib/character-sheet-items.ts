import {
  CHOSEN_FOE_SITUATION,
  type ItemAbilityTarget,
  type ItemPart,
} from './character-sheet-attack-types';
import type {
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
  InputSourcedModifier,
  ItemAbilityDetail,
  ItemMagic,
  ItemPartState,
  SheetCatalogEntryDetail,
  SheetEntry,
  SheetWarning,
  Situation,
  SourcedSituationalNote,
} from './character-sheet';
import {
  situationMatches,
  type RequestedSituation,
} from './character-sheet-situations';

type ItemDetail = Extract<SheetCatalogEntryDetail, { kind: 'item' }>;
/**
 * Resolver only, never persisted: armor numbers taken from the Base Item
 * don't include the specific item's own material.
 */
type ResolvedItemDetail = ItemDetail & { armorFromBaseItem?: true };
type ItemEntry = Extract<SheetEntry, { kind: 'item' }>;
type ItemState = ItemEntry['state'];
type CatalogLookup = ReadonlyMap<string, CharacterSheetCatalogEntry>;

/** What an item part accepts: a thrown weapon takes melee and ranged abilities. */
export type ItemPartKind = 'melee' | 'ranged' | 'thrown' | 'armor' | 'shield';

function itemDetailOf(
  definition: CharacterSheetCatalogEntry | undefined,
): ResolvedItemDetail | undefined {
  return definition?.detail?.kind === 'item' ? definition.detail : undefined;
}

function hasStatistics(detail: ItemDetail | undefined) {
  return Boolean(detail?.weapon ?? detail?.armor ?? detail?.ammunition);
}

/**
 * #236 "Specific magic items": a specific item's weapon statistics, its
 * proficiency included, always come from its Base Item; its armor comes from
 * its own numbers, else from the Base Item, and a shield without a category
 * takes the Base Item's. The resolver marks armor taken from the Base Item,
 * whose numbers don't include the specific item's material.
 */
function resolveSpecificItem<Entry extends CharacterSheetCatalogEntry>(
  definition: Entry,
  byId: CatalogLookup,
  visiting: ReadonlySet<string> = new Set(),
): Entry {
  const detail = itemDetailOf(definition);
  if (!detail?.baseItem) return definition;
  const baseDefinition = visiting.has(detail.baseItem)
    ? undefined
    : byId.get(detail.baseItem);
  const base = baseDefinition
    ? itemDetailOf(
        resolveSpecificItem(
          baseDefinition,
          byId,
          new Set([...visiting, definition._id]),
        ),
      )
    : undefined;
  const { weapon: _placeholder, armor: ownArmor, ...rest } = detail;
  const armor = ownArmor
    ? {
        ...ownArmor,
        ...(ownArmor.category === undefined && base?.armor?.category
          ? { category: base.armor.category }
          : {}),
      }
    : base?.armor;
  const resolved: ResolvedItemDetail = {
    ...rest,
    ...(base?.weapon ? { weapon: base.weapon } : {}),
    ...(armor ? { armor } : {}),
    ...(!ownArmor && base?.armor ? { armorFromBaseItem: true as const } : {}),
    ...(detail.ammunition === undefined && base?.ammunition !== undefined
      ? { ammunition: base.ammunition }
      : {}),
  };
  return { ...definition, detail: resolved };
}

// Each catalog is looked up by ID once, however many items, parts and attack
// lines read it during one calculation.
const lookups = new WeakMap<
  readonly CharacterSheetCatalogEntry[],
  CatalogLookup
>();
function catalogLookup(
  catalogEntries: readonly CharacterSheetCatalogEntry[],
): CatalogLookup {
  const cached = lookups.get(catalogEntries);
  if (cached) return cached;
  const byId = new Map(catalogEntries.map((row) => [row._id, row]));
  lookups.set(catalogEntries, byId);
  return byId;
}

/**
 * Definitions by ID as the calculator sees them, each specific item resolved
 * through its Base Item, for views reading many items of one catalog.
 */
export function createItemDefinitionLookup<
  Entry extends CharacterSheetCatalogEntry,
>(catalogEntries: readonly Entry[]) {
  const byId = new Map(catalogEntries.map((row) => [row._id, row]));
  return (catalogEntryId: string) => {
    const definition = byId.get(catalogEntryId);
    return definition ? resolveSpecificItem(definition, byId) : undefined;
  };
}

/** One definition resolved through its Base Item, for writers. */
export function resolveItemDefinition<Entry extends CharacterSheetCatalogEntry>(
  definition: Entry,
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  return resolveSpecificItem(definition, catalogLookup(catalogEntries));
}

/** Resolve every specific item through its Base Item, once per calculation. */
export function resolveItemDefinitions<Input extends CharacterSheetInput>(
  input: Input,
): Input {
  if (!input.catalogEntries.some((row) => itemDetailOf(row)?.baseItem))
    return input;
  const byId = catalogLookup(input.catalogEntries);
  return {
    ...input,
    catalogEntries: input.catalogEntries.map((row) =>
      resolveSpecificItem(row, byId),
    ),
  };
}

/** The sheet entry state a newly added item starts with: its magic defaults. */
export function createItemState<Magic extends ItemMagic = never>(
  magic?: Magic,
) {
  return magic
    ? { ...structuredClone(magic), kind: 'item' as const }
    : { kind: 'item' as const };
}

/** The parts of an item with their own state, primary first. */
export function listItemParts(detail: ItemDetail | undefined): ItemPart[] {
  if (!detail) return [];
  if (detail.armor)
    return detail.armor.slot === 'shield' && detail.weapon
      ? ['primary', 'bash']
      : ['primary'];
  if (detail.weapon)
    return detail.weapon.otherEnd ? ['primary', 'otherEnd'] : ['primary'];
  return detail.ammunition ? ['primary'] : [];
}

export function itemPartState(state: ItemState, part: ItemPart) {
  if (part === 'primary') {
    const { kind: _kind, otherEnd: _otherEnd, bash: _bash, ...own } = state;
    return own satisfies ItemPartState;
  }
  return state[part] ?? {};
}

export function itemPartSubject(entryId: string, part: ItemPart) {
  return part === 'primary' ? entryId : `${entryId}:${part}`;
}

export function itemPartKind(detail: ItemDetail, part: ItemPart): ItemPartKind {
  if (part !== 'primary') return 'melee';
  if (detail.armor) return detail.armor.slot;
  const weapon = detail.weapon;
  if (!weapon) return 'ranged';
  if (weapon.attackType === 'ranged') return 'ranged';
  return weapon.thrown ? 'thrown' : 'melee';
}

const acceptedKinds: Record<ItemAbilityTarget, readonly ItemPartKind[]> = {
  melee: ['melee', 'thrown'],
  ranged: ['ranged', 'thrown'],
  weapon: ['melee', 'ranged', 'thrown'],
  armor: ['armor'],
  shield: ['shield'],
  armorOrShield: ['armor', 'shield'],
};

/** Whether an Item Ability placed on `appliesTo` suits a part of this kind. */
export function itemAbilitySuits(
  appliesTo: ItemAbilityTarget,
  kind: ItemPartKind,
) {
  return acceptedKinds[appliesTo].includes(kind);
}

// CRB pp. 154–155 and #236's special materials table.
const masterworkMaterials = new Set([
  'mithral',
  'darkwood',
  'adamantine',
  'dragonhide',
]);

/** "Alchemical silver", "alchemicalSilver" and "alchemical-silver" match. */
export function normalizeMaterial(value: string | null | undefined) {
  const key = value?.toLowerCase().replace(/[^a-z]/g, '');
  return key === undefined || key === '' ? null : key;
}

/**
 * The material in effect on one part. A specific item's own material is
 * display only when its numbers already include it; otherwise only state
 * sets one, and a double weapon's other end and a bash keep their own.
 */
function partMaterial(
  detail: ResolvedItemDetail,
  state: ItemState,
  part: ItemPart,
) {
  const own = itemPartState(state, part).material ?? null;
  if (part !== 'primary') return { material: own, numbersInclude: false };
  if (detail.material)
    return {
      material: detail.material,
      numbersInclude: Boolean(detail.armor) && !detail.armorFromBaseItem,
    };
  return { material: own, numbersInclude: false };
}

/** Armor and shields: CRB pp. 151, 154–155. Mithral's −3 replaces masterwork's −1. */
export function armorMaterialAdjustments(
  detail: ResolvedItemDetail,
  state: ItemState,
) {
  const { material, numbersInclude } = partMaterial(detail, state, 'primary');
  const key = normalizeMaterial(material);
  const masterwork =
    state.masterwork === true ||
    (state.enhancement ?? 0) >= 1 ||
    masterworkMaterials.has(key ?? '');
  if (numbersInclude)
    return {
      masterwork,
      penaltyReduction:
        masterwork && !masterworkMaterials.has(key ?? '') ? 1 : 0,
      maxDexterityIncrease: 0,
      spellFailureReduction: 0,
      note: null,
    };
  let penaltyReduction = masterwork ? 1 : 0;
  if (key === 'mithral') penaltyReduction = 3;
  else if (key === 'darkwood' && detail.armor?.slot === 'shield')
    penaltyReduction = 2;
  const reduction = adamantineReduction(detail);
  return {
    masterwork,
    penaltyReduction,
    maxDexterityIncrease: key === 'mithral' ? 2 : 0,
    spellFailureReduction: key === 'mithral' ? 10 : 0,
    note:
      key === 'adamantine' && reduction
        ? `Adamantine: damage reduction ${reduction}/—.`
        : null,
  };
}

/** CRB p. 154: adamantine armor grants DR 1/2/3 by category, as a note. */
function adamantineReduction(detail: ItemDetail) {
  switch (detail.armor?.category) {
    case 'light':
    case 'lightArmor':
      return 1;
    case 'medium':
    case 'mediumArmor':
      return 2;
    case 'heavy':
    case 'heavyArmor':
      return 3;
    default:
      return null;
  }
}

export type ResolvedItemAbility = {
  catalogEntryId: string;
  name: string;
  ruleIdentity: string | null;
  /** Null when the definition is gone or is no Item Ability. */
  detail: ItemAbilityDetail | null;
  modifiers: CharacterSheetCatalogEntry['modifiers'];
  situationalNotes: NonNullable<CharacterSheetCatalogEntry['situationalNotes']>;
  sourceKey: string | null;
  bonusEquivalent: number;
  choice: string | null;
  /** A required choice (bane's foe) is empty: the ability contributes nothing. */
  choiceMissing: boolean;
  /** The chosen foe's shared Situation key. */
  foeSituation: string | null;
};

export type ResolvedItemPart = {
  part: ItemPart;
  kind: ItemPartKind;
  enhancement: number;
  recordedMasterwork: boolean;
  /** Masterwork by flag, enhancement or a masterwork material. */
  masterwork: boolean;
  material: string | null;
  bonusEquivalent: number;
  abilities: ResolvedItemAbility[];
};

/** Bane's chosen foe is a shared Situation: two banes against undead share it. */
export function foeSituationKey(choice: string) {
  return choice.trim().toLowerCase();
}

function resolveItemAbility(
  ref: NonNullable<ItemPartState['abilities']>[number],
  byId: CatalogLookup,
): ResolvedItemAbility {
  const definition = byId.get(ref.catalogEntryId);
  const detail =
    definition?.detail?.kind === 'itemAbility' ? definition.detail : null;
  const choice = ref.choice?.trim() ? ref.choice.trim() : null;
  return {
    catalogEntryId: ref.catalogEntryId,
    name: definition?.name ?? 'Unavailable Item Ability',
    ruleIdentity: definition?.ruleIdentity ?? null,
    detail,
    modifiers: detail ? (definition?.modifiers ?? []) : [],
    situationalNotes: detail ? (definition?.situationalNotes ?? []) : [],
    sourceKey: definition?.sourceKey ?? definition?.ruleIdentity ?? null,
    bonusEquivalent: detail?.bonusEquivalent ?? 0,
    choice,
    choiceMissing: Boolean(detail?.choice) && choice === null,
    foeSituation: detail?.choice && choice ? foeSituationKey(choice) : null,
  };
}

export function resolveItemPart({
  state,
  detail,
  part,
  byId,
}: {
  state: ItemState;
  detail: ResolvedItemDetail;
  part: ItemPart;
  byId: CatalogLookup;
}): ResolvedItemPart {
  const own = itemPartState(state, part);
  const enhancement = own.enhancement ?? 0;
  const { material } = partMaterial(detail, state, part);
  const abilities = (own.abilities ?? []).map((ref) =>
    resolveItemAbility(ref, byId),
  );
  return {
    part,
    kind: itemPartKind(detail, part),
    enhancement,
    recordedMasterwork: own.masterwork === true,
    masterwork:
      own.masterwork === true ||
      enhancement >= 1 ||
      masterworkMaterials.has(normalizeMaterial(material) ?? ''),
    material,
    // A malformed enhancement is the equipment's unresolved warning, not +10's.
    bonusEquivalent:
      (Number.isSafeInteger(enhancement) ? Math.max(0, enhancement) : 0) +
      abilities.reduce((sum, ability) => sum + ability.bonusEquivalent, 0),
    abilities,
  };
}

function itemRows(input: CharacterSheetInput, byId: CatalogLookup) {
  return input.entries.flatMap((entry) => {
    if (entry.kind !== 'item') return [];
    const definition = byId.get(entry.catalogEntryId);
    const detail = itemDetailOf(definition);
    if (!definition || !detail) return [];
    return [{ entry, definition, detail }];
  });
}

/**
 * Each item's parts, equipped or not, for the item editor: its Base Item,
 * its own material and whether its numbers already include that material.
 */
export function resolveItemParts(input: CharacterSheetInput) {
  const byId = catalogLookup(input.catalogEntries);
  return itemRows(input, byId).flatMap(({ entry, definition, detail }) => {
    const parts = listItemParts(detail);
    if (!parts.length && !detail.baseItem) return [];
    return [
      {
        entryId: entry._id,
        name: definition.name ?? 'Item',
        active: entry.active,
        baseItemId: detail.baseItem ?? null,
        bakedMaterial: detail.material
          ? {
              name: detail.material,
              includedInNumbers: partMaterial(detail, entry.state, 'primary')
                .numbersInclude,
            }
          : null,
        parts: parts.map((part) => {
          const resolved = resolveItemPart({
            state: entry.state,
            detail,
            part,
            byId,
          });
          return {
            ...resolved,
            abilities: resolved.abilities.map(
              ({
                catalogEntryId,
                name,
                bonusEquivalent,
                choice,
                choiceMissing,
                detail: abilityDetail,
              }) => ({
                catalogEntryId,
                name,
                bonusEquivalent,
                choice,
                choiceMissing,
                available: abilityDetail !== null,
                appliesTo: abilityDetail?.appliesTo ?? null,
                requiresChoice: abilityDetail?.choice ?? null,
              }),
            ),
          };
        }),
      },
    ];
  });
}

function contributingAbilities(part: ResolvedItemPart) {
  return part.abilities.filter(
    (ability) => ability.detail && !ability.choiceMissing,
  );
}

function rewriteFoeSituation<Value extends { situation?: unknown }>(
  value: Value,
  foe: string | null,
): Value {
  return value.situation === CHOSEN_FOE_SITUATION && foe
    ? { ...value, situation: foe }
    : value;
}

/** A part's enhancement bonus; a malformed or negative one is none. */
function partEnhancementBonus(part: ResolvedItemPart) {
  return Number.isSafeInteger(part.enhancement)
    ? Math.max(0, part.enhancement)
    : 0;
}

/** Bashing (#764): the shield "acts as a +1 weapon when used to bash". */
export const BASHING_SOURCE = 'bashing';

/**
 * The part an ability's Modifiers bind to: its own, except that Bashing on a
 * shield binds to the bash, the shield's only attacking part.
 */
function bindingPart(ability: ResolvedItemAbility, part: ItemPart): ItemPart {
  return ability.sourceKey === BASHING_SOURCE && part === 'primary'
    ? 'bash'
    : part;
}

/**
 * #236 "Item Abilities": an ability's Modifiers bind to the item listing it,
 * and weapon-scoped ones to that part's own attacks.
 */
export function itemAbilityModifiers(
  input: CharacterSheetInput,
  entry: ItemEntry,
  /** The targeted enhancement Modifiers bound to one of the item's parts. */
  partEffects: (
    entryId: string,
    part: ItemPart,
  ) => readonly InputSourcedModifier[] = () => [],
): InputSourcedModifier[] {
  const byId = catalogLookup(input.catalogEntries);
  const detail = itemDetailOf(byId.get(entry.catalogEntryId));
  if (!detail) return [];
  return listItemParts(detail).flatMap((part) => {
    const resolvedPart = resolveItemPart({
      state: entry.state,
      detail,
      part,
      byId,
    });
    return contributingAbilities(resolvedPart).flatMap((ability) =>
      ability.modifiers.flatMap((modifier, modifierIndex) => {
        if (modifier.target === 'ability.$choice') return [];
        return [
          {
            ...modifier,
            target: modifier.target,
            ...(modifier.condition
              ? {
                  condition: rewriteFoeSituation(
                    modifier.condition,
                    ability.foeSituation,
                  ),
                }
              : {}),
            modifierIndex,
            itemPart: bindingPart(ability, part),
            itemEnhancement: {
              own: partEnhancementBonus(resolvedPart),
              effects: partEffects(entry._id, part),
              weapon: {
                entryId: entry._id,
                baseType: detail.weapon?.baseType ?? '',
                groups: detail.weapon?.groups,
                kind: 'manufactured',
                part,
              },
            },
            sheetEntryId: entry._id,
            catalogEntryId: ability.catalogEntryId,
            entryName: ability.name,
            source: ability.sourceKey ?? ability.catalogEntryId,
            builtIn: false,
          } satisfies InputSourcedModifier,
        ];
      }),
    );
  });
}

/**
 * The first contributing Item Ability with this Source on the item's listed
 * parts while the item is active: Speed's `haste` on the attacking part, or
 * Bashing on a shield or its bash.
 */
export function findItemAbilitySource(
  input: CharacterSheetInput,
  entry: SheetEntry,
  parts: readonly ItemPart[],
  sourceKey: string,
): { sheetEntryId: string; name: string } | undefined {
  if (entry.kind !== 'item' || !entry.active) return undefined;
  const byId = catalogLookup(input.catalogEntries);
  const detail = itemDetailOf(byId.get(entry.catalogEntryId));
  if (!detail) return undefined;
  for (const part of listItemParts(detail)) {
    if (!parts.includes(part)) continue;
    const ability = contributingAbilities(
      resolveItemPart({ state: entry.state, detail, part, byId }),
    ).find((candidate) => candidate.sourceKey === sourceKey);
    if (ability) return { sheetEntryId: entry._id, name: ability.name };
  }
  return undefined;
}

/** Fortification, defending and the like are notes on their ability. */
export function itemAbilityNotes(
  input: CharacterSheetInput,
  entry: ItemEntry,
): SourcedSituationalNote[] {
  const byId = catalogLookup(input.catalogEntries);
  const detail = itemDetailOf(byId.get(entry.catalogEntryId));
  if (!detail) return [];
  return listItemParts(detail).flatMap((part) =>
    contributingAbilities(
      resolveItemPart({ state: entry.state, detail, part, byId }),
    ).flatMap((ability) =>
      ability.situationalNotes.flatMap((note, noteIndex) =>
        note.target === 'ability.$choice'
          ? []
          : [
              {
                ...rewriteFoeSituation(note, ability.foeSituation),
                target: note.target,
                noteIndex,
                sheetEntryId: entry._id,
                catalogEntryId: ability.catalogEntryId,
                entryName: ability.name,
                source: ability.sourceKey ?? ability.catalogEntryId,
                builtIn: false,
              },
            ],
      ),
    ),
  );
}

export type ExtraDamagePart = {
  dice: string;
  damageType: string | null;
  /** `crit`: only on a confirmed critical hit. */
  on: 'hit' | 'crit';
  /**
   * A shared Situation key (holy's evil, bane's foe), a local or option
   * Situation (huntsman's tracked quarry, #764), or null.
   */
  situation: Situation | null;
  /** False while the part's Situation isn't selected. */
  applies: boolean;
  sheetEntryId: string;
  catalogEntryId: string;
  name: string;
};

export type LineItemModifier = {
  statistic: 'attack' | 'damage';
  value: number;
  label: string;
  sheetEntryId: string;
  enhancement: boolean;
  situation?: string;
};

/** CRB p. 469: burst dice add one die per multiplier step above ×2 (A13: printed, at most ×4). */
function scaleCriticalDice(dice: string, multiplier: number) {
  const match = /^(\d+)d(\d+)$/.exec(dice.trim());
  if (!match) return dice;
  const steps = Math.max(1, Math.min(multiplier, 4) - 1);
  return `${Number(match[1]) * steps}d${match[2]}`;
}

type LineItem = { entry: ItemEntry; name: string; part: ItemPart };

function bothStatistics(
  modifier: Omit<LineItemModifier, 'statistic'>,
): LineItemModifier[] {
  return (['attack', 'damage'] as const).map((statistic) => ({
    statistic,
    ...modifier,
  }));
}

function partEnhancementModifiers(
  { entry, name }: LineItem,
  part: ResolvedItemPart,
): LineItemModifier[] {
  if (part.enhancement > 0)
    return bothStatistics({
      value: part.enhancement,
      label: `${name} enhancement`,
      sheetEntryId: entry._id,
      enhancement: true,
    });
  // CRB p. 149: masterwork is +1 enhancement on attack rolls only.
  return part.masterwork
    ? [
        {
          statistic: 'attack',
          value: 1,
          label: `${name} masterwork`,
          sheetEntryId: entry._id,
          enhancement: true,
        },
      ]
    : [];
}

/** CRB p. 469: bane is +2 better than the weapon's own bonus against its foe. */
function foeEnhancementModifiers(
  { entry, name }: LineItem,
  part: ResolvedItemPart,
): LineItemModifier[] {
  return contributingAbilities(part).flatMap((ability) => {
    const increase = ability.detail?.foeEnhancement;
    if (!increase || !ability.foeSituation) return [];
    return bothStatistics({
      value: Math.max(0, part.enhancement) + increase,
      label: `${name} enhancement (${ability.name}: ${ability.choice})`,
      sheetEntryId: entry._id,
      enhancement: true,
      situation: ability.foeSituation,
    });
  });
}

/**
 * CRB p. 154: a silvered weapon takes −1 damage (minimum 1), whatever its
 * damage type (owner decision, 2026-10-05).
 */
function materialModifiers(
  { entry, name }: LineItem,
  part: ResolvedItemPart,
): LineItemModifier[] {
  if (normalizeMaterial(part.material) !== 'alchemicalsilver') return [];
  return [
    {
      statistic: 'damage',
      value: -1,
      label: `${name} alchemical silver (minimum 1 damage)`,
      sheetEntryId: entry._id,
      enhancement: false,
    },
  ];
}

/** Shield Master: the shield's own enhancement reaches its bash. */
function shieldMasterModifiers(
  { entry, name, part }: LineItem,
  shieldMaster: { name: string } | undefined,
): LineItemModifier[] {
  const enhancement = entry.state.enhancement ?? 0;
  if (!shieldMaster || part !== 'bash' || enhancement <= 0) return [];
  return bothStatistics({
    value: enhancement,
    label: `${name} shield enhancement (${shieldMaster.name})`,
    sheetEntryId: entry._id,
    enhancement: true,
  });
}

function extraDamageParts(
  { entry }: LineItem,
  part: ResolvedItemPart,
  multiplier: number,
  situations: readonly RequestedSituation[] | undefined,
): ExtraDamagePart[] {
  return contributingAbilities(part).flatMap((ability) =>
    (ability.detail?.damageDice ?? []).map((dice) => {
      const situation =
        dice.situation === CHOSEN_FOE_SITUATION
          ? ability.foeSituation
          : (dice.situation ?? null);
      return {
        dice:
          dice.on === 'crit'
            ? scaleCriticalDice(dice.dice, multiplier)
            : dice.dice,
        damageType: dice.damageType ?? null,
        on: dice.on,
        situation,
        applies:
          situation === null ||
          situationMatches(situation, entry._id, situations),
        sheetEntryId: entry._id,
        catalogEntryId: ability.catalogEntryId,
        name: ability.name,
      };
    }),
  );
}

function threatDoublers({ entry }: LineItem, part: ResolvedItemPart) {
  return contributingAbilities(part).flatMap((ability) =>
    ability.detail?.doublesThreat
      ? [{ sheetEntryId: entry._id, name: ability.name }]
      : [],
  );
}

/**
 * One attack line's item contributions: the weapon part's enhancement or
 * masterwork, the ammunition's competing enhancement (CRB p. 468: only the
 * higher applies) and both items' abilities, Shield Master's shield
 * enhancement on a bash, bane against its foe, materials, extra dice and
 * threat-range doubling. Enhancement contributions share the enhancement
 * bonus type, so ordinary highest-only stacking settles every competition.
 */
export function resolveWeaponLineItems({
  input,
  weapon,
  ammunition,
  shieldMaster,
  multiplier,
  situations,
}: {
  input: CharacterSheetInput;
  weapon: LineItem;
  ammunition?: LineItem;
  /** Shield Master: the shield's own enhancement reaches its bash. */
  shieldMaster?: { name: string };
  multiplier: number;
  situations?: readonly RequestedSituation[];
}) {
  const byId = catalogLookup(input.catalogEntries);
  const resolved = (ammunition ? [weapon, ammunition] : [weapon]).flatMap(
    (item) => {
      const detail = itemDetailOf(byId.get(item.entry.catalogEntryId));
      return detail
        ? [
            {
              item,
              part: resolveItemPart({
                state: item.entry.state,
                detail,
                part: item.part,
                byId,
              }),
            },
          ]
        : [];
    },
  );
  const weaponPart = resolved.find(({ item }) => item === weapon);
  return {
    modifiers: [
      ...(weaponPart
        ? [
            ...partEnhancementModifiers(weapon, weaponPart.part),
            ...foeEnhancementModifiers(weapon, weaponPart.part),
            ...materialModifiers(weapon, weaponPart.part),
          ]
        : []),
      ...shieldMasterModifiers(weapon, shieldMaster),
      ...resolved
        .filter(({ item }) => item !== weapon)
        .flatMap(({ item, part }) => [
          ...partEnhancementModifiers(item, part),
          ...foeEnhancementModifiers(item, part),
          ...materialModifiers(item, part),
        ]),
    ],
    extraDamage: resolved.flatMap(({ item, part }) =>
      extraDamageParts(item, part, multiplier, situations),
    ),
    // Keen is the weapon's own: ammunition never doubles a threat range.
    threatDoublers: weaponPart ? threatDoublers(weapon, weaponPart.part) : [],
  };
}
export type WeaponLineItems = ReturnType<typeof resolveWeaponLineItems>;

export function itemPartLabel(name: string, part: ItemPart) {
  if (part === 'otherEnd') return `${name} (other end)`;
  if (part === 'bash') return `${name} bash`;
  return name;
}

function abilityIdentity(ability: ResolvedItemAbility) {
  return ability.ruleIdentity ?? ability.catalogEntryId;
}

function uniqueNames(abilities: readonly ResolvedItemAbility[]) {
  return [...new Set(abilities.map((ability) => ability.name))].join(', ');
}

function isWrongItem(
  ability: ResolvedItemAbility,
  part: ResolvedItemPart,
  damageTypes: readonly string[],
) {
  const detail = ability.detail;
  if (!detail) return false;
  // Bashing is a shield ability made for the bash, wherever it is listed.
  const onBash = part.part === 'bash' && ability.sourceKey === BASHING_SOURCE;
  if (!onBash && !itemAbilitySuits(detail.appliesTo, part.kind)) return true;
  const required = detail.weaponDamageTypes;
  return Boolean(
    required?.length && !damageTypes.some((type) => required.includes(type)),
  );
}

/** The damage types one part deals; an other end inherits the head's. */
export function partDamageTypes(detail: ItemDetail, part: ItemPart) {
  const weapon = detail.weapon;
  if (!weapon) return [];
  if (part === 'otherEnd')
    return weapon.otherEnd?.damageTypes ?? weapon.damageTypes ?? [];
  return weapon.damageTypes ?? [];
}

/** One part's construction check: what it found, or null. */
type PartFinding = {
  check: SheetWarning['check'];
  kind?: SheetWarning['kind'];
  facts: readonly unknown[];
  message: string;
};
type PartCheck = (context: {
  label: string;
  part: ResolvedItemPart;
  damageTypes: readonly string[];
  /** The highest enhancement active Spell Effects give this part. */
  targeted: number;
}) => PartFinding | null;

const enhancementCheck: PartCheck = ({ label, part }) =>
  Number.isSafeInteger(part.enhancement) && part.enhancement > 5
    ? {
        check: 'equipmentEnhancement',
        facts: [part.enhancement],
        message: `${label} has +${part.enhancement} enhancement; the usual maximum is +5.`,
      }
    : null;

const unavailableCheck: PartCheck = ({ label, part }) => {
  const unavailable = part.abilities.filter((ability) => !ability.detail);
  return unavailable.length
    ? {
        check: 'itemAbilityUnavailable',
        kind: 'unresolved',
        facts: unavailable.map((ability) => ability.catalogEntryId).sort(),
        message: `${label} lists an Item Ability that is unavailable. It contributes nothing until it is restored or removed.`,
      }
    : null;
};

const missingEnhancementCheck: PartCheck = ({ label, part }) =>
  part.abilities.some((ability) => ability.detail) && part.enhancement < 1
    ? {
        check: 'itemAbilityWithoutEnhancement',
        facts: [part.abilities.map(abilityIdentity).sort(), part.enhancement],
        message: `${label} has special abilities without a +1 enhancement bonus.`,
      }
    : null;

// Spell and item enhancement don't stack: the higher one counts (#236).
const bonusEquivalentCheck: PartCheck = ({ label, part, targeted }) => {
  const own = Number.isSafeInteger(part.enhancement)
    ? Math.max(0, part.enhancement)
    : 0;
  const total = part.bonusEquivalent - own + Math.max(own, targeted);
  return total > 10
    ? {
        check: 'itemBonusEquivalent',
        facts: [total],
        message: `${label} has a total bonus equivalent of +${total}; the maximum is +10.`,
      }
    : null;
};

const duplicateCheck: PartCheck = ({ label, part }) => {
  const identities = part.abilities.map(abilityIdentity);
  const duplicates = [
    ...new Set(
      identities.filter(
        (identity, index) => identities.indexOf(identity) !== index,
      ),
    ),
  ].sort();
  return duplicates.length
    ? {
        check: 'itemDuplicateAbility',
        facts: duplicates,
        message: `${label} has the same Item Ability more than once: ${uniqueNames(
          part.abilities.filter((ability) =>
            duplicates.includes(abilityIdentity(ability)),
          ),
        )}.`,
      }
    : null;
};

const appliesToCheck: PartCheck = ({ label, part, damageTypes }) => {
  const wrong = part.abilities.filter((ability) =>
    isWrongItem(ability, part, damageTypes),
  );
  return wrong.length
    ? {
        check: 'itemAbilityAppliesTo',
        facts: [
          part.kind,
          damageTypes.slice().sort(),
          wrong.map(abilityIdentity).sort(),
        ],
        message: `${label} can't normally carry ${uniqueNames(wrong)}.`,
      }
    : null;
};

const partChecks = [
  enhancementCheck,
  unavailableCheck,
  missingEnhancementCheck,
  bonusEquivalentCheck,
  duplicateCheck,
  appliesToCheck,
];

function partWarning(
  entry: ItemEntry,
  part: ItemPart,
  { check, kind = 'rules', facts, message }: PartFinding,
): SheetWarning {
  return {
    kind,
    check,
    subject: itemPartSubject(entry._id, part),
    target: { kind: 'entry', entryId: entry._id },
    fingerprint: JSON.stringify(facts),
    message,
  };
}

function baseItemWarnings(
  { entry, detail }: { entry: ItemEntry; detail: ItemDetail },
  name: string,
  byId: CatalogLookup,
): SheetWarning[] {
  if (
    !detail.baseItem ||
    hasStatistics(itemDetailOf(byId.get(detail.baseItem)))
  )
    return [];
  return [
    partWarning(entry, 'primary', {
      check: 'itemBaseItemUnresolved',
      kind: 'unresolved',
      facts: [detail.baseItem],
      message: `${name}'s Base Item is unavailable, so its weapon or armor statistics are unknown. Restore the Base Item or record the item's statistics.`,
    }),
  ];
}

/**
 * #236's construction checks, per end and per bash, for every item whether
 * or not it is equipped. Only state counts, so bane and conditional
 * enhancement never raise them. Prices are never computed. A targeted
 * Spell Effect's enhancement (`targetedEnhancement`) counts toward the +10
 * total where it beats the part's own.
 */
export function itemConstructionWarnings(
  input: CharacterSheetInput,
  {
    targetedEnhancement = () => 0,
  }: {
    targetedEnhancement?: (entryId: string, part: ItemPart) => number;
  } = {},
): SheetWarning[] {
  const byId = catalogLookup(input.catalogEntries);
  return itemRows(input, byId).flatMap((row) => {
    const { entry, definition, detail } = row;
    const name = definition.name ?? 'Item';
    return [
      ...baseItemWarnings(row, name, byId),
      ...listItemParts(detail).flatMap((partKey) => {
        const context = {
          label: itemPartLabel(name, partKey),
          part: resolveItemPart({
            state: entry.state,
            detail,
            part: partKey,
            byId,
          }),
          damageTypes: partDamageTypes(detail, partKey),
          targeted: targetedEnhancement(entry._id, partKey),
        };
        return partChecks.flatMap((check) => {
          const finding = check(context);
          return finding ? [partWarning(entry, partKey, finding)] : [];
        });
      }),
    ];
  });
}
