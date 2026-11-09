import { expect, type Locator, type Page } from '@playwright/test';
import { chooseClass } from './support/class-picker';
import { resolveCaseSheetPath } from './support/case-sheet';
import { test } from './support/fixtures';
import {
  expectControlsReachable,
  expectNoHorizontalOverflow,
} from './support/responsive-shell';

// Animal companion progression (#325): a Druid's owner creates an animal
// companion supported by the Druid level, and sets up its species on the
// Companion's sheet. Another member sees the Companion arrive and its
// progression settle in their own session; the section stays usable at phone,
// tablet and desktop widths. The CRB rules behind the numbers are proven by
// the calculation tests; this journey checks what each browser shows.

const phone = { width: 390, height: 844 };
const tablet = { width: 1024, height: 768 };
const desktop = { width: 1440, height: 900 };
const companionName = 'E2E wolf companion';
// Creating a Companion prepares its own sheet, which takes a while.
const creationTimeoutMs = 30_000;

function findCompanions(page: Page) {
  return page
    .getByRole('main')
    .getByRole('region', { name: 'Companions', exact: true });
}
function findProgression(page: Page) {
  return findCompanions(page).getByRole('region', {
    name: 'Animal companion progression',
    exact: true,
  });
}
// Native radios sit visually hidden inside their cards: choose as a
// keyboard user would.
async function choose({ page, radio }: { page: Page; radio: Locator }) {
  await radio.focus();
  await page.keyboard.press('Space');
  await expect(radio).toBeChecked();
}

test.use({ caseKey: 'animalCompanion', viewport: tablet });
test('a Druid’s owner creates an animal companion and sets up its progression while another member follows, at every width', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(240_000);
  const url = await resolveCaseSheetPath(ownedCase);
  const owner = players.gm;
  const member = players.player;

  await test.step('the owner makes the Character a Druid; both sessions follow', async () => {
    for (const page of [owner, member]) {
      await page.goto(url);
      await expect(findCompanions(page)).toBeVisible();
    }
    await chooseClass({ page: owner, level: 1, name: 'Druid' });
    for (const page of [owner, member])
      await expect(
        page
          .getByRole('main')
          .getByRole('region', { name: 'Class Levels', exact: true })
          .getByText('Druid 1', { exact: true }),
      ).toBeVisible();
  });

  await test.step('creating an animal companion supported by the Druid level reaches the other member', async () => {
    await findCompanions(owner)
      .getByRole('button', { name: 'Create Companion', exact: true })
      .click();
    const form = findCompanions(owner).getByRole('form', {
      name: 'Create Companion',
      exact: true,
    });
    await form
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill(companionName);
    await expect(
      form
        .getByRole('radiogroup', { name: 'Companion kind', exact: true })
        .getByRole('radio', { name: 'Animal companion', exact: true }),
    ).toBeChecked();
    await choose({
      page: owner,
      radio: form
        .getByRole('radiogroup', { name: 'Supporting source', exact: true })
        .getByRole('radio', { name: /^Druid · Class Level 1/ }),
    });
    await form
      .getByRole('button', { name: 'Create Companion', exact: true })
      .click();
    await expect(
      findCompanions(owner)
        .getByRole('status')
        .filter({ hasText: 'Companion created.' }),
    ).toBeVisible({ timeout: creationTimeoutMs });
    for (const page of [owner, member])
      await expect(
        findCompanions(page).getByRole('listitem', {
          name: `Companion ${companionName}`,
          exact: true,
        }),
      ).toBeVisible({ timeout: creationTimeoutMs });
  });

  await test.step('both open the Companion’s sheet, which asks for its species', async () => {
    await findCompanions(owner)
      .getByRole('link', { name: 'Open Companion Sheet', exact: true })
      .click();
    await findCompanions(member)
      .getByRole('listitem', {
        name: `Companion ${companionName}`,
        exact: true,
      })
      .getByRole('link', { name: companionName, exact: true })
      .click();
    for (const page of [owner, member]) {
      await expect(
        page.getByRole('heading', { level: 1, name: companionName }),
      ).toBeVisible();
      await expect(findProgression(page)).toContainText(
        'Choose an animal companion species.',
      );
    }
  });

  await test.step('the owner sets up the species and the other member’s sheet follows', async () => {
    await findProgression(owner)
      .getByRole('button', {
        name: 'Set up companion progression',
        exact: true,
      })
      .click();
    const form = findProgression(owner).getByRole('form', {
      name: 'Set up companion progression',
      exact: true,
    });
    await choose({
      page: owner,
      radio: form
        .getByRole('radiogroup', { name: 'Species', exact: true })
        .getByRole('radio', { name: /^Wolf/ }),
    });
    await form
      .getByRole('button', { name: 'Save companion choices', exact: true })
      .click();
    await expect(form).toHaveCount(0);
    for (const page of [owner, member]) {
      await expect(findProgression(page)).toContainText(
        'Effective progression level',
      );
      await expect(findProgression(page)).not.toContainText(
        'Choose an animal companion species.',
      );
    }
    await expect(
      findProgression(owner).getByRole('button', {
        name: 'Edit companion choices',
        exact: true,
      }),
    ).toBeVisible();
  });

  await test.step('the progression stays reachable at phone, tablet and desktop widths', async () => {
    for (const [name, size] of [
      ['phone', phone],
      ['desktop', desktop],
      ['tablet', tablet],
    ] as const) {
      await member.setViewportSize(size);
      await expect(findProgression(member)).toBeVisible();
      await expectNoHorizontalOverflow(member);
      await expectControlsReachable(
        member,
        findProgression(member),
        `${name} companion progression`,
        'focus',
      );
    }
  });
});
