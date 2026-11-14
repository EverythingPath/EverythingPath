import { expect, type Page } from '@playwright/test';
import { test } from './support/fixtures';

// Private Characters (#260), as a thin lifecycle (#752, D-2): the owner
// creates one outside every campaign and deletes it behind a question, and
// its URL then shows what a missing Character shows. Editing without a
// campaign and what other members and outsiders see are proven by the
// component and Convex tests (convex/privateCharacters.integration.test.ts,
// src/app/characters/characters-route.test.tsx).

const tablet = { width: 1024, height: 768 };
const name = 'E2E private character';
const unavailable = 'This character isn’t available.';

function findDeleteQuestion(page: Page) {
  return page.getByRole('group', { name: `Delete ${name}?`, exact: true });
}
async function expectNoSheet(page: Page) {
  await expect(
    page.getByRole('main').getByRole('status').filter({ hasText: unavailable }),
  ).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Strength' })).toHaveCount(0);
  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: 'Characters', exact: true }),
  ).toBeVisible();
}

test.use({ caseKey: 'privateCharacter', viewport: tablet });
test('an owner creates a private Character and deletes it behind a question, after which its address is unavailable', async ({
  players,
}) => {
  test.setTimeout(180_000);
  const owner = players.gm;

  await test.step('creation opens the new sheet outside every campaign', async () => {
    await owner.goto('/characters/new');
    await owner.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
    await owner
      .getByRole('button', { name: 'Create character', exact: true })
      .click();
    await expect(owner).toHaveURL(/\/characters\/[^/]+$/);
    await expect(owner.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(owner.getByText(name, { exact: true })).toHaveCount(1);
    await expect(owner.getByText('No campaign', { exact: true })).toBeVisible();
    await expect(
      owner
        .getByRole('main')
        .getByRole('link', { name: 'Characters', exact: true }),
    ).toBeVisible();
    await expect(
      owner.getByRole('button', {
        name: /Archive character|Restore character/,
      }),
    ).toHaveCount(0);
    await expect(
      owner
        .getByRole('navigation', { name: 'Sections', exact: true })
        .getByRole('link', { name: 'Characters', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      owner.getByRole('navigation', { name: 'Militia pages', exact: true }),
    ).toHaveCount(0);
  });
  const url = new URL(owner.url()).pathname;

  await test.step('deleting asks first; Keep and Escape write nothing', async () => {
    const trigger = owner.getByRole('button', {
      name: 'Delete character',
      exact: true,
    });
    await trigger.click();
    await expect(
      findDeleteQuestion(owner).getByRole('button', {
        name: `Keep ${name}`,
        exact: true,
      }),
    ).toBeFocused();
    await owner.keyboard.press('Escape');
    await expect(findDeleteQuestion(owner)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await owner.keyboard.press('Enter');
    await owner.keyboard.press('Enter');
    await expect(findDeleteQuestion(owner)).toHaveCount(0);
    await expect(owner.getByRole('heading', { level: 1, name })).toBeVisible();
  });

  await test.step('a confirmed deletion returns to the origin and the URL is gone', async () => {
    await owner
      .getByRole('button', { name: 'Delete character', exact: true })
      .click();
    await findDeleteQuestion(owner)
      .getByRole('button', { name: `Delete ${name}`, exact: true })
      .click();
    await expect(owner).toHaveURL(/\/characters$/);
    await owner.goto(url);
    await expectNoSheet(owner);
  });
});
