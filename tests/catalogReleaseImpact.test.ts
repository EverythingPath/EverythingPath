import { expect, test } from 'vitest';
import { planReleaseImpact } from '../src/lib/catalog/release-impact';
import { importedCatalogEntrySchema } from '../src/lib/catalog/imported-entry-schema';
import {
  calculateCharacterSheetForRelease,
  isSupportedCatalogCalculation,
} from '../src/lib/catalog/calculation-dispatch';
import {
  retainedPriorCalculationIdentity,
  supersededCalculationIdentities,
} from '../src/lib/catalog/calculation-identities';
import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
} from '../src/lib/character-sheet';

test('retains the landed default calculator identity and rejects the superseded pre-rebase identities', () => {
  const landedIdentity = retainedPriorCalculationIdentity;
  const input: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
    ],
  };
  expect(isSupportedCatalogCalculation(landedIdentity)).toBe(true);
  expect(calculateCharacterSheetForRelease(landedIdentity, input).level).toBe(
    0,
  );
  for (const supersededIdentity of supersededCalculationIdentities) {
    expect(isSupportedCatalogCalculation(supersededIdentity)).toBe(false);
    expect(() =>
      calculateCharacterSheetForRelease(supersededIdentity, input),
    ).toThrow('Unavailable Catalog Release calculation behavior');
  }
});

test('imported definitions retain only the grant shapes emitted by the importer', () => {
  const entry = importedCatalogEntrySchema.parse({
    externalKey: 'pf1/Feature',
    upstreamKey: 'Feature',
    pack: 'feats',
    name: 'Feature',
    detail: { kind: 'manual' },
    description: '',
    sources: [],
    modifiers: [],
    unsupported: [],
    grants: [{ externalKey: 'pf1/UnemittedGrant' }],
  });
  expect(entry).not.toHaveProperty('grants');
});

test.each([
  {
    name: 'old relationship removed',
    roots: ['class'],
    old: [{ from: 'class', to: 'feat' }],
    next: [],
    changed: ['feat'],
    isAffected: true,
  },
  {
    name: 'new Grant relationship',
    roots: ['class'],
    old: [],
    next: [{ from: 'class', to: 'feat' }],
    changed: ['feat'],
    isAffected: true,
  },
  {
    name: 'copy retains a global reference',
    roots: ['copy'],
    old: [{ from: 'copy', to: 'feat' }],
    next: [],
    changed: ['feat'],
    isAffected: true,
  },
  {
    name: 'copiedFrom is provenance only',
    roots: ['copy'],
    old: [],
    next: [],
    changed: ['original'],
    isAffected: false,
  },
  {
    name: 'keyed spell relationship',
    roots: ['grant'],
    old: [],
    next: [{ from: 'grant', to: 'key:spell' }],
    changed: ['key:spell'],
    isAffected: true,
  },
  {
    name: 'shared rule resource',
    roots: ['resource:casting'],
    old: [],
    next: [],
    changed: ['resource:casting'],
    isAffected: true,
  },
  {
    name: 'unrelated notice',
    roots: ['class'],
    old: [],
    next: [],
    changed: ['legal:notices'],
    isAffected: false,
  },
])('$name', ({ roots, old, next, changed, isAffected }) => {
  expect(
    planReleaseImpact({
      roots,
      oldEdges: old,
      newEdges: next,
      changed,
      hasCalculationChanged: false,
    }).isAffected,
  ).toBe(isAffected);
});

test('a resolver-only release includes every sheet without graph changes', () => {
  expect(
    planReleaseImpact({
      roots: [],
      oldEdges: [],
      newEdges: [],
      changed: [],
      hasCalculationChanged: true,
    }),
  ).toEqual({ isAffected: true, reasons: ['calculation'] });
});
