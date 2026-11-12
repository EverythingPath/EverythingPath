import { api } from '@convex/_generated/api';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { CharacterCohort } from './character-cohort';
import {
  brynRelationship,
  buildCohortSheet,
  leadershipSource,
} from './character-cohort-test-fixture';
import {
  buildCompanionRelationshipView,
  type CompanionRelationship,
} from './character-companions-view-model';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import { useCharacterCohort } from './use-character-cohort';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// Cohorts under Leadership (#417): the cohort's own Cohort Equivalence with
// its editor and the level its leader allows, and the leader's Leadership
// modifiers per cohort source. Every number comes from the calculation.

const names = characterSheetNames({
  setCohortEquivalence: api.characterSheet.setCohortEquivalence,
  setSourceAllocation: api.companionRelationships.setSourceAllocation,
});
const server = vi.hoisted(() => ({
  write: vi.fn(),
  maintenance: { kind: 'ready', readOnly: false, message: '' },
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof names>[0]) => (args: unknown) =>
    server.write(names(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => server.maintenance,
}));

const warningControls = {
  accept: vi.fn(),
  reopen: vi.fn(),
  statusFor: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
function Host({
  snapshot,
  rows,
}: {
  snapshot: CharacterSheetSnapshot;
  rows: CompanionRelationship[];
}) {
  const controller = useCharacterCohort({
    scope: { characterId: snapshot.character._id },
    snapshot,
    rows: rows.map((row) => buildCompanionRelationshipView(row)),
  });
  return (
    <main>
      <CharacterCohort
        controller={controller}
        warningController={warningControls}
        characterId={snapshot.character._id}
      />
    </main>
  );
}
function renderCohort({
  snapshot = buildCohortSheet(),
  rows = [],
}: { snapshot?: CharacterSheetSnapshot; rows?: CompanionRelationship[] } = {}) {
  const view = render(<Host snapshot={snapshot} rows={rows} />);
  return {
    rerender: (next: CharacterSheetSnapshot) =>
      view.rerender(<Host snapshot={next} rows={rows} />),
  };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const region = (name: string) => screen.getByRole('region', { name });
const facts = (name: string) => screen.getByLabelText(name, { selector: 'dl' });
const fact = (list: HTMLElement, label: string) =>
  within(list).getByRole('definition', { name: label });
const lastCall = () => server.write.mock.calls.at(-1);
const save = (name: string) => fireEvent.submit(button(name).closest('form')!);

beforeEach(() => {
  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  server.write.mockReset().mockResolvedValue(null);
  warningControls.accept.mockReset();
});

test('a published monster cohort shows its equivalence with provenance, basis and citation, its status and its sources', () => {
  renderCohort({
    snapshot: buildCohortSheet({
      equivalence: { kind: 'published', creatureKey: 'pegasus' },
      leader: { level: 15, charisma: 2 },
    }),
  });
  const cohort = region('Cohort');
  expect(within(cohort).getByText('Supported by its leader')).toBeVisible();
  const equivalence = facts('Cohort Equivalence');
  expect(fact(equivalence, 'Cohort Equivalence')).toHaveTextContent('11');
  expect(
    within(equivalence).getByText('Published monster cohort'),
  ).toBeVisible();
  expect(
    within(cohort).getByText(
      'Pegasus (published cohort level 6) + 5 Class Levels = 11.',
    ),
  ).toBeVisible();
  expect(
    within(equivalence.parentElement!).getByText('Pathfinder RPG Bestiary'),
  ).toBeVisible();
  expect(within(cohort).queryByText(/actual Hit Dice/i)).toBeNull();
  const sources = within(cohort).getByRole('list', { name: 'Sources' });
  expect(
    within(sources)
      .getAllByRole('listitem')
      .map((e) => e.textContent),
  ).toEqual([
    'Pathfinder RPG Core Rulebook, p. 129',
    'Pathfinder RPG Bestiary',
  ]);
  expect(screen.queryByRole('region', { name: 'Leadership' })).toBeNull();
});

test('the editor opens on the first choice, searches the published cohorts as cards, saves the chosen one and returns focus to its opener', async () => {
  renderCohort();
  expect(
    fact(facts('Cohort Equivalence'), 'Cohort Equivalence'),
  ).toHaveTextContent('5');
  fireEvent.click(button('Edit Cohort Equivalence'));
  const form = screen.getByRole('form', { name: 'Edit Cohort Equivalence' });
  expect(radio('Ordinary cohort (Class Levels)')).toHaveFocus();
  expect(within(form).getByRole('radiogroup', { name: 'Basis' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Use Class Levels' })).toBeNull();

  fireEvent.click(radio('Published monster cohort'));
  save('Save Cohort Equivalence');
  expect(await within(form).findByRole('alert')).toHaveTextContent(
    'Choose a published monster cohort.',
  );
  expect(server.write).not.toHaveBeenCalled();

  const cards = within(form).getByRole('radiogroup', {
    name: 'Monster cohort',
  });
  expect(within(cards).getAllByRole('radio')).toHaveLength(29);
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search monster cohorts' }),
    {
      target: { value: 'peg' },
    },
  );
  expect(within(cards).getAllByRole('radio')).toHaveLength(1);
  const pegasus = radio(/Pegasus/);
  expect(pegasus).toHaveAccessibleName(
    'Pegasus Cohort level 6 Pathfinder RPG Bestiary',
  );
  fireEvent.click(pegasus);
  save('Save Cohort Equivalence');
  await waitFor(() =>
    expect(lastCall()).toEqual([
      'setCohortEquivalence',
      expect.objectContaining({
        equivalence: { kind: 'published', creatureKey: 'pegasus' },
      }),
    ]),
  );
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
  expect(button('Edit Cohort Equivalence')).toHaveFocus();
});

test('an unlisted creature tells an empty name from a malformed level, keeps a refused draft with its reason, and Use Class Levels clears the record', async () => {
  renderCohort({
    snapshot: buildCohortSheet({
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: 4 },
    }),
  });
  fireEvent.click(button('Edit Cohort Equivalence'));
  expect(radio('Unlisted creature')).toBeChecked();
  expect(field('Creature')).toHaveValue('Hippogriff');
  const level = field('Cohort Equivalence');
  expect(level).toHaveValue('4');
  expect(level).toHaveAttribute('inputmode', 'numeric');
  expect(level).toHaveAccessibleDescription(
    'Leave empty until you know it; the sheet shows it as missing. Hit Dice and Challenge Rating are not used.',
  );

  fireEvent.change(field('Creature'), { target: { value: '  ' } });
  fireEvent.change(level, { target: { value: '4.5' } });
  save('Save Cohort Equivalence');
  const alerts = await screen.findAllByRole('alert');
  expect(alerts.map((alert) => alert.textContent)).toEqual([
    'Enter the creature’s name.',
    'Enter a whole number from 1 to 30.',
  ]);
  expect(server.write).not.toHaveBeenCalled();

  server.write.mockRejectedValueOnce(new ConvexError('Not a cohort'));
  fireEvent.change(field('Creature'), { target: { value: 'Hippogriff' } });
  fireEvent.change(level, { target: { value: '' } });
  save('Save Cohort Equivalence');
  await waitFor(() =>
    expect(lastCall()).toEqual([
      'setCohortEquivalence',
      expect.objectContaining({
        equivalence: { kind: 'entered', creature: 'Hippogriff', level: null },
      }),
    ]),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Cohort Equivalence wasn't saved: Not a cohort. Try again.",
  );
  expect(field('Creature')).toHaveValue('Hippogriff');

  const clear = button('Use Class Levels');
  expect(clear).toHaveAccessibleDescription(
    'Use Class Levels makes this an ordinary cohort again and keeps every other choice.',
  );
  fireEvent.click(clear);
  await waitFor(() =>
    expect(lastCall()).toEqual([
      'setCohortEquivalence',
      expect.objectContaining({ equivalence: null }),
    ]),
  );
});

test('the allowed level lists the leader’s values with where they come from, the modifiers, the Leadership Score and what it would attract now', () => {
  const view = renderCohort({
    snapshot: buildCohortSheet({
      leader: { level: null, charisma: null },
    }),
  });
  let allowed = facts('Allowed level');
  expect(fact(allowed, 'Allowed level')).toHaveTextContent('Unresolved');
  expect(fact(allowed, 'Leader’s character level')).toHaveTextContent(
    'Unresolved',
  );
  expect(fact(allowed, 'Leader’s Charisma modifier')).toHaveTextContent(
    'Unresolved',
  );
  expect(
    screen.getByText(
      'Enter a fallback in the cohort’s Companion Relationship.',
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      'The leader’s character level and Charisma modifier are needed. Save fallbacks while they are unavailable.',
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      'The level this cohort’s leader allows and the leader’s Leadership Score need the leader’s character level and Charisma modifier. Save fallbacks while they are unavailable.',
    ),
  ).toHaveClass('text-sky-300');
  expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull();

  view.rerender(
    buildCohortSheet({
      leader: {
        level: null,
        charisma: null,
        fallbacks: { level: 9, charisma: 2 },
      },
      sources: [
        {
          sourceKey: 'leadership',
          counting: true,
          leadershipModifiers: {
            reputation: ['greatRenown'],
            hasCompanion: true,
            differentAlignment: false,
            cohortDeaths: 0,
            other: 0,
          },
        },
      ],
    }),
  );
  allowed = facts('Allowed level');
  expect(fact(allowed, 'Leader’s character level')).toHaveTextContent('9');
  expect(
    within(fact(allowed, 'Leader’s character level').parentElement!).getByText(
      'Using saved fallback',
    ),
  ).toBeVisible();
  expect(fact(allowed, 'Leader’s Charisma modifier')).toHaveTextContent('+2');
  expect(
    screen.queryByText(
      'Enter a fallback in the cohort’s Companion Relationship.',
    ),
  ).toBeNull();
  const modifiers = within(allowed).getByRole('list', {
    name: 'Leadership modifiers',
  });
  expect(
    within(modifiers)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([
    'Great renown+2',
    'Has a familiar, special mount, or animal companion at recruitment-2',
  ]);
  expect(fact(allowed, 'Leadership Score')).toHaveTextContent('11');
  expect(fact(allowed, 'Leadership Score would attract now')).toHaveTextContent(
    '7th level',
  );
  expect(fact(allowed, 'Allowed level')).toHaveTextContent('7th level');
  expect(
    within(fact(allowed, 'Allowed level').parentElement!).getByText(
      'Two or more levels below the leader',
    ),
  ).toBeVisible();
});

test('modifiers hidden with the leader read Unavailable, never None', () => {
  const view = renderCohort({
    snapshot: buildCohortSheet({
      sources: [{ sourceKey: 'rule:cohort', counting: true }],
      areModifiersUndisclosed: true,
    }),
  });
  let allowed = facts('Allowed level');
  expect(fact(allowed, 'Leadership modifiers')).toHaveTextContent(
    'Unavailable',
  );
  expect(fact(allowed, 'Leadership Score')).toHaveTextContent('Unresolved');
  expect(fact(allowed, 'Allowed level')).toHaveTextContent('7th level');
  // An accessible leader with no recorded modifiers has none.
  view.rerender(buildCohortSheet());
  allowed = facts('Allowed level');
  expect(fact(allowed, 'Leadership modifiers')).toHaveTextContent('None');
});

test('a cohort not two levels below its leader is one amber rules check with Accept, and its Class Levels are kept', () => {
  renderCohort({
    snapshot: buildCohortSheet({
      levels: 2,
      equivalence: { kind: 'published', creatureKey: 'griffon' },
      leader: { level: 9, charisma: -1 },
      permanentCharisma: -3,
    }),
  });
  const cohort = region('Cohort');
  const accept = within(cohort).getByRole('button', { name: 'Accept' });
  expect(accept).toHaveAccessibleDescription(
    /Cohort Equivalence 10 is above what its leader allows: .* Its Class Levels are kept\./,
  );
  expect(
    within(cohort).getAllByText(/Its Class Levels are kept\./),
  ).toHaveLength(1);
  const allowed = facts('Allowed level');
  // Leader 9 allows 7th. Score 8 would attract 5th now, 4th without the
  // temporary Charisma: information only.
  expect(fact(allowed, 'Allowed level')).toHaveTextContent('7th level');
  expect(fact(allowed, 'Leadership Score would attract now')).toHaveTextContent(
    '5th level',
  );
  expect(
    within(allowed).getByText('Without temporary effects: 4th level'),
  ).toBeVisible();
  fireEvent.click(accept);
  expect(warningControls.accept).toHaveBeenCalledWith(
    expect.objectContaining({ check: 'cohortOverLevel' }),
  );
});

test('an advanced cohort above what the score would attract now, but two levels below its leader, shows the table as information and no rules check', () => {
  // CRB p. 129 consults the table only when a cohort is attracted. Leader 9,
  // Charisma −3: score 6 would attract 4th now; the cohort is 7th.
  renderCohort({
    snapshot: buildCohortSheet({
      levels: 7,
      leader: { level: 9, charisma: -3 },
    }),
  });
  const cohort = region('Cohort');
  expect(within(cohort).queryByRole('button', { name: 'Accept' })).toBeNull();
  expect(within(cohort).queryByText(/above what its leader allows/)).toBeNull();
  const allowed = facts('Allowed level');
  expect(fact(allowed, 'Allowed level')).toHaveTextContent('7th level');
  expect(fact(allowed, 'Leadership Score would attract now')).toHaveTextContent(
    '4th level',
  );
  expect(
    within(cohort).getByText(
      'Leadership Score 6 (level 9, Charisma -3) would attract a cohort of up to 4th level now. The table applies only when a cohort is attracted; afterwards a cohort stays two or more levels below its leader.',
    ),
  ).toBeVisible();
});

test('a missing equivalence is a blue prompt without Accept; a dormant link keeps its equivalence without an allowed level; an unlinked record shows the equivalence alone', () => {
  const view = renderCohort({
    snapshot: buildCohortSheet({
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: null },
    }),
  });
  expect(
    fact(facts('Cohort Equivalence'), 'Cohort Equivalence'),
  ).toHaveTextContent('Unresolved');
  expect(
    screen.getByText(/Enter the Cohort Equivalence for Hippogriff\./),
  ).toHaveClass('text-sky-300');
  expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull();
  expect(fact(facts('Allowed level'), 'Allowed level')).toHaveTextContent(
    '7th level',
  );

  view.rerender(
    buildCohortSheet({
      sources: [{ sourceKey: 'leadership', counting: false }],
    }),
  );
  expect(screen.getByText('No supporting source counts now')).toBeVisible();
  expect(
    fact(facts('Cohort Equivalence'), 'Cohort Equivalence'),
  ).toHaveTextContent('5');
  expect(
    screen.queryByLabelText('Allowed level', { selector: 'dl' }),
  ).toBeNull();

  view.rerender(
    buildCohortSheet({
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: 4 },
      leader: null,
    }),
  );
  expect(screen.getByText('Not linked to a leader')).toBeVisible();
  expect(
    screen.getByText('Hippogriff (entered 4) + 5 Class Levels = 9.'),
  ).toBeVisible();
  expect(
    screen.queryByLabelText('Allowed level', { selector: 'dl' }),
  ).toBeNull();

  view.rerender(buildCohortSheet({ leader: null }));
  expect(screen.queryByRole('region', { name: 'Cohort' })).toBeNull();
});

test('the leader edits each cohort’s Leadership modifiers in place: reputation cards, switches, both counts with their own messages, Save and Clear', async () => {
  const recorded = {
    ...brynRelationship,
    sources: [
      {
        ...leadershipSource,
        leadershipModifiers: {
          reputation: ['greatRenown'],
          hasCompanion: false,
          differentAlignment: false,
          cohortDeaths: 0,
          other: 0,
        },
      },
    ],
  } satisfies CompanionRelationship;
  renderCohort({
    snapshot: buildCohortSheet({ levels: 9, leader: null }),
    rows: [recorded],
  });
  expect(screen.queryByRole('region', { name: 'Cohort' })).toBeNull();
  const leadership = region('Leadership');
  const bryn = within(leadership).getByRole('listitem', { name: 'Bryn' });
  expect(within(bryn).getByText('Leadership')).toBeVisible();
  const read = within(bryn).getByLabelText('Leadership for Bryn', {
    selector: 'dl',
  });
  expect(fact(read, 'Would attract now')).toHaveTextContent('7th level');
  expect(
    within(within(read).getByRole('list', { name: 'Leadership modifiers' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Great renown+2']);
  expect(
    within(bryn).getByText(
      'Leadership Score 11 would attract a cohort of up to 7th level now.',
    ),
  ).toBeVisible();

  fireEvent.click(button('Edit Leadership modifiers for Bryn'));
  const form = screen.getByRole('form', {
    name: 'Leadership modifiers for Bryn',
  });
  const reputation = within(form).getByRole('group', { name: 'Reputation' });
  const renown = within(reputation).getByRole('checkbox', {
    name: 'Great renown +2',
  });
  expect(renown).toBeChecked();
  expect(renown).toHaveFocus();
  expect(within(reputation).getAllByRole('checkbox')).toHaveLength(6);
  fireEvent.click(
    within(reputation).getByRole('checkbox', { name: 'Cruelty -2' }),
  );
  const companion = within(form).getByRole('switch', {
    name: 'Has a familiar, special mount, or animal companion at recruitment -2',
  });
  expect(companion).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(companion);
  expect(companion).toHaveAttribute('aria-checked', 'true');
  expect(
    within(form).getByRole('switch', {
      name: 'Recruits a cohort of a different alignment -1',
    }),
  ).toHaveAttribute('aria-checked', 'false');

  const killed = field('Cohorts killed');
  expect(killed).toHaveAttribute('inputmode', 'numeric');
  expect(killed).toHaveAccessibleDescription('-2 each');
  const other = field('Other modifiers');
  expect(other).not.toHaveAttribute('inputmode');
  expect(other).toHaveAccessibleDescription(
    'Modifiers from rules outside the Core Rulebook table.',
  );
  fireEvent.change(killed, { target: { value: '' } });
  fireEvent.change(other, { target: { value: '' } });
  save('Save Leadership modifiers');
  let alerts = await within(form).findAllByRole('alert');
  expect(alerts.map((alert) => alert.textContent)).toEqual([
    'Enter how many cohorts were killed, or 0.',
    'Enter the other modifiers, or 0.',
  ]);
  fireEvent.change(killed, { target: { value: 'two' } });
  fireEvent.change(other, { target: { value: '99' } });
  save('Save Leadership modifiers');
  await waitFor(() => {
    alerts = within(form).getAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Enter a whole number from 0 to 20.',
      'Enter a whole number from -20 to 20.',
    ]);
  });
  expect(server.write).not.toHaveBeenCalled();

  fireEvent.change(killed, { target: { value: '1' } });
  fireEvent.change(other, { target: { value: '-3' } });
  save('Save Leadership modifiers');
  await waitFor(() =>
    expect(lastCall()).toEqual([
      'setSourceAllocation',
      expect.objectContaining({
        relationshipId: 'rel-bryn',
        sourceKey: 'leadership',
        leadership: {
          reputation: ['greatRenown', 'cruelty'],
          hasCompanion: true,
          differentAlignment: false,
          cohortDeaths: 1,
          other: -3,
        },
      }),
    ]),
  );
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
  expect(button('Edit Leadership modifiers for Bryn')).toHaveFocus();

  fireEvent.click(button('Edit Leadership modifiers for Bryn'));
  fireEvent.click(button('Clear modifiers for Bryn'));
  await waitFor(() =>
    expect(lastCall()).toEqual([
      'setSourceAllocation',
      expect.objectContaining({ leadership: null }),
    ]),
  );
});

test('a cohort without recorded modifiers reads None recorded and offers no Clear', () => {
  renderCohort({
    snapshot: buildCohortSheet({ levels: 9, leader: null }),
    rows: [brynRelationship],
  });
  const bryn = screen.getByRole('listitem', { name: 'Bryn' });
  expect(within(bryn).getByText('None recorded')).toBeVisible();
  fireEvent.click(button('Edit Leadership modifiers for Bryn'));
  expect(screen.queryByRole('button', { name: /Clear modifiers/ })).toBeNull();
  fireEvent.click(button('Cancel editing Leadership modifiers'));
  expect(screen.queryByRole('form')).toBeNull();
  expect(server.write).not.toHaveBeenCalled();
});

test('maintenance keeps every value readable and disables the editors with the reason', () => {
  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  renderCohort({
    snapshot: buildCohortSheet({
      equivalence: { kind: 'published', creatureKey: 'pegasus' },
      leader: { level: 15, charisma: 2 },
    }),
    rows: [brynRelationship],
  });
  expect(
    fact(facts('Cohort Equivalence'), 'Cohort Equivalence'),
  ).toHaveTextContent('11');
  expect(fact(facts('Allowed level'), 'Allowed level')).toHaveTextContent(
    '13th level',
  );
  const edit = button('Edit Cohort Equivalence');
  expect(edit).toBeDisabled();
  expect(edit).toHaveAccessibleDescription(message);
  const editLeadership = button('Edit Leadership modifiers for Bryn');
  expect(editLeadership).toBeDisabled();
  expect(editLeadership).toHaveAccessibleDescription(message);
  expect(screen.getAllByText(message)).toHaveLength(1);
  fireEvent.click(edit);
  expect(screen.queryByRole('form')).toBeNull();
});
