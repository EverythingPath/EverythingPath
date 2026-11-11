import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WorkspaceGateway } from './gateway';
import { CampaignWorkspaceProvider } from './campaign-workspace-provider';
import { WeeklyWorkspaceBoard } from './board';
import { expectSameConfirm } from './confirm-control-test-helpers';
import { PersistentView } from './persistent-view';
import type {
  LocalFormGuard,
  LocalFormRegistration,
} from './use-summary-forms';
import type { PersistentView as Facts } from './types';

// A reasoned table ending typed in Persistent is this device's unsaved
// local form: it registers with the Workspace's Confirm guard, so its input
// survives leaving the phase and Review & confirm holds Confirm with a
// reason and a Go to form link until it is saved or abandoned.

const factory = vi.fn<(...args: unknown[]) => WorkspaceGateway | null>();
vi.mock('./gateway', () => ({
  createConvexWorkspaceGateway: (...args: unknown[]) => factory(...args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock('convex/react', () => ({
  useConvex: () => ({}),
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));
vi.mock('~/components/historical-week/use-recent-history', () => ({
  useRecentHistory: () => ({ status: 'idle', weeks: [], retry: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Week 4 with one Theft carried from week 3.
function carriedTheftWeek() {
  const draft = createWeeklyDraft({
    draftId: 'workspace',
    week: 4,
    slotIds: ['left'],
    context: {
      firstMilitiaWeek: true,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [
        {
          eventId: 'carried',
          eventType: 'theft',
          startedWeek: 3,
          order: 0,
          targets: [],
        },
      ],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'workspace' },
    week: 4,
    sourceRevision: 0,
    snapshot: {
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      notoriety: 0,
      focus: 'Loyalty',
      roster: { people: [], teams: [], officers: [] },
      characters: [],
      settlements: [],
      bonuses: [],
    },
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, source.snapshot);
  const gateway: WorkspaceGateway = {
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  };
  return { gateway, authority };
}
const nextFrame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
const stepper = () =>
  within(screen.getByRole('navigation', { name: 'Week phases' }));
const outcome = () => screen.getByRole('textbox', { name: 'How it ended' });
const reason = () =>
  screen.getByRole('textbox', { name: 'Rules Exception reason' });
const endedCard = () =>
  screen.getByRole('button', { name: 'Ended at the table' });

test('[PER-06.guard] a half-typed table ending survives leaving Persistent and holds Confirm with Go to form until it is saved', async () => {
  const week = carriedTheftWeek();
  factory.mockImplementation(() => week.gateway);
  render(
    <CampaignWorkspaceProvider
      campaignId="campaign"
      active
      openingPhase="persistent"
    >
      <WeeklyWorkspaceBoard campaignId="campaign" phase="persistent" />
    </CampaignWorkspaceProvider>,
  );
  await screen.findByRole('heading', { name: 'Week 4 · Persistent' });
  fireEvent.click(endedCard());
  fireEvent.change(outcome(), { target: { value: 'The thieves fled' } });

  fireEvent.click(stepper().getByRole('button', { name: 'Review & confirm' }));
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  const decisions = within(
    screen.getByRole('region', { name: 'Required decisions' }),
  );
  const message = decisions.getByText(
    'Theft · Event 1 ending needs a reason. Save how it ended, or choose another decision.',
  );
  expect(expectSameConfirm()).toBeDisabled();
  expect(
    screen.getAllByText('Save or cancel your unsaved change first.').length,
  ).toBeGreaterThan(0);
  const go = decisions
    .getAllByRole('button', { name: 'Go to form' })
    .find((button) => button.getAttribute('aria-describedby') === message.id);
  expect(go).toBeDefined();
  Element.prototype.scrollIntoView = vi.fn();
  fireEvent.click(go!);

  // Back in Persistent the ending is still chosen and its input is kept;
  // focus lands on the field that still needs input.
  await screen.findByRole('heading', { name: 'Week 4 · Persistent' });
  expect(endedCard()).toHaveAttribute('aria-pressed', 'true');
  expect(outcome()).toHaveValue('The thieves fled');
  await nextFrame();
  await waitFor(() => expect(reason()).toHaveFocus());
  expect(week.authority.inspect().openDrafts[0]!.persistent.decisions).toEqual(
    [],
  );

  fireEvent.change(reason(), { target: { value: 'The GM ruled it' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save how it ended' }));
  });
  await waitFor(() =>
    expect(
      week.authority.inspect().openDrafts[0]!.persistent.decisions,
    ).toMatchObject([{ kind: 'end', eventId: 'carried' }]),
  );
  fireEvent.click(stepper().getByRole('button', { name: 'Review & confirm' }));
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  expect(screen.queryByRole('button', { name: 'Go to form' })).toBeNull();
});

// A Theft section with no saved decision.
const theft: Facts['events'][number] = {
  eventId: 'theft',
  eventType: 'theft',
  startedWeek: 1,
  order: 0,
  targets: [],
  name: 'Theft · Event 1',
  typeLabel: 'Theft',
  ageWeeks: 3,
  orderLabel: '1st that week',
  targetNames: [],
  decision: null,
  ended: false,
  endedBy: null,
  result: { tone: 'stays', text: 'Stays' },
  leaveNote: 'Half of all incoming treasury gains are lost.',
  check: null,
  changes: [],
  checks: [],
  theftCheck: null,
  rivalryCheck: null,
  retained: [],
  exceptions: [],
  requirements: [],
  warnings: [],
};
const view: Facts = {
  phase: 'persistent',
  ready: true,
  firstBuyoff: true,
  buyoffAvailability: 'First buyoff available now',
  nextBuyoffWeek: 4,
  buyoffCostCopper: 4000,
  earlierPhases: [],
  options: {},
  events: [theft],
  requirements: [],
  warnings: [],
};
function memoryGuard() {
  const forms = new Map<string, LocalFormRegistration>();
  const values = new Map<string, unknown>();
  const guard: LocalFormGuard = {
    set: (id: string, form: LocalFormRegistration | null) => {
      if (form) forms.set(id, form);
      else {
        forms.delete(id);
        values.delete(id);
      }
    },
    keep: (id: string, kept: unknown) => values.set(id, kept),
    read: (id: string) => (forms.has(id) ? values.get(id) : undefined),
  };
  return { guard, forms };
}

test('[PER-06.guard-states] choosing the ending registers it at once, a saved ending edited here stays pending until saved, and Leave it withdraws it', async () => {
  const { guard, forms } = memoryGuard();
  const edit = vi.fn(() => Promise.resolve('accepted' as const));
  const show = (events: Facts['events']) => (
    <PersistentView
      view={{ ...view, events }}
      edit={edit}
      disabled={false}
      localFormGuard={guard}
    />
  );
  const { rerender } = render(show([theft]));
  expect(forms.size).toBe(0);
  fireEvent.click(endedCard());
  await waitFor(() =>
    expect(forms.get('ending:theft')).toEqual({
      message:
        'Theft · Event 1 ending needs how it ended and a reason. Save how it ended, or choose another decision.',
      phase: 'persistent',
      // Typed against no saved decision.
      basis: 'null',
    }),
  );
  // Leave it is the deliberate reset: nothing stays registered.
  fireEvent.click(screen.getByRole('button', { name: 'Leave it' }));
  await waitFor(() => expect(forms.size).toBe(0));

  const ended = {
    ...theft,
    decision: {
      kind: 'end' as const,
      eventId: 'theft',
      acknowledgement: {
        acknowledgementId: 'ack',
        subjectId: 'theft',
        outcome: 'The thieves fled',
      },
    },
  };
  rerender(show([ended]));
  expect(forms.size).toBe(0);
  fireEvent.change(outcome(), { target: { value: 'They returned it' } });
  await waitFor(() =>
    expect(forms.get('ending:theft')?.message).toBe(
      'Theft · Event 1 ending: save your change to how it ended.',
    ),
  );
  // Typing the saved text back leaves nothing pending.
  fireEvent.change(outcome(), { target: { value: 'The thieves fled' } });
  await waitFor(() => expect(forms.size).toBe(0));
});
