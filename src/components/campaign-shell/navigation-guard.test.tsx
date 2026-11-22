import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  WeeklyDraftWorkspaceProvider,
  useWeeklyDraftWorkspace,
} from '~/components/weekly-draft-workspace/use-weekly-draft-workspace';
import {
  upkeepRoll,
  workspaceFixture,
} from '~/components/weekly-draft-workspace/workspace-test-fixture';
import {
  installBrowserHistory,
  resetBrowserHistoryForTests,
} from './browser-history';
import { GuardedLink, NavigationGuardProvider } from './navigation-guard';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
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

// Stands in for Next's own popstate handling, which must never observe a
// blocked traversal and must observe a permitted one exactly once.
const traversals: string[] = [];
function onNextPop() {
  traversals.push(window.location.pathname);
}
beforeEach(() => {
  traversals.length = 0;
  installBrowserHistory();
  resetBrowserHistoryForTests();
  window.addEventListener('popstate', onNextPop);
});
afterEach(() => {
  window.removeEventListener('popstate', onNextPop);
});

function Editor() {
  const workspace = useWeeklyDraftWorkspace();
  if (workspace.status !== 'ready') return <p>Week not ready</p>;
  return (
    <>
      <p role="status">{workspace.feedback}</p>
      <button onClick={() => void workspace.edit(upkeepRoll('check', 10))}>
        Edit
      </button>
      <GuardedLink href="/campaigns/a/characters">Characters</GuardedLink>
    </>
  );
}
function dialog() {
  return screen.queryByRole('dialog', { name: 'Changes are still saving' });
}
async function settle() {
  // jsdom traverses history asynchronously; let queued popstates run.
  await new Promise((resolve) => setTimeout(resolve, 20));
}

test('[shell.traversal] Back and Forward ask before leaving pending work and keep their direction', async () => {
  const fixture = workspaceFixture();
  window.history.pushState(null, '', '/campaigns/a/characters');
  window.history.pushState(null, '', '/campaigns/a/week');
  render(
    <WeeklyDraftWorkspaceProvider gateway={fixture.gateway}>
      <NavigationGuardProvider>
        <Editor />
      </NavigationGuardProvider>
    </WeeklyDraftWorkspaceProvider>,
  );
  await screen.findByRole('button', { name: 'Edit' });

  // No pending work: traversal passes straight through to Next.
  window.history.back();
  await waitFor(() => expect(traversals).toEqual(['/campaigns/a/characters']));
  expect(dialog()).toBeNull();
  window.history.forward();
  await waitFor(() => expect(traversals).toHaveLength(2));
  expect(window.location.pathname).toBe('/campaigns/a/week');

  const release = fixture.hold();
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByRole('status')).toHaveTextContent('pending');

  // Back with pending work: Next never sees it, the week stays, Stay keeps it.
  window.history.back();
  await waitFor(() => expect(dialog()).not.toBeNull());
  expect(window.location.pathname).toBe('/campaigns/a/week');
  expect(traversals).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  await settle();
  expect(dialog()).toBeNull();
  expect(window.location.pathname).toBe('/campaigns/a/week');
  expect(traversals).toHaveLength(2);

  // Leave replays the same Back once; Forward afterwards is a real Forward.
  window.history.back();
  await waitFor(() => expect(dialog()).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(traversals).toHaveLength(3));
  expect(traversals[2]).toBe('/campaigns/a/characters');
  expect(window.location.pathname).toBe('/campaigns/a/characters');
  expect(dialog()).toBeNull();

  window.history.forward();
  await waitFor(() => expect(dialog()).not.toBeNull());
  expect(window.location.pathname).toBe('/campaigns/a/characters');
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(traversals).toHaveLength(4));
  expect(window.location.pathname).toBe('/campaigns/a/week');

  // Links use the same decision; Leave runs the navigation exactly once.
  fireEvent.click(screen.getByRole('link', { name: 'Characters' }));
  await waitFor(() => expect(dialog()).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenLastCalledWith('/campaigns/a/characters');

  release();
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('saved'),
  );
  window.history.back();
  await waitFor(() => expect(traversals).toHaveLength(5));
  expect(dialog()).toBeNull();
});
