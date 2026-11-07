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
import { createDraftPersistence } from '~/lib/weekly-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WorkspaceGateway } from './gateway';
import { CampaignWorkspaceProvider } from './campaign-workspace-provider';
import { WeeklyWorkspaceBoard } from './board';
import {
  pinnedConfirm,
  expectSameConfirm,
} from './confirm-control-test-helpers';

// The real store, persistence client and memory authority behind the live
// Summary: this device's open adjustment form holds its own Confirm, the
// saved list is exact, and another device's accepted work survives.

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

// A first militia week whose event chance cannot produce an event: nothing
// is left to decide, so Confirm is available once the review is accepted.
function confirmableWeek() {
  const draft = createWeeklyDraft({
    draftId: 'workspace',
    week: 4,
    slotIds: ['left'],
    context: {
      firstMilitiaWeek: true,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  draft.event.chanceRoll = {
    sides: 100,
    diceTotal: 100,
    diceCount: 1,
    provenance: { kind: 'table' },
    modifiers: [],
  };
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
  return { gateway, authority, source };
}

// The review block's Confirm, checked against the frame's pinned one.
const confirmButton = () => expectSameConfirm();

test('[rules.P85.local-confirm-guard] an open or invalid adjustment form disables this device’s Confirm until Save, and a Save keeps another device’s adjustment', async () => {
  const week = confirmableWeek();
  factory.mockImplementation(() => week.gateway);
  render(
    <CampaignWorkspaceProvider
      campaignId="campaign"
      active
      openingPhase="summary"
    >
      <WeeklyWorkspaceBoard campaignId="campaign" phase="summary" />
    </CampaignWorkspaceProvider>,
  );
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  await waitFor(() => expect(confirmButton()).toBeEnabled());

  fireEvent.click(screen.getByRole('button', { name: 'Militia value' }));
  await waitFor(() => expect(confirmButton()).toBeDisabled());
  expect(
    screen.getAllByText('Save or cancel your unsaved change first.').length,
  ).toBeGreaterThan(0);
  const decisions = within(
    screen.getByRole('region', { name: 'Required decisions' }),
  );
  expect(
    decisions.getByText('New Militia value adjustment: save or cancel it.'),
  ).toBeVisible();

  // Another device adds an adjustment while this form is open.
  const other = createDraftPersistence(week.gateway.transport(week.source));
  await other.ready;
  const remote = {
    kind: 'militia_value' as const,
    adjustmentId: 'remote',
    field: 'training' as const,
    operation: 'add' as const,
    value: -2,
    reason: 'Drills skipped',
  };
  await act(async () => {
    expect(
      await other.edit({ kind: 'table_adjustments', adjustments: [remote] }),
    ).toBe('accepted');
  });
  await screen.findByRole('textbox', { name: 'Reason for adjustment 1' });

  const form = within(
    screen.getByRole('form', { name: 'New Militia value adjustment' }),
  );
  fireEvent.change(form.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '-0.07' },
  });
  fireEvent.change(form.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Seven copper for supplies' },
  });
  await act(async () => {
    fireEvent.click(form.getByRole('button', { name: 'Save adjustment' }));
  });
  await waitFor(() =>
    expect(week.authority.inspect().openDrafts[0]!.tableAdjustments).toEqual([
      remote,
      {
        kind: 'militia_value',
        adjustmentId: expect.any(String),
        field: 'treasuryCopper',
        operation: 'add',
        value: -7,
        reason: 'Seven copper for supplies',
      },
    ]),
  );
  await waitFor(() => expect(confirmButton()).toBeEnabled());
  expect(
    screen.queryByRole('region', { name: 'Required decisions' }),
  ).not.toBeInTheDocument();

  // Clearing a saved reason is local: Confirm waits, nothing is sent.
  const sent = week.authority.inspect().openDrafts[0]!.tableAdjustments;
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Reason for adjustment 2' }),
    { target: { value: '' } },
  );
  await waitFor(() => expect(confirmButton()).toBeDisabled());
  expect(
    await within(
      screen.getByRole('region', { name: 'Required decisions' }),
    ).findByText('Table Adjustment 2 “Treasury −0.07 gp” needs a reason.'),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Cancel changes to adjustment 2' }),
  );
  await waitFor(() => expect(confirmButton()).toBeEnabled());
  expect(week.authority.inspect().openDrafts[0]!.tableAdjustments).toEqual(
    sent,
  );
});

// The footer's pinned Confirm is the same control as the review block's:
// it waits for this device's save like the top one, and pressing both in a
// burst still sends exactly one Confirmation.
test('[SUM.pinned-confirm] the pinned Confirm waits for a pending save and a double press confirms once', async () => {
  const week = confirmableWeek();
  let holding: Promise<void> | null = null;
  const confirms = vi.fn();
  factory.mockImplementation(() => ({
    ...week.gateway,
    transport: (source: Parameters<WorkspaceGateway['transport']>[0]) => {
      const transport = week.gateway.transport(source);
      return {
        ...transport,
        async send(operation: Parameters<typeof transport.send>[0]) {
          if (holding) await holding;
          return transport.send(operation);
        },
        confirm(operation: Parameters<typeof transport.confirm>[0]) {
          confirms();
          return transport.confirm(operation);
        },
      };
    },
  }));
  render(
    <CampaignWorkspaceProvider
      campaignId="campaign"
      active
      openingPhase="summary"
    >
      <WeeklyWorkspaceBoard campaignId="campaign" phase="summary" />
    </CampaignWorkspaceProvider>,
  );
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  await waitFor(() => expect(confirmButton()).toBeEnabled());
  expect(pinnedConfirm()).not.toHaveAttribute('aria-describedby');

  let release!: () => void;
  holding = new Promise<void>((resolve) => {
    release = () => {
      holding = null;
      resolve();
    };
  });
  fireEvent.click(screen.getByRole('button', { name: 'Militia value' }));
  const form = within(
    screen.getByRole('form', { name: 'New Militia value adjustment' }),
  );
  fireEvent.change(form.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '-0.07' },
  });
  fireEvent.change(form.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Seven copper for supplies' },
  });
  await act(async () => {
    fireEvent.click(form.getByRole('button', { name: 'Save adjustment' }));
  });
  await waitFor(() => expect(confirmButton()).toBeDisabled());
  expect(pinnedConfirm()).toHaveAccessibleDescription(
    'Review will be ready when your changes are saved.',
  );
  await act(async () => release());
  await waitFor(() => expect(confirmButton()).toBeEnabled());

  await act(async () => {
    fireEvent.click(pinnedConfirm());
    fireEvent.click(pinnedConfirm());
    fireEvent.click(confirmButton());
  });
  await waitFor(() => expect(week.authority.inspect().records).toHaveLength(1));
  expect(confirms).toHaveBeenCalledTimes(1);
});
