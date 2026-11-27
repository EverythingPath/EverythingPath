import { expect, test } from 'vitest';
import {
  readCompanionSourceStatus,
  type CompanionSourceStatus,
  type CompanionSupport,
} from './companionRelationshipGraph';
import {
  companionContributionSchema,
  companionProgressionSourceSchema,
  type CompanionContribution,
  type CompanionProgressionSource,
} from '../../src/lib/character-sheet-companion-sources';

const replaced = { archetypes: ['Guide'] };

// A source the Guide no longer entitles cannot also count, in the decision
// and in each shape the sheet emits from it (companion-entitlement-replaced).
test('a counting source cannot say why it does not count', () => {
  const statuses: CompanionSourceStatus[] = [
    { kind: 'counting' },
    { kind: 'notOnSheet' },
    {
      kind: 'notEntitled',
      notEntitled: { reason: 'replacedBy', ...replaced },
    },
    { kind: 'notEntitled', notEntitled: { reason: 'archetypeDoesNotApply' } },
    // @ts-expect-error a counting status gives no reason
    { kind: 'counting', notEntitled: { reason: 'archetypeDoesNotApply' } },
    // @ts-expect-error a missing entitlement gives its reason
    { kind: 'notEntitled' },
  ];
  expect(statuses).toHaveLength(6);
  const sources: CompanionProgressionSource[] = [
    { sourceKey: 'bond', ruleKind: 'rangerCompanion', counting: true },
    {
      sourceKey: 'bond',
      ruleKind: 'rangerCompanion',
      counting: false,
      featureReplaced: replaced,
    },
    {
      sourceKey: 'bond',
      ruleKind: 'rangerCompanion',
      counting: true,
      // @ts-expect-error a counting source names no replacing Archetype
      featureReplaced: replaced,
    },
  ];
  // Parsing keeps the replacement only on the source that does not count.
  expect(
    sources.map((source) => companionProgressionSourceSchema.parse(source)),
  ).toEqual([
    { sourceKey: 'bond', ruleKind: 'rangerCompanion', counting: true },
    {
      sourceKey: 'bond',
      ruleKind: 'rangerCompanion',
      counting: false,
      featureReplaced: replaced,
    },
    { sourceKey: 'bond', ruleKind: 'rangerCompanion', counting: true },
  ]);
  const contribution = {
    kind: 'ordinary',
    sourceKey: 'bond',
    ruleKind: 'rangerCompanion',
    classLevels: 7,
    effectiveLevel: 4,
    classRuleIdentity: 'ranger',
    resolution: 'calculated',
    fallbackState: 'none',
    ruleConflict: undefined,
    associatedSize: undefined,
  } as const;
  const contributions: CompanionContribution[] = [
    { ...contribution, counting: true },
    {
      ...contribution,
      counting: false,
      classLevels: null,
      effectiveLevel: null,
      featureReplaced: replaced,
    },
    // @ts-expect-error a counting contribution names no replacing Archetype
    { ...contribution, counting: true, featureReplaced: replaced },
  ];
  expect(
    contributions.map(
      (item) => 'featureReplaced' in companionContributionSchema.parse(item),
    ),
  ).toEqual([false, true, false]);
});

test('only an animal companion’s counting Class Level can lack entitlement', () => {
  const support: CompanionSupport = {
    countingEntries: new Set(['level-1', 'grant-1']),
    notEntitled: new Map([
      ['level-1', { reason: 'replacedBy', archetypes: ['Guide'] }],
    ]),
  };
  const source = { key: 'bond', label: 'Bond', enabled: true };
  expect(
    readCompanionSourceStatus(
      'animalCompanion',
      { ...source, sheetEntryId: 'level-1' as never },
      support,
    ),
  ).toEqual({
    kind: 'notEntitled',
    notEntitled: { reason: 'replacedBy', archetypes: ['Guide'] },
  });
  expect(
    readCompanionSourceStatus(
      'familiar',
      { ...source, sheetEntryId: 'level-1' as never },
      support,
    ),
  ).toEqual({ kind: 'counting' });
  expect(
    readCompanionSourceStatus(
      'animalCompanion',
      { ...source, sheetEntryId: 'level-2' as never },
      support,
    ),
  ).toEqual({ kind: 'notOnSheet' });
  expect(
    readCompanionSourceStatus('animalCompanion', source, undefined),
  ).toEqual({ kind: 'counting' });
});
