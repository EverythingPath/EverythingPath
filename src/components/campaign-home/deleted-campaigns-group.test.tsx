import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import {
  DeletedCampaignsGroup,
  type CampaignDeletionRow,
} from './deleted-campaigns-group';

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

const row = (
  campaignId: string,
  campaignName: string,
  patch: Partial<CampaignDeletionRow> = {},
): CampaignDeletionRow => ({
  campaignId: campaignId as Id<'campaign'>,
  campaignName,
  state: 'deleted',
  remaining: 0,
  setAside: 0,
  blockers: null,
  deletedAt: Date.UTC(2026, 9, 5, 12),
  hasHistory: true,
  ...patch,
});

test('a longer list says there are more and loads the next page on request', () => {
  const loadMore = vi.fn();
  render(
    <DeletedCampaignsGroup
      rows={[row('old', 'Old Table')]}
      canLoadMore
      loadMore={loadMore}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Deleted campaigns (1+)' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
  expect(loadMore).toHaveBeenCalledTimes(1);
});

test('the group opens on request and each row says when, with its finished weeks when kept', () => {
  render(
    <DeletedCampaignsGroup
      rows={[
        row('old', 'Old Table'),
        row('bare', 'Bare Table', { hasHistory: false, deletedAt: null }),
      ]}
    />,
  );
  const toggle = screen.getByRole('button', { name: 'Deleted campaigns (2)' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('list')).toBeNull();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const [old, bare] = within(
    screen.getByRole('list', { name: 'Deleted campaigns' }),
  ).getAllByRole('listitem');
  expect(old).toHaveTextContent('Old Table');
  expect(within(old!).getByText(/^Deleted/)).toBeVisible();
  expect(old!.querySelector('time')).toHaveAttribute(
    'dateTime',
    '2026-10-05T12:00:00.000Z',
  );
  expect(
    within(old!).getByRole('link', { name: 'Finished weeks' }),
  ).toHaveAttribute('href', '/campaigns/old/history');
  expect(bare).toHaveTextContent('Bare Table');
  expect(within(bare!).getByText('No finished weeks')).toBeVisible();
  expect(within(bare!).queryByRole('link')).toBeNull();
  fireEvent.click(toggle);
  expect(screen.queryByRole('list')).toBeNull();
});
