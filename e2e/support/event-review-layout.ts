import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { expectVisibleControlsFit } from './control-geometry';
import { savePrivate } from './process';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';
import { expectPinnedConfirm, referencePanel, saveState } from './week-frame';

// The Event blocks (#143 §7) and Review & confirm (#145 §6) at the sizes the
// other journeys do not reach: phone landscape and the 1180×820 tablet with
// the reference panel open and closed. Review also shows, in the browser, a
// warning listed with its phase and placed under its item (SUM-09) and a
// recorded outcome under the event it belongs to (SUM-11).

const OUTCOME = 'The table drove the invaders away.';
const CHANCE_WARNING =
  'Event chance: the roll is outside 1–100. The recorded value is kept for the table.';

type Size = readonly [name: string, width: number, height: number];
const phoneLandscape: Size = ['phone-landscape', 844, 390];
const narrowTablet: Size = ['tablet-narrow', 1180, 820];

const phase = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).click();
const occurrence = (page: Page) =>
  page.getByRole('group', { name: 'Event 1', exact: true });
const occurrenceField = (page: Page, name: string) =>
  occurrence(page).getByRole('textbox', { name, exact: true });

async function setPanel(page: Page, open: boolean) {
  const toggle = page.getByRole('button', {
    name: open ? 'Show reference panel' : 'Hide reference panel',
  });
  if (await toggle.isVisible()) await toggle.click();
  if (open) await expect(referencePanel(page)).toBeVisible();
  else await expect(referencePanel(page)).toBeHidden();
}

/**
 * Rolls an Invasion on the GM page and records its party level and what
 * happened. The chance roll of 0 is outside 1–100: it still triggers the
 * event and leaves an advisory warning for Review.
 */
export async function prepareInvasion(page: Page) {
  await phase(page, 'Event');
  const chance = page.getByRole('textbox', {
    name: 'Event chance roll',
    exact: true,
  });
  await chance.fill('0');
  const table = page.getByRole('textbox', {
    name: 'Event 1 table roll',
    exact: true,
  });
  await expect(table).toBeEnabled();
  await table.fill('82');
  await expect(
    occurrence(page).getByText('Invasion', { exact: true }),
  ).toBeVisible();
  await occurrenceField(page, 'Average Party Level').fill('4');
  await occurrenceField(page, 'What happened').fill(OUTCOME);
  await occurrence(page)
    .getByRole('button', { name: 'Save what happened', exact: true })
    .click();
  await expect(
    occurrence(page).getByRole('list', {
      name: 'Event 1 outcomes',
      exact: true,
    }),
  ).toHaveText(
    '›The GM runs a combat encounter at CR 5 (Average Party Level 4 + 1).',
  );
  await expect(saveState(page)).toHaveAttribute('data-week-feedback', 'saved');
}

/** Event at 844×390 with the panel open and at 1180×820 with it closed. */
export async function reviewEventLayout(page: Page, artifactDirectory: string) {
  const section = page.getByRole('region', { name: 'Event preparation' });
  for (const [size, width, height, open] of [
    [...phoneLandscape, true],
    [...narrowTablet, false],
  ] as const) {
    const name = open ? size : `${size}-closed`;
    await page.setViewportSize({ width, height });
    await setPanel(page, open);
    await expect(section).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectBoundedWeekHost(page);
    // The short viewport and the widened editor still reach the rolls and
    // the event's own fields above the pinned week footer.
    for (const control of [
      page.getByRole('textbox', { name: 'Event chance roll', exact: true }),
      page.getByRole('textbox', { name: 'Event 1 table roll', exact: true }),
      occurrenceField(page, 'Average Party Level'),
      occurrenceField(page, 'What happened'),
    ])
      await expectReachable(page, control);
    await expectVisibleControlsFit(
      section.locator('button, input, textarea'),
      name,
      width,
    );
    await savePrivate(
      join(artifactDirectory, `canonical-event-${name}.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
  await setPanel(page, true);
}

/**
 * Review & confirm: the warning and the outcome in place, then 844×390 and
 * 1180×820 with the panel open and closed. Leaves the page at 1194×834.
 */
export async function reviewSummaryLayout(
  page: Page,
  artifactDirectory: string,
) {
  await phase(page, 'Review & confirm');
  const block = page.getByRole('region', {
    name: 'Review the week',
    exact: true,
  });
  await expect(block).toBeVisible();
  // SUM-09: the warning is listed once in the review block with its phase…
  const warnings = block.getByRole('region', { name: 'Warnings' });
  const listed = warnings
    .getByRole('listitem')
    .filter({ hasText: CHANCE_WARNING });
  await expect(listed).toHaveCount(1);
  await expect(listed).toHaveText(`${CHANCE_WARNING} · Event`);
  // …and placed under the Event chance consequence it belongs to.
  const event = page.getByRole('region', { name: '3 Event', exact: true });
  const chanceItem = event
    .getByRole('listitem')
    .filter({ hasText: /^Event chance · / });
  await expect(chanceItem).toHaveCount(1);
  // The inline warning carries a visually hidden "Warning:" prefix.
  const placed = chanceItem.getByText(CHANCE_WARNING);
  await expect(placed).toHaveCount(1);
  // SUM-11: what happened is quoted under the Invasion it records, not in
  // an unlinked group.
  const invasion = event
    .getByRole('listitem')
    .filter({ hasText: /^Event 1 · Invasion/ });
  await expect(invasion).toHaveCount(1);
  const outcome = invasion.getByText(OUTCOME, { exact: true });
  await expect(outcome).toHaveCount(1);
  await expect(invasion).toContainText(`Recorded outcome“${OUTCOME}”`);
  await expect(
    page.getByRole('region', { name: 'Unlinked facts', exact: true }),
  ).toHaveCount(0);
  // The recorded Invasion leaves nothing to decide, so Confirm is live and
  // must stay clear of the fixed bars at every size.
  const confirm = block.getByRole('button', {
    name: 'Confirm week',
    exact: true,
  });
  await expect(confirm).toBeEnabled();
  for (const [size, width, height, open] of [
    [...phoneLandscape, true],
    [...narrowTablet, true],
    [...narrowTablet, false],
  ] as const) {
    const name = `${size}-${open ? 'open' : 'closed'}`;
    await page.setViewportSize({ width, height });
    await setPanel(page, open);
    await expectNoHorizontalOverflow(page);
    await expectBoundedWeekHost(page);
    for (const target of [confirm, listed, placed, outcome])
      await expectReachable(page, target);
    // The pinned Confirm counts the warning listed above.
    expect(await expectPinnedConfirm(page)).toBeGreaterThanOrEqual(1);
    await expectVisibleControlsFit(
      page.locator('main').locator('button, input, textarea'),
      name,
      width,
    );
    await savePrivate(
      join(artifactDirectory, `reviewer-summary-${name}.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
  await setPanel(page, true);
  await page.setViewportSize({ width: 1194, height: 834 });
}
