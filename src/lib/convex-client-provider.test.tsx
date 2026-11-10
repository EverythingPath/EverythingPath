import { act, render, waitFor } from '@testing-library/react';
import { ConvexReactClient } from 'convex/react';
import { StrictMode } from 'react';
import { expect, test, vi } from 'vitest';
import { ConvexClientProvider } from '../../ConvexClientProvider';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';

const auth = vi.hoisted(() => {
  vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://unused.convex.cloud');
  return { isLoaded: false, isSignedIn: false, getToken: async () => 'token' };
});
vi.mock('@clerk/nextjs', () => ({ useAuth: () => auth }));

function Notice() {
  const notice = useInitialMigrationMaintenance();
  return <output>{notice.kind}</output>;
}

test('loaded signed-out visitors receive maintenance status once and keep their epoch through sign-in', async () => {
  let epoch = 8;
  let update: () => void = () => undefined;
  const setAuth = vi
    .spyOn(ConvexReactClient.prototype, 'setAuth')
    .mockImplementation((_fetchToken, onChange) => onChange?.(true));
  const clearAuth = vi
    .spyOn(ConvexReactClient.prototype, 'clearAuth')
    .mockImplementation(() => undefined);
  const watch = vi
    .spyOn(ConvexReactClient.prototype, 'watchQuery')
    .mockReturnValue({
      localQueryResult: () => ({ status: 'ready', epoch }),
      journal: () => undefined,
      onUpdate: (listener) => {
        update = listener;
        return () => undefined;
      },
    });
  const app = () => (
    <StrictMode>
      <ConvexClientProvider>
        <Notice />
      </ConvexClientProvider>
    </StrictMode>
  );
  const view = render(app());
  try {
    expect(view.getByText('loading')).toBeInTheDocument();
    expect(watch).not.toHaveBeenCalled();
    auth.isLoaded = true;
    view.rerender(app());
    await waitFor(() => expect(view.getByText('ready')).toBeInTheDocument());
    view.rerender(app());
    expect(watch).toHaveBeenCalledTimes(1);
    expect(setAuth).not.toHaveBeenCalled();
    auth.isSignedIn = true;
    view.rerender(app());
    await waitFor(() => expect(setAuth).toHaveBeenCalled());
    act(() => {
      epoch = 9;
      update();
    });
    expect(view.getByText('reload_required')).toBeInTheDocument();
    auth.isSignedIn = false;
    view.rerender(app());
    expect(watch).toHaveBeenCalledTimes(1);
    expect(view.getByText('reload_required')).toBeInTheDocument();
  } finally {
    view.unmount();
    setAuth.mockRestore();
    clearAuth.mockRestore();
    watch.mockRestore();
    vi.unstubAllEnvs();
  }
});
