import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CampaignShell } from './campaign-shell';
import { PhoneStatusStrip } from './shell-slots';
import { useCampaign } from './campaign-context';
import { useWeeklyDraftWorkspace } from '~/components/weekly-draft-workspace/use-weekly-draft-workspace';
import {
  upkeepRoll,
  workspaceFixture,
} from '~/components/weekly-draft-workspace/workspace-test-fixture';

const auth = vi.fn();
const organization = vi.fn();
const convexAuth = vi.fn();
const maintenance = vi.fn<() => MigrationMaintenance>();
const campaigns = vi.fn();
const pathname = vi.fn();
const push = vi.fn();
const setActive = vi.fn();
const gateway = vi.fn();
const openCreateOrganization = vi.fn();
const openOrganizationProfile = vi.fn();
const openUserProfile = vi.fn();
const signOut = vi.fn();
let avatarPending = false;
let clerkStatus: 'loading' | 'ready' | 'degraded' | 'error' = 'ready';

vi.mock('./use-campaign-shell-navigation', async () => {
  const { buildAppNavigation } = await import('~/lib/app-navigation');
  return {
    useCampaignShellNavigation: ({
      campaign,
      campaigns,
      organizationId,
      week,
    }: {
      campaign?: { _id: string; name: string };
      campaigns: { _id: string; name: string }[];
      organizationId?: string;
      week?: number;
    }) =>
      buildAppNavigation({
        pathname: pathname(),
        organizationId,
        week,
        campaign: campaign
          ? { id: campaign._id, name: campaign.name, hasMilitia: true }
          : undefined,
        campaigns: campaigns.map((item) => ({
          id: item._id,
          name: item.name,
          hasMilitia: true,
        })),
      }),
  };
});

vi.mock('@clerk/nextjs', async () => {
  const { clerkModule, organizationList, thursdayTable } =
    await import('./shell-test-helpers');
  return clerkModule({
    auth: () => auth(),
    organization: () => organization(),
    clerk: () => ({
      status: clerkStatus,
      openCreateOrganization,
      openOrganizationProfile,
      openUserProfile,
      signOut,
    }),
    user: () => ({
      isLoaded: true,
      user: {
        fullName: 'Andreas',
        primaryEmailAddress: { emailAddress: 'andreas@example.com' },
      },
    }),
    organizations: () =>
      organizationList({
        organizations: [thursdayTable, { id: 'other', name: 'Other table' }],
        setActive,
      }),
    // Clerk shows `fallback` until it has rendered the avatar button.
    UserButton: ({ fallback }) =>
      avatarPending ? fallback : <button>Account</button>,
  });
});
vi.mock('convex/react', async () =>
  (await import('./shell-test-helpers')).convexReactModule(() => convexAuth()),
);
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock('~/components/weekly-draft-workspace/gateway', () => ({
  createConvexWorkspaceGateway: (...args: unknown[]) => gateway(...args),
}));
vi.mock('~/lib/sharedQueries', () => ({
  useCampaignQuery: (...args: unknown[]) => campaigns(...args),
}));
// Whether an id outside the list is a deleted campaign (#710).
const deletedCampaign = vi.fn();
vi.mock('./use-deleted-campaign', () => ({
  useDeletedCampaign: (campaignId: string) => deletedCampaign(campaignId),
}));
// The finished weeks themselves are covered by historical-week/screen.test.
vi.mock('~/components/historical-week/screen', () => ({
  CanonicalHistoryScreen: ({
    campaign,
    deleted,
  }: {
    campaign: string;
    deleted?: boolean;
  }) => (
    <p>
      Finished weeks of {campaign}
      {deleted ? ' (read-only)' : ''}
    </p>
  ),
}));
vi.mock('next/navigation', async () =>
  (await import('./shell-test-helpers')).navigationModule({
    push: (href) => push(href),
    pathname: () => pathname(),
  }),
);
vi.mock('next/link', async () =>
  (await import('./shell-test-helpers')).linkModule(),
);
vi.mock('~/components/ui/select', async () =>
  (await import('./shell-test-helpers')).selectModule(),
);

afterEach(() => {
  vi.unstubAllGlobals();
  avatarPending = false;
});

const alpha = { _id: 'alpha', name: 'Alpha' };
const beta = { _id: 'beta', name: 'Beta' };
function member() {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: true });
  organization.mockReturnValue({
    isLoaded: true,
    organization: { id: 'org', name: 'Thursday table' },
  });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  campaigns.mockReturnValue({
    data: { state: 'ready', campaigns: [alpha, beta] },
    refetch: vi.fn(),
  });
  pathname.mockReturnValue('/campaigns/alpha/militia');
  setActive.mockResolvedValue(undefined);
  deletedCampaign.mockReturnValue({ kind: 'none' });
  clerkStatus = 'ready';
}
beforeEach(member);

function Page() {
  const { campaign } = useCampaign();
  return <p>Page for {campaign.name}</p>;
}
function shell(campaignId: string, page: ReactNode = <Page />) {
  return <CampaignShell campaignId={campaignId}>{page}</CampaignShell>;
}
// A week page stand-in that edits through the shared Workspace.
function Editor() {
  const workspace = useWeeklyDraftWorkspace();
  if (workspace.status !== 'ready') return <p>Week not ready</p>;
  return (
    <>
      <button onClick={() => void workspace.edit(upkeepRoll('check', 10))}>
        Edit week {workspace.week}
      </button>
      <p>Feedback: {workspace.feedback}</p>
    </>
  );
}
function onWeekWithFixture() {
  const fixture = workspaceFixture();
  gateway.mockImplementation(() => fixture.gateway);
  pathname.mockReturnValue('/campaigns/alpha/week');
  return fixture;
}

test('renders the shell with skeletons while access resolves and mounts no page', () => {
  auth.mockReturnValue({ isLoaded: false });
  convexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
  campaigns.mockReturnValue({});
  render(shell('alpha'));
  expect(
    screen.getByRole('link', { name: 'Keep: all campaigns' }),
  ).toBeVisible();
  expect(screen.getByRole('status', { name: 'Loading account' })).toBeVisible();
  expect(screen.getByText('Loading campaign…')).toBeInTheDocument();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
});

test('the account slot keeps its placeholder until Clerk has rendered the avatar', () => {
  avatarPending = true;
  render(shell('alpha'));
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  expect(screen.getByRole('status', { name: 'Loading account' })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Account' }),
  ).not.toBeInTheDocument();
});

test('signed out shows one neutral sign-in state without campaign details', () => {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
  campaigns.mockReturnValue({});
  render(shell('alpha'));
  expect(
    screen.getByRole('heading', { name: 'Sign in to open this campaign.' }),
  ).toBeVisible();
  expect(
    screen.getAllByRole('button', { name: 'Sign in' }).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
});

test('without an organization the chooser is offered and no organization name is invented', () => {
  organization.mockReturnValue({ isLoaded: true, organization: null });
  campaigns.mockReturnValue({});
  render(shell('alpha'));
  expect(
    screen.getByRole('heading', { name: "This campaign isn't available." }),
  ).toBeVisible();
  expect(
    screen.getAllByRole('combobox', { name: 'Organization' }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getByRole('link', { name: 'Back to campaigns' }),
  ).toHaveAttribute('href', '/campaigns');
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
});

test('an id outside the active organization is unavailable and never falls back to another campaign', () => {
  const view = render(shell('gamma'));
  expect(
    screen.getByRole('heading', {
      name: "This campaign isn't available in Thursday table.",
    }),
  ).toBeVisible();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Where you are' })).toHaveValue(
    '__campaigns',
  );
  expect(
    screen.queryByRole('link', { name: 'Militia' }),
  ).not.toBeInTheDocument();
  // The organization then refuses the member altogether (deleted, or no
  // longer theirs): no campaign, no recovery.
  campaigns.mockReturnValue({ data: { state: 'no_access' }, refetch: vi.fn() });
  view.rerender(shell('alpha'));
  expect(
    screen.getByRole('heading', {
      name: 'This organization is no longer available.',
    }),
  ).toBeVisible();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  // Without access seen first, the campaign is just unavailable.
  view.unmount();
  render(shell('alpha'));
  expect(
    screen.getByRole('heading', {
      name: "This campaign isn't available in Thursday table.",
    }),
  ).toBeVisible();
});

test('a member campaign renders its page with the switcher, section links and the active section', () => {
  render(shell('alpha'));
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  const switcher = screen.getByRole('combobox', { name: 'Where you are' });
  expect(switcher).toHaveValue('alpha');
  // A truncated name stays readable in full.
  expect(switcher).toHaveAttribute('title', 'Alpha');
  for (const control of screen.getAllByRole('combobox', {
    name: 'Organization',
  }))
    expect(control).toHaveAttribute('title', 'Thursday table');
  expect(
    Array.from(switcher.querySelectorAll('option')).map(
      (option) => option.textContent,
    ),
  ).toEqual(['Campaigns', 'Characters', 'Alpha', 'Beta']);
  const militia = screen
    .getAllByRole('link', { name: 'Militia' })
    .filter((link) => link.getAttribute('href') === '/campaigns/alpha/militia');
  expect(militia).toHaveLength(3);
  for (const link of militia) {
    expect(link).toHaveAttribute('href', '/campaigns/alpha/militia');
    expect(link).toHaveAttribute('aria-current', 'page');
  }
  expect(screen.getAllByRole('link', { name: 'Week' })[0]).toHaveAttribute(
    'href',
    '/campaigns/alpha/week',
  );
  expect(
    screen.getAllByRole('link', { name: 'Finished weeks' })[0],
  ).toHaveAttribute('href', '/campaigns/alpha/history');
  expect(
    screen.getAllByRole('link', { name: 'Characters & officers' })[0],
  ).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  expect(gateway).not.toHaveBeenCalled();
  fireEvent.change(switcher, { target: { value: 'beta' } });
  expect(push).toHaveBeenLastCalledWith('/campaigns/beta');
  fireEvent.change(switcher, { target: { value: '__campaigns' } });
  expect(push).toHaveBeenLastCalledWith('/campaigns');
});

test('a failed campaign list keeps the shell and offers a page-local retry', () => {
  const refetch = vi.fn();
  campaigns.mockReturnValue({ error: new Error('offline'), refetch });
  render(shell('alpha'));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The campaign could not be loaded.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole('link', { name: 'Keep: all campaigns' }),
  ).toBeVisible();
});

test('a session that could not start shows one failure with a page reload as its retry', () => {
  // A failed Clerk load: its status is 'error' and auth stays unloaded.
  clerkStatus = 'error';
  auth.mockReturnValue({ isLoaded: false });
  organization.mockReturnValue({ isLoaded: false });
  convexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
  campaigns.mockReturnValue({});
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  render(shell('alpha'));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The campaign could not be loaded. Check your connection and try again.',
  );
  expect(screen.queryByText('Loading campaign…')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: /isn't available/ }),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('main')).queryByRole('button', { name: 'Sign in' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('maintenance shows the notice once while the page and its navigation stay usable', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  render(shell('alpha'));
  expect(
    screen.getAllByText('Editing is paused for maintenance.'),
  ).toHaveLength(1);
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Reload page' }),
  ).not.toBeInTheDocument();
  for (const link of screen.getAllByRole('link', { name: 'Finished weeks' }))
    expect(link).toHaveAttribute('href', '/campaigns/alpha/history');
  expect(screen.getByRole('combobox', { name: 'Where you are' })).toBeEnabled();
});

test('while editing availability is checked the page loads and navigation works; a reload notice offers Reload page', () => {
  maintenance.mockReturnValue({
    kind: 'loading',
    readOnly: true,
    message: 'Checking whether editing is available.',
  });
  const view = render(shell('alpha'));
  expect(
    screen.getByText('Checking whether editing is available.'),
  ).toBeVisible();
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  const switcher = screen.getByRole('combobox', { name: 'Where you are' });
  fireEvent.change(switcher, { target: { value: 'beta' } });
  expect(push).toHaveBeenLastCalledWith('/campaigns/beta');
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  maintenance.mockReturnValue({
    kind: 'reload_required',
    readOnly: true,
    message:
      'Reload this page before saving. Unsaved changes will be discarded.',
  });
  view.rerender(shell('alpha'));
  expect(
    screen.getByText(
      'Reload this page before saving. Unsaved changes will be discarded.',
    ),
  ).toBeVisible();
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('switching organization drops the old campaign before the new list resolves', () => {
  const view = render(shell('alpha'));
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  organization.mockReturnValue({
    isLoaded: true,
    organization: { id: 'other', name: 'Other table' },
  });
  campaigns.mockReturnValue({});
  view.rerender(shell('alpha'));
  expect(screen.queryByText(/Alpha/)).not.toBeInTheDocument();
  expect(screen.getByText('Loading campaign…')).toBeInTheDocument();
  campaigns.mockReturnValue({
    data: { state: 'ready', campaigns: [beta] },
    refetch: vi.fn(),
  });
  view.rerender(shell('alpha'));
  expect(
    screen.getByRole('heading', {
      name: "This campaign isn't available in Other table.",
    }),
  ).toBeVisible();
});

test('on the Week route one shared owner feeds both the page and the Week link', async () => {
  onWeekWithFixture();
  render(shell('alpha', <Editor />));
  await screen.findByRole('button', { name: 'Edit week 4' });
  expect(screen.getAllByRole('link', { name: 'Week 4' })[0]).toHaveAttribute(
    'href',
    '/campaigns/alpha/week',
  );
  expect(gateway).toHaveBeenCalledTimes(1);
});

test('pending editor work turns a section link into a confirmation instead of leaving silently', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  const [link] = screen.getAllByRole('link', { name: 'Finished weeks' });
  fireEvent.click(link!);
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(push).not.toHaveBeenCalled();
  fireEvent.click(link!);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenLastCalledWith('/campaigns/alpha/history');
  release();
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('changing organization waits for the departure decision before Clerk activates it', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  await screen.findByRole('button', { name: 'Edit week 4' });
  const [control] = screen.getAllByRole('combobox', { name: 'Organization' });
  expect(control).toHaveValue('org');
  fireEvent.change(control!, { target: { value: 'org' } });
  expect(setActive).not.toHaveBeenCalled();
  const release = fixture.hold();
  fireEvent.click(screen.getByRole('button', { name: 'Edit week 4' }));
  fireEvent.change(control!, { target: { value: 'other' } });
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(setActive).not.toHaveBeenCalled();
  expect(control).toHaveValue('org');
  fireEvent.change(control!, { target: { value: 'other' } });
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(setActive).toHaveBeenCalledTimes(1));
  expect(setActive).toHaveBeenLastCalledWith({
    organization: 'other',
    redirectUrl: '/campaigns',
  });
  release();
  await waitFor(() => expect(control).not.toBeDisabled());
  fireEvent.change(control!, { target: { value: '__personal' } });
  await waitFor(() => expect(setActive).toHaveBeenCalledTimes(2));
  expect(setActive).toHaveBeenLastCalledWith({
    organization: null,
    redirectUrl: '/campaigns',
  });
});

test('More opens a sheet with stacked organization and account controls and closes once a choice commits', async () => {
  render(shell('alpha'));
  const more = screen.getByRole('button', { name: 'More' });
  expect(more).toHaveAttribute('aria-haspopup', 'dialog');
  fireEvent.click(more);
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  const organization = within(sheet).getByRole('group', {
    name: 'Organization',
  });
  expect(
    within(organization).getByRole('combobox', { name: 'Organization' }),
  ).toBeVisible();
  expect(
    within(organization).getByRole('button', { name: 'New organization' }),
  ).toBeVisible();
  const account = within(sheet).getByRole('group', { name: 'Account' });
  expect(within(account).getByText('Andreas')).toBeVisible();
  expect(
    within(account).getByRole('button', { name: 'Manage account' }),
  ).toBeVisible();
  expect(
    within(account).getByRole('button', { name: 'Sign out' }),
  ).toBeVisible();
  // The stock avatar menu is not offered inside the sheet; it is in the top bar.
  expect(
    within(account).queryByRole('button', { name: 'Account' }),
  ).not.toBeInTheDocument();
  fireEvent.change(
    within(organization).getByRole('combobox', { name: 'Organization' }),
    { target: { value: 'other' } },
  );
  await waitFor(() => expect(setActive).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
});

test('phone account actions open Clerk account management and sign out through the guard, closing More on commit', async () => {
  signOut.mockResolvedValue(undefined);
  render(shell('alpha'));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(
    within(sheet).getByRole('button', { name: 'Manage account' }),
  );
  expect(openUserProfile).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const reopened = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(within(reopened).getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  expect(signOut).toHaveBeenLastCalledWith({ redirectUrl: '/campaigns' });
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
});

test('pending work turns phone sign-out into the departure decision: Stay keeps More and the session, Leave signs out once', async () => {
  signOut.mockResolvedValue(undefined);
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  const out = within(sheet).getByRole('button', { name: 'Sign out' });
  fireEvent.click(out);
  const warning = screen.getByRole('dialog', {
    name: 'Changes are still saving',
  });
  fireEvent.click(within(warning).getByRole('button', { name: 'Stay' }));
  expect(signOut).not.toHaveBeenCalled();
  expect(openUserProfile).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'More' })).toBeInTheDocument();
  fireEvent.click(out);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  release();
});

test('a refused sign-out is reported after More has closed, and Try again repeats it once', async () => {
  signOut
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue(undefined);
  render(shell('alpha'));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  const failure = await screen.findByRole('dialog', {
    name: "That didn't finish",
  });
  expect(within(failure).getByRole('alert')).toHaveTextContent(
    'Sign-out could not be completed. You are still signed in.',
  );
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: "That didn't finish" }),
    ).not.toBeInTheDocument(),
  );
});

test('Try again re-checks pending work: an edit held since the first sign-out attempt gets Stay/Leave before any retry', async () => {
  let reject: (error: Error) => void = () => undefined;
  signOut
    .mockImplementationOnce(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(undefined);
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  await screen.findByRole('button', { name: 'Edit week 4' });
  // No pending work: sign-out starts at once and More closes.
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  expect(signOut).toHaveBeenCalledTimes(1);
  // The page is still editable; a save is held while sign-out is in flight.
  const release = fixture.hold();
  fireEvent.click(screen.getByRole('button', { name: 'Edit week 4' }));
  reject(new Error('network'));
  const failure = await screen.findByRole('dialog', {
    name: "That didn't finish",
  });
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  expect(signOut).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Feedback: pending')).toBeVisible();
  // Retrying again while still pending offers the same decision; Leave runs once.
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'More' })).getByRole(
      'button',
      { name: 'Sign out' },
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(2));
  release();
  await screen.findByText('Feedback: saved');
  expect(signOut).toHaveBeenCalledTimes(2);
});

test('a refused sign-out after Leave anyway is reported and can be dismissed', async () => {
  signOut.mockRejectedValue(new Error('network'));
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  const failure = await screen.findByRole('dialog', {
    name: "That didn't finish",
  });
  expect(signOut).toHaveBeenCalledTimes(1);
  fireEvent.click(within(failure).getByRole('button', { name: 'Dismiss' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  // The guard is usable again after a failed Leave.
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'More' })).getByRole(
      'button',
      { name: 'Sign out' },
    ),
  );
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(signOut).toHaveBeenCalledTimes(1);
  release();
});

test('More stays open while the departure decision is pending and closes on Leave', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(
    within(sheet).getByRole('button', { name: 'New organization' }),
  );
  const warning = screen.getByRole('dialog', {
    name: 'Changes are still saving',
  });
  fireEvent.click(within(warning).getByRole('button', { name: 'Stay' }));
  expect(openCreateOrganization).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'More' })).toBeInTheDocument();
  fireEvent.click(
    within(sheet).getByRole('button', { name: 'New organization' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(openCreateOrganization).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  release();
});

// The Week frame later fills this position; the shell only reserves it.
function StripPage() {
  return (
    <>
      <p>Week page</p>
      <PhoneStatusStrip>
        <span>Training 3 → 4</span>
      </PhoneStatusStrip>
    </>
  );
}

test('the week page can fill the phone status strip above the bottom bar; the top bar reserves no status position', () => {
  pathname.mockReturnValue('/campaigns/alpha/week');
  render(shell('alpha', <StripPage />));
  const strip = screen.getByText('Training 3 → 4');
  const bar = strip.closest('[data-shell-slot="phone-status-strip"]');
  expect(bar).not.toBeNull();
  // The strip host sits directly before the phone tabs, inside the sticky bar.
  const tabs = bar!.parentElement!.querySelector('nav');
  expect(tabs).toHaveAccessibleName('Areas');
  expect(bar!.nextElementSibling).toBe(tabs);
  // The top-bar save status was removed (2026-09-28, amending #137).
  expect(
    document.querySelector('[data-shell-slot="top-bar-status"]'),
  ).toBeNull();
});

function legalLink() {
  return within(screen.getByRole('contentinfo')).getByRole('link', {
    name: 'Legal notices',
  });
}

test('the legal notices link closes the frame in every access state', () => {
  const view = render(shell('alpha'));
  expect(legalLink()).toHaveAttribute('href', '/legal');
  auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
  campaigns.mockReturnValue({});
  view.rerender(shell('alpha'));
  expect(
    screen.getByRole('heading', { name: 'Sign in to open this campaign.' }),
  ).toBeVisible();
  expect(legalLink()).toHaveAttribute('href', '/legal');
});

test('on the bounded Week the legal link sits inside the frame above the phone bar, which keeps its strip and tabs', () => {
  pathname.mockReturnValue('/campaigns/alpha/week');
  render(shell('alpha', <StripPage />));
  const frame = document.querySelector('[data-shell-frame="bounded"]');
  expect(frame).not.toBeNull();
  const footer = screen.getByRole('contentinfo');
  expect(frame).toContainElement(footer);
  expect(footer).toContainElement(legalLink());
  // The week host (the editor's scroll area) precedes the footer; the phone
  // bar with its strip host and tabs follows it unchanged.
  const host = document.querySelector('[data-week-host]');
  expect(frame).toContainElement(host as HTMLElement);
  expect(host!.compareDocumentPosition(footer)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const strip = screen.getByText('Training 3 → 4');
  const bar = strip.closest(
    '[data-shell-slot="phone-status-strip"]',
  )!.parentElement!;
  expect(footer.nextElementSibling).toBe(bar);
  expect(within(bar).getByRole('navigation')).toHaveAccessibleName('Areas');
  expect(within(bar).getAllByRole('link')).toHaveLength(3);
});

test('pending editor work turns the legal link into the same departure decision', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  fireEvent.click(legalLink());
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(push).not.toHaveBeenCalled();
  fireEvent.click(legalLink());
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  expect(push).toHaveBeenLastCalledWith('/legal');
  release();
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('only the week route gets the bounded desktop host; other sections keep document scrolling', () => {
  pathname.mockReturnValue('/campaigns/alpha/week');
  const view = render(shell('alpha'));
  expect(document.querySelector('[data-week-host]')).not.toBeNull();
  pathname.mockReturnValue('/campaigns/alpha/militia');
  view.rerender(shell('alpha'));
  expect(document.querySelector('[data-week-host]')).toBeNull();
});

test('the bounded Week desktop rail starts collapsed and other militia pages start expanded', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  pathname.mockReturnValue('/campaigns/alpha/week');
  const view = render(shell('alpha'));
  const toggle = screen.getByRole('button', { name: 'Militia navigation' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  for (const section of ['history', 'militia', 'officers', 'setup']) {
    pathname.mockReturnValue(`/campaigns/alpha/${section}`);
    view.rerender(shell('alpha'));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
  pathname.mockReturnValue('/campaigns/alpha/week');
  view.rerender(shell('alpha'));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('the phone bottom bar reserves its measured height as document scroll padding, follows resizes, and clears it once hidden or gone', () => {
  // jsdom has no ResizeObserver and no layout: stand in for both so the
  // bar can report a height, grow with its strip and collapse to hidden.
  const observed = new Map<Element, () => void>();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(target: Element) {
        observed.set(target, this.callback);
      }
      disconnect() {
        for (const [target, notify] of observed)
          if (notify === this.callback) observed.delete(target);
      }
    },
  );
  let height = 0;
  const view = render(shell('alpha'));
  const bar = document.querySelector(
    '[data-shell-slot="phone-status-strip"]',
  )!.parentElement!;
  Object.defineProperty(bar, 'offsetHeight', { get: () => height });
  const notifyBar = observed.get(bar);
  expect(notifyBar).toBeDefined();
  const resize = (to: number) => {
    height = to;
    notifyBar?.();
  };
  const root = document.documentElement.style;
  resize(49);
  expect(root.scrollPaddingBottom).toBe('65px');
  resize(120);
  expect(root.scrollPaddingBottom).toBe('136px');
  resize(0);
  expect(root.scrollPaddingBottom).toBe('');
  resize(49);
  expect(root.scrollPaddingBottom).toBe('65px');
  view.unmount();
  expect(root.scrollPaddingBottom).toBe('');
  expect(observed.size).toBe(0);
});

test('organization creation and management stay reachable through Clerk, and creation is offered without an organization', () => {
  const view = render(shell('alpha'));
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Manage organization' })[0]!,
  );
  expect(openOrganizationProfile).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'New organization' })[0]!,
  );
  expect(openCreateOrganization).toHaveBeenCalledTimes(1);
  expect(openCreateOrganization).toHaveBeenLastCalledWith({
    afterCreateOrganizationUrl: '/campaigns',
  });
  organization.mockReturnValue({ isLoaded: true, organization: null });
  campaigns.mockReturnValue({});
  view.rerender(shell('alpha'));
  expect(
    screen.getByRole('heading', { name: "This campaign isn't available." }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Manage organization' }),
  ).not.toBeInTheDocument();
  // The top bar and the state card both offer creation without an organization.
  expect(
    screen.getAllByRole('button', { name: 'New organization' }),
  ).toHaveLength(2);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'New organization' })[1]!,
  );
  expect(openCreateOrganization).toHaveBeenCalledTimes(2);
});

test('opening Clerk organization flows waits for the departure decision while work is pending', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  const [create] = screen.getAllByRole('button', { name: 'New organization' });
  fireEvent.click(create!);
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(openCreateOrganization).not.toHaveBeenCalled();
  fireEvent.click(create!);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(openCreateOrganization).toHaveBeenCalledTimes(1));
  const [manage] = screen.getAllByRole('button', {
    name: 'Manage organization',
  });
  fireEvent.click(manage!);
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(openOrganizationProfile).not.toHaveBeenCalled();
  fireEvent.click(manage!);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(openOrganizationProfile).toHaveBeenCalledTimes(1));
  release();
  await screen.findByText('Feedback: saved');
  fireEvent.click(manage!);
  await waitFor(() => expect(openOrganizationProfile).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

// ---------- A deleted campaign keeps its finished weeks (#710) ----------

const deletedGamma = (hasHistory: boolean) => ({
  kind: 'deleted',
  deletion: {
    campaignId: 'gamma',
    campaignName: 'Gamma',
    state: 'deleted',
    remaining: 0,
    setAside: 0,
    blockers: null,
    deletedAt: Date.UTC(2026, 9, 5),
    hasHistory,
  },
});

test('an unavailable id stays unavailable while the deletion check runs', () => {
  deletedCampaign.mockReturnValue({ kind: 'loading' });
  render(shell('gamma'));
  expect(screen.getByText('Loading campaign…')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /isn't available/ })).toBeNull();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
});

test('a deleted campaign’s history route reads its finished weeks read-only under Deleted campaign', () => {
  deletedCampaign.mockReturnValue(deletedGamma(true));
  pathname.mockReturnValue('/campaigns/gamma/history');
  render(shell('gamma'));
  expect(deletedCampaign).toHaveBeenCalledWith('gamma');
  expect(screen.getByText('Deleted campaign')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Gamma' })).toBeVisible();
  expect(screen.getByText(/^Deleted /)).toBeVisible();
  expect(screen.getByText('Finished weeks of gamma (read-only)')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Back to campaigns' }),
  ).toHaveAttribute('href', '/campaigns');
  // No rail or section links: nothing leads into the campaign. (The
  // Characters link that stays is the independent Characters area.)
  expect(
    screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.startsWith('/campaigns/gamma')),
  ).toEqual([]);
  expect(screen.queryByRole('link', { name: 'Militia' })).toBeNull();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Where you are' })).toHaveValue(
    '__campaigns',
  );
});

test('a deleted campaign on another of its pages offers only its finished weeks and the way back', () => {
  deletedCampaign.mockReturnValue(deletedGamma(true));
  pathname.mockReturnValue('/campaigns/gamma/characters');
  const view = render(shell('gamma'));
  expect(screen.getByRole('heading', { name: 'Gamma' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Finished weeks' })).toHaveAttribute(
    'href',
    '/campaigns/gamma/history',
  );
  expect(screen.queryByText(/Finished weeks of gamma/)).toBeNull();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  deletedCampaign.mockReturnValue(deletedGamma(false));
  view.rerender(shell('gamma'));
  expect(screen.getByText('No finished weeks.')).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Finished weeks' })).toBeNull();
});
