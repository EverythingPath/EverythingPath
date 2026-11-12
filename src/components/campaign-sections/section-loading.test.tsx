import { cleanup, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { ComponentType } from 'react';
import WeekLoading from '~/app/campaigns/[campaignId]/week/loading';
import HistoryLoading from '~/app/campaigns/[campaignId]/history/loading';
import MilitiaLoading from '~/app/campaigns/[campaignId]/militia/loading';
import CharactersLoading from '~/app/campaigns/[campaignId]/characters/loading';
import OfficersLoading from '~/app/campaigns/[campaignId]/officers/loading';
import SetupLoading from '~/app/campaigns/[campaignId]/setup/loading';

// Every campaign section has a route fallback, so a section link moves at
// once and shows the destination's own skeleton while its page arrives
// (#198). The fallback fills only the page area: the campaign shell around
// it (top bar, section links, phone bottom bar) stays mounted.
const sections: [string, ComponentType, RegExp][] = [
  ['week', WeekLoading, /^Loading the week…$/],
  ['history', HistoryLoading, /^Loading history…$/],
  ['militia', MilitiaLoading, /^Loading militia ledger…$/],
  ['characters', CharactersLoading, /^Loading characters$/],
  ['officers', OfficersLoading, /^Loading characters…$/],
  ['setup', SetupLoading, /^Loading militia setup…$/],
];

test.each(sections)(
  'the %s section shows its skeleton inside the kept shell',
  (_, Loading, status) => {
    const { container } = render(<Loading />);
    // One announcement, named by its label or its (visually hidden) text.
    const [announcement, ...others] = screen.getAllByRole('status');
    expect(others).toHaveLength(0);
    expect(
      announcement!.getAttribute('aria-label') ??
        announcement!.textContent?.trim(),
    ).toMatch(status);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(container.querySelector('header')).toBeNull();
  },
);

test('the section skeletons keep the headings their pages show', () => {
  render(<MilitiaLoading />);
  expect(screen.getByRole('heading', { name: 'Militia' })).toBeVisible();
  cleanup();
  render(<SetupLoading />);
  expect(screen.getByRole('heading', { name: 'Set up militia' })).toBeVisible();
  cleanup();
  render(<CharactersLoading />);
  expect(screen.getByRole('heading', { name: 'Characters' })).toBeVisible();
  cleanup();
  render(<OfficersLoading />);
  expect(
    screen.getByRole('heading', { name: 'Characters & officers' }),
  ).toBeInTheDocument();
});
