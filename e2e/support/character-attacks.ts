import { expect, type Page } from '@playwright/test';
import { chooseClass } from './class-picker';
import { test } from './fixtures';
import { expectNoHorizontalOverflow } from './responsive-shell';

const attacks = (page: Page) =>
  page.getByRole('main').getByRole('region', { name: 'Attacks', exact: true });
const routine = (page: Page, name: string) =>
  attacks(page).getByRole('listitem', { name, exact: true });
const editor = (page: Page) =>
  page.getByRole('dialog', { name: 'Attack routine', exact: true });
const routineName = (page: Page) =>
  editor(page).getByRole('textbox', { name: 'Routine name', exact: true });
const levels = (page: Page) =>
  page
    .getByRole('main')
    .getByRole('region', { name: 'Class Levels', exact: true });

/** Edits Attack Routines in both touch-enabled member sessions (character-attacks.spec.ts). */
export async function exerciseCharacterAttacks({
  a,
  b,
  shot,
}: {
  a: Page;
  b: Page;
  shot: (page: Page, name: string) => Promise<unknown>;
}) {
  let routineId: string | null = null;
  await test.step('a representative weapon creates its default routine; single and full attacks explain their numbers', async () => {
    // Six Fighter levels give BAB +6/+1, making the full attack visibly different.
    await chooseClass({ page: a, level: 1, name: 'Fighter' });
    await expect(
      levels(b).getByText('Fighter 1', { exact: true }),
    ).toBeVisible();
    for (let level = 2; level <= 6; level++) {
      await levels(a)
        .getByRole('button', { name: 'Level up', exact: true })
        .click();
      for (const page of [a, b])
        await expect(
          levels(page).getByText(`Fighter ${level}`, { exact: true }),
        ).toBeVisible();
    }
    await attacks(a)
      .getByRole('button', { name: 'Add weapon', exact: true })
      .click();
    const catalog = attacks(a).getByRole('region', {
      name: 'Add weapon',
      exact: true,
    });
    await catalog
      .getByRole('button', { name: 'Longsword', exact: true })
      .click();
    for (const page of [a, b]) {
      const card = routine(page, 'Longsword');
      await expect(card).toContainText('Longsword · One hand · Melee');
      await expect(
        card
          .getByRole('list', { name: 'Single attack', exact: true })
          .getByRole('listitem'),
      ).toHaveCount(1);
      await expect(
        card
          .getByRole('list', { name: 'Full attack', exact: true })
          .getByRole('listitem'),
      ).toHaveCount(2);
      await expect(
        card.getByRole('button', {
          name: 'Longsword single attack: attack +7, breakdown',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        card.getByRole('button', {
          name: 'Longsword full attack 2 of 2: attack +2, breakdown',
          exact: true,
        }),
      ).toBeVisible();
    }
    routineId = await routine(a, 'Longsword')
      .getByRole('button', { name: 'Edit Longsword', exact: true })
      .getAttribute('data-routine-edit');
    expect(routineId).toBeTruthy();
    const damage = routine(a, 'Longsword').getByRole('button', {
      name: 'Longsword single attack: damage 1d8+1, breakdown',
      exact: true,
    });
    await damage.focus();
    await a.keyboard.press('Enter');
    const explanation = a.getByRole('group', {
      name: 'Longsword single attack: damage breakdown',
      exact: true,
    });
    await expect(explanation).toBeVisible();
    await expect(explanation).toContainText('Longsword');
    await expect(explanation).toContainText('damage dice');
    await expect(explanation).toContainText('Strength to damage');
    await a.keyboard.press('Escape');
    await expect(explanation).toHaveCount(0);
    await expect(damage).toBeFocused();
    await attacks(a)
      .getByRole('button', { name: 'Add weapon', exact: true })
      .click();
  });

  await test.step('keyboard edits save hands and thrown mode immediately and Done restores focus', async () => {
    const open = routine(a, 'Longsword').getByRole('button', {
      name: 'Edit Longsword',
      exact: true,
    });
    await open.focus();
    await a.keyboard.press('Enter');
    await expect(editor(a).getByRole('form')).toHaveAttribute('novalidate');
    await expect(editor(a).getByRole('button', { name: /^Save/ })).toHaveCount(
      0,
    );
    const hands = editor(a)
      .getByRole('radiogroup', { name: 'Held in', exact: true })
      .getByRole('radio', { name: 'Two hands', exact: true });
    await hands.focus();
    await a.keyboard.press('Space');
    await expect(routine(b, 'Longsword')).toContainText('Two hands · Melee');
    const thrown = editor(a)
      .getByRole('radiogroup', { name: 'Attack mode', exact: true })
      .getByRole('radio', { name: 'Thrown', exact: true });
    await thrown.focus();
    await a.keyboard.press('Space');
    await expect(routine(b, 'Longsword')).toContainText('Two hands · Thrown');
    await expect(
      editor(a).getByRole('region', { name: 'As it attacks now', exact: true }),
    ).toContainText('10 ft.');
    const done = editor(a).getByRole('button', { name: 'Done', exact: true });
    await done.focus();
    await a.keyboard.press('Enter');
    await expect(editor(a)).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  await test.step('both sessions observe edits; a retained draft can become the latest saved name', async () => {
    for (const page of [a, b])
      await routine(page, 'Longsword')
        .getByRole('button', { name: 'Edit Longsword', exact: true })
        .click();
    await routineName(b).fill('');
    await expect(editor(b).getByRole('alert')).toContainText(
      'Routine name is required',
    );
    await routineName(a).fill('Session A strike');
    await expect(
      editor(b).getByRole('form', {
        name: 'Edit Session A strike',
        exact: true,
      }),
    ).toBeVisible();
    await expect(routineName(b)).toHaveValue('');
    await expect(editor(b)).toContainText(
      'Changed by another player. Your edits are kept.',
    );
    await routineName(b).fill('Table strike');
    for (const page of [a, b]) {
      await expect(routineName(page)).toHaveValue('Table strike');
      await editor(page)
        .getByRole('button', { name: 'Done', exact: true })
        .click();
    }
  });

  await test.step('delete and Undo restore the same routine; the restored notice can be dismissed', async () => {
    await routine(a, 'Table strike')
      .getByRole('button', { name: 'Remove Table strike', exact: true })
      .click();
    for (const page of [a, b])
      await expect(routine(page, 'Table strike')).toHaveCount(0);
    await expect(attacks(a)).toContainText('Removed “Table strike”.');
    await attacks(a).getByRole('button', { name: 'Undo', exact: true }).click();
    for (const page of [a, b]) {
      await expect(routine(page, 'Table strike')).toBeVisible();
      await expect(
        routine(page, 'Table strike').getByRole('button', {
          name: 'Edit Table strike',
          exact: true,
        }),
      ).toHaveAttribute('data-routine-edit', routineId!);
    }
    await expect(attacks(a)).toContainText('Restored “Table strike”.');
    await attacks(a)
      .getByRole('button', { name: 'Dismiss', exact: true })
      .click();
    await expect(attacks(a)).not.toContainText('Restored “Table strike”.');
  });

  await test.step('removing Gear preserves its routine and a replacement repairs it with natural defaults', async () => {
    await attacks(a)
      .getByRole('button', { name: 'Add weapon', exact: true })
      .click();
    await attacks(a)
      .getByRole('region', { name: 'Add weapon', exact: true })
      .getByRole('button', { name: 'Dagger', exact: true })
      .click();
    await expect(routine(b, 'Dagger')).toBeVisible();
    await attacks(a)
      .getByRole('button', { name: 'Add weapon', exact: true })
      .click();
    await a
      .getByRole('main')
      .getByRole('region', { name: 'Sheet entries', exact: true })
      .getByRole('listitem', { name: 'Longsword', exact: true })
      .getByRole('button', { name: 'Remove Longsword', exact: true })
      .click();
    for (const page of [a, b]) {
      const card = routine(page, 'Table strike');
      await expect(card).toContainText(
        "Table strike's weapon is no longer in Gear.",
      );
      await expect(
        card.getByRole('list', { name: 'Single attack', exact: true }),
      ).toHaveCount(0);
    }
    await routine(a, 'Table strike')
      .getByRole('button', {
        name: 'Choose a weapon for Table strike',
        exact: true,
      })
      .click();
    await editor(a)
      .getByRole('radiogroup', { name: 'Main weapon', exact: true })
      .getByRole('radio', { name: 'Dagger', exact: true })
      .focus();
    await a.keyboard.press('Space');
    await expect(routine(b, 'Table strike')).toContainText(
      'Dagger · One hand · Melee',
    );
    await editor(a).getByRole('button', { name: 'Done', exact: true }).click();
    for (const page of [a, b]) {
      await expect(routine(page, 'Table strike')).toContainText(
        'Dagger · One hand · Melee',
      );
      await expect(
        routine(page, 'Table strike')
          .getByRole('list', { name: 'Single attack', exact: true })
          .getByRole('listitem'),
      ).toHaveCount(1);
      await expect(routine(page, 'Table strike')).not.toContainText(
        'weapon is no longer in Gear',
      );
    }
  });

  await test.step('tablet, phone and desktop keep the editor usable; a phone tap saves the chosen mode', async () => {
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await a.setViewportSize(viewport);
      await routine(a, 'Table strike')
        .getByRole('button', { name: 'Edit Table strike', exact: true })
        .click();
      await expect(editor(a)).toBeVisible();
      await expectNoHorizontalOverflow(a);
      if (viewport.width === 390) {
        await editor(a)
          .getByRole('radiogroup', { name: 'Attack mode', exact: true })
          .getByText('Thrown', { exact: true })
          .tap();
        await expect(routine(b, 'Table strike')).toContainText(
          'One hand · Thrown',
        );
      }
      await shot(a, `attacks-${viewport.width}`);
      await editor(a)
        .getByRole('button', { name: 'Done', exact: true })
        .click();
    }
    await a.setViewportSize({ width: 1024, height: 768 });
    for (const page of [a, b]) {
      await page.reload();
      await expect(routine(page, 'Table strike')).toContainText(
        'Dagger · One hand · Thrown',
      );
      await expect(
        routine(page, 'Table strike').getByRole('button', {
          name: 'Edit Table strike',
          exact: true,
        }),
      ).toHaveAttribute('data-routine-edit', routineId!);
    }
  });
}
