import { fireEvent, render, screen, within } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import IndependentCharacterError from '~/app/characters/error';
import IndependentCharactersLayout from '~/app/characters/layout';
import CharactersLoading from '~/app/characters/loading';
import CharacterLoading from '~/app/characters/[characterId]/loading';
import CharacterCreationLoading from '~/app/characters/new/loading';

// The independent Characters route (#260): a sheet outside every campaign
// and organization, in a shell with only the Keep and the account.

const auth = vi.fn();
const convexAuth = vi.fn();
const resetQueries = vi.fn();
const shell = { pathname: '/characters/character-1' };

vi.mock(
  '~/components/campaign-shell/use-independent-characters-shell',
  async () => {
    const { buildAppNavigation } = await import('~/lib/app-navigation');
    return {
      useIndependentCharactersShell: () => ({
        nav: buildAppNavigation({ pathname: shell.pathname, campaigns: [] }),
        isSheet: shell.pathname.startsWith('/characters/'),
      }),
    };
  },
);
vi.mock('~/components/character-sheet/use-character-sheet-navigation', () => ({
  useCharacterSheetNavigation: () => ({
    back: { href: '/characters', label: 'Characters' },
  }),
}));
vi.mock('@clerk/nextjs', async () => {
  const { clerkModule, organizationList } =
    await import('~/components/campaign-shell/shell-test-helpers');
  return clerkModule({
    auth: () => auth(),
    organization: () => ({ isLoaded: true }),
    clerk: () => ({ status: 'ready' }),
    organizations: () => organizationList({ organizations: [] }),
  });
});
vi.mock('convex/react', async () =>
  (
    await import('~/components/campaign-shell/shell-test-helpers')
  ).convexReactModule(() => convexAuth()),
);
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock('next/navigation', async () =>
  (
    await import('~/components/campaign-shell/shell-test-helpers')
  ).navigationModule({ pathname: () => '/characters/character-1' }),
);
vi.mock('next/link', async () =>
  (await import('~/components/campaign-shell/shell-test-helpers')).linkModule(),
);
vi.mock('@tanstack/react-query', () => ({
  useQueryErrorResetBoundary: () => ({ reset: resetQueries }),
}));

beforeEach(() => {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: true });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
  shell.pathname = '/characters/character-1';
});

function renderLayout() {
  return render(
    <IndependentCharactersLayout>
      <main>
        <h1>Private hero</h1>
      </main>
    </IndependentCharactersLayout>,
  );
}
function keepLink() {
  return screen.getByRole('link', { name: 'Keep: all campaigns' });
}
function backLink() {
  return within(screen.getByRole('main')).getByRole('link', {
    name: 'Characters',
  });
}

test('route loading fallbacks show the list for Characters and the sheet for sheet and creation routes', () => {
  const view = render(<CharactersLoading />);
  expect(
    screen.getByRole('status', { name: 'Loading characters' }),
  ).toBeInTheDocument();
  view.rerender(<CharacterLoading />);
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeInTheDocument();
  view.rerender(<CharacterCreationLoading />);
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeInTheDocument();
});

test('while the session loads, the loading sheet sits under a top bar without any organization', () => {
  convexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
  renderLayout();
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeInTheDocument();
  expect(keepLink()).toHaveAttribute('href', '/campaigns');
  expect(backLink()).toHaveAttribute('href', '/characters');
  expect(screen.queryByText('Private hero')).not.toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: 'Where you are' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('status', { name: /Loading organizations/ }),
  ).not.toBeInTheDocument();
});

test('while the session loads on the Characters area, the list skeleton stands in under the Characters place', () => {
  shell.pathname = '/characters';
  convexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
  renderLayout();
  expect(
    screen.getByRole('status', { name: 'Loading characters' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Characters',
  );
  expect(screen.queryByText('Private hero')).not.toBeInTheDocument();
});

test('signed out, nothing of the character is shown and sign-in is offered with Back to Campaigns', () => {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
  renderLayout();
  expect(screen.getByText('Sign in to open your characters.')).toBeVisible();
  expect(
    screen.getAllByRole('button', { name: 'Sign in' }).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByText('Private hero')).not.toBeInTheDocument();
  expect(backLink()).toHaveAttribute('href', '/characters');
  expect(
    within(screen.getByRole('contentinfo')).getByRole('link', {
      name: 'Legal notices',
    }),
  ).toHaveAttribute('href', '/legal');
});

test('signed in, the page renders inside the shell and its links take keyboard focus', () => {
  renderLayout();
  expect(screen.getByRole('heading', { name: 'Private hero' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Account' })).toBeVisible();
  expect(
    screen.queryByRole('status', { name: 'Loading character sheet…' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Sign in' }),
  ).not.toBeInTheDocument();
  keepLink().focus();
  expect(keepLink()).toHaveFocus();
  expect(screen.getByRole('banner')).toContainElement(keepLink());
});

test('a missing, deleted or returned private character reads the same: not available, with Back and no retry', () => {
  const reset = vi.fn();
  render(
    <IndependentCharacterError
      error={new ConvexError('Character not found')}
      reset={reset}
    />,
  );
  const notice = screen.getByRole('status');
  expect(notice).toHaveTextContent('This character isn’t available.');
  expect(notice).not.toHaveTextContent(
    /not found|access|permission|owner|campaign|organization|returned/i,
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect(backLink()).toHaveAttribute('href', '/characters');
});

test('any other failed read keeps the generic failure with Try again', () => {
  const reset = vi.fn();
  render(
    <IndependentCharacterError
      error={new Error('Connection lost')}
      reset={reset}
    />,
  );
  const failure = screen.getByRole('alert');
  expect(failure).toHaveTextContent('The character sheet could not be loaded.');
  expect(failure).not.toHaveTextContent(/not found|access|permission|owner/i);
  expect(backLink()).toHaveAttribute('href', '/characters');
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  expect(resetQueries).toHaveBeenCalledTimes(1);
  expect(reset).toHaveBeenCalledTimes(1);
});
