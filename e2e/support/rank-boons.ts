import { expect, type Page } from '@playwright/test';

// Upkeep Rank on the rank-gain fixture (#157): once the last earlier decision
// is in, both devices see rank 8 → 9, and the PC's Captain feat is a shared
// card choice that a second tap clears again.
export async function exerciseRankBoon(first: Page, second: Page) {
  const rank = (page: Page) =>
    page
      .locator('[data-week-editor]')
      .getByRole('region', { name: 'Rank', exact: true });
  const feat = (page: Page, name: string) =>
    rank(page)
      .getByRole('group', { name: /rank 9 feat$/ })
      .getByRole('button', { name, exact: true });

  await expect(rank(first)).toContainText('Waiting for the steps above');
  await first
    .getByRole('group', { name: 'Scouts team condition', exact: true })
    .getByRole('button', { name: 'Leave disabled', exact: true })
    .click();
  for (const page of [first, second]) {
    await expect(rank(page)).toContainText('Rank 8 → 9');
    await expect(feat(page, 'Iron Will')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  }
  await feat(first, 'Iron Will').click();
  await expect(feat(second, 'Iron Will')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await feat(second, 'Iron Will').click();
  await expect(feat(first, 'Iron Will')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await feat(first, 'Great Fortitude').click();
  await expect(feat(second, 'Great Fortitude')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}
