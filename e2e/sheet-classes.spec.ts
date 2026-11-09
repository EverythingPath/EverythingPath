import { expect, type Locator, type Page } from '@playwright/test';
import { chooseClass } from './support/class-picker';
import { seededClassVersionLabel } from './support/class-rules';
import { resolveCaseSheetPath } from './support/case-sheet';
import { test } from './support/fixtures';
import {
  expectControlsReachable,
  expectNoHorizontalOverflow,
} from './support/responsive-shell';

// Class-dependent sheet pages. A Wizard's Spells page records a cantrip in
// the spellbook and stays usable at phone, tablet and desktop widths (#315).
// A two-level Rogue's "Rules used" chooser previews and switches both Rogue
// levels to Rogue (Unchained) only when asked, and another member's sheet
// follows (#583).
// Both classes are the representative definitions every prepared sheet
// carries, seeded on the Character itself: "Rules used" and the chooser name
// each version with that scope.

const phone = { width: 390, height: 844 };
const tablet = { width: 1024, height: 768 };
const desktop = { width: 1440, height: 900 };

function findLevels(page: Page) {
  return page
    .getByRole('main')
    .getByRole('region', { name: 'Class Levels', exact: true });
}
function findRulesUsed({ page, version }: { page: Page; version: string }) {
  return findLevels(page).getByRole('button', {
    name: `Rules used: ${seededClassVersionLabel(version)}`,
    exact: true,
  });
}
function findVersion({ panel, version }: { panel: Locator; version: string }) {
  return panel
    .getByRole('radiogroup', { name: 'Rules of Rogue', exact: true })
    .getByRole('radio', {
      name: seededClassVersionLabel(version),
      exact: true,
    });
}
// Both Rogue levels show the version in use, and neither shows the other.
async function expectRogueLevels({
  page,
  version,
}: {
  page: Page;
  version: 'Rogue' | 'Rogue (Unchained)';
}) {
  const other = version === 'Rogue' ? 'Rogue (Unchained)' : 'Rogue';
  for (const level of [1, 2]) {
    await expect(
      findLevels(page).getByText(`${version} ${level}`, { exact: true }),
    ).toBeVisible();
    await expect(
      findLevels(page).getByText(`${other} ${level}`, { exact: true }),
    ).toHaveCount(0);
  }
}
async function openRules(page: Page) {
  await findRulesUsed({ page, version: 'Rogue' }).click();
  const panel = page.getByRole('dialog', {
    name: 'Rules of Rogue',
    exact: true,
  });
  await expect(panel).toBeVisible();
  return panel;
}

test.use({ caseKey: 'sheetClasses', viewport: tablet });
test('a Wizard records a cantrip on the Spells page at every width, and a Rogue switches to Unchained rules only when asked while another member follows', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(240_000);
  const url = await resolveCaseSheetPath(ownedCase);
  const owner = players.gm;
  const member = players.player;

  await test.step('a Wizard opens the Spells page from the sheet’s Spellcasting', async () => {
    await owner.goto(url);
    await chooseClass({ page: owner, level: 1, name: 'Wizard' });
    await expect(
      findLevels(owner).getByText('Wizard 1', { exact: true }),
    ).toBeVisible();
    await owner
      .getByRole('main')
      .getByRole('region', { name: 'Spellcasting', exact: true })
      .getByRole('link', { name: /^Open spells for Wizard/ })
      .click();
    await expect(owner).toHaveURL(/\/characters\/[^/?]+\/spells/);
    await expect(
      owner.getByRole('heading', { level: 1, name: 'Spells', exact: true }),
    ).toBeVisible();
    await expect(
      owner
        .getByRole('region', { name: 'Spellbook', exact: true })
        .getByText('Nothing in the spellbook yet.', { exact: true }),
    ).toBeVisible();
  });

  await test.step('a cantrip goes into the spellbook from the Wizard list', async () => {
    await owner
      .getByRole('region', { name: 'Spellbook', exact: true })
      .getByRole('button', { name: 'Add Spells', exact: true })
      .first()
      .click();
    const browser = owner.getByRole('region', {
      name: 'Add to the spellbook',
      exact: true,
    });
    await expect(browser).toBeVisible();
    await browser
      .getByRole('tablist', { name: 'Spell level', exact: true })
      .getByRole('tab', { name: '0', exact: true })
      .click();
    const breeze = browser.getByRole('checkbox', {
      name: 'Record Breeze',
      exact: true,
    });
    // The box follows the server: it is checked once the record is saved.
    await breeze.click();
    await expect(breeze).toBeChecked();
    await expect(browser.getByText('Saved.').first()).toBeVisible();
    await expectNoHorizontalOverflow(owner);
    await browser.getByRole('button', { name: 'Done', exact: true }).click();
    // Done leaves Add mode at once, but clears `add=1` from the URL only
    // after a server round trip; a reload before then would reopen it.
    await expect(owner).not.toHaveURL(/[?&]add=1(&|$)/);
    await expect(
      owner.getByRole('region', { name: 'Spellbook', exact: true }),
    ).toContainText('Breeze');
  });

  await test.step('the Spells page fits phone, tablet and desktop widths with its controls reachable', async () => {
    for (const [name, size] of [
      ['phone', phone],
      ['desktop', desktop],
      ['tablet', tablet],
    ] as const) {
      await owner.setViewportSize(size);
      await owner.reload();
      const spellbook = owner.getByRole('region', {
        name: 'Spellbook',
        exact: true,
      });
      await expect(spellbook).toContainText('Breeze');
      await expectNoHorizontalOverflow(owner);
      await expectControlsReachable(
        owner,
        spellbook,
        `${name} Spellbook`,
        'focus',
      );
    }
  });

  await test.step('a two-level Rogue offers its rules; closing the chooser changes nothing', async () => {
    for (const page of [owner, member]) await page.goto(url);
    await chooseClass({ page: owner, level: 1, name: 'Rogue' });
    // Level up repeats the saved class, so Rogue must be saved first: the
    // other session shows it only once it is.
    for (const page of [owner, member])
      await expect(
        findLevels(page).getByText('Rogue 1', { exact: true }),
      ).toBeVisible();
    await findLevels(owner)
      .getByRole('button', { name: 'Level up', exact: true })
      .click();
    for (const page of [owner, member]) {
      await expectRogueLevels({ page, version: 'Rogue' });
      await expect(findRulesUsed({ page, version: 'Rogue' })).toBeVisible();
    }
    const panel = await openRules(owner);
    await expect(findVersion({ panel, version: 'Rogue' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await findVersion({ panel, version: 'Rogue (Unchained)' }).click();
    // The preview covers both levels, as the switch does.
    await expect(panel).toContainText(
      'All 2 Rogue levels keep their hit points, skill ranks, favored class bonuses, ability increases and choices.',
    );
    await expect(
      panel.getByRole('button', { name: 'Switch all Rogue levels' }),
    ).toBeVisible();
    await owner.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expectRogueLevels({ page: owner, version: 'Rogue' });
  });

  await test.step('switching every Rogue level to Unchained changes both levels together, in both sessions', async () => {
    const panel = await openRules(owner);
    await findVersion({ panel, version: 'Rogue (Unchained)' }).click();
    await expect(panel).toContainText('All 2 Rogue levels keep');
    await panel
      .getByRole('button', { name: 'Switch all Rogue levels', exact: true })
      .click();
    await expect(panel).toHaveCount(0);
    await expect(
      findLevels(owner)
        .getByRole('status')
        .filter({ hasText: 'Class version saved.' }),
    ).toBeVisible();
    for (const page of [owner, member]) {
      await expect(
        findRulesUsed({ page, version: 'Rogue (Unchained)' }),
      ).toBeVisible();
      await expectRogueLevels({ page, version: 'Rogue (Unchained)' });
    }
  });
});
