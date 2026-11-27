import type {
  ResolvedStatistic,
  SourcedModifier,
  SourcedSituationalNote,
  Situation,
  SuppressedModifier,
} from '~/lib/character-sheet';
import {
  isCombatSituation,
  identifySituation,
  sameSituationIdentity,
  serializeSituationIdentity,
  type RequestedSituation,
} from '~/lib/character-sheet-situations';
import { describeSituation } from './modifier-labels';

// Pure grouping for a number's explanation: which contributions wait on a
// Situation (and how to ask the resolver about it), which wait on something
// else, and what a situation changes once the resolver has answered for it.

export type SituationGroup = {
  key: string;
  text: string;
  selection: RequestedSituation;
  entryName?: string;
};

const sameContribution = (a: SourcedModifier, b: SourcedModifier) =>
  a.sheetEntryId === b.sheetEntryId &&
  a.target === b.target &&
  a.bonusType === b.bonusType &&
  a.value === b.value &&
  a.source === b.source &&
  a.modifierIndex === b.modifierIndex &&
  a.condition?.whileActive === b.condition?.whileActive &&
  a.condition?.castingClass === b.condition?.castingClass &&
  a.condition?.school === b.condition?.school &&
  a.condition?.weapon === b.condition?.weapon &&
  a.condition?.weaponSelection === b.condition?.weaponSelection &&
  a.condition?.option === b.condition?.option &&
  (a.condition?.situation === undefined
    ? b.condition?.situation === undefined
    : b.condition?.situation !== undefined &&
      sameSituationIdentity(
        identifySituation(a.condition.situation, a.sheetEntryId),
        identifySituation(b.condition.situation, b.sheetEntryId),
      ));

export const isSituational = (contribution: SourcedModifier) =>
  contribution.condition?.situation !== undefined;

export const hasSituationalContributions = (statistic: ResolvedStatistic) =>
  [
    ...statistic.applied,
    ...statistic.suppressed,
    ...statistic.conditional,
  ].some(
    (item) =>
      item.condition?.situation !== undefined &&
      !isCombatSituation(item.condition.situation),
  ) ||
  (statistic.notes ?? []).some((note) => {
    const situation = note.situation ?? note.condition?.situation;
    return situation === undefined || !isCombatSituation(situation);
  });

/**
 * The group a situational contribution belongs to. A local situation is
 * keyed with its own adjustment so an equally named one on another
 * adjustment is a separate group that never activates it.
 */
function findSituationGroup(
  contribution: Pick<SourcedModifier, 'sheetEntryId' | 'condition'> & {
    situation?: Situation;
    entryName?: string;
  },
): SituationGroup | null {
  const situation = contribution.situation ?? contribution.condition?.situation;
  if (situation === undefined) return null;
  const text = describeSituation(situation);
  if (typeof situation === 'string')
    return {
      key: serializeSituationIdentity(identifySituation(situation)),
      text,
      selection: situation,
    };
  if ('local' in situation)
    return {
      key: serializeSituationIdentity(
        identifySituation(situation, contribution.sheetEntryId),
      ),
      text,
      entryName: contribution.entryName,
      selection: {
        local: situation.local,
        sheetEntryId: contribution.sheetEntryId,
      },
    };
  return {
    key: serializeSituationIdentity(identifySituation(situation)),
    text,
    selection: { option: situation.option },
  };
}

/** One group per distinct Situation among the conditional contributions. */
export function listSituationGroups(
  statistic: ResolvedStatistic,
): SituationGroup[] {
  return collectSituationGroups([
    ...statistic.applied,
    ...statistic.suppressed,
    ...statistic.conditional,
    ...(statistic.notes ?? []),
  ]);
}

export function listSituationalNoteGroups(
  notes: readonly SourcedSituationalNote[],
) {
  return collectSituationGroups(notes);
}

function collectSituationGroups(
  contributions: readonly Parameters<typeof findSituationGroup>[0][],
) {
  const groups = new Map<string, SituationGroup>();
  for (const contribution of contributions) {
    const group = findSituationGroup(contribution);
    if (group) groups.set(group.key, group);
  }
  return [...groups.values()];
}

export function listSituationNotes(
  statistic: ResolvedStatistic,
  group: SituationGroup,
): SourcedSituationalNote[] {
  return (statistic.notes ?? []).filter(
    (note) => findSituationGroup(note)?.key === group.key,
  );
}

/** Conditional contributions waiting on something other than a Situation. */
export function listPrerequisiteContributions(statistic: ResolvedStatistic) {
  return statistic.conditional.filter(
    (contribution) => !isSituational(contribution),
  );
}

const wordsOf = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

/**
 * "wizard evocation spells": the casting a contribution is confined to, in
 * words; a choice not yet made reads as such. Null without a casting scope.
 */
export function describeCastingScope(
  contribution: Pick<SourcedModifier, 'condition'>,
  findCastingClassName: (classTag: string) => string | null,
) {
  const { castingClass, school } = contribution.condition ?? {};
  if (castingClass === undefined && school === undefined) return null;
  const scope = [
    castingClass === undefined
      ? undefined
      : castingClass === '$choice'
        ? "a chosen class's"
        : (findCastingClassName(castingClass) ?? "a specific class's"),
    school === undefined
      ? undefined
      : school === '$choice'
        ? "a chosen school's"
        : wordsOf(school).replace(/^./, (letter) => letter.toUpperCase()),
  ].filter((part): part is string => part !== undefined);
  return `${scope.join(' ')} spells`;
}

function describeWeaponScope(
  weapon: NonNullable<SourcedModifier['condition']>['weapon'],
  entryName: string,
) {
  switch (weapon) {
    case '$self':
      return entryName;
    case '$group':
      return 'the chosen weapon group';
    case '$target':
      return 'the affected weapon';
    case '$unarmedOrNatural':
      return 'unarmed strikes or natural attacks';
    case '$choice':
      return 'the chosen weapon';
    case undefined:
      return null;
    default: {
      const exhaustive: never = weapon;
      return exhaustive;
    }
  }
}

/** Scope text stays readable even when a referenced choice is unavailable. */
export function describeContributionScope(
  contribution: Pick<SourcedModifier, 'condition' | 'entryName'>,
  findCastingClassName: (classTag: string) => string | null,
) {
  const { weapon, option } = contribution.condition ?? {};
  const scopes: string[] = [];
  if (weapon) {
    const weaponText = describeWeaponScope(weapon, contribution.entryName);
    scopes.push(`only with ${weaponText}`);
  }
  if (option) scopes.push(`only in routines using ${contribution.entryName}`);
  const casting = describeCastingScope(contribution, findCastingClassName);
  if (casting) scopes.push(`only for ${casting}`);
  return scopes.length > 0 ? scopes.join('; ') : null;
}

/** "only while Rage is active": the prerequisite by name, never by identifier. */
export function describePrerequisite(
  contribution: Pick<SourcedModifier, 'condition'>,
  findPrerequisiteName: (catalogEntryId: string) => string | null,
  findCastingClassName: (classTag: string) => string | null,
) {
  const prerequisite = contribution.condition?.whileActive;
  const scope = describeCastingScope(contribution, findCastingClassName);
  if (!prerequisite)
    return scope ? `only for ${scope}` : 'only in specific circumstances';
  const name = findPrerequisiteName(prerequisite);
  return name
    ? `only while ${name} is active`
    : 'only while its prerequisite is active';
}

/**
 * What a Situation changes, read from the resolver's answer for it: the
 * contributions it newly applies, anything it newly suppresses, and its own
 * contributions still waiting on a prerequisite there. A group whose
 * contributions all wait changes nothing, so it has no total to show.
 */
export function diffSituation({
  group,
  ordinary,
  inSituation,
}: {
  group: SituationGroup;
  ordinary: ResolvedStatistic;
  inSituation: ResolvedStatistic;
}) {
  const applied = inSituation.applied.filter(
    (contribution) =>
      !ordinary.applied.some((item) => sameContribution(item, contribution)),
  );
  const suppressed = inSituation.suppressed.filter(
    (contribution) =>
      !ordinary.suppressed.some(
        (item) =>
          sameContribution(item, contribution) &&
          item.reason === contribution.reason &&
          item.suppressedBy === contribution.suppressedBy,
      ),
  );
  const waiting = inSituation.conditional.filter(
    (contribution) => findSituationGroup(contribution)?.key === group.key,
  );
  const hasChange = applied.length > 0 || suppressed.length > 0;
  return {
    total: hasChange ? inSituation.total : null,
    applied,
    suppressed,
    waiting,
  };
}

/** The entry a suppressed contribution lost to, by name; never an identifier. */
export function findSuppressorName(
  suppressed: SuppressedModifier,
  statistic: ResolvedStatistic,
) {
  if (suppressed.suppressedBy === suppressed.sheetEntryId) return null;
  const winner = [...statistic.applied, ...statistic.suppressed].find(
    (contribution) => contribution.sheetEntryId === suppressed.suppressedBy,
  );
  return winner?.entryName ?? null;
}
