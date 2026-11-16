import { expect, type Locator, type Page } from '@playwright/test';

// Section 6 of Review & confirm: one Now / Rules Baseline / Final comparison,
// changed-only by default with a local Show all values toggle. At tablet and
// desktop widths it is a table; each row starts with "Group · Label".

const columns = { Now: 1, 'Rules Baseline': 2, Final: 3 } as const;

export function summaryResult(page: Page) {
  return page.getByRole('region', { name: 'Result', exact: true });
}

/** Reveal every value; presentation only, so other devices are unaffected. */
export async function showAllResultValues(page: Page, showAll = true) {
  const toggle = summaryResult(page).getByRole('button', {
    name: 'Show all values',
    exact: true,
  });
  if ((await toggle.getAttribute('aria-pressed')) !== String(showAll))
    await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(showAll));
}

/** The table cell for one militia value (or any "Group · Label" row). */
export async function resultCell(
  page: Page,
  row: string,
  column: keyof typeof columns,
  group = 'Militia',
): Promise<Locator> {
  await showAllResultValues(page);
  return summaryResult(page)
    .locator('tbody tr')
    .filter({ hasText: `${group} · ${row}` })
    .first()
    .locator('td')
    .nth(columns[column]);
}
