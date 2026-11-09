import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { measureVisibleControls } from './control-geometry';
import { savePrivate } from './process';
import type { controlNextDraftEdit } from './held-mutation';
import { expectSaveFailed, saveState } from './week-frame';
import { reviewSummaryExceptionReason } from './summary-qa';

const phase = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).click();
const event = (page: Page, name: string) =>
  page.getByRole('group', { name, exact: true });
const button = (group: Locator, name: string) =>
  group.getByRole('button', { name, exact: true });
const editor = (page: Page) => page.locator('[data-week-editor]');
// The rules cost for this fixture's rank: 2 × the 20 gp minimum treasury.
const BUY_OFF = 'Buy off · 40 gp';
export const BUYOFF_STAGED = 'Ends · buyoff 40 gp';
export const THEFT_CHECKED = 'Success · This Theft keeps 90%';
export const RIVALRY_ENDED = 'Success · Ends the Rivalry for good.';
const reason = (group: Locator) =>
  group.getByRole('textbox', { name: 'Rules Exception reason', exact: true });

export async function exercisePersistentWorkspace(
  gm: Page,
  player: Page,
  network: Awaited<ReturnType<typeof controlNextDraftEdit>>,
  artifactDirectory: string,
) {
  await Promise.all([phase(gm, 'Persistent'), phase(player, 'Persistent')]);
  const old = (page: Page) => event(page, 'Theft · Event 1');
  const recent = (page: Page) => event(page, 'Theft · Event 2');
  const rivalry = (page: Page) => event(page, 'Rivalry · Event 3');
  await expect(old(gm)).toBeVisible();
  await expect(recent(player)).toBeVisible();
  await expect(rivalry(player)).toContainText('Scouts');
  await expect(rivalry(player)).toContainText('Rangers');
  await expect(editor(gm)).toContainText('First buyoff available now');
  await expect(editor(gm)).toContainText('40 gp (2 × minimum treasury)');
  // Removed controls stay removed: no Clear decision, no recorded amount.
  await expect(button(old(gm), 'Clear decision')).toHaveCount(0);
  await expect(old(gm).getByRole('textbox')).toHaveCount(0);
  await button(old(gm), BUY_OFF).click();
  await expect(button(old(gm), BUY_OFF)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(old(player)).toContainText(BUYOFF_STAGED);
  await expect(old(player)).toContainText(
    'Buyoff cost 40 gp (2 × minimum treasury) · taken from the treasury at Confirmation',
  );
  await expect(editor(gm)).toContainText('Next buyoff week 8');
  await expect(recent(player)).not.toContainText(BUYOFF_STAGED);
  await button(recent(player), BUY_OFF).click();
  await expect(recent(gm)).toContainText('Buyoff needs a Rules Exception');
  await expect(reason(recent(gm))).toBeVisible();
  await reason(recent(gm)).fill('The table permits both buyoffs this week.');
  await button(recent(gm), 'Save reason').click();
  await expect(recent(player)).toContainText(BUYOFF_STAGED);
  await reviewSummaryExceptionReason(gm, player, reason(recent(player)));
  // Leave it is the deliberate reset; the shared cooldown exception stays.
  await button(recent(player), 'Leave it').click();
  await expect(recent(gm)).not.toContainText(BUYOFF_STAGED);
  await expect(button(recent(gm), 'Remove exception')).toBeVisible();
  await button(recent(gm), 'Remove exception').click();
  await expect(button(recent(player), 'Remove exception')).toHaveCount(0);

  // Choosing Ended at the table is local until a nonempty outcome is saved:
  // the other device keeps seeing the saved buyoff meanwhile.
  await button(old(gm), 'Ended at the table').click();
  await expect(old(gm).getByRole('status')).toContainText(
    'Not saved yet. Buy off still applies until you save how it ended.',
  );
  await button(old(gm), 'Save how it ended').click();
  await expect(old(gm)).toContainText('Describe how it ended.');
  await expect(old(player)).toContainText(BUYOFF_STAGED);
  await old(gm)
    .getByRole('textbox', { name: 'How it ended', exact: true })
    .fill('The table recovered the stolen goods.');
  // The half-typed ending is kept when this player leaves Persistent.
  await phase(gm, 'Review & confirm');
  await phase(gm, 'Persistent');
  await expect(
    old(gm).getByRole('textbox', { name: 'How it ended', exact: true }),
  ).toHaveValue('The table recovered the stolen goods.');
  // The ending asks for its Rules Exception reason in the same step.
  await reason(old(gm)).fill('The thieves agreed to leave the militia alone.');
  await button(old(gm), 'Save how it ended').click();
  await expect(old(player)).toContainText('Ends · recorded at the table');
  await expect(reason(old(player))).toHaveValue(
    'The thieves agreed to leave the militia alone.',
  );
  await expect(recent(player)).not.toContainText(
    'Ends · recorded at the table',
  );
  await button(old(player), 'Leave it').click();
  await expect(old(gm)).not.toContainText('Ends · recorded at the table');
  await button(old(gm), 'Loyalty check (this week only)').click();
  // Overseer support is the shared toggle, not a field of the form; this
  // militia has no Overseer, so it says so instead of offering a switch.
  await expect(old(player)).toContainText(
    'No Overseer is assigned, so no Overseer support this week.',
  );
  await expect(old(gm).getByRole('switch')).toHaveCount(0);
  // The Theft Loyalty check is its own 1d20 dice total field: no generic
  // roll builder, dice list or sides.
  await expect(
    old(gm).getByText('1d20 · total of the dice only'),
  ).toBeVisible();
  await expect(button(old(gm), 'Add rolls')).toHaveCount(0);
  await expect(
    old(gm).getByRole('button', { name: 'Add dice entry', exact: true }),
  ).toHaveCount(0);
  const die = old(gm).getByRole('textbox', {
    name: 'Loyalty check',
    exact: true,
  });
  // Zero is a recorded total with an advisory; blank clears it.
  await die.fill('0');
  await expect(old(player)).toContainText('Failure · Half of this week’s');
  await die.fill('');
  await expect(old(player)).not.toContainText('Failure ·');
  // Malformed text is refused in the field and never sent.
  await die.pressSequentially('x');
  await expect(die).toHaveValue('');
  await expect(die).toHaveAttribute('aria-invalid', 'true');
  await expect(die).toHaveAccessibleDescription(/Use digits only\./);
  await expect(old(player)).not.toContainText('Success ·');
  await die.fill('20');
  // The other Theft still takes half of this week's gains.
  await expect(old(player)).toContainText(THEFT_CHECKED);
  await expect(old(player)).toContainText(
    'Stays · check succeeded · another Theft still halves gains',
  );

  const observer = await gm.context().newPage();
  try {
    await observer.goto(gm.url());
    await phase(observer, 'Persistent');
    await expect(old(observer)).toContainText(THEFT_CHECKED);
    const held = network.hold();
    await button(old(gm), 'Leave it').click();
    await held;
    await expect(saveState(gm)).toHaveAttribute(
      'data-week-feedback',
      'pending',
    );
    await phase(gm, 'Event');
    await expect(
      player.getByRole('heading', { name: /· Persistent$/ }),
    ).toBeVisible();
    await button(old(player), BUY_OFF).click();
    await expect(old(observer)).toContainText(BUYOFF_STAGED);
    network.release();
    await expectSaveFailed(gm);
    await expect(gm.getByRole('heading', { name: /· Event$/ })).toBeVisible();
  } finally {
    network.release();
    await observer.close();
  }
  await phase(gm, 'Persistent');
  await expect(old(gm)).toContainText(BUYOFF_STAGED);
  await button(old(gm), 'Leave it').click();
  await expect(old(player)).not.toContainText(BUYOFF_STAGED);
  await button(old(player), BUY_OFF).click();
  await expect(old(gm)).toContainText(BUYOFF_STAGED);
  await button(recent(gm), BUY_OFF).click();
  await reason(recent(gm)).fill('The table permits both buyoffs this week.');
  await button(recent(gm), 'Save reason').click();
  await expect(recent(player)).toContainText(BUYOFF_STAGED);

  await button(rivalry(player), 'Officer check to end it').click();
  // An officer's own skill check: character with role context, one skill,
  // a signed skill bonus and one d20 total. No skill is preselected.
  const skill = rivalry(player).getByRole('combobox', {
    name: 'Skill',
    exact: true,
  });
  await expect(skill).toContainText('Choose a skill');
  await rivalry(player)
    .getByRole('combobox', { name: 'Character', exact: true })
    .click();
  await player
    .getByRole('option')
    .filter({ hasNotText: 'not an officer' })
    .first()
    .click();
  await skill.click();
  await player.getByRole('option', { name: 'Diplomacy', exact: true }).click();
  await rivalry(player)
    .getByRole('textbox', { name: 'Skill bonus', exact: true })
    .fill('0');
  await rivalry(player)
    .getByRole('textbox', { name: 'Officer check roll', exact: true })
    .fill('20');
  await expect(rivalry(gm)).toContainText(RIVALRY_ENDED);
  for (const page of [gm, player]) {
    await phase(page, 'Event');
    await phase(page, 'Persistent');
    await expect(
      page.getByRole('heading', { name: /· Persistent$/ }),
    ).toBeVisible();
    await expect(old(page)).toBeVisible();
    await expect(recent(page)).toBeVisible();
    await expect(rivalry(page)).toBeVisible();
  }
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await gm.setViewportSize({ width, height });
    for (const control of await measureVisibleControls(
      gm
        .locator('section[aria-label="Persistent preparation"]')
        .getByRole('button'),
      name,
    )) {
      const { bounds } = control;
      const label = `${name}: ${control.ariaLabel ?? control.text}`;
      expect(bounds, label).not.toBeNull();
      expect(bounds!.x, label).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, label).toBeLessThanOrEqual(width);
      expect(control.contentFits, `${label} text fits`).toBe(true);
    }
    await savePrivate(
      join(artifactDirectory, `canonical-persistent-${name}.png`),
      await gm.screenshot({ fullPage: true }),
    );
  }
  await gm.setViewportSize({ width: 1194, height: 834 });
}
