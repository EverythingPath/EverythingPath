import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { getFunctionName, type FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import {
  Component,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NavigationGuardProvider } from '~/components/campaign-shell/navigation-guard';
import {
  buildSheet,
  characterId,
  emptyOwnerCandidates,
} from '~/components/character-sheet/character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from '~/components/character-sheet/use-character-sheet';
import type { CharacterSheetView } from '~/components/character-sheet/character-sheet-view';
import IndependentCharacterError from '../error';
import IndependentCharacterSheetRoute from './page';

const transport = vi.hoisted(() => ({
  deletePrivate: vi.fn(),
  push: vi.fn(),
  setActive: vi.fn(),
}));
let snapshot: CharacterSheetSnapshot;
let readError: Error | null;

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: (name: FunctionReference<'query'>, args: unknown) => {
    if (args === 'skip') return undefined;
    if (getFunctionName(name) === 'companionRelationships:list') return [];
    // Not a Synthesist: the sheet has no Combined Form (#421).
    if (getFunctionName(name) === 'characterSheetCombinedForm:read')
      return null;
    if (getFunctionName(name) === 'catalogCopies:list') {
      return snapshot.catalogEntries;
    }
    if (readError) throw readError;
    return snapshot;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (name: FunctionReference<'mutation'>) =>
    getFunctionName(name) === 'characterSheet:deletePrivate'
      ? transport.deletePrivate
      : vi.fn(),
}));
vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => ({ organization: null }),
  useOrganizationList: () => ({
    isLoaded: true,
    setActive: transport.setActive,
  }),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ characterId: 'character%2D1' }),
  usePathname: () => '/characters/character-1',
  useSearchParams: () =>
    new URLSearchParams('from=%2Fcharacters&organizationId='),
  useRouter: () => ({ push: transport.push }),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));

vi.mock(
  '~/components/character-sheet/use-character-move',
  () => import('~/components/character-sheet/use-character-move-test-double'),
);

// Keep the real lifecycle controls and route host without unrelated sheet editors.
vi.mock('~/components/character-sheet/character-sheet-view', () => ({
  CharacterSheetView: ({
    lifecycle,
  }: Pick<ComponentProps<typeof CharacterSheetView>, 'lifecycle'>) => lifecycle,
}));

// Next replaces the route subtree with its error page when a read throws.
class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <IndependentCharacterError
        error={this.state.error}
        reset={() => this.setState({ error: null })}
      />
    ) : (
      this.props.children
    );
  }
}

function RouteTree({ client }: { client: QueryClient }) {
  const [pathname, setPathname] = useState('/characters/character-1');
  transport.push.mockImplementation((href: string) => setPathname(href));
  return (
    <QueryClientProvider client={client}>
      <NavigationGuardProvider>
        {pathname === '/characters' ? (
          <h1>Characters</h1>
        ) : (
          <RouteErrorBoundary>
            <IndependentCharacterSheetRoute />
          </RouteErrorBoundary>
        )}
      </NavigationGuardProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  const initial = buildSheet({ name: 'Private hero' });
  const { campaignId: _campaignId, ...character } = initial.character;
  snapshot = { ...initial, campaign: null, character };
  readError = null;
  transport.deletePrivate.mockReset();
  transport.push.mockReset();
  transport.setActive.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: () => {
          if (readError) return Promise.reject(readError);
          return Promise.resolve(snapshot);
        },
      },
    },
  });
  const queryKey = convexQuery(api.characterSheet.read, {
    characterId,
  }).queryKey;
  client.setQueryData(queryKey, snapshot);
  const view = render(<RouteTree client={client} />);
  return {
    async failRead() {
      readError = new ConvexError('Character not found');
      await act(async () => client.invalidateQueries({ queryKey }));
      view.rerender(<RouteTree client={client} />);
    },
  };
}

test('a private deletion returns to Characters when the sheet disappears before the deletion reply', async () => {
  let confirmDeletion: () => void = () => {
    throw new Error('The deletion reply is not ready.');
  };
  const deletionReply = new Promise<void>((resolve) => {
    confirmDeletion = resolve;
  });
  transport.deletePrivate.mockReturnValue(deletionReply);
  const route = renderRoute();
  fireEvent.click(screen.getByRole('button', { name: 'Delete character' }));
  fireEvent.click(
    within(
      screen.getByRole('group', { name: 'Delete Private hero?' }),
    ).getByRole('button', { name: 'Delete Private hero' }),
  );
  expect(transport.deletePrivate).toHaveBeenCalledOnce();
  await route.failRead();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Deleting Private hero…',
  );
  expect(transport.push).not.toHaveBeenCalled();
  await act(async () => {
    confirmDeletion();
    await deletionReply;
  });
  expect(screen.getByRole('heading', { name: 'Characters' })).toBeVisible();
  expect(transport.push).toHaveBeenCalledExactlyOnceWith('/characters');
});

test('a sheet that stops being readable without a deletion shows the route’s unavailable state with a usable origin link', async () => {
  const route = renderRoute();
  expect(
    screen.getByRole('button', { name: 'Delete character' }),
  ).toBeVisible();
  await route.failRead();
  expect(screen.getByRole('status')).toHaveTextContent(
    'This character isn’t available.',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Characters' })).toHaveAttribute(
    'href',
    '/characters',
  );
  expect(transport.push).not.toHaveBeenCalled();
});
