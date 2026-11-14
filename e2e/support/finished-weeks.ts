import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';

// Finished weeks beyond a single entry (#146 §6 item 6), on the history
// fixture: week 1 confirmed and then corrected six times (seven entries),
// week 2 open, week 3 a historical reconstruction. Paging, the gap-aware
// arrows, an earlier entry that survives reload, keyboard use of the index
// and the entries, and the layout at phone, tablet and desktop sizes.
export async function reviewFinishedWeeks(
  page: Page,
  originalRecordId: string,
  artifactDirectory: string,
) {
  const index = page.getByRole('navigation', { name: 'Finished weeks' });
  const row = (week: number) =>
    index.getByRole('link', { name: new RegExp(`^Week ${week}\\b`) });
  const heading = (week: number) =>
    page.getByRole('heading', { level: 1, name: `Week ${week}`, exact: true });
  const selection = (name: string) =>
    new URL(page.url()).searchParams.get(name);

  // The open index lists both weeks without a reload, oldest first, and
  // shows the latest (the reconstructed week 3).
  await expect(row(3)).toContainText('Reconstructed');
  await expect(row(1)).toContainText('Corrected · 7 entries');
  await expect(heading(3)).toBeVisible();

  // Keyboard: Shift+Tab moves from week 3's row to week 1's; Enter opens it.
  await row(3).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(row(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(heading(1)).toBeVisible();
  await expect.poll(() => selection('week')).toBe('1');
  await expect(row(1)).toHaveAttribute('aria-current', 'page');
  // The arrows skip the open week 2; week 1 has no earlier week.
  await expect(
    page.getByRole('link', { name: 'Next week', exact: true }),
  ).toHaveAttribute('href', /[?&]week=3$/);
  await expect(
    page.getByRole('button', { name: 'Previous week', exact: true }),
  ).toBeDisabled();

  // Seven entries, five per page, newest first, all reached with Tab. The
  // tab order runs from the index rows into the record header (the disabled
  // Previous week is skipped) and on through the open entries. Navigation
  // may move focus, so the walk starts from week 1's row again.
  const toggle = page.getByRole('button', { name: '7 entries', exact: true });
  const next = page.getByRole('link', { name: 'Next week', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await row(1).focus();
  await page.keyboard.press('Tab');
  await expect(row(3)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused();
  const entries = page.getByRole('list', { name: 'Entries for week 1' });
  const entry = (ordinal: number) =>
    entries.getByRole('button', { name: new RegExp(`^Entry ${ordinal}\\b`) });
  await expect(entries.getByRole('listitem')).toHaveCount(5);
  await expect(entry(7)).toHaveAttribute('aria-current', 'true');
  await expect(entry(7)).toContainText('effective');
  await page.keyboard.press('Tab');
  await expect(next).toBeFocused();
  for (const ordinal of [7, 6, 5, 4, 3]) {
    await page.keyboard.press('Tab');
    await expect(entry(ordinal)).toBeFocused();
  }
  const earlier = page.getByRole('button', {
    name: 'Earlier entries',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await expect(earlier).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => selection('beforeSequence')).not.toBeNull();
  await expect(entries.getByRole('listitem')).toHaveCount(2);
  await expect(earlier).toHaveCount(0);

  // The original confirmation, chosen from the keyboard (paging replaced
  // the focused control), is shown as an earlier entry; the selection is in
  // the address and survives reload.
  await entry(1).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => selection('recordId')).toBe(originalRecordId);
  await expect(entry(1)).toHaveAttribute('aria-current', 'true');
  await expect(entry(1)).toContainText('showing');
  const earlierEntry = page.getByText('Earlier entry 1 of 7', { exact: true });
  await expect(earlierEntry).toBeVisible();
  const selected = page.url();
  await page.reload();
  await expect(page).toHaveURL(selected);
  await expect(heading(1)).toBeVisible();
  await expect(earlierEntry).toBeVisible();
  await expect(entry(1)).toHaveAttribute('aria-current', 'true');

  const pane = page.getByRole('article', { name: 'Week 1', exact: true });
  // Phone: week 1 is the one expanded row, its record directly below it and
  // week 3's row after the record; everything clears the bottom tabs.
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await expect(index.locator('[aria-current="page"]')).toHaveCount(1);
  const [selectedRow, record, laterRow] = await Promise.all(
    [row(1), pane, row(3)].map((locator) => locator.boundingBox()),
  );
  expect(record!.y, 'the record follows its row').toBeGreaterThanOrEqual(
    selectedRow!.y + selectedRow!.height - 1,
  );
  expect(laterRow!.y, 'later weeks follow the record').toBeGreaterThanOrEqual(
    record!.y + record!.height - 1,
  );
  for (const control of [
    row(1),
    toggle,
    entry(1),
    page.getByRole('link', { name: 'Next week', exact: true }),
    row(3),
    page.getByRole('link', { name: 'Return to current week' }),
  ])
    await expectReachable(page, control);
  await page.screenshot({
    path: join(artifactDirectory, 'canonical-history-entries-phone.png'),
    fullPage: true,
  });

  // Tablet and desktop: the index column beside the record pane.
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['desktop', 1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expectNoHorizontalOverflow(page);
    // The index `<nav>` is `display: contents`, so its rows are measured.
    const [firstRow, lastRow, paneBox] = await Promise.all(
      [row(1), row(3), pane].map((locator) => locator.boundingBox()),
    );
    for (const box of [firstRow!, lastRow!])
      expect(
        box.x + box.width,
        `${name}: the index sits left of the record`,
      ).toBeLessThanOrEqual(paneBox!.x + 1);
    for (const control of [row(1), row(3), toggle, entry(1)])
      await expectReachable(page, control);
    await page.screenshot({
      path: join(artifactDirectory, `canonical-history-entries-${name}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1194, height: 834 });
}
