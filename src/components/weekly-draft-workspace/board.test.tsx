import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WorkspaceGateway } from './gateway';
import type { Phase } from './types';
import { CampaignWorkspaceProvider } from './campaign-workspace-provider';
import { useWeeklyDraftWorkspace } from './use-weekly-draft-workspace';
import { WeeklyWorkspaceBoard } from './board';
import { MaintenanceBanner } from '~/components/campaign-shell/maintenance-banner';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  pinnedConfirm,
  expectSameConfirm,
} from './confirm-control-test-helpers';
import { createDraftPersistence } from '~/lib/weekly-draft-persistence';
import {
  DraftRejected,
  type DraftObservation,
} from '~/lib/weekly-draft-persistence-contract';
import {
  ShellSlotHost,
  ShellSlotProvider,
} from '~/components/campaign-shell/shell-slots';

const factory = vi.fn<(...args: unknown[]) => WorkspaceGateway | null>();
vi.mock('./gateway', () => ({
  createConvexWorkspaceGateway: (...args: unknown[]) => factory(...args),
}));
const maintenance = vi.fn<() => MigrationMaintenance>(() => ({
  kind: 'ready',
  readOnly: false,
  message: '',
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const convex = {};
vi.mock('convex/react', () => ({
  useConvex: () => convex,
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

// `confirmable` starts from a week with nothing left to decide (a first
// militia week whose event chance roll cannot produce an event).
function fixture(options: { confirmable?: boolean } = {}): WorkspaceGateway & {
  advance: () => () => void;
  source: ReturnType<typeof workspaceSourceSchema.parse>;
} {
  const draft = createWeeklyDraft({
    draftId: 'workspace',
    week: 4,
    slotIds: ['left'],
    context: {
      firstMilitiaWeek: options.confirmable ?? false,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  if (options.confirmable)
    draft.event.chanceRoll = {
      sides: 100,
      diceTotal: 100,
      diceCount: 1,
      provenance: { kind: 'table' },
      modifiers: [],
    };
  let source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
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
  let authority = createMemoryDraftAuthority(draft, source.snapshot);
  let successorDelivery: Promise<void> | undefined;
  const listeners = new Set<Parameters<WorkspaceGateway['subscribe']>[0]>();
  return {
    get source() {
      return source;
    },
    subscribe(next) {
      listeners.add(next);
      next(source);
      return () => listeners.delete(next);
    },
    transport() {
      const transport = authority.transport;
      const delivery = successorDelivery;
      if (!delivery) return transport;
      return {
        ...transport,
        async read() {
          await delivery;
          return transport.read();
        },
        subscribe(next, failed) {
          let active = true;
          const stop = transport.subscribe((observation) => {
            void delivery.then(() => {
              if (active) next(observation);
            });
          }, failed);
          return () => {
            active = false;
            stop();
          };
        },
      };
    },
    advance() {
      let release!: () => void;
      successorDelivery = new Promise<void>((resolve) => {
        release = resolve;
      });
      const successor = createWeeklyDraft({
        draftId: 'successor',
        week: 5,
        slotIds: ['left'],
        context: {
          firstMilitiaWeek: false,
          startDay: 28,
          uneventfulCarry: false,
          carriedEvents: [],
          queuedEffects: [],
          orders: [],
          lastBuyoffWeek: null,
        },
      });
      authority = createMemoryDraftAuthority(successor, source.snapshot);
      source = {
        ...source,
        key: { ...source.key, draftId: successor.draftId },
      };
      for (const next of listeners) next(source);
      return release;
    },
  };
}

// The shell reads the same snapshot the board renders; there is no copy.
function WeekProbe() {
  const workspace = useWeeklyDraftWorkspace();
  return (
    <p>
      Shell week: {workspace.status === 'ready' ? workspace.week : 'unknown'}
    </p>
  );
}
// Same composition as the campaign shell: one owner above shell chrome and
// the Week route's board.
function host(props: {
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
}) {
  return (
    <CampaignWorkspaceProvider
      campaignId="campaign"
      active
      openingPhase={props.phase}
    >
      <WeekProbe />
      <WeeklyWorkspaceBoard {...props} campaignId="campaign" />
    </CampaignWorkspaceProvider>
  );
}

test('[shell.phase] address phase changes move this player without rebuilding the Workspace', async () => {
  const gateway = fixture();
  factory.mockImplementation((_client, _campaign, initialPhase) => ({
    ...gateway,
    initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
  }));
  const onPhaseChange = vi.fn();
  const view = render(host({ phase: 'event', onPhaseChange }));
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  expect(factory).toHaveBeenCalledTimes(1);
  expect(factory.mock.calls[0]?.[2]).toBe('event');
  expect(screen.getByText('Shell week: 4')).toBeInTheDocument();
  view.rerender(host({ phase: 'activity', onPhaseChange }));
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Activity' }),
  ).toBeVisible();
  expect(factory).toHaveBeenCalledTimes(1);
  expect(onPhaseChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Review & confirm' }));
  expect(onPhaseChange).toHaveBeenLastCalledWith('summary');
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Review & confirm' }),
  ).toBeVisible();
  view.rerender(host({ phase: 'persistent', onPhaseChange }));
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Review & confirm' }),
  ).toBeVisible();
  expect(factory).toHaveBeenCalledTimes(1);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'History' }));
  expect(
    screen.getByRole('link', { name: 'All finished weeks' }),
  ).toHaveAttribute('href', '/campaigns/campaign/history');
  view.unmount();
  expect(factory).toHaveBeenCalledTimes(1);
});

test('[shell.failed] a failed week offers a page-local retry that rebuilds the Workspace', async () => {
  const gateway = fixture();
  factory
    .mockImplementationOnce(() => ({
      ...gateway,
      subscribe(_next, failed) {
        failed();
        return () => undefined;
      },
    }))
    .mockImplementation(() => gateway);
  render(host({ phase: 'upkeep' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The week could not be loaded.',
  );
  expect(screen.queryByText('Reload the week')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(factory).toHaveBeenCalledTimes(2);
});

test('[shell.no-militia] a campaign without a militia keeps setup reachable within the campaign', () => {
  factory.mockImplementation(() => ({
    subscribe(next) {
      next(null);
      return () => undefined;
    },
    transport: () => {
      throw new Error('unused');
    },
  }));
  render(host({ phase: 'upkeep' }));
  expect(screen.getByRole('status')).toHaveTextContent('No militia yet.');
  expect(screen.getByRole('link', { name: 'Set up militia' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/setup',
  );
  expect(screen.getByText('Shell week: unknown')).toBeInTheDocument();
});

// A successor never shows the loading skeleton (#153): the old week stays
// on screen read-only with its reference facts until the next open week is
// usable, then this player lands on Upkeep with one notice for the old week.
function notice() {
  return document.querySelector<HTMLElement>('[data-week-confirmed]')!;
}
// The store's save state, read from the board's invisible hook: the
// top-bar save status was removed (2026-09-28), so nothing shows it.
function feedback() {
  return document
    .querySelector<HTMLElement>('[data-week-feedback]')
    ?.getAttribute('data-week-feedback');
}
function failure() {
  return document.querySelector<HTMLElement>('[data-week-save-failure]');
}
function remoteNote() {
  return document.querySelector<HTMLElement>('[data-week-remote-note]')!;
}

test.each(['event', 'summary'] as const)(
  '[shell.successor] a player viewing %s keeps the old week read-only, then opens the successor on Upkeep with one notice',
  async (opening) => {
    const gateway = fixture();
    factory.mockImplementation((_client, _campaign, initialPhase) => ({
      ...gateway,
      initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
    }));
    const onPhaseChange = vi.fn();
    render(host({ phase: opening, onPhaseChange }));
    const heading = `Week 4 · ${opening === 'event' ? 'Event' : 'Review & confirm'}`;
    await screen.findByRole('heading', { name: heading });
    const writeControl = () =>
      opening === 'event'
        ? screen.getByRole('textbox', { name: 'Event chance roll' })
        : expectSameConfirm();
    expect(notice()).toBeEmptyDOMElement();
    const region = notice();
    let release!: () => void;
    act(() => {
      release = gateway.advance();
    });
    // Retained: same heading, facts and navigation; no skeleton; no writes.
    expect(screen.queryByText('Loading the week…')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: heading })).toBeVisible();
    expect(writeControl()).toBeDisabled();
    expect(screen.getByText('Shell week: 4')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Militia values' })).toBeVisible();
    expect(feedback()).toBe('idle');
    expect(notice()).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Upkeep' }));
    expect(
      screen.getByRole('heading', { name: 'Week 4 · Upkeep' }),
    ).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Attrition Loyalty roll' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(
      screen.getByRole('heading', { name: 'Week 4 · Activity' }),
    ).toBeVisible();
    expect(onPhaseChange).toHaveBeenLastCalledWith('activity');
    expect(screen.queryByText('Loading the week…')).not.toBeInTheDocument();
    await act(async () => release());
    await screen.findByRole('heading', { name: 'Week 5 · Upkeep' });
    expect(onPhaseChange).toHaveBeenLastCalledWith('upkeep');
    expect(screen.getByText('Shell week: 5')).toBeInTheDocument();
    expect(screen.queryByText('Loading the week…')).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Attrition Loyalty roll' }),
    ).toBeEnabled();
    expect(document.querySelectorAll('[data-week-confirmed]')).toHaveLength(1);
    // The notice lands in the region mounted before the transition.
    expect(notice()).toBe(region);
    expect(notice()).toHaveTextContent('Week 4 confirmed.');
    expect(
      within(notice()).getByRole('link', { name: 'Open in Finished weeks' }),
    ).toHaveAttribute('href', '/campaigns/campaign/history?week=4');
    expect(factory).toHaveBeenCalledTimes(1);
    fireEvent.click(within(notice()).getByRole('button', { name: 'Dismiss' }));
    expect(notice()).toBeEmptyDOMElement();
    expect(
      screen.getByRole('heading', { name: 'Week 5 · Upkeep' }),
    ).toBeVisible();
  },
);

test('[shell.successor-control] the gateway opening phase does not override successor Upkeep without an address phase', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => ({ ...gateway, initialPhase: 'event' }));
  render(host({}));
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  let release!: () => void;
  act(() => {
    release = gateway.advance();
  });
  expect(screen.queryByText('Loading the week…')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Week 4 · Event' })).toBeVisible();
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 5 · Upkeep' });
  expect(notice()).toHaveTextContent('Week 4 confirmed.');
  expect(factory).toHaveBeenCalledTimes(1);
});

test('[shell.successor-address] a stale address phase is not re-applied to the successor week', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => gateway);
  // A host that never writes the phase back into its address (its prop stays
  // `summary`) must still land on Upkeep: the store's reset wins.
  const view = render(host({ phase: 'summary' }));
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  let release!: () => void;
  act(() => {
    release = gateway.advance();
  });
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 5 · Upkeep' });
  view.rerender(host({ phase: 'summary' }));
  expect(
    screen.getByRole('heading', { name: 'Week 5 · Upkeep' }),
  ).toBeVisible();
});

// The shell normalizes an absent phase query to Upkeep before the board
// sees it. A continuously observing device that was already on Upkeep must
// still get its `phase=upkeep` written once per observed successor, and
// never again for saves, rerenders, dismissal or a fresh load.
test('[shell.successor-implicit] an observer already on Upkeep publishes phase=upkeep exactly once per successor', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => gateway);
  const onPhaseChange = vi.fn();
  const view = render(host({ phase: 'upkeep', onPhaseChange }));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(onPhaseChange).not.toHaveBeenCalled();
  let release!: () => void;
  act(() => {
    release = gateway.advance();
  });
  expect(onPhaseChange).not.toHaveBeenCalled();
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 5 · Upkeep' });
  expect(onPhaseChange).toHaveBeenCalledTimes(1);
  expect(onPhaseChange).toHaveBeenLastCalledWith('upkeep');
  // The host writes the same address back; an ordinary save, a rerender and
  // dismissing the notice publish nothing more.
  view.rerender(host({ phase: 'upkeep', onPhaseChange }));
  const die = screen.getByRole('textbox', { name: 'Attrition Loyalty roll' });
  await act(async () => {
    fireEvent.change(die, { target: { value: '7' } });
    fireEvent.blur(die);
  });
  await waitFor(() => expect(feedback()).toBe('saved'));
  fireEvent.click(within(notice()).getByRole('button', { name: 'Dismiss' }));
  expect(notice()).toBeEmptyDOMElement();
  view.rerender(host({ phase: 'upkeep', onPhaseChange }));
  expect(onPhaseChange).toHaveBeenCalledTimes(1);
  // A fresh owner (reload) on the new week publishes nothing.
  view.unmount();
  const fresh = vi.fn();
  render(host({ phase: 'upkeep', onPhaseChange: fresh }));
  await screen.findByRole('heading', { name: 'Week 5 · Upkeep' });
  expect(fresh).not.toHaveBeenCalled();
});

// The campaign shell mounts the owner without an opening phase (it cannot
// read the page's address during render), so the board must apply the
// requested phase itself once the store is ready.
function delayed(gateway: WorkspaceGateway) {
  let release!: () => void;
  const delivery = new Promise<void>((resolve) => {
    release = resolve;
  });
  const wrapped: WorkspaceGateway = {
    ...gateway,
    transport(source) {
      const transport = gateway.transport(source);
      return {
        ...transport,
        async read() {
          await delivery;
          return transport.read();
        },
        subscribe(next, failed) {
          let active = true;
          const stop = transport.subscribe((observation) => {
            void delivery.then(() => {
              if (active) next(observation);
            });
          }, failed);
          return () => {
            active = false;
            stop();
          };
        },
      };
    },
  };
  return { gateway: wrapped, release };
}
function shellHost(props: {
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
}) {
  return (
    <CampaignWorkspaceProvider campaignId="campaign" active>
      <WeekProbe />
      <WeeklyWorkspaceBoard {...props} />
    </CampaignWorkspaceProvider>
  );
}

test('[shell.opening] a non-Upkeep address phase opens once the delayed initial observation arrives', async () => {
  const { gateway, release } = delayed(fixture());
  factory.mockImplementation((_client, _campaign, initialPhase) => ({
    ...gateway,
    initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
  }));
  const onPhaseChange = vi.fn();
  render(shellHost({ phase: 'event', onPhaseChange }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading the week…');
  // The address phase shapes the placeholders while the week loads.
  expect(document.querySelector('[data-week-skeleton]')).toHaveAttribute(
    'data-week-skeleton',
    'event',
  );
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  expect(onPhaseChange).not.toHaveBeenCalled();
  expect(factory).toHaveBeenCalledTimes(1);
});

test('[shell.opening-change] an address phase change while loading wins over the opening phase', async () => {
  const { gateway, release } = delayed(fixture());
  factory.mockImplementation((_client, _campaign, initialPhase) => ({
    ...gateway,
    initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
  }));
  const onPhaseChange = vi.fn();
  const view = render(shellHost({ phase: 'event', onPhaseChange }));
  view.rerender(shellHost({ phase: 'summary', onPhaseChange }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading the week…');
  expect(document.querySelector('[data-week-skeleton]')).toHaveAttribute(
    'data-week-skeleton',
    'summary',
  );
  view.rerender(shellHost({ phase: 'persistent', onPhaseChange }));
  expect(document.querySelector('[data-week-skeleton]')).toHaveAttribute(
    'data-week-skeleton',
    'persistent',
  );
  view.rerender(shellHost({ phase: 'summary', onPhaseChange }));
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  expect(onPhaseChange).not.toHaveBeenCalled();
  expect(factory).toHaveBeenCalledTimes(1);
});

// An edit made from another phase's editor reaches every step at once: the
// frame reads the same optimistic snapshot the editors do.
function EditProbe() {
  const workspace = useWeeklyDraftWorkspace();
  if (workspace.status !== 'ready') return null;
  const upkeep = workspace.phases.find((step) => step.phase === 'upkeep')!;
  return (
    <>
      <p data-testid="upkeep-ids">
        {upkeep.requirements.map((item) => item.id).join(',')}
      </p>
      <p data-testid="upkeep-caption">
        {upkeep.ready ? 'Ready' : `${upkeep.requirements.length} to decide`}
      </p>
      <button
        type="button"
        onClick={() =>
          void workspace.edit({
            kind: 'upkeep_roll',
            field: 'check',
            roll: {
              diceTotal: 10,
              diceCount: 1,
              sides: 20,
              provenance: { kind: 'table' },
              modifiers: [],
            },
          })
        }
      >
        Probe roll
      </button>
    </>
  );
}

test('[frame.readiness] every position shows readiness from one optimistic snapshot, keeps a locked Persistent visible and skips it', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => gateway);
  render(
    <CampaignWorkspaceProvider campaignId="campaign" active>
      <EditProbe />
      <WeeklyWorkspaceBoard phase="event" />
    </CampaignWorkspaceProvider>,
  );
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  const stepper = within(
    screen.getByRole('navigation', { name: 'Week phases' }),
  );
  const upkeep = stepper.getByRole('button', { name: 'Upkeep' });
  const ids = () => screen.getByTestId('upkeep-ids').textContent;
  const before = ids();
  expect(before).not.toBe('');
  expect(upkeep).toHaveAccessibleDescription(
    screen.getByTestId('upkeep-caption').textContent,
  );
  expect(upkeep).toHaveAccessibleDescription(/to decide$/);
  const persistent = stepper.getByRole('button', { name: 'Persistent' });
  expect(persistent).toBeDisabled();
  expect(persistent).toHaveAccessibleDescription('No carried events');
  expect(stepper.getByRole('button', { name: 'Event' })).toHaveAttribute(
    'aria-current',
    'step',
  );
  expect(
    screen.getByRole('button', { name: 'Next: Review & confirm' }),
  ).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Previous: Activity' }),
  ).toBeEnabled();
  expect(
    stepper.getByRole('button', { name: 'Review & confirm' }),
  ).not.toHaveAttribute('aria-describedby');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Probe roll' }));
  });
  await waitFor(() => expect(ids()).not.toBe(before));
  expect(upkeep).toHaveAccessibleDescription(
    screen.getByTestId('upkeep-caption').textContent,
  );
  // Still on Event: readiness refreshed without moving this player.
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Event' }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Next: Review & confirm' }),
  );
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  expect(screen.queryByRole('button', { name: /^Next\b/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Previous: Event' })).toBeEnabled();
  const lines = document.querySelectorAll('[data-week-readiness]');
  for (const line of lines)
    expect(line).toHaveTextContent(/^(\d+ decisions? left|Review .*)$/);
  expect(expectSameConfirm()).toBeDisabled();
});

// The top-bar save status was removed at the user's request (2026-09-28,
// amending #137): nothing shows idle, saving, saved or confirming, in the
// shell or standalone. The other-player note stays in the frame's own row.
test('[feedback.placement] no save status is shown; the other-player note sits in the frame row, never the top bar', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => gateway);
  const view = render(
    <ShellSlotProvider>
      <header>
        <ShellSlotHost name="phone-status-strip" />
      </header>
      {host({ phase: 'upkeep' })}
    </ShellSlotProvider>,
  );
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  for (const text of [
    'Prepare the week together.',
    'Saving changes…',
    'Changes saved.',
    'Confirming the week…',
  ])
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  expect(document.querySelector('[data-week-status]')).toBeNull();
  expect(
    screen.queryByRole('button', { name: /Show status details$/ }),
  ).not.toBeInTheDocument();
  expect(remoteNote().closest('[data-shell-slot]')).toBeNull();
  expect(remoteNote().closest('[data-week-editor]')).toBeNull();
  expect(failure()).toBeEmptyDOMElement();
  view.unmount();
  render(host({ phase: 'upkeep' }));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(screen.queryByText('Prepare the week together.')).toBeNull();
  expect(document.querySelectorAll('[data-week-remote-note]')).toHaveLength(1);
});

// The three live regions exist, empty, from the frame's first render, and
// none is hidden with display:none (an element class of `hidden` or
// `empty:hidden`), so their first content is announced (#198).
test('[feedback.regions] the failure alert, remote note and confirmed-week notice are mounted empty from the first render', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => gateway);
  render(host({ phase: 'upkeep' }));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  const regions = [failure(), remoteNote(), notice()];
  expect(regions.map((region) => region?.getAttribute('role'))).toEqual([
    'alert',
    'status',
    'status',
  ]);
  for (const region of regions) {
    expect(region).toBeEmptyDOMElement();
    expect(region!.className).not.toMatch(/(^|\s)(empty:)?hidden(\s|$)/);
    let node: HTMLElement | null = region;
    while (node) {
      expect(node).not.toHaveAttribute('aria-hidden', 'true');
      expect(node.className).not.toMatch(/(^|\s|:)hidden(\s|$)/);
      node = node.parentElement;
    }
  }
});

// Holds this device's draft observations so several remote writes arrive as
// one observation, the way a slow connection coalesces them.
function coalescing(gateway: WorkspaceGateway) {
  let held: { latest: DraftObservation | null } | null = null;
  const deliveries = new Set<(observation: DraftObservation) => void>();
  const wrapped: WorkspaceGateway = {
    ...gateway,
    transport(source) {
      const transport = gateway.transport(source);
      return {
        ...transport,
        subscribe(next, failed) {
          deliveries.add(next);
          return transport.subscribe((observation) => {
            if (held) held.latest = observation;
            else next(observation);
          }, failed);
        },
      };
    },
  };
  return {
    gateway: wrapped,
    hold() {
      held = { latest: null };
    },
    release() {
      const latest = held?.latest;
      held = null;
      if (latest) for (const next of deliveries) next(latest);
    },
  };
}

// Another player's accepted edits are named by the phases they touched and
// never move this player's phase or focus; this player's own saves never
// produce the note.
test('[feedback.remote] a remote change names its phases without moving phase or focus; own saves are excluded', async () => {
  const gateway = fixture();
  const wire = coalescing(gateway);
  factory.mockImplementation(() => wire.gateway);
  render(host({ phase: 'upkeep' }));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  const die = screen.getByRole('textbox', { name: 'Attrition Loyalty roll' });
  await act(async () => {
    fireEvent.change(die, { target: { value: '7' } });
    fireEvent.blur(die);
  });
  await waitFor(() => expect(feedback()).toBe('saved'));
  expect(remoteNote()).toBeEmptyDOMElement();
  const note = remoteNote();
  const training = screen.getByRole('textbox', {
    name: 'Attrition training roll',
  });
  training.focus();
  expect(training).toHaveFocus();
  // A second device shares the same authority through its own client.
  const other = createDraftPersistence(gateway.transport(gateway.source));
  await other.ready;
  wire.hold();
  await act(async () => {
    expect(
      await other.edit({
        kind: 'upkeep_roll',
        field: 'check',
        roll: {
          diceTotal: 12,
          diceCount: 1,
          sides: 20,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      }),
    ).toBe('accepted');
    expect(
      await other.edit({
        kind: 'event_chance',
        roll: {
          diceTotal: 42,
          diceCount: 1,
          sides: 100,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      }),
    ).toBe('accepted');
  });
  expect(remoteNote()).toBeEmptyDOMElement();
  act(() => wire.release());
  await waitFor(() =>
    expect(note).toHaveTextContent('Another player changed Upkeep and Event.'),
  );
  expect(die).toHaveValue('12');
  expect(training).toHaveFocus();
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Upkeep' }),
  ).toBeVisible();
  other.dispose();
});

test('[feedback.failed] a rejected save is a red alert carrying only the safe server reason', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => ({
    ...gateway,
    transport: (source) => ({
      ...gateway.transport(source),
      send: () =>
        Promise.reject(
          new DraftRejected('Operation rejected', { maintenance: true }),
        ),
    }),
  }));
  render(host({ phase: 'upkeep' }));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  const alert = failure();
  expect(alert).toBeEmptyDOMElement();
  const die = screen.getByRole('textbox', { name: 'Attrition Loyalty roll' });
  await act(async () => {
    fireEvent.change(die, { target: { value: '7' } });
    fireEvent.blur(die);
  });
  await waitFor(() => expect(failure()).not.toBeEmptyDOMElement());
  // The text lands in the alert that was already mounted.
  expect(failure()).toBe(alert);
  expect(failure()!.textContent).toBe(
    'Changes could not be saved. The latest saved values are shown. Editing is paused for maintenance. Saved information remains available.',
  );
  // Failure is a visible red alert (field validation alerts are separate),
  // at every size: no phone-only details button stands in for it.
  expect(failure()).toHaveAttribute('role', 'alert');
  expect(screen.getAllByRole('alert')).toContain(failure());
  expect(document.querySelectorAll('[data-week-save-failure]')).toHaveLength(1);
  expect(failure()).toHaveClass('text-destructive');
  expect(failure()).toBeVisible();
  expect(failure()!.closest('[data-week-editor]')).toBeNull();
  expect(feedback()).toBe('failed');
  expect(die).toHaveValue('');
  expect(remoteNote()).toBeEmptyDOMElement();
});

// The initiating device: the Confirm control reads "Confirming…" and every
// weekly write stays disabled from the click until the successor is usable,
// including after the server has already answered.
test('[feedback.confirming] the initiator stays on Confirming… with the old week until the successor is usable', async () => {
  const gateway = fixture({ confirmable: true });
  factory.mockImplementation(() => gateway);
  render(host({ phase: 'summary' }));
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  await waitFor(() => expect(expectSameConfirm()).toBeEnabled());
  // The footer's pinned Confirm starts it; both then read Confirming….
  await act(async () => {
    fireEvent.click(pinnedConfirm());
  });
  await waitFor(() => expect(feedback()).toBe('confirming'));
  const confirming = expectSameConfirm();
  expect(confirming).toHaveAccessibleName('Confirming…');
  expect(confirming).toBeDisabled();
  expect(pinnedConfirm()).toHaveAccessibleName('Confirming…');
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Review & confirm' }),
  ).toBeVisible();
  expect(screen.queryByText('Loading the week…')).not.toBeInTheDocument();
  // The authority has answered (the draft is closed) yet nothing changes
  // until the next open week arrives.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(expectSameConfirm()).toHaveAccessibleName('Confirming…');
  expect(expectSameConfirm()).toBeDisabled();
  expect(feedback()).toBe('confirming');
  fireEvent.click(screen.getByRole('button', { name: 'Event' }));
  expect(
    screen.getByRole('textbox', { name: 'Event chance roll' }),
  ).toBeDisabled();
  expect(notice()).toBeEmptyDOMElement();
  let release!: () => void;
  act(() => {
    release = gateway.advance();
  });
  expect(screen.queryByText('Loading the week…')).not.toBeInTheDocument();
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 5 · Upkeep' });
  expect(feedback()).not.toBe('confirming');
  expect(
    screen.getByRole('textbox', { name: 'Attrition Loyalty roll' }),
  ).toBeEnabled();
  expect(notice()).toHaveTextContent('Week 4 confirmed.');
  expect(
    within(notice()).getByRole('link', { name: 'Open in Finished weeks' }),
  ).toHaveAttribute('href', '/campaigns/campaign/history?week=4');
});

// ---- App-wide editing availability (#258). The shell's banner says why;
// the board only disables its write controls and keeps the week readable.

function withMaintenance(kind: MigrationMaintenance['kind'], message: string) {
  maintenance.mockReturnValue({ kind, readOnly: kind !== 'ready', message });
}
afterEach(() => {
  withMaintenance('ready', '');
  vi.unstubAllGlobals();
});
/** The board beside the shell's banner, with every send to the authority counted. */
function hostWithBanner(
  gateway: WorkspaceGateway,
  sends: (...args: unknown[]) => void,
) {
  factory.mockImplementation(() => ({
    ...gateway,
    transport: (...args) => {
      const transport = gateway.transport(...args);
      return {
        ...transport,
        send: (...sendArgs) => {
          sends(...sendArgs);
          return transport.send(...sendArgs);
        },
      };
    },
  }));
  return (
    <CampaignWorkspaceProvider
      campaignId="campaign"
      active
      openingPhase="upkeep"
    >
      <MaintenanceBanner />
      <WeeklyWorkspaceBoard campaignId="campaign" phase="upkeep" />
    </CampaignWorkspaceProvider>
  );
}

test('[maintenance.loading] while availability is checked the week is readable, its fields are off and phase navigation works', async () => {
  withMaintenance('loading', 'Checking whether editing is available.');
  const sends = vi.fn();
  render(hostWithBanner(fixture(), sends));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(
    screen.getByText('Checking whether editing is available.'),
  ).toBeVisible();
  expect(
    screen.getByRole('textbox', { name: 'Attrition Loyalty roll' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Event' }));
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  expect(
    screen.getByRole('textbox', { name: 'Event chance roll' }),
  ).toBeDisabled();
  expect(sends).not.toHaveBeenCalled();
});

test('[maintenance.ready] with editing available there is no notice and a roll saves', async () => {
  const sends = vi.fn();
  render(hostWithBanner(fixture(), sends));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(screen.queryByText(/editing/i)).not.toBeInTheDocument();
  const die = screen.getByRole('textbox', { name: 'Attrition Loyalty roll' });
  expect(die).toBeEnabled();
  await act(async () => {
    fireEvent.change(die, { target: { value: '7' } });
    fireEvent.blur(die);
  });
  await waitFor(() => expect(feedback()).toBe('saved'));
  expect(sends).toHaveBeenCalled();
});

test('[maintenance.paused] maintenance shows its message, keeps saved values visible and disables saving and Confirm with that reason', async () => {
  withMaintenance('maintenance', 'Editing is paused for maintenance.');
  const gateway = fixture({ confirmable: true });
  factory.mockImplementation(() => gateway);
  render(host({ phase: 'summary' }));
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  expect(expectSameConfirm()).toBeDisabled();
  expect(
    screen.getAllByText('Editing is paused for maintenance.').length,
  ).toBeGreaterThan(0);
  expect(
    screen.queryByRole('button', { name: /retry|reload/i }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Event' }));
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  expect(
    screen.getByRole('textbox', { name: 'Event chance roll' }),
  ).toBeDisabled();
});

test('[maintenance.reload] a page that must reload stays disabled with a Reload page button; pressing it reloads once and sends nothing', async () => {
  const sends = vi.fn();
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  const view = render(hostWithBanner(fixture(), sends));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(
    screen.getByRole('textbox', { name: 'Attrition Loyalty roll' }),
  ).toBeEnabled();
  withMaintenance(
    'reload_required',
    'Reload this page before saving. Unsaved changes will be discarded.',
  );
  view.rerender(hostWithBanner(fixture(), sends));
  expect(
    screen.getByRole('textbox', { name: 'Attrition Loyalty roll' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Upkeep' }),
  ).toBeVisible();
  expect(
    screen.getByText(
      'Reload this page before saving. Unsaved changes will be discarded.',
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
  expect(reload).toHaveBeenCalledTimes(1);
  expect(sends).not.toHaveBeenCalled();
});

test('[maintenance.unavailable] an unchecked availability keeps the saved week readable and offers Reload page', async () => {
  withMaintenance(
    'unavailable',
    'Editing availability could not be checked. Reload to try again.',
  );
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  render(hostWithBanner(fixture(), vi.fn()));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(
    screen.getByRole('textbox', { name: 'Attrition Loyalty roll' }),
  ).toBeDisabled();
  expect(
    screen.getByText(
      'Editing availability could not be checked. Reload to try again.',
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
  expect(reload).toHaveBeenCalledTimes(1);
});
