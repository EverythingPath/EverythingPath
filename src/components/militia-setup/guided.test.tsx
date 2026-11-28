import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { newMilitiaSetup, type MilitiaSetup } from '~/lib/canonical-setup';
import { GuidedMilitiaSetup } from './guided';
import type { SetupCharacter } from './roster';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';

const maintenance = vi.fn<() => MigrationMaintenance>(() => ({
  kind: 'ready',
  readOnly: false,
  message: '',
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const hero: SetupCharacter = {
  characterId: 'hero',
  name: 'Hero',
  kind: 'pc',
  level: 4,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  isActive: true,
};

// Tablet and wider unless a test narrows the window below 768px.
function mockWidth(wide: boolean) {
  const listeners = new Set<() => void>();
  let matches = wide;
  window.matchMedia = vi.fn(() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return (next: boolean) => {
    matches = next;
    act(() => listeners.forEach((listener) => listener()));
  };
}

const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));
const fill = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name }), {
    target: { value },
  });
const choose = (label: string, name: string) =>
  fireEvent.click(
    within(screen.getByRole('group', { name: label })).getByRole('button', {
      name,
    }),
  );
const stepButton = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Setup steps' })).getByRole(
    'button',
    { name },
  );
const openStep = (name: string) => fireEvent.click(stepButton(name));
const start = () => {
  openStep('Review & start');
  click('Start militia week');
};
// Each step's name and status caption, as a screen reader announces them.
const statuses = () => {
  const text = (id: string | null) =>
    id ? document.getElementById(id)?.textContent : '';
  return within(screen.getByRole('navigation', { name: 'Setup steps' }))
    .getAllByRole('button')
    .map(
      (button) =>
        `${text(button.getAttribute('aria-labelledby'))}: ${text(button.getAttribute('aria-describedby'))}`,
    );
};

test('starting a militia observes editing availability without a parent-provided notice', () => {
  maintenance.mockReturnValue({
    kind: 'unavailable',
    readOnly: true,
    message: 'Editing availability could not be checked. Reload to try again.',
  });
  const save = vi.fn();
  render(<GuidedMilitiaSetup characters={[]} onSave={save} />);
  openStep('Review & start');
  expect(
    screen.getByRole('button', { name: 'Start militia week' }),
  ).toBeDisabled();
  expect(
    screen.getByText(
      'Editing availability could not be checked. Reload to try again.',
    ),
  ).toBeVisible();
  click('Start militia week');
  expect(save).not.toHaveBeenCalled();
});

test('[setup.form] setup distinguishes missing and malformed numbers and accepts advisory deviations', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<GuidedMilitiaSetup characters={[]} onSave={save} />);
  const rank = () => screen.getByRole('textbox', { name: 'Rank' });
  fireEvent.change(rank(), { target: { value: '' } });
  start();
  const summary = await screen.findByRole('alert');
  expect(summary).toHaveTextContent('1 thing to fix before starting');
  // The summary links to the field and focuses it on its step.
  fireEvent.click(
    within(summary).getByRole('button', { name: 'Rank is required.' }),
  );
  await waitFor(() => expect(rank()).toHaveFocus());
  expect(screen.getByText('Rank is required.')).toBeVisible();
  fireEvent.change(rank(), { target: { value: 'oops' } });
  expect(
    await screen.findByText('Enter a valid whole number for Rank.'),
  ).toBeVisible();
  start();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Enter a valid value for Rank.',
  );
  expect(save).not.toHaveBeenCalled();
  openStep('Starting point');
  expect(rank()).toHaveValue('oops');
  fireEvent.change(rank(), { target: { value: '5' } });
  click('Existing militia');
  choose('Focus', 'Security');
  // Rules mismatches are advisory: shown on their step, never blocking.
  expect(screen.getByLabelText('Rules warnings')).toHaveTextContent(
    'Rank never decreases',
  );
  start();
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'existing',
        state: expect.objectContaining({
          militiaSnapshot: expect.objectContaining({
            rank: 5,
            training: 0,
            treasuryCopper: 1000,
            focus: 'Security',
          }),
        }),
      }),
    ),
  );
}, 15000);

test('[setup.carry-form] character conditions and scoped expiring benefits can be carried into ordinary play', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<GuidedMilitiaSetup characters={[hero]} onSave={save} />);
  openStep('People & officers');
  click('Add Hero');
  openStep('Teams');
  click('Add team');
  fill('Team name', 'Scouts');
  openStep('Settlements');
  click('Add settlement');
  fill('Settlement name', 'Home');
  click('Record Reduce Danger benefit');
  fill('Reduce Danger ends week', '12');
  openStep('Character conditions');
  click('Add character condition');
  choose('Character', 'Hero');
  choose('Condition', 'captured');
  click('Record capture');
  choose('Capture source', 'raid');
  fill('Captured week', '3');
  fill('Rescued week (optional)', '2');
  fill('Rescued week (optional)', '');
  openStep('Carried effects');
  click('Add bonus');
  fill('Bonus source', 'Prior mission');
  choose('Bonus team (optional)', 'Scouts');
  choose('Bonus phase (optional)', 'activity');
  click('Add skill benefit');
  choose('Benefiting characters', 'Hero');
  choose('Affected skills', 'diplomacy');
  fill('Skill bonus', '2');
  fill('Skill benefit ends week', '12');
  click('Add Market Day benefit');
  choose('Discount settlements', 'Home');
  start();
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    state: {
      militiaSnapshot: {
        characterActions: {
          people: [
            {
              characterId: 'hero',
              status: 'captured',
              location: { kind: 'headquarters' },
              capture: { source: 'raid', week: 3 },
            },
          ],
        },
        settlements: [
          {
            name: 'Home',
            reduceDangerReputationShift: 1,
            reduceDangerUntilWeek: 12,
          },
        ],
        bonuses: [
          {
            source: 'Prior mission',
            teamId: expect.any(String),
            phase: 'activity',
          },
        ],
        eventBenefits: {
          skills: [
            {
              characterIds: ['hero'],
              skills: ['diplomacy'],
              value: 2,
              endsWeek: 12,
            },
          ],
          markets: [
            { discountPercent: 5, settlementIds: [expect.any(String)] },
          ],
        },
      },
    },
  });
}, 15000);

test('[rules.U01.setup-form] switching to an existing militia clears the initial Upkeep skip', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<GuidedMilitiaSetup characters={[]} onSave={save} />);
  openStep('Week');
  expect(
    within(screen.getByRole('group', { name: 'First militia week' })).getByRole(
      'button',
      { name: 'Yes' },
    ),
  ).toHaveAttribute('aria-pressed', 'true');
  click('Existing militia');
  fill('Current week', '9');
  expect(
    screen.queryByRole('group', { name: 'First militia week' }),
  ).not.toBeInTheDocument();
  // Switching back changes nothing else; the skip stays cleared until chosen.
  click('New militia');
  expect(
    within(screen.getByRole('group', { name: 'First militia week' })).getByRole(
      'button',
      { name: 'No' },
    ),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('textbox', { name: 'Current week' })).toHaveValue(
    '9',
  );
  click('Existing militia');
  start();
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'existing',
        state: expect.objectContaining({
          week: 9,
          context: expect.objectContaining({ firstMilitiaWeek: false }),
        }),
      }),
    ),
  );
});

test('[setup.receipt-decimal] enchantment delivery preserves decimal input and explicit receipt days', async () => {
  const initial = newMilitiaSetup('Loyalty');
  initial.state.militiaSnapshot.settlements = [
    {
      settlementId: 'town',
      name: 'Town',
      reputation: 'Friendly',
      secured: true,
      occupied: false,
      temporaryReputationShift: 0,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    },
  ];
  initial.state.militiaSnapshot.economy = {
    items: [
      {
        itemId: 'sword',
        name: 'Sword',
        valueCopper: 1234,
        weight: 2,
        location: 'order',
      },
    ],
    caches: [],
    markets: [],
    orders: [
      {
        orderId: 'order',
        itemId: 'sword',
        settlementId: 'town',
        source: 'special_order',
        mode: 'enchantment',
        orderedWeek: 1,
        orderedDay: 0,
        dueDay: 1,
        dueActivityWeek: null,
        priceCopper: 1234,
        deliveryDays: 1,
        enchantmentValueCopper: 50000,
        receipt: null,
      },
    ],
  };
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <GuidedMilitiaSetup
      initialValues={initial}
      characters={[]}
      onSave={save}
    />,
  );
  openStep('Assets');
  const duration = screen.getByRole('textbox', {
    name: 'Delivery duration (days)',
  });
  fireEvent.change(duration, { target: { value: '0.' } });
  expect(duration).toHaveValue('0.');
  fireEvent.change(duration, { target: { value: '0.5' } });
  fill('Due day (day delivery)', '0.5');
  click('Record receipt');
  fill('Received day', '');
  start();
  const summary = await screen.findByRole('alert');
  fireEvent.click(
    within(summary).getByRole('button', {
      name: 'Order 1: received day is required.',
    }),
  );
  const received = screen.getByRole('textbox', { name: 'Received day' });
  await waitFor(() => expect(received).toHaveFocus());
  expect(screen.getByText('Received day is required.')).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(received, { target: { value: 'abc' } });
  expect(
    await screen.findByText('Enter a valid whole number for Received day.'),
  ).toBeVisible();
  fireEvent.change(received, { target: { value: '2' } });
  start();
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    state: {
      militiaSnapshot: {
        economy: {
          orders: [
            {
              priceCopper: 1234,
              dueDay: 0.5,
              deliveryDays: 0.5,
              enchantmentValueCopper: 50000,
              receipt: { receivedDay: 2 },
            },
          ],
        },
      },
    },
  });
  openStep('Assets');
  click('Mark unreceived');
  start();
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]?.[0]).toMatchObject({
    state: {
      militiaSnapshot: {
        economy: { orders: [{ receipt: null, dueDay: 0.5 }] },
      },
    },
  });
}, 15000);

const teams = (...ids: string[]) =>
  ids.map((teamId) => ({
    teamId,
    name: teamId,
    teamType: 'defenders' as const,
    status: 'active' as const,
    rewardCapExempt: false,
    managerCharacterId: null,
    notes: '',
  }));

test('[setup.event-instances] repeated carried events retain separate targets, age, order and mitigation when another is removed', async () => {
  const initial = newMilitiaSetup('Loyalty');
  initial.mode = 'existing';
  initial.state.week = 9;
  initial.state.context.firstMilitiaWeek = false;
  initial.state.context.lastBuyoffWeek = 6;
  initial.state.militiaSnapshot.roster.teams = teams('north', 'south');
  initial.state.context.carriedEvents = [
    {
      eventId: 'older',
      eventType: 'theft',
      startedWeek: 5,
      order: 1,
      targets: [{ kind: 'team', teamId: 'north' }],
    },
    {
      eventId: 'younger',
      eventType: 'theft',
      startedWeek: 7,
      order: 2,
      targets: [{ kind: 'team', teamId: 'south' }],
    },
  ];
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <GuidedMilitiaSetup
      initialValues={initial}
      characters={[]}
      onSave={save}
    />,
  );
  openStep('Carried effects');
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Event 1' })).getByRole('button', {
      name: 'Record Theft mitigation',
    }),
  );
  start();
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    state: {
      context: {
        lastBuyoffWeek: 6,
        carriedEvents: [
          {
            eventId: 'older',
            startedWeek: 5,
            order: 1,
            targets: [{ kind: 'team', teamId: 'north' }],
            mitigation: { week: 9, retainedIncomePercent: 90 },
          },
          {
            eventId: 'younger',
            startedWeek: 7,
            order: 2,
            targets: [{ kind: 'team', teamId: 'south' }],
          },
        ],
      },
    },
  });
  openStep('Carried effects');
  click('Remove Event 1');
  start();
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]?.[0].state.context.carriedEvents).toEqual([
    initial.state.context.carriedEvents[1],
  ]);
});

test('[setup.event-references] removing a targeted team blocks save until the carried event is removed', async () => {
  const initial = newMilitiaSetup('Loyalty');
  initial.state.militiaSnapshot.roster.teams = teams('patrol');
  initial.state.context.carriedEvents = [
    {
      eventId: 'sickness',
      eventType: 'sickness',
      startedWeek: 0,
      order: 0,
      targets: [{ kind: 'team', teamId: 'patrol' }],
    },
  ];
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <GuidedMilitiaSetup
      initialValues={initial}
      characters={[]}
      onSave={save}
    />,
  );
  openStep('Teams');
  click('Remove Team 1');
  start();
  const summary = await screen.findByRole('alert');
  const message =
    'A carried event, order or queued effect refers to an entity missing from this setup. Restore it or choose another target.';
  expect(summary).toHaveTextContent(message);
  expect(summary).toHaveTextContent('· Carried effects');
  expect(save).not.toHaveBeenCalled();
  // The link opens the step and focuses the entry that needs repair.
  fireEvent.click(within(summary).getByRole('button', { name: message }));
  await waitFor(() =>
    expect(screen.getByRole('group', { name: 'Event 1' })).toContainElement(
      document.activeElement as HTMLElement,
    ),
  );
  expect(stepButton('Carried effects')).toHaveAccessibleDescription('1 to fix');
  click('Remove Event 1');
  start();
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    state: {
      context: { carriedEvents: [] },
      militiaSnapshot: { roster: { teams: [] } },
    },
  });
});

test('[setup.guided.navigation] steps navigate freely with invalid input, keep every entry and never submit', () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const { container } = render(
    <GuidedMilitiaSetup characters={[hero]} onSave={save} />,
  );
  expect(statuses()).toEqual([
    'Starting point: Done',
    'Week: ',
    'People & officers: ',
    'Teams: ',
    'Settlements: ',
    'Character conditions: Optional · skipped',
    'Assets: Optional · skipped',
    'Carried effects: Optional · skipped',
    'Review & start: Ready to start',
  ]);
  expect(stepButton('Starting point')).toHaveAttribute('aria-current', 'step');
  fill('Rank', 'oops');
  // Next never validates or submits; it opens the next step and names it.
  click('Next: Week');
  expect(screen.getByRole('heading', { level: 2, name: 'Week' })).toHaveFocus();
  click('Next: People & officers');
  click('Add Hero');
  click('commandant');
  openStep('Carried effects');
  click('Add bonus');
  fill('Bonus source', 'Prior mission');
  // Enter in a field never starts the militia.
  fireEvent.submit(container.querySelector('form')!);
  openStep('Starting point');
  expect(screen.getByRole('textbox', { name: 'Rank' })).toHaveValue('oops');
  openStep('Carried effects');
  expect(screen.getByRole('textbox', { name: 'Bonus source' })).toHaveValue(
    'Prior mission',
  );
  openStep('People & officers');
  expect(screen.getByRole('button', { name: 'commandant' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(statuses()).toEqual([
    'Starting point: 1 to fix',
    'Week: Done',
    'People & officers: Done',
    'Teams: ',
    'Settlements: ',
    'Character conditions: Optional · skipped',
    'Assets: Optional · skipped',
    'Carried effects: Done',
    'Review & start: 1 to fix',
  ]);
  // Once every field is well formed nothing blocks the start: the
  // commandant's blank Hit Dice follow the character's level.
  openStep('Starting point');
  fill('Rank', '1');
  expect(statuses().slice(0, 3)).toEqual([
    'Starting point: Done',
    'Week: Done',
    'People & officers: Done',
  ]);
  expect(statuses()[8]).toBe('Review & start: Ready to start');
  // Switching to an existing militia keeps every entry and ends the optional
  // grouping.
  click('Existing militia');
  expect(statuses()[5]).toBe('Character conditions: ');
  expect(screen.getByRole('textbox', { name: 'Rank' })).toHaveValue('1');
  openStep('People & officers');
  expect(screen.getByRole('group', { name: 'Hero' })).toBeVisible();
  expect(save).not.toHaveBeenCalled();
}, 15000);

test('guided steps show no explanatory section captions', () => {
  render(<GuidedMilitiaSetup characters={[hero]} onSave={vi.fn()} />);
  for (const step of [
    'People & officers',
    'Character conditions',
    'Assets',
    'Carried effects',
  ]) {
    openStep(step);
    expect(
      screen.queryByText(
        /campaign ledger|hide, rescue|agreed delivery|5% discount/,
      ),
    ).toBeNull();
  }
});

test('[setup.guided.warnings] Review groups warnings by step and links each to its field', async () => {
  render(<GuidedMilitiaSetup characters={[]} onSave={vi.fn()} />);
  fill('Notoriety', '120');
  openStep('Week');
  choose('Open phase', 'persistent');
  expect(screen.getByLabelText('Rules warnings')).toHaveTextContent(
    'The week will open in Upkeep.',
  );
  expect(stepButton('Starting point')).toHaveAccessibleDescription('1 warning');
  openStep('Review & start');
  const review = screen.getByRole('heading', {
    name: 'Warnings by step',
  }).parentElement!;
  expect(
    within(review)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual([
    'Starting point',
    'Notoriety is outside the normal range of 0–100.',
    'Week',
    'There are no carried persistent events. The week will open in Upkeep.',
  ]);
  fireEvent.click(
    within(review).getByRole('button', {
      name: 'Notoriety is outside the normal range of 0–100.',
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Notoriety' })).toHaveFocus(),
  );
  openStep('Review & start');
  fireEvent.click(
    within(
      screen.getByRole('heading', { name: 'Warnings by step' }).parentElement!,
    ).getByRole('button', { name: 'Week' }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { level: 2, name: 'Week' }),
    ).toHaveFocus(),
  );
});

test('[setup.guided.phone] phone rows open one at a time with Next inside, and a breakpoint change keeps values and focus', async () => {
  const resize = mockWidth(false);
  const save = vi.fn().mockResolvedValue(undefined);
  render(<GuidedMilitiaSetup characters={[hero]} onSave={save} />);
  expect(
    screen.queryByRole('navigation', { name: 'Setup steps' }),
  ).not.toBeInTheDocument();
  const header = (name: string) => screen.getByRole('button', { name });
  expect(header('Starting point')).toHaveAttribute('aria-expanded', 'true');
  expect(header('Week')).toHaveAttribute('aria-expanded', 'false');
  expect(header('Assets')).toHaveAccessibleDescription('Optional · skipped');
  const row = screen.getByRole('region', { name: 'Starting point' });
  fireEvent.change(within(row).getByRole('textbox', { name: 'Rank' }), {
    target: { value: '' },
  });
  fireEvent.click(within(row).getByRole('button', { name: 'Next: Week' }));
  expect(header('Week')).toHaveFocus();
  expect(header('Starting point')).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getAllByRole('region')).toHaveLength(1);
  fireEvent.click(header('Review & start'));
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Review & start' })).getByRole(
      'button',
      { name: 'Start militia week' },
    ),
  );
  // The summary link expands the right row and focuses its field.
  fireEvent.click(
    await screen.findByRole('button', { name: 'Rank is required.' }),
  );
  const rank = await screen.findByRole('textbox', { name: 'Rank' });
  await waitFor(() => expect(rank).toHaveFocus());
  expect(header('Starting point')).toHaveAttribute('aria-expanded', 'true');
  fireEvent.change(rank, { target: { value: '3' } });
  // Rotating to a tablet remounts the editors in the detail pane; the value
  // and the focused control survive.
  resize(true);
  expect(
    screen.getByRole('navigation', { name: 'Setup steps' }),
  ).toBeInTheDocument();
  const wideRank = screen.getByRole('textbox', { name: 'Rank' });
  expect(wideRank).toHaveValue('3');
  expect(wideRank).toHaveFocus();
  resize(false);
  expect(screen.getByRole('textbox', { name: 'Rank' })).toHaveFocus();
  expect(save).not.toHaveBeenCalled();
});

test('[setup.guided.start] starting shows progress, blocks duplicates and keeps entries for a retry', async () => {
  let fail: (error: Error) => void = () => undefined;
  const save = vi
    .fn<(setup: MilitiaSetup) => Promise<void>>()
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    )
    .mockResolvedValueOnce(undefined);
  render(<GuidedMilitiaSetup characters={[]} onSave={save} />);
  fill('Rank', '2');
  start();
  const pending = await screen.findByRole('button', {
    name: 'Starting militia…',
  });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(save).toHaveBeenCalledOnce();
  await act(async () => fail(new Error('offline')));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Militia setup could not be saved. Your entries are retained.',
  );
  click('Start militia week');
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]![0]).toEqual(save.mock.calls[0]![0]);
  expect(save.mock.calls[1]![0].state.militiaSnapshot.rank).toBe(2);
});
