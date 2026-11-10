import { act, renderHook } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Doc } from '@convex/_generated/dataModel';
import { useCampaignHomeSelection } from './use-campaign-home';

type Deferred = {
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let creates: Deferred[] = [];
const navigate = vi.fn();
vi.mock('convex/react', () => ({
  useMutation: () => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      creates.push({ args, resolve, reject });
    }),
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  useNavigationGuard: () => ({ navigate }),
}));
vi.mock('~/lib/sharedQueries', () => ({ useCampaignQuery: vi.fn() }));
vi.mock('~/components/campaign-shell/session', () => ({ useSession: vi.fn() }));

const organization = { id: 'org', name: 'Thursday table' };
const doc = (id: string, name = 'Same name') =>
  ({ _id: id, name, description: '', organizationId: 'org' }) as unknown as Doc<'campaign'>;
const values = { name: 'Same name', description: '' };

beforeEach(() => {
  creates = [];
  navigate.mockClear();
});

function render(requested: string | null = 'alpha') {
  return renderHook(
    ({ campaigns, requested: id }) =>
      useCampaignHomeSelection({ organization, campaigns, requested: id }),
    { initialProps: { campaigns: [doc('alpha')], requested } },
  );
}

test('create selects the returned id and waits for the list without flashing unavailable', async () => {
  const view = render();
  act(() => view.result.current.startCreate());
  expect(view.result.current.pane).toEqual({ kind: 'create', entry: 'new' });
  let first: Promise<boolean>;
  act(() => {
    first = view.result.current.create.submit(values);
  });
  expect(view.result.current.create.status).toEqual({ kind: 'pending' });
  // A second press while pending sends nothing.
  await act(async () => {
    expect(await view.result.current.create.submit(values)).toBe(false);
  });
  expect(creates).toHaveLength(1);
  expect(creates[0]!.args).toEqual({ ...values, organizationId: 'org' });

  await act(async () => {
    creates[0]!.resolve('created');
    await first;
  });
  expect(navigate).toHaveBeenCalledWith('/campaigns/created');
  expect(view.result.current.announcement).toBe('Created Same name.');
  // The address has not changed yet, then the list has not observed it yet.
  expect(view.result.current.pane).toEqual({
    kind: 'opening',
    name: 'Same name',
  });
  view.rerender({ campaigns: [doc('alpha')], requested: 'created' });
  expect(view.result.current.pane.kind).toBe('opening');
  // Observed: the returned id is selected, never the same-named row.
  view.rerender({
    campaigns: [doc('alpha'), doc('created')],
    requested: 'created',
  });
  expect(view.result.current.selectedId).toBe('created');
  // Going Back to the previous campaign later is an ordinary selection.
  view.rerender({
    campaigns: [doc('alpha'), doc('created')],
    requested: 'alpha',
  });
  expect(view.result.current.selectedId).toBe('alpha');
});

test('a refused create keeps the form and reports the server message', async () => {
  const view = render();
  act(() => view.result.current.startCreate());
  await act(async () => {
    const done = view.result.current.create.submit(values);
    creates[0]!.reject(new ConvexError('You do not have access to this org'));
    expect(await done).toBe(false);
  });
  expect(view.result.current.create.status).toEqual({
    kind: 'rejected',
    message: 'You do not have access to this org',
  });
  expect(view.result.current.pane).toEqual({ kind: 'create', entry: 'new' });
  expect(navigate).not.toHaveBeenCalled();
});

test('an unconfirmed create is not retried or matched by name', async () => {
  const view = render();
  act(() => view.result.current.startCreate());
  await act(async () => {
    const done = view.result.current.create.submit(values);
    creates[0]!.reject(new Error('ConvexClient has already been closed.'));
    await done;
  });
  expect(view.result.current.create.status).toEqual({ kind: 'unknown' });
  expect(creates).toHaveLength(1);
  // A same-named campaign appearing does not get selected.
  view.rerender({ campaigns: [doc('alpha'), doc('other')], requested: 'alpha' });
  expect(view.result.current.pane.kind).toBe('create');
  expect(navigate).not.toHaveBeenCalled();
});

test('choosing a row while a create is pending leaves the selection to the player', async () => {
  const view = render();
  act(() => view.result.current.startCreate());
  let done: Promise<boolean>;
  act(() => {
    done = view.result.current.create.submit(values);
  });
  act(() => view.result.current.choose());
  await act(async () => {
    creates[0]!.resolve('created');
    await done;
  });
  expect(navigate).not.toHaveBeenCalled();
  expect(view.result.current.announcement).toBe('Created Same name.');
  expect(view.result.current.selectedId).toBe('alpha');
});

test('a create acknowledged after the organization changed does nothing there', async () => {
  const view = render();
  act(() => view.result.current.startCreate());
  let done: Promise<boolean>;
  act(() => {
    done = view.result.current.create.submit(values);
  });
  view.unmount();
  await act(async () => {
    creates[0]!.resolve('created');
    await done;
  });
  expect(navigate).not.toHaveBeenCalled();
});

test('Cancel restores the previous selection', () => {
  const view = render('alpha');
  act(() => view.result.current.startCreate());
  act(() => view.result.current.cancelCreate());
  expect(view.result.current.selectedId).toBe('alpha');
  expect(view.result.current.ghost).toBeNull();
});
