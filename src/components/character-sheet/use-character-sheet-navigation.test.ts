import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { beforeEach, expect, test, vi } from 'vitest';
import { useCharacterSheetNavigation } from './use-character-sheet-navigation';
import type { CharacterSheetSnapshot } from './use-character-sheet';

type NavigationSnapshot = Pick<CharacterSheetSnapshot, 'campaign'>;

const state = vi.hoisted(() => ({
  campaign: null as NavigationSnapshot['campaign'],
  organizationId: 'origin',
  params: 'from=%2Fcharacters&organizationId=origin',
  authenticated: true,
  readFailed: false,
  setActive: vi.fn(),
  push: vi.fn(),
  requestDeparture: vi.fn(),
  query: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const args = queryKey[2];
    state.query(args);
    return {
      data: { campaign: state.campaign },
      error: state.readFailed ? new Error('Character not found') : null,
    };
  },
}));
vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => ({
    organization: state.organizationId ? { id: state.organizationId } : null,
  }),
  useOrganizationList: () => ({ isLoaded: true, setActive: state.setActive }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(state.params),
  useRouter: () => ({ push: state.push }),
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  useNavigationGuard: () => ({ requestDeparture: state.requestDeparture }),
}));
beforeEach(() => {
  state.campaign = {
    campaignId: 'alpha' as Id<'campaign'>,
    campaignName: 'Ironfang',
    ownershipAvailable: true,
    organizationId: 'destination',
  };
  state.organizationId = 'origin';
  state.authenticated = true;
  state.readFailed = false;
  state.params = 'from=%2Fcharacters&organizationId=origin';
  state.setActive.mockReset().mockResolvedValue(undefined);
  state.push.mockReset();
  state.query.mockReset();
  state.requestDeparture.mockReset();
});

test('opens an independent sheet by authorized Character identity and selects its organization', async () => {
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  await act(() => Promise.resolve());
  expect(state.query).toHaveBeenCalledWith({ characterId: 'hero' });
  expect(state.setActive).toHaveBeenCalledWith({ organization: 'destination' });
  expect(view.result.current.organizationSwitch.kind).toBe('idle');
  view.rerender();
  expect(state.setActive).toHaveBeenCalledTimes(1);
});

test('reports a failed automatic organization change and retries without losing the origin', async () => {
  state.setActive.mockRejectedValueOnce(new Error('offline'));
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  await act(() => Promise.resolve());
  expect(view.result.current.organizationSwitch.kind).toBe('failed');
  expect(view.result.current.back.href).toBe('/characters');
  await act(async () => view.result.current.organizationSwitch.retry());
  expect(state.setActive).toHaveBeenCalledTimes(2);
  expect(view.result.current.organizationSwitch.kind).toBe('idle');
});

test('a manual organization change after opening the sheet does not leave an endless changing state', async () => {
  state.organizationId = 'destination';
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  state.organizationId = 'other';
  view.rerender();
  expect(view.result.current.organizationSwitch.kind).toBe('idle');
  expect(state.setActive).not.toHaveBeenCalled();
});

test('manually selecting the sheet organization resolves a failed automatic activation', async () => {
  state.setActive.mockRejectedValueOnce(new Error('offline'));
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  await act(() => Promise.resolve());
  expect(view.result.current.organizationSwitch.kind).toBe('failed');
  state.organizationId = 'destination';
  view.rerender();
  expect(view.result.current.organizationSwitch.kind).toBe('idle');
  state.organizationId = 'other';
  view.rerender();
  expect(view.result.current.organizationSwitch.kind).toBe('idle');
  expect(state.setActive).toHaveBeenCalledTimes(1);
});

test('a delayed activation failure cannot undo a completed manual organization selection', async () => {
  let failActivation: ((error: Error) => void) | undefined;
  state.setActive.mockImplementationOnce(
    () =>
      new Promise<void>((_, reject) => {
        failActivation = reject;
      }),
  );
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  state.organizationId = 'destination';
  view.rerender();
  await act(async () => failActivation?.(new Error('offline')));
  state.organizationId = 'other';
  view.rerender();
  expect(view.result.current.organizationSwitch.kind).toBe('idle');
  expect(state.setActive).toHaveBeenCalledTimes(1);
});

test('a delayed activation success preserves the effective organization selected manually for Back', async () => {
  let finishActivation: (() => void) | undefined;
  state.setActive.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishActivation = resolve;
      }),
  );
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  state.organizationId = 'destination';
  view.rerender();
  state.organizationId = 'other';
  state.params = 'from=%2Fcharacters&organizationId=other';
  view.rerender();
  await act(async () => finishActivation?.());
  act(() => view.result.current.navigateBack());
  await act(async () => state.requestDeparture.mock.calls[0]?.[0].commit());
  expect(state.setActive).toHaveBeenCalledTimes(1);
  expect(state.push).toHaveBeenCalledWith('/characters');
});

test('Back waits for guarded departure and restores the source organization before navigation', async () => {
  state.organizationId = 'destination';
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  act(() => view.result.current.navigateBack());
  expect(state.push).not.toHaveBeenCalled();
  expect(state.setActive).not.toHaveBeenCalled();
  await act(async () => state.requestDeparture.mock.calls[0]?.[0].commit());
  expect(state.setActive).toHaveBeenCalledWith({ organization: 'origin' });
  expect(state.push).toHaveBeenCalledWith('/characters');
});

test('Back preserves an origin organization already selected manually without activating it again', async () => {
  state.organizationId = 'destination';
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  state.organizationId = 'origin';
  view.rerender();
  act(() => view.result.current.navigateBack());
  await act(async () => state.requestDeparture.mock.calls[0]?.[0].commit());
  expect(state.setActive).not.toHaveBeenCalled();
  expect(state.push).toHaveBeenCalledWith('/characters');
});

test('Back restores the personal account after opening its owned campaign Character', async () => {
  state.organizationId = 'destination';
  state.params = 'from=%2Fcharacters&organizationId=';
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  act(() => view.result.current.navigateBack());
  await act(async () => state.requestDeparture.mock.calls[0]?.[0].commit());
  expect(state.setActive).toHaveBeenCalledWith({ organization: null });
  expect(state.push).toHaveBeenCalledWith('/characters');
});

test('a refused Back organization change leaves the sheet in place for guard retry', async () => {
  state.organizationId = 'destination';
  state.setActive.mockRejectedValueOnce(new Error('offline'));
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  act(() => view.result.current.navigateBack());
  await expect(
    state.requestDeparture.mock.calls[0]?.[0].commit(),
  ).rejects.toThrow('offline');
  expect(state.push).not.toHaveBeenCalled();
});

test('never reads a sheet or switches organizations before authentication', () => {
  state.authenticated = false;
  renderHook(() => useCharacterSheetNavigation('hero'));
  expect(state.query).toHaveBeenCalledWith('skip');
  expect(state.setActive).not.toHaveBeenCalled();
});

test('a failed sheet read ignores its cached campaign and keeps the origin available', () => {
  state.readFailed = true;
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  expect(view.result.current.campaign).toBeUndefined();
  expect(view.result.current.organizationSwitch.kind).toBe('idle');
  expect(view.result.current.back.href).toBe('/characters');
  expect(state.setActive).not.toHaveBeenCalled();
});

test('a failed organization change does not follow the player to a private sheet', async () => {
  state.setActive.mockRejectedValueOnce(new Error('offline'));
  const view = renderHook(({ id }) => useCharacterSheetNavigation(id), {
    initialProps: { id: 'hero' },
  });
  await act(() => Promise.resolve());
  expect(view.result.current.organizationSwitch.kind).toBe('failed');
  state.campaign = null;
  view.rerender({ id: 'private' });
  expect(view.result.current.organizationSwitch.kind).toBe('idle');
});

test('Back waits for an in-flight automatic activation before restoring its origin', async () => {
  let complete: (() => void) | undefined;
  state.setActive.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const view = renderHook(() => useCharacterSheetNavigation('hero'));
  act(() => view.result.current.navigateBack());
  const back = state.requestDeparture.mock.calls[0]?.[0].commit();
  await act(() => Promise.resolve());
  expect(state.push).not.toHaveBeenCalled();
  await act(async () => {
    complete?.();
    await back;
  });
  expect(state.setActive).toHaveBeenLastCalledWith({ organization: 'origin' });
  expect(state.push).toHaveBeenCalledWith('/characters');
});

test('a previous sheet activation cannot finish the current sheet organization change', async () => {
  let finishPrevious: (() => void) | undefined;
  let finishCurrent: (() => void) | undefined;
  state.setActive
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPrevious = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCurrent = resolve;
        }),
    );
  const view = renderHook(({ id }) => useCharacterSheetNavigation(id), {
    initialProps: { id: 'hero' },
  });
  state.campaign = {
    campaignId: 'beta' as Id<'campaign'>,
    campaignName: 'Kingmaker',
    ownershipAvailable: true,
    organizationId: 'other',
  };
  view.rerender({ id: 'second' });
  await act(async () => finishPrevious?.());
  expect(view.result.current.organizationSwitch.kind).toBe('switching');
  state.params = 'from=%2Fcharacters&organizationId=other';
  view.rerender({ id: 'second' });
  await act(async () => finishCurrent?.());
  act(() => view.result.current.navigateBack());
  await act(async () => state.requestDeparture.mock.calls[0]?.[0].commit());
  expect(state.setActive).toHaveBeenCalledTimes(2);
  expect(state.push).toHaveBeenCalledWith('/characters');
});
