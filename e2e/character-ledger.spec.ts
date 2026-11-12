import { openCampaignSection } from './support/interactions';
import { test, expect } from './support/fixtures';
import { reviewCharacterCorrectionLayouts } from './support/character-corrections-layout';
import { loadRun } from './support/process';

test.use({ caseKey: 'characterLedger' });
test('players share character and officer assignment changes', async ({
  players,
}, info) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await openCampaignSection(page, 'week');
    // Continue week: the first week's first unready phase is Event.
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Event' }),
    ).toBeVisible();
    await openCampaignSection(page, 'officers');
  }
  const player = players.player;
  await player
    .getByRole('region', { name: 'Characters', exact: true })
    .getByRole('button', { name: 'Add character', exact: true })
    .click();
  const dialog = player.getByRole('dialog', {
    name: 'Add character',
    exact: true,
  });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Nara');
  // A cleared Hit Dice is refused in place, never saved as zero.
  const hitDice = dialog.getByRole('textbox', {
    name: 'Hit Dice',
    exact: true,
  });
  await hitDice.fill('');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('Hit Dice is required')).toBeVisible();
  await hitDice.fill('4');
  await dialog.getByRole('textbox', { name: 'STR', exact: true }).fill('16');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  const gmCharacters = players.gm.getByRole('region', {
    name: 'Characters',
    exact: true,
  });
  await expect(
    gmCharacters.getByRole('row').filter({ hasText: 'Nara' }),
  ).toContainText(/Not on roster.*Nara.*4 HD/);
  // The GM's record dialog opens with the player's scores.
  await gmCharacters
    .getByRole('button', { name: 'Edit Nara', exact: true })
    .click();
  const gmRecord = players.gm.getByRole('dialog', {
    name: 'Edit character',
    exact: true,
  });
  await expect(
    gmRecord.getByRole('textbox', { name: 'STR', exact: true }),
  ).toHaveValue('16');
  await gmRecord.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(gmRecord).toBeHidden();
  // Correct roster: Nara joins with her record's kind and a quick-pick
  // reason; the GM sees her on the roster at once.
  await player
    .getByRole('button', { name: 'Correct roster', exact: true })
    .click();
  await player
    .getByRole('switch', { name: 'Nara on roster', exact: true })
    .click();
  await player
    .getByRole('button', { name: 'New officer joined', exact: true })
    .click();
  await player
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(
    player.getByRole('region', { name: 'Correct roster', exact: true }),
  ).toBeHidden();
  const naraRow = gmCharacters.getByRole('row').filter({ hasText: 'Nara' });
  await expect(naraRow).toContainText(/On roster.*Nara.*4 HD/);

  // Both open Correct officers on their own device. The player assigns Nara
  // as Marshal and saves first; the GM's later Save is refused as a
  // conflict, never merged over the player's assignment.
  const gm = players.gm;
  await gm
    .getByRole('button', { name: 'Correct officers', exact: true })
    .click();
  await player
    .getByRole('button', { name: 'Correct officers', exact: true })
    .click();
  const assign = async (page: typeof player, role: string) => {
    await page
      .getByRole('button', { name: `Assign ${role}`, exact: true })
      .click();
    await page
      .getByRole('dialog', { name: `Assign ${role}`, exact: true })
      .getByRole('button', { name: /^Nara/ })
      .click();
  };
  await assign(player, 'Marshal');
  await player
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill('Assign Nara as marshal');
  await player
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(
    player.getByRole('region', { name: 'Correct officers', exact: true }),
  ).toBeHidden();
  await assign(gm, 'Spymaster');
  await gm.getByRole('button', { name: 'Story change', exact: true }).click();
  await gm
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  const gmCorrection = gm.getByRole('region', {
    name: 'Correct officers',
    exact: true,
  });
  await expect(gmCorrection.getByRole('alert')).toContainText(
    'Another player changed this section',
  );
  await gmCorrection
    .getByRole('button', { name: 'Start again from their values', exact: true })
    .click();
  await expect(
    gmCorrection.getByRole('textbox', {
      name: 'Reason for correction',
      exact: true,
    }),
  ).toHaveValue('');
  const marshal = gm
    .getByRole('region', { name: 'Officers', exact: true })
    .getByRole('region', { name: 'Marshal', exact: true });
  await expect(marshal).toContainText('Nara');
  await gmCorrection
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(naraRow).toContainText(/On roster.*Nara.*4 HD.*Marshal/);
  // The accepted role survives a reload.
  await gm.reload();
  await expect(marshal).toContainText('Nara');
  await expect(naraRow).toContainText(/On roster.*Nara.*4 HD.*Marshal/);
  // Both corrections at phone and desktop sizes (#141): the Assign picker,
  // Nara's ⋯ menu and the reason bar stay reachable; both are cancelled.
  await test.step('both corrections stay reachable on phone and desktop', async () =>
    reviewCharacterCorrectionLayouts(
      gm,
      { name: 'Nara', role: 'Marshal', vacant: 'Spymaster' },
      (await loadRun()).artifactDirectory,
      info.project.name,
    ));
  await expect(marshal).toContainText('Nara');
  await expect(naraRow).toContainText(/On roster.*Nara.*4 HD.*Marshal/);
});
