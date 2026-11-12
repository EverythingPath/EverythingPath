import { expect } from '@playwright/test';
import { test } from './support/fixtures';
import {
  expectBottomBarPinned,
  expectNoHorizontalOverflow,
} from './support/responsive-shell';

const privateName = 'E2E navigation private Character';
const campaignName = 'E2E navigation campaign Character';

test.use({ caseKey: 'characterNavigation' });
test('players find grouped Characters and create campaign sheets with independent URLs and phone navigation', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(180_000);
  const owner = players.gm;
  const member = players.player;

  await test.step('personal creation opens a Full sheet and returns to the grouped Characters area', async () => {
    await owner.goto('/characters');
    await owner
      .getByRole('link', { name: 'New character', exact: true })
      .click();
    await owner
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill(privateName);
    await owner
      .getByRole('button', { name: 'Create character', exact: true })
      .click();
    await expect(owner).toHaveURL(/\/characters\/[^/?]+(?:\?|$)/);
    await expect(
      owner.getByRole('heading', { level: 1, name: privateName, exact: true }),
    ).toBeVisible();
    await expect(
      owner.getByRole('region', { name: 'Class Levels', exact: true }),
    ).toBeVisible();
    await owner
      .getByRole('main')
      .getByRole('link', { name: 'Characters', exact: true })
      .click();
    await expect(owner).toHaveURL(/\/characters$/);
    await expect(
      owner
        .getByRole('region', { name: 'No campaign', exact: true })
        .getByRole('link', { name: new RegExp(`^${privateName}`) }),
    ).toBeVisible();
    await expect(
      owner.getByRole('region', { name: ownedCase.campaignName, exact: true }),
    ).toBeVisible();
    const headings = await owner
      .getByRole('heading', { level: 2 })
      .allTextContents();
    expect(headings[0]).toBe('No campaign');
    await member.goto('/characters');
    await expect(
      member.getByRole('heading', {
        level: 1,
        name: 'Characters',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      member.getByRole('link', { name: new RegExp(`^${privateName}`) }),
    ).toHaveCount(0);
  });

  await test.step('campaign creation opens the same independent Full sheet for every member and keeps its origin', async () => {
    await owner.goto(`/campaigns/${ownedCase.campaignId}/characters`);
    await owner
      .getByRole('link', { name: 'New character', exact: true })
      .click();
    await owner
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill(campaignName);
    await owner
      .getByRole('button', { name: 'Create character', exact: true })
      .click();
    await expect(owner).toHaveURL(/\/characters\/[^/?]+\?/);
    await expect(
      owner.getByRole('heading', { level: 1, name: campaignName, exact: true }),
    ).toBeVisible();
    const sheetUrl = new URL(owner.url());
    expect(sheetUrl.searchParams.get('from')).toBe(
      `/campaigns/${ownedCase.campaignId}/characters`,
    );
    await member.goto(`${sheetUrl.pathname}${sheetUrl.search}`);
    await expect(
      member.getByRole('heading', {
        level: 1,
        name: campaignName,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      member.getByRole('region', { name: 'Ability scores', exact: true }),
    ).toBeVisible();
    await owner
      .getByRole('main')
      .getByRole('link', { name: 'Characters', exact: true })
      .click();
    await expect(owner).toHaveURL(
      new RegExp(`/campaigns/${ownedCase.campaignId}/characters$`),
    );
    await expect(
      owner.getByRole('link', { name: new RegExp(`^${campaignName}`) }),
    ).toBeVisible();
    await owner.reload();
    await expect(
      owner.getByRole('link', { name: new RegExp(`^${campaignName}`) }),
    ).toBeVisible();
    await players.outsider.goto(`${sheetUrl.pathname}${sheetUrl.search}`);
    await expect(
      players.outsider
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: 'This character isn’t available.' }),
    ).toBeVisible();
    await expect(
      players.outsider.getByText(campaignName, { exact: true }),
    ).toHaveCount(0);
  });

  await test.step('phone tabs stay fixed and an absent militia explains the next choice', async () => {
    await owner.setViewportSize({ width: 390, height: 844 });
    const tabs = owner.getByRole('navigation', { name: 'Areas', exact: true });
    for (const label of ['Campaign', 'Characters', 'More'])
      await expect(
        tabs
          .getByRole('link', { name: label, exact: true })
          .or(tabs.getByRole('button', { name: label, exact: true })),
      ).toBeVisible();
    await expectBottomBarPinned(owner);
    await expectNoHorizontalOverflow(owner);
    const militia = tabs.getByRole('button', { name: 'Militia', exact: true });
    await expect(militia).toHaveAttribute('aria-disabled', 'true');
    await militia.focus();
    await owner.keyboard.press('Enter');
    const explanation = owner.getByRole('dialog', { name: /^No militia/ });
    await expect(explanation).toBeVisible();
    await expect(
      explanation.getByRole('link', { name: 'Switch campaign', exact: true }),
    ).toBeVisible();
    await owner.keyboard.press('Escape');
    await tabs.getByRole('link', { name: 'Characters', exact: true }).click();
    await expect(owner).toHaveURL(/\/characters$/);
    await expect(
      owner
        .getByRole('region', { name: 'No campaign', exact: true })
        .getByRole('link', { name: new RegExp(`^${privateName}`) }),
    ).toBeVisible();
    await expectBottomBarPinned(owner);
  });
});
