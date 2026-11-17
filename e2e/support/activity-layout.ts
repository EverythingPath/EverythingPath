import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import type { z } from 'zod';
import type { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { confirmationInspectionSchema } from '../../src/lib/weekly-confirmation-contract';
import {
  canonicalPersistenceFixtureCall,
  savePrivate,
  type Run,
} from './process';
import {
  expectBoundedWeekHost,
  expectControlsReachable,
  expectNoHorizontalOverflow,
  settleAnimations,
} from './responsive-shell';
import type { controlTransport } from './transport';
import {
  confirmedWeekNotice,
  expectConfirmedWeek,
  reviewConfirm,
  saveState,
} from './week-frame';
import type { FixtureScope } from '../fixtures/catalog';

// The Activity checks #142 §6 names beyond the tablet journey, on the plain
// Upkeep fixture: week 4, rank 2 (two actions) with slots 1–2 inside the
// allowance, an empty extra slot 3, no teams, and a PC officer of level 2
// that caps the rank at 2. Upkeep is settled first (a natural 20 and a
// training roll of 1), so the allowance follows the corrected rank and
// training exactly.

type DraftKey = z.infer<typeof draftKeySchema>;
type Transport = Awaited<ReturnType<typeof controlTransport>>;

const slot = (page: Page, position: number) =>
  page.getByRole('group', { name: `Action Slot ${position}`, exact: true });
const card = (page: Page, position: number, action: string) =>
  page.getByRole('button', {
    name: `Action Slot ${position} · ${action}`,
    exact: true,
  });
const empty = (page: Page, position: number) =>
  page.getByRole('button', {
    name: `Choose an action for Action Slot ${position}`,
    exact: true,
  });
const details = (page: Page, position: number) =>
  page.getByRole('region', {
    name: `Action Slot ${position} details`,
    exact: true,
  });
const allowance = (page: Page, text: string) =>
  page
    .getByRole('region', { name: 'Activity choices', exact: true })
    .getByText(text, { exact: true });
const saved = (page: Page) =>
  expect(saveState(page)).toHaveAttribute('data-week-feedback', 'saved');

// The picker's cards: every button in its action groups.
const pickerCards = (sheet: Locator) =>
  sheet.getByRole('region').getByRole('button');

/** Opens the Week on both devices, settles Upkeep and shows Activity. */
export async function openActivity(gm: Page, player: Page, route: string) {
  await Promise.all([gm.goto(route), player.goto(route)]);
  const roll = (page: Page, name: string) =>
    page.getByRole('textbox', { name, exact: true });
  await roll(gm, 'Attrition Loyalty roll').fill('20');
  await expect(roll(player, 'Attrition Loyalty roll')).toHaveValue('20');
  await roll(gm, 'Attrition training roll').fill('1');
  await expect(roll(player, 'Attrition training roll')).toHaveValue('1');
  await saved(gm);
  for (const page of [gm, player])
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(allowance(gm, '0 of 2')).toBeVisible();
  await expect(empty(player, 1)).toBeVisible();
}

// The picker's scrolling list: the sheet's one vertically scrolling part.
function pickerScroller(sheet: Locator) {
  return sheet.evaluate((dialog) => {
    const list = [dialog, ...dialog.querySelectorAll<HTMLElement>('*')].find(
      (node) =>
        ['auto', 'scroll'].includes(getComputedStyle(node).overflowY) &&
        node.scrollHeight > node.clientHeight + 1,
    );
    if (!list) return null;
    const box = list.getBoundingClientRect();
    return {
      scrollTop: list.scrollTop,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };
  });
}

/**
 * Touch at the tablet size (touch is enabled in this project): a pan that
 * starts on a card scrolls the picker and places nothing on either device;
 * a tap on a card places it on both.
 */
export async function panAndTapPicker(gm: Page, player: Page) {
  await gm.setViewportSize({ width: 1194, height: 834 });
  await empty(gm, 1).tap();
  const sheet = gm.getByRole('dialog', {
    name: 'Choose an action for Action Slot 1',
    exact: true,
  });
  await expect(sheet).toBeVisible();
  // Measure the list only once the sheet has finished sliding in.
  await settleAnimations(gm);
  const list = await pickerScroller(sheet);
  expect(list, 'the picker list scrolls at the tablet size').not.toBeNull();
  // The lowest point in the list's visible part that is on a card.
  const start = await sheet.evaluate((_, box) => {
    for (let y = box.y + box.height - 16; y > box.y + box.height / 2; y -= 8)
      for (const x of [0.25, 0.5, 0.75].map((f) => box.x + box.width * f))
        if (
          document
            .elementFromPoint(x, y)
            ?.closest('section[aria-label] button') != null
        )
          return { x, y };
    return null;
  }, list!);
  expect(start, 'a card under the pan').not.toBeNull();
  // A finger's own touch events, moving up to near the list's top so the
  // list scrolls down. Headless Chromium's synthesized touch scroll gesture
  // sends only touchstart and touchend, which scroll nothing on any page.
  const cdp = await gm.context().newCDPSession(gm);
  const finger = (y: number) => [{ x: Math.round(start!.x), y: Math.round(y) }];
  const top = list!.y + 16;
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: finger(start!.y),
    });
    for (let step = 1; step <= 20; step++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: finger(start!.y + ((top - start!.y) * step) / 20),
      });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
  await expect(sheet).toBeVisible();
  await expect
    .poll(
      async () => (await pickerScroller(sheet))?.scrollTop ?? 0,
      'the pan scrolled the picker',
    )
    .toBeGreaterThan(list!.scrollTop);
  await gm.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(empty(gm, 1)).toBeFocused();
  await expect(empty(player, 1)).toBeVisible();
  await expect(allowance(gm, '0 of 2')).toBeVisible();

  await empty(gm, 1).tap();
  await sheet.getByRole('button', { name: 'Earn Gold', exact: true }).tap();
  await expect(sheet).toHaveCount(0);
  await saved(gm);
  await expect(card(player, 1, 'Earn Gold')).toBeVisible();
}

/**
 * The slot board, the selected slot's details and the picker at phone
 * landscape (844×390) and 1180×820: no horizontal overflow, the bounded
 * Week host, and every enabled control inside the viewport and its scroll
 * column. Slot 1 holds Earn Gold; Gather Information is staged in slot 2.
 */
export async function reviewActivityLandscapes(gm: Page, run: Run) {
  await empty(gm, 2).click();
  await gm
    .getByRole('dialog')
    .getByRole('button', { name: 'Gather Information', exact: true })
    .click();
  await expect(card(gm, 2, 'Gather Information')).toBeVisible();
  await saved(gm);
  for (const [name, width, height] of [
    ['phone-landscape', 844, 390],
    ['tablet-1180', 1180, 820],
  ] as const) {
    await gm.setViewportSize({ width, height });
    await card(gm, 1, 'Earn Gold').click();
    await expect(details(gm, 1)).toBeVisible();
    await expectNoHorizontalOverflow(gm);
    await expectBoundedWeekHost(gm);
    await expectControlsReachable(
      gm,
      gm.getByRole('region', { name: 'Activity choices', exact: true }),
      `${name} board and details`,
    );
    await savePrivate(
      join(run.artifactDirectory, `canonical-activity-${name}.png`),
      await gm.screenshot(),
    );
    // Change action opens the picker and keeps the details selected.
    await details(gm, 1)
      .getByRole('button', { name: 'Change action', exact: true })
      .click();
    const sheet = gm.getByRole('dialog', {
      name: 'Change the action in Action Slot 1',
      exact: true,
    });
    await expect(sheet).toBeVisible();
    await settleAnimations(gm);
    await expectNoHorizontalOverflow(gm);
    const box = (await sheet.boundingBox())!;
    expect(box.x, `${name}: picker starts in view`).toBeGreaterThanOrEqual(-1);
    expect(
      box.x + box.width,
      `${name}: picker ends in view`,
    ).toBeLessThanOrEqual(width + 1);
    expect(
      box.y + box.height,
      `${name}: picker ends in view`,
    ).toBeLessThanOrEqual(height + 1);
    expect(await pickerCards(sheet).count()).toBeGreaterThan(0);
    await expectControlsReachable(gm, sheet, `${name} picker`);
    await savePrivate(
      join(run.artifactDirectory, `canonical-activity-picker-${name}.png`),
      await gm.screenshot(),
    );
    await gm.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(card(gm, 1, 'Earn Gold')).toBeVisible();
    await expect(details(gm, 1)).toBeVisible();
  }
  await gm.setViewportSize({ width: 1194, height: 834 });
}

// One Correct values save on the Militia page.
async function correctValues(
  page: Page,
  values: { rank: string; training: string },
  expected: { rank: string; training: string },
  reason: string,
) {
  await page
    .getByRole('button', { name: 'Correct values', exact: true })
    .click();
  const rank = page.getByRole('textbox', { name: 'Rank', exact: true });
  const training = page.getByRole('textbox', { name: 'Training', exact: true });
  await expect(rank).toHaveValue(expected.rank);
  await expect(training).toHaveValue(expected.training);
  await rank.fill(values.rank);
  await training.fill(values.training);
  await page
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill(reason);
  await page
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(rank).toHaveCount(0);
  await expect(page.getByText('Values corrected.').first()).toBeVisible();
}

/**
 * With slots 1 and 2 staged on the GM's device, the player corrects rank
 * and training on the Militia page so the allowance falls to one action:
 * the GM sees slot 2 beyond the allowance at once, with both choices kept.
 * Restoring the values returns slot 2 inside the allowance. Both slots are
 * then cleared.
 */
export async function followAllowanceCorrections(
  gm: Page,
  player: Page,
  campaignId: string,
) {
  await expect(card(gm, 2, 'Gather Information')).toBeVisible();
  await expect(allowance(gm, '2 of 2')).toBeVisible();
  await expect(slot(gm, 2).getByText('Beyond the allowance')).toHaveCount(0);
  await player.goto(`/campaigns/${campaignId}/militia`);
  // Rank 1 with training that stays below rank 2's minimum after Upkeep.
  await correctValues(
    player,
    { rank: '1', training: '5' },
    { rank: '2', training: '14' },
    'The table recounted the drills',
  );
  await expect(allowance(gm, '2 of 1')).toBeVisible();
  await expect(slot(gm, 2).getByText('Beyond the allowance')).toBeVisible();
  await expect(slot(gm, 1).getByText('Beyond the allowance')).toHaveCount(0);
  await expect(card(gm, 1, 'Earn Gold')).toBeVisible();
  await expect(card(gm, 2, 'Gather Information')).toBeVisible();
  await correctValues(
    player,
    { rank: '2', training: '14' },
    { rank: '1', training: '5' },
    'Restore the recorded drills',
  );
  await expect(allowance(gm, '2 of 2')).toBeVisible();
  await expect(slot(gm, 2).getByText('Beyond the allowance')).toHaveCount(0);
  for (const [position, action] of [
    [1, 'Earn Gold'],
    [2, 'Gather Information'],
  ] as const) {
    await card(gm, position, action).click();
    await details(gm, position)
      .getByRole('button', { name: `Clear ${action}`, exact: true })
      .click();
    await expect(empty(gm, position)).toBeVisible();
  }
  await saved(gm);
  await expect(allowance(gm, '0 of 2')).toBeVisible();
}

/**
 * The player confirms the week while the GM's picker is open. Holding the
 * GM's successor, the open picker locks: every card is disabled, Escape
 * closes it and the board offers no edit. Released, the GM moves to the
 * next week, and nothing was placed in either week.
 */
export async function confirmWithOpenPicker(
  gm: Page,
  player: Page,
  gmTransport: Transport,
  run: Run,
  scope: FixtureScope,
  key: DraftKey,
) {
  await player.goto(`/campaigns/${key.campaignId}/week`);
  await player
    .getByRole('button', { name: 'Review & confirm', exact: true })
    .click();
  const confirm = reviewConfirm(player);
  await expect(confirm).toBeEnabled();
  await empty(gm, 1).click();
  const sheet = gm.getByRole('dialog', {
    name: 'Choose an action for Action Slot 1',
    exact: true,
  });
  await expect(sheet).toBeVisible();
  const earnGold = sheet.getByRole('button', {
    name: 'Earn Gold',
    exact: true,
  });
  await expect(earnGold).toBeEnabled();
  const hold = gmTransport.holdSuccessorHydration(key);
  try {
    await confirm.click();
    await expect.poll(hold.observed, { timeout: 20_000 }).toBe(true);
    expect(hold.failure()).toBeNull();
    // Still the confirmed week, read-only, with the picker open and locked.
    // The modal picker hides the page from assistive technology, so the
    // heading is found among hidden elements but must still be on screen.
    await expect(
      gm.getByRole('heading', {
        name: 'Week 4 · Activity',
        exact: true,
        includeHidden: true,
      }),
    ).toBeVisible();
    await expect(confirmedWeekNotice(gm)).toBeEmpty();
    await expect(sheet).toBeVisible();
    await expect(earnGold).toBeDisabled();
    const cards = pickerCards(sheet);
    expect(await cards.count()).toBeGreaterThan(0);
    for (const locked of await cards.all()) await expect(locked).toBeDisabled();
    await gm.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(empty(gm, 1)).toBeFocused();
    await expect(
      gm.getByRole('button', { name: 'Add slot', exact: true }),
    ).toBeDisabled();
    await empty(gm, 1).click();
    await expect(gm.getByRole('dialog')).toHaveCount(0);
    await expect(empty(gm, 1)).toBeVisible();
    hold.release();
    await expectConfirmedWeek(gm, 4);
    expect(hold.failure()).toBeNull();
  } finally {
    hold.release();
  }
  await expectConfirmedWeek(player, 4);
  const committed = confirmationInspectionSchema.parse(
    await canonicalPersistenceFixtureCall(run, 'inspect', { ...key, scope }),
  );
  expect(committed.records).toHaveLength(1);
  const slots = committed.records[0]!.source.activity.slots;
  expect(slots.length).toBeGreaterThan(0);
  expect(
    slots.filter((entry) => entry.choice !== null),
    'nothing was placed in the confirmed week',
  ).toEqual([]);
  for (const page of [gm, player]) {
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await expect(empty(page, 1)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}
