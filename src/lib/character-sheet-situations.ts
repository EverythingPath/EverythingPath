import type { Situation } from './character-sheet';

export type RequestedSituation =
  | string
  | { local: string; sheetEntryId: string }
  | { option: string };

export type SituationIdentity =
  | { kind: 'shared'; name: string }
  | { kind: 'local'; name: string; sheetEntryId?: string }
  | { kind: 'option'; catalogEntryId: string };

export function identifySituation(
  situation: Situation,
  sheetEntryId?: string,
): SituationIdentity {
  if (typeof situation === 'string') return { kind: 'shared', name: situation };
  if ('local' in situation)
    return { kind: 'local', name: situation.local, sheetEntryId };
  return { kind: 'option', catalogEntryId: situation.option };
}

export function sameSituationIdentity(
  first: SituationIdentity,
  second: SituationIdentity,
) {
  if (first.kind === 'shared')
    return second.kind === 'shared' && first.name === second.name;
  if (first.kind === 'local')
    return (
      second.kind === 'local' &&
      first.name === second.name &&
      first.sheetEntryId === second.sheetEntryId
    );
  return (
    second.kind === 'option' && first.catalogEntryId === second.catalogEntryId
  );
}

/** How to ask the resolver for a Situation of one entry: a local one names it. */
export function situationSelection(
  situation: Situation,
  sheetEntryId: string,
): RequestedSituation {
  return typeof situation === 'object' && 'local' in situation
    ? { local: situation.local, sheetEntryId }
    : situation;
}

/** Stable opaque key for keyed UI collections; matching uses typed identities. */
export function serializeSituationIdentity(identity: SituationIdentity) {
  const encode = (value: string) => `${value.length}:${value}`;
  if (identity.kind === 'shared') return `shared:${encode(identity.name)}`;
  if (identity.kind === 'local')
    return `local:${encode(identity.sheetEntryId ?? '')}:${encode(identity.name)}`;
  return `option:${encode(identity.catalogEntryId)}`;
}

export function situationMatches(
  situation: Situation,
  sheetEntryId: string,
  requested: readonly RequestedSituation[] = [],
) {
  return requested.some((selected) =>
    sameSituationIdentity(
      identifySituation(
        selected,
        typeof selected === 'object' && 'local' in selected
          ? selected.sheetEntryId
          : undefined,
      ),
      identifySituation(situation, sheetEntryId),
    ),
  );
}

/**
 * Whether a Situation is its entry's own state, a local Situation named like
 * the entry ("Blinded" on Blinded), whatever the case of either name.
 */
export function isOwnStateSituation(
  situation: Situation | undefined,
  entryName: string | undefined,
) {
  return (
    typeof situation === 'object' &&
    'local' in situation &&
    situation.local.toLowerCase() === entryName?.toLowerCase()
  );
}

const combatSituations = new Set([
  'fightingDefensively',
  'totalDefense',
  'charging',
  'shootingIntoMelee',
]);

export function isCombatSituation(situation: Situation) {
  return typeof situation === 'string' && combatSituations.has(situation);
}
