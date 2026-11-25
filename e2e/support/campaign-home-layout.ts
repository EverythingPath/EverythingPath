import { convexWebSocketOrigin } from '../../src/lib/local-convex-url';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { campaignRows, expectSelectedCampaign } from './interactions';
import { savePrivate } from './process';
import {
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';

// Campaign list/home layout (#147 §8 bullet 4): the home, its header editor
// and the create form at phone, tablet and desktop sizes, with screenshots,
// and the list skeleton while the campaigns are still loading. The form is
// only opened and cancelled: the fixtures cannot clean up created campaigns.

const sizes = [
  ['phone', 390, 844],
  ['tablet', 1194, 834],
  ['desktop', 1440, 900],
] as const;

async function expectAllReachable(page: Page, controls: Locator[]) {
  for (const control of controls) await expectReachable(page, control);
}

/** Starts and ends on the selected campaign's home at the project size. */
export async function reviewCampaignHomeLayout(
  page: Page,
  campaignName: string,
  artifactDirectory: string,
  project: string,
) {
  const home = page.getByRole('region', { name: campaignName, exact: true });
  const row = campaignRows(page)
    .getByRole('link')
    .filter({ hasText: campaignName });
  const newCampaign = page.getByRole('button', { name: 'New campaign' });
  const edit = page.getByRole('button', { name: 'Edit campaign details' });
  const button = (name: string) =>
    page.getByRole('button', { name, exact: true });
  const textbox = (name: string) =>
    page.getByRole('textbox', { name, exact: true });
  const shot = async (name: string) =>
    savePrivate(
      join(artifactDirectory, `campaign-home-${project}-${name}.png`),
      await page.screenshot({ fullPage: true }),
    );
  const original = page.viewportSize()!;
  try {
    for (const [size, width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await expectSelectedCampaign(page, campaignName);
      await expect(home).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const [rowBox, homeBox] = await Promise.all(
        [row, home].map((locator) => locator.boundingBox()),
      );
      if (width < 768)
        // Phone: the selected row is the expanded one, its home below it.
        expect(
          homeBox!.y,
          `${size}: home below its row`,
        ).toBeGreaterThanOrEqual(rowBox!.y + rowBox!.height - 1);
      else
        expect(
          rowBox!.x + rowBox!.width,
          `${size}: the list sits left of the home`,
        ).toBeLessThanOrEqual(homeBox!.x + 1);
      await expectAllReachable(page, [
        newCampaign,
        row,
        home.getByRole('link', { name: 'Continue week 1', exact: true }),
        edit,
        home.getByRole('link', { name: 'All finished weeks', exact: true }),
      ]);
      await shot(size);

      // The header editor: description, in-game date, Save and Cancel.
      await edit.click();
      await expect(textbox('Description')).toBeFocused();
      await expectNoHorizontalOverflow(page);
      await expectAllReachable(page, [
        textbox('Description'),
        button('In-game date'),
        button('Save'),
        button('Cancel'),
      ]);
      await shot(`${size}-edit`);
      await button('Cancel').click();
      await expect(textbox('Description')).toHaveCount(0);

      // The create form in the pane, the name focused.
      await newCampaign.click();
      await expect(textbox('Campaign name')).toBeFocused();
      await expectNoHorizontalOverflow(page);
      await expectAllReachable(page, [
        textbox('Campaign name'),
        textbox('Description'),
        button('Create'),
        button('Cancel'),
      ]);
      await shot(`${size}-create`);
      await button('Cancel').click();
      await expect(textbox('Campaign name')).toHaveCount(0);
    }
  } finally {
    await page.setViewportSize(original);
  }
  await expectSelectedCampaign(page, campaignName);
}

/**
 * While no Convex response arrives, the list shows its skeleton: the same
 * shape as the list and home, announced as loading. A fresh page in the
 * member's context is held until the skeleton is recorded.
 */
export async function reviewListSkeleton(
  page: Page,
  convexUrl: string,
  campaignName: string,
  artifactDirectory: string,
  project: string,
) {
  const origin = convexWebSocketOrigin(convexUrl);
  let held: (() => void)[] | null = [];
  // Timing only: every frame is delivered unchanged once released.
  await page.routeWebSocket(
    (url) => url.origin === origin,
    (socket) => {
      const server = socket.connectToServer();
      socket.onMessage((frame) => server.send(frame));
      server.onMessage((frame) => {
        if (held) held.push(() => socket.send(frame));
        else socket.send(frame);
      });
    },
  );
  const release = () => {
    const queued = held ?? [];
    held = null;
    for (const send of queued) send();
  };
  try {
    await page.goto('/campaigns');
    await expect(
      page.getByRole('status').filter({ hasText: 'Loading campaigns…' }),
    ).toHaveCount(1);
    await expect(campaignRows(page)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await savePrivate(
      join(artifactDirectory, `campaign-home-${project}-skeleton.png`),
      await page.screenshot({ fullPage: true }),
    );
  } finally {
    release();
  }
  await expectSelectedCampaign(page, campaignName);
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading campaigns…' }),
  ).toHaveCount(0);
}
