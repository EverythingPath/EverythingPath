import { expect, type Page } from '@playwright/test';

// Upkeep team rows on a fresh week with the disabled Scouts and the missing
// Riders (#156): the missing team only rolls to return, shared on both
// devices, and the disabled team offers only Recover or Leave disabled.
export async function exerciseTeamConditionRows(first: Page, second: Page) {
  const riders = (page: Page) =>
    page.getByRole('group', { name: 'Riders return check', exact: true });
  const returnRoll = (page: Page) =>
    riders(page).getByRole('textbox', {
      name: 'Riders return roll',
      exact: true,
    });
  const scouts = (page: Page) =>
    page.getByRole('group', { name: 'Scouts team condition', exact: true });

  await expect(riders(first)).toContainText('Return check · Security DC 15');
  // The calculated bonus is known before the die is entered.
  await expect(riders(first)).toContainText(/bonus [+−]\d+/);
  await expect(
    riders(first).getByRole('button', { name: 'Recover', exact: true }),
  ).toHaveCount(0);
  await returnRoll(first).fill('1');
  await expect(returnRoll(second)).toHaveValue('1');
  for (const page of [first, second])
    await expect(riders(page)).toContainText(
      'Natural 1: the team is lost for good',
    );
  await returnRoll(second).fill('19');
  await expect(returnRoll(first)).toHaveValue('19');
  for (const page of [first, second])
    await expect(riders(page)).toContainText('Returns at the end of the week');

  for (const page of [first, second]) {
    await expect(
      scouts(page).getByRole('button', { name: 'Recover', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(
      scouts(page).getByRole('button', { name: 'Leave disabled', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(
      scouts(page).getByRole('button', { name: /remove/i }),
    ).toHaveCount(0);
  }
}
