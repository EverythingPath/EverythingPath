import { expect, test } from 'vitest';
import {
  formatGrantKeyId,
  type ResolvedSheetEntry,
} from '../../src/lib/character-sheet-grants';
import { listRetainedGrantIds } from './catalogReleaseBoundary';

// CRB p. 55: Bravery +1 from fighter 2; APG p. 104: the Archer replaces it.
const braveryId = 'bravery';
const catalogEntries = [{ _id: braveryId, ruleIdentity: 'fighter-bravery-2' }];
function bravery(
  fields: Pick<ResolvedSheetEntry, 'recorded' | 'counting' | 'dormant'> &
    Partial<ResolvedSheetEntry>,
): ResolvedSheetEntry {
  const grantKey = {
    source: 'fighter',
    classLevel: 2,
    entry: 'fighter-bravery-2',
  };
  return {
    origin: 'grant',
    entry: {
      _id: formatGrantKeyId(grantKey),
      kind: 'classFeature',
      active: true,
      catalogEntryId: braveryId,
      grantKey,
      state: { kind: 'classFeature' },
    },
    ...fields,
  };
}

test('existing Grants of a retired target are the counting or recorded ones', () => {
  const retained = (row: ResolvedSheetEntry) =>
    listRetainedGrantIds(
      { catalogEntries, calculated: { resolvedEntries: [row] } },
      ['fighter-bravery-2'],
    );
  const id = bravery({ recorded: false, counting: true, dormant: false }).entry
    ._id;
  expect(
    retained(bravery({ recorded: false, counting: true, dormant: false })),
  ).toEqual([id]);
  const replaced = { kind: 'replaced' as const, byEntryIds: ['archer'] };
  expect(
    retained(
      bravery({
        recorded: true,
        counting: false,
        dormant: true,
        reason: replaced,
      }),
    ),
  ).toEqual([id]);
  expect(
    retained(
      bravery({
        recorded: false,
        counting: false,
        dormant: true,
        reason: replaced,
      }),
    ),
  ).toEqual([]);
  expect(
    retained(
      bravery({
        recorded: true,
        counting: false,
        dormant: true,
        reason: { kind: 'retired' },
      }),
    ),
  ).toEqual([]);
});
