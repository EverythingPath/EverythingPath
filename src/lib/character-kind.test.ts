import { expect, test } from 'vitest';
import {
  CHARACTER_KINDS,
  formatCharacterKind,
  characterKindSchema,
  mirrorRosterKinds,
  normalizeCharacterKind,
} from './character-kind';
import { canonicalRosterSchema } from './canonical-roster';
import {
  kindRecords,
  kindSnapshot,
} from '../../tests/rules/character-kind-fixture';

test('stored kinds are PC or NPC, and a roster refuses any other label', () => {
  expect(CHARACTER_KINDS).toEqual(['pc', 'npc']);
  for (const kind of ['pc', 'npc'])
    expect(characterKindSchema.parse(kind)).toBe(kind);
  for (const kind of ['officer_npc', 'other_npc', 'NPC', '', null, undefined])
    expect(characterKindSchema.safeParse(kind).success).toBe(false);
  const roster = kindSnapshot().roster;
  expect(
    canonicalRosterSchema.safeParse({
      ...roster,
      people: [{ characterId: 'aubrin', kind: 'officer_npc', hitDice: 1 }],
    }).success,
  ).toBe(false);
});

// B3: a browser still on a bundle from before #180 may submit a legacy label.
test('a submitted legacy NPC label is stored as npc', () => {
  expect(normalizeCharacterKind('pc')).toBe('pc');
  expect(normalizeCharacterKind('officer_npc')).toBe('npc');
  expect(normalizeCharacterKind('other_npc')).toBe('npc');
  expect(normalizeCharacterKind('npc')).toBe('npc');
});

test('the live roster mirror follows current records without touching membership, Hit Dice or assignments', () => {
  const roster = canonicalRosterSchema.parse(kindSnapshot().roster);
  const before = structuredClone(roster);
  const mirrored = mirrorRosterKinds(roster, kindRecords);
  expect(roster).toEqual(before);
  expect(mirrored.people).toEqual([
    { characterId: 'aubrin', kind: 'pc', hitDice: null },
    { characterId: 'mara', kind: 'pc', hitDice: 0 },
    { characterId: 'ostler', kind: 'npc', hitDice: 5 },
    // The record is authoritative, even though the old mirror said NPC and
    // Rook still manages teams.
    { characterId: 'rook', kind: 'pc', hitDice: null },
    { characterId: 'vessa', kind: 'npc', hitDice: 3 },
  ]);
  expect(mirrored.officers).toBe(roster.officers);
  expect(mirrored.teams).toBe(roster.teams);
  expect(canonicalRosterSchema.parse(mirrored)).toEqual(mirrored);
  // Repeating the adapter is a no-op.
  expect(mirrorRosterKinds(mirrored, kindRecords)).toEqual(mirrored);
});

test('the live roster mirror never infers kind from roles or invents a missing record', () => {
  const roster = {
    people: [
      { characterId: 'lost', kind: 'npc' as const, hitDice: 0 },
      { characterId: 'officer', kind: 'pc' as const, hitDice: null },
    ],
    officers: [{ role: 'commandant' as const, characterId: 'officer' }],
    teams: [],
  };
  expect(
    mirrorRosterKinds(roster, [{ characterId: 'officer', kind: 'npc' }]).people,
  ).toEqual([
    { characterId: 'lost', kind: 'npc', hitDice: 0 },
    { characterId: 'officer', kind: 'npc', hitDice: null },
  ]);
});

test('live views label each kind PC or NPC', () => {
  expect(CHARACTER_KINDS.map(formatCharacterKind)).toEqual(['PC', 'NPC']);
});
