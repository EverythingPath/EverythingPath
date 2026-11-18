import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import RouteLoading from '~/app/campaigns/(list)/loading';
import { CampaignHomeSkeleton } from './campaign-home-status';

const campaigns = join(process.cwd(), 'src/app/campaigns');
// Every route folder under `dir`, relative to the campaigns route.
function pagesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pagesUnder(path);
    return entry.name === 'page.tsx' ? [relative(campaigns, dir)] : [];
  });
}

test('[STATE-02.route-loading] the list and home route fallback is the list/home-shaped skeleton with Loading campaigns… for screen readers', () => {
  const home = render(<CampaignHomeSkeleton />).container.innerHTML;
  cleanup();
  const { container } = render(<RouteLoading />);
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Loading campaigns…');
  expect(status).toHaveClass('sr-only');
  // Index rows beside the pane, exactly as the home screen shows while it
  // resolves, so nothing jumps when the route has loaded.
  expect(container.innerHTML).toContain(home);
  expect(
    container.querySelectorAll('[aria-hidden="true"] [data-slot="skeleton"]')
      .length,
  ).toBeGreaterThanOrEqual(3);
});

test('[STATE-02.route-loading-scope] only the list and home routes sit under the list skeleton; campaign section pages keep their own shell and loading', () => {
  // A loading.tsx wraps every route below its folder, so no fallback may
  // sit above the campaign section pages.
  expect(existsSync(join(campaigns, 'loading.tsx'))).toBe(false);
  expect(existsSync(join(campaigns, '[campaignId]/loading.tsx'))).toBe(false);
  expect(pagesUnder(join(campaigns, '(list)')).sort()).toEqual([
    '(list)/(home)',
    '(list)/(home)/[campaignId]',
  ]);
  expect(pagesUnder(join(campaigns, '[campaignId]')).length).toBeGreaterThan(0);
});
