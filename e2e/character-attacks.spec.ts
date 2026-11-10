import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { exerciseCharacterAttacks } from './support/character-attacks';
import { resolveCaseSheetPath } from './support/case-sheet';
import { test } from './support/fixtures';
import { loadRun, savePrivate } from './support/process';

// Attack Routines (#314), split from the living Character Sheet journey
// (#752): two members edit one Fighter's routines by keyboard and touch on
// the fixture's fresh sheet. Strength 12 gives the representative Longsword
// its +1 to attack and damage.

const tablet = { width: 1024, height: 768 };

function findScores(page: Page) {
  return page
    .getByRole('main')
    .getByRole('region', { name: 'Ability scores', exact: true });
}

test.use({ caseKey: 'characterAttacks', viewport: tablet });
test('Attack Routines support keyboard and touch in both member sessions', async ({
  players,
  ownedCase,
}, info) => {
  // The routines took 35.4 s inside the Character Sheet journey (#752).
  test.setTimeout(120_000);
  const run = await loadRun();
  const url = await resolveCaseSheetPath(ownedCase);
  const a = players.gm;
  const b = players.player;
  const shot = async (page: Page, name: string) =>
    savePrivate(
      join(
        run.artifactDirectory,
        `${info.project.name}-character-attacks-${name}.png`,
      ),
      await page.screenshot({ fullPage: true }),
    );

  await test.step('both members open the sheet, and the owner sets Strength 12', async () => {
    await Promise.all([a.goto(url), b.goto(url)]);
    await findScores(a)
      .getByRole('textbox', { name: 'Strength', exact: true })
      .fill('12');
    await findScores(a)
      .getByRole('button', { name: 'Save scores', exact: true })
      .click();
    for (const page of [a, b])
      await expect(
        findScores(page).getByRole('textbox', {
          name: 'Strength',
          exact: true,
        }),
      ).toHaveValue('12');
  });

  await exerciseCharacterAttacks({ a, b, shot });
});
