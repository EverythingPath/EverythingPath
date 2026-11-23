import { expect, type Page } from '@playwright/test';
import { openCampaignSection } from './interactions';
import { saveState } from './week-frame';

// Build real same-document history through the shell, so a native
// beforeunload warning cannot accidentally satisfy the departure contract.
export async function prepareWeekHistory(page: Page) {
  await openCampaignSection(page, 'officers');
  await expect(
    page.getByRole('region', { name: 'Characters', exact: true }),
  ).toBeVisible();
  const charactersUrl = page.url();
  await openCampaignSection(page, 'week');
  return charactersUrl;
}

export async function stayOnPendingWeek(
  page: Page,
  direction: 'back' | 'forward',
  feedback: 'pending' | 'confirming',
) {
  const weekUrl = page.url();
  if (direction === 'back') await page.goBack();
  else await page.goForward();
  const warning = page.getByRole('dialog', {
    name: 'Changes are still saving',
    exact: true,
  });
  await expect(warning).toBeVisible();
  await warning.getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(warning).toBeHidden();
  await expect(page).toHaveURL(weekUrl);
  await expect(saveState(page)).toHaveAttribute('data-week-feedback', feedback);
  await expect(page.getByRole('heading', { name: /^Week \d+ · / })).toHaveCount(
    1,
  );
}

export async function leavePendingWeek(
  page: Page,
  direction: 'back' | 'forward',
  charactersUrl: string,
) {
  if (direction === 'back') await page.goBack();
  else await page.goForward();
  const warning = page.getByRole('dialog', {
    name: 'Changes are still saving',
    exact: true,
  });
  await expect(warning).toBeVisible();
  await warning
    .getByRole('button', { name: 'Leave anyway', exact: true })
    .click();
  await expect(warning).toBeHidden();
  await expect(page).toHaveURL(charactersUrl);
  // The page's own title, not its Characters region: that region needs the
  // page's data, which a transport still holding the week's write (racing
  // Confirmations) keeps back until release, so the page shows its skeleton.
  await expect(
    page.getByRole('heading', {
      name: 'Characters & officers',
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Week \d+ · / })).toHaveCount(
    0,
  );
}
