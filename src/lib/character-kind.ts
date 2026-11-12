import { z } from 'zod';

// The kinds records, rosters, drafts and immutable history store, and the
// only kinds current forms offer.
export const CHARACTER_KINDS = ['pc', 'npc'] as const;
export type CharacterKind = (typeof CHARACTER_KINDS)[number];
export const characterKindSchema = z.enum(CHARACTER_KINDS);

// B3: a browser still on a bundle from before #180 may submit the legacy
// labels `officer_npc` (records and rosters) and `other_npc` (rosters only).
// The write paths accept them and store PC or NPC. Remove these with B3.
export type SubmittedKind = CharacterKind | 'officer_npc' | 'other_npc';
export function normalizeCharacterKind(kind: SubmittedKind): CharacterKind {
  return kind === 'pc' ? 'pc' : 'npc';
}

// The current record wins over a mismatched mirror. Membership, order, Hit
// Dice, officers and teams are untouched; a person without a record keeps its
// own kind, so nothing is invented.
export function mirrorRosterKinds<
  Roster extends { people: { characterId: string; kind: CharacterKind }[] },
>(
  roster: Roster,
  records: ReadonlyArray<{ characterId: string; kind: CharacterKind }>,
): Roster {
  const recordKinds = new Map(
    records.map((record) => [record.characterId, record.kind]),
  );
  return {
    ...roster,
    people: roster.people.map((person) => ({
      ...person,
      kind: recordKinds.get(person.characterId) ?? person.kind,
    })),
  };
}

const kindLabels: Record<CharacterKind, string> = { pc: 'PC', npc: 'NPC' };
export function formatCharacterKind(kind: CharacterKind) {
  return kindLabels[kind];
}
