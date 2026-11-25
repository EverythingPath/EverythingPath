import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useAppNavigation } from './use-app-navigation';

const campaigns = [
  { id: 'alpha', name: 'Ironfang', hasMilitia: true },
  { id: 'beta', name: 'Kingmaker', hasMilitia: true },
];
test('remembers campaign and militia page across shell remounts and isolates organization changes', () => {
  const first = renderHook(() =>
    useAppNavigation({
      pathname: '/campaigns/alpha/officers',
      campaigns,
      campaign: campaigns[0],
      organizationId: 'org',
    }),
  );
  first.unmount();
  const second = renderHook(
    ({ organizationId }) =>
      useAppNavigation({ pathname: '/characters', campaigns, organizationId }),
    { initialProps: { organizationId: 'org' } },
  );
  expect(second.result.current.phoneTabs[0]?.href).toBe('/campaigns/alpha');
  expect(second.result.current.phoneTabs[1]?.href).toBe(
    '/campaigns/alpha/officers',
  );
  act(() => second.rerender({ organizationId: 'other' }));
  expect(second.result.current.phoneTabs[0]?.href).toBe('/campaigns');
  expect(second.result.current.phoneTabs[1]?.href).toBeNull();
  act(() => second.rerender({ organizationId: 'org' }));
  expect(second.result.current.phoneTabs[1]?.href).toBe(
    '/campaigns/alpha/officers',
  );
});
