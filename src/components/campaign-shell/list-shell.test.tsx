import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { ListShell } from './list-shell';

const auth = vi.fn();
const convexAuth = vi.fn();

vi.mock('./use-list-shell-navigation', async () => {
  const { buildAppNavigation } = await import('~/lib/app-navigation');
  return {
    useListShellNavigation: () =>
      buildAppNavigation({ pathname: '/campaigns', campaigns: [] }),
  };
});
vi.mock('@clerk/nextjs', async () => {
  const { clerkModule, organizationList, thursdayTable } =
    await import('./shell-test-helpers');
  return clerkModule({
    auth: () => auth(),
    organization: () => ({ isLoaded: true, organization: thursdayTable }),
    clerk: () => ({ status: 'ready' }),
    organizations: () => organizationList({ organizations: [thursdayTable] }),
  });
});
vi.mock('convex/react', async () =>
  (await import('./shell-test-helpers')).convexReactModule(() => convexAuth()),
);
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock('next/navigation', async () =>
  (await import('./shell-test-helpers')).navigationModule({
    pathname: () => '/campaigns',
  }),
);
vi.mock('next/link', async () =>
  (await import('./shell-test-helpers')).linkModule(),
);

beforeEach(() => {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: true });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
});

function legalLink() {
  return within(screen.getByRole('contentinfo')).getByRole('link', {
    name: 'Legal notices',
  });
}

test('the campaign list frame ends with the legal notices link', () => {
  render(
    <ListShell>
      <p>Campaign list</p>
    </ListShell>,
  );
  expect(screen.getByText('Campaign list')).toBeVisible();
  expect(legalLink()).toHaveAttribute('href', '/legal');
  expect(
    screen.getByRole('link', { name: 'Keep: all campaigns' }),
  ).toBeVisible();
});

test('signed out, the link is offered next to the sign-in prompt', () => {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
  render(
    <ListShell>
      <p>Sign in to see your campaigns</p>
    </ListShell>,
  );
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(legalLink()).toHaveAttribute('href', '/legal');
});

test('the list keeps the fixed phone areas and the desktop area links', () => {
  render(
    <ListShell>
      <p>Campaign list</p>
    </ListShell>,
  );
  const sections = screen.getByRole('navigation', { name: 'Sections' });
  expect(
    within(sections).getByRole('link', { name: 'Campaigns' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(
    within(sections).getByRole('link', { name: 'Characters' }),
  ).toHaveAttribute('href', '/characters');
  const areas = screen.getByRole('navigation', { name: 'Areas' });
  expect(within(areas).getByRole('link', { name: 'Campaign' })).toHaveAttribute(
    'href',
    '/campaigns',
  );
  expect(
    within(areas).getByRole('button', { name: 'Militia' }),
  ).toHaveAttribute('aria-disabled', 'true');
  expect(
    within(areas).getByRole('link', { name: 'Characters' }),
  ).toBeInTheDocument();
  expect(
    within(areas).getByRole('button', { name: 'More' }),
  ).toBeInTheDocument();
});
