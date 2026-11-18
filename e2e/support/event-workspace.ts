import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { measureVisibleControls } from './control-geometry';
import { savePrivate } from './process';
import { expectNoHorizontalOverflow } from './responsive-shell';
import type { controlNextDraftEdit } from './held-mutation';
import { expectSaveFailed, saveState } from './week-frame';
export async function exerciseEventWorkspace(
  gm: Page,
  player: Page,
  network: Awaited<ReturnType<typeof controlNextDraftEdit>>,
  artifactDirectory: string,
) {
  const phase = (page: Page, name: string) =>
    page.getByRole('button', { name, exact: true }).click();
  const chance = (page: Page) =>
    page.getByRole('textbox', { name: 'Event chance roll', exact: true });
  // Blocks are labelled hierarchically: Roll Twice children of Event 1 are
  // Event 1.1 and Event 1.2, whatever else is added later. `path` is the part
  // after "Event ".
  const table = (page: Page, path: string) =>
    page.getByRole('textbox', {
      name: `Event ${path} table roll`,
      exact: true,
    });
  const occurrence = (page: Page, path: string) =>
    page.getByRole('group', { name: `Event ${path}`, exact: true });
  await Promise.all([phase(gm, 'Event'), phase(player, 'Event')]);
  const previousChance = await chance(gm).inputValue();
  // A triggered chance roll prepares the rolled event's blank position on
  // every device; nobody adds it by hand.
  await chance(gm).fill('1');
  await expect(chance(player)).toHaveValue('1');
  await expect(table(player, '1')).toHaveValue('');
  await expect(table(player, '1')).toBeEnabled();
  await table(gm, '1').fill('50');
  await expect(
    occurrence(player, '1').getByText('Two more', { exact: true }),
  ).toBeVisible();
  // The first Roll Twice brings its two blank child positions with it.
  await expect(table(player, '1.1')).toHaveValue('');
  await expect(table(player, '1.2')).toHaveValue('');
  await expect(table(player, '1.1')).toBeEnabled();
  await expect(table(player, '1.2')).toBeEnabled();
  for (const retired of [
    'Add rolled event',
    'Add Roll Twice child',
    'Add replacement event',
    'Remove Event 1 and its branches',
  ])
    await expect(
      gm.getByRole('button', { name: retired, exact: true }),
    ).toHaveCount(0);
  await table(gm, '1.1').fill('45');
  await table(player, '1.2').fill('82');
  await expect(
    occurrence(gm, '1.2').getByText('Invasion', { exact: true }),
  ).toBeVisible();
  // Moving Event 1 away from Roll Twice hides its children; returning restores
  // them with their rolls and identities.
  await table(gm, '1').fill('10');
  await expect(table(player, '1.1')).toBeHidden();
  await expect(table(player, '1.2')).toBeHidden();
  await table(gm, '1').fill('50');
  await expect(table(player, '1.1')).toHaveValue('45');
  await expect(table(player, '1.2')).toHaveValue('82');
  // All Is Calm (45–48) asks for nothing; beside Invasion it has no effect.
  const outcomes = (page: Page, path: string) =>
    occurrence(page, path).getByRole('list', {
      name: `Event ${path} outcomes`,
      exact: true,
    });
  await expect(outcomes(player, '1.1')).toHaveText(
    '›No effect: another event happens this week.',
  );
  await expect(
    occurrence(player, '1.1').getByRole('textbox', {
      name: 'What happened',
      exact: true,
    }),
  ).toHaveCount(0);
  // Invasion's own controls: the Average Party Level and a required What
  // happened, each entered on one device and shown on the other.
  const partyLevel = (page: Page) =>
    occurrence(page, '1.2').getByRole('textbox', {
      name: 'Average Party Level',
      exact: true,
    });
  const invasionNote = (page: Page) =>
    occurrence(page, '1.2').getByRole('textbox', {
      name: 'What happened',
      exact: true,
    });
  await partyLevel(gm).fill('4');
  await expect(partyLevel(player)).toHaveValue('4');
  await invasionNote(player).fill('The table drove the invaders away.');
  await occurrence(player, '1.2')
    .getByRole('button', { name: 'Save what happened', exact: true })
    .click();
  await expect(invasionNote(gm)).toHaveValue(
    'The table drove the invaders away.',
  );
  await expect(outcomes(gm, '1.2')).toHaveText(
    '›The GM runs a combat encounter at CR 5 (Average Party Level 4 + 1).',
  );
  await table(gm, '1.1').fill('0');
  await expect(table(player, '1.1')).toHaveValue('0');
  await table(gm, '1.1').fill('');
  await expect(table(player, '1.1')).toHaveValue('');
  // Sickness (89–96) asks for its team on cards and for what happened; a
  // choice on one device shows as chosen on the other.
  await table(gm, '1.1').fill('90');
  const sickTeam = (page: Page) =>
    occurrence(page, '1.1').getByRole('group', {
      name: /^Team that falls sick/,
    });
  const firstTeam = (page: Page) =>
    sickTeam(page).getByRole('button', { pressed: false }).first();
  const teamName = await firstTeam(player).getAttribute('aria-label');
  await firstTeam(player).click();
  await expect(
    sickTeam(gm).getByRole('button', { name: teamName!, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Sabotage is offered only when a Saboteurs team exists; this militia has
  // none, so the happening Sickness offers no reaction.
  await expect(
    occurrence(gm, '1.1').getByRole('button', {
      name: /^Sabotage this event · Event 1\.1/,
    }),
  ).toHaveCount(0);
  const happened = (page: Page) =>
    occurrence(page, '1.1').getByRole('textbox', {
      name: 'What happened',
      exact: true,
    });
  await happened(gm).fill('The fever reached the camp.');
  await occurrence(gm, '1.1')
    .getByRole('button', { name: 'Save what happened', exact: true })
    .click();
  await expect(happened(player)).toHaveValue('The fever reached the camp.');
  await occurrence(player, '1.1')
    .getByRole('button', { name: 'Clear what happened', exact: true })
    .click();
  await sickTeam(player)
    .getByRole('button', { name: 'Clear team that falls sick', exact: true })
    .click();
  await expect(happened(gm)).toHaveValue('');
  // The GM's next roll saves the whole occurrence it sees. Built before the
  // cleared team arrives, it would be refused as stale (#143 §5), so the GM
  // first sees the player's clear.
  await expect(
    sickTeam(gm).getByRole('button', { name: teamName!, exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  // Found Fire (21–24): a reward for the militia's PC, entered in gp to the
  // copper on one device, appears on the other. The GM's next roll waits for
  // it, as it would otherwise save the occurrence without the reward.
  await table(gm, '1.1').fill('22');
  const rewards = (page: Page) =>
    occurrence(page, '1.1').getByRole('group', {
      name: /^Rewards for .+ · Event 1\.1$/,
    });
  await rewards(player)
    .getByRole('button', { name: /^Add reward for .+ · Event 1\.1$/ })
    .click();
  const reward = rewards(player).getByRole('group', {
    name: /^New reward for .+ · Event 1\.1$/,
  });
  await reward
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Tanglefoot bag');
  await reward
    .getByRole('textbox', { name: 'Value (gp)', exact: true })
    .fill('0.07');
  await reward
    .getByRole('textbox', { name: 'Weight (lb)', exact: true })
    .fill('4');
  await reward
    .getByRole('button', { name: 'Save reward · Event 1.1', exact: true })
    .click();
  await expect(
    rewards(gm).getByText('0.07 gp · 4 lb · alchemical', { exact: true }),
  ).toBeVisible();
  // Theft (73–76): its optional mitigation is chosen on one device and its
  // Loyalty check appears on the other. The GM's next roll waits for it, as
  // it would otherwise save the occurrence without the choice.
  await table(gm, '1.1').fill('74');
  const attemptTheft = occurrence(player, '1.1').getByRole('button', {
    name: 'Attempt it for Event 1.1',
    exact: true,
  });
  await expect(attemptTheft).toHaveAttribute('aria-pressed', 'false');
  await attemptTheft.click();
  await expect(
    occurrence(gm, '1.1').getByRole('textbox', {
      name: 'Loyalty check',
      exact: true,
    }),
  ).toBeEnabled();
  await table(gm, '1.1').fill('45');
  await expect(table(player, '1.1')).toHaveValue('45');
  const observer = await gm.context().newPage();
  try {
    await observer.goto(gm.url());
    await phase(observer, 'Event');
    await expect(table(observer, '1.1')).toHaveValue('45');
    const held = network.hold();
    await table(gm, '1.1').fill('46');
    await held;
    await expect(saveState(gm)).toHaveAttribute(
      'data-week-feedback',
      'pending',
    );
    await phase(gm, 'Review & confirm');
    await table(player, '1.1').fill('47');
    // A third read-only tab proves the competing mutation was accepted before releasing the stale edit.
    await expect(table(observer, '1.1')).toHaveValue('47');
    network.release();
    await expectSaveFailed(gm);
    await expect(
      gm.getByRole('heading', { name: /· Review & confirm$/ }),
    ).toBeVisible();
  } finally {
    network.release();
    await observer.close();
  }
  await phase(gm, 'Event');
  await expect(table(gm, '1.1')).toHaveValue('47');
  await table(gm, '1.1').fill('45');
  await expect(table(player, '1.1')).toHaveValue('45');
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await gm.setViewportSize({ width, height });
    await expectNoHorizontalOverflow(gm);
    for (const button of await measureVisibleControls(
      gm.locator('section[aria-label="Event preparation"]').getByRole('button'),
      name,
    )) {
      const { bounds } = button;
      const label = `${name}: ${button.ariaLabel ?? button.text}`;
      expect(bounds, label).not.toBeNull();
      expect(bounds!.x, label).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, label).toBeLessThanOrEqual(width);
      expect(button.contentFits, `${label} text fits`).toBe(true);
    }
    await savePrivate(
      join(artifactDirectory, `canonical-event-${name}.png`),
      await gm.screenshot({ fullPage: true }),
    );
  }
  await occurrence(gm, '1.2')
    .getByRole('button', { name: 'Clear what happened', exact: true })
    .click();
  await expect(invasionNote(player)).toHaveValue('');
  // Restore the supported journey's quiet week so its exact Confirmation
  // assertions remain meaningful. The recorded events stay on record, unused.
  await chance(gm).fill(previousChance);
  await expect(chance(player)).toHaveValue(previousChance);
  await expect(table(player, '1')).toBeHidden();
  await expect(
    player.getByText(/^Kept on record, not used this week/),
  ).toBeVisible();
  await gm.setViewportSize({ width: 1194, height: 834 });
}
