import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { savePrivate } from './process';
import { expectVisibleControlsFit } from './control-geometry';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';
import { referencePanel, saveState } from './week-frame';
import {
  BUYOFF_STAGED,
  RIVALRY_ENDED,
  THEFT_CHECKED,
} from './persistent-workspace';

const theftOf = (page: Page) =>
  page.getByRole('group', { name: 'Theft · Event 1', exact: true });

/**
 * Independent review of the carried-event controls on the authenticated page.
 * `observer`, another member on Persistent, must see the Loyalty check that
 * replaces the buyoff; `expectPersistentRestoreDelivered` then proves it saw
 * the restored buyoff too, not the identical one from before the check.
 */
export async function reviewPersistentWorkspace(
  page: Page,
  observer: Page,
  artifactDirectory: string,
) {
  const theft = theftOf(page);
  const rivalry = page.getByRole('group', {
    name: 'Rivalry · Event 3',
    exact: true,
  });
  await expect(theft).toContainText('Ends · buyoff 40 gp');
  await expect(rivalry).toContainText(RIVALRY_ENDED);
  await expect(
    rivalry.getByRole('button', { name: 'Add rolls', exact: true }),
  ).toHaveCount(0);
  // Only the applicable check card: Theft has no officer card, Rivalry no
  // Loyalty card, and neither offers a recorded amount.
  await expect(
    theft.getByRole('button', { name: 'Officer check to end it', exact: true }),
  ).toHaveCount(0);
  await expect(
    rivalry.getByRole('button', {
      name: 'Loyalty check (this week only)',
      exact: true,
    }),
  ).toHaveCount(0);
  await theft
    .getByRole('button', {
      name: 'Loyalty check (this week only)',
      exact: true,
    })
    .click();
  // Only the rule-supported Theft check exists, as one dice total.
  await expect(
    theft.getByRole('textbox', { name: 'Loyalty check', exact: true }),
  ).toBeVisible();
  await expect(
    theft.getByRole('combobox', { name: 'Character', exact: true }),
  ).toHaveCount(0);
  await expect(theft.getByText('1d20 · total of the dice only')).toBeVisible();
  for (const name of [
    'check',
    'notoriety',
    'training',
    'delivery',
    'loss',
    'chance',
    'table',
    'duration',
    'reward',
  ]) {
    await expect(
      theft.getByRole('button', { name: `Add ${name}`, exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    theft.getByRole('textbox', { name: 'Sides', exact: true }),
  ).toHaveCount(0);
  await theft
    .getByRole('textbox', { name: 'Loyalty check', exact: true })
    .fill('20');
  await expect(theft).toContainText('Success ·');
  await expect(theftOf(observer)).toContainText(THEFT_CHECKED);
  // Tablet, phone and desktop, then (#144 §6) phone landscape and the
  // narrower tablet with the reference panel closed.
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
    ['phone-landscape', 844, 390],
    ['tablet-narrow-closed', 1180, 820],
  ] as const) {
    await page.setViewportSize({ width, height });
    const section = page.getByRole('region', {
      name: 'Persistent preparation',
    });
    await expect(section).toBeVisible();
    const closesPanel = name === 'tablet-narrow-closed';
    if (closesPanel) {
      await page.getByRole('button', { name: 'Hide reference panel' }).click();
      await expect(referencePanel(page)).toBeHidden();
    }
    await expectNoHorizontalOverflow(page);
    await expectBoundedWeekHost(page);
    if (name === 'phone-landscape' || closesPanel) {
      // The short viewport and the widened editor still reach the check and
      // the buyoff above the pinned week footer.
      await expectReachable(
        page,
        theft.getByRole('textbox', { name: 'Loyalty check', exact: true }),
      );
      // Every decision card, not only Buy off, is seen whole in the short
      // scroll column.
      for (const card of await theft
        .getByRole('group', { name: 'Theft · Event 1 decision', exact: true })
        .getByRole('button')
        .all())
        await expectReachable(page, card);
    }
    await savePrivate(
      join(artifactDirectory, `reviewer-persistent-${name}.png`),
      await page.screenshot({ fullPage: true }),
    );
    await expectVisibleControlsFit(
      section.locator('button, input'),
      name,
      width,
    );
    if (closesPanel) {
      await page.getByRole('button', { name: 'Show reference panel' }).click();
      await expect(referencePanel(page)).toBeVisible();
    }
  }
  // Replace the check with the previously reviewed buyoff.
  await theft
    .getByRole('button', { name: 'Buy off · 40 gp', exact: true })
    .click();
  await expect(theft).toContainText('Ends · buyoff 40 gp');
  await page
    .getByRole('button', { name: 'Review & confirm', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: /· Review & confirm$/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Persistent', exact: true }).click();
  await expect(theft).toContainText('Ends · buyoff 40 gp');
  await expect(rivalry).toContainText(RIVALRY_ENDED);
  await page.setViewportSize({ width: 1194, height: 834 });
}

/**
 * The restored buyoff is saved and has reached `observer`, so a Confirmation
 * from that device reviews the restored week rather than the Loyalty check.
 * Runs after `reviewPersistentWorkspace`, whose observer saw the check.
 */
export async function expectPersistentRestoreDelivered(
  page: Page,
  observer: Page,
) {
  await expect(saveState(page)).toHaveAttribute('data-week-feedback', 'saved');
  await expect(theftOf(observer)).toContainText(BUYOFF_STAGED);
}
