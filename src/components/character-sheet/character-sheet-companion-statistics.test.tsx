import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  calculateFixtureSheetProjections,
  emptyOwnerCandidates,
} from './character-sheet-test-fixture';
import type { CompanionRelationship } from './character-companions-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

let snapshot: CharacterSheetSnapshot;
const server = vi.hoisted(() => ({ write: vi.fn() }));
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>, args: unknown) => {
    const name = nameOf(query);
    if (args === 'skip') return undefined;
    if (name === 'read') return snapshot;
    if (name === 'companions') return [association];
    if (name === 'listLinkedInputs') return [];
    return undefined;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: unknown) => server.write(name, args);
  },
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

const association: CompanionRelationship = {
  relationshipId: 'nature-bond' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'animalCompanion',
  status: 'active',
  interruption: null,
  endpoint: null,
  sources: [],
  linkedInputs: [],
  lastOperationId: 'seed',
};
const choices: AnimalCompanionProgressionState = {
  species: 'wolf',
  hpGained: 27,
  skillRanks: { per: 9 },
  abilityIncreases: ['strength'],
  advancementChoice: 'species',
  keep: false,
};

function companionSheet({
  isAvailable = true,
  hasProgression = true,
  permanentLevel,
}: {
  isAvailable?: boolean;
  hasProgression?: boolean;
  permanentLevel?: number;
} = {}) {
  const sheet = buildSheet({ levels: [], race: { key: 'human' } });
  const input = {
    ...sheet,
    characterKind: 'npc' as const,
    ...(hasProgression ? { companionProgression: choices } : {}),
  };
  const projection = {
    companionProgressionSources: [
      {
        sourceKey: 'nature-bond',
        ruleKind: 'druidCompanion' as const,
        counting: true,
      },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'druid' },
        candidates: [
          isAvailable
            ? { sourceKey: 'nature-bond', kind: 'available', value: 7 }
            : {
                sourceKey: 'nature-bond',
                kind: 'unavailable',
                reason: 'interrupted',
              },
        ],
      }),
    ],
  };
  const calculated = calculateFixtureSheetProjections(input, {
    projectionInputs: {
      current: projection,
      permanent:
        permanentLevel === undefined
          ? projection
          : {
              ...projection,
              companionLinkedInputs: [
                resolveCompanionLinkedInput({
                  input: { kind: 'classLevels', classRuleIdentity: 'druid' },
                  candidates: [
                    {
                      sourceKey: 'nature-bond',
                      kind: 'available',
                      value: permanentLevel,
                    },
                  ],
                }),
              ],
            },
    },
  });
  return {
    ...sheet,
    character: { ...sheet.character, kind: 'npc' as const },
    entries: sheet.entries.map((entry) =>
      entry.kind === 'base' && hasProgression
        ? { ...entry, state: { ...entry.state, companionProgression: choices } }
        : entry,
    ),
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

beforeEach(() => {
  server.write.mockReset().mockResolvedValue(null);
});

test('companion rules warnings use the sheet Accept and Reopen controller without changing progression', async () => {
  snapshot = companionSheet();
  const view = render(<CharacterSheetBlocks blocks={['companions']} />);
  const message = 'Recorded ranks exceed the Animal Companion’s 6-rank budget.';
  const region = screen.getByRole('region', {
    name: 'Companions',
  });
  const warning = snapshot.calculated.warnings.find(
    (row) => row.check === 'companionSkillRankBudget',
  );
  if (!warning) throw new Error('Expected companion rank warning');
  const before = snapshot.calculated.companionProgression;
  fireEvent.click(
    within(region).getByRole('button', {
      name: 'Accept',
      description: message,
    }),
  );
  await waitFor(() =>
    expect(server.write).toHaveBeenCalledWith(
      'accept',
      expect.objectContaining({
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      }),
    ),
  );
  snapshot = {
    ...snapshot,
    acceptedWarnings: [
      {
        _id: 'accepted' as Id<'acceptedWarning'>,
        _creationTime: 1,
        characterId: snapshot.character._id,
        acceptedBy: 'owner',
        acceptedAt: 1,
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      },
    ],
  };
  view.rerender(<CharacterSheetBlocks blocks={['companions']} />);
  expect(within(region).getByText('Accepted')).toBeVisible();
  expect(snapshot.calculated.companionProgression).toEqual(before);
  fireEvent.click(
    within(region).getByRole('button', {
      name: 'Reopen',
      description: message,
    }),
  );
  await waitFor(() =>
    expect(server.write).toHaveBeenCalledWith(
      'reopen',
      expect.objectContaining({
        check: warning.check,
        subject: warning.subject,
      }),
    ),
  );
});

test('unavailable progression reads Unresolved for the main Hit Dice, attack, saves, physical scores and racial feat budget, then restores finished values', () => {
  snapshot = companionSheet({ isAvailable: false });
  const blocks = [
    'summary',
    'offense',
    'defenses',
    'scores',
    'races',
    'companions',
  ] as const;
  const view = render(<CharacterSheetBlocks blocks={[...blocks]} />);
  for (const hitDice of screen.getAllByText('Hit Dice', { selector: 'dt' }))
    expect(hitDice.nextElementSibling).toHaveTextContent('Unresolved');
  for (const name of [
    'Base attack bonus',
    'Fortitude save',
    'Reflex save',
    'Will save',
    'Strength',
    'Dexterity',
    'Constitution',
  ])
    expect(
      screen.getByRole('button', { name: `${name} Unresolved, breakdown` }),
    ).toBeVisible();
  const featBudget = screen.getByText('Feat budget', {
    selector: 'dt',
  }).nextElementSibling;
  expect(featBudget).toHaveTextContent('Unresolved');
  const companion = screen.getByRole('region', {
    name: 'Companions',
  });
  expect(
    within(companion).queryByRole('button', { name: 'Accept' }),
  ).toBeNull();
  const strength = screen.getByRole('button', {
    name: 'Strength Unresolved, breakdown',
  });
  fireEvent.click(strength);
  const breakdown = screen.getByRole('group', { name: 'Strength breakdown' });
  expect(
    within(breakdown).getByText('Known contributions (partial)'),
  ).toBeVisible();
  expect(
    within(breakdown).getByText(
      'Some animal companion statistics need an available progression level.',
    ),
  ).toBeVisible();

  snapshot = companionSheet();
  view.rerender(<CharacterSheetBlocks blocks={[...blocks]} />);
  for (const hitDice of screen.getAllByText('Hit Dice', { selector: 'dt' }))
    expect(hitDice.nextElementSibling).toHaveTextContent('6');
  expect(featBudget).toHaveTextContent('3');
  expect(
    screen.getByRole('button', { name: 'Base attack bonus +4, breakdown' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Strength Unresolved, breakdown' }),
  ).toBeNull();
});

test('a refused companion warning acceptance stays beside the warning and can be retried', async () => {
  snapshot = companionSheet();
  render(<CharacterSheetBlocks blocks={['companions']} />);
  const message = 'Recorded ranks exceed the Animal Companion’s 6-rank budget.';
  const region = screen.getByRole('region', {
    name: 'Companions',
  });
  server.write.mockRejectedValueOnce(new ConvexError('Editing is paused'));
  fireEvent.click(
    within(region).getByRole('button', {
      name: 'Accept',
      description: message,
    }),
  );
  await waitFor(() =>
    expect(within(region).getByRole('alert')).toHaveTextContent(
      "Warning wasn't saved: Editing is paused. Try again.",
    ),
  );
  const accept = within(region).getByRole('button', {
    name: 'Accept',
    description: message,
  });
  expect(accept).toBeEnabled();
  fireEvent.click(accept);
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
});

test('another player accepting a warning announces the warning change without announcing a progression change', () => {
  snapshot = companionSheet();
  const view = render(<CharacterSheetBlocks blocks={['companions']} />);
  const warning = snapshot.calculated.warnings.find(
    (row) => row.check === 'companionSkillRankBudget',
  );
  if (!warning) throw new Error('Expected companion rank warning');
  snapshot = {
    ...snapshot,
    lastOperationId: 'another-player',
    acceptedWarnings: [
      {
        _id: 'accepted' as Id<'acceptedWarning'>,
        _creationTime: 1,
        characterId: snapshot.character._id,
        acceptedBy: 'other',
        acceptedAt: 1,
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      },
    ],
  };
  view.rerender(<CharacterSheetBlocks blocks={['companions']} />);
  expect(screen.getByText('Warnings updated by another player.')).toBeVisible();
  expect(
    screen.queryByText(
      'Companion progression updated by another player. Your edits are kept.',
    ),
  ).toBeNull();
});

test('a linked animal companion awaiting its species keeps progression-dependent main-sheet statistics unresolved', () => {
  snapshot = companionSheet({ hasProgression: false });
  render(
    <CharacterSheetBlocks
      blocks={[
        'summary',
        'offense',
        'defenses',
        'scores',
        'races',
        'companions',
      ]}
    />,
  );
  for (const hitDice of screen.getAllByText('Hit Dice', { selector: 'dt' }))
    expect(hitDice.nextElementSibling).toHaveTextContent('Unresolved');
  for (const name of [
    'Base attack bonus',
    'Fortitude save',
    'Reflex save',
    'Will save',
    'Strength',
    'Dexterity',
    'Constitution',
  ])
    expect(
      screen.getByRole('button', { name: `${name} Unresolved, breakdown` }),
    ).toBeVisible();
  expect(
    screen.getByText('Feat budget', { selector: 'dt' }).nextElementSibling,
  ).toHaveTextContent('Unresolved');
  fireEvent.click(
    screen.getByRole('button', { name: 'Strength Unresolved, breakdown' }),
  );
  const breakdown = screen.getByRole('group', { name: 'Strength breakdown' });
  expect(
    within(breakdown).getByText(
      'Some animal companion statistics need an available progression level.',
    ),
  ).toBeVisible();
});

test('another player accepting a permanent-projection warning is announced by the sheet warnings controller', () => {
  snapshot = companionSheet({ permanentLevel: 3 });
  const view = render(<CharacterSheetBlocks blocks={['companions']} />);
  const warning = snapshot.permanentCalculated.warnings.find(
    (row) => row.check === 'companionSkillRankBudget',
  );
  if (!warning) throw new Error('Expected permanent companion rank warning');
  snapshot = {
    ...snapshot,
    lastOperationId: 'another-player',
    acceptedWarnings: [
      {
        _id: 'accepted' as Id<'acceptedWarning'>,
        _creationTime: 1,
        characterId: snapshot.character._id,
        acceptedBy: 'other',
        acceptedAt: 1,
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      },
    ],
  };
  view.rerender(<CharacterSheetBlocks blocks={['companions']} />);
  expect(screen.getByText('Warnings updated by another player.')).toBeVisible();
  expect(
    screen.queryByText(
      'Companion progression updated by another player. Your edits are kept.',
    ),
  ).toBeNull();
});
