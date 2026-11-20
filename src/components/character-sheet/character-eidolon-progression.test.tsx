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
import type { CompanionProgressionSource } from '~/lib/character-sheet-companion-sources';
import type { EidolonProgressionState } from '~/lib/character-sheet-eidolon-progression';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import { CharacterCompanions } from './character-companions';
import { newEidolonProgression } from './character-eidolon-progression-view-model';
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
import type { SheetEntryInput } from './use-character-sheet-entries';

// The viewed eidolon's progression (#409): base form, summoner level, actual
// Hit Dice and Class Levels kept apart, the summoner's evolution pool with
// every recorded evolution against it, the natural attacks they give, and the
// recorded choices edited in place. Over budget trims nothing.

const nameOf = characterSheetNames();
const server = vi.hoisted(() => ({
  relationships: [] as unknown[] | undefined,
  linkedInput: undefined as unknown,
  write: vi.fn(),
  createNaturalAttack: vi.fn(),
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
    if (name === 'listLinkedInputs')
      return server.linkedInput ? [server.linkedInput] : [];
    throw new Error(`Unexpected query: ${name}`);
  },
  useMutation: (reference: FunctionReference<'mutation'>) => (args: unknown) =>
    server.write(nameOf(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => server.maintenance,
}));

// Six recorded evolutions cost 10 against a level 5 summoner's 8-point pool
// and give 6 natural attacks against a maximum of 4.
const biped: EidolonProgressionState = {
  ...newEidolonProgression('biped'),
  hpGained: 22,
  skillRanks: { 'skill.per': 4 },
  evolutions: [
    { key: 'bite' },
    { key: 'tentacle' },
    { key: 'tentacle' },
    { key: 'large' },
    { key: 'gore' },
    { key: 'scent' },
  ],
};
const summonerInput = {
  kind: 'classLevels',
  classRuleIdentity: 'summoner',
} as const;
// Mira's side of the relationship, as the viewed eidolon sees it.
const mira = {
  relationshipId: 'rel-mira' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'eidolon',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'mira' as Id<'character'>, name: 'Mira' },
  sources: [
    { key: 'eidolon', label: 'Eidolon', enabled: true, available: true },
  ],
  linkedInputs: [{ input: summonerInput, classLabel: 'Summoner' }],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;

type Options = {
  choices?: EidolonProgressionState | null;
  /** Summoner levels now, or null while unavailable. */
  level?: number | null;
  /** Permanent summoner levels, when they differ. */
  permanent?: number | null;
  counting?: boolean;
  fallback?: number;
  lastOperationId?: string;
  /** A Broodmaster source instead of the plain eidolon one (#419). */
  brood?: Brood;
  /** A Master Summoner's Lesser Eidolon source instead (#420). */
  reduced?: boolean;
  /** Rules competing for the source with no published precedence (#420). */
  ruleConflict?: CompanionProgressionSource['ruleConflict'];
};
type Brood = Pick<
  CompanionProgressionSource,
  'allocatedComponents' | 'componentPool'
>;
const sheets = new Map<string, CharacterSheetSnapshot>();
const warningControls = {
  accept: vi.fn(),
  reopen: vi.fn(),
  statusFor: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
/** A classless eidolon sheet calculated from its summoner source. */
function eidolonSheet(options: Options = {}) {
  const key = JSON.stringify(options);
  const sheet = sheets.get(key) ?? calculateEidolonSheet(options);
  sheets.set(key, sheet);
  return sheet;
}
function calculateEidolonSheet({
  choices = biped,
  level = 5,
  permanent,
  counting = true,
  fallback,
  lastOperationId = 'seed',
  brood,
  reduced = false,
  ruleConflict,
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
  const sourceKey = brood ? 'brood' : reduced ? 'lesser' : 'eidolon';
  const options = (value: number | null) => ({
    companionProgressionSources: [
      brood
        ? {
            sourceKey,
            ruleKind: 'broodmasterEidolon' as const,
            counting,
            ...brood,
          }
        : {
            sourceKey,
            ruleKind: reduced
              ? ('masterSummonerEidolon' as const)
              : ('eidolon' as const),
            counting,
            ...(ruleConflict ? { ruleConflict } : {}),
          },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: summonerInput,
        candidates: [
          value === null
            ? {
                sourceKey,
                kind: 'unavailable' as const,
                reason: 'interrupted' as const,
              }
            : { sourceKey, kind: 'available' as const, value },
        ],
        fallback,
      }),
    ],
  });
  const calculated = calculateFixtureSheetProjections(input, {
    projectionInputs: {
      current: options(level),
      permanent: options(permanent === undefined ? level : permanent),
    },
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
  server.linkedInput = undefined;
  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  server.write.mockReset().mockResolvedValue(null);
  server.createNaturalAttack.mockReset().mockResolvedValue('entry-1');
  warningControls.accept.mockReset();
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
        createNaturalAttack={(input: SheetEntryInput) =>
          server.createNaturalAttack(input)
        }
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
const value = (name: string) =>
  within(progression()).getByRole('definition', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const list = (name: string) => screen.getByRole('list', { name });
const row = (listName: string, name: string) =>
  within(list(listName)).getByRole('listitem', { name });
const dialog = () => screen.getByRole('dialog', { name: 'Add an evolution' });
const lastCall = () => server.write.mock.calls.at(-1);
const saveCall = (progression: EidolonProgressionState) => [
  'setCompanionProgression',
  {
    characterId: 'character-1',
    operationId: expect.any(String),
    progression,
  },
];

test('an eidolon without recorded progression chooses a base form from three cards, each naming what the form brings, and the choice saves a first record', async () => {
  renderSheet(eidolonSheet({ choices: null }));
  expect(
    within(progression()).getByText('Choose an eidolon base form.'),
  ).toBeVisible();
  expect(
    screen.queryByRole('region', { name: 'Animal companion progression' }),
  ).toBeNull();
  const cards = within(list('Base forms')).getAllByRole('button');
  expect(cards.map((card) => card.textContent)).toEqual([
    expect.stringContaining('Biped'),
    expect.stringContaining('Quadruped'),
    expect.stringContaining('Serpentine'),
  ]);
  expect(button('Biped')).toHaveAccessibleDescription(
    'Speed 30 ft. Scores Str 16, Dex 12, Con 13, Int 7, Wis 10, Cha 11 Good saves Fortitude, Will Free evolutions Claws, Limbs (Arms), Limbs (Legs)',
  );
  expect(button('Serpentine')).toHaveAccessibleDescription(
    /Speed 20 ft\., climb 20 ft\..*Good saves Reflex, Will.*Free evolutions Bite, Climb, Reach \(Bite\), Tail, Tail Slap/,
  );
  expect(screen.queryByRole('button', { name: /Edit eidolon/ })).toBeNull();

  fireEvent.click(button('Quadruped'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall(newEidolonProgression('quadruped')));
  expect(within(progression()).getByText('Saved')).toBeVisible();
});

test('the active eidolon keeps summoner level, actual Hit Dice and Class Levels apart, shows the pool on its source, every over-budget evolution with its issues, the natural attacks against the maximum, and routes Accept through the sheet warnings', () => {
  renderSheet(eidolonSheet());
  expect(within(progression()).getByText('Biped')).toBeVisible();
  expect(within(progression()).getByText('Active')).toBeVisible();
  expect(within(progression()).getByText('Size Large')).toBeVisible();
  expect(value('Summoner level')).toHaveTextContent('5');
  expect(value('Actual Hit Dice')).toHaveTextContent('4');
  expect(value('Class Levels')).toHaveTextContent('0');
  expect(value('Maximum HP')).toHaveTextContent('34');
  expect(value('Base attack bonus')).toHaveTextContent('+4');
  expect(within(progression()).queryByText('Evolution points')).toBeNull();
  expect(value('Max attacks')).toHaveTextContent('4');
  expect(value('Armor bonus')).toHaveTextContent('+4');
  expect(
    within(progression()).getByText(
      'Armor bonus +4: 0 as armor, 8 natural armor, including the base form’s +2 and evolution increases.',
    ),
  ).toBeVisible();
  expect(progression().textContent).not.toMatch(
    /Hit Dice levels|\bHD\b|racial levels/i,
  );

  const pool = within(progression()).getByText(
    'Evolution pool 8 · spent 10 · 2 over',
  );
  expect(pool).toHaveClass('text-amber-300');
  expect(list('Evolution pool sources')).toHaveTextContent(
    'Eidolon: 8 points, Summoner',
  );
  const source = row('Granting sources', 'Eidolon, Summoner');
  expect(source).toHaveTextContent('Calculated');
  expect(source).toHaveTextContent('Summoner class levels5');
  expect(source).toHaveTextContent('Summoner level5');

  const evolutions = list('Evolutions');
  expect(
    within(evolutions)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('aria-label')),
  ).toEqual([
    'Claws',
    'Limbs (Arms)',
    'Limbs (Legs)',
    'Bite',
    'Tentacle',
    'Tentacle',
    'Large',
    'Gore',
    'Scent',
  ]);
  expect(row('Evolutions', 'Claws')).toHaveTextContent('Base form');
  expect(within(row('Evolutions', 'Claws')).queryByRole('button')).toBeNull();
  const large = row('Evolutions', 'Large');
  expect(large).toHaveTextContent('4 points');
  expect(
    within(large).getByText('Requires summoner level 8.').closest('p'),
  ).toHaveClass('text-amber-300');
  expect(
    within(large).getByRole('button', { name: 'Remove Large' }),
  ).toBeEnabled();

  expect(within(progression()).getByText('6 of max 4')).toHaveClass(
    'text-amber-300',
  );
  const claws = row('Natural attacks', 'Claws');
  expect(claws).toHaveTextContent(
    '2 × 1d6 · Primary natural attack · 0 of 2 recorded',
  );
  expect(
    within(claws).getByRole('button', { name: 'Add Claws' }),
  ).toBeEnabled();
  expect(
    within(progression()).getByText(
      'Evolutions cost 10 points, above the 8-point evolution pool; every recorded evolution is kept.',
    ),
  ).toBeVisible();
  expect(
    within(progression()).getByText(
      'Evolutions give 6 natural attacks, above the eidolon’s maximum of 4.',
    ),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Accept',
      description: /above the 8-point evolution pool/,
    }),
  );
  expect(warningControls.accept).toHaveBeenCalledWith(
    expect.objectContaining({ check: 'eidolonEvolutionPoolBudget' }),
  );
  expect(list('Class skills')).toHaveTextContent('Perception');
  expect(within(progression()).getByText('Perception 4')).toBeVisible();
  expect(
    within(progression()).getByRole('link', {
      name: /Advanced Player’s Guide, pp\. 58–63/,
    }),
  ).toHaveAttribute('href', expect.stringContaining('aonprd.com'));
  expect(progression().textContent).not.toMatch(
    /builtin:|classLevels|ruleKind/,
  );
});

test('the picker groups the catalog by cost, notes unmet requirements without blocking, and tells an empty choice from a missing option', async () => {
  renderSheet(eidolonSheet());
  fireEvent.click(button('Add evolution'));
  const picker = dialog();
  expect(picker).toHaveAttribute('data-slot', 'dialog-content');
  expect(
    within(picker)
      .getAllByRole('region')
      .map((group) => group.getAttribute('aria-label')),
  ).toEqual(['1 point', '2 points', '3 points', '4 points']);
  const evolution = within(picker).getByRole('radiogroup', {
    name: 'Evolution',
  });
  expect(within(evolution).getAllByRole('radio')).toHaveLength(49);
  const rake = within(evolution).getByRole('radio', { name: /^Rake/ });
  expect(rake).toBeEnabled();
  expect(rake.closest('label')).toHaveTextContent(
    'Summoner level 4 · Quadruped onlyNot for the Biped base form.',
  );
  expect(
    within(evolution)
      .getByRole('radio', { name: /^Blindsense/ })
      .closest('label'),
  ).toHaveTextContent('Needs summoner level 9; the summoner level is 5.');

  fireEvent.click(
    within(picker).getByRole('button', { name: 'Add evolution' }),
  );
  await waitFor(() =>
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      'Choose an evolution.',
    ),
  );
  fireEvent.click(within(evolution).getByRole('radio', { name: /^Skilled/ }));
  fireEvent.click(
    within(picker).getByRole('button', { name: 'Add evolution' }),
  );
  await waitFor(() =>
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      'Choose an option.',
    ),
  );
  expect(server.write).not.toHaveBeenCalled();
});

test('adding an evolution with its option saves the whole record with every other recorded choice intact and returns focus to the opener', async () => {
  renderSheet(eidolonSheet());
  fireEvent.click(button('Add evolution'));
  const picker = dialog();
  fireEvent.click(within(picker).getByRole('radio', { name: /^Skilled/ }));
  const options = within(picker).getByRole('radiogroup', {
    name: 'Skilled option',
  });
  fireEvent.click(within(options).getByRole('radio', { name: 'Perception' }));
  fireEvent.click(
    within(picker).getByRole('button', { name: 'Add evolution' }),
  );
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall({
      ...biped,
      evolutions: [
        ...biped.evolutions,
        { key: 'skilled', choice: 'skill.per' },
      ],
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Add an evolution' }),
    ).toBeNull(),
  );
  expect(button('Add evolution')).toHaveFocus();
});

test('an option’s extra cost and an upgrade count are offered, and a count above the maximum is invalid rather than empty', async () => {
  renderSheet(eidolonSheet());
  fireEvent.click(button('Add evolution'));
  const picker = dialog();
  fireEvent.click(within(picker).getByRole('radio', { name: /^Flight/ }));
  const options = within(picker).getByRole('radiogroup', {
    name: 'Flight option',
  });
  expect(
    within(options).getByRole('radio', { name: 'Magic (+2)' }),
  ).toBeInTheDocument();
  fireEvent.click(within(options).getByRole('radio', { name: 'Wings' }));
  const upgrades = within(picker).getByRole('textbox', {
    name: '+20 ft. fly speed',
  });
  expect(upgrades).toHaveAccessibleDescription(/1 point each, up to 20\./);
  fireEvent.change(upgrades, { target: { value: '21' } });
  fireEvent.click(
    within(picker).getByRole('button', { name: 'Add evolution' }),
  );
  await waitFor(() =>
    expect(within(picker).getByRole('alert')).toHaveTextContent('Up to 20.'),
  );
  fireEvent.change(upgrades, { target: { value: 'two' } });
  fireEvent.click(
    within(picker).getByRole('button', { name: 'Add evolution' }),
  );
  await waitFor(() =>
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      'Enter a number.',
    ),
  );
  fireEvent.change(upgrades, { target: { value: '2' } });
  fireEvent.click(
    within(picker).getByRole('button', { name: 'Add evolution' }),
  );
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall({
      ...biped,
      evolutions: [
        ...biped.evolutions,
        { key: 'flight', choice: 'wings', upgrades: 2 },
      ],
    }),
  );
});

test('Remove writes the whole record without that evolution, by its recorded position after the free ones', async () => {
  renderSheet(eidolonSheet());
  expect(
    screen.getAllByRole('button', { name: 'Remove Tentacle' }),
  ).toHaveLength(2);
  fireEvent.click(button('Remove Large'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall({
      ...biped,
      evolutions: [
        { key: 'bite' },
        { key: 'tentacle' },
        { key: 'tentacle' },
        { key: 'gore' },
        { key: 'scent' },
      ],
    }),
  );
  expect(within(progression()).getByText('Saved')).toBeVisible();
});

test('Add beside a natural attack opens the natural attack editor prefilled with the evolution’s type, role and Medium dice, and saving records an ordinary natural attack', async () => {
  renderSheet(eidolonSheet());
  fireEvent.click(button('Add Claws'));
  // It opens an editor rather than toggling, so it is never pressed.
  expect(button('Add Claws')).not.toHaveAttribute('aria-pressed');
  const editor = screen.getByRole('region', { name: 'Add natural attack' });
  expect(within(editor).getByRole('radio', { name: 'Claw' })).toBeChecked();
  expect(
    within(editor).getByRole('textbox', { name: 'Attack name' }),
  ).toHaveValue('Claw');
  expect(
    within(editor).getByRole('textbox', { name: 'Medium damage' }),
  ).toHaveValue('1d4');
  expect(within(editor).getByRole('radio', { name: 'Primary' })).toBeChecked();
  fireEvent.click(
    within(editor).getByRole('button', { name: 'Add natural attack' }),
  );
  await waitFor(() =>
    expect(server.createNaturalAttack).toHaveBeenCalledTimes(1),
  );
  expect(server.createNaturalAttack).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Claw',
      modifiers: [],
      detail: expect.objectContaining({
        kind: 'item',
        weapon: expect.objectContaining({
          dice: '1d4',
          naturalAttack: { type: 'claw', role: 'primary' },
        }),
      }),
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('region', { name: 'Add natural attack' }),
    ).toBeNull(),
  );
  expect(button('Add Claws')).toHaveFocus();
  expect(server.write).not.toHaveBeenCalled();
});

test('the editor keeps base form, evolutions and Keep while writing size, hit points, ranks, class skills and the armor split', async () => {
  renderSheet(eidolonSheet());
  fireEvent.click(button('Edit eidolon choices'));
  const form = screen.getByRole('form', { name: 'Edit eidolon choices' });
  expect(radio('Medium')).toBeChecked();
  expect(field('Hit points gained')).toHaveValue('22');
  expect(field('Perception ranks')).toHaveValue('4');
  expect(
    within(form).getByRole('textbox', { name: 'Bluff ranks' }),
  ).toHaveValue('');
  expect(
    within(form).queryByRole('textbox', { name: 'Handle Animal ranks' }),
  ).toBeNull();
  fireEvent.click(radio('Small'));
  fireEvent.change(field('Hit points gained'), { target: { value: '25' } });
  fireEvent.click(within(form).getByRole('checkbox', { name: 'Acrobatics' }));
  fireEvent.change(field('Armor bonus as armor'), { target: { value: '2' } });
  fireEvent.click(button('Save eidolon choices'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall({
      ...biped,
      size: 'small',
      hpGained: 25,
      classSkills: ['skill.acr'],
      armorBonusAsArmor: 2,
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'Edit eidolon choices' }),
    ).toBeNull(),
  );
  expect(button('Edit eidolon choices')).toHaveFocus();
});

test('a failed save keeps the draft in the editor with its reason', async () => {
  renderSheet(eidolonSheet());
  fireEvent.click(button('Edit eidolon choices'));
  fireEvent.change(field('Hit points gained'), { target: { value: '31' } });
  server.write.mockRejectedValueOnce(new Error('Connection lost'));
  fireEvent.click(button('Save eidolon choices'));
  const form = screen.getByRole('form', { name: 'Edit eidolon choices' });
  await waitFor(() =>
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Companion Progression may not have been saved. Check it before trying again.',
    ),
  );
  expect(field('Hit points gained')).toHaveValue('31');
  fireEvent.keyDown(field('Hit points gained'), { key: 'Escape' });
  expect(screen.queryByRole('form')).toBeNull();
  expect(button('Edit eidolon choices')).toHaveFocus();
});

test('a failed add keeps the picker open with its choice and the reason', async () => {
  renderSheet(eidolonSheet());
  fireEvent.click(button('Add evolution'));
  const picker = dialog();
  fireEvent.click(within(picker).getByRole('radio', { name: /^Scent/ }));
  server.write.mockRejectedValueOnce(new Error('Connection lost'));
  fireEvent.click(
    within(picker).getByRole('button', { name: 'Add evolution' }),
  );
  await waitFor(() =>
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      'may not have been saved',
    ),
  );
  expect(within(picker).getByRole('radio', { name: /^Scent/ })).toBeChecked();
  expect(server.write).toHaveBeenCalledTimes(1);
});

test("another player's change is announced once and dismissed while the edited field keeps its draft", () => {
  const view = renderSheet(eidolonSheet());
  fireEvent.click(button('Edit eidolon choices'));
  fireEvent.change(field('Hit points gained'), { target: { value: '30' } });
  view.rerender(
    eidolonSheet({
      choices: { ...biped, skillRanks: { 'skill.per': 2 } },
      lastOperationId: 'other-player',
    }),
  );
  const notice =
    'Eidolon progression updated by another player. Your edits are kept.';
  expect(screen.getAllByText(notice)).toHaveLength(1);
  expect(field('Hit points gained')).toHaveValue('30');
  expect(field('Perception ranks')).toHaveValue('2');
  fireEvent.click(button('Dismiss eidolon progression update'));
  expect(screen.queryByText(notice)).toBeNull();
  expect(field('Hit points gained')).toHaveValue('30');
});

test('a summoner level drop reads over budget with every evolution kept; restoring it clears the warning with no action, and losing the source reads Not counting now with Unresolved budgets and the choices still listed', async () => {
  const view = renderSheet(eidolonSheet({ level: 8 }));
  expect(
    within(progression()).getByText('Evolution pool 11 · spent 10 · 1 left'),
  ).not.toHaveClass('text-amber-300');
  expect(
    within(progression()).queryByText(/above the .*evolution pool/),
  ).toBeNull();
  expect(within(row('Evolutions', 'Large')).queryByText(/Requires/)).toBeNull();

  view.rerender(eidolonSheet({ level: 5 }));
  expect(
    within(progression()).getByText('Evolution pool 8 · spent 10 · 2 over'),
  ).toHaveClass('text-amber-300');
  expect(
    within(progression()).getByText(/above the 8-point evolution pool/),
  ).toBeVisible();
  expect(within(list('Evolutions')).getAllByRole('listitem')).toHaveLength(9);

  view.rerender(eidolonSheet({ level: 8 }));
  expect(
    within(progression()).queryByText(/above the .*evolution pool/),
  ).toBeNull();
  expect(server.write).not.toHaveBeenCalled();

  view.rerender(eidolonSheet({ counting: false }));
  expect(within(progression()).getByText('Not counting now')).toBeVisible();
  expect(
    within(progression()).getByText('Recorded choices are retained.'),
  ).toBeVisible();
  expect(
    within(progression()).getByText(
      'No supporting source supplies a pool now.',
    ),
  ).toBeVisible();
  for (const name of [
    'Summoner level',
    'Actual Hit Dice',
    'Base attack bonus',
    'Max attacks',
  ])
    expect(value(name)).toHaveTextContent('Unresolved');
  expect(value('Class Levels')).toHaveTextContent('0');
  expect(
    within(progression()).getByText('Evolution pool Unresolved · spent 10'),
  ).toBeVisible();
  expect(row('Granting sources', 'Eidolon, Summoner')).toHaveTextContent(
    'Not contributing',
  );
  expect(row('Evolutions', 'Large')).toHaveTextContent('4 points');
  expect(within(progression()).getByText('Perception 4')).toBeVisible();
  expect(button('Edit eidolon choices')).toBeEnabled();
  const keep = screen.getByRole('switch', { name: /Keep recorded/ });
  expect(keep).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(keep);
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall({ ...biped, keep: true }));
});

test('an unresolved summoner level reads Unresolved beside the linked-value fallback editor, and Current and Permanent each show their own projection', () => {
  server.linkedInput = {
    input: summonerInput,
    status: 'unavailable',
    resolution: 'unresolved',
    value: null,
    fallback: null,
    fallbackState: 'none',
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
  renderSheet(eidolonSheet({ level: null, permanent: 8 }));
  expect(within(progression()).getByText('Size Unresolved')).toBeVisible();
  expect(
    within(progression()).getAllByText('Unresolved', { selector: 'span' })[0],
  ).toHaveClass('ring-sky-400/80');
  expect(value('Summoner level')).toHaveTextContent('Unresolved');
  expect(value('Max attacks')).toHaveTextContent('Unresolved');
  expect(
    within(progression()).getByText(
      'Eidolon progression needs an available summoner level within the level 1–20 table.',
    ),
  ).toBeVisible();
  expect(button('Set fallback for Summoner class levels')).toBeEnabled();
  expect(radio('Current')).toBeChecked();

  fireEvent.click(radio('Permanent'));
  expect(value('Summoner level')).toHaveTextContent('8');
  expect(value('Actual Hit Dice')).toHaveTextContent('6');
  expect(
    within(progression()).getByText('Evolution pool 11 · spent 10 · 1 left'),
  ).toBeVisible();
  fireEvent.click(radio('Current'));
  expect(value('Summoner level')).toHaveTextContent('Unresolved');
});

test('maintenance explains itself once and disables every write while the calculated values stay readable', () => {
  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  const view = renderSheet(eidolonSheet());
  for (const name of [
    'Edit eidolon choices',
    'Add evolution',
    'Remove Large',
    'Add Claws',
  ]) {
    expect(button(name)).toBeDisabled();
    expect(button(name)).toHaveAccessibleDescription(new RegExp(message));
  }
  expect(screen.getByRole('switch', { name: /Keep recorded/ })).toBeDisabled();
  expect(screen.getAllByText(message)).toHaveLength(1);
  expect(value('Summoner level')).toHaveTextContent('5');
  expect(
    within(progression()).getByText('Evolution pool 8 · spent 10 · 2 over'),
  ).toBeVisible();

  view.rerender(eidolonSheet({ choices: null }));
  expect(button('Biped')).toBeDisabled();
  expect(button('Biped')).toHaveAccessibleDescription(new RegExp(message));
  fireEvent.click(button('Biped'));
  expect(server.write).not.toHaveBeenCalled();
});

test('an Unchained eidolon relationship starts an Unchained record, and a sheet without an eidolon link or record shows nothing here', async () => {
  server.relationships = [{ ...mira, kind: 'unchainedEidolon' }];
  const view = renderSheet(eidolonSheet({ choices: null }));
  expect(
    within(progression()).getByText('Choose an eidolon base form.'),
  ).toBeVisible();
  fireEvent.click(button('Quadruped'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    saveCall(newEidolonProgression('quadruped', 'unchained')),
  );
  server.relationships = [];
  view.rerender(eidolonSheet({ choices: null, lastOperationId: 'other' }));
  expect(
    screen.queryByRole('region', { name: 'Eidolon progression' }),
  ).toBeNull();
  expect(screen.queryByText('Choose an eidolon base form.')).toBeNull();
});

// Mira the Broodmaster's brood of two Small eidolons at summoner level 2
// (#419, UM p. 78): this eidolon holds the feat, its sibling the other Hit
// Die. BAB and saves read the whole row; everything else is a share.
const broodmaster = {
  ...mira,
  sources: [
    {
      key: 'brood',
      label: 'Broodmaster',
      enabled: true,
      available: true,
      ruleKind: 'broodmasterEidolon',
    },
  ],
} satisfies CompanionRelationship;
const broodling: EidolonProgressionState = {
  ...newEidolonProgression('biped'),
  size: 'small',
  hpGained: 6,
  evolutions: [{ key: 'bite' }],
};
const broodShare = {
  hitDice: 1,
  skillRanks: 4,
  feats: 1,
  armorBonus: 1,
  strengthBonus: 1,
  dexterityBonus: 0,
  evolutionPoints: 2,
  maxAttacks: 2,
};
const broodPool = {
  allocated: {
    hitDice: 2,
    skillRanks: 8,
    feats: 1,
    armorBonus: 2,
    strengthBonus: 1,
    dexterityBonus: 1,
    evolutionPoints: 3,
    maxAttacks: 3,
  },
  companions: 2,
  groupPurchases: [],
} satisfies Brood['componentPool'];
const broodSheet = (brood: Brood) =>
  eidolonSheet({ choices: broodling, level: 2, brood });
const shareTable = () =>
  within(progression()).getByRole('table', { name: 'Brood share' });
const shareRow = (name: RegExp) =>
  within(shareTable()).getByRole('row', { name });
const cellsOf = (element: HTMLElement) =>
  within(element)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
const headersOf = () =>
  within(shareTable())
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent);

test('a brood eidolon reads its allocated shares beside the brood’s budget, its Strength and Dexterity shares apart, BAB and saves from the whole summoner level and its pool as allocated; without the summoner’s sheet only its own shares remain', () => {
  server.relationships = [broodmaster];
  const view = renderSheet(
    broodSheet({ allocatedComponents: broodShare, componentPool: broodPool }),
  );
  expect(value('Summoner level')).toHaveTextContent('2');
  expect(value('Actual Hit Dice')).toHaveTextContent('1');
  expect(value('Base attack bonus')).toHaveTextContent('+2');
  expect(value('Strength bonus')).toHaveTextContent('+1');
  expect(value('Dexterity bonus')).toHaveTextContent('+0');
  expect(
    within(progression()).queryByRole('definition', {
      name: 'Strength and Dexterity bonus',
    }),
  ).toBeNull();
  expect(
    within(progression()).getByText(
      'Base attack bonus and saves: whole summoner level, shared by the brood. Armor, Strength and Dexterity bonuses are allocated shares.',
    ),
  ).toBeVisible();
  expect(value('General feats')).toHaveTextContent('1');
  expect(value('Skill ranks')).toHaveTextContent('4');
  expect(value('Max attacks')).toHaveTextContent('2');
  expect(
    within(progression()).getByText('From a brood of 2 eidolons'),
  ).toBeVisible();
  expect(within(progression()).getByText('Eidolons up to Small')).toBeVisible();
  expect(headersOf()).toEqual([
    'Component',
    'This eidolon',
    'Brood budget',
    'Brood allocated',
  ]);
  expect(cellsOf(shareRow(/^evolution points/))).toEqual([
    'This eidolon2',
    'Brood budget4',
    'Brood allocated3',
  ]);
  expect(cellsOf(shareRow(/^feats/))).toEqual([
    'This eidolon1',
    'Brood budget1',
    'Brood allocated1',
  ]);
  expect(shareRow(/^feats/)).not.toHaveClass('text-amber-300');
  expect(
    within(progression()).getByText('None bought for the brood.'),
  ).toBeVisible();
  expect(
    within(progression()).getByText('Evolution pool 2 · spent 1 · 1 left'),
  ).not.toHaveClass('text-amber-300');
  expect(
    within(progression()).getByText(
      'Allocated from the brood’s evolution points.',
    ),
  ).toBeVisible();
  expect(row('Granting sources', 'Eidolon brood, Summoner')).toHaveTextContent(
    'Hit Dice 1, skill ranks 4, feats 1, armor bonus 1, Strength bonus 1, Dexterity bonus 0, evolution points 2, maximum natural attacks 2 allocated here, from a brood of 2 eidolons.',
  );
  expect(
    screen.queryByRole('button', { name: 'Accept', description: /brood/ }),
  ).toBeNull();

  view.rerender(broodSheet({ allocatedComponents: broodShare }));
  expect(
    within(progression()).getByText('The brood’s budget is unresolved'),
  ).toBeVisible();
  expect(headersOf()).toEqual(['Component', 'This eidolon']);
  expect(cellsOf(shareRow(/^evolution points/))).toEqual(['This eidolon2']);
  expect(within(progression()).queryByText('Group purchases')).toBeNull();
  expect(within(progression()).queryByText(/bought for the brood/)).toBeNull();
  expect(value('Strength bonus')).toHaveTextContent('+1');
  expect(value('Base attack bonus')).toHaveTextContent('+2');
  expect(value('Actual Hit Dice')).toHaveTextContent('1');
  expect(server.write).not.toHaveBeenCalled();
});

test('a brood eidolon with nothing allocated reads Unresolved shares beside the brood’s numbers with the missing warning, and a purchase bought out of order is listed with its issues in amber', () => {
  server.relationships = [broodmaster];
  renderSheet(
    broodSheet({
      componentPool: {
        ...broodPool,
        allocated: { ...broodShare, feats: 0 },
        groupPurchases: ['huge'],
      },
    }),
  );
  expect(
    within(progression()).getAllByText('Unresolved', { selector: 'span' })[0],
  ).toHaveClass('ring-sky-400/80');
  expect(value('Actual Hit Dice')).toHaveTextContent('Unresolved');
  expect(value('Strength bonus')).toHaveTextContent('Unresolved');
  expect(value('Base attack bonus')).toHaveTextContent('Unresolved');
  expect(cellsOf(shareRow(/^Hit Dice/))).toEqual([
    'This eidolonUnresolved',
    'Brood budget2',
    'Brood allocated1',
  ]);
  expect(within(shareRow(/^Hit Dice/)).getByText('Unresolved')).toHaveClass(
    'ring-sky-400/80',
  );
  // The huge evolution's 6 points come off the brood's 4 before division.
  expect(cellsOf(shareRow(/^evolution points/))).toEqual([
    'This eidolonUnresolved',
    'Brood budget-2',
    'Brood allocated2',
  ]);
  expect(
    within(progression()).getByText(
      'Allocate this eidolon’s Hit Dice, skill ranks, feats, armor bonus, Strength bonus, Dexterity bonus, evolution points and maximum natural attacks from the Broodmaster brood.',
    ),
  ).toBeVisible();
  const purchases = within(progression()).getByRole('list', {
    name: 'Group purchases',
  });
  expect(purchases).toHaveTextContent('Huge evolution6 points');
  for (const issue of [
    'Requires summoner level 13.',
    'Requires the large evolution for the brood.',
  ])
    expect(within(purchases).getByText(issue).closest('p')).toHaveClass(
      'text-amber-300',
    );
  expect(within(progression()).getByText('Eidolons up to Small')).toBeVisible();
  expect(
    within(progression()).getByText(/^The brood’s huge evolution:/),
  ).toBeVisible();
});

// Mira the Master Summoner (#420, UM p. 80): Lesser Eidolon halves her
// summoner level, rounded down, to at least 1, and the eidolon table is read
// at that level. Her own Class Levels are never halved.
const masterSummoner = {
  ...mira,
  sources: [
    {
      key: 'lesser',
      label: 'Master Summoner',
      enabled: true,
      available: true,
      ruleKind: 'masterSummonerEidolon',
    },
  ],
} satisfies CompanionRelationship;
const trailLabel = 'Lesser Eidolon (Master Summoner)';
const trail = () =>
  within(list(trailLabel))
    .getAllByRole('listitem')
    .map((step) => step.textContent);

test('a master summoner’s eidolon keeps the actual summoner level beside the eidolon table level with the reduction trail, reads its sources at the table level, and the picker names the reduction when a requirement is unmet', () => {
  server.relationships = [masterSummoner];
  const view = renderSheet(eidolonSheet({ reduced: true, level: 7 }));
  expect(value('Summoner level')).toHaveTextContent('7');
  expect(value('Eidolon table level')).toHaveTextContent('3');
  expect(value('Actual Hit Dice')).toHaveTextContent('3');
  expect(value('Class Levels')).toHaveTextContent('0');
  expect(value('Base attack bonus')).toHaveTextContent('+3');
  const steps = list(trailLabel);
  expect(steps.tagName).toBe('OL');
  expect(trail()).toEqual([
    'Summoner level7',
    'Halved, rounded down3',
    'At least 13',
  ]);
  expect(steps.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  expect(steps.querySelector('svg:not([aria-hidden])')).toBeNull();
  expect(
    within(progression()).getByText('Evolution pool 5 · spent 10 · 5 over'),
  ).toHaveClass('text-amber-300');
  const source = row('Granting sources', 'Lesser eidolon, Summoner');
  expect(source).toHaveTextContent('Calculated');
  expect(source).toHaveTextContent('Summoner class levels7');
  expect(source).toHaveTextContent('Eidolon table level3');
  expect(within(source).queryByText('Summoner level')).toBeNull();
  expect(source).toHaveTextContent(
    'Summoner level 7, halved and rounded down to 3, at least 1: the eidolon table is read at level 3.',
  );
  expect(list('Source restrictions')).toHaveTextContent(
    /Lesser Eidolon halves the summoner level/,
  );
  expect(
    within(progression()).getByRole('link', { name: /Ultimate Magic/ }),
  ).toBeVisible();
  expect(progression().textContent).not.toMatch(
    /masterSummoner|ruleConflict|sourceKey/,
  );

  view.rerender(eidolonSheet({ reduced: true, level: 1 }));
  expect(value('Summoner level')).toHaveTextContent('1');
  expect(value('Eidolon table level')).toHaveTextContent('1');
  expect(trail()).toEqual([
    'Summoner level1',
    'Halved, rounded down0',
    'At least 11',
  ]);

  view.rerender(eidolonSheet({ reduced: true, level: null }));
  expect(value('Summoner level')).toHaveTextContent('Unresolved');
  expect(value('Eidolon table level')).toHaveTextContent('Unresolved');
  expect(trail()).toEqual(['Summoner levelUnresolved']);
  expect(row('Granting sources', 'Lesser eidolon, Summoner')).toHaveTextContent(
    'The summoner level is unresolved; Lesser Eidolon reduces it before the eidolon table is read.',
  );

  view.rerender(eidolonSheet({ reduced: true, level: null, fallback: 6 }));
  expect(value('Summoner level')).toHaveTextContent('6');
  expect(value('Eidolon table level')).toHaveTextContent('3');
  expect(trail()).toEqual([
    'Summoner level6',
    'Halved, rounded down3',
    'At least 13',
  ]);
  expect(row('Granting sources', 'Lesser eidolon, Summoner')).toHaveTextContent(
    'Using saved fallback',
  );

  view.rerender(eidolonSheet({ reduced: true, level: 7 }));
  fireEvent.click(button('Add evolution'));
  expect(
    within(dialog())
      .getByRole('radio', { name: /^Blindsense/ })
      .closest('label'),
  ).toHaveTextContent(
    'Needs summoner level 9; Lesser Eidolon (Master Summoner) counts the summoner level as 3.',
  );
  expect(server.write).not.toHaveBeenCalled();
});

test('competing progression rules read as one amber advisory above the muted warning, with no Accept, Competing rules on the source and every dependent number Unresolved', () => {
  renderSheet(
    eidolonSheet({
      level: 7,
      ruleConflict: {
        disclosure: 'disclosed',
        ruleKinds: ['broodmasterEidolon', 'masterSummonerEidolon'],
      },
    }),
  );
  const advisory = within(progression()).getByText(
    'Broodmaster and Master Summoner both change this eidolon’s progression; turn one of the Archetypes off to calculate it.',
  );
  expect(advisory.closest('p')).toHaveClass('text-amber-300');
  expect(
    within(list('Competing rules'))
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Broodmaster', 'Master Summoner']);
  expect(
    within(progression()).getByText(
      /each change how this eidolon advances from the same summoner levels/,
    ),
  ).toHaveClass('text-muted-foreground');
  expect(
    within(progression()).getAllByText(/Broodmaster and Master Summoner/),
  ).toHaveLength(2);
  expect(
    screen.queryByRole('button', {
      name: 'Accept',
      description: /Broodmaster and Master Summoner/,
    }),
  ).toBeNull();
  expect(
    within(progression()).getAllByText('Unresolved', { selector: 'span' })[0],
  ).toHaveClass('ring-sky-400/80');
  expect(row('Granting sources', 'Eidolon, Summoner')).toHaveTextContent(
    'Competing rules',
  );
  for (const name of [
    'Summoner level',
    'Actual Hit Dice',
    'Base attack bonus',
    'Max attacks',
  ])
    expect(value(name)).toHaveTextContent('Unresolved');
  expect(value('Class Levels')).toHaveTextContent('0');
  expect(
    within(progression()).queryByRole('definition', {
      name: 'Eidolon table level',
    }),
  ).toBeNull();
  expect(screen.queryByRole('list', { name: trailLabel })).toBeNull();
  expect(progression().textContent).not.toMatch(/ruleConflict|masterSummoner/);
});

test('competing rules hidden with the summoner read as the same advisory without naming any rule', () => {
  renderSheet(
    eidolonSheet({ level: 7, ruleConflict: { disclosure: 'undisclosed' } }),
  );
  expect(
    within(progression())
      .getByText(
        'Rules on the summoner compete to change this eidolon’s progression; it calculates once one of them is turned off.',
      )
      .closest('p'),
  ).toHaveClass('text-amber-300');
  expect(screen.queryByRole('list', { name: 'Competing rules' })).toBeNull();
  expect(row('Granting sources', 'Eidolon, Summoner')).toHaveTextContent(
    'Competing rules',
  );
  expect(value('Summoner level')).toHaveTextContent('Unresolved');
  expect(progression().textContent).not.toMatch(
    /Broodmaster|Master Summoner|ruleConflict/,
  );
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
  { isWide: false, label: 'phone', slot: 'sheet-content' },
  { isWide: true, label: 'tablet', slot: 'dialog-content' },
])(
  'on the $label each control is named once and touch-sized, and the picker is a $slot',
  ({ isWide, slot }) => {
    stubViewport(isWide);
    renderSheet(eidolonSheet());
    for (const name of ['Edit eidolon choices', 'Add evolution', 'Add Claws']) {
      expect(screen.getAllByRole('button', { name })).toHaveLength(1);
      expect(button(name)).toHaveClass('min-h-11');
    }
    expect(screen.getByRole('switch', { name: /Keep recorded/ })).toHaveClass(
      'min-h-11',
      'md:min-h-7',
    );
    for (const name of ['Current', 'Permanent']) {
      expect(screen.getAllByRole('radio', { name })).toHaveLength(1);
      expect(radio(name).closest('label')).toHaveClass('min-h-11');
    }
    fireEvent.click(button('Add evolution'));
    expect(dialog()).toHaveAttribute('data-slot', slot);
    expect(
      within(dialog())
        .getByRole('radio', { name: /^Skilled/ })
        .closest('label'),
    ).toHaveClass('min-h-11', 'motion-reduce:transition-none');
  },
);
