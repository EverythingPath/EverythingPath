import {
  UNARMED_STRIKE_ID,
  isUnarmedStrike,
  type NaturalAttackRole,
  type AttackHand,
  type AttackWeaponEnd,
  type ItemPart,
} from './character-sheet-attack-types';
import {
  BASHING_SOURCE,
  findItemAbilitySource,
  resolveWeaponLineItems,
  type ExtraDamagePart,
  type WeaponLineItems,
} from './character-sheet-items';
import {
  creatureSizes,
  type CreatureSize,
} from './character-sheet-creature-sizes';
import { spellEffectThreatDoublers } from './character-sheet-spell-effects';
import {
  builtIn,
  composeStatistics,
  isTemporaryEffect,
  resolveSheet,
  specialSizeModifiers,
  type Ability,
  type CharacterSheetInput,
  type LeafTarget,
  type ModifierTarget,
  type ResolvedStatistic,
  type ResolveOptions,
  type SheetCatalogEntryDetail,
  type SheetEntry,
  type SheetWarning,
  type SourcedModifier,
} from './character-sheet';
import type { resolveWeaponProficiencies } from './character-sheet-equipment';
import { isHandDependentWeapon } from './character-sheet-proficiencies';
import { signedNumber } from './character-sheet-casting-copy';
import {
  countClassLevels,
  sheetClassIdentity,
  flurryArmorWarning,
  flurryAttackPenalty,
  flurryExtraAttacks,
  flurryNaturalAttackWarning,
  flurryRule,
  flurryWeaponWarning,
  isFlurryWeapon,
  listFlurryArmor,
  resolveFlurryBaseAttack,
  type FlurryVersion,
} from './character-sheet-flurry';
import {
  naturalAttackProfiles,
  createNaturalAttackWeapon,
  resolveNaturalAttackDice,
  scaleAttackDice,
} from './character-sheet-natural-attacks';
import {
  doubledThreat,
  findHasteSource,
  HASTE_SOURCE,
  isFinesseWeapon,
  multiplyDamageDice,
  normalizeWeaponChoice,
  powerAttackSteps,
  resolveRoutineOptionChoices,
  type RoutineOptionEffects,
  type RoutineOptionSource,
  type RoutineOptionView,
} from './character-sheet-routine-options';

export type AttackRoutineState = Extract<
  SheetEntry,
  { kind: 'attackRoutine' }
>['state'];
export type WeaponDetail = NonNullable<
  Extract<SheetCatalogEntryDetail, { kind: 'item' }>['weapon']
>;
export const builtInUnarmedWeapon: WeaponDetail & {
  dice: string;
  threat: number;
  mult: number;
} = {
  baseType: 'unarmed strike',
  proficiency: 'always',
  groups: ['natural', 'close', 'monk'],
  handedness: 'light',
  attackType: 'melee',
  dice: '1d3',
  damageTypes: ['bludgeoning'],
  threat: 20,
  mult: 2,
  strengthDamage: 'melee',
};
export type AttackStatistic =
  | 'attackBonus'
  | 'damageBonus'
  | 'criticalThreat'
  | 'criticalMultiplier'
  | 'rangeIncrement';
export type AttackLine = {
  attackKind: 'manufactured' | 'natural' | 'unarmed';
  naturalRole?: NaturalAttackRole;
  damageKind?: 'lethal' | 'nonlethal' | 'lethalOrNonlethal';
  hand: AttackHand;
  end: AttackWeaponEnd;
  weaponEntryId: string;
  launcherEntryId: string | null;
  ammunitionEntryId: string | null;
  weaponName: string;
  mode: AttackRoutineState['mode'];
  damageDice: string;
  damageType: string;
  damageDiceSource: { sheetEntryId: string; entryName: string; source: string };
  /**
   * Item Ability dice from the weapon's part and its ammunition: never
   * multiplied on a critical; `crit` parts apply on critical hits only.
   */
  extraDamage: ExtraDamagePart[];
  attackBonus: ResolvedStatistic;
  damageBonus: ResolvedStatistic;
  criticalThreat: ResolvedStatistic;
  criticalMultiplier: ResolvedStatistic;
  rangeIncrement: ResolvedStatistic | null;
  /** The attack penalty for range increments beyond the first, or null. */
  rangePenalty: number | null;
  /** An additional full-attack line at the highest bonus, and its rule. */
  extraAttack?: {
    kind: 'haste' | 'rapidShot' | 'medusasWrath' | 'flurry';
    sheetEntryId: string;
    name: string;
  };
  /** Manyshot: the first attack fires two arrows that hit together. */
  projectiles?: number;
  /** Vital Strike: `damageDice` already holds the multiplied dice. */
  vitalStrike?: {
    multiplier: number;
    weaponDice: string;
    sheetEntryId: string;
    name: string;
  };
};
/** What a flurry of blows puts on each of its lines (CRB p. 57; PU p. 14). */
type FlurryLineFacts = {
  version: FlurryVersion;
  /** The counting class feature, credited in breakdowns. */
  sheetEntryId: string;
  name: string;
  /** −2 on every core flurry attack; 0 for the Unchained flurry. */
  attackPenalty: number;
};
/**
 * A switched-on flurry of blows in effect (CRB p. 57; PU p. 14): its own
 * version's monk levels, the base attack bonus its attacks use (the core
 * flurry's substitutes the monk level for the monk's own) and its extra
 * attacks. The single attack never flurries.
 */
export type ResolvedFlurry = FlurryLineFacts & {
  monkLevel: number;
  baseAttackBonus: ResolvedStatistic;
  extraAttacks: number;
  /**
   * FAQ o72; owner (#414): Combat Expertise switched on in a melee flurry
   * takes its steps from the flurry's base attack bonus, so its dodge bonus
   * to AC equals the penalty on the flurry's attacks.
   */
  combatExpertise: (RoutineOptionSource & { dodgeBonus: number }) | null;
};
/** CRB p. 136: once per round when both hands hit; never a single attack. */
export type TwoWeaponRend = {
  sheetEntryId: string;
  name: string;
  damageDice: string;
  damageBonus: ResolvedStatistic;
};
export type ResolvedAttackRoutine = {
  entryId: string;
  name: string;
  weaponEntryId: string;
  hands: AttackRoutineState['hands'];
  mode: AttackRoutineState['mode'];
  offHand?: AttackRoutineState['offHand'];
  ammunitionEntryId?: string;
  rangeIncrements?: number;
  twoWeaponPenaltySummary: string | null;
  attackRateNotes: string[];
  /** Offered and switched-on Routine Options, for chips and the editor. */
  options: RoutineOptionView[];
  /** What switched-on options do beyond the lines' numbers. */
  optionNotes: string[];
  twoWeaponRend: TwoWeaponRend | null;
  /** The switched-on flurry of blows shaping the full attack, if any. */
  flurry: ResolvedFlurry | null;
  single: AttackLine[];
  full: AttackLine[];
  warnings: SheetWarning[];
};

export function defaultAttackRoutineConfiguration(
  weapon: WeaponDetail,
): Pick<AttackRoutineState, 'hands' | 'mode'> {
  return {
    hands: weapon.handedness === 'twoHanded' ? 'two' : 'one',
    mode:
      weapon.attackType === 'ranged'
        ? weapon.strengthDamage === 'thrown'
          ? 'thrown'
          : 'ranged'
        : 'melee',
  };
}

/** CRB p. 180: five increments for a thrown hand, otherwise ten. */
export function maximumRangeIncrements({
  mode,
  offHand,
}: {
  mode: AttackRoutineState['mode'];
  offHand?: { mode: AttackRoutineState['mode'] } | null;
}) {
  return mode === 'thrown' || offHand?.mode === 'thrown' ? 5 : 10;
}

export function formatCriticalRange(threat: number) {
  return threat === 20 ? '20' : `${threat}–20`;
}

export function attackRoutineWeaponUses(input: CharacterSheetInput) {
  const naturalWeaponIds = new Set(
    listPossessedNaturalWeapons(input).map(({ item }) => item._id),
  );
  return input.entries.flatMap((entry) => {
    if (entry.kind !== 'attackRoutine' || !entry.active) return [];
    const hands = [
      {
        hand: 'main' as const,
        weaponEntryId: entry.state.weaponEntryId,
        hands: entry.state.hands,
        mode: entry.state.mode,
      },
      ...(entry.state.offHand?.kind === 'weapon'
        ? [
            {
              ...entry.state.offHand,
              hand: naturalWeaponIds.has(entry.state.weaponEntryId)
                ? ('main' as const)
                : ('off' as const),
              hands: 'one' as const,
            },
          ]
        : []),
    ];
    return hands.flatMap((hand) => {
      const item = input.entries.find(
        (candidate) => candidate._id === hand.weaponEntryId,
      );
      if (item?.kind !== 'item' || !item.active) return [];
      const catalog = input.catalogEntries.find(
        (candidate) => candidate._id === item.catalogEntryId,
      );
      if (catalog?.detail?.kind !== 'item' || !catalog.detail.weapon) return [];
      return [
        {
          entryId: item._id,
          routineEntryId: entry._id,
          hand: hand.hand,
          hands: hand.hands,
          attack:
            hand.mode === 'melee' ? ('melee' as const) : ('ranged' as const),
        },
      ];
    });
  });
}

type RoutineEntry = Extract<SheetEntry, { kind: 'attackRoutine' }>;
type ItemEntry = Extract<SheetEntry, { kind: 'item' }>;
type CompleteWeapon = WeaponDetail & {
  dice: string;
  threat: number;
  mult: number;
};
type AvailableWeapon = {
  kind: 'available';
  item: ItemEntry;
  /** The item part attacking: the item, its other end or a bash. */
  part: ItemPart;
  weapon: CompleteWeapon;
  name: string;
  source: string;
  ammunition: boolean;
};
type AttackCalculation = {
  unarmedLethal?: boolean;
  weaponWithoutTwoWeaponFighting?: boolean;
  naturalRole?: NaturalAttackRole;
  soleNaturalAttack?: boolean;
  multiattackEntryId?: string;
  hand: AttackLine['hand'];
  end: AttackLine['end'];
  twoWeaponPenalty?: number;
  twoWeaponFeatEntryId?: string;
  doubleSliceEntryId?: string;
  usesBothEnds?: boolean;
  preciseShot?: boolean;
  /** Whether the hand not making this attack is free to reload. */
  otherHandFree?: boolean;
  optionEffects?: RoutineOptionEffects;
  /** A flurry of blows full attack's line facts (CRB p. 57; PU p. 14). */
  flurry?: FlurryLineFacts & {
    /** FAQ o72: Combat Expertise's extra steps at the flurry BAB. */
    combatExpertise?: RoutineOptionSource & { value: number };
  };
  weaponFinesse?: RoutineOptionSource;
  /**
   * Carried shields' armor check penalties that Weapon Finesse adds; a
   * nonproficient shield's penalty is already on every attack roll.
   */
  shieldPenalties?: readonly { entryId: string; name: string; value: number }[];
  /** Active Improved Critical Selections and their chosen weapons. */
  threatExpanders?: readonly (RoutineOptionSource & { choice: string })[];
  /** Shield Master: no two-weapon penalty and the shield's enhancement on a bash. */
  shieldMaster?: RoutineOptionSource;
  /** Ammunition fired by this line's ranged hand. */
  ammunition?: { entry: ItemEntry; name: string };
  /** The line's item contributions: enhancement, abilities, materials. */
  itemContributions?: WeaponLineItems;
  input: CharacterSheetInput;
  entry: RoutineEntry;
  equippedWeapon: AvailableWeapon;
  abilities: Record<Ability, { score: number; modifier: number }>;
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
  proficiency:
    | ReturnType<typeof resolveWeaponProficiencies>['weapons'][number]
    | undefined;
  options: ResolveOptions;
};

function activeFeats(input: CharacterSheetInput) {
  return input.entries.flatMap((entry) => {
    if (entry.kind !== 'feat' || !entry.active) return [];
    const definition = input.catalogEntries.find(
      (candidate) => candidate._id === entry.catalogEntryId,
    );
    return definition
      ? [
          {
            identity: definition.ruleIdentity,
            name: definition.name ?? definition.ruleIdentity,
            entry,
          },
        ]
      : [];
  });
}

function activeFeatSelections(feats: ReturnType<typeof activeFeats>) {
  return new Map(feats.map(({ identity, entry }) => [identity, entry]));
}

const crossbowBaseTypes = [
  'hand crossbow',
  'light crossbow',
  'heavy crossbow',
] as const;
type CrossbowBaseType = (typeof crossbowBaseTypes)[number];
type ReloadAction = NonNullable<WeaponDetail['reload']>;

/** CRB p. 132: Rapid Reload's reload action for its chosen crossbow. */
const rapidReloadActions: Record<CrossbowBaseType, ReloadAction> = {
  'hand crossbow': 'free',
  'light crossbow': 'free',
  'heavy crossbow': 'move',
};
const reloadLabels: Record<ReloadAction, string> = {
  free: 'free action',
  move: 'move action',
  fullRound: 'full-round action',
};

/** A weapon base type or recorded choice, ignoring case, spacing and hyphens. */
function crossbowBaseType(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
  return crossbowBaseTypes.find((type) => type === normalized);
}

/** Crossbow types chosen by active Rapid Reload Selections. */
function rapidReloadCrossbows(feats: ReturnType<typeof activeFeats>) {
  return new Set(
    feats.flatMap(({ identity, entry }) => {
      const crossbow =
        identity === 'rapid-reload'
          ? crossbowBaseType(entry.state.choice)
          : undefined;
      return crossbow ? [crossbow] : [];
    }),
  );
}

type AttackRateRules = {
  quickDraw: boolean;
  rapidReload: ReadonlySet<CrossbowBaseType>;
};
type AttackRate = { limited: boolean; notes: string[] };

/**
 * CRB pp. 131, 149; #237 A9: ammunition and Quick Draw redraw with the
 * throwing hand; otherwise each hand throws the one weapon it holds.
 */
function thrownAttackRate(
  calculation: AttackCalculation,
  rules: AttackRateRules,
): AttackRate {
  if (calculation.equippedWeapon.ammunition)
    return {
      limited: false,
      notes: ['Drawn as ammunition: draw as a free action.'],
    };
  if (rules.quickDraw)
    return {
      limited: false,
      notes: ['Quick Draw: draw thrown weapons as a free action.'],
    };
  return {
    limited: true,
    notes: [
      'One held thrown weapon per hand. Quick Draw permits additional throws.',
    ],
  };
}

/**
 * CRB pp. 132, 144–146: reloading needs the other hand free; a non-free
 * reload allows one attack. Rapid Reload frees hand/light crossbows and
 * makes a heavy crossbow a move action.
 */
function reloadAttackRate(
  calculation: AttackCalculation,
  reload: ReloadAction,
  rules: AttackRateRules,
): AttackRate {
  const crossbow = crossbowBaseType(calculation.equippedWeapon.weapon.baseType);
  const rapid = crossbow !== undefined && rules.rapidReload.has(crossbow);
  const action = rapid ? rapidReloadActions[crossbow] : reload;
  const reloadText = `Reload: ${reloadLabels[action]}${rapid ? ' (Rapid Reload)' : ''}`;
  if (action !== 'free')
    return {
      limited: true,
      notes: [`${reloadText}. One attack per full attack.`],
    };
  if (!calculation.otherHandFree)
    return {
      limited: true,
      notes: [
        `${reloadText}, but no free hand to reload. One attack per full attack.`,
      ],
    };
  return { limited: false, notes: [`${reloadText}.`] };
}

function attackRate(
  calculation: AttackCalculation,
  rules: AttackRateRules,
): AttackRate {
  const { mode } = calculation.entry.state;
  if (mode === 'thrown') return thrownAttackRate(calculation, rules);
  const { reload } = calculation.equippedWeapon.weapon;
  if (mode !== 'ranged' || !reload) return { limited: false, notes: [] };
  return reloadAttackRate(calculation, reload, rules);
}

/**
 * CRB pp. 145–146 and the buckler's description: an off-hand weapon, the
 * other end or a carried shield occupies the other hand; a buckler and a
 * two-handed grip on the launcher leave it free to reload.
 */
function isOtherHandFree(entry: RoutineEntry, input: CharacterSheetInput) {
  if (entry.state.offHand) return false;
  if (entry.state.hands === 'two') return true;
  return !input.entries.some((row) => {
    if (row.kind !== 'item' || !row.active) return false;
    const detail = input.catalogEntries.find(
      (candidate) => candidate._id === row.catalogEntryId,
    )?.detail;
    const armor = detail?.kind === 'item' ? detail.armor : undefined;
    return armor?.slot === 'shield' && armor.category !== 'buckler';
  });
}

/** CRB Table 8–7; only the off-hand weapon determines light status. */
function twoWeaponPenalties({
  light,
  trained,
}: {
  light: boolean;
  trained: boolean;
}) {
  return trained
    ? { main: light ? -2 : -4, off: light ? -2 : -4 }
    : { main: light ? -4 : -6, off: light ? -8 : -10 };
}

function routineWarning({
  entry,
  kind = 'rules',
  check,
  facts,
  message,
}: {
  entry: RoutineEntry;
  kind?: SheetWarning['kind'];
  check: SheetWarning['check'];
  facts: readonly unknown[];
  message: string;
}): SheetWarning {
  return {
    kind,
    check,
    target: { kind: 'entry', entryId: entry._id },
    subject: entry._id,
    fingerprint: JSON.stringify(facts),
    message,
  };
}

function resolveRoutineWeapon({
  entry,
  input,
  recordedEntries,
  hand = 'main',
  options = {},
}: {
  entry: RoutineEntry;
  input: CharacterSheetInput;
  recordedEntries: readonly SheetEntry[];
  hand?: AttackHand;
  options?: ResolveOptions;
}): AvailableWeapon | { kind: 'unavailable'; warning: SheetWarning } {
  const state = entry.state;
  if (isUnarmedStrike(state.weaponEntryId)) {
    const monk = options.monkUnarmedStrike;
    const dice = monk
      ? scaleAttackDice(
          monk.dice,
          monk.size ?? 'medium',
          options.size ?? 'medium',
        )
      : scaleAttackDice(
          builtInUnarmedWeapon.dice,
          'medium',
          options.size ?? 'medium',
        );
    if (!dice)
      return {
        kind: 'unavailable',
        warning: routineWarning({
          entry,
          kind: 'unresolved',
          check: 'attackWeaponUnresolved',
          facts: [UNARMED_STRIKE_ID, monk?.dice, monk?.size, options.size],
          message:
            'Unarmed strike damage cannot be calculated at this size. Record supported damage dice.',
        }),
      };
    return {
      kind: 'available',
      item: {
        _id: UNARMED_STRIKE_ID,
        kind: 'item',
        active: true,
        catalogEntryId: 'builtin-unarmed',
        state: { kind: 'item' },
      },
      part: 'primary',
      weapon: {
        ...builtInUnarmedWeapon,
        dice,
      },
      name: 'Unarmed strike',
      source: 'CRB pp. 142, 182',
      ammunition: false,
    };
  }
  const effectiveItem = input.entries.find(
    (candidate) => candidate._id === state.weaponEntryId,
  );
  const item =
    effectiveItem ??
    recordedEntries.find((candidate) => candidate._id === state.weaponEntryId);
  const catalog =
    item && 'catalogEntryId' in item
      ? input.catalogEntries.find(
          (candidate) => candidate._id === item.catalogEntryId,
        )
      : undefined;
  const rawWeapon =
    catalog?.detail?.kind === 'item' ? catalog.detail.weapon : undefined;
  const weapon = rawWeapon?.naturalAttack
    ? {
        ...createNaturalAttackWeapon(rawWeapon.naturalAttack.type),
        ...rawWeapon,
        dice: resolveNaturalAttackDice(rawWeapon, options.size ?? 'medium'),
      }
    : rawWeapon;
  const weaponName = catalog?.name ?? weapon?.baseType ?? 'The selected weapon';
  const subject = hand === 'off' ? weaponName : `${state.name}'s weapon`;
  const repair =
    hand === 'off'
      ? 'choose another weapon. Off-hand attacks are skipped.'
      : 'choose another weapon to use this routine.';
  if (item?.kind !== 'item' || !weapon) {
    return {
      kind: 'unavailable',
      warning: routineWarning({
        entry,
        kind: item ? 'unresolved' : 'rules',
        check: item ? 'invalidAttackWeapon' : 'missingAttackWeapon',
        facts: [state.weaponEntryId],
        message: item
          ? `${hand === 'off' ? weaponName : `${state.name}'s selected entry`} is no longer a weapon. ${repair.charAt(0).toUpperCase()}${repair.slice(1)}`
          : `${subject} is no longer in Gear. ${repair.charAt(0).toUpperCase()}${repair.slice(1)}`,
      }),
    };
  }
  if (!item.active || !effectiveItem) {
    return {
      kind: 'unavailable',
      warning: routineWarning({
        entry,
        check: item.active ? 'unavailableAttackWeapon' : 'inactiveAttackWeapon',
        facts: [state.weaponEntryId, item.active ? 'unavailable' : false],
        message: item.active
          ? `${subject} is unavailable. Restore its source or ${repair}`
          : `${subject} is switched off. Switch it on in Gear or ${repair}`,
      }),
    };
  }
  if (
    !weapon.dice ||
    weapon.threat === undefined ||
    weapon.mult === undefined
  ) {
    return {
      kind: 'unavailable',
      warning: routineWarning({
        entry,
        kind: 'unresolved',
        check: 'attackWeaponUnresolved',
        facts: [state.weaponEntryId, weapon.dice, weapon.threat, weapon.mult],
        message:
          hand === 'off'
            ? `${weaponName}'s statistics are incomplete. Off-hand attacks are skipped.`
            : `${state.name}'s weapon statistics are incomplete. Damage and attacks cannot be calculated.`,
      }),
    };
  }
  // CRB p. 152: a shield's bash has its own enhancement, apart from its AC bonus.
  const part: ItemPart =
    catalog?.detail?.kind === 'item' && catalog.detail.armor?.slot === 'shield'
      ? 'bash'
      : 'primary';
  const dice =
    part === 'bash' &&
    findItemAbilitySource(input, item, ['primary', 'bash'], BASHING_SOURCE)
      ? bashingDice(weapon.dice, options.size ?? 'medium')
      : weapon.dice;
  if (!dice)
    return {
      kind: 'unavailable',
      warning: routineWarning({
        entry,
        kind: 'unresolved',
        check: 'attackWeaponUnresolved',
        facts: [state.weaponEntryId, weapon.dice, BASHING_SOURCE, options.size],
        message: `Bashing can't size up ${weaponName}'s ${weapon.dice} bash damage. Record supported damage dice.`,
      }),
    };
  return {
    kind: 'available',
    item,
    part,
    weapon: {
      ...weapon,
      dice,
      threat: weapon.threat,
      mult: weapon.mult,
    },
    name: catalog?.name ?? weapon.baseType,
    source: catalog?.ruleIdentity ?? weapon.baseType,
    ammunition:
      catalog?.detail?.kind === 'item' && catalog.detail.ammunition === true,
  };
}

/**
 * Bashing (#764): "damage as if it were a weapon of two size categories
 * larger (a Medium light shield thus deals 1d6 … a Medium heavy shield
 * deals 1d8)", from the wielder's size.
 */
function bashingDice(dice: string, size: CreatureSize) {
  const larger = creatureSizes[creatureSizes.indexOf(size) + 2];
  return larger ? scaleAttackDice(dice, size, larger) : undefined;
}

type AmmunitionAvailability =
  | 'missing'
  | 'inactive'
  | 'unavailable'
  | 'invalid';

function ammunitionAvailability(
  id: string,
  input: CharacterSheetInput,
  recordedEntries: readonly SheetEntry[],
): { availability?: AmmunitionAvailability; name?: string } {
  const effective = input.entries.find((candidate) => candidate._id === id);
  const item =
    effective ?? recordedEntries.find((candidate) => candidate._id === id);
  if (!item) return { availability: 'missing' };
  const definition =
    'catalogEntryId' in item
      ? input.catalogEntries.find(
          (candidate) => candidate._id === item.catalogEntryId,
        )
      : undefined;
  const name = definition?.name;
  if (!item.active) return { availability: 'inactive', name };
  if (!effective) return { availability: 'unavailable', name };
  const isAmmunition =
    item.kind === 'item' &&
    definition?.detail?.kind === 'item' &&
    definition.detail.ammunition === true;
  return isAmmunition ? {} : { availability: 'invalid', name };
}

/** The routine's usable ammunition, fired by each ranged hand (CRB p. 468). */
function routineAmmunition(entry: RoutineEntry, input: CharacterSheetInput) {
  const id = entry.state.ammunitionEntryId;
  if (!id) return undefined;
  const item = input.entries.find((candidate) => candidate._id === id);
  if (item?.kind !== 'item' || !item.active) return undefined;
  const definition = input.catalogEntries.find(
    (candidate) => candidate._id === item.catalogEntryId,
  );
  if (definition?.detail?.kind !== 'item' || !definition.detail.ammunition)
    return undefined;
  return { entry: item, name: definition.name ?? 'Ammunition' };
}

/** The routine's ammunition serves every ranged hand, so it warns once. */
function routineAmmunitionWarnings(
  entry: RoutineEntry,
  input: CharacterSheetInput,
  recordedEntries: readonly SheetEntry[],
) {
  const { ammunitionEntryId: id, mode, offHand } = entry.state;
  if (!id || (mode !== 'ranged' && offHand?.mode !== 'ranged')) return [];
  const { availability, name = 'The selected ammunition' } =
    ammunitionAvailability(id, input, recordedEntries);
  if (!availability) return [];
  const messages = {
    missing:
      'The selected ammunition is no longer in Gear. Choose ammunition for this routine.',
    inactive: `${name} is switched off. Switch it on in Gear or choose other ammunition.`,
    unavailable: `${name} is unavailable. Restore its source or choose other ammunition.`,
    invalid: `${name} is not ammunition. Choose ammunition for this routine.`,
  };
  return [
    routineWarning({
      entry,
      check: `${availability}AttackAmmunition`,
      facts: [id, availability],
      message: messages[availability],
    }),
  ];
}

/** CRB p. 180: the routine's range is shared by its hands, so it warns once. */
function routineRangeWarnings(entry: RoutineEntry) {
  const { mode, offHand, rangeIncrements = 1 } = entry.state;
  const maximum = maximumRangeIncrements(entry.state);
  if (mode === 'melee' && (!offHand || offHand.mode === 'melee')) return [];
  if (rangeIncrements <= maximum) return [];
  return [
    routineWarning({
      entry,
      check: 'attackRangeExceeded',
      facts: [rangeIncrements, maximum],
      message: `${entry.state.name} is beyond its ${maximum}-increment maximum range${maximum === 5 ? ' for thrown weapons' : ''}. This routine keeps the range penalty.`,
    }),
  ];
}

function rangePenalty({ mode, rangeIncrements = 1 }: AttackRoutineState) {
  return mode !== 'melee' && rangeIncrements > 1
    ? -2 * (rangeIncrements - 1)
    : null;
}

function isImprovisedThrow({ entry, equippedWeapon }: AttackCalculation) {
  return entry.state.mode === 'thrown' && !equippedWeapon.weapon.thrown;
}

function routineSuitabilityWarnings({
  calculation,
  proficiencyFingerprint,
}: {
  calculation: AttackCalculation;
  proficiencyFingerprint: string | undefined;
}): SheetWarning[] {
  const {
    entry,
    equippedWeapon: { name, weapon },
    proficiency,
  } = calculation;
  const state = entry.state;
  const warnings: SheetWarning[] = [];
  if (isImprovisedThrow(calculation)) {
    warnings.push(
      routineWarning({
        entry,
        check: 'unsuitableAttackMode',
        facts: [state.weaponEntryId, state.mode, weapon.thrown],
        message: `${name} is not designed to be thrown. Improvised throw: −4 on attacks and a 10 ft. range increment.`,
      }),
    );
  }
  if (
    state.mode !== 'thrown' &&
    weapon.attackType &&
    state.mode !== weapon.attackType
  ) {
    warnings.push(
      routineWarning({
        entry,
        check: 'unsuitableAttackMode',
        facts: [state.weaponEntryId, state.mode, weapon.attackType],
        message: `${name} is normally used for ${weapon.attackType} attacks. This routine uses ${state.mode} attacks.`,
      }),
    );
  }
  if (state.hands === 'one' && weapon.handedness === 'twoHanded') {
    warnings.push(
      routineWarning({
        entry,
        check: 'unsuitableAttackHands',
        facts: [state.weaponEntryId, state.hands, weapon.handedness],
        message: `${name} normally requires two hands. This routine uses one hand.`,
      }),
    );
  }
  if (
    proficiency?.attackPenalty &&
    state.hands === 'one' &&
    isHandDependentWeapon(weapon.baseType)
  ) {
    warnings.push({
      ...routineWarning({
        entry,
        check: 'oneHandedExotic',
        facts: [state.weaponEntryId, state.hands, proficiency.attackPenalty],
        message: `${name} needs its named proficiency to be used in one hand. Not proficient: −4 on attacks.`,
      }),
      ...(proficiencyFingerprint
        ? { fingerprint: proficiencyFingerprint }
        : {}),
    });
  }
  return warnings;
}

function strengthForHand(strength: number, offHand: boolean) {
  return strength < 0 || !offHand ? strength : Math.floor(strength / 2);
}

function rangedDamageStrength(
  weapon: WeaponDetail,
  strength: number,
  offHand: boolean,
) {
  switch (weapon.strengthDamage) {
    case 'sling':
    case 'thrown':
      return strengthForHand(strength, offHand);
    case 'compositeBow': {
      const cappedStrength = Math.min(strength, weapon.strengthRating ?? 0);
      return strengthForHand(cappedStrength, offHand);
    }
    case 'bow':
      return Math.min(strength, 0);
    default:
      return 0;
  }
}

function damageStrength({
  weapon,
  state,
  strength,
  offHand = false,
  usesBothEnds = false,
}: {
  weapon: WeaponDetail;
  state: AttackRoutineState;
  strength: number;
  offHand?: boolean;
  usesBothEnds?: boolean;
}) {
  if (state.mode === 'ranged')
    return rangedDamageStrength(weapon, strength, offHand);
  const singleEndTwoHanded =
    state.mode === 'melee' &&
    state.hands === 'two' &&
    weapon.handedness !== 'light' &&
    !usesBothEnds;
  if (strength > 0 && !offHand && singleEndTwoHanded)
    return Math.floor(strength * 1.5);
  return strengthForHand(strength, offHand);
}

function sourced({
  calculation,
  value,
  label,
  target = calculation.entry.state.mode === 'melee'
    ? 'attack.melee'
    : 'attack.ranged',
  sheetEntryId = calculation.equippedWeapon.item._id,
}: {
  calculation: AttackCalculation;
  value: number;
  label: string;
  target?: ModifierTarget;
  sheetEntryId?: string;
}): SourcedModifier {
  return builtIn({
    target,
    id: `${calculation.entry._id}:${label}`,
    sheetEntryId,
    name: label,
    value,
  });
}

/**
 * CRB p. 136: Weapon Finesse uses Dexterity with an eligible melee weapon
 * when that is better, and then a carried shield's armor check penalty
 * applies to the attack.
 */
function resolveWeaponFinesse(calculation: AttackCalculation) {
  const {
    weaponFinesse,
    entry,
    equippedWeapon: { weapon },
    abilities,
    shieldPenalties = [],
  } = calculation;
  if (!weaponFinesse || entry.state.mode !== 'melee') return null;
  if (!isFinesseWeapon(weapon)) return null;
  const penalty = shieldPenalties.reduce((sum, row) => sum + row.value, 0);
  return abilities.dexterity.modifier + penalty > abilities.strength.modifier
    ? { source: weaponFinesse, shieldPenalties }
    : null;
}

/**
 * CRB p. 131: +50% for a two-handed weapon, a one-handed weapon in two
 * hands or a primary natural weapon with 1½ Strength; −50% off hand or for
 * a secondary natural weapon. #237 A10: a double weapon's primary end used
 * with its other end gets the plain bonus.
 */
function powerAttackMultiplier(calculation: AttackCalculation) {
  const {
    entry: { state },
    equippedWeapon: { item, weapon },
  } = calculation;
  // CRB p. 57, PU p. 14; #237 A1: a monk striking unarmed has no off hand.
  if (calculation.flurry && isUnarmedStrike(item._id)) return 1;
  if (calculation.naturalRole === 'secondary' || calculation.hand === 'off')
    return 0.5;
  if (calculation.soleNaturalAttack) return 1.5;
  return state.hands === 'two' &&
    weapon.handedness !== 'light' &&
    !weapon.naturalAttack &&
    !calculation.usesBothEnds
    ? 1.5
    : 1;
}

function attackAbilityLabel(
  ability: 'strength' | 'dexterity',
  finesse: RoutineOptionSource | undefined,
) {
  if (ability === 'strength') return 'Strength';
  return finesse ? `Dexterity (${finesse.name})` : 'Dexterity';
}

/**
 * #236: the line's enhancement, masterwork, ammunition, Shield Master, bane
 * and material contributions. Enhancement shares one bonus type, so the
 * higher of launcher and ammunition, or of bash and shield, applies.
 */
function itemPartModifiers(
  calculation: AttackCalculation,
  statistic: 'attack' | 'damage',
  target: ModifierTarget,
): SourcedModifier[] {
  return (calculation.itemContributions?.modifiers ?? []).flatMap((modifier) =>
    modifier.statistic === statistic
      ? [
          {
            ...sourced({
              calculation,
              value: modifier.value,
              label: modifier.label,
              target,
              sheetEntryId: modifier.sheetEntryId,
            }),
            ...(modifier.enhancement
              ? { bonusType: 'enhancement' as const }
              : { stacksWithinEntry: true as const }),
            ...(modifier.situation
              ? { condition: { situation: modifier.situation } }
              : {}),
          },
        ]
      : [],
  );
}

function resolveAttackBonus(calculation: AttackCalculation): ResolvedStatistic {
  const {
    entry,
    equippedWeapon: { item, name, weapon },
    abilities,
    breakdowns,
    proficiency,
    options,
  } = calculation;
  const state = entry.state;
  const target = state.mode === 'melee' ? 'attack.melee' : 'attack.ranged';
  const ability = state.mode === 'melee' ? 'strength' : 'dexterity';
  const familiarDexterity =
    weapon.naturalAttack &&
    options.naturalAttackAbility === 'greaterStrengthDexterity' &&
    abilities.dexterity.modifier > abilities.strength.modifier;
  const finesse = familiarDexterity ? null : resolveWeaponFinesse(calculation);
  const attackAbility = familiarDexterity || finesse ? 'dexterity' : ability;
  const leaf = breakdowns[target];
  const modifiers: SourcedModifier[] = [
    ...leaf.applied,
    ...leaf.suppressed,
    ...leaf.conditional,
    ...(leaf.excluded ?? []),
  ];
  if (state.mode !== 'melee' && !calculation.preciseShot) {
    modifiers.push({
      ...sourced({
        calculation,
        value: -4,
        label: 'Shooting into melee',
        sheetEntryId: 'builtin:shooting-into-melee',
      }),
      condition: { situation: 'shootingIntoMelee' },
    });
  }
  const penalty = rangePenalty(state);
  if (penalty !== null) {
    modifiers.push({
      ...sourced({
        calculation,
        value: penalty,
        label: 'Range penalty',
        sheetEntryId: entry._id,
      }),
      stacksWithinEntry: true,
    });
  }
  if (calculation.naturalRole === 'secondary') {
    modifiers.push({
      ...sourced({
        calculation,
        value: calculation.multiattackEntryId ? -2 : -5,
        label: calculation.multiattackEntryId
          ? 'Multiattack'
          : 'Secondary natural attack',
        sheetEntryId: calculation.multiattackEntryId ?? item._id,
      }),
      stacksWithinEntry: true,
    });
  }
  if (calculation.twoWeaponPenalty) {
    modifiers.push({
      ...sourced({
        calculation,
        value: calculation.twoWeaponPenalty,
        label: 'Two-weapon fighting',
        sheetEntryId: calculation.twoWeaponFeatEntryId ?? calculation.entry._id,
      }),
      stacksWithinEntry: true,
    });
  }
  const powerAttack = calculation.optionEffects?.powerAttack;
  if (powerAttack && state.mode === 'melee') {
    modifiers.push({
      ...sourced({
        calculation,
        value: -powerAttackSteps(breakdowns.bab.total),
        label: powerAttack.name,
        sheetEntryId: powerAttack.sheetEntryId,
      }),
      stacksWithinEntry: true,
    });
  }
  const flurry = calculation.flurry;
  if (flurry?.attackPenalty) {
    modifiers.push({
      ...sourced({
        calculation,
        value: flurry.attackPenalty,
        label: flurry.name,
        sheetEntryId: flurry.sheetEntryId,
      }),
      stacksWithinEntry: true,
    });
  }
  if (flurry?.combatExpertise && state.mode === 'melee') {
    modifiers.push({
      ...sourced({
        calculation,
        value: flurry.combatExpertise.value,
        label: `${flurry.combatExpertise.name} (flurry base attack bonus)`,
        sheetEntryId: flurry.combatExpertise.sheetEntryId,
      }),
      stacksWithinEntry: true,
    });
  }
  for (const shield of finesse?.shieldPenalties ?? []) {
    if (!shield.value) continue;
    modifiers.push(
      sourced({
        calculation,
        value: shield.value,
        label: `${shield.name} armor check penalty (Weapon Finesse)`,
        sheetEntryId: shield.entryId,
      }),
    );
  }
  const size = -specialSizeModifiers[options.size ?? 'medium'];
  if (isImprovisedThrow(calculation)) {
    modifiers.push({
      ...sourced({
        calculation,
        value: -4,
        label: `Improvised throw: ${name}`,
      }),
      stacksWithinEntry: true,
    });
  }
  if (size) {
    modifiers.push({
      ...builtIn({ target, id: 'size-attack', name: 'Size', value: size }),
      bonusType: 'size',
    });
  }
  modifiers.push(...itemPartModifiers(calculation, 'attack', target));
  if (
    proficiency?.attackPenalty &&
    !weapon.naturalAttack &&
    !isImprovisedThrow(calculation)
  ) {
    modifiers.push({
      ...sourced({
        calculation,
        value: proficiency.attackPenalty,
        label: `Not proficient: ${name}`,
      }),
      stacksWithinEntry: true,
    });
  }
  if (
    state.mode === 'ranged' &&
    weapon.strengthDamage === 'compositeBow' &&
    abilities.strength.modifier < (weapon.strengthRating ?? 0)
  ) {
    modifiers.push({
      ...sourced({ calculation, value: -2, label: `${name} Strength rating` }),
      stacksWithinEntry: true,
    });
  }
  return composeStatistics({
    statistics: [resolveSheet(modifiers, options)[target], breakdowns.bab],
    builtIns: [
      sourced({
        calculation,
        value: abilities[attackAbility].modifier,
        label: attackAbilityLabel(attackAbility, finesse?.source),
        sheetEntryId: `builtin:ability.${attackAbility === 'strength' ? 'str' : 'dex'}`,
      }),
    ],
    includes: () => true,
    name: 'attack',
  });
}

function resolveAttackDamageStrength(calculation: AttackCalculation) {
  const strength = calculation.abilities.strength.modifier;
  const { weapon, item } = calculation.equippedWeapon;
  // CRB p. 58, PU p. 14: no off-hand attack for a monk striking unarmed.
  if (
    isUnarmedStrike(item._id) &&
    (calculation.options.monkUnarmedStrike || calculation.flurry)
  )
    return strength;
  // CRB p. 57; #237 A2: full Strength on every core flurry attack, "with an
  // off-hand or with a weapon wielded in both hands".
  if (
    calculation.flurry?.version === 'core' &&
    calculation.entry.state.mode !== 'ranged'
  )
    return strength;
  if (calculation.naturalRole === 'secondary')
    return strengthForHand(strength, true);
  if (calculation.soleNaturalAttack && strength > 0)
    return Math.floor(strength * 1.5);
  return damageStrength({
    weapon,
    state: calculation.entry.state,
    strength,
    offHand: calculation.hand === 'off',
    usesBothEnds: calculation.usesBothEnds,
  });
}

function resolveDamageBonus(calculation: AttackCalculation): ResolvedStatistic {
  const {
    entry,
    equippedWeapon: { item, weapon },
    abilities,
    breakdowns,
    options,
  } = calculation;
  const target =
    entry.state.mode === 'melee' ? 'damage.melee' : 'damage.ranged';
  const leaf = breakdowns[target];
  const modifiers: SourcedModifier[] = [
    ...leaf.applied,
    ...leaf.suppressed,
    ...leaf.conditional,
    ...(leaf.excluded ?? []),
    {
      ...sourced({
        calculation,
        value: resolveAttackDamageStrength(calculation),
        label: 'Strength to damage',
        target,
        sheetEntryId: 'builtin:ability.str',
      }),
      stacksWithinEntry: true,
    },
  ];
  if (
    calculation.doubleSliceEntryId &&
    calculation.hand === 'off' &&
    !calculation.weaponWithoutTwoWeaponFighting &&
    !(
      isUnarmedStrike(item._id) &&
      (options.monkUnarmedStrike || calculation.flurry)
    ) &&
    abilities.strength.modifier > 0
  ) {
    const fullStrength = damageStrength({
      weapon,
      state: entry.state,
      strength: abilities.strength.modifier,
      offHand: false,
      usesBothEnds: calculation.usesBothEnds,
    });
    const halfStrength = damageStrength({
      weapon,
      state: entry.state,
      strength: abilities.strength.modifier,
      offHand: true,
    });
    if (fullStrength !== halfStrength)
      modifiers.push({
        ...sourced({
          calculation,
          value: fullStrength - halfStrength,
          label: 'Double Slice',
          target,
          sheetEntryId: calculation.doubleSliceEntryId,
        }),
        stacksWithinEntry: true,
      });
  }
  modifiers.push(...itemPartModifiers(calculation, 'damage', target));
  const powerAttack = calculation.optionEffects?.powerAttack;
  if (powerAttack && entry.state.mode === 'melee') {
    modifiers.push({
      ...sourced({
        calculation,
        value: Math.floor(
          2 *
            powerAttackSteps(breakdowns.bab.total) *
            powerAttackMultiplier(calculation),
        ),
        label: powerAttack.name,
        target,
        sheetEntryId: powerAttack.sheetEntryId,
      }),
      stacksWithinEntry: true,
    });
  }
  return resolveSheet(modifiers, options)[target];
}

/** CRB p. 127; #237 A15: every matching expander together doubles once. */
function resolveCriticalThreat(calculation: AttackCalculation) {
  const { weapon } = calculation.equippedWeapon;
  const statistic = weaponStatistic({
    calculation,
    value: weapon.threat,
    label: 'critical threat',
  });
  const weaponChoice = normalizeWeaponChoice(weapon.baseType);
  const [applied, ...others] = [
    ...(calculation.threatExpanders ?? []).filter(
      (expander) => normalizeWeaponChoice(expander.choice) === weaponChoice,
    ),
    // Keen: the attacking part's own Item Ability.
    ...(calculation.itemContributions?.threatDoublers ?? []),
  ];
  if (!applied) return statistic;
  const expansion = sourced({
    calculation,
    value: doubledThreat(weapon.threat) - weapon.threat,
    label: applied.name,
    sheetEntryId: applied.sheetEntryId,
  });
  return {
    ...statistic,
    total: statistic.total + expansion.value,
    applied: [...statistic.applied, expansion],
    suppressed: others.map((other) => ({
      ...sourced({
        calculation,
        value: expansion.value,
        label: other.name,
        sheetEntryId: other.sheetEntryId,
      }),
      reason: 'Threat-range expanders double the threat range only once.',
      suppressedBy: applied.sheetEntryId,
    })),
  };
}

function weaponStatistic({
  calculation,
  value,
  label,
}: {
  calculation: AttackCalculation;
  value: number;
  label: string;
}): ResolvedStatistic {
  return {
    total: value,
    applied: [
      sourced({
        calculation,
        value,
        label: `${calculation.equippedWeapon.name} ${label}`,
      }),
    ],
    suppressed: [],
    conditional: [],
  };
}

function resolveAttackLine(initialCalculation: AttackCalculation): AttackLine {
  const {
    entry,
    equippedWeapon: { item, weapon, name, source },
  } = initialCalculation;
  const attackKind = isUnarmedStrike(item._id)
    ? 'unarmed'
    : weapon.naturalAttack
      ? 'natural'
      : 'manufactured';
  const mode = entry.state.mode;
  const part = initialCalculation.equippedWeapon.part;
  const ammunition =
    mode === 'ranged' ? initialCalculation.ammunition : undefined;
  const lineItems = resolveWeaponLineItems({
    input: initialCalculation.input,
    weapon: { entry: item, name, part },
    ...(ammunition ? { ammunition: { ...ammunition, part: 'primary' } } : {}),
    ...(initialCalculation.shieldMaster
      ? { shieldMaster: initialCalculation.shieldMaster }
      : {}),
    multiplier: weapon.mult,
    situations: initialCalculation.options.situations,
  });
  const calculation: AttackCalculation = {
    ...initialCalculation,
    itemContributions: {
      ...lineItems,
      // Keen edge on this part or its ammunition joins keen (CRB p. 302).
      threatDoublers: [
        ...lineItems.threatDoublers,
        ...spellEffectThreatDoublers(
          initialCalculation.input,
          {
            entryId: item._id,
            part,
            ...(ammunition ? { ammunitionEntryId: ammunition.entry._id } : {}),
          },
          { permanentOnly: initialCalculation.options.permanentOnly },
        ),
      ],
    },
    options: {
      ...initialCalculation.options,
      weapon: {
        entryId: item._id,
        baseType: weapon.baseType,
        groups: weapon.groups,
        kind: attackKind,
        part,
        ...(ammunition ? { ammunitionEntryId: ammunition.entry._id } : {}),
      },
    },
  };
  const range =
    mode === 'melee'
      ? undefined
      : mode === 'thrown'
        ? isImprovisedThrow(calculation)
          ? 10
          : (weapon.thrownRangeIncrement ?? weapon.rangeIncrement)
        : weapon.rangeIncrement;
  return {
    attackKind,
    ...(isUnarmedStrike(item._id)
      ? {
          damageKind:
            calculation.unarmedLethal || calculation.options.monkUnarmedStrike
              ? ('lethalOrNonlethal' as const)
              : ('nonlethal' as const),
        }
      : {}),
    ...(calculation.naturalRole
      ? { naturalRole: calculation.naturalRole }
      : {}),
    hand: calculation.hand,
    end: calculation.end,
    weaponEntryId: item._id,
    launcherEntryId: mode === 'ranged' ? item._id : null,
    ammunitionEntryId:
      mode === 'ranged' ? (entry.state.ammunitionEntryId ?? null) : null,
    weaponName: name,
    mode,
    damageDice: weapon.dice,
    damageType: weapon.damageTypes?.join(', ') ?? '',
    damageDiceSource: {
      sheetEntryId: isUnarmedStrike(item._id)
        ? (calculation.options.monkUnarmedStrike?.sheetEntryId ?? item._id)
        : item._id,
      entryName: name,
      source,
    },
    extraDamage: calculation.itemContributions?.extraDamage ?? [],
    attackBonus: resolveAttackBonus(calculation),
    damageBonus: resolveDamageBonus(calculation),
    criticalThreat: resolveCriticalThreat(calculation),
    criticalMultiplier: weaponStatistic({
      calculation,
      value: weapon.mult,
      label: 'critical multiplier',
    }),
    rangeIncrement:
      range === undefined
        ? null
        : weaponStatistic({
            calculation,
            value: range,
            label: 'range increment',
          }),
    rangePenalty: rangePenalty(entry.state),
  };
}

function resolveIterativeAttacks({
  calculation,
  line,
}: {
  calculation: AttackCalculation;
  line: AttackLine;
}): AttackLine[] {
  if (calculation.equippedWeapon.weapon.naturalAttack) return [line];
  const count = Math.min(
    4,
    1 + Math.max(0, Math.floor((calculation.breakdowns.bab.total - 1) / 5)),
  );
  return Array.from({ length: count }, (_, index) => ({
    ...line,
    attackBonus: index
      ? composeStatistics({
          statistics: [line.attackBonus],
          builtIns: [
            sourced({
              calculation,
              value: -5 * index,
              label: `Iterative attack ${index + 1}`,
              sheetEntryId: 'builtin:bab',
            }),
          ],
          includes: () => true,
          name: 'iterative attack',
        })
      : line.attackBonus,
  }));
}

function resolveOffHandAttacks({
  calculation,
  feats,
  limited,
}: {
  calculation: AttackCalculation;
  feats: ReturnType<typeof activeFeatSelections>;
  /** One already-held or loaded attack: no extra off-hand attacks. */
  limited: boolean;
}): AttackLine[] {
  const line = resolveAttackLine(calculation);
  if (limited) return [line];
  if (calculation.weaponWithoutTwoWeaponFighting)
    return resolveIterativeAttacks({ calculation, line });
  const extras = [
    {
      identity: 'improved-two-weapon-fighting',
      penalty: -5,
      label: 'Improved Two-Weapon Fighting',
    },
    {
      identity: 'greater-two-weapon-fighting',
      penalty: -10,
      label: 'Greater Two-Weapon Fighting',
    },
  ];
  return [
    line,
    ...extras.flatMap(({ identity, penalty, label }) => {
      const feat = feats.get(identity);
      if (!feat) return [];
      return [
        {
          ...line,
          attackBonus: composeStatistics({
            statistics: [line.attackBonus],
            builtIns: [
              sourced({
                calculation,
                value: penalty,
                label,
                sheetEntryId: feat._id,
              }),
            ],
            includes: () => true,
            name: 'off-hand attack',
          }),
        },
      ];
    }),
  ];
}

type RoutineCalculationContext = Pick<
  AttackCalculation,
  | 'abilities'
  | 'breakdowns'
  | 'options'
  | 'optionEffects'
  | 'weaponFinesse'
  | 'shieldPenalties'
  | 'threatExpanders'
  | 'shieldMaster'
  | 'ammunition'
  | 'input'
>;

function listPossessedNaturalWeapons(input: CharacterSheetInput) {
  return input.entries.flatMap((item) => {
    if (item.kind !== 'item' || !item.active) return [];
    const catalog = input.catalogEntries.find(
      (candidate) => candidate._id === item.catalogEntryId,
    );
    const weapon =
      catalog?.detail?.kind === 'item' ? catalog.detail.weapon : undefined;
    return weapon?.naturalAttack
      ? [{ item, weapon, natural: weapon.naturalAttack }]
      : [];
  });
}

function resolveNaturalFacts(weapon: WeaponDetail, input: CharacterSheetInput) {
  if (!weapon.naturalAttack) return {};
  const possessed = listPossessedNaturalWeapons(input);
  const soleNaturalAttack = possessed.length === 1;
  const onlyType = new Set(possessed.map((row) => row.natural.type)).size === 1;
  return {
    soleNaturalAttack,
    naturalRole:
      weapon.naturalAttack.role ??
      (soleNaturalAttack || onlyType
        ? 'primary'
        : naturalAttackProfiles[weapon.naturalAttack.type].role),
  };
}

function resolveOffHandWeapon({
  entry,
  mainWeapon,
  input,
  recordedEntries,
  options,
}: {
  entry: RoutineEntry;
  mainWeapon: ReturnType<typeof resolveRoutineWeapon>;
  input: CharacterSheetInput;
  recordedEntries: readonly SheetEntry[];
  options: ResolveOptions;
}):
  | { kind: 'none'; warnings: SheetWarning[] }
  | { kind: 'unavailable'; warnings: SheetWarning[] }
  | {
      kind: 'available';
      entry: RoutineEntry;
      weapon: AvailableWeapon;
      usesBothEnds: boolean;
    } {
  const state = entry.state;
  const offState = state.offHand;
  if (!offState) return { kind: 'none', warnings: [] };
  const usesBothEnds = offState.kind === 'otherEnd';
  const secondEnd =
    mainWeapon.kind === 'available' ? mainWeapon.weapon.otherEnd : undefined;
  const invalidOffHand = usesBothEnds
    ? mainWeapon.kind === 'available' && !secondEnd
    : !isUnarmedStrike(offState.weaponEntryId) &&
      offState.weaponEntryId === state.weaponEntryId;
  if (invalidOffHand)
    return {
      kind: 'unavailable',
      warnings: [
        routineWarning({
          entry,
          check: 'invalidAttackOffHand',
          facts: [offState, state.weaponEntryId],
          message: usesBothEnds
            ? `${mainWeapon.kind === 'available' ? mainWeapon.name : state.name} has no recorded second end. Choose an off-hand weapon or record the weapon's other end.`
            : 'The same Gear weapon cannot fill both hands. Choose a separate weapon or the other end of a double weapon.',
        }),
      ],
    };
  const offEntry: RoutineEntry = {
    ...entry,
    state: {
      ...state,
      weaponEntryId:
        offState.kind === 'otherEnd'
          ? state.weaponEntryId
          : offState.weaponEntryId,
      hands: usesBothEnds ? state.hands : 'one',
      mode: offState.mode,
    },
  };
  const offWeapon: ReturnType<typeof resolveRoutineWeapon> =
    usesBothEnds && secondEnd && mainWeapon.kind === 'available'
      ? {
          ...mainWeapon,
          part: 'otherEnd',
          weapon: {
            ...mainWeapon.weapon,
            ...secondEnd,
            damageTypes: secondEnd.damageTypes ?? mainWeapon.weapon.damageTypes,
          },
        }
      : resolveRoutineWeapon({
          entry: offEntry,
          input,
          recordedEntries,
          hand: 'off',
          options,
        });
  if (offWeapon.kind === 'unavailable')
    return { kind: 'unavailable', warnings: [offWeapon.warning] };
  if (offWeapon.weapon.naturalAttack) {
    return {
      kind: 'unavailable',
      warnings: [
        routineWarning({
          entry,
          check: 'invalidAttackOffHand',
          facts: [state.weaponEntryId, offState],
          message:
            'Natural attacks belong in the natural attack choices, rather than either hand of two-weapon fighting. The off-hand attacks are skipped.',
        }),
      ],
    };
  }
  return {
    kind: 'available',
    entry: offEntry,
    weapon: offWeapon,
    usesBothEnds,
  };
}

function offHandConfigurationWarnings(entry: RoutineEntry) {
  const { offHand, hands, mode } = entry.state;
  if (!offHand) return [];
  const usesBothEnds = offHand.kind === 'otherEnd';
  if (
    (!usesBothEnds && hands !== 'two') ||
    (usesBothEnds && hands === 'two' && offHand.mode === mode)
  )
    return [];
  return [
    routineWarning({
      entry,
      check: 'unsuitableAttackOffHand',
      facts: [hands, mode, offHand, usesBothEnds],
      message: usesBothEnds
        ? 'Using both ends of a double weapon normally requires two hands in the same attack mode. This routine keeps your chosen configuration.'
        : 'The main weapon is held in two hands while an off-hand weapon is selected. This routine keeps both weapons.',
    }),
  ];
}

function resolveRoutineOffHand({
  entry,
  mainWeapon,
  context,
  input,
  recordedEntries,
  weaponProficiencies,
  feats,
  routineWarningFingerprints,
}: {
  entry: RoutineEntry;
  mainWeapon: ReturnType<typeof resolveRoutineWeapon>;
  context: RoutineCalculationContext;
  input: CharacterSheetInput;
  recordedEntries: readonly SheetEntry[];
  weaponProficiencies: ReturnType<typeof resolveWeaponProficiencies>['weapons'];
  feats: ReturnType<typeof activeFeatSelections>;
  routineWarningFingerprints: ReadonlyMap<string, string>;
}) {
  const resolved = resolveOffHandWeapon({
    entry,
    mainWeapon,
    input,
    recordedEntries,
    options: context.options,
  });
  if (resolved.kind !== 'available') return resolved;
  const { entry: offEntry, weapon: offWeapon, usesBothEnds } = resolved;
  const light = usesBothEnds || offWeapon.weapon.handedness === 'light';
  const weaponWithoutTwoWeaponFighting =
    mainWeapon.kind === 'available' && Boolean(mainWeapon.weapon.naturalAttack);
  const twoWeaponTable = weaponWithoutTwoWeaponFighting
    ? { main: 0, off: 0 }
    : twoWeaponPenalties({
        light,
        trained: feats.has('two-weapon-fighting'),
      });
  // CRB p. 134 and FAQ: Shield Master removes the two-weapon penalty from
  // attacks with the shield only.
  const shieldMaster = context.shieldMaster;
  const mainBash =
    shieldMaster &&
    mainWeapon.kind === 'available' &&
    mainWeapon.part === 'bash';
  const offBash = shieldMaster && offWeapon.part === 'bash';
  const penalties = {
    main: mainBash ? 0 : twoWeaponTable.main,
    off: offBash ? 0 : twoWeaponTable.off,
  };
  const offCalculation: AttackCalculation = {
    ...context,
    weaponWithoutTwoWeaponFighting,
    entry: offEntry,
    equippedWeapon: offWeapon,
    hand: weaponWithoutTwoWeaponFighting ? 'main' : 'off',
    end: usesBothEnds ? 'otherEnd' : 'primary',
    usesBothEnds,
    twoWeaponPenalty: penalties.off,
    twoWeaponFeatEntryId: feats.get('two-weapon-fighting')?._id,
    doubleSliceEntryId: feats.get('double-slice')?._id,
    preciseShot: feats.has('precise-shot'),
    // The main hand holds its own weapon.
    otherHandFree: false,
    proficiency: weaponProficiencies.find(
      (use) =>
        use.entryId === offWeapon.item._id &&
        use.hands === offEntry.state.hands,
    ),
  };
  const warnings = routineSuitabilityWarnings({
    calculation: offCalculation,
    proficiencyFingerprint: routineWarningFingerprints.get(`${entry._id}:off`),
  });
  warnings.push(...offHandConfigurationWarnings(entry));
  const signed = (value: number) => (value < 0 ? `−${-value}` : `+${value}`);
  return {
    kind: 'available' as const,
    calculation: offCalculation,
    penalties,
    summary: weaponWithoutTwoWeaponFighting
      ? null
      : `Two-weapon fighting${light ? ', light off hand' : ''}: ${signed(penalties.main)} primary, ${signed(penalties.off)} off hand${mainBash || offBash ? ` (${shieldMaster.name}: no penalty on the shield bash)` : ''}`,
    warnings,
  };
}

type NaturalSelection = { entry: RoutineEntry; weapon: AvailableWeapon };

function resolveNaturalSelections({
  entry,
  input,
  recordedEntries,
  options,
}: {
  entry: RoutineEntry;
  input: CharacterSheetInput;
  recordedEntries: readonly SheetEntry[];
  options: ResolveOptions;
}): { selections: NaturalSelection[]; warnings: SheetWarning[] } {
  const warnings: SheetWarning[] = [];
  const naturalSelections = (entry.state.naturalAttackEntryIds ?? [])
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .flatMap((id) => {
      const naturalEntry: RoutineEntry = {
        ...entry,
        state: {
          ...entry.state,
          weaponEntryId: id,
          hands: 'one',
          mode: 'melee',
        },
      };
      const resolved = resolveRoutineWeapon({
        entry: naturalEntry,
        input,
        recordedEntries,
        options,
      });
      if (resolved.kind === 'unavailable') {
        warnings.push({
          ...resolved.warning,
          subject: `${entry._id}:natural:${id}`,
          message: `Natural attack: ${resolved.warning.message}`,
        });
        return [];
      }
      if (!resolved.weapon.naturalAttack) {
        warnings.push({
          ...routineWarning({
            entry,
            check: 'invalidAttackWeapon',
            facts: [id, 'not-natural'],
            message: `${resolved.name} is not a natural attack. Its natural attack line is skipped.`,
          }),
          subject: `${entry._id}:natural:${id}`,
        });
        return [];
      }
      if (id === entry.state.weaponEntryId) {
        warnings.push({
          ...routineWarning({
            entry,
            check: 'invalidAttackWeapon',
            facts: [id, 'main-natural'],
            message: `${resolved.name} is already the main natural attack. Its additional natural attack line is skipped.`,
          }),
          subject: `${entry._id}:natural:${id}`,
        });
        return [];
      }
      return [{ entry: naturalEntry, weapon: resolved }];
    });
  return { selections: naturalSelections, warnings };
}

function resolveNaturalLines({
  selections,
  calculation,
  input,
  mixed,
}: {
  selections: readonly NaturalSelection[];
  calculation: AttackCalculation;
  input: CharacterSheetInput;
  mixed: boolean;
}): AttackLine[] {
  return selections.map(({ entry: naturalEntry, weapon: resolved }) => {
    return resolveAttackLine({
      ...calculation,
      entry: naturalEntry,
      equippedWeapon: resolved,
      ...resolveNaturalFacts(resolved.weapon, input),
      ...(mixed ? { naturalRole: 'secondary', soleNaturalAttack: false } : {}),
      twoWeaponPenalty: undefined,
      doubleSliceEntryId: undefined,
    });
  });
}

function heldWeaponLimbs({
  weapon,
  hands,
  usesBothEnds = false,
}: {
  weapon: AvailableWeapon;
  hands: AttackRoutineState['hands'];
  usesBothEnds?: boolean;
}) {
  if (weapon.weapon.naturalAttack || isUnarmedStrike(weapon.item._id)) return 0;
  if (
    usesBothEnds ||
    hands === 'two' ||
    weapon.weapon.handedness === 'twoHanded'
  )
    return 2;
  return 1;
}

function resolveNaturalLimbWarnings({
  entry,
  equippedWeapon,
  naturalWeapons,
  offCalculation,
}: {
  entry: RoutineEntry;
  equippedWeapon: AvailableWeapon;
  naturalWeapons: readonly AvailableWeapon[];
  offCalculation?: AttackCalculation;
}): SheetWarning[] {
  const state = entry.state;
  const limbAttacks = [equippedWeapon, ...naturalWeapons].filter(
    ({ weapon }) =>
      weapon.naturalAttack &&
      naturalAttackProfiles[weapon.naturalAttack.type].needsFreeLimb,
  ).length;
  const heldLimbs =
    heldWeaponLimbs({
      weapon: equippedWeapon,
      hands: state.hands,
      usesBothEnds: offCalculation?.usesBothEnds,
    }) +
    (offCalculation && !offCalculation.usesBothEnds
      ? heldWeaponLimbs({
          weapon: offCalculation.equippedWeapon,
          hands: offCalculation.entry.state.hands,
        })
      : 0);
  const freeLimbs = Math.max(0, (state.availableLimbs ?? 2) - heldLimbs);
  if (limbAttacks <= freeLimbs) return [];
  const limbNames = Object.values(naturalAttackProfiles)
    .filter((profile) => profile.needsFreeLimb)
    .map((profile) => profile.name.toLowerCase());
  const limbDescription = `${limbNames.slice(0, -1).join(', ')} or ${limbNames.at(-1)}`;
  return [
    routineWarning({
      entry,
      check: 'attackLimbs',
      facts: [
        state.weaponEntryId,
        state.hands,
        state.offHand,
        state.availableLimbs ?? 2,
        naturalWeapons.map((available) => [
          available.item._id,
          available.weapon.naturalAttack?.type,
        ]),
        limbAttacks,
        freeLimbs,
      ],
      message: `${limbAttacks} ${limbDescription} attacks need free limbs, but only ${freeLimbs} are available after holding weapons. The attacks remain in this routine.`,
    }),
  ];
}

function extraAttackLine(
  line: AttackLine,
  kind: NonNullable<AttackLine['extraAttack']>['kind'],
  source: RoutineOptionSource,
): AttackLine {
  return { ...line, extraAttack: { kind, ...source } };
}

/** CRB p. 132: −2 on every attack of a full attack using Rapid Shot. */
function applyRapidShotPenalty(
  line: AttackLine,
  rapidShot: RoutineOptionSource,
): AttackLine {
  return {
    ...line,
    attackBonus: composeStatistics({
      statistics: [line.attackBonus],
      builtIns: [
        {
          ...builtIn({
            target: line.mode === 'melee' ? 'attack.melee' : 'attack.ranged',
            id: 'rapid-shot',
            name: rapidShot.name,
            value: -2,
            sheetEntryId: rapidShot.sheetEntryId,
          }),
          stacksWithinEntry: true,
        },
      ],
      includes: () => true,
      name: 'Rapid Shot',
    }),
  };
}

/** CRB p. 136: the extra dice are rolled with the attack, never multiplied. */
function applyVitalStrike(
  line: AttackLine,
  vitalStrike: NonNullable<RoutineOptionEffects['vitalStrike']>,
): AttackLine {
  return {
    ...line,
    damageDice: multiplyDamageDice(line.damageDice, vitalStrike.multiplier),
    vitalStrike: {
      multiplier: vitalStrike.multiplier,
      weaponDice: line.damageDice,
      sheetEntryId: vitalStrike.sheetEntryId,
      name: vitalStrike.name,
    },
  };
}

function isBow(weapon: WeaponDetail) {
  return (
    weapon.strengthDamage === 'bow' || weapon.strengthDamage === 'compositeBow'
  );
}

/**
 * CRB p. 136: one Rend line after a two-weapon full attack: 1d10 plus 1½
 * Strength. A Strength penalty applies in full, as elsewhere here.
 */
function resolveTwoWeaponRend({
  rend,
  strength,
  target,
}: {
  rend: RoutineOptionSource;
  strength: number;
  target: 'damage.melee' | 'damage.ranged';
}): TwoWeaponRend {
  const value = strength > 0 ? Math.floor(strength * 1.5) : strength;
  return {
    ...rend,
    damageDice: '1d10',
    damageBonus: composeStatistics({
      statistics: [],
      builtIns: [
        builtIn({
          target,
          id: 'two-weapon-rend-strength',
          name: 'Strength (1½)',
          value,
          sheetEntryId: 'builtin:ability.str',
        }),
      ],
      includes: () => true,
      name: 'Two-Weapon Rend',
    }),
  };
}

/**
 * What one option rule does to a full attack: the lines it adds (or, for a
 * rule that marks lines, the marked full attack), its notes and the
 * switched-on options it leaves without effect.
 */
type OptionOutcome = {
  lines: AttackLine[];
  notes: string[];
  inapplicable: string[];
};

function optionLines(lines: AttackLine[] = []): OptionOutcome {
  return { lines, notes: [], inapplicable: [] };
}

function inapplicableOption(identity: string, note: string): OptionOutcome {
  return { lines: [], notes: [note], inapplicable: [identity] };
}

/** CRB p. 293: one main-hand attack at the highest bonus. */
function resolveHasteExtra({
  haste,
  fullLine,
  limited,
}: {
  haste: RoutineOptionSource | undefined;
  fullLine: AttackLine;
  limited: boolean;
}) {
  return haste && !limited
    ? optionLines([extraAttackLine(fullLine, 'haste', haste)])
    : optionLines();
}

/** CRB p. 132: one more ranged shot at the highest bonus. */
function resolveRapidShotExtra({
  rapidShot,
  fullLine,
  limited,
}: {
  rapidShot: RoutineOptionSource | undefined;
  fullLine: AttackLine;
  limited: boolean;
}) {
  if (!rapidShot) return optionLines();
  if (fullLine.mode === 'melee')
    return inapplicableOption(
      'rapid-shot',
      `${rapidShot.name} needs a ranged or thrown main weapon. It has no effect in this routine.`,
    );
  if (limited)
    return inapplicableOption(
      'rapid-shot',
      `${rapidShot.name} needs a weapon that can fire again this round. It has no effect in this routine.`,
    );
  return optionLines([extraAttackLine(fullLine, 'rapidShot', rapidShot)]);
}

/**
 * CRB p. 130: two more unarmed strikes at your highest base attack bonus,
 * resolved like the main hand's first attack.
 */
function resolveMedusasWrathExtras({
  medusasWrath,
  unarmedStrike,
}: {
  medusasWrath: RoutineOptionSource | undefined;
  /** The routine's unarmed strike at the main hand's highest bonus. */
  unarmedStrike: AttackLine | undefined;
}) {
  if (!medusasWrath) return optionLines();
  if (!unarmedStrike)
    return inapplicableOption(
      'medusas-wrath',
      `${medusasWrath.name} needs an unarmed strike in this routine. It has no effect here.`,
    );
  const extra = extraAttackLine(unarmedStrike, 'medusasWrath', medusasWrath);
  return optionLines([extra, extra]);
}

/**
 * The unarmed strike Medusa's Wrath repeats: the main hand's own, or the
 * off hand's made as a primary-hand attack, with the primary two-weapon
 * penalty and full Strength rather than the off hand's.
 */
function resolveHighestUnarmedStrike({
  fullLine,
  offCalculation,
  mainPenalty,
}: {
  fullLine: AttackLine;
  offCalculation: AttackCalculation | undefined;
  mainPenalty: number;
}) {
  if (fullLine.attackKind === 'unarmed') return fullLine;
  if (
    !offCalculation ||
    !isUnarmedStrike(offCalculation.equippedWeapon.item._id)
  )
    return undefined;
  return resolveAttackLine({
    ...offCalculation,
    hand: 'main',
    twoWeaponPenalty: mainPenalty,
  });
}

/** CRB p. 130: a bow's first full-attack shot fires two arrows. */
function applyManyshot({
  manyshot,
  calculation,
  full,
}: {
  manyshot: RoutineOptionSource | undefined;
  calculation: AttackCalculation;
  full: AttackLine[];
}): OptionOutcome {
  const [first, ...rest] = full;
  if (!manyshot) return optionLines(full);
  if (
    calculation.entry.state.mode !== 'ranged' ||
    !isBow(calculation.equippedWeapon.weapon) ||
    !first
  )
    return {
      ...inapplicableOption(
        'manyshot',
        `${manyshot.name} needs a bow. It has no effect in this routine.`,
      ),
      lines: full,
    };
  return {
    lines: [{ ...first, projectiles: 2 }, ...rest],
    notes: [
      `${manyshot.name}: the first attack fires two arrows. Precision damage and critical damage apply once.`,
    ],
    inapplicable: [],
  };
}

function mergeOptionOutcomes(outcomes: readonly OptionOutcome[]) {
  return {
    notes: outcomes.flatMap((outcome) => outcome.notes),
    inapplicable: outcomes.flatMap((outcome) => outcome.inapplicable),
  };
}

/**
 * Assembles the full attack: main-hand BAB iteratives with the
 * highest-bonus extras (haste, Rapid Shot, Medusa's Wrath) after the first
 * attack, the off-hand chain, then natural attacks. Rapid Shot's −2 then
 * applies to every line, and Manyshot marks the first.
 */
function assembleFullAttack({
  calculation,
  fullLine,
  limited,
  offLines,
  naturalLines,
  haste,
  unarmedStrike,
}: {
  calculation: AttackCalculation;
  fullLine: AttackLine;
  limited: boolean;
  offLines: AttackLine[];
  naturalLines: AttackLine[];
  haste: RoutineOptionSource | undefined;
  unarmedStrike: AttackLine | undefined;
}): OptionOutcome {
  const effects = calculation.optionEffects ?? {};
  const [first, ...iteratives] = limited
    ? [fullLine]
    : resolveIterativeAttacks({ calculation, line: fullLine });
  const rapidShot = resolveRapidShotExtra({
    rapidShot: effects.rapidShot,
    fullLine,
    limited,
  });
  const extras = [
    resolveHasteExtra({ haste, fullLine, limited }),
    rapidShot,
    resolveMedusasWrathExtras({
      medusasWrath: effects.medusasWrath,
      unarmedStrike,
    }),
  ];
  const lines = [
    ...(first ? [first] : []),
    ...extras.flatMap((extra) => extra.lines),
    ...iteratives,
    ...offLines,
    ...naturalLines,
  ];
  const rapidShotPenalty =
    rapidShot.lines.length > 0 ? effects.rapidShot : undefined;
  const manyshot = applyManyshot({
    manyshot: effects.manyshot,
    calculation,
    full: rapidShotPenalty
      ? lines.map((line) => applyRapidShotPenalty(line, rapidShotPenalty))
      : lines,
  });
  return {
    lines: manyshot.lines,
    ...mergeOptionOutcomes([...extras, manyshot]),
  };
}

type FlurryContext = {
  flurry: ResolvedFlurry;
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
  lineFacts: NonNullable<AttackCalculation['flurry']>;
};

/**
 * The switched-on flurry's own monk levels, base attack bonus and line
 * facts. CRB p. 57; #237 A5: a natural main weapon can't flurry. FAQ o72: a
 * core flurry's Power Attack and Combat Expertise use the flurry base attack
 * bonus; Combat Expertise's steps are data, so its extra steps join each
 * melee line here, and its dodge bonus to AC follows the flurry's steps.
 */
function resolveFlurryContext({
  effects,
  input,
  calculation,
}: {
  effects: RoutineOptionEffects;
  input: CharacterSheetInput;
  calculation: AttackCalculation;
}): FlurryContext | null {
  const effect = effects.flurry;
  if (!effect || calculation.equippedWeapon.weapon.naturalAttack) return null;
  const { breakdowns } = calculation;
  const { version, classIdentity } = flurryRule(effect.identity);
  const monkLevel = countClassLevels(input, classIdentity);
  const baseAttackBonus = resolveFlurryBaseAttack({
    bab: breakdowns.bab,
    version,
    // The sheet's monk class, a Foundry or #716 one included (#741).
    classIdentity: sheetClassIdentity(input, classIdentity),
    monkLevel,
    name: effect.name,
  });
  const facts: FlurryLineFacts = {
    version,
    sheetEntryId: effect.sheetEntryId,
    name: effect.name,
    attackPenalty: flurryAttackPenalty(version),
  };
  const combatExpertise =
    calculation.entry.state.mode === 'melee'
      ? effects.combatExpertise
      : undefined;
  const flurrySteps = powerAttackSteps(baseAttackBonus.total);
  const extraSteps = flurrySteps - powerAttackSteps(breakdowns.bab.total);
  return {
    flurry: {
      ...facts,
      monkLevel,
      baseAttackBonus,
      extraAttacks: flurryExtraAttacks(version, monkLevel),
      combatExpertise: combatExpertise
        ? { ...combatExpertise, dodgeBonus: flurrySteps }
        : null,
    },
    breakdowns: { ...breakdowns, bab: baseAttackBonus },
    lineFacts: {
      ...facts,
      ...(combatExpertise && extraSteps
        ? { combatExpertise: { ...combatExpertise, value: -extraSteps } }
        : {}),
    },
  };
}

function describeFlurry({ flurry }: FlurryContext) {
  const extras = `${flurry.extraAttacks} extra attack${flurry.extraAttacks === 1 ? '' : 's'}`;
  const summary =
    flurry.version === 'core'
      ? `${flurry.name}: base attack bonus ${signedNumber(flurry.baseAttackBonus.total)} with monk level ${flurry.monkLevel}, ${extras}, −2 on every attack.`
      : `${flurry.name}: ${extras} at the highest base attack bonus.`;
  const combatExpertise = flurry.combatExpertise;
  if (!combatExpertise) return [summary];
  return [
    summary,
    `${combatExpertise.name}: ${signedNumber(combatExpertise.dodgeBonus)} dodge bonus to AC while flurrying, from the flurry's base attack bonus.`,
  ];
}

/**
 * CRB p. 57: a core flurry's extra attacks sit where Two-Weapon Fighting
 * and its Improved and Greater feats put them, at the highest bonus, −5 and
 * −10. PU p. 14: the Unchained flurry's are all at the highest bonus. Each
 * is made with the off-hand weapon when the routine has one (#237).
 */
function resolveFlurryExtras({
  context,
  calculation,
  line,
  count,
}: {
  context: FlurryContext;
  calculation: AttackCalculation;
  line: AttackLine;
  count: number;
}) {
  const { flurry } = context;
  const source = { sheetEntryId: flurry.sheetEntryId, name: flurry.name };
  return Array.from({ length: count }, (_, index) => {
    const step = flurry.version === 'core' ? index : 0;
    const extra = step
      ? {
          ...line,
          attackBonus: composeStatistics({
            statistics: [line.attackBonus],
            builtIns: [
              {
                ...sourced({
                  calculation,
                  value: -5 * step,
                  label: `${flurry.name} extra attack ${index + 1}`,
                  sheetEntryId: flurry.sheetEntryId,
                }),
                stacksWithinEntry: true,
              },
            ],
            includes: () => true,
            name: 'flurry attack',
          }),
        }
      : line;
    return { step, line: extraAttackLine(extra, 'flurry', source) };
  });
}

/** Whether each hand is reload- or draw-limited, and the routine's haste. */
type FullAttackRates = {
  limited: boolean;
  offLimited: boolean;
  haste: RoutineOptionSource | undefined;
  /** Speed on the off-hand weapon or end only, when nothing else hastes. */
  offHaste?: RoutineOptionSource;
};

/** The flurry's main and off-hand calculations and the rates they attack at. */
type FlurryAttack = {
  context: FlurryContext;
  calculation: AttackCalculation;
  offCalculation: AttackCalculation | undefined;
  rates: FullAttackRates;
};

/**
 * A limited main hand makes one attack and no extras; with an off-hand
 * weapon, a limited off hand makes one extra.
 */
function countFlurryExtras({ context, offCalculation, rates }: FlurryAttack) {
  if (offCalculation) return rates.offLimited ? 1 : context.flurry.extraAttacks;
  return rates.limited ? 0 : context.flurry.extraAttacks;
}

/**
 * Without an off-hand weapon, the extras follow the iterative at their
 * bonus, as Table: Monk prints them; with one, they follow the main hand,
 * laid out as two-weapon fighting. Haste and Medusa's Wrath follow the first.
 */
function orderFlurryLines({
  mainChain,
  extras,
  highestLines,
  hasOffHand,
}: {
  mainChain: AttackLine[];
  extras: ReturnType<typeof resolveFlurryExtras>;
  highestLines: AttackLine[];
  hasOffHand: boolean;
}) {
  if (hasOffHand)
    return [
      ...mainChain.slice(0, 1),
      ...highestLines,
      ...mainChain.slice(1),
      ...extras.map((extra) => extra.line),
    ];
  const steps = Math.max(
    mainChain.length,
    ...extras.map((extra) => extra.step + 1),
  );
  return Array.from({ length: steps }, (_, step) => [
    ...mainChain.slice(step, step + 1),
    ...extras.filter((extra) => extra.step === step).map((extra) => extra.line),
    ...(step === 0 ? highestLines : []),
  ]).flat();
}

/**
 * The flurry's full attack (CRB p. 57; PU p. 14): the main weapon's
 * iteratives from the flurry's base attack bonus, its extra attacks, and
 * haste (or an off-hand weapon's speed) and Medusa's Wrath at the highest
 * bonus (FAQ qk0). Two-weapon
 * penalties and the two-weapon chain add nothing, and natural attacks stay
 * out.
 */
function assembleFlurryAttack(
  attack: FlurryAttack & { mainLine: AttackLine },
): OptionOutcome {
  const { context, calculation, offCalculation, rates, mainLine } = attack;
  const effects = calculation.optionEffects ?? {};
  const mainChain = rates.limited
    ? [mainLine]
    : resolveIterativeAttacks({ calculation, line: mainLine });
  const extras = resolveFlurryExtras({
    context,
    calculation: offCalculation ?? calculation,
    line: offCalculation ? resolveAttackLine(offCalculation) : mainLine,
    count: countFlurryExtras(attack),
  });
  // Speed on the off-hand weapon or end alone (#764): its one extra attack
  // is with that weapon, at its highest flurry bonus.
  const offHaste =
    offCalculation && rates.offHaste
      ? resolveHasteExtra({
          haste: rates.offHaste,
          fullLine: resolveAttackLine(offCalculation),
          limited: rates.offLimited,
        })
      : optionLines();
  const highest = [
    resolveHasteExtra({
      haste: rates.haste,
      fullLine: mainLine,
      limited: rates.limited,
    }),
    offHaste,
    resolveMedusasWrathExtras({
      medusasWrath: effects.medusasWrath,
      unarmedStrike: effects.medusasWrath
        ? resolveHighestUnarmedStrike({
            fullLine: mainLine,
            offCalculation,
            mainPenalty: 0,
          })
        : undefined,
    }),
  ];
  const lines = orderFlurryLines({
    mainChain,
    extras,
    highestLines: highest.flatMap((outcome) => outcome.lines),
    hasOffHand: offCalculation !== undefined,
  });
  const rapidShot = effects.rapidShot
    ? inapplicableOption(
        'rapid-shot',
        `${effects.rapidShot.name} isn't calculated with a flurry of blows. It has no effect in this routine.`,
      )
    : optionLines();
  const manyshot = applyManyshot({
    manyshot: effects.manyshot,
    calculation,
    full: lines,
  });
  const merged = mergeOptionOutcomes([...highest, rapidShot, manyshot]);
  return {
    lines: manyshot.lines,
    notes: [...describeFlurry(context), ...merged.notes],
    inapplicable: merged.inapplicable,
  };
}

/**
 * CRB p. 57; #237 A5; owner (#414): incompatible choices stay with
 * warnings and keep their lines: natural attacks, weapons without the monk
 * quality, and worn armor or shields. The sheet tracks no load.
 */
function resolveFlurryWarnings({
  entry,
  input,
  effects,
  equippedWeapon,
  offCalculation,
  flurry,
}: {
  entry: RoutineEntry;
  input: CharacterSheetInput;
  effects: RoutineOptionEffects;
  equippedWeapon: AvailableWeapon;
  offCalculation: AttackCalculation | undefined;
  flurry: FlurryContext | null;
}): SheetWarning[] {
  if (!effects.flurry) return [];
  const routine = { routineEntryId: entry._id, routineName: entry.state.name };
  const naturalEntryIds = [
    ...(equippedWeapon.weapon.naturalAttack ? [entry.state.weaponEntryId] : []),
    ...(entry.state.naturalAttackEntryIds ?? []),
  ];
  const warnings = naturalEntryIds.length
    ? [flurryNaturalAttackWarning({ ...routine, naturalEntryIds })]
    : [];
  if (!flurry) return warnings;
  const nonMonkWeapons = [
    equippedWeapon,
    ...(offCalculation && !offCalculation.usesBothEnds
      ? [offCalculation.equippedWeapon]
      : []),
  ].flatMap((weapon) =>
    isFlurryWeapon(weapon.weapon, isUnarmedStrike(weapon.item._id))
      ? []
      : [{ entryId: weapon.item._id, name: weapon.name }],
  );
  if (nonMonkWeapons.length)
    warnings.push(flurryWeaponWarning({ ...routine, weapons: nonMonkWeapons }));
  const armor = listFlurryArmor(input);
  if (armor.length)
    warnings.push(flurryArmorWarning({ ...routine, items: armor }));
  return warnings;
}

/** CRB p. 57: a switched-on flurry a natural main weapon leaves without effect. */
function describeNaturalFlurry(
  effects: RoutineOptionEffects,
  flurry: FlurryContext | null,
): OptionOutcome {
  if (!effects.flurry || flurry) return optionLines();
  return inapplicableOption(
    effects.flurry.identity,
    `${effects.flurry.name} can't use a natural attack. It has no effect in this routine.`,
  );
}

/**
 * The flurry's full attack from its main and off-hand calculations: the
 * flurry's base attack bonus and penalty, no Table 8–7 penalties (#237 A3,
 * A4), and Double Slice only on the Unchained flurry's off hand (owner,
 * #414).
 */
function resolveRoutineFlurry({
  context,
  calculation,
  offCalculation,
  rates,
}: FlurryAttack): OptionOutcome {
  const usesBothEnds = offCalculation?.usesBothEnds;
  const mainCalculation: AttackCalculation = {
    ...calculation,
    breakdowns: context.breakdowns,
    flurry: context.lineFacts,
    ...(usesBothEnds === undefined ? {} : { usesBothEnds }),
  };
  const flurryOff: AttackCalculation | undefined = offCalculation && {
    ...offCalculation,
    breakdowns: context.breakdowns,
    flurry: context.lineFacts,
    twoWeaponPenalty: undefined,
    twoWeaponFeatEntryId: undefined,
    doubleSliceEntryId:
      context.flurry.version === 'core'
        ? undefined
        : offCalculation.doubleSliceEntryId,
  };
  return assembleFlurryAttack({
    context,
    calculation: mainCalculation,
    offCalculation: flurryOff,
    rates,
    mainLine: resolveAttackLine(mainCalculation),
  });
}

/** Speed on the off-hand weapon or end: one extra attack with it at its best. */
function withOffHandHaste(
  lines: AttackLine[],
  haste: RoutineOptionSource | undefined,
) {
  const [first, ...rest] = lines;
  return first && haste
    ? [first, extraAttackLine(first, 'haste', haste), ...rest]
    : lines;
}

/**
 * The ordinary full attack: the main hand's chain with its two-weapon
 * penalty, the off-hand chain and the natural attacks.
 */
function resolveOrdinaryFullAttack({
  calculation,
  fullLine,
  offCalculation,
  mainPenalty,
  feats,
  naturalLines,
  rates,
}: {
  calculation: AttackCalculation;
  fullLine: AttackLine;
  offCalculation: AttackCalculation | undefined;
  /** The main hand's two-weapon penalty, for Medusa's Wrath's strikes. */
  mainPenalty: number;
  feats: ReturnType<typeof activeFeatSelections>;
  naturalLines: AttackLine[];
  rates: FullAttackRates;
}): OptionOutcome {
  return assembleFullAttack({
    calculation,
    fullLine,
    limited: rates.limited,
    offLines: offCalculation
      ? withOffHandHaste(
          resolveOffHandAttacks({
            calculation: offCalculation,
            feats,
            limited: rates.offLimited,
          }),
          rates.offLimited ? undefined : rates.offHaste,
        )
      : [],
    naturalLines,
    haste: rates.haste,
    unarmedStrike: calculation.optionEffects?.medusasWrath
      ? resolveHighestUnarmedStrike({ fullLine, offCalculation, mainPenalty })
      : undefined,
  });
}

/**
 * CRB p. 136: Two-Weapon Rend after a two-weapon full attack. #237 A3: not
 * in a core flurry; owner (#414): the Unchained flurry's off hand keeps it.
 */
function resolveRoutineRend({
  rend,
  offCalculation,
  flurry,
  strength,
  mode,
}: {
  rend: RoutineOptionSource | undefined;
  offCalculation: AttackCalculation | undefined;
  flurry: FlurryContext | null;
  strength: number;
  mode: AttackRoutineState['mode'];
}) {
  if (!rend || !offCalculation || offCalculation.weaponWithoutTwoWeaponFighting)
    return null;
  if (flurry?.flurry.version === 'core') return null;
  return resolveTwoWeaponRend({
    rend,
    strength,
    target: mode === 'melee' ? 'damage.melee' : 'damage.ranged',
  });
}

/** CRB p. 131: Power Attack changes melee attacks only. */
function describePowerAttackReach(
  powerAttack: RoutineOptionSource | undefined,
  melee: boolean,
) {
  return powerAttack && !melee
    ? inapplicableOption(
        'power-attack',
        `${powerAttack.name} applies to melee attacks only. It has no effect in this routine.`,
      )
    : optionLines();
}

/** CRB p. 130: Lunge's reach is noted on the routine. */
function describeLungeReach(
  lunge: RoutineOptionSource | undefined,
  melee: boolean,
): OptionOutcome {
  if (!lunge) return optionLines();
  if (!melee)
    return inapplicableOption(
      'lunge',
      `${lunge.name} applies to melee attacks only. It has no effect in this routine.`,
    );
  return {
    lines: [],
    notes: [
      `${lunge.name}: +5 ft. reach for melee attacks until the end of your turn.`,
    ],
    inapplicable: [],
  };
}

/** Notes for the switched-on options whose effect lies outside the lines. */
function describeOptionReach(
  effects: RoutineOptionEffects,
  lines: readonly AttackLine[],
) {
  const melee = lines.some((line) => line.mode === 'melee');
  return mergeOptionOutcomes([
    describePowerAttackReach(effects.powerAttack, melee),
    describeLungeReach(effects.lunge, melee),
  ]);
}

/** CRB pp. 141–145, 179, 182, 202: manufactured attacks and two-weapon chains. */
export function resolveAttackRoutines({
  input,
  recordedEntries = input.entries,
  abilities,
  breakdowns,
  weaponProficiencies,
  routineWarningFingerprints = new Map(),
  shieldPenalties = [],
  options = {},
  grantedMultiattackEntryId,
}: {
  input: CharacterSheetInput;
  recordedEntries?: readonly SheetEntry[];
  abilities: Record<Ability, { score: number; modifier: number }>;
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
  weaponProficiencies: ReturnType<typeof resolveWeaponProficiencies>['weapons'];
  routineWarningFingerprints?: ReadonlyMap<string, string>;
  /**
   * Carried shields' armor check penalties (negative) that Weapon Finesse
   * adds; a nonproficient shield's is already on every attack roll.
   */
  shieldPenalties?: readonly { entryId: string; name: string; value: number }[];
  options?: ResolveOptions;
  /** A companion rule's bonus Multiattack, such as an eidolon's (APG). */
  grantedMultiattackEntryId?: string;
}): ResolvedAttackRoutine[] {
  const featRows = activeFeats(input);
  const feats = activeFeatSelections(featRows);
  const featSource = (identity: string): RoutineOptionSource | undefined => {
    const row = featRows.find((feat) => feat.identity === identity);
    return row ? { sheetEntryId: row.entry._id, name: row.name } : undefined;
  };
  const rateRules: AttackRateRules = {
    quickDraw: feats.has('quick-draw'),
    rapidReload: rapidReloadCrossbows(featRows),
  };
  const haste = findHasteSource(
    input,
    (entry, definition) =>
      options.permanentOnly === true &&
      isTemporaryEffect(entry, definition.detail),
  );
  const rend = featSource('two-weapon-rend');
  const sharedContext = {
    input,
    shieldMaster: featSource('shield-master'),
    weaponFinesse: featSource('weapon-finesse'),
    shieldPenalties,
    threatExpanders: featRows.flatMap(({ identity, name, entry }) =>
      identity === 'improved-critical' && typeof entry.state.choice === 'string'
        ? [{ sheetEntryId: entry._id, name, choice: entry.state.choice }]
        : [],
    ),
  };
  return input.entries.flatMap((entry): ResolvedAttackRoutine[] => {
    if (entry.kind !== 'attackRoutine' || !entry.active) return [];
    const state = entry.state;
    const choices = resolveRoutineOptionChoices({
      routine: entry,
      input,
      recordedEntries,
      hasUnarmedStrike:
        isUnarmedStrike(state.weaponEntryId) ||
        (state.offHand?.kind === 'weapon' &&
          isUnarmedStrike(state.offHand.weaponEntryId)),
    });
    const routineOptions: ResolveOptions = {
      ...options,
      routineOptions: choices.routineOptions,
    };
    const routineWarnings = [
      ...routineRangeWarnings(entry),
      ...routineAmmunitionWarnings(entry, input, recordedEntries),
      ...choices.warnings,
    ];
    const routine: ResolvedAttackRoutine = {
      entryId: entry._id,
      name: state.name,
      weaponEntryId: state.weaponEntryId,
      hands: state.hands,
      mode: state.mode,
      ...(state.offHand ? { offHand: state.offHand } : {}),
      ...(state.ammunitionEntryId
        ? { ammunitionEntryId: state.ammunitionEntryId }
        : {}),
      ...(state.rangeIncrements !== undefined
        ? { rangeIncrements: state.rangeIncrements }
        : {}),
      twoWeaponPenaltySummary: null,
      attackRateNotes: [],
      options: choices.views,
      optionNotes: [],
      twoWeaponRend: null,
      flurry: null,
      single: [],
      full: [],
      warnings: [],
    };
    const equippedWeapon = resolveRoutineWeapon({
      entry,
      input,
      recordedEntries,
      options: routineOptions,
    });
    const ammunition = routineAmmunition(entry, input);
    const context: RoutineCalculationContext = {
      ...sharedContext,
      ...(ammunition ? { ammunition } : {}),
      abilities,
      breakdowns,
      options: routineOptions,
      optionEffects: choices.effects,
    };
    const offHand = resolveRoutineOffHand({
      entry,
      mainWeapon: equippedWeapon,
      context,
      input,
      recordedEntries,
      weaponProficiencies,
      feats,
      routineWarningFingerprints,
    });
    const offWarnings = offHand.warnings.map((warning) => ({
      ...warning,
      subject: `${entry._id}:off`,
      fingerprint: JSON.stringify(['off', warning.fingerprint]),
      message: `Off hand: ${warning.message}`,
    }));
    const { selections: naturalSelections, warnings: naturalWarnings } =
      resolveNaturalSelections({
        entry,
        input,
        recordedEntries,
        options: routineOptions,
      });
    if (equippedWeapon.kind === 'unavailable')
      return [
        {
          ...routine,
          warnings: [
            equippedWeapon.warning,
            ...offWarnings,
            ...routineWarnings,
            ...naturalWarnings,
          ],
        },
      ];
    const calculation: AttackCalculation = {
      ...context,
      unarmedLethal: feats.has('improved-unarmed-strike'),
      ...resolveNaturalFacts(equippedWeapon.weapon, input),
      multiattackEntryId:
        feats.get('multiattack')?._id ?? grantedMultiattackEntryId,
      hand: 'main',
      end: 'primary',
      preciseShot: feats.has('precise-shot'),
      otherHandFree: isOtherHandFree(entry, input),
      entry,
      equippedWeapon,
      proficiency: weaponProficiencies.find(
        (use) =>
          use.entryId === state.weaponEntryId && use.hands === state.hands,
      ),
    };
    const line = resolveAttackLine(calculation);
    const rate = attackRate(calculation, rateRules);
    const offCalculation =
      offHand.kind === 'available'
        ? {
            ...offHand.calculation,
            unarmedLethal: feats.has('improved-unarmed-strike'),
          }
        : undefined;
    const offRate = offCalculation && attackRate(offCalculation, rateRules);
    const fullLine =
      offHand.kind === 'available'
        ? resolveAttackLine({
            ...calculation,
            ...(equippedWeapon.weapon.naturalAttack
              ? { naturalRole: 'secondary', soleNaturalAttack: false }
              : {}),
            twoWeaponPenalty: offHand.penalties.main,
            twoWeaponFeatEntryId: feats.get('two-weapon-fighting')?._id,
            usesBothEnds: offHand.calculation.usesBothEnds,
          })
        : line;
    const naturalWeapons = naturalSelections.map(
      (selection) => selection.weapon,
    );
    const mixed =
      !equippedWeapon.weapon.naturalAttack || Boolean(offCalculation);
    const naturalLines = resolveNaturalLines({
      selections: naturalSelections,
      calculation,
      input,
      mixed,
    });
    naturalWarnings.push(
      ...resolveNaturalLimbWarnings({
        entry,
        equippedWeapon,
        naturalWeapons,
        offCalculation,
      }),
    );
    const flurry = resolveFlurryContext({
      effects: choices.effects,
      input,
      calculation,
    });
    // Speed (#764): "one extra attack with it", so only the speed weapon's
    // attacking part counts, and never on top of another haste Source.
    const speedOf = (weapon: AvailableWeapon) =>
      findItemAbilitySource(input, weapon.item, [weapon.part], HASTE_SOURCE);
    const mainHaste = haste ?? speedOf(equippedWeapon);
    const offHaste =
      !mainHaste && offCalculation
        ? speedOf(offCalculation.equippedWeapon)
        : undefined;
    const rates: FullAttackRates = {
      limited: rate.limited,
      offLimited: offRate?.limited ?? false,
      haste: mainHaste,
      ...(offHaste ? { offHaste } : {}),
    };
    const { lines: full, ...assembled } = flurry
      ? resolveRoutineFlurry({
          context: flurry,
          calculation,
          offCalculation,
          rates,
        })
      : resolveOrdinaryFullAttack({
          calculation,
          fullLine,
          offCalculation,
          mainPenalty:
            offHand.kind === 'available' ? offHand.penalties.main : 0,
          feats,
          naturalLines,
          rates,
        });
    const vitalStrike = choices.effects.vitalStrike;
    const single = [vitalStrike ? applyVitalStrike(line, vitalStrike) : line];
    const reach = describeOptionReach(choices.effects, [...single, ...full]);
    const naturalFlurry = describeNaturalFlurry(choices.effects, flurry);
    const inapplicable = new Set([
      ...assembled.inapplicable,
      ...reach.inapplicable,
      ...naturalFlurry.inapplicable,
    ]);
    return [
      {
        ...routine,
        twoWeaponPenaltySummary:
          offHand.kind === 'available' && !flurry ? offHand.summary : null,
        options: choices.views.map((view) =>
          view.switchedOn &&
          view.ruleIdentity &&
          inapplicable.has(view.ruleIdentity)
            ? { ...view, applicable: false }
            : view,
        ),
        optionNotes: [
          ...assembled.notes,
          ...reach.notes,
          ...naturalFlurry.notes,
        ],
        twoWeaponRend: resolveRoutineRend({
          rend,
          offCalculation,
          flurry,
          strength: abilities.strength.modifier,
          mode: state.mode,
        }),
        flurry: flurry?.flurry ?? null,
        single,
        attackRateNotes: [
          ...rate.notes,
          ...(offRate?.notes.map((note) => `Off hand: ${note}`) ?? []),
        ],
        full,
        warnings: [
          ...routineSuitabilityWarnings({
            calculation,
            proficiencyFingerprint: routineWarningFingerprints.get(entry._id),
          }),
          ...offWarnings,
          ...routineWarnings,
          ...naturalWarnings,
          ...resolveFlurryWarnings({
            entry,
            input,
            effects: choices.effects,
            equippedWeapon,
            offCalculation,
            flurry,
          }),
        ],
      },
    ];
  });
}
