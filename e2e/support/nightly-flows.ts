import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { openCampaignSection, selectCampaign } from './interactions';
import { expectReachable } from './responsive-shell';

// Both axes plus a trial click: modal controls may overlay the phone bar,
// non-modal ones must sit above it.
const fitsViewport = expectReachable;

export async function navigationAndPersistence(
  page: Page,
  campaignName: string,
) {
  await test.step('player: navigation, form layout, reload persistence and cross-layout edits', async () => {
    await openCampaignSection(page, 'officers');
    const characters = page.getByRole('region', {
      name: 'Characters',
      exact: true,
    });
    const add = characters.getByRole('button', {
      name: 'Add character',
      exact: true,
    });
    // Non-modal page control: reachable above the phone bottom bar.
    await fitsViewport(page, add);
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'Add character' });
    const name = dialog.getByRole('textbox', { name: 'Name', exact: true });
    const hitDice = dialog.getByRole('textbox', {
      name: 'Hit Dice',
      exact: true,
    });
    const save = dialog.getByRole('button', { name: 'Save', exact: true });
    for (const control of [name, hitDice, save])
      await fitsViewport(page, control);
    await name.fill('Nightly Scout');
    await hitDice.fill('4');
    await save.click();
    await expect(dialog).toBeHidden();
    // A table row from 768px, a character card below it.
    const row = characters
      .locator('tr, li')
      .filter({ has: page.getByText('Nightly Scout', { exact: true }) });
    await expect(
      row,
      'player: newly saved Nightly Scout appears',
    ).toContainText('4 HD');
    await page.reload();
    await selectCampaign(page, campaignName);
    await openCampaignSection(page, 'officers');
    await expect(
      row,
      'player: Nightly Scout with 4 Hit Dice survives reload',
    ).toContainText('4 HD');
    const original = page.viewportSize()!;
    await page.setViewportSize(
      original.width === 390
        ? { width: 1194, height: 834 }
        : { width: 390, height: 844 },
    );
    await row
      .getByRole('button', { name: 'Edit Nightly Scout', exact: true })
      .click();
    const edit = page.getByRole('dialog', { name: 'Edit character' });
    // A Character created in a campaign has a militia sheet (#261), so its
    // edit form names the field Level (use-character-record.ts levelLabel);
    // only the new-character form above says Hit Dice.
    const editLevel = edit.getByRole('textbox', {
      name: 'Level',
      exact: true,
    });
    await fitsViewport(page, editLevel);
    await editLevel.fill('5');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await page.setViewportSize(original);
    await page.reload();
    await selectCampaign(page, campaignName);
    await openCampaignSection(page, 'officers');
    await expect(
      row,
      'player: cross-layout edit persists as 5 Hit Dice',
    ).toContainText('5 HD');
    await openCampaignSection(page, 'week');
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Upkeep', exact: true }),
    ).toBeVisible();
  });
}
