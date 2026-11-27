import {
  expect,
  type Page,
  type Request,
  type Response,
  type Route,
} from '@playwright/test';
import { expectSelectedCampaign, openCampaignSection } from './interactions';
import {
  exercisePhoneShell,
  exerciseTopBarShell,
  expectBoundedWeekHost,
  expectSectionScrollHost,
  expectNoHorizontalOverflow,
  expectReachable,
  expectTopBarOneRow,
} from './responsive-shell';

// The access journey's shell checks, split into parts that each start where
// access left its members: on Week 1 · Event, opened from the campaign list
// with Continue week (`openWeekFromList`). Every part reads the campaign's
// address from that week page, as the single journey did.
function campaignAddress(page: Page) {
  const week = new URL(page.url());
  const campaignPath = week.pathname.replace(/\/week$/, '');
  const campaignId = campaignPath.split('/').at(-1)!;
  return { week, campaignPath, campaignId };
}

/** A member opens the campaign from the list, as every access part starts. */
export async function openWeekFromList(page: Page) {
  await page.goto('/campaigns');
  // Continue week opens the first unready phase: the first week skips
  // Upkeep and Activity has nothing required, so Event (#189).
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Event' }),
  ).toBeVisible();
}

const destinations = [
  // The phone bottom bar's tab, then the top bar's link from 768px.
  {
    size: { width: 390, height: 844 },
    section: 'officers',
    name: 'Characters & officers',
    loading: 'Loading characters…',
  },
  {
    size: { width: 1194, height: 834 },
    section: 'militia',
    name: 'Militia',
    loading: 'Loading militia ledger…',
  },
] as const;

/**
 * A section link moves at once (#198): with the destination's own page held
 * on the server, the address, the active link and the destination's
 * skeleton appear inside the kept shell; the page follows once released.
 * Each size starts from a fresh load of the week and waits until the link's
 * prefetch has settled, as a player's has before a tap. Ends on the week.
 */
export async function exerciseImmediateSectionNavigation(page: Page) {
  const { week, campaignPath } = campaignAddress(page);
  const original = page.viewportSize()!;
  for (const { size, section, name, loading } of destinations) {
    const destination = `${campaignPath}/${section}`;
    const isFlight = (request: Request) =>
      new URL(request.url()).pathname === destination &&
      request.headers().rsc === '1';
    const isPrefetch = (request: Request) =>
      isFlight(request) && request.headers()['next-router-prefetch'] === '1';
    // The router may cancel a prefetch body once it has read what it needs
    // (the browser reports that as aborted), so a prefetch counts as settled
    // when its answer arrived and the request ended either way.
    const pending = new Set<Request>();
    const answered = new Set<Request>();
    let settled = 0;
    let lastChange = Date.now();
    const onRequest = (request: Request) => {
      if (!isPrefetch(request)) return;
      pending.add(request);
      lastChange = Date.now();
    };
    const onResponse = (response: Response) => {
      if (isPrefetch(response.request()) && response.ok())
        answered.add(response.request());
    };
    const onEnded = (request: Request) => {
      if (!pending.delete(request)) return;
      if (answered.has(request)) settled += 1;
      lastChange = Date.now();
    };
    const matches = (url: URL) => url.pathname === destination;
    const held: Route[] = [];
    const hold = (route: Route) => {
      if (!isFlight(route.request()) || isPrefetch(route.request()))
        return route.fallback();
      held.push(route);
    };
    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('requestfinished', onEnded);
    page.on('requestfailed', onEnded);
    await page.route(matches, hold);
    try {
      await page.setViewportSize(size);
      await page.goto(week.href);
      await expect(
        page.getByRole('heading', { name: 'Week 1 · Event' }),
      ).toBeVisible();
      const link = page
        .locator(
          'nav[aria-label="Militia pages"]:visible, nav[aria-label="Pages"]:visible',
        )
        .getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      await expect
        .poll(
          () =>
            settled > 0 && pending.size === 0 && Date.now() - lastChange > 500,
          `${section} is prefetched`,
        )
        .toBe(true);
      await link.click();
      await expect
        .poll(() => held.length, `${section}'s page is requested`)
        .toBeGreaterThan(0);
      await expect(page).toHaveURL(`${week.origin}${destination}`);
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('status', { name: loading })).toBeVisible();
      await expect(page.locator('header')).toBeVisible();
      expect(held.length, `${section}'s page is still held`).toBeGreaterThan(0);
    } finally {
      // Release the held page before unrouting, which would otherwise hand
      // it on by itself.
      for (const route of held) await route.continue();
      await page.unroute(matches, hold);
      page.off('request', onRequest);
      page.off('response', onResponse);
      page.off('requestfinished', onEnded);
      page.off('requestfailed', onEnded);
    }
    await expect(
      section === 'officers'
        ? page.getByRole('region', { name: 'Characters', exact: true })
        : page.getByRole('button', { name: 'Correct values', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('status', { name: loading })).toHaveCount(0);
    // Tablet landscape keeps the slim one-row top bar on a section page.
    if (size.width >= 768) await expectTopBarOneRow(page);
  }
  await page.setViewportSize(original);
  await page.goto(week.href);
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Event' }),
  ).toBeVisible();
}

/** Section links at every shell width, Back/Forward and reload. */
export async function exerciseSectionNavigation(page: Page) {
  const { week, campaignPath } = campaignAddress(page);

  await openCampaignSection(page, 'officers');
  await expect(
    page.getByRole('region', { name: 'Characters', exact: true }),
  ).toBeVisible();
  // Phone portrait, a short phone-landscape viewport below the 768px
  // breakpoint, and a short viewport at tablet width with the top-bar
  // layout; then back to this project's size.
  const original = page.viewportSize()!;
  try {
    for (const size of [
      { width: 390, height: 844 },
      { width: 740, height: 360 },
    ]) {
      await page.setViewportSize(size);
      await exercisePhoneShell(page);
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await exerciseTopBarShell(page);
  } finally {
    await page.setViewportSize(original);
  }
  await expectNoHorizontalOverflow(page);
  await openCampaignSection(page, 'militia');
  await expect(
    page.getByRole('button', { name: 'Correct values', exact: true }),
  ).toBeVisible();
  // Militia pages use the rail host from tablet and the document on phone.
  await expectSectionScrollHost(page);
  await expectReachable(
    page,
    page.getByRole('button', { name: 'Correct values', exact: true }),
  );
  await page.goBack();
  await expect(page).toHaveURL(`${week.origin}${campaignPath}/officers`);
  await page.goForward();
  await expect(page).toHaveURL(`${week.origin}${campaignPath}/militia`);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Correct values', exact: true }),
  ).toBeVisible();
  await openCampaignSection(page, 'officers');
  await page.setViewportSize({ width: 390, height: 844 });
  const tabs = page.getByRole('navigation', { name: 'Areas', exact: true });
  await tabs.getByRole('link', { name: 'Characters', exact: true }).click();
  await expect(page).toHaveURL(`${week.origin}/characters`);
  await page.reload();
  await tabs.getByRole('link', { name: 'Militia', exact: true }).click();
  await expect(page).toHaveURL(`${week.origin}${campaignPath}/officers`);
  await page.setViewportSize(original);
  await openCampaignSection(page, 'militia');
}

/** The outsider sees none of the member campaign on any of its sections. */
export async function expectOutsiderShutOut(
  page: Page,
  outsider: Page,
  campaignName: string,
) {
  const { campaignPath } = campaignAddress(page);

  for (const section of [
    'week',
    'history',
    'militia',
    'characters',
    'officers',
    'setup',
  ]) {
    await outsider.goto(`${campaignPath}/${section}`);
    await expect(
      outsider.getByText("This campaign isn't available", { exact: false }),
    ).toBeVisible();
    await expect(outsider.getByRole('heading', { name: /Week 1/ })).toHaveCount(
      0,
    );
    await expect(
      outsider.getByRole('region', { name: 'Characters', exact: true }),
    ).toHaveCount(0);
    await expect(outsider.getByText(campaignName, { exact: true })).toHaveCount(
      0,
    );
  }
}

/** An unknown campaign stays unavailable; the app's entry opens the list. */
export async function exerciseUnknownCampaignAndEntry(
  page: Page,
  campaignName: string,
) {
  const { week } = campaignAddress(page);

  await page.goto('/campaigns/not-a-campaign/week');
  await expect(
    page.getByText("This campaign isn't available", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/campaigns\/not-a-campaign\/week/);

  await page.goto('/');
  await expect(page).toHaveURL(`${week.origin}/campaigns`);
  await expectSelectedCampaign(page, campaignName);
}

/** Week links open their phase; the week host stays bounded. */
export async function exerciseWeekLinks(page: Page) {
  const { week, campaignPath } = campaignAddress(page);
  const original = page.viewportSize()!;

  // An unknown phase opens Upkeep.
  for (const phase of ['upkeep', 'activity', 'event', 'summary', 'invalid']) {
    await page.goto(`${campaignPath}/week?phase=${phase}`);
    const title =
      phase === 'invalid'
        ? 'Upkeep'
        : phase === 'summary'
          ? 'Review & confirm'
          : `${phase[0]!.toUpperCase()}${phase.slice(1)}`;
    await expect(
      page.getByRole('heading', { name: `Week 1 · ${title}`, exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep', exact: true }),
  ).toBeVisible();
  await page.goto(campaignPath);
  await expect(page).toHaveURL(`${week.origin}${campaignPath}`);
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toHaveCount(0);
  // Continue week opens the first week's first unready phase, Event.
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Event', exact: true }),
  ).toBeVisible();
  // The week host is bounded after a non-week visit at every width, with
  // its editor scrolling inside and the frame chrome pinned, including on
  // a short tablet-width viewport where the top bar wraps.
  await expectBoundedWeekHost(page);
  try {
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Event', exact: true }),
    ).toBeVisible();
    await expectBoundedWeekHost(page);
  } finally {
    await page.setViewportSize(original);
  }
}
