import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { savePrivate } from './process';
import {
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';

// Militia corrections on a phone (#139 §8 bullet 1): with a correction open,
// its reason bar sits in the strip above the bottom tabs, and every field and
// control, focused in turn as a keyboard or tap would, scrolls clear of that
// bar. Values, then Items grown into a long list. Both are cancelled, so the
// militia is unchanged.

async function expectFocusedClearOfBar(page: Page, control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  // Page content must end above the sticky strip and tabs; the bar's own
  // controls must sit inside the viewport.
  await expectReachable(page, control);
}

async function reviewOpenCorrection(
  page: Page,
  form: Locator,
  shot: string,
  artifactDirectory: string,
) {
  const strip = page.locator('[data-shell-slot="phone-status-strip"]');
  const bar = strip.locator('[data-reason-bar]');
  // One reason bar, in the phone strip rather than inline in the form.
  await expect(page.locator('[data-reason-bar]')).toHaveCount(1);
  await expect(bar).toBeVisible();
  await expectNoHorizontalOverflow(page);
  // The strip and tabs together leave most of the screen to the fields.
  const cover = (await strip.locator('..').boundingBox())!;
  const { height } = page.viewportSize()!;
  expect(cover.height, 'the bottom bar leaves room').toBeLessThan(height / 2);
  const controls = await form
    .locator('input, textarea, button, [role="combobox"]')
    .all();
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls)
    if (await control.isVisible()) await expectFocusedClearOfBar(page, control);
  for (const name of ['Save correction', 'Cancel'])
    await expectReachable(page, bar.getByRole('button', { name, exact: true }));
  await expectFocusedClearOfBar(
    page,
    bar.getByRole('textbox', { name: 'Reason for correction', exact: true }),
  );
  await savePrivate(
    join(artifactDirectory, shot),
    await page.screenshot({ fullPage: true }),
  );
  await bar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-reason-bar]')).toHaveCount(0);
}

/** On the Militia page; returns to the project's size. */
export async function reviewPhoneCorrections(
  page: Page,
  artifactDirectory: string,
  project: string,
) {
  const original = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    const form = (field: string) =>
      page
        .locator('form')
        .filter({ has: page.getByRole('textbox', { name: field }) });
    await page
      .getByRole('button', { name: 'Correct values', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'Treasury (copper)', exact: true }),
    ).toBeVisible();
    await reviewOpenCorrection(
      page,
      form('Treasury (copper)'),
      `militia-correction-${project}-values-phone.png`,
      artifactDirectory,
    );

    // A long list: three new items reach well below the reason bar.
    await page.getByRole('button', { name: /^Items/ }).click();
    await page
      .getByRole('button', { name: 'Correct items', exact: true })
      .click();
    for (let item = 1; item <= 3; item++) {
      await page.getByRole('button', { name: 'Add item', exact: true }).click();
      await expect(
        page.getByRole('group', { name: `Item ${item}`, exact: true }),
      ).toBeVisible();
    }
    await reviewOpenCorrection(
      page,
      form('Item name'),
      `militia-correction-${project}-items-phone.png`,
      artifactDirectory,
    );
  } finally {
    await page.setViewportSize(original);
  }
}
