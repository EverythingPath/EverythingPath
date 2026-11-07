import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import type { FunctionReference } from 'convex/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { eidolonBaseForms } from '~/lib/catalog/representative-eidolons';
import type { EidolonProgressionState } from '~/lib/character-sheet-eidolon-progression';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import { CharacterCompanions } from './character-companions';
import {
  newEidolonProgression,
  withEidolonSubtype,
  withEidolonSubtypeChoice,
  withEidolonVersion,
} from './character-eidolon-progression-view-model';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import {
  buildSheet,
  calculateFixtureSheetProjections,
} from './character-sheet-test-fixture';
import {
  useCharacterCompanions,
  type CompanionRelationship,
} from './use-character-companions';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The Unchained eidolon on the Companion sheet (#418): its version and
// subtype chosen as cards, the subtype's fixed evolutions locked in the
// list, its choices prompted where they apply, and every recorded choice
// the current rules do not apply kept in sight rather than deleted.

const nameOf = characterSheetNames();
const server = vi.hoisted(() => ({
  relationships: [] as unknown[] | undefined,
  write: vi.fn(),
  maintenance: { kind: 'ready', readOnly: false, message: '' },
}));
vi.mock('convex/react', () => ({
  useQuery: (reference: FunctionReference<'query'>, args: unknown) => {
    if (args === 'skip') return undefined;
    const name = nameOf(reference);
    // Not a Synthesist: no Combined Form (#421).
    if (name === 'combinedForm') return null;
    if (name === 'companions') return server.relationships;
    if (name === 'listCampaignCharacters') return [];
    if (name === 'listLinkedInputs') return [];
    throw new Error(`Unexpected query: ${name}`);
  },
  useMutation: (reference: FunctionReference<'mutation'>) => (args: unknown) =>
    server.write(nameOf(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => server.maintenance,
}));

// An archon at summoner level 8: its 8th-level Ability Increase still needs
// its choice, and its 4th-level pool bonus adds a point.
const archon: EidolonProgressionState = {
  ...withEidolonSubtype(newEidolonProgression('biped', 'unchained'), 'archon'),
  hpGained: 40,
  evolutions: [{ key: 'bite' }],
};
const summonerInput = {
  kind: 'classLevels',
  classRuleIdentity: 'summoner',
} as const;
const mira = {
  relationshipId: 'rel-mira' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'unchainedEidolon',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'mira' as Id<'character'>, name: 'Mira' },
  sources: [
    { key: 'eidolon', label: 'Eidolon', enabled: true, available: true },
  ],
  linkedInputs: [{ input: summonerInput, classLabel: 'Unchained summoner' }],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;

type Options = {
  choices?: EidolonProgressionState | null;
  level?: number;
  /** Which version's summoner levels support the eidolon. */
  ruleKind?: 'eidolon' | 'unchainedEidolon';
  lastOperationId?: string;
};
const sheets = new Map<string, CharacterSheetSnapshot>();
const warningControls = {
  accept: vi.fn(),
  reopen: vi.fn(),
  statusFor: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
function eidolonSheet(options: Options = {}) {
  const key = JSON.stringify(options);
  const sheet = sheets.get(key) ?? calculateEidolonSheet(options);
  sheets.set(key, sheet);
  return sheet;
}
function calculateEidolonSheet({
  choices = archon,
  level = 8,
  ruleKind = 'unchainedEidolon',
  lastOperationId = 'seed',
}: Options): CharacterSheetSnapshot {
  const sheet = buildSheet({
    levels: [],
    scores: eidolonBaseForms.biped.scores,
  });
  if (!choices) return { ...sheet, lastOperationId };
  const input = {
    ...sheet,
    characterKind: sheet.character.kind,
    companionProgression: choices,
  };
  const projection = {
    companionProgressionSources: [
      { sourceKey: 'eidolon', ruleKind, counting: true },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: summonerInput,
        candidates: [
          { sourceKey: 'eidolon', kind: 'available' as const, value: level },
        ],
      }),
    ],
  };
  const calculated = calculateFixtureSheetProjections(input, {
    projectionInputs: { current: projection, permanent: projection },
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
  server.relationships = [mira];
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
  screen.getByRole('region', { name: 'Eidolon progression' });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const list = (name: string) => screen.getByRole('list', { name });
const row = (listName: string, name: string) =>
  within(list(listName)).getByRole('listitem', { name });
const lastCall = () => server.write.mock.calls.at(-1);
const saveCall = (progression: EidolonProgressionState) => [
  'setCompanionProgression',
  {
    characterId: 'character-1',
    operationId: expect.any(String),
    progression,
  },
];
// Phone below 768px, tablet above; reduced motion asked for at both.
function stubViewport(isWide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') || isWide,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

test('an Unchained link chooses a version and a base form, then a subtype from twelve cards, and each choice saves the whole record', async () => {
  const view = renderSheet(eidolonSheet({ choices: null }));
  const versions = within(progression()).getByRole('radiogroup', {
    name: 'Version',
  });
  expect(within(versions).getAllByRole('radio')).toHaveLength(2);
  expect(radio(/^Unchained/)).toBeChecked();
  expect(radio(/^Unchained/).closest('label')).toHaveTextContent(
    'Pathfinder Unchained eidolon with a subtype, for Unchained summoner levels.',
  );
  expect(screen.queryByRole('list', { name: 'Subtypes' })).toBeNull();
  fireEvent.click(button('Quadruped'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  const quadruped = newEidolonProgression('quadruped', 'unchained');
  expect(lastCall()).toEqual(saveCall(quadruped));

  view.rerender(eidolonSheet({ choices: quadruped }));
  expect(within(progression()).getByText('Unchained')).toHaveClass('font-mono');
  expect(
    within(progression()).getByText('Choose the eidolon’s subtype.'),
  ).toHaveClass('text-sky-300');
  expect(within(progression()).getByText('Not chosen yet')).toHaveClass(
    'ring-sky-400/80',
  );
  const cards = within(list('Subtypes')).getAllByRole('button');
  expect(cards).toHaveLength(12);
  expect(cards[0]).toHaveAccessibleName('Agathion');
  expect(button('Archon')).toHaveAccessibleDescription(
    /^Lawful good Base forms Biped: .*Evolutions 1st: Resistance \(Electricity\), Skilled \(Intimidate\) · 8th: Ability Increase/,
  );
  expect(button('Protean')).toHaveAccessibleDescription(
    /Serpentine: Bite, Grab \(Tail slap\), Tail, Tail Slap/,
  );
  fireEvent.click(button('Angel'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()).toEqual(saveCall(withEidolonSubtype(quadruped, 'angel')));
  expect(within(progression()).getByText('Saved')).toBeVisible();
  expect(progression().textContent).not.toMatch(
    /unchainedEidolon|abilityIncrease-8|sourceKey|builtin:/,
  );
});

test('choosing Original before the base form records an original eidolon, which is never asked for a subtype', async () => {
  const view = renderSheet(eidolonSheet({ choices: null }));
  fireEvent.click(radio(/^Original/));
  fireEvent.click(button('Biped'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall(newEidolonProgression('biped')));
  view.rerender(
    eidolonSheet({
      choices: newEidolonProgression('biped'),
      ruleKind: 'eidolon',
    }),
  );
  expect(within(progression()).getByText('Original')).toHaveClass('font-mono');
  expect(screen.queryByText('Choose the eidolon’s subtype.')).toBeNull();
  expect(within(progression()).queryByText('Subtype')).toBeNull();
});

test('the subtype counts with its fixed evolutions locked, its pool bonus named, and its missing choice prompted on the row that needs it, saving the whole record', async () => {
  renderSheet(eidolonSheet());
  expect(within(progression()).getByText('Archon')).toBeVisible();
  expect(within(progression()).getByText('Lawful good')).toHaveClass(
    'font-mono',
  );
  expect(within(progression()).getByText('Active')).toBeVisible();
  expect(
    within(progression()).getByText(
      'Evolution pool 7 (6 + Archon subtype (4th level) 1) · spent 1 · 6 left',
    ),
  ).toBeVisible();
  const skilled = row('Evolutions', 'Skilled (Intimidate)');
  expect(skilled).toHaveTextContent('Archon subtype, 1st level');
  expect(skilled).toHaveTextContent('From the subtype');
  expect(within(skilled).queryByRole('button')).toBeNull();
  expect(within(row('Evolutions', 'Slam')).queryByRole('button')).toBeNull();
  expect(
    within(row('Evolutions', 'Bite')).getByRole('button', {
      name: 'Remove Bite',
    }),
  ).toBeEnabled();

  const increase = row('Evolutions', 'Ability Increase');
  expect(increase).toHaveTextContent('Archon subtype, 8th level');
  const prompt = within(increase).getByText(
    'Choose the Archon subtype’s Ability Increase (8th level).',
  );
  expect(prompt).toHaveClass('text-sky-300');
  const options = within(increase).getByRole('radiogroup', {
    name: 'Choose the Archon subtype’s Ability Increase (8th level).',
  });
  expect(within(options).getAllByRole('radio')).toHaveLength(6);
  // The sheet's own incomplete warning says the same; the control is asked once.
  expect(
    within(progression()).getAllByText(
      'Choose the Archon subtype’s Ability Increase (8th level).',
    ),
  ).toHaveLength(2);
  fireEvent.click(within(options).getByRole('radio', { name: 'Wisdom' }));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall(
      withEidolonSubtypeChoice(archon, 'archon-abilityIncrease-8', 'wisdom'),
    ),
  );
  expect(within(increase).getByText('Saved')).toBeVisible();
});

test('a subtype change keeps the former subtype’s choice under Not counting now, where Discard asks first and then saves the record without it', async () => {
  const angel = withEidolonSubtype(
    withEidolonSubtypeChoice(archon, 'archon-abilityIncrease-8', 'wisdom'),
    'angel',
  );
  renderSheet(eidolonSheet({ choices: angel }));
  expect(within(progression()).getByText('Angel')).toBeVisible();
  expect(within(progression()).getByText('Any good')).toBeVisible();
  const group = button('Not counting now (1)');
  expect(group).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('list', { name: /Not counting now/ })).toBeNull();
  fireEvent.click(group);
  const entry = row(
    'Not counting now (1)',
    'Archon: Ability Increase (8th level): Wisdom',
  );
  expect(entry).toHaveTextContent('Belongs to another subtype');
  expect(within(entry).queryByRole('button', { name: /Keep/ })).toBeNull();
  fireEvent.click(within(entry).getByRole('button', { name: /^Discard/ }));
  expect(server.write).not.toHaveBeenCalled();
  const question = within(entry).getByRole('group', {
    name: 'Discard Archon: Ability Increase (8th level): Wisdom?',
  });
  expect(
    within(question).getByRole('button', { name: /^Cancel/ }),
  ).toHaveFocus();
  fireEvent.click(
    within(question).getByRole('button', { name: /^Discard Archon/ }),
  );
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall({ ...angel, subtypeChoices: [] }));
  await waitFor(() =>
    expect(within(entry).queryByRole('group', { name: /Discard/ })).toBeNull(),
  );
  expect(within(entry).getByRole('button', { name: /^Discard/ })).toHaveFocus();
});

test('summoner levels of the other version read Unresolved with the mismatch warning, the source listed as not counting, and Convert saves the other version with every evolution kept', async () => {
  renderSheet(eidolonSheet({ ruleKind: 'eidolon' }));
  expect(
    within(progression()).getAllByText('Unresolved', { selector: 'span' })[0],
  ).toHaveClass('ring-sky-400/80');
  expect(
    within(progression()).getByText(
      /An Unchained eidolon advances only from summoner levels of its own version/,
    ),
  ).toBeVisible();
  const source = row('Granting sources', 'Eidolon, Summoner');
  expect(source).toHaveTextContent('Original summoner levels');
  expect(source).toHaveTextContent('Not counting');
  expect(within(source).getByText('Original summoner levels')).toHaveClass(
    'text-muted-foreground',
  );
  expect(row('Evolutions', 'Bite')).toBeVisible();
  expect(
    within(progression()).getByText('Your other choices are kept.'),
  ).toBeVisible();
  fireEvent.click(button('Convert to an Original eidolon'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall(withEidolonVersion(archon, 'original')));
  expect(
    (lastCall()?.[1] as { progression: EidolonProgressionState }).progression
      .evolutions,
  ).toEqual([{ key: 'bite' }]);
});

test('a recorded Damage Reduction choice the Unchained rules do not offer is struck through and kept, and the picker names subtype requirements, Pounce’s Unchained cost and Damage Reduction without an option', async () => {
  renderSheet(
    eidolonSheet({
      choices: {
        ...archon,
        evolutions: [{ key: 'damageReduction', choice: 'evil' }],
      },
    }),
  );
  const reduction = row('Evolutions', 'Damage Reduction (Evil)');
  expect(within(reduction).getByText('(Evil)')).toHaveClass('line-through');
  expect(reduction).toHaveTextContent('Choice not part of the Unchained rules');
  expect(reduction).toHaveTextContent('3 points');
  expect(
    within(reduction).getByRole('button', {
      name: 'Remove Damage Reduction (Evil)',
    }),
  ).toBeEnabled();
  expect(
    within(progression()).getByText(
      /Damage Reduction: its recorded choice is not part of the Unchained rules/,
    ),
  ).toBeVisible();

  fireEvent.click(button('Add evolution'));
  const picker = screen.getByRole('dialog', { name: 'Add an evolution' });
  const bite = within(picker).getByRole('radio', { name: /^Bite/ });
  expect(bite).toBeEnabled();
  expect(bite.closest('label')).toHaveTextContent(
    'Agathion, Daemon, Demon, Devil, Div, Elemental, Protean, Psychopomp onlyNot for the Archon subtype.',
  );
  const pounce = within(picker).getByRole('radio', { name: /^Pounce/ });
  expect(pounce.closest('label')).toHaveTextContent('3 points');
  expect(pounce.closest('label')).toHaveTextContent('Summoner level 7');
  fireEvent.click(
    within(picker).getByRole('radio', { name: /^Damage Reduction/ }),
  );
  expect(
    within(picker).queryByRole('radiogroup', {
      name: 'Damage Reduction option',
    }),
  ).toBeNull();
  expect(
    within(picker)
      .getByRole('radio', { name: /^Damage Reduction/ })
      .closest('label'),
  ).toHaveTextContent(/subtype/);
});

test('the editor offers the version, the base form with the subtype’s allowed forms marked, the subtype and its choices, and writes only what changed', async () => {
  renderSheet(
    eidolonSheet({
      choices: {
        ...withEidolonSubtypeChoice(
          archon,
          'archon-abilityIncrease-8',
          'wisdom',
        ),
        baseForm: 'quadruped',
      },
    }),
  );
  expect(
    within(progression()).getByText(
      /Archon eidolons use the Biped base form; the recorded Quadruped base form is kept\./,
    ),
  ).toBeVisible();
  fireEvent.click(button('Edit eidolon choices'));
  const form = screen.getByRole('form', { name: 'Edit eidolon choices' });
  const versions = within(form).getByRole('radiogroup', { name: 'Version' });
  expect(
    within(versions).getByRole('radio', { name: /^Unchained/ }),
  ).toBeChecked();
  expect(within(form).getByText(/Your other choices are kept/)).toBeVisible();
  const forms = within(form).getByRole('radiogroup', { name: 'Base form' });
  expect(
    within(forms).getByRole('radio', { name: /^Quadruped/ }),
  ).toBeChecked();
  expect(
    within(forms)
      .getByRole('radio', { name: /^Biped/ })
      .closest('label'),
  ).toHaveTextContent('Allowed by the Archon subtype');
  expect(
    within(forms)
      .getByRole('radio', { name: /^Quadruped/ })
      .closest('label'),
  ).toHaveTextContent('Not among the Archon subtype’s base forms');
  const subtypes = within(form).getByRole('radiogroup', { name: 'Subtype' });
  expect(within(subtypes).getAllByRole('radio')).toHaveLength(12);
  expect(
    within(subtypes).getByRole('radio', { name: /^Archon/ }),
  ).toBeChecked();
  const choice = within(form).getByRole('radiogroup', {
    name: 'Archon: Ability Increase (8th level)',
  });
  expect(within(choice).getByRole('radio', { name: 'Wisdom' })).toBeChecked();

  fireEvent.click(within(forms).getByRole('radio', { name: /^Biped/ }));
  fireEvent.click(within(choice).getByRole('radio', { name: 'Charisma' }));
  fireEvent.click(button('Save eidolon choices'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall(
      withEidolonSubtypeChoice(archon, 'archon-abilityIncrease-8', 'charisma'),
    ),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'Edit eidolon choices' }),
    ).toBeNull(),
  );
  expect(button('Edit eidolon choices')).toHaveFocus();
});

test('changing the version in the editor keeps the subtype and every evolution, and a change of subtype keeps the former choices', async () => {
  const chosen = withEidolonSubtypeChoice(
    archon,
    'archon-abilityIncrease-8',
    'wisdom',
  );
  const view = renderSheet(eidolonSheet({ choices: chosen }));
  fireEvent.click(button('Edit eidolon choices'));
  const form = screen.getByRole('form', { name: 'Edit eidolon choices' });
  fireEvent.click(within(form).getByRole('radio', { name: /^Original/ }));
  expect(
    within(form).queryByRole('radiogroup', { name: 'Subtype' }),
  ).toBeNull();
  fireEvent.click(button('Save eidolon choices'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall(withEidolonVersion(chosen, 'original')));

  await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
  view.rerender(eidolonSheet({ choices: chosen, lastOperationId: 'next' }));
  fireEvent.click(button('Edit eidolon choices'));
  fireEvent.click(
    within(
      screen.getByRole('form', { name: 'Edit eidolon choices' }),
    ).getByRole('radio', { name: /^Angel/ }),
  );
  fireEvent.click(button('Save eidolon choices'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()).toEqual(saveCall(withEidolonSubtype(chosen, 'angel')));
});

test('a failed subtype save keeps the prompt with its reason, another player’s change keeps the editor’s version draft, and maintenance disables every Unchained write', async () => {
  const quadruped = newEidolonProgression('quadruped', 'unchained');
  server.write.mockRejectedValueOnce(new Error('Connection lost'));
  const view = renderSheet(eidolonSheet({ choices: quadruped }));
  fireEvent.click(button('Angel'));
  await waitFor(() =>
    expect(within(progression()).getByRole('alert')).toHaveTextContent(
      'may not have been saved',
    ),
  );
  expect(list('Subtypes')).toBeVisible();

  view.rerender(eidolonSheet());
  fireEvent.click(button('Edit eidolon choices'));
  fireEvent.click(screen.getByRole('radio', { name: /^Original/ }));
  view.rerender(
    eidolonSheet({
      choices: { ...archon, hpGained: 41 },
      lastOperationId: 'other-player',
    }),
  );
  expect(
    screen.getByText(
      'Eidolon progression updated by another player. Your edits are kept.',
    ),
  ).toBeVisible();
  expect(screen.getByRole('radio', { name: /^Original/ })).toBeChecked();
  expect(
    screen.getByRole('textbox', { name: 'Hit points gained' }),
  ).toHaveValue('41');
  fireEvent.click(button(/^Cancel/));

  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  view.rerender(eidolonSheet({ lastOperationId: 'm' }));
  const options = screen.getByRole('radiogroup', {
    name: 'Choose the Archon subtype’s Ability Increase (8th level).',
  });
  expect(within(options).getByRole('radio', { name: 'Wisdom' })).toBeDisabled();
  expect(
    within(options).getByRole('radio', { name: 'Wisdom' }),
  ).toHaveAccessibleDescription(new RegExp(message));
  view.rerender(eidolonSheet({ ruleKind: 'eidolon', lastOperationId: 'm1' }));
  expect(button('Convert to an Original eidolon')).toBeDisabled();
  expect(button('Convert to an Original eidolon')).toHaveAccessibleDescription(
    new RegExp(message),
  );
  view.rerender(eidolonSheet({ choices: quadruped, lastOperationId: 'm2' }));
  expect(button('Angel')).toBeDisabled();
  expect(button('Angel')).toHaveAccessibleDescription(new RegExp(message));
  fireEvent.click(button('Angel'));
  expect(server.write).toHaveBeenCalledTimes(1);
});

test('on the phone the subtype cards open as a single column in a bottom sheet from a touch-sized control that regains focus, while the version cards stay side by side', async () => {
  stubViewport(false);
  const quadruped = newEidolonProgression('quadruped', 'unchained');
  const view = renderSheet(eidolonSheet({ choices: null }));
  expect(
    within(progression()).getByRole('radiogroup', { name: 'Version' }),
  ).toHaveClass('grid-cols-2');
  view.rerender(eidolonSheet({ choices: quadruped }));
  expect(screen.queryByRole('list', { name: 'Subtypes' })).toBeNull();
  const opener = button('Choose a subtype');
  expect(opener).toHaveClass('min-h-11');
  fireEvent.click(opener);
  const sheet = screen.getByRole('dialog', { name: 'Choose a subtype' });
  expect(sheet).toHaveAttribute('data-slot', 'sheet-content');
  const subtypes = within(sheet).getByRole('list', { name: 'Subtypes' });
  expect(subtypes).toHaveClass('grid-cols-1');
  expect(subtypes).not.toHaveClass('md:grid-cols-2');
  expect(within(subtypes).getAllByRole('button')).toHaveLength(12);
  expect(within(subtypes).getByRole('button', { name: 'Angel' })).toHaveClass(
    'min-h-11',
    'motion-reduce:transition-none',
  );
  fireEvent.click(within(subtypes).getByRole('button', { name: 'Angel' }));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall(withEidolonSubtype(quadruped, 'angel')));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Choose a subtype' }),
    ).toBeNull(),
  );
  expect(button('Choose a subtype')).toHaveFocus();
});
