import { expect, type Page } from '@playwright/test';

/**
 * Choose a Class Level's class (#406): the "Class at level N" field opens a
 * side panel (a bottom sheet on the phone) of class cards, and choosing a
 * card closes it and saves.
 */
export async function chooseClass({
  page,
  level,
  name,
}: {
  page: Page;
  level: number;
  name: string;
}) {
  const label = `Class at level ${level}`;
  await page
    .getByRole('main')
    .getByRole('region', { name: 'Class Levels', exact: true })
    .getByRole('combobox', { name: label, exact: true })
    .click();
  const panel = page.getByRole('dialog', { name: label, exact: true });
  await panel
    .getByRole('radiogroup', { name: label, exact: true })
    .getByRole('radio', { name, exact: true })
    .click();
  await expect(panel).toHaveCount(0);
}
