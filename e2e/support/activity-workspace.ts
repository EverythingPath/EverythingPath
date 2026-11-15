import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { savePrivate } from './process';
import { expectNoHorizontalOverflow } from './responsive-shell';
import type { controlNextDraftEdit } from './held-mutation';
import { expectSaveFailed, reviewConfirm, saveState } from './week-frame';

const slot = (page: Page, position: number) =>
  page.getByRole('group', { name: `Action Slot ${position}`, exact: true });
const card = (page: Page, position: number, action: string) =>
  page.getByRole('button', {
    name: `Action Slot ${position} · ${action}`,
    exact: true,
  });
const empty = (page: Page, position: number) =>
  page.getByRole('button', {
    name: `Choose an action for Action Slot ${position}`,
    exact: true,
  });
const details = (page: Page, position: number) =>
  page.getByRole('region', {
    name: `Action Slot ${position} details`,
    exact: true,
  });
const saved = (page: Page) =>
  expect(saveState(page)).toHaveAttribute('data-week-feedback', 'saved');
async function pick(page: Page, action: string) {
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: action, exact: true }).click();
  await expect(sheet).toHaveCount(0);
}
async function choose(page: Page, action: string, position: number) {
  await empty(page, position).click();
  await pick(page, action);
  await saved(page);
}
async function open(page: Page, position: number, action: string) {
  await card(page, position, action).click();
  await expect(details(page, position)).toBeVisible();
  return details(page, position);
}
async function menu(page: Page, name: string, option: RegExp | string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page
    .getByRole('option', {
      name: option,
      ...(typeof option === 'string' ? { exact: true } : {}),
    })
    .click();
}
async function moveTo(
  page: Page,
  position: number,
  action: string,
  target: string,
) {
  await open(page, position, action);
  await menu(page, `Move Action Slot ${position} to`, target);
  await saved(page);
}

// The fixture week is rank 2 (two actions) with slots 1–2 inside the
// allowance, an empty extra slot 3, and the recovered Patrons team Scouts.
export async function exerciseActivityWorkspace(
  gm: Page,
  player: Page,
  network: Awaited<ReturnType<typeof controlNextDraftEdit>>,
  artifactDirectory: string,
) {
  await gm.setViewportSize({ width: 1194, height: 834 });

  await gm.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(gm.getByText(/^\d+ of 2$/)).toBeVisible();
  await choose(gm, 'Earn Gold', 1);
  // Each player keeps their own Phase View.
  await expect(
    player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
  ).toBeVisible();
  await player.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(card(player, 1, 'Earn Gold')).toBeVisible();

  // Team, cost and check roll on the staged choice.
  const earn = await open(gm, 1, 'Earn Gold');
  await menu(gm, 'Team', /^Scouts · /);
  await saved(gm);
  await earn
    .getByRole('textbox', { name: 'Cost (copper)', exact: true })
    .fill('0');
  await saved(gm);
  await earn
    .getByRole('textbox', { name: 'Check roll', exact: true })
    .fill('10');
  await saved(gm);
  await expect(earn.getByText(/^Bonus [+-]\d+$/)).toBeVisible();
  await expect(
    slot(player, 1).getByText('Scouts', { exact: true }),
  ).toBeVisible();

  // Move a whole choice, then stage and describe another one.
  await moveTo(gm, 1, 'Earn Gold', 'Action Slot 2 (empty)');
  await expect(card(player, 2, 'Earn Gold')).toBeVisible();
  await choose(player, 'Gather Information', 1);
  const gather = await open(player, 1, 'Gather Information');
  await gather
    .getByRole('textbox', { name: 'Subject', exact: true })
    .fill('Ironfang patrol routes');
  await gather
    .getByRole('button', { name: 'Save subject', exact: true })
    .click();
  await saved(player);

  // Swap carries every detail of both choices.
  await moveTo(
    gm,
    2,
    'Earn Gold',
    'Swap with Action Slot 1 · Gather Information',
  );
  await expect(card(player, 1, 'Earn Gold')).toBeVisible();
  await expect(card(player, 2, 'Gather Information')).toBeVisible();
  await expect(
    (await open(player, 2, 'Gather Information')).getByRole('textbox', {
      name: 'Subject',
      exact: true,
    }),
  ).toHaveValue('Ironfang patrol routes');
  const moved = await open(player, 1, 'Earn Gold');
  await expect(
    moved.getByRole('combobox', { name: 'Team', exact: true }),
  ).toContainText('Scouts');
  await expect(
    moved.getByRole('textbox', { name: 'Cost (copper)', exact: true }),
  ).toHaveValue('0');
  await expect(
    moved.getByRole('textbox', { name: 'Check roll', exact: true }),
  ).toHaveValue('10');

  // An ineligible team stays selectable and needs a reasoned exception.
  const second = await open(gm, 2, 'Gather Information');
  await menu(gm, 'Team', /^Scouts · /);
  await saved(gm);
  const teamException = second.getByRole('group', {
    name: 'Team Action Limit exception',
    exact: true,
  });
  await teamException
    .getByRole('textbox', { name: 'Exception reason', exact: true })
    .fill('The table lets Scouts gather this rumour too');
  await teamException
    .getByRole('button', { name: 'Save exception reason', exact: true })
    .click();
  await saved(gm);

  // An extra slot keeps its choice with an amber warning and blocks
  // Confirmation until it is moved back.
  await moveTo(gm, 1, 'Earn Gold', 'Action Slot 3 (empty)');
  await expect(card(player, 3, 'Earn Gold')).toBeVisible();
  await expect(slot(gm, 3).getByText('Beyond the allowance')).toBeVisible();
  const extra = await open(gm, 3, 'Earn Gold');
  await expect(extra.getByText(/restore the action allowance/)).toBeVisible();
  await expect(
    extra.getByRole('group', { name: 'Action Capacity exception' }),
  ).toHaveCount(0);
  await gm
    .getByRole('button', { name: 'Review & confirm', exact: true })
    .click();
  await expect(reviewConfirm(gm)).toBeDisabled();
  await expect(
    gm
      .getByRole('region', { name: 'Required decisions' })
      .getByText(/restore the action allowance/),
  ).toBeVisible();
  await gm.getByRole('button', { name: 'Activity', exact: true }).click();
  await moveTo(gm, 3, 'Earn Gold', 'Action Slot 1 (empty)');
  await expect(card(player, 1, 'Earn Gold')).toBeVisible();
  await expect(slot(gm, 1).getByText('Beyond the allowance')).toHaveCount(0);

  // Only an empty slot beyond the allowance can be removed; later slots
  // keep their places, and every player sees the removal.
  await expect(
    slot(gm, 1).getByRole('button', { name: /^Remove Action Slot/ }),
  ).toHaveCount(0);
  await gm.getByRole('button', { name: 'Add slot', exact: true }).click();
  await saved(gm);
  await expect(slot(player, 4)).toBeVisible();
  await slot(gm, 4)
    .getByRole('button', { name: 'Remove Action Slot 4', exact: true })
    .click();
  await saved(gm);
  await expect(slot(player, 4)).toHaveCount(0);
  await expect(slot(player, 3)).toBeVisible();

  // Clearing leaves the slot; closing the picker places nothing.
  await (await open(gm, 1, 'Earn Gold'))
    .getByRole('button', { name: 'Clear Earn Gold', exact: true })
    .click();
  await saved(gm);
  await expect(empty(player, 1)).toBeVisible();
  // Keyboard: open the picker from the slot and close it back onto the slot.
  await empty(gm, 1).focus();
  await gm.keyboard.press('Enter');
  await expect(gm.getByRole('dialog')).toBeVisible();
  await gm.keyboard.press('Escape');
  await expect(gm.getByRole('dialog')).toHaveCount(0);
  await expect(empty(gm, 1)).toBeFocused();
  await expect(empty(player, 1)).toBeVisible();

  // A stale replacement is rejected and the player sees the accepted choice.
  await choose(gm, 'Drill Militia', 1);
  const captured = network.hold();
  await (await open(gm, 1, 'Drill Militia'))
    .getByRole('button', { name: 'Change action', exact: true })
    .click();
  await pick(gm, 'Lie Low');
  await captured;
  await gm.getByRole('button', { name: 'Event', exact: true }).click();
  await (await open(player, 1, 'Drill Militia'))
    .getByRole('button', { name: 'Change action', exact: true })
    .click();
  await pick(player, 'Gather Information');
  await saved(player);
  network.release();
  await expectSaveFailed(gm);
  await gm.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(card(gm, 1, 'Gather Information')).toBeVisible();
  await (await open(gm, 1, 'Gather Information'))
    .getByRole('button', { name: 'Change action', exact: true })
    .click();
  await pick(gm, 'Drill Militia');
  await saved(gm);
  await expect(card(player, 1, 'Drill Militia')).toBeVisible();
  // Drill stays staged without rolls until it is cleared below, so the
  // confirmed week does not depend on it. Its conditional rolls have their
  // own journey (`exerciseDrillRolls`).

  // A market purchase is entered in gp, kept to the copper with its decimal
  // weight, and the other player sees it. Its details stay open for the
  // layout checks below.
  await choose(player, 'Broker Market', 3);
  const market = await open(gm, 3, 'Broker Market');
  await market
    .getByRole('button', { name: 'Add purchase', exact: true })
    .click();
  const purchase = market.getByRole('form', { name: 'New purchase' });
  await purchase
    .getByRole('textbox', { name: 'Item name', exact: true })
    .fill('Potion of healing');
  await purchase
    .getByRole('textbox', { name: 'Price (gp)', exact: true })
    .fill('12.34');
  await purchase
    .getByRole('textbox', { name: 'Weight (lb)', exact: true })
    .fill('0.5');
  await purchase
    .getByRole('button', { name: 'Save purchase', exact: true })
    .click();
  await saved(gm);
  await expect(
    (await open(player, 3, 'Broker Market')).getByRole('list', {
      name: 'Purchases',
      exact: true,
    }),
  ).toContainText('Potion of healing · 12.34 gp · 0.5 lb');

  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await gm.setViewportSize({ width, height });
    await expectNoHorizontalOverflow(gm);
    await savePrivate(
      join(artifactDirectory, `canonical-activity-${name}.png`),
      await gm.screenshot({ fullPage: true }),
    );
  }
  await gm.setViewportSize({ width: 390, height: 844 });
  await details(gm, 3)
    .getByRole('button', { name: 'Change action', exact: true })
    .click();
  await expect(gm.getByRole('dialog')).toBeVisible();
  await expectNoHorizontalOverflow(gm);
  await savePrivate(
    join(artifactDirectory, 'canonical-activity-picker-phone.png'),
    await gm.screenshot(),
  );
  await gm.keyboard.press('Escape');
  await expect(gm.getByRole('dialog')).toHaveCount(0);
  await gm.setViewportSize({ width: 1194, height: 834 });

  // Leave the Activity empty for the later phases.
  await (await open(gm, 2, 'Gather Information'))
    .getByRole('group', { name: 'Team Action Limit exception', exact: true })
    .getByRole('button', { name: 'Remove exception', exact: true })
    .click();
  await saved(gm);
  for (const [position, action] of [
    [1, 'Drill Militia'],
    [2, 'Gather Information'],
    [3, 'Broker Market'],
  ] as const) {
    await (await open(gm, position, action))
      .getByRole('button', { name: `Clear ${action}`, exact: true })
      .click();
    await expect(empty(player, position)).toBeVisible();
  }
  // Guarantee Event's candidates run in the recovery journey, on the same
  // empty Activity just before its Event checks (`exerciseGuaranteeEvent`).
  await Promise.all([
    gm.getByRole('button', { name: 'Upkeep', exact: true }).click(),
    player.getByRole('button', { name: 'Upkeep', exact: true }).click(),
  ]);
}

/**
 * Drill's conditional rolls on the plain fixture week, from an empty Action
 * Slot 1 in Activity on both devices. Moved from the Activity-and-Event
 * journey (#198) so that journey keeps its margin.
 */
export async function exerciseDrillRolls(gm: Page, player: Page) {
  await choose(gm, 'Drill Militia', 1);
  await expect(card(player, 1, 'Drill Militia')).toBeVisible();
  // Drill's training roll is its own shared total input in the details,
  // shown once the check succeeds, and the other player sees the recorded
  // total. Its notoriety roll shows only on a natural 1.
  const drill = await open(gm, 1, 'Drill Militia');
  const drillCheck = drill.getByRole('textbox', {
    name: 'Check roll',
    exact: true,
  });
  const drillNotoriety = drill.getByRole('textbox', {
    name: 'Notoriety roll',
    exact: true,
  });
  await expect(drillNotoriety).toHaveCount(0);
  await drillCheck.fill('1');
  await expect(drillNotoriety).toBeVisible();
  await drillCheck.fill('20');
  await expect(drillNotoriety).toHaveCount(0);
  await saved(gm);
  // The fixture militia is rank 2 with a level-2 PC, already at its maximum
  // rank, so Drill resolves only with a reasoned exception. Until then the
  // check has no result and the Training roll stays hidden; with it, 20 plus
  // the non-negative Loyalty bonus meets DC 12 (10 + rank) and it appears.
  const drillTraining = drill.getByRole('textbox', {
    name: 'Training roll',
    exact: true,
  });
  await expect(drillTraining).toHaveCount(0);
  const maximumRank = drill.getByRole('group', {
    name: 'Maximum Rank exception',
    exact: true,
  });
  await maximumRank
    .getByRole('textbox', { name: 'Exception reason', exact: true })
    .fill('The table drills beyond the rank cap');
  await maximumRank
    .getByRole('button', { name: 'Save exception reason', exact: true })
    .click();
  await saved(gm);
  await drillTraining.fill('7');
  await saved(gm);
  await expect(
    (await open(player, 1, 'Drill Militia')).getByRole('textbox', {
      name: 'Training roll',
      exact: true,
    }),
  ).toHaveValue('7');
}

// Guarantee Event's candidates: Event prepares both on every device, a
// candidate's Roll Twice is rerolled in its own die with no nested events,
// and the choice's details show the chosen candidate. Clearing the choice
// takes its candidates with it, so the later Event steps and the exact
// Confirmation totals start from the same week as before. Both devices start
// and end on an empty Activity.
export async function exerciseGuaranteeEvent(gm: Page, player: Page) {
  const action = 'Guarantee Event';
  await choose(gm, action, 1);
  const details = await open(gm, 1, action);
  await details
    .getByRole('textbox', { name: 'Notoriety roll', exact: true })
    .fill('3');
  await saved(gm);
  await details
    .getByRole('button', { name: 'Roll and choose in Event', exact: true })
    .click();
  await player.getByRole('button', { name: 'Event', exact: true }).click();
  const table = (page: Page, label: string) =>
    page.getByRole('textbox', { name: `${label} table roll`, exact: true });
  const block = (page: Page, label: string) =>
    page.getByRole('group', { name: label, exact: true });
  await expect(table(player, 'Event 1A')).toBeEnabled();
  await expect(table(player, 'Event 1B')).toBeEnabled();
  await table(gm, 'Event 1A').fill('50');
  await expect(
    block(player, 'Event 1A').getByText('Reroll', { exact: true }),
  ).toBeVisible();
  await expect(table(player, 'Event 1A.1')).toHaveCount(0);
  await table(gm, 'Event 1A').fill('45');
  await table(player, 'Event 1B').fill('82');
  await expect(table(gm, 'Event 1B')).toHaveValue('82');
  await block(player, 'Event 1B')
    .getByRole('button', { name: 'Choose this event', exact: true })
    .click();
  await expect(
    block(gm, 'Event 1B').getByRole('button', {
      name: 'This one happens',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Both devices return to Activity, where the later checks look.
  await Promise.all([
    gm.getByRole('button', { name: 'Activity', exact: true }).click(),
    player.getByRole('button', { name: 'Activity', exact: true }).click(),
  ]);
  const candidates = (await open(gm, 1, action)).getByRole('list', {
    name: 'Event candidates for this choice',
    exact: true,
  });
  await expect(candidates.getByRole('listitem')).toHaveText([
    /^Event 1A.*All Is Calm/,
    /^Event 1B.*Invasion.*Chosen/,
  ]);
  await (await open(gm, 1, action))
    .getByRole('button', { name: `Clear ${action}`, exact: true })
    .click();
  await expect(empty(player, 1)).toBeVisible();
}
