import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { controlSheetWrites } from './support/character-sheet-transport';
import { resolveCaseSheetPath } from './support/case-sheet';
import { test } from './support/fixtures';
import { loadRun, savePrivate } from './support/process';
import {
  expectBottomBarPinned,
  expectControlsReachable,
  expectNoHorizontalOverflow,
  expectReachable,
} from './support/responsive-shell';

// The living Character Sheet (#256): two members edit one Character's base
// scores and Class Levels at the same time on the fixture campaign.
// Every expectation is what each browser shows; the authorized read behind
// it is the same subscription both sheets render. Attack Routines are their
// own journey (character-attacks.spec.ts, #752).

const tablet = { width: 1024, height: 768 };
const phone = { width: 390, height: 844 };

function findSheet(page: Page) {
  return page.getByRole('main');
}
function findLevels(page: Page) {
  return findSheet(page).getByRole('region', {
    name: 'Class Levels',
    exact: true,
  });
}
function findLevel(page: Page, n: number) {
  return findLevels(page).getByRole('listitem', {
    name: `Level ${n}`,
    exact: true,
  });
}
function findHitPoints(page: Page, n: number) {
  return findLevel(page, n).getByRole('textbox', {
    name: `Hit points gained at level ${n}`,
    exact: true,
  });
}
function findDeleteQuestion(page: Page, n: number) {
  return findLevel(page, n).getByRole('group', {
    name: `Delete Unspecified (level ${n})?`,
    exact: true,
  });
}
function findScores(page: Page) {
  return findSheet(page).getByRole('region', {
    name: 'Ability scores',
    exact: true,
  });
}
function findScore(page: Page, name: string) {
  return findScores(page).getByRole('textbox', { name, exact: true });
}
function findSummary(page: Page) {
  return findSheet(page).locator('[data-sheet-summary]');
}
function findSummaryValue(page: Page, label: string) {
  return findSummary(page)
    .getByText(label, { exact: true })
    .locator('xpath=following-sibling::dd[1]');
}
async function saveScores(page: Page) {
  await findScores(page)
    .getByRole('button', { name: 'Save scores', exact: true })
    .click();
}
async function saveHp(page: Page, n: number) {
  await findLevel(page, n)
    .getByRole('button', { name: 'Save hit points', exact: true })
    .click();
}
async function expectScore(
  page: Page,
  name: string,
  value: string,
  modifier: string,
) {
  await expect(findScore(page, name)).toHaveValue(value);
  await expect(
    findScores(page).getByRole('button', {
      name: `${name} modifier ${modifier}, breakdown`,
      exact: true,
    }),
  ).toBeAttached();
}
async function readRowId(row: Locator) {
  return (await row.getAttribute('id'))!;
}
// The summary follows the Back row at rest and pins under the top bar on scroll.
async function expectSummaryPinned(page: Page) {
  for (const y of [0, 400, 100_000]) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    const header = (await page
      .locator('[data-shell-frame] > header')
      .boundingBox())!;
    const summary = (await findSummary(page).boundingBox())!;
    expect(header.y, 'the top bar stays at the top').toBeCloseTo(0, 0);
    if (y === 0)
      expect(
        summary.y,
        'the summary row sits below the top bar',
      ).toBeGreaterThanOrEqual(header.y + header.height - 1);
    else
      expect(
        Math.abs(summary.y - (header.y + header.height)),
        'the summary row sits immediately under the top bar',
      ).toBeLessThanOrEqual(1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
}

test.use({ caseKey: 'characterSheet', viewport: tablet });
test('two players edit one living sheet; failures stay local and rows keep their identity', async ({
  players,
  ownedCase,
}, info) => {
  test.setTimeout(240_000);
  const run = await loadRun();
  const convexUrl = run.fixture!.convexUrl;
  const url = await resolveCaseSheetPath(ownedCase);
  const a = players.gm;
  const b = players.player;
  const bWrites = await controlSheetWrites(b, convexUrl);
  const shot = async (page: Page, name: string) =>
    savePrivate(
      join(
        run.artifactDirectory,
        `${info.project.name}-character-sheet-${name}.png`,
      ),
      await page.screenshot({ fullPage: true }),
    );

  await test.step('both members open the fresh sheet', async () => {
    for (const page of [a, b]) {
      await page.goto(url);
      await expect(
        findSummary(page).getByRole('heading', {
          level: 1,
          name: 'E2E character-sheet-character',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText('E2E character-sheet-character', { exact: true }),
      ).toHaveCount(1);
      await expect(
        findSheet(page)
          .getByRole('region', { name: 'Character', exact: true })
          .getByText('PC', { exact: true }),
      ).toBeVisible();
      await expect(findSummary(page)).not.toContainText('PC');
      await expect(findSummaryValue(page, 'Level')).toHaveText('1');
      await expect(findSummaryValue(page, 'HP')).toContainText('not complete');
      await expect(findHitPoints(page, 1)).toHaveValue('');
      for (const name of [
        'Strength',
        'Dexterity',
        'Constitution',
        'Intelligence',
        'Wisdom',
        'Charisma',
      ])
        await expect(findScore(page, name)).toHaveValue('10');
      await expect(
        page.getByRole('button', { name: /roll|average|maximum|default/i }),
      ).toHaveCount(0);
      await expect(
        findScores(page).getByRole('button', {
          name: /delete|remove|disable/i,
        }),
      ).toHaveCount(0);
      await expect(
        findSheet(page).getByRole('link', {
          name: 'Characters',
          exact: true,
        }),
      ).toBeVisible();
    }
    await shot(a, 'tablet-fresh');
  });
  const firstRow = await readRowId(findLevel(a, 1));

  await test.step('a saved score reaches the other sheet, never announced to its author', async () => {
    await findScore(a, 'Strength').fill('14');
    await saveScores(a);
    await expect(
      findScores(a).getByRole('status').filter({ hasText: 'Scores saved.' }),
    ).toBeVisible();
    await expectScore(b, 'Strength', '14', '+2');
    await expect(
      findScores(b).getByText('Updated by another player.', { exact: true }),
    ).toBeVisible();
    await expect(
      findScores(a).getByText(/Updated by another player/),
    ).toHaveCount(0);
    await findScores(b)
      .getByRole('button', {
        name: 'Dismiss ability scores update',
        exact: true,
      })
      .click();
  });

  await test.step('a dirty, invalid field survives a remote change while pristine fields follow it', async () => {
    await findScore(b, 'Strength').fill('oops');
    await saveScores(b);
    await expect(
      findScores(b).getByText('Strength must be a number'),
    ).toBeVisible();
    await findScore(a, 'Dexterity').fill('16');
    await findScore(a, 'Strength').fill('18');
    await saveScores(a);
    await expect(
      findScores(a).getByRole('status').filter({ hasText: 'Scores saved.' }),
    ).toBeVisible();
    await expect(findScore(b, 'Dexterity')).toHaveValue('16');
    await expect(findScore(b, 'Strength')).toHaveValue('oops');
    await expect(
      findScores(b).getByText('Strength must be a number'),
    ).toBeVisible();
    await expect(
      findScores(b).getByText(
        'Updated by another player. Your edits are kept.',
      ),
    ).toBeVisible();
    await findScore(b, 'Strength').fill('12');
    await saveScores(b);
    await expect(
      findScores(b).getByText('Strength must be a number'),
    ).toHaveCount(0);
    for (const page of [a, b]) {
      await expectScore(page, 'Strength', '12', '+1');
      await expectScore(page, 'Dexterity', '16', '+3');
    }
  });

  await test.step('zero, blank and fractional hit points are recorded as typed; a second level is appended', async () => {
    await findHitPoints(a, 1).fill('0');
    await saveHp(a, 1);
    for (const page of [a, b]) {
      await expect(findHitPoints(page, 1)).toHaveValue('0');
      await expect(findSummaryValue(page, 'HP')).toHaveText('0');
    }
    await findHitPoints(a, 1).fill('');
    await saveHp(a, 1);
    for (const page of [a, b]) {
      await expect(findHitPoints(page, 1)).toHaveValue('');
      await expect(findSummaryValue(page, 'HP')).toContainText('not complete');
    }
    await findHitPoints(a, 1).fill('8');
    await saveHp(a, 1);
    await expect(findLevel(a, 1).getByText('Hit points saved.')).toBeVisible();
    await findLevels(a)
      .getByRole('button', { name: 'Level up', exact: true })
      .click();
    await expect(findHitPoints(a, 2)).toBeFocused();
    await expect(findHitPoints(a, 2)).toHaveValue('');
    await findHitPoints(a, 2).fill('5');
    await saveHp(a, 2);
    for (const page of [a, b]) {
      await expect(findSummaryValue(page, 'Level')).toHaveText('2');
      await expect(findSummaryValue(page, 'Hit Dice')).toHaveText('2');
      await expect(findSummaryValue(page, 'HP')).toHaveText('13');
      await expect(findLevels(page).getByRole('listitem')).toHaveCount(2);
    }
    await expect(
      findLevels(b).getByText('Class Levels updated by another player.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(findHitPoints(b, 2)).not.toBeFocused();
    await findLevels(b)
      .getByRole('button', {
        name: 'Dismiss Class Levels update',
        exact: true,
      })
      .click();
  });

  await test.step('a draft and its focus travel with the row through a reorder and save to that row', async () => {
    await findHitPoints(b, 1).fill('7');
    await expect(findHitPoints(b, 1)).toBeFocused();
    await findLevel(a, 1)
      .getByRole('button', { name: 'Move level 1 down', exact: true })
      .click();
    const moved = findLevel(b, 2);
    await expect(moved).toHaveAttribute('id', firstRow);
    await expect(findHitPoints(b, 2)).toHaveValue('7');
    await expect(findHitPoints(b, 2)).toBeFocused();
    await expect(findHitPoints(b, 1)).toHaveValue('5');
    await saveHp(b, 2);
    for (const page of [a, b]) {
      await expect(findLevel(page, 2)).toHaveAttribute('id', firstRow);
      await expect(findHitPoints(page, 2)).toHaveValue('7');
      await expect(findHitPoints(page, 1)).toHaveValue('5');
      await expect(findSummaryValue(page, 'HP')).toHaveText('12');
    }
  });

  await test.step('a definite refusal stays beside its editor and retains the draft; a lost reply needs review unless already observed', async () => {
    bWrites.refuseNext('characterSheet:editClassLevel');
    await findHitPoints(b, 1).fill('11');
    await saveHp(b, 1);
    await expect(findLevel(b, 1).getByRole('alert')).toHaveText(
      "Changes weren't saved: Sheet writes are refused (test). Your edits are kept. Save to try again.",
    );
    await expect(findHitPoints(b, 1)).toHaveValue('11');
    await expect(findHitPoints(a, 1)).toHaveValue('5');
    await findScore(a, 'Wisdom').fill('13');
    await saveScores(a);
    await expectScore(b, 'Wisdom', '13', '+1');
    expect(bWrites.isArmed()).toBe(false);
    await saveHp(b, 1);
    await expect(findLevel(b, 1).getByText('Hit points saved.')).toBeVisible();
    for (const page of [a, b]) {
      await expect(findHitPoints(page, 1)).toHaveValue('11');
      await expect(findLevels(page).getByRole('listitem')).toHaveCount(2);
    }
    bWrites.obscureNext('characterSheet:editClassLevel');
    await findHitPoints(b, 1).fill('9');
    await saveHp(b, 1);
    // A matching update observed before the failure acknowledges the write.
    // If the failure arrives first, the editor conservatively asks for review.
    await expect(findHitPoints(a, 1)).toHaveValue('9');
    await expect(
      findLevel(b, 1).getByText(
        /^(Hit points saved\.|Changes may not have been saved\.)/,
      ),
    ).toBeVisible();
    await expect(findHitPoints(b, 1)).toHaveValue('9');
  });

  await test.step('deleting asks first and keeps the survivor; deleting the last level leaves the advisory and Level up', async () => {
    await findLevel(a, 2)
      .getByRole('button', { name: 'Delete level 2', exact: true })
      .click();
    await findDeleteQuestion(a, 2)
      .getByRole('button', { name: 'Delete level 2', exact: true })
      .click();
    for (const page of [a, b]) {
      await expect(findLevels(page).getByRole('listitem')).toHaveCount(1);
      await expect(findLevel(page, 1)).not.toHaveAttribute('id', firstRow);
      await expect(findHitPoints(page, 1)).toHaveValue('9');
    }
    const trash = findLevel(a, 1).getByRole('button', {
      name: 'Delete level 1',
      exact: true,
    });
    await expect(trash).toBeFocused();
    // By keyboard: Enter asks, Keep has focus and hands it back to the
    // trash; asking again, Shift+Tab reaches Delete.
    await a.keyboard.press('Enter');
    await expect(
      findDeleteQuestion(a, 1).getByRole('button', {
        name: 'Keep level 1',
        exact: true,
      }),
    ).toBeFocused();
    await a.keyboard.press('Enter');
    await expect(findDeleteQuestion(a, 1)).toHaveCount(0);
    await expect(trash).toBeFocused();
    await expect(findLevels(a).getByRole('listitem')).toHaveCount(1);
    await a.keyboard.press('Enter');
    await a.keyboard.press('Shift+Tab');
    await expect(
      findDeleteQuestion(a, 1).getByRole('button', {
        name: 'Delete level 1',
        exact: true,
      }),
    ).toBeFocused();
    await a.keyboard.press('Enter');
    for (const page of [a, b]) {
      await expect(findLevels(page).getByRole('listitem')).toHaveCount(0);
      await expect(findSummaryValue(page, 'Level')).toHaveText('0');
      await expect(findSummaryValue(page, 'HP')).toHaveText('0');
      await expect(
        findLevels(page).getByText('A PC has no Class Levels.', {
          exact: true,
        }),
      ).toBeVisible();
    }
    const levelUp = findLevels(a).getByRole('button', {
      name: 'Level up',
      exact: true,
    });
    await expect(levelUp).toBeFocused();
    await a.keyboard.press('Enter');
    await expect(findHitPoints(a, 1)).toBeFocused();
    await expect(findHitPoints(a, 1)).toHaveValue('');
    await expect(findLevel(a, 1)).not.toHaveAttribute('id', firstRow);
    await expect(findHitPoints(b, 1)).toHaveValue('');
    await expect(findHitPoints(b, 1)).not.toBeFocused();
  });

  await test.step('the final values persist across a reload; an outsider sees no sheet', async () => {
    for (const page of [a, b]) {
      await page.reload();
      await expectScore(page, 'Strength', '12', '+1');
      await expectScore(page, 'Dexterity', '16', '+3');
      await expectScore(page, 'Wisdom', '13', '+1');
      await expect(findLevels(page).getByRole('listitem')).toHaveCount(1);
      await expect(findHitPoints(page, 1)).toHaveValue('');
    }
    await players.outsider.goto(url);
    await expect(
      players.outsider
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: 'This character isn’t available.' }),
    ).toBeVisible();
    await expect(
      players.outsider.getByText('E2E character-sheet-character'),
    ).toHaveCount(0);
    await expect(
      players.outsider.getByRole('textbox', { name: 'Strength' }),
    ).toHaveCount(0);
  });

  await test.step('tablet: the summary pins under the top bar and focused controls stay clear of it', async () => {
    await expectNoHorizontalOverflow(a);
    await expectSummaryPinned(a);
    await expectControlsReachable(
      a,
      findLevels(a),
      'tablet Class Levels',
      'focus',
    );
    await expectControlsReachable(
      a,
      findScores(a),
      'tablet Ability scores',
      'focus',
    );
    // A focused control is never under the pinned rows.
    await findScore(a, 'Charisma').focus();
    await expect(findScore(a, 'Charisma')).toBeFocused();
    const pinned = (await findSummary(a).boundingBox())!;
    const focused = (await findScore(a, 'Charisma').boundingBox())!;
    expect(focused.y).toBeGreaterThanOrEqual(pinned.y + pinned.height - 1);
    await shot(a, 'tablet-final');
  });

  await test.step('phone: the summary scrolls with the sheet and the last Save stays above the tabs', async () => {
    await a.setViewportSize(phone);
    await a.evaluate(() => window.scrollTo(0, 0));
    await a.waitForFunction(() => window.scrollY === 0);
    await expectNoHorizontalOverflow(a);
    await expectBottomBarPinned(a, true);
    await expect(findSummary(a)).toBeInViewport();
    await a.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(findSummary(a)).not.toBeInViewport();
    await expectReachable(
      a,
      findScores(a).getByRole('button', { name: 'Save scores', exact: true }),
    );
    await expectReachable(
      a,
      findLevels(a).getByRole('button', { name: 'Level up', exact: true }),
    );
    await expectControlsReachable(
      a,
      findLevels(a),
      'phone Class Levels',
      'focus',
    );
    await expect(
      a
        .getByRole('navigation', { name: 'Areas', exact: true })
        .locator('visible=true'),
    ).toHaveCount(1);
    await shot(a, 'phone-final');
    await a.setViewportSize(tablet);
  });
});
