import { describe, expect, test } from 'vitest';
import type { Doc } from '../../../convex/_generated/dataModel';
import {
  importedDetailSchema,
  type ImportedPickPrompt,
} from './imported-entry-schema';

// fg-1a: a class feature's prompt is open (its list only) or a pool naming
// its members by stable key; a pool never has an empty or repeated member
// list, and an open prompt never carries members. An untagged prompt, the
// shape before fg-1a, is open.
const classFeature = (picksByLevel: unknown[]) =>
  importedDetailSchema.safeParse({ kind: 'classFeature', picksByLevel });
const fields = { classLevel: 2, list: 'Barbarian: Rage Power', count: 1 };
const open = { ...fields, kind: 'open' };
const pool = { ...fields, kind: 'pool', members: ['pf1/animalFury'] };

describe('a class feature prompt', () => {
  test('is open, tagged or untagged, or a pool of stable keys', () => {
    expect(classFeature([open, fields, pool]).success).toBe(true);
  });

  test.each([
    ['a pool without members', { ...fields, kind: 'pool' }],
    ['a pool with no members', { ...pool, members: [] }],
    ['a pool with a repeated member', { ...pool, members: ['pf1/a', 'pf1/a'] }],
    ['a pool member that is not a stable key', { ...pool, members: ['Fury'] }],
    ['an open prompt with members', { ...open, members: ['pf1/animalFury'] }],
    ['an untagged prompt with members', { ...fields, members: ['pf1/a'] }],
    ['an unknown prompt kind', { ...pool, kind: 'tree' }],
  ])('refuses %s', (_name, prompt) => {
    expect(classFeature([prompt]).success).toBe(false);
  });
});

// The illegal shapes do not type-check, as fresh literals or through a
// variable (no excess-property check), as imported or as stored.
type StoredPickPrompt = NonNullable<
  Extract<
    Doc<'catalogEntry'>['detail'],
    { kind: 'classFeature' }
  >['picksByLevel']
>[number];
const untagged = { classLevel: 2, list: 'Barbarian: Rage Power', count: 1 };
const poolWithoutMembers = { ...untagged, kind: 'pool' as const };
const unknownKind = { ...untagged, kind: 'tree' as const };
const openWithMembers = {
  ...untagged,
  kind: 'open' as const,
  members: ['pf1/animalFury'] as [string],
};
const untaggedWithMembers = { ...untagged, members: ['pf1/animalFury'] };
const storedOpenWithMembers = {
  ...untagged,
  kind: 'open' as const,
  members: [],
};
// One assignment per check: in an array literal, subtype reduction can hide
// an element's error behind a wider element.
export const importedLegal: ImportedPickPrompt[] = [
  untagged,
  { ...untagged, kind: 'open' },
  { ...untagged, kind: 'pool', members: ['pf1/animalFury'] },
];
// @ts-expect-error a pool names its members
export const importedFreshPool: ImportedPickPrompt = {
  ...untagged,
  kind: 'pool',
};
export const importedEmptyPool: ImportedPickPrompt = {
  ...untagged,
  kind: 'pool',
  // @ts-expect-error a pool has at least one member
  members: [],
};
export const importedFreshOpen: ImportedPickPrompt = {
  ...untagged,
  kind: 'open',
  // @ts-expect-error an open prompt has no members
  members: ['pf1/animalFury'],
};
// @ts-expect-error a pool names its members
export const importedPool: ImportedPickPrompt = poolWithoutMembers;
// @ts-expect-error a prompt is open or a pool
export const importedKind: ImportedPickPrompt = unknownKind;
// @ts-expect-error an open prompt has no members
export const importedOpen: ImportedPickPrompt = openWithMembers;
// @ts-expect-error an untagged prompt is open, without members
export const importedUntagged: ImportedPickPrompt = untaggedWithMembers;
export const storedLegal: StoredPickPrompt[] = [
  untagged,
  { ...untagged, kind: 'open' },
];
// @ts-expect-error a stored pool names its members
export const storedPool: StoredPickPrompt = poolWithoutMembers;
// @ts-expect-error a stored prompt is open or a pool
export const storedKind: StoredPickPrompt = unknownKind;
// @ts-expect-error a stored open prompt has no members
export const storedOpen: StoredPickPrompt = storedOpenWithMembers;
// @ts-expect-error a stored untagged prompt has no members
export const storedUntagged: StoredPickPrompt = untaggedWithMembers;
