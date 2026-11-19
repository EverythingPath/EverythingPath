import { test, expect } from './support/fixtures';
import { openCampaignSection, selectCampaign } from './support/interactions';
import { openSetupStep } from './support/setup-workspace';

test.use({ caseKey: 'existingMilitia', comparisonCaseKey: 'isolation' });
test('existing militia state survives reload within its campaign', async ({
  page,
  ownedCase,
  comparisonCase,
}) => {
  await page.goto('/campaigns');
  await selectCampaign(page, ownedCase.campaignName);
  // Without a militia the home offers Set up militia instead of Continue.
  await openCampaignSection(page, 'setup');
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/setup$/);
  const setupUrl = page.url();
  await page
    .getByRole('button', { name: 'Existing militia', exact: true })
    .click();
  for (const [step, fields] of [
    [
      'Starting point',
      [
        ['Rank', 'four'],
        ['Training', '24'],
        ['Treasury (copper)', '72500'],
        ['Notoriety', '17'],
      ],
    ],
    [
      'Week',
      [
        ['Current week', '8'],
        ['Week start day', '49'],
      ],
    ],
  ] as const) {
    await openSetupStep(page, step);
    for (const [name, value] of fields)
      await page.getByRole('textbox', { name, exact: true }).fill(value);
  }
  // A character created inline is shared at once but joins the roster only
  // when chosen.
  await openSetupStep(page, 'People & officers');
  await page
    .getByRole('button', { name: 'Add character', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Add character',
    exact: true,
  });
  await dialog
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Setup Recruit');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page
    .getByRole('button', { name: 'Add Setup Recruit', exact: true })
    .click();
  // The record owns the kind: the recruit joins as the PC the dialog saved,
  // shown read-only, with no kind choice on the roster (#180).
  const recruit = page.getByRole('group', { name: 'Setup Recruit' });
  const kind = recruit.getByRole('group', { name: 'Kind', exact: true });
  await expect(kind).toHaveText(/^Kind\s*PC$/);
  await expect(
    recruit.getByRole('group', { name: 'Character kind' }),
  ).toHaveCount(0);
  // Reloading resumes the unfinished setup, invalid input included.
  await page.reload();
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'People & officers',
      exact: true,
    }),
  ).toBeVisible();
  await expect(kind).toHaveText(/^Kind\s*PC$/);
  await openSetupStep(page, 'Starting point');
  await expect(
    page.getByRole('button', { name: 'Existing militia', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const rank = page.getByRole('textbox', { name: 'Rank', exact: true });
  await expect(rank).toHaveValue('four');
  await expect(
    page.getByText('Enter a valid whole number for Rank.'),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Treasury (copper)', exact: true }),
  ).toHaveValue('72500');
  await rank.fill('4');
  await openSetupStep(page, 'Review & start');
  await page
    .getByRole('button', { name: 'Start militia week', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
  // A later visit to Setup stays on the started page until a link is chosen.
  await page.goto(setupUrl);
  await expect(page.getByText('This militia is already set up.')).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Rank', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Open militia', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open week 8', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
  await page.goto('/campaigns');
  await page.reload();
  await selectCampaign(page, ownedCase.campaignName);
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
  await openCampaignSection(page, 'militia');
  const correctValues = page.getByRole('button', {
    name: 'Correct values',
    exact: true,
  });
  const treasury = page.getByRole('textbox', {
    name: 'Treasury (copper)',
    exact: true,
  });
  await correctValues.click();
  await expect(treasury).toHaveValue('72500');
  await expect(
    page.getByRole('textbox', { name: 'Rank', exact: true }),
  ).toHaveValue('4');
  // Values are corrected on their own, with a reason, keeping every other
  // imported fact.
  await treasury.fill('80000');
  await page
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill('Sold a captured wand');
  await page
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(page.getByText('Values corrected.').first()).toBeVisible();
  await expect(page.getByText('800 gp (80,000 cp)')).toBeVisible();
  await correctValues.click();
  for (const [name, value] of [
    ['Treasury (copper)', '80000'],
    ['Rank', '4'],
    ['Training', '24'],
    ['Notoriety', '17'],
  ])
    await expect(
      page.getByRole('textbox', { name: name!, exact: true }),
    ).toHaveValue(value!);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  // Items are corrected on their own too, keeping a decimal weight.
  await page.getByRole('button', { name: /^Items/ }).click();
  await page
    .getByRole('button', { name: 'Correct items', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const item = page.getByRole('group', { name: 'Item 1', exact: true });
  for (const [name, value] of [
    ['Item name', 'Captured wand'],
    ['Item value (copper)', '7500'],
    ['Item weight', '0.5'],
  ])
    await item.getByRole('textbox', { name: name!, exact: true }).fill(value!);
  await page
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill('Kept a captured wand');
  await page
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(page.getByText('Items corrected.').first()).toBeVisible();
  await expect(page.getByText('0.5 lb')).toBeVisible();
  // Carried benefits are corrected on their own too (#178).
  await page.getByRole('button', { name: /^Carried benefits/ }).click();
  await page
    .getByRole('button', { name: 'Correct carried benefits', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add skill benefit', exact: true })
    .click();
  const benefit = page.getByRole('group', {
    name: 'Skill benefit 1',
    exact: true,
  });
  await benefit
    .getByRole('group', { name: 'Affected skills', exact: true })
    .getByRole('button', { name: 'stealth', exact: true })
    .click();
  await benefit
    .getByRole('textbox', { name: 'Skill bonus', exact: true })
    .fill('2');
  await page
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill('Festival favour');
  await page
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(
    page.getByText('Carried benefits corrected.').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '+2 bonus on Stealth', exact: true }),
  ).toBeVisible();
  await selectCampaign(page, comparisonCase!.campaignName);
  // Continue week: the comparison's first week skips Upkeep (#189).
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Event' }),
  ).toBeVisible();
  await selectCampaign(page, ownedCase.campaignName);
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
});
