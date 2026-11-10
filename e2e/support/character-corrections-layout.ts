import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { savePrivate } from './process';
import {
  expectControlsReachable,
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';

// Correct officers and Correct roster at phone and desktop sizes (#141 §6
// item 7); the journey itself runs them at the tablet size. With each
// correction open: no horizontal overflow, and every control of the edited
// section, its save point and its reason bar is reachable (inside the
// viewport, page content above the phone bottom bar). On the phone the
// reason bar sits in the strip above the tabs, which with the tabs takes at
// most a third of the screen; from 768px it is in the save point. Officers
// also opens the Assign picker (an inline panel on the phone, a floating
// dialog from 1280px) and a holder's ⋯ menu with its Move to list. Both
// corrections are cancelled, so nothing changes.

/** On the roster, holding `role`; `vacant` is a role nobody holds. */
type Holder = { name: string; role: string; vacant: string };

const sizes = [
  ['phone', 390, 844],
  ['desktop', 1440, 900],
] as const;
type Size = (typeof sizes)[number][0];

// The one reason bar: in the phone strip, or inside the sticky save point.
async function expectReasonBar(page: Page, size: Size, savePoint: Locator) {
  const bar = page.locator('[data-reason-bar]');
  await expect(bar).toHaveCount(1);
  await expect(bar).toBeVisible();
  if (size === 'phone') {
    const strip = page.locator('[data-shell-slot="phone-status-strip"]');
    await expect(strip.locator('[data-reason-bar]')).toHaveCount(1);
    // The pinned strip and tabs leave at least two thirds of the screen to
    // the page (#198: they took 38% when the reason bar stacked every row).
    const pinned = (await strip.locator('..').boundingBox())!;
    const { height } = page.viewportSize()!;
    expect(
      pinned.height,
      'the pinned reason bar and tabs leave room for the page',
    ).toBeLessThanOrEqual(height / 3);
  } else await expect(savePoint.locator('[data-reason-bar]')).toHaveCount(1);
  await expectControlsReachable(page, bar, `${size} reason bar`);
  return bar;
}

async function expectInsideViewport(page: Page, box: Locator, what: string) {
  const bounds = (await box.boundingBox())!;
  const { width } = page.viewportSize()!;
  expect(bounds.x, `${what} starts inside the viewport`).toBeGreaterThanOrEqual(
    -1,
  );
  expect(
    bounds.x + bounds.width,
    `${what} ends inside the viewport`,
  ).toBeLessThanOrEqual(width + 1);
}

async function screenshot(
  page: Page,
  artifactDirectory: string,
  project: string,
  name: string,
) {
  await savePrivate(
    join(artifactDirectory, `character-correction-${project}-${name}.png`),
    await page.screenshot({ fullPage: true }),
  );
}

async function reviewOfficers(
  page: Page,
  size: Size,
  holder: Holder,
  shot: (name: string) => Promise<void>,
) {
  await page
    .getByRole('button', { name: 'Correct officers', exact: true })
    .click();
  const savePoint = page.getByRole('region', {
    name: 'Correct officers',
    exact: true,
  });
  await expect(savePoint).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const officers = page.getByRole('region', { name: 'Officers', exact: true });
  // On the phone the save point sits under the board, its reason bar in
  // the strip; from 768px the sticky save point holds the reason bar.
  await expectControlsReachable(page, officers, `${size} officer board`);
  const bar = await expectReasonBar(page, size, savePoint);
  if (size === 'desktop')
    await expectControlsReachable(page, savePoint, `${size} save point`);

  // The Assign picker for a vacant role, which offers the holder: Assign
  // lists everyone on the roster not already holding that role.
  const assign = officers.getByRole('button', {
    name: `Assign ${holder.vacant}`,
    exact: true,
  });
  await assign.click();
  const picker =
    size === 'phone'
      ? officers.getByRole('region', {
          name: `Assign ${holder.vacant}`,
          exact: true,
        })
      : page.getByRole('dialog', {
          name: `Assign ${holder.vacant}`,
          exact: true,
        });
  await expect(picker).toBeVisible();
  await expect(
    picker.getByRole('heading', { name: `Assign ${holder.vacant}` }),
  ).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await expectInsideViewport(page, picker, `${size} Assign picker`);
  await expect(
    picker.getByRole('button', { name: new RegExp(`^${holder.name}`) }),
  ).toBeVisible();
  await expectControlsReachable(page, picker, `${size} Assign picker`);
  await shot(`assign-${size}`);
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(assign).toBeFocused();

  // The holder's ⋯ menu, then its Move to list.
  const options = officers.getByRole('button', {
    name: `Options for ${holder.name}`,
    exact: true,
  });
  await expectReachable(page, options);
  await options.click();
  await expect(options).toHaveAttribute('aria-expanded', 'true');
  const moveTo = officers.getByRole('button', {
    name: 'Move to…',
    exact: true,
  });
  await expect(moveTo).toBeFocused();
  for (const item of [
    moveTo,
    officers.getByRole('button', {
      name: `Remove ${holder.name} as ${holder.role}`,
      exact: true,
    }),
  ])
    await expectReachable(page, item);
  await moveTo.click();
  const targets = officers.getByRole('button', { name: /^Move to [^…]/ });
  await expect(targets.first()).toBeFocused();
  expect(await targets.count(), `${size} Move to targets`).toBeGreaterThan(0);
  for (const target of await targets.all()) {
    await expectInsideViewport(page, target, `${size} Move to target`);
    await expectReachable(page, target);
  }
  await expectNoHorizontalOverflow(page);
  await shot(`holder-menu-${size}`);
  await page.keyboard.press('Escape');
  await expect(options).toHaveAttribute('aria-expanded', 'false');
  await expect(options).toBeFocused();

  await shot(`officers-${size}`);
  await bar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(savePoint).toHaveCount(0);
  await expect(page.locator('[data-reason-bar]')).toHaveCount(0);
}

async function reviewRoster(
  page: Page,
  size: Size,
  holder: { name: string },
  shot: (name: string) => Promise<void>,
) {
  await page
    .getByRole('button', { name: 'Correct roster', exact: true })
    .click();
  const savePoint = page.getByRole('region', {
    name: 'Correct roster',
    exact: true,
  });
  await expect(savePoint).toBeVisible();
  await expect(
    page.getByRole('switch', { name: `${holder.name} on roster`, exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const characters = page.getByRole('region', {
    name: 'Characters',
    exact: true,
  });
  await expectControlsReachable(page, characters, `${size} roster rows`);
  const bar = await expectReasonBar(page, size, savePoint);
  if (size === 'desktop')
    await expectControlsReachable(page, savePoint, `${size} save point`);
  await shot(`roster-${size}`);
  await bar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(savePoint).toHaveCount(0);
  await expect(page.locator('[data-reason-bar]')).toHaveCount(0);
}

/**
 * On Characters & officers, with `holder` on the roster and holding its
 * role.
 * Returns to the project's size.
 */
export async function reviewCharacterCorrectionLayouts(
  page: Page,
  holder: Holder,
  artifactDirectory: string,
  project: string,
) {
  const original = page.viewportSize()!;
  try {
    for (const [size, width, height] of sizes) {
      await page.setViewportSize({ width, height });
      const shot = (name: string) =>
        screenshot(page, artifactDirectory, project, name);
      await reviewOfficers(page, size, holder, shot);
      await reviewRoster(page, size, holder, shot);
    }
  } finally {
    await page.setViewportSize(original);
  }
}
