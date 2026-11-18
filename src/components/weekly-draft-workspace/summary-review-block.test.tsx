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
import {
  pinnedConfirm,
  expectSameConfirm,
} from './confirm-control-test-helpers';

// The live review block over the real store, persistence client and memory
// authority: Go links move only this player's Phase View to the source, and
// Confirmation commits exactly the reviewed accepted week, never after a
// silent refresh.

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

// `confirmable`: a first militia week whose event chance cannot produce an
// event, so nothing is left to decide. Otherwise Upkeep still needs rolls.
function week(confirmable: boolean) {
  const draft = createWeeklyDraft({
    draftId: 'workspace',
    week: 4,
    slotIds: ['left'],
    context: {
      firstMilitiaWeek: confirmable,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  if (confirmable)
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
  let deliver!: (next: typeof source) => void;
  const gateway: WorkspaceGateway = {
    subscribe(next) {
      deliver = next;
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  };
  return {
    gateway,
    authority,
    source,
    deliver: (next: typeof source) => deliver(next),
  };
}

function renderReview() {
  return render(
    <CampaignWorkspaceProvider
      campaignId="campaign"
      active
      openingPhase="summary"
    >
      <WeeklyWorkspaceBoard campaignId="campaign" phase="summary" />
    </CampaignWorkspaceProvider>,
  );
}
// The review block's Confirm, checked against the frame's pinned one.
const confirmButton = () => expectSameConfirm();
const nextFrame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

test('[SUM-02.go-board] a Required decision’s Go link shows its Upkeep step on this device and focuses it', async () => {
  const fixture = week(false);
  factory.mockImplementation(() => fixture.gateway);
  renderReview();
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  const decisions = await screen.findByRole('region', {
    name: 'Required decisions',
  });
  const message = within(decisions).getByText(
    'Upkeep: Enter the attrition Loyalty roll.',
  );
  expect(confirmButton()).toBeDisabled();
  const go = within(decisions)
    .getAllByRole('button', { name: 'Go to Upkeep' })
    .find((button) => button.getAttribute('aria-describedby') === message.id);
  expect(go).toBeDefined();
  Element.prototype.scrollIntoView = vi.fn();
  fireEvent.click(go!);
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  await nextFrame();
  expect(document.activeElement).toBe(
    screen.getByRole('region', { name: 'Training attrition' }),
  );
});

test('[SUM-05.board] a rejected Confirmation waits for an explicit review of the refreshed week, then commits exactly that', async () => {
  const fixture = week(true);
  factory.mockImplementation(() => fixture.gateway);
  renderReview();
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  await waitFor(() => expect(confirmButton()).toBeEnabled());
  // The treasury is corrected elsewhere after this player began reviewing.
  fixture.authority.changeSource('treasury');
  await act(async () => {
    fireEvent.click(confirmButton());
  });
  const block = screen.getByRole('region', { name: 'Review the week' });
  expect(await within(block).findByRole('alert')).toHaveTextContent(
    'The week could not be confirmed as reviewed.',
  );
  expect(fixture.authority.inspect().records).toHaveLength(0);
  // The corrected source arrives with a fresh accepted preview; it cannot
  // authorize Confirmation by itself.
  act(() =>
    fixture.deliver({
      ...fixture.source,
      sourceRevision: 1,
      snapshot: { ...fixture.source.snapshot, treasuryCopper: 5007 },
    }),
  );
  const review = within(block).getByRole('button', {
    name: 'Review updated week',
  });
  await waitFor(() => expect(review).toBeEnabled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(confirmButton()).toBeDisabled();
  expect(confirmButton()).toHaveAccessibleDescription(
    'Review the updated week before confirming.',
  );
  expect(fixture.authority.inspect().records).toHaveLength(0);
  fireEvent.click(review);
  await waitFor(() => expect(confirmButton()).toBeEnabled());
  expect(within(block).queryByRole('alert')).not.toBeInTheDocument();
  // Focus moves on to Confirm rather than being lost with the alert.
  await nextFrame();
  expect(confirmButton()).toHaveFocus();
  expect(fixture.authority.inspect().records).toHaveLength(0);
  // The footer's pinned Confirm commits the same reviewed week.
  await act(async () => {
    fireEvent.click(pinnedConfirm());
  });
  await waitFor(() =>
    expect(fixture.authority.inspect().records).toHaveLength(1),
  );
  const inspected = fixture.authority.inspect();
  expect(inspected.records[0]!.source.week).toBe(4);
  expect(inspected.openDrafts).toHaveLength(1);
  expect(inspected.openDrafts[0]!.week).toBe(5);
});

test('[SUM-05.persist] the stale-review alert and its Confirm block survive leaving Review & confirm until Review updated week is pressed', async () => {
  const fixture = week(true);
  factory.mockImplementation(() => fixture.gateway);
  renderReview();
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  await waitFor(() => expect(confirmButton()).toBeEnabled());
  fixture.authority.changeSource('treasury');
  await act(async () => {
    fireEvent.click(confirmButton());
  });
  const alert = await within(
    screen.getByRole('region', { name: 'Review the week' }),
  ).findByRole('alert');
  expect(alert).toHaveTextContent(
    'The week could not be confirmed as reviewed.',
  );
  act(() =>
    fixture.deliver({
      ...fixture.source,
      sourceRevision: 1,
      snapshot: { ...fixture.source.snapshot, treasuryCopper: 5007 },
    }),
  );
  // Leaving Review & confirm and coming back is not a review.
  const stepper = () =>
    within(screen.getByRole('navigation', { name: 'Week phases' }));
  fireEvent.click(stepper().getByRole('button', { name: 'Upkeep' }));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  fireEvent.click(stepper().getByRole('button', { name: 'Review & confirm' }));
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  const block = screen.getByRole('region', { name: 'Review the week' });
  const review = within(block).getByRole('button', {
    name: 'Review updated week',
  });
  await waitFor(() => expect(review).toBeEnabled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(within(block).getByRole('alert')).toHaveTextContent(
    'The week could not be confirmed as reviewed.',
  );
  expect(confirmButton()).toBeDisabled();
  expect(confirmButton()).toHaveAccessibleDescription(
    'Review the updated week before confirming.',
  );
  fireEvent.click(review);
  await waitFor(() => expect(confirmButton()).toBeEnabled());
  expect(within(block).queryByRole('alert')).not.toBeInTheDocument();
  expect(fixture.authority.inspect().records).toHaveLength(0);
});
