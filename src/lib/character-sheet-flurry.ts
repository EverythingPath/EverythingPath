import type {
  CharacterSheetInput,
  ResolvedStatistic,
  SheetWarning,
  SourcedModifier,
} from './character-sheet';
import type { WeaponDetail } from './character-sheet-attacks';
import { classProgressionEntryId } from './character-sheet-class-levels';
import { matchingRuleKey, ruleKeyMatches } from './character-sheet-rule-keys';

/**
 * The two admitted flurries of blows, each a Routine Option offered by its
 * monk's class feature (#229, #414). Core: CRB p. 57. Unchained: Pathfinder
 * Unchained p. 14. Each counts only its own version's monk levels (owner,
 * #414), so a Character mixing versions keeps them apart.
 */
const flurryRules = {
  'monk-flurry': { version: 'core', classIdentity: 'monk' },
  'unchained-monk-flurry': {
    version: 'unchained',
    classIdentity: 'unchained-monk',
  },
} as const satisfies Record<
  string,
  { version: 'core' | 'unchained'; classIdentity: string }
>;
export type FlurryIdentity = keyof typeof flurryRules;
export type FlurryVersion = (typeof flurryRules)[FlurryIdentity]['version'];

// Safe cast: the keys of the flurry rule table are exactly its identities.
const flurryIdentities = Object.keys(flurryRules) as FlurryIdentity[];

/**
 * The flurry a class feature's rule identity is, if any: the seeded key, its
 * #716 identity or the Foundry feature (#741, `character-sheet-rule-keys.ts`).
 */
export function flurryIdentityOf(
  identity: string | null | undefined,
): FlurryIdentity | undefined {
  return matchingRuleKey(identity, flurryIdentities);
}

export function isFlurryIdentity(identity: string) {
  return flurryIdentityOf(identity) !== undefined;
}

export function flurryRule(identity: FlurryIdentity) {
  return flurryRules[identity];
}

/** The class definitions of the sheet's Class Levels that the rule key names. */
function classDefinitionsOf(input: CharacterSheetInput, classIdentity: string) {
  return input.entries.flatMap((entry) => {
    if (entry.kind !== 'classLevel' || !entry.active) return [];
    const id = entry.state.classEntryId;
    const definition = input.catalogEntries.find(
      (candidate) => candidate._id === id,
    );
    return id !== null &&
      ruleKeyMatches(definition?.ruleIdentity, classIdentity)
      ? [definition]
      : [];
  });
}

/** The Class Levels whose class has this rule identity. */
export function countClassLevels(
  input: CharacterSheetInput,
  classIdentity: string,
) {
  return classDefinitionsOf(input, classIdentity).length;
}

/**
 * The rule identity the sheet's class of this rule key carries, whose
 * built-in progression rows a core flurry replaces; the key itself when the
 * sheet has none.
 */
export function sheetClassIdentity(
  input: CharacterSheetInput,
  classIdentity: string,
) {
  return (
    classDefinitionsOf(input, classIdentity)[0]?.ruleIdentity ?? classIdentity
  );
}

/**
 * CRB p. 57: one extra attack, two at 8th level and three at 15th. PU p. 14:
 * one extra attack, and another at 11th level.
 */
export function flurryExtraAttacks(version: FlurryVersion, monkLevel: number) {
  if (version === 'unchained') return monkLevel >= 11 ? 2 : 1;
  if (monkLevel >= 15) return 3;
  if (monkLevel >= 8) return 2;
  return 1;
}

/** CRB p. 57: −2 on every attack of a core flurry; PU p. 14: no penalty. */
export function flurryAttackPenalty(version: FlurryVersion) {
  return version === 'core' ? -2 : 0;
}

/**
 * CRB p. 57; FAQ naz: "the monk's base attack bonus from his monk class
 * levels is equal to his monk level", while other classes' and racial Hit
 * Dice's base attack bonus adds normally. The Unchained monk keeps his base
 * attack bonus. The substituted row keeps the class's built-in identity.
 */
export function resolveFlurryBaseAttack({
  bab,
  version,
  classIdentity,
  monkLevel,
  name,
}: {
  bab: ResolvedStatistic;
  version: FlurryVersion;
  classIdentity: string;
  monkLevel: number;
  name: string;
}): ResolvedStatistic {
  if (version !== 'core') return bab;
  const sheetEntryId = classProgressionEntryId(classIdentity);
  const replaced = bab.applied.find(
    (row) => row.builtIn && row.sheetEntryId === sheetEntryId,
  );
  const flurryRow: SourcedModifier = {
    target: 'bab',
    value: monkLevel,
    bonusType: 'untyped',
    sheetEntryId,
    entryName: `${name}: monk level ${monkLevel}`,
    source: sheetEntryId,
    builtIn: true,
  };
  const applied = bab.applied.filter((row) => row !== replaced);
  return {
    ...bab,
    total: bab.total - (replaced?.value ?? 0) + monkLevel,
    applied: [...applied, flurryRow],
  };
}

/** CRB pp. 57, 144: unarmed strikes and weapons with the monk quality. */
export function isFlurryWeapon(
  weapon: Pick<WeaponDetail, 'monk'>,
  isUnarmed: boolean,
) {
  return isUnarmed || weapon.monk === true;
}

type FlurryWarningArgs = {
  routineEntryId: string;
  routineName: string;
};

function flurryWarning({
  routineEntryId,
  check,
  facts,
  message,
}: {
  routineEntryId: string;
  check: Extract<
    SheetWarning['check'],
    'flurryNaturalAttacks' | 'flurryWeapon' | 'flurryArmor'
  >;
  facts: readonly unknown[];
  message: string;
}): SheetWarning {
  return {
    kind: 'rules',
    check,
    target: { kind: 'entry', entryId: routineEntryId },
    subject: `${routineEntryId}:flurry`,
    fingerprint: JSON.stringify(facts),
    message,
  };
}

/**
 * CRB p. 57; #237 A5: natural attacks can't join a flurry. The routine
 * keeps them recorded; they leave its flurry's full attack.
 */
export function flurryNaturalAttackWarning({
  routineEntryId,
  routineName,
  naturalEntryIds,
}: FlurryWarningArgs & { naturalEntryIds: readonly string[] }) {
  return flurryWarning({
    routineEntryId,
    check: 'flurryNaturalAttacks',
    facts: [...naturalEntryIds],
    message: `Natural attacks can't be part of a flurry of blows. ${routineName} keeps them recorded but leaves them out of its flurry.`,
  });
}

/** CRB p. 57: only unarmed strikes and monk weapons; the lines are kept. */
export function flurryWeaponWarning({
  routineEntryId,
  routineName,
  weapons,
}: FlurryWarningArgs & {
  weapons: readonly { entryId: string; name: string }[];
}) {
  const names = weapons.map((weapon) => weapon.name);
  const listed =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)} aren't monk weapons`
      : `${names[0]} isn't a monk weapon`;
  return flurryWarning({
    routineEntryId,
    check: 'flurryWeapon',
    facts: weapons.map((weapon) => weapon.entryId),
    message: `${listed}. A flurry of blows uses only unarmed strikes and monk weapons; ${routineName} keeps its flurry attacks.`,
  });
}

/**
 * CRB p. 57 and PU p. 14: armor, a shield or a medium or heavy load loses
 * flurry. The sheet tracks no load, so only armor and shields warn.
 */
export function flurryArmorWarning({
  routineEntryId,
  routineName,
  items,
}: FlurryWarningArgs & {
  items: readonly { entryId: string; name: string }[];
}) {
  return flurryWarning({
    routineEntryId,
    check: 'flurryArmor',
    facts: items.map((item) => item.entryId),
    message: `A monk loses flurry of blows while wearing armor or using a shield (${items
      .map((item) => item.name)
      .join(', ')}). ${routineName} keeps its flurry attacks.`,
  });
}

/** Active armor and shields: a monk loses his flurry in them. */
export function listFlurryArmor(input: CharacterSheetInput) {
  return input.entries.flatMap((entry) => {
    if (entry.kind !== 'item' || !entry.active) return [];
    const definition = input.catalogEntries.find(
      (candidate) => candidate._id === entry.catalogEntryId,
    );
    const detail = definition?.detail;
    if (detail?.kind !== 'item' || !detail.armor) return [];
    return [{ entryId: entry._id, name: definition?.name ?? 'Armor' }];
  });
}
