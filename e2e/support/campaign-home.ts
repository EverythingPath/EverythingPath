import { expect, type Page } from '@playwright/test';
import {
  campaignRows,
  expectSelectedCampaign,
  selectCampaign,
} from './interactions';
import {
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';

// Campaign list/home (#187): URL-backed selection, the full description and
// in-game date header, and its two independent saves observed by a second
// member without reload. Its content (#189): Continue week's target, the
// militia line and the empty finished-weeks preview. Creating campaigns is
// covered below the browser (the fixture harness cannot clean up UI-created
// campaigns).

// The selected campaign's home is a region named by the campaign.
function pane(page: Page, campaignName: string) {
  return page.getByRole('region', { name: campaignName, exact: true });
}

// Starts every page on the campaign list, so it also owns the members' and
// the outsider's landing checks.
export async function exerciseCampaignHome(
  editor: Page,
  observer: Page,
  outsider: Page,
  campaignName: string,
) {
  for (const page of [editor, observer]) {
    await page.goto('/campaigns');
    await expectSelectedCampaign(page, campaignName);
    await expect(
      campaignRows(page).getByRole('link').filter({ hasText: campaignName }),
    ).toContainText(/Week \d+|Not set up/);
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
    ).toHaveCount(0);
  }
  // The selected home continues the week from current facts (#189): the
  // fixture's first week skips Upkeep and Activity needs nothing, so Continue
  // targets Event; no week has finished yet, All finished weeks stays linked.
  const selected = pane(editor, campaignName);
  await expect(
    selected.getByRole('link', { name: 'Continue week 1', exact: true }),
  ).toHaveAttribute('href', /\/week\?phase=event$/);
  await expect(selected.getByRole('region', { name: 'Militia' })).toContainText(
    'Rank 1 · Loyalty · No teams · 0 of 6 officer roles · No settlements',
  );
  await expect(selected.getByText('No finished weeks yet.')).toBeVisible();
  await expect(
    selected.getByRole('link', { name: 'All finished weeks', exact: true }),
  ).toHaveAttribute('href', /\/history$/);
  await expect(
    selected.getByRole('link', { name: 'Set up militia' }),
  ).toHaveCount(0);
  // Outsiders see their own empty organization and no trace of this campaign.
  await outsider.goto('/campaigns');
  await expect(
    outsider.getByText('No campaigns yet', { exact: true }),
  ).toBeVisible();
  await expect(
    outsider.getByRole('heading', {
      name: 'Create a campaign to get started.',
    }),
  ).toBeVisible();
  await expect(outsider.getByText(campaignName, { exact: true })).toHaveCount(
    0,
  );
  await expect(
    outsider.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toHaveCount(0);

  // Choosing the row records it in the address; reload and Back/Forward keep it.
  await selectCampaign(editor, campaignName);
  const home = editor.url();
  await editor.reload();
  await expectSelectedCampaign(editor, campaignName);
  await editor.goBack();
  await expect(editor).toHaveURL(/\/campaigns$/);
  await editor.goForward();
  await expect(editor).toHaveURL(home);
  await expectNoHorizontalOverflow(editor);

  // Edit: the name stays read-only; description and date save independently.
  const edit = editor.getByRole('button', { name: 'Edit campaign details' });
  await expectReachable(editor, edit);
  await edit.click();
  const description = editor.getByRole('textbox', {
    name: 'Description',
    exact: true,
  });
  await expect(description).toBeFocused();
  await expect(editor.getByRole('textbox', { name: /name/i })).toHaveCount(0);
  const text = 'Refugees regroup under Phaendar.\n\nThe Fangwood burns.';
  await description.fill(text);
  await editor
    .getByRole('button', { name: 'In-game date', exact: true })
    .click();
  await editor.getByRole('button', { name: '12', exact: true }).click();
  const chosen = await editor
    .getByRole('button', { name: 'In-game date', exact: true })
    .innerText();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    editor.getByRole('status').filter({ hasText: 'Saved.' }),
  ).toBeVisible();
  await expect(edit).toBeFocused();
  for (const page of [editor, observer]) {
    const header = pane(page, campaignName);
    await expect(header).toContainText('Refugees regroup under Phaendar.');
    await expect(header).toContainText('The Fangwood burns.');
    await expect(header).toContainText(chosen.trim());
  }
  // The other member's own selection and view were not moved.
  await expectSelectedCampaign(observer, campaignName);
  await expect(observer).toHaveURL(/\/campaigns$/);

  // Clearing both is an ordinary edit; Cancel before Save writes nothing.
  await edit.click();
  await description.fill('Not saved');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(pane(observer, campaignName)).not.toContainText('Not saved');
  await edit.click();
  await description.fill('');
  await editor.getByRole('button', { name: 'Clear date', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(pane(observer, campaignName)).not.toContainText(
    'Refugees regroup',
  );
  await expect(pane(observer, campaignName)).not.toContainText(chosen.trim());
  await editor.reload();
  await expect(pane(editor, campaignName)).not.toContainText('Refugees');
  // The outsider cannot open the campaign's home by address.
  await outsider.goto(new URL(home).pathname);
  await expect(
    outsider.getByText("This campaign isn't available", { exact: false }),
  ).toBeVisible();
  await expect(outsider.getByText(campaignName, { exact: true })).toHaveCount(
    0,
  );
}
