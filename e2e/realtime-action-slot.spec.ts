import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { openCampaignSection } from './support/interactions';
import { saveState } from './support/week-frame';

// Teams corrections on the Militia page (#176): the fixture militia starts
// without teams.
async function correctTeams(
  page: Page,
  reason: string,
  edit: () => Promise<void>,
) {
  await edit();
  await page
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill(reason);
  await page
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(page.getByText('Teams corrected.').first()).toBeVisible();
}
async function enterTeam(page: Page, position: number, name: string) {
  const team = page.getByRole('group', {
    name: `Team ${position}`,
    exact: true,
  });
  await team
    .getByRole('textbox', { name: 'Team name', exact: true })
    .fill(name);
  for (const [group, choice] of [
    ['Team type', 'defenders'],
    ['Team condition', 'active'],
  ])
    await team
      .getByRole('group', { name: group, exact: true })
      .getByRole('button', { name: choice, exact: true })
      .click();
}
async function openTeams(page: Page) {
  await openCampaignSection(page, 'militia');
  await page.getByRole('button', { name: /^Teams/ }).click();
}

test.use({ caseKey: 'realtimeActionSlot' });
test('players share a Staged Action Choice', async ({ players }) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await openCampaignSection(page, 'week');
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
  }
  const slot = (page: typeof players.gm) =>
    page.getByRole('group', { name: 'Action Slot 1', exact: true });
  await slot(players.player)
    .getByRole('button', {
      name: 'Choose an action for Action Slot 1',
      exact: true,
    })
    .tap();
  await players.player
    .getByRole('dialog')
    .getByRole('button', { name: 'Earn Gold', exact: true })
    .tap();
  await expect(slot(players.gm)).toContainText('Earn Gold');
  await players.player.reload();
  await players.player
    .getByRole('button', { name: 'Activity', exact: true })
    .click();
  await expect(slot(players.player)).toContainText('Earn Gold');

  // A team the staged choice uses: added in Militia Teams, then chosen.
  const { gm, player } = players;
  await openTeams(gm);
  await gm.getByRole('button', { name: 'Correct teams', exact: true }).click();
  await correctTeams(gm, 'Scouts joined', async () => {
    await gm.getByRole('button', { name: 'Add team', exact: true }).click();
    await enterTeam(gm, 1, 'Scouts');
  });
  await expect(slot(player).getByText('Earn Gold')).toBeVisible();
  await player
    .getByRole('button', { name: 'Action Slot 1 · Earn Gold', exact: true })
    .click();
  await player.getByRole('combobox', { name: 'Team', exact: true }).click();
  await player.getByRole('option', { name: /^Scouts · / }).click();
  await expect(saveState(player)).toHaveAttribute(
    'data-week-feedback',
    'saved',
  );

  // Removing it names the slot before saving and leaves the choice without
  // its team.
  await gm.getByRole('button', { name: 'Correct teams', exact: true }).click();
  await correctTeams(gm, 'Scouts disbanded', async () => {
    await gm
      .getByRole('button', { name: 'Remove Team 1', exact: true })
      .click();
    const affects = gm.getByRole('complementary', {
      name: 'This affects the open week',
      exact: true,
    });
    await expect(affects).toContainText(
      'Removing Scouts leaves Activity slot 1 (Earn Gold) without a team.',
    );
    await expect(
      affects.getByRole('link', { name: 'Activity slot 1', exact: true }),
    ).toHaveAttribute('href', /\/week\?phase=activity$/);
  });

  // The other device never saw the team: it restores it under the same
  // identity from facts entered again.
  await openTeams(player);
  const missing = player.getByRole('region', {
    name: 'Missing from the militia',
    exact: true,
  });
  await expect(
    missing.getByText('A missing team', { exact: true }),
  ).toBeVisible();
  await missing
    .getByRole('button', {
      name: 'Restore missing team for Activity slot 1',
      exact: true,
    })
    .click();
  await expect(player.getByText('Needed by Activity slot 1')).toBeVisible();
  await correctTeams(player, 'Scouts were removed by mistake', () =>
    enterTeam(player, 1, 'Scouts'),
  );
  await expect(missing).toHaveCount(0);
  await expect(
    gm.getByRole('region', { name: 'Missing from the militia' }),
  ).toHaveCount(0);
  await player.reload();
  await player.getByRole('button', { name: /^Teams/ }).click();
  // The index row's preview repeats the name but is hidden below xl.
  await expect(
    player
      .getByText('Scouts', { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    player.getByRole('region', { name: 'Missing from the militia' }),
  ).toHaveCount(0);
});
