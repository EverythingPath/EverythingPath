import { join } from 'node:path';
import { loadRun, savePrivate } from './support/process';
import { controlSheetWrites } from './support/character-sheet-transport';
import { exerciseDualTalent } from './support/dual-talent';
import { expect, type Locator, type Page } from '@playwright/test';
import { chooseClass } from './support/class-picker';
import { resolveCaseSheetPath } from './support/case-sheet';
import { test } from './support/fixtures';
import {
  expectControlsReachable,
  expectNoHorizontalOverflow,
} from './support/responsive-shell';

// Feats on the living sheet: a Fighter's owner picks two representative feats
// from the sheet's feat picker, one in the general slot and one in the
// Fighter's bonus slot, and orders them at their level by keyboard (#313,
// #320); another member follows both. The sheet's blocks keep their places
// and stay usable at phone, tablet and desktop widths (#304, #306, #313).
// The preview has no Catalog Release, so the feats are the representative
// definitions every prepared sheet carries, not admitted Catalog content.

const phone = { width: 390, height: 844 };
const tablet = { width: 1024, height: 768 };
const desktop = { width: 1440, height: 900 };
// Neither has a prerequisite a fresh level-1 Fighter misses.
const generalFeat = 'Combat Reflexes';
const bonusFeat = 'Point-Blank Shot';

function findBlock({ page, name }: { page: Page; name: string }) {
  return page.getByRole('main').getByRole('region', { name, exact: true });
}
function findFeats(page: Page) {
  return findBlock({ page, name: 'Feats & traits' });
}
function findFeat({ page, name }: { page: Page; name: string }) {
  return findFeats(page).getByRole('listitem', { name, exact: true });
}
async function addFeat({
  page,
  slot,
  name,
}: {
  page: Page;
  slot: Locator;
  name: string;
}) {
  await slot.getByRole('button', { name: 'Add a feat', exact: true }).click();
  const picker = slot.getByRole('group', { name: /^Choose a feat/ });
  await picker
    .getByRole('searchbox', { name: 'Search feats', exact: true })
    .fill(name);
  await picker
    .getByRole('list', { name: 'Feats', exact: true })
    .getByRole('button', { name, exact: true })
    .click();
  const form = picker.getByRole('form', { name: 'New feat', exact: true });
  // Only a feat recorded at a level takes part in that level's order.
  await form
    .getByRole('combobox', { name: 'Level gained', exact: true })
    .click();
  await page.getByRole('option', { name: '1 · Fighter', exact: true }).click();
  await form.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  await expect(slot.getByRole('listitem', { name, exact: true })).toBeVisible();
}
async function expectOrder({
  page,
  name,
  position,
}: {
  page: Page;
  name: string;
  position: number;
}) {
  await expect(findFeat({ page, name })).toContainText(
    `Order ${position} of 2`,
  );
}
// Measured in document coordinates, so blocks compare wherever the page is
// scrolled and nothing scrolls between measurements.
async function measureDocumentBox(locator: Locator) {
  return locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      x: bounds.left + window.scrollX,
      y: bounds.top + window.scrollY,
      width: bounds.width,
      height: bounds.height,
    };
  });
}

test.use({ caseKey: 'sheetSelections', viewport: tablet });
test('a Fighter’s owner adds and orders two feats while another member follows, and the sheet’s blocks keep their places at every width', async ({
  players,
  ownedCase,
}, info) => {
  test.setTimeout(240_000);
  const url = await resolveCaseSheetPath(ownedCase);
  const owner = players.gm;
  const member = players.player;
  const run = await loadRun();
  // Route before navigation: only this member's relevant save can be refused.
  const writes = await controlSheetWrites(member, run.fixture!.convexUrl);

  await test.step('the owner makes the Character a Fighter; both sessions follow', async () => {
    for (const page of [owner, member]) {
      await page.goto(url);
      await expect(findFeats(page)).toBeVisible();
    }
    await chooseClass({ page: owner, level: 1, name: 'Fighter' });
    for (const page of [owner, member])
      await expect(
        findBlock({ page, name: 'Class Levels' }).getByText('Fighter 1', {
          exact: true,
        }),
      ).toBeVisible();
  });

  await test.step('a general feat and a Fighter bonus feat come from the sheet’s picker and reach the other member', async () => {
    await addFeat({
      page: owner,
      slot: findFeats(owner).getByRole('group', {
        name: 'General feats',
        exact: true,
      }),
      name: generalFeat,
    });
    await addFeat({
      page: owner,
      slot: findFeats(owner).getByRole('group', {
        name: /^Bonus feats?(?: \(level 1\))?$/i,
      }),
      name: bonusFeat,
    });
    for (const page of [owner, member]) {
      await expect(findFeat({ page, name: generalFeat })).toBeVisible();
      await expect(findFeat({ page, name: bonusFeat })).toBeVisible();
      await expectOrder({ page, name: generalFeat, position: 1 });
      await expectOrder({ page, name: bonusFeat, position: 2 });
    }
  });

  await test.step('Alt+Up moves a feat earlier at its level, and the other member sees the new order', async () => {
    const earlier = findFeat({ page: owner, name: bonusFeat }).getByRole(
      'button',
      {
        name: `Move ${bonusFeat} earlier at level 1`,
        exact: true,
      },
    );
    await expect(earlier).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowUp');
    await earlier.focus();
    await owner.keyboard.press('Alt+ArrowUp');
    for (const page of [owner, member]) {
      await expectOrder({ page, name: bonusFeat, position: 1 });
      await expectOrder({ page, name: generalFeat, position: 2 });
    }
    await expect(
      findFeats(member)
        .getByRole('status')
        .filter({ hasText: 'Feats and traits changed.' }),
    ).toBeVisible();
    // The first feat at its level can move no earlier.
    await expect(
      findFeat({ page: owner, name: bonusFeat }).getByRole('button', {
        name: `Move ${bonusFeat} earlier at level 1`,
        exact: true,
      }),
    ).toBeDisabled();
    await member.reload();
    await expectOrder({ page: member, name: bonusFeat, position: 1 });
  });

  await test.step('desktop: Race spans the sheet, Equipment and Proficiencies sit beside Skills, and Feats & traits follow Skills', async () => {
    await owner.setViewportSize(desktop);
    await expectNoHorizontalOverflow(owner);
    const measureBlock = (name: string) =>
      measureDocumentBox(findBlock({ page: owner, name }));
    const race = await measureBlock('Race');
    const equipment = await measureBlock('Equipment');
    const proficiencies = await measureBlock('Proficiencies');
    const skills = await measureBlock('Skills');
    const feats = await measureDocumentBox(findFeats(owner));
    expect(race.width, 'Race spans both columns').toBeGreaterThan(
      skills.width + equipment.width - 1,
    );
    expect(equipment.x + equipment.width).toBeLessThanOrEqual(skills.x + 1);
    expect(Math.abs(proficiencies.x - equipment.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(feats.x - skills.x)).toBeLessThanOrEqual(1);
    expect(feats.y, 'Feats & traits follow Skills').toBeGreaterThanOrEqual(
      skills.y + skills.height - 1,
    );
  });

  await test.step('every block fits phone, tablet and desktop widths and the feat controls stay reachable', async () => {
    for (const [name, size] of [
      ['phone', phone],
      ['desktop', desktop],
      ['tablet', tablet],
    ] as const) {
      await owner.setViewportSize(size);
      await expectNoHorizontalOverflow(owner);
      for (const block of [
        'Race',
        'Equipment',
        'Proficiencies',
        'Skills',
        'Feats & traits',
      ]) {
        const bounds = await measureDocumentBox(
          findBlock({ page: owner, name: block }),
        );
        expect(
          bounds.x,
          `${name}: ${block} starts inside`,
        ).toBeGreaterThanOrEqual(-1);
        expect(
          bounds.x + bounds.width,
          `${name}: ${block} fits the width`,
        ).toBeLessThanOrEqual(size.width + 1);
      }
      await expectControlsReachable(
        owner,
        findFeats(owner),
        `${name} Feats & traits`,
        'focus',
      );
    }
  });
  // The reset adds a Character-scoped legal fixture for #769. Keep this
  // within the existing case: every browser test must own a distinct key.
  // Parent local qualification runs it; the real trait remains held.
  await test.step('two members record and clear Magical Lineage’s chosen spell and retain it after reload', async () => {
    for (const page of [owner, member]) {
      await page.goto(url);
      await expect(findFeats(page)).toBeVisible();
    }
    const traits = findFeats(owner).getByRole('group', {
      name: 'Traits',
      exact: true,
    });
    await traits
      .getByRole('button', { name: 'Add a trait', exact: true })
      .click();
    const picker = traits.getByRole('group', { name: /^Choose a trait/ });
    await picker
      .getByRole('searchbox', { name: 'Search traits', exact: true })
      .fill('Magical Lineage');
    await picker
      .getByRole('button', { name: 'Magical Lineage', exact: true })
      .click();
    await picker
      .getByRole('button', { name: 'Add Magical Lineage', exact: true })
      .click();
    for (const page of [owner, member])
      await expect(findFeat({ page, name: 'Magical Lineage' })).toContainText(
        'Incomplete: choose a spell.',
      );

    const saved = findFeat({ page: owner, name: 'Magical Lineage' });
    await saved
      .getByRole('button', { name: 'Edit Magical Lineage', exact: true })
      .click();
    await saved
      .getByRole('textbox', {
        name: 'Chosen spell for Magical Lineage',
        exact: true,
      })
      .fill('Magic Missile');
    await saved
      .getByRole('button', { name: 'Save Magical Lineage', exact: true })
      .click();
    for (const page of [owner, member]) {
      const row = findFeat({ page, name: 'Magical Lineage' });
      await expect(row).toContainText('Chosen spell: Magic Missile');
      await expect(row).toContainText(
        "treat its actual level as 1 lower for determining the spell's final adjusted level.",
      );
      await expect(row).toContainText(
        'Apply the metamagic adjustment manually.',
      );
      await expect(row).not.toContainText('Incomplete: choose a spell.');
    }
    await expect(
      findFeats(member)
        .getByRole('status')
        .filter({ hasText: 'Feats and traits changed.' }),
    ).toBeVisible();
    await member.reload();
    const remote = findFeat({ page: member, name: 'Magical Lineage' });
    await expect(remote).toContainText('Chosen spell: Magic Missile');
    await remote
      .getByRole('button', { name: 'Edit Magical Lineage', exact: true })
      .click();
    await remote
      .getByRole('textbox', {
        name: 'Chosen spell for Magical Lineage',
        exact: true,
      })
      .fill('');
    await remote
      .getByRole('button', { name: 'Save Magical Lineage', exact: true })
      .click();
    for (const page of [owner, member])
      await expect(findFeat({ page, name: 'Magical Lineage' })).toContainText(
        'Incomplete: choose a spell.',
      );
    await owner.reload();
    await expect(
      findFeat({ page: owner, name: 'Magical Lineage' }),
    ).toContainText('Incomplete: choose a spell.');
    for (const viewport of [phone, tablet, desktop]) {
      await owner.setViewportSize(viewport);
      await expectNoHorizontalOverflow(owner);
      await expectControlsReachable(
        owner,
        findFeat({ page: owner, name: 'Magical Lineage' }),
        'Magical Lineage',
        'focus',
      );
    }
  });

  await exerciseDualTalent({
    owner,
    member,
    writes,
    recordLayout: async ({ page, name, geometry }) => {
      const prefix = join(
        run.artifactDirectory,
        `${info.project.name}-dual-talent-${name}`,
      );
      await savePrivate(`${prefix}.json`, JSON.stringify(geometry, null, 2));
      await savePrivate(
        `${prefix}.png`,
        await page.screenshot({ fullPage: true }),
      );
    },
  });
});
