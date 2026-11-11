import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { representativeAnimalCompanions } from '~/lib/catalog/representative-animal-companions';
import type {
  CompanionProgressionSource,
  AnimalCompanionProgressionState,
} from '~/lib/character-sheet-companion-progression';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import { CharacterCompanionProgression } from './character-companion-progression';
import { CharacterCompanions } from './character-companions';
import {
  buildSheet,
  calculateFixtureSheetProjections,
} from './character-sheet-test-fixture';
import { useCharacterCompanionProgression } from './use-character-companion-progression';
import {
  useCharacterCompanions,
  type CompanionRelationship,
} from './use-character-companions';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The viewed animal Companion's progression (#325): species, effective
// progression level, actual Hit Dice and Class Levels kept apart, sources
// and budgets as supplied, and the recorded choices edited in place.

const server = vi.hoisted(() => ({
  relationships: [] as unknown[] | undefined,
  linkedInput: undefined as unknown,
  write: vi.fn(),
  maintenance: { kind: 'ready', readOnly: false, message: '' },
}));
vi.mock('convex/react', () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(reference);
    if (name === 'companionRelationships:list') return server.relationships;
    // Not a Synthesist: no Combined Form (#421).
    if (name === 'characterSheetCombinedForm:read') return null;
    if (name === 'character:listCampaignCharacters') return [];
    if (name === 'characterSheetLinkedInputs:list')
      return server.linkedInput ? [server.linkedInput] : [];
    throw new Error(`Unexpected query: ${name}`);
  },
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => server.maintenance,
}));

const wolf: AnimalCompanionProgressionState = {
  species: 'wolf',
  hpGained: 27,
  skillRanks: { 'skill.per': 6 },
  abilityIncreases: ['strength'],
  advancementChoice: 'species',
  keep: false,
};
const druidInput = { kind: 'classLevels', classRuleIdentity: 'druid' } as const;
// Saria's side of the relationship, as the viewed Companion sees it.
const saria = {
  relationshipId: 'rel-saria' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'animalCompanion',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'saria' as Id<'character'>, name: 'Saria' },
  sources: [
    {
      key: 'nature-bond',
      label: 'Nature Bond',
      enabled: true,
      available: true,
    },
  ],
  linkedInputs: [{ input: druidInput, classLabel: 'Druid' }],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;

type Source = {
  key: string;
  ruleKind: CompanionProgressionSource['ruleKind'];
  family: string;
  /** Class levels now, or null while unavailable. */
  value: number | null;
  /** Permanent class levels, when they differ. */
  permanent?: number | null;
  counting?: boolean;
  fallback?: number;
  /** This Companion's share of a divided budget (#410), with the budget's totals. */
  allocatedLevels?: number;
  pool?: CompanionProgressionSource['pool'];
};
const natureBond = (value: number | null, more: Partial<Source> = {}) => ({
  key: 'nature-bond',
  ruleKind: 'druidCompanion' as const,
  family: 'druid',
  value,
  ...more,
});

const sheets = new Map<string, CharacterSheetSnapshot>();
const warningControls = {
  accept: vi.fn(),
  reopen: vi.fn(),
  statusFor: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
/** A classless wolf Companion sheet calculated from its granting sources. */
function companionSheet(
  options: Parameters<typeof calculateCompanionSheet>[0] = {},
) {
  const key = JSON.stringify(options);
  const sheet = sheets.get(key) ?? calculateCompanionSheet(options);
  sheets.set(key, sheet);
  return sheet;
}
function calculateCompanionSheet({
  choices = wolf,
  sources = [natureBond(7)],
  lastOperationId = 'seed',
}: {
  choices?: AnimalCompanionProgressionState | null;
  sources?: Source[];
  lastOperationId?: string;
} = {}): CharacterSheetSnapshot {
  const sheet = buildSheet({
    levels: [],
    scores: representativeAnimalCompanions.wolf.scores,
  });
  if (!choices) return { ...sheet, lastOperationId };
  const input = {
    ...sheet,
    characterKind: sheet.character.kind,
    companionProgression: choices,
  };
  const options = (isPermanent: boolean) => ({
    companionProgressionSources: sources.map((source) => ({
      sourceKey: source.key,
      ruleKind: source.ruleKind,
      counting: source.counting ?? true,
      allocatedLevels: source.allocatedLevels,
      pool: source.pool,
    })),
    companionLinkedInputs: [
      ...new Set(sources.map((source) => source.family)),
    ].map((family) => {
      const own = sources.filter((source) => source.family === family);
      return resolveCompanionLinkedInput({
        // Boon Companion reads the associated Character's level, not a class.
        input:
          family === 'boonCompanion'
            ? { kind: 'characterLevel' }
            : { kind: 'classLevels', classRuleIdentity: family },
        candidates: own.map((source) => {
          const value =
            isPermanent && source.permanent !== undefined
              ? source.permanent
              : source.value;
          return value === null
            ? {
                sourceKey: source.key,
                kind: 'unavailable' as const,
                reason: 'interrupted' as const,
              }
            : { sourceKey: source.key, kind: 'available' as const, value };
        }),
        fallback: own.find((source) => source.fallback !== undefined)?.fallback,
      });
    }),
  });
  const calculated = calculateFixtureSheetProjections(input, {
    projectionInputs: { current: options(false), permanent: options(true) },
  });
  return {
    ...sheet,
    lastOperationId,
    entries: sheet.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { ...entry.state, companionProgression: choices } }
        : entry,
    ),
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

beforeEach(() => {
  server.relationships = [saria];
  server.linkedInput = undefined;
  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  server.write.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function Host({ snapshot }: { snapshot: CharacterSheetSnapshot | null }) {
  const controller = useCharacterCompanions(
    { characterId: snapshot?.character._id ?? ('character-1' as never) },
    snapshot,
  );
  return (
    <main>
      <CharacterCompanions
        controller={controller}
        warningController={warningControls}
        characterId={snapshot?.character._id ?? ('character-1' as never)}
      />
    </main>
  );
}
function renderSheet(snapshot: CharacterSheetSnapshot | null) {
  const view = render(<Host snapshot={snapshot} />);
  return {
    rerender: (next: CharacterSheetSnapshot | null) =>
      view.rerender(<Host snapshot={next} />),
  };
}
const progression = () =>
  screen.getByRole('region', { name: 'Animal companion progression' });
const value = (name: string) =>
  within(progression()).getByRole('definition', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const editor = (name: string) => screen.getByRole('form', { name });
const source = (name: string) =>
  within(screen.getByRole('list', { name: 'Granting sources' })).getByRole(
    'listitem',
    { name },
  );
const lastCall = () => server.write.mock.calls.at(-1);
const saveCall = (progression: AnimalCompanionProgressionState) => [
  'characterSheet:setCompanionProgression',
  {
    characterId: 'character-1',
    operationId: expect.any(String),
    progression,
  },
];

test('the Companion sheet keeps effective progression, actual Hit Dice and Class Levels apart, with sources, budgets and the CRB citation; the associated row borrows none of it', () => {
  renderSheet(companionSheet());
  expect(within(progression()).getByText('Wolf')).toBeVisible();
  expect(within(progression()).getByText('Active')).toBeVisible();
  expect(value('Effective progression level')).toHaveTextContent('7');
  expect(value('Actual Hit Dice')).toHaveTextContent('6');
  expect(value('Class Levels')).toHaveTextContent('0');
  expect(value('Base attack bonus')).toHaveTextContent('+4');
  expect(value('General feats')).toHaveTextContent('3');
  expect(value('Skill ranks')).toHaveTextContent('6');
  expect(value('Ability increases')).toHaveTextContent('1');
  expect(value('Bonus tricks')).toHaveTextContent('3');
  const nature = source('Nature bond, Druid');
  expect(nature).toHaveTextContent('Calculated');
  expect(nature).toHaveTextContent('Druid class levels7');
  expect(
    within(progression()).getByRole('link', {
      name: /Pathfinder RPG Core Rulebook, pp\. 51–54, 67/,
    }),
  ).toHaveAttribute('href', expect.stringContaining('aonprd.com'));
  const row = screen.getByRole('listitem', {
    name: 'Associated Character Saria',
  });
  expect(within(row).queryByText('Effective progression level')).toBeNull();
  expect(within(row).queryByText('Wolf')).toBeNull();
  expect(row.compareDocumentPosition(progression())).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});

test("the associated Character's outgoing animal companion row shows no progression of its own", () => {
  server.relationships = [
    {
      ...saria,
      role: 'companion',
      endpoint: { characterId: 'wolf' as Id<'character'>, name: 'Ash' },
    },
  ];
  renderSheet(buildSheet());
  expect(
    screen.queryByRole('region', { name: 'Animal companion progression' }),
  ).toBeNull();
  expect(screen.queryByText('Effective progression level')).toBeNull();
});

test('empty setup offers both curated species as cards and saves the full state for the viewed Character, Class Levels untouched', async () => {
  renderSheet(companionSheet({ choices: null }));
  expect(
    within(progression()).getByText('Choose an animal companion species.'),
  ).toBeVisible();
  fireEvent.click(button('Set up companion progression'));
  const form = editor('Set up companion progression');
  expect(form).toHaveAttribute('novalidate');
  const species = within(form).getByRole('radiogroup', { name: 'Species' });
  expect(within(species).getAllByRole('radio')).toHaveLength(2);
  expect(radio(/^Wolf/)).toHaveFocus();
  expect(radio(/^Wolf/)).not.toBeChecked();
  expect(
    screen.getByRole('checkbox', {
      name: 'Leave hit points unrecorded for now',
    }),
  ).toBeChecked();
  expect(field('Hit points gained')).toHaveValue('');

  fireEvent.click(button('Save companion choices'));
  await waitFor(() =>
    expect(within(form).getByText('Choose a species.')).toBeVisible(),
  );
  expect(server.write).not.toHaveBeenCalled();

  fireEvent.click(radio(/^Horse/));
  expect(radio(/^Horse/)).toBeChecked();
  fireEvent.click(button('Save companion choices'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall({
      species: 'horse',
      hpGained: null,
      skillRanks: {},
      abilityIncreases: [],
      advancementChoice: 'species',
      keep: false,
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'Set up companion progression' }),
    ).toBeNull(),
  );
  expect(button('Set up companion progression')).toHaveFocus();
});

test('invalid hit points and ranks stop the save beside their fields with required and format errors', async () => {
  renderSheet(companionSheet());
  fireEvent.click(button('Edit companion choices'));
  expect(field('Hit points gained')).toHaveValue('27');
  fireEvent.change(field('Hit points gained'), { target: { value: '' } });
  fireEvent.change(field('Perception ranks'), { target: { value: 'six' } });
  fireEvent.change(field('Acrobatics ranks'), { target: { value: '1.5' } });
  fireEvent.click(button('Save companion choices'));
  await waitFor(() =>
    expect(screen.getByText('Enter hit points.')).toBeVisible(),
  );
  expect(field('Hit points gained')).toHaveAttribute('aria-invalid', 'true');
  expect(field('Hit points gained')).toHaveAccessibleDescription(
    'Enter hit points.',
  );
  expect(field('Perception ranks')).toHaveAccessibleDescription(
    'Enter a number.',
  );
  expect(field('Acrobatics ranks')).toHaveAccessibleDescription(
    'Ranks must be a whole number of 0 or more',
  );
  fireEvent.change(field('Hit points gained'), { target: { value: 'lots' } });
  fireEvent.click(button('Save companion choices'));
  await waitFor(() =>
    expect(field('Hit points gained')).toHaveAccessibleDescription(
      'Enter a number.',
    ),
  );
  expect(server.write).not.toHaveBeenCalled();
});

test('over-budget ranks save untrimmed and the engine warnings show beside the recorded choices', async () => {
  const view = renderSheet(companionSheet());
  fireEvent.click(button('Edit companion choices'));
  fireEvent.change(field('Perception ranks'), { target: { value: '9' } });
  fireEvent.click(button('Save companion choices'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall({ ...wolf, skillRanks: { 'skill.per': 9 } }),
  );

  view.rerender(
    companionSheet({ choices: { ...wolf, skillRanks: { per: 9 } } }),
  );
  expect(
    within(progression()).getByText(
      'Recorded ranks exceed the Animal Companion’s 6-rank budget.',
    ),
  ).toBeVisible();
  expect(within(progression()).getByText('Perception 9')).toBeVisible();
});

test('changing advancement or species keeps the recorded hit points, ranks and ability increases, with no hit point prefill', async () => {
  renderSheet(companionSheet());
  expect(radio(/^Species advancement/)).toBeChecked();
  expect(within(progression()).getByText('Applied')).toBeVisible();
  fireEvent.click(radio(/^Dexterity and Constitution instead/));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall({ ...wolf, advancementChoice: 'abilityScores' }),
  );

  fireEvent.click(button('Edit companion choices'));
  fireEvent.click(radio(/^Horse/));
  expect(
    screen.getByText(
      "Changing species keeps this Character's ability scores as they are.",
    ),
  ).toBeVisible();
  expect(field('Hit points gained')).toHaveValue('27');
  expect(field('Perception ranks')).toHaveValue('6');
  expect(field('Strength increases')).toHaveValue('1');
  fireEvent.click(button('Save companion choices'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()).toEqual(saveCall({ ...wolf, species: 'horse' }));
});

test('an unrecorded hit point total stays unrecorded across a species change', async () => {
  renderSheet(companionSheet({ choices: { ...wolf, hpGained: null } }));
  expect(value('Maximum HP')).toHaveTextContent('Unresolved');
  fireEvent.click(button('Edit companion choices'));
  fireEvent.click(radio(/^Horse/));
  expect(field('Hit points gained')).toHaveValue('');
  expect(field('Hit points gained')).toBeDisabled();
  fireEvent.click(button('Save companion choices'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall({ ...wolf, hpGained: null, species: 'horse' }),
  );
});

test('losing one source lowers progression and keeps choices; losing every source reads Not counting now and Unresolved, never zero, with choices still editable', () => {
  const hunters = {
    key: 'hunters-bond',
    ruleKind: 'rangerCompanion' as const,
    family: 'ranger',
    value: 5,
  };
  const view = renderSheet(
    companionSheet({ sources: [natureBond(5), hunters] }),
  );
  expect(value('Effective progression level')).toHaveTextContent('7');
  expect(source('Hunter’s bond, Ranger')).toHaveTextContent('Progression2');
  expect(
    within(progression()).getByRole('list', { name: 'Source restrictions' }),
  ).toHaveTextContent('Hunter’s bond requires Ranger level 4');

  view.rerender(
    companionSheet({
      sources: [natureBond(5), { ...hunters, counting: false }],
    }),
  );
  expect(value('Effective progression level')).toHaveTextContent('5');
  expect(value('Actual Hit Dice')).toHaveTextContent('5');
  expect(source('Hunter’s bond, Ranger')).toHaveTextContent('Not contributing');
  expect(within(progression()).getByText('Perception 6')).toBeVisible();

  view.rerender(
    companionSheet({
      sources: [
        natureBond(5, { counting: false }),
        { ...hunters, counting: false },
      ],
    }),
  );
  expect(within(progression()).getByText('Not counting now')).toBeVisible();
  expect(
    within(progression()).getByText('Recorded choices are retained.'),
  ).toBeVisible();
  for (const name of [
    'Effective progression level',
    'Actual Hit Dice',
    'Maximum HP',
    'Base attack bonus',
    'General feats',
    'Skill ranks',
    'Ability increases',
  ])
    expect(value(name)).toHaveTextContent('Unresolved');
  expect(value('Class Levels')).toHaveTextContent('0');
  expect(
    within(progression()).getByText(
      'Advancement needs an available source level.',
    ),
  ).toBeVisible();
  expect(within(progression()).queryByText('Not reached yet')).toBeNull();
  expect(within(progression()).getByText('Perception 6')).toBeVisible();
  expect(button('Edit companion choices')).toBeEnabled();
  expect(radio(/^Dexterity and Constitution instead/)).toBeEnabled();
});

test('a Beast Master share reads its allocation on the Companion sheet; an unallocated share is Unresolved and asks for levels', () => {
  const beastMaster = {
    key: 'beast-master',
    ruleKind: 'beastMasterCompanion' as const,
    family: 'ranger',
    value: 7,
  };
  const view = renderSheet(
    companionSheet({
      sources: [
        {
          ...beastMaster,
          allocatedLevels: 2,
          pool: { allocated: 6, companions: 2, selections: 1 },
        },
      ],
    }),
  );
  const share = source('Beast Master, Ranger');
  expect(share).toHaveTextContent('Ranger class levels7');
  expect(share).toHaveTextContent('Progression2');
  expect(
    within(share).getByText(
      '2 of 4 effective levels allocated here; 6 allocated across 2 companions.',
    ),
  ).toBeVisible();
  expect(value('Effective progression level')).toHaveTextContent('2');

  view.rerender(companionSheet({ sources: [beastMaster] }));
  expect(
    within(source('Beast Master, Ranger')).getByText(
      'No effective levels allocated here.',
    ),
  ).toBeVisible();
  expect(value('Effective progression level')).toHaveTextContent('Unresolved');
  expect(
    within(progression()).getByText(
      'Allocate Beast Master effective levels to this companion.',
    ),
  ).toBeVisible();
});

test('a Boon Companion row shows what it adds and its Progression, with no class levels pair', () => {
  renderSheet(
    companionSheet({
      sources: [
        natureBond(5),
        {
          key: 'boon',
          ruleKind: 'boonCompanion',
          family: 'boonCompanion',
          value: 10,
        },
      ],
    }),
  );
  const boon = source('Boon Companion, Character level');
  expect(boon).toHaveTextContent('Calculated');
  expect(
    within(boon).getByText(
      'Up to 4 more effective levels, to at most character level 10.',
    ),
  ).toBeVisible();
  expect(boon).toHaveTextContent('Progression4');
  expect(within(boon).queryByText(/class levels/)).toBeNull();
  expect(within(boon).queryByText('Unresolved')).toBeNull();
  expect(value('Effective progression level')).toHaveTextContent('9');
});

test('an applied fallback and a suspended one read differently beside the #317 fallback editor, and restoration leaves an open draft alone', () => {
  server.linkedInput = {
    input: druidInput,
    status: 'unavailable',
    resolution: 'fallback',
    value: 7,
    fallback: 7,
    fallbackState: 'applied',
    candidates: [],
    contributions: [],
    prerequisiteStatus: 'unresolved',
    interpretation: null,
    revision: 1,
    lastOperationId: 'seed',
    updatedBy: null,
    sources: [],
    unavailableReason: 'interrupted',
  };
  const view = renderSheet(
    companionSheet({ sources: [natureBond(null, { fallback: 7 })] }),
  );
  expect(source('Nature bond, Druid')).toHaveTextContent(
    'Using saved fallback',
  );
  expect(value('Effective progression level')).toHaveTextContent('7');
  expect(button('Edit fallback for Druid class levels')).toBeEnabled();

  fireEvent.click(button('Edit companion choices'));
  fireEvent.change(field('Perception ranks'), { target: { value: '4' } });
  view.rerender(companionSheet({ sources: [natureBond(3, { fallback: 7 })] }));
  const restored = source('Nature bond, Druid');
  expect(restored).toHaveTextContent('Calculated');
  expect(restored).toHaveTextContent(
    'Saved fallback is retained; the source value applies.',
  );
  expect(value('Effective progression level')).toHaveTextContent('3');
  expect(field('Perception ranks')).toHaveValue('4');
  expect(field('Hit points gained')).toHaveValue('27');
  expect(server.write).not.toHaveBeenCalled();
});

test('Current and Permanent each show their own supplied projection', () => {
  renderSheet(companionSheet({ sources: [natureBond(7, { permanent: 3 })] }));
  expect(radio('Current')).toBeChecked();
  expect(value('Effective progression level')).toHaveTextContent('7');
  expect(value('Actual Hit Dice')).toHaveTextContent('6');
  expect(within(progression()).queryByText(/Recorded ranks exceed/)).toBeNull();

  fireEvent.click(radio('Permanent'));
  expect(radio('Permanent')).toBeChecked();
  expect(value('Effective progression level')).toHaveTextContent('3');
  expect(value('Actual Hit Dice')).toHaveTextContent('3');
  expect(within(progression()).getByText('Not reached yet')).toBeVisible();
  expect(
    within(progression()).getByText(/Recorded ranks exceed.*rank budget/),
  ).toBeVisible();

  fireEvent.click(radio('Current'));
  expect(value('Effective progression level')).toHaveTextContent('7');
});

test('Saving, Saved, a failure and its retry stay beside the edited control; a failed save keeps the draft, a saved one returns focus to the opener', async () => {
  renderSheet(companionSheet());
  let finish: ((value: null) => void) | undefined;
  server.write.mockReturnValueOnce(
    new Promise<null>((resolve) => {
      finish = resolve;
    }),
  );
  fireEvent.click(screen.getByRole('switch', { name: /Keep recorded/ }));
  expect(lastCall()).toEqual(saveCall({ ...wolf, keep: true }));
  expect(screen.getByText('Saving…')).toBeVisible();
  expect(screen.getByRole('switch', { name: /Keep recorded/ })).toBeDisabled();
  expect(radio(/^Species advancement/)).toBeDisabled();
  await act(async () => finish?.(null));
  expect(screen.getByText('Saved')).toBeVisible();

  fireEvent.click(button('Edit companion choices'));
  fireEvent.change(field('Perception ranks'), { target: { value: '5' } });
  server.write.mockRejectedValueOnce(new Error('Connection lost'));
  fireEvent.click(button('Save companion choices'));
  const form = editor('Edit companion choices');
  await waitFor(() =>
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Companion Progression may not have been saved. Check it before trying again.',
    ),
  );
  expect(field('Perception ranks')).toHaveValue('5');

  fireEvent.click(button('Save companion choices'));
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'Edit companion choices' }),
    ).toBeNull(),
  );
  expect(lastCall()).toEqual(
    saveCall({ ...wolf, skillRanks: { 'skill.per': 5 } }),
  );
  expect(button('Edit companion choices')).toHaveFocus();
  expect(within(progression()).getByText('Saved')).toBeVisible();

  fireEvent.click(button('Edit companion choices'));
  fireEvent.change(field('Perception ranks'), { target: { value: '1' } });
  fireEvent.keyDown(field('Perception ranks'), { key: 'Escape' });
  expect(screen.queryByRole('form')).toBeNull();
  expect(button('Edit companion choices')).toHaveFocus();
  expect(server.write).toHaveBeenCalledTimes(3);
});

test("another player's change is announced and dismissed while the edited field keeps its draft and untouched fields refresh", () => {
  const view = renderSheet(companionSheet());
  fireEvent.click(button('Edit companion choices'));
  fireEvent.change(field('Perception ranks'), { target: { value: '4' } });
  view.rerender(
    companionSheet({
      choices: { ...wolf, hpGained: 30, skillRanks: { per: 2 } },
      lastOperationId: 'other-player',
    }),
  );
  const notice =
    'Companion progression updated by another player. Your edits are kept.';
  expect(screen.getAllByText(notice)).toHaveLength(1);
  expect(field('Perception ranks')).toHaveValue('4');
  expect(field('Hit points gained')).toHaveValue('30');
  fireEvent.click(button('Dismiss companion progression update'));
  expect(screen.queryByText(notice)).toBeNull();
  expect(field('Perception ranks')).toHaveValue('4');
});

test('maintenance explains itself once and disables edits while the calculated sources and citations stay readable', () => {
  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  renderSheet(companionSheet());
  expect(button('Edit companion choices')).toBeDisabled();
  expect(button('Edit companion choices')).toHaveAccessibleDescription(message);
  expect(radio(/^Dexterity and Constitution instead/)).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: /Keep recorded/ }),
  ).toHaveAccessibleDescription(new RegExp(message));
  expect(screen.getByRole('switch', { name: /Keep recorded/ })).toBeDisabled();
  expect(screen.getAllByText(message)).toHaveLength(1);
  expect(value('Effective progression level')).toHaveTextContent('7');
  expect(source('Nature bond, Druid')).toHaveTextContent('Calculated');
  expect(
    within(progression()).getByRole('link', { name: /Core Rulebook/ }),
  ).toBeVisible();
});

function LoadingHost() {
  const controller = useCharacterCompanionProgression(
    { characterId: 'character-1' as Id<'character'> },
    undefined,
  );
  return (
    <CharacterCompanionProgression
      controller={controller}
      warningController={warningControls}
      characterId={'character-1' as Id<'character'>}
      isAnimalCompanion
    />
  );
}

test('loading and an unavailable sheet disclose no names, links or totals', () => {
  const view = render(<LoadingHost />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading companion progression…',
  );
  expect(screen.queryByRole('button')).toBeNull();
  view.unmount();

  renderSheet(null);
  expect(document.body.textContent).toBe('');
  expect(screen.queryByRole('link')).toBeNull();
});

// Phone below 768px, tablet above; reduced motion asked for at both.
function stubViewport(isWide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') || isWide,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

test.each([
  { isWide: false, label: 'phone' },
  { isWide: true, label: 'tablet' },
])(
  'on the $label each progression control is named once and touch-sized',
  ({ isWide }) => {
    stubViewport(isWide);
    renderSheet(companionSheet());
    const control = button('Edit companion choices');
    expect(
      screen.getAllByRole('button', { name: 'Edit companion choices' }),
    ).toHaveLength(1);
    expect(control).toHaveClass('min-h-11');
    expect(screen.getByRole('switch', { name: /Keep recorded/ })).toHaveClass(
      'min-h-11',
      'md:min-h-7',
    );
    for (const name of [
      /^Species advancement/,
      /^Dexterity and Constitution instead/,
      'Current',
      'Permanent',
    ]) {
      expect(screen.getAllByRole('radio', { name })).toHaveLength(1);
      expect(radio(name).closest('label')).toHaveClass('min-h-11');
    }
    expect(radio(/^Species advancement/).closest('label')).toHaveClass(
      'motion-reduce:transition-none',
    );
    fireEvent.click(control);
    expect(field('Hit points gained')).toHaveClass('h-11', 'md:h-8');
    expect(field('Perception ranks')).toHaveClass('h-11', 'md:h-8');
  },
);
