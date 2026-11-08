import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Doc } from '@convex/_generated/dataModel';
import { CampaignHomeContent } from './campaign-home-content';
import type { CampaignHomeContentState } from './use-campaign-home-content';

const content = vi.fn<() => CampaignHomeContentState>();
vi.mock('./use-campaign-home-content', () => ({
  useCampaignHomeContent: () => content(),
}));
// No deletion was requested; campaign-deletion.test.tsx covers the rest.
vi.mock('./use-campaign-deletion', () => ({
  useCampaignDeletion: () => ({
    deletion: null,
    status: { kind: 'idle' },
    submit: () => Promise.resolve(false),
    isUnderWay: false,
    isDeleted: false,
  }),
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const campaign = {
  _id: 'ironfang',
  _creationTime: 0,
  name: 'Ironfang Invasion',
  ownerId: 'gm',
  organizationId: 'org',
  description: '',
} as Doc<'campaign'>;
const retry = vi.fn();
const militia = (
  patch: Partial<Extract<CampaignHomeContentState, { kind: 'militia' }>> = {},
): CampaignHomeContentState => ({
  kind: 'militia',
  summary: ['Rank 3', 'Secrecy', '4 teams (1 disabled, 1 missing)'],
  continueWeek: {
    kind: 'ready',
    week: 14,
    phase: 'event',
    href: '/campaigns/ironfang/week?phase=event',
  },
  recent: {
    kind: 'ready',
    weeks: [
      {
        week: 13,
        href: '/campaigns/ironfang/history?week=13',
        badge: 'Corrected',
        headlines: ['Treasury +145 gp', 'Training −3'],
      },
      {
        week: 11,
        href: '/campaigns/ironfang/history?week=11',
        badge: 'From setup',
        headlines: ['Recorded outcome available'],
      },
    ],
  },
  ...patch,
});
function show(state: CampaignHomeContentState) {
  content.mockReturnValue(state);
  render(<CampaignHomeContent campaign={campaign} />);
}
const hrefs = () =>
  screen.getAllByRole('link').map((link) => link.getAttribute('href'));

afterEach(() => {
  retry.mockClear();
});

test('without a militia the home offers only Set up militia and Characters', () => {
  show({ kind: 'no_militia' });
  expect(hrefs()).toEqual([
    '/campaigns/ironfang/setup',
    '/campaigns/ironfang/characters',
  ]);
  expect(screen.getByRole('link', { name: 'Set up militia' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Characters' })).toBeVisible();
  expect(screen.queryByText(/Continue week|Recent finished weeks/)).toBeNull();
});

test('loading is never the no-militia home', () => {
  show({ kind: 'loading' });
  expect(screen.getByRole('status')).toHaveTextContent('Loading militia…');
  expect(screen.queryByRole('link', { name: 'Set up militia' })).toBeNull();
});

test('a militia failure retries locally and keeps Characters & officers', () => {
  show({ kind: 'failed', retry });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(hrefs()).toEqual(['/campaigns/ironfang/officers']);
});

test('the militia home links each destination once, keeping the campaign', () => {
  show(militia());
  expect(
    screen.getByRole('link', { name: 'Continue week 14' }),
  ).toHaveAttribute('href', '/campaigns/ironfang/week?phase=event');
  expect(screen.getByRole('region', { name: 'Militia' })).toHaveTextContent(
    'Rank 3 · Secrecy · 4 teams (1 disabled, 1 missing)',
  );
  expect(hrefs()).toEqual([
    '/campaigns/ironfang/week?phase=event',
    '/campaigns/ironfang/militia',
    '/campaigns/ironfang/history?week=13',
    '/campaigns/ironfang/history?week=11',
    '/campaigns/ironfang/history',
    '/campaigns/ironfang/officers',
  ]);
  expect(screen.queryByText(/next up|continues at/i)).toBeNull();
});

test('recent weeks show latest first with provenance and compact headlines', () => {
  show(militia());
  const [latest, older] = screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.includes('?week='));
  expect(latest).toHaveTextContent('Week 13');
  expect(latest).toHaveTextContent('Corrected');
  expect(latest).toHaveTextContent('Treasury +145 gp · Training −3');
  expect(older).toHaveTextContent('From setup');
  expect(older).toHaveTextContent('Recorded outcome available');
});

test('no finished weeks keeps All finished weeks reachable', () => {
  show(militia({ recent: { kind: 'ready', weeks: [] } }));
  expect(screen.getByText('No finished weeks yet.')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'All finished weeks' }),
  ).toHaveAttribute('href', '/campaigns/ironfang/history');
});

test('a finished-weeks failure stays local and does not block Continue', () => {
  show(militia({ recent: { kind: 'failed', retry } }));
  expect(screen.getByText('Finished weeks could not be loaded.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Continue week 14' })).toBeVisible();
  expect(
    screen.getByRole('link', { name: /Characters & officers/ }),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'All finished weeks' }),
  ).toBeVisible();
});

test('Continue offers no week link until its target is known', () => {
  show(militia({ continueWeek: { kind: 'loading', week: 14 } }));
  expect(
    screen.getByRole('button', { name: 'Continue week 14' }),
  ).toBeDisabled();
  expect(screen.queryByRole('link', { name: /Continue week/ })).toBeNull();
  cleanup();
  show(militia({ continueWeek: { kind: 'failed', week: 14, retry } }));
  expect(screen.getByText('The week could not be loaded.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
