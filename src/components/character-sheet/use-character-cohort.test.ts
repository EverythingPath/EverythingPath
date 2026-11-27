import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import type { CohortEquivalenceState } from '~/lib/character-sheet-cohort';
import {
  buildSheet,
  calculateFixtureSheet,
} from './character-sheet-test-fixture';
import {
  buildCompanionRelationshipView,
  type CompanionRelationship,
} from './character-companions-view-model';
import { useCharacterCohort } from './use-character-cohort';

const server = vi.hoisted(() => ({
  write: vi.fn(),
  readOnly: false,
}));
vi.mock('convex/react', () => ({
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({ readOnly: server.readOnly }),
}));

function cohortSnapshot(equivalence?: CohortEquivalenceState) {
  const snapshot = buildSheet({
    levels: [
      { id: 'level-1', hp: 6 },
      { id: 'level-2', hp: 6 },
    ],
  });
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    ...(equivalence ? { cohortEquivalence: equivalence } : {}),
  };
  const options = {
    cohort: {
      sources: [{ sourceKey: 'leadership', counting: true }],
      linkedInputs: [
        resolveCompanionLinkedInput({
          input: { kind: 'characterLevel' },
          candidates: [
            { sourceKey: 'leadership', kind: 'available', value: 9 },
          ],
        }),
        resolveCompanionLinkedInput({
          input: { kind: 'abilityModifier', ability: 'charisma' },
          candidates: [
            { sourceKey: 'leadership', kind: 'available', value: 2 },
          ],
        }),
      ],
    },
  };
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base' && equivalence
        ? {
            ...entry,
            state: { ...entry.state, cohortEquivalence: equivalence },
          }
        : entry,
    ),
    calculated: calculateFixtureSheet(input, options),
    permanentCalculated: calculateFixtureSheet(input, {
      ...options,
      permanentOnly: true,
    }),
  };
}

const cohortRow: CompanionRelationship = {
  relationshipId: 'bond' as Id<'companionRelationship'>,
  role: 'companion',
  kind: 'cohort',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'bryn' as Id<'character'>, name: 'Bryn' },
  linkedInputs: [],
  lastOperationId: 'seed',
  sources: [
    {
      key: 'leadership',
      label: 'Leadership',
      enabled: true,
      available: true,
      ruleKind: 'cohort',
      leadershipModifiers: {
        reputation: ['greatRenown'],
        hasCompanion: false,
        differentAlignment: false,
        cohortDeaths: 0,
        other: 0,
      },
    },
  ],
};

function render(
  snapshot: ReturnType<typeof cohortSnapshot> | ReturnType<typeof buildSheet>,
  rows: CompanionRelationship[] = [],
) {
  return renderHook(() =>
    useCharacterCohort({
      scope: { characterId: snapshot.character._id },
      snapshot,
      rows: rows.map((row) => buildCompanionRelationshipView(row)),
    }),
  );
}

beforeEach(() => {
  server.readOnly = false;
  server.write.mockReset().mockResolvedValue(null);
});

test('a cohort records a published monster equivalence from its own sheet', async () => {
  const { result } = render(cohortSnapshot());
  expect(result.current.view).toMatchObject({
    equivalence: { basisLabel: 'Class Levels', display: '2' },
    leadership: { allowedLabel: '7th level' },
  });
  act(() => result.current.openEquivalence());
  expect(result.current.isEquivalenceOpen).toBe(true);
  expect(result.current.equivalenceForm.getValues()).toEqual({
    kind: 'ordinary',
    creatureKey: '',
    creature: '',
    level: '',
  });
  act(() => {
    result.current.equivalenceForm.setValue('kind', 'published');
    result.current.equivalenceForm.setValue('creatureKey', 'pegasus');
  });
  await act(async () => {
    expect(await result.current.submitEquivalence()).toBe(true);
  });
  expect(server.write).toHaveBeenCalledWith(
    'characterSheet:setCohortEquivalence',
    expect.objectContaining({
      equivalence: { kind: 'published', creatureKey: 'pegasus' },
      operationId: expect.any(String),
    }),
  );
  expect(result.current.isEquivalenceOpen).toBe(false);
});

test('an unlisted creature needs a name, may wait for its equivalence and refuses malformed levels', async () => {
  const { result } = render(
    cohortSnapshot({ kind: 'entered', creature: 'Hippogriff', level: 4 }),
  );
  act(() => result.current.openEquivalence());
  expect(result.current.equivalenceForm.getValues()).toEqual({
    kind: 'entered',
    creatureKey: '',
    creature: 'Hippogriff',
    level: '4',
  });
  act(() => {
    result.current.equivalenceForm.setValue('creature', '  ');
    result.current.equivalenceForm.setValue('level', '4.5');
  });
  await act(async () => {
    expect(await result.current.submitEquivalence()).toBe(false);
  });
  expect(result.current.equivalenceErrors).toMatchObject({
    creature: { message: 'Enter the creature’s name.' },
    level: { message: 'Enter a whole number from 1 to 30.' },
  });
  act(() => {
    result.current.equivalenceForm.setValue('creature', 'Hippogriff');
    result.current.equivalenceForm.setValue('level', '');
  });
  await act(async () => {
    expect(await result.current.submitEquivalence()).toBe(true);
  });
  expect(server.write).toHaveBeenCalledWith(
    'characterSheet:setCohortEquivalence',
    expect.objectContaining({
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: null },
    }),
  );
  act(() => {
    result.current.openEquivalence();
    result.current.equivalenceForm.setValue('kind', 'published');
  });
  await act(async () => {
    expect(await result.current.submitEquivalence()).toBe(false);
  });
  expect(result.current.equivalenceErrors).toMatchObject({
    creatureKey: { message: 'Choose a published monster cohort.' },
  });
  await act(async () => {
    expect(await result.current.clearEquivalence()).toBe(true);
  });
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheet:setCohortEquivalence',
    expect.objectContaining({ equivalence: null }),
  );
});

test('the leader edits a cohort source’s Leadership modifiers with distinct empty and malformed messages', async () => {
  const leader = buildSheet({
    levels: Array.from({ length: 9 }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 6,
    })),
  });
  const { result } = render(leader, [cohortRow]);
  expect(result.current.view).toBeNull();
  // No recorded modifiers: the form starts from the base score.
  expect(result.current.leadershipForm.getValues()).toEqual({
    reputation: [],
    hasCompanion: false,
    differentAlignment: false,
    cohortDeaths: '0',
    other: '0',
  });
  const [source] = result.current.leadershipSources;
  expect(source).toMatchObject({
    key: 'bond/leadership',
    cohortName: 'Bryn',
    score: 11,
    maximumLabel: '7th level',
  });
  if (!source) throw new Error('Missing source');
  act(() => result.current.openLeadership(source));
  expect(result.current.leadershipEditor).toMatchObject({
    key: 'bond/leadership',
  });
  expect(result.current.leadershipForm.getValues()).toEqual({
    reputation: ['greatRenown'],
    hasCompanion: false,
    differentAlignment: false,
    cohortDeaths: '0',
    other: '0',
  });
  act(() => {
    result.current.leadershipForm.setValue('cohortDeaths', '');
    result.current.leadershipForm.setValue('other', '1e1');
  });
  await act(async () => {
    expect(await result.current.submitLeadership()).toBe(false);
  });
  expect(result.current.leadershipErrors).toMatchObject({
    cohortDeaths: { message: 'Enter how many cohorts were killed, or 0.' },
    other: { message: 'Enter a whole number from -20 to 20.' },
  });
  act(() => {
    result.current.leadershipForm.setValue('reputation', [
      'greatRenown',
      'cruelty',
    ]);
    result.current.leadershipForm.setValue('hasCompanion', true);
    result.current.leadershipForm.setValue('cohortDeaths', '1');
    result.current.leadershipForm.setValue('other', '-2');
  });
  await act(async () => {
    expect(await result.current.submitLeadership()).toBe(true);
  });
  expect(server.write).toHaveBeenCalledWith(
    'companionRelationships:setSourceAllocation',
    expect.objectContaining({
      relationshipId: 'bond',
      sourceKey: 'leadership',
      leadership: {
        reputation: ['greatRenown', 'cruelty'],
        hasCompanion: true,
        differentAlignment: false,
        cohortDeaths: 1,
        other: -2,
      },
    }),
  );
  expect(result.current.leadershipEditor).toBeNull();
  expect(result.current.leadershipStatusFor('bond/leadership')).toEqual({
    kind: 'saved',
  });
  await act(async () => {
    expect(await result.current.clearLeadership(source)).toBe(true);
  });
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:setSourceAllocation',
    expect.objectContaining({ leadership: null }),
  );
});

test('maintenance keeps values readable and refuses every cohort write', async () => {
  server.readOnly = true;
  const { result } = render(cohortSnapshot(), [cohortRow]);
  expect(result.current.isDisabled).toBe(true);
  expect(result.current.view?.equivalence.display).toBe('2');
  act(() => result.current.openEquivalence());
  await act(async () => {
    expect(await result.current.submitEquivalence()).toBe(false);
    expect(await result.current.clearEquivalence()).toBe(false);
  });
  const [source] = result.current.leadershipSources;
  if (!source) throw new Error('Missing source');
  await act(async () => {
    expect(await result.current.clearLeadership(source)).toBe(false);
  });
  expect(server.write).not.toHaveBeenCalled();
});
