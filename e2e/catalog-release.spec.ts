import { expect, type Locator, type Page } from '@playwright/test';
import { chooseClass } from './support/class-picker';
import { resolveCaseSheetPath } from './support/case-sheet';
import { test } from './support/fixtures';
import { releaseQualification } from './fixtures/release';

// The release-qualification suite's journey (#753). The runner has prepared,
// reconciled and activated Catalog Release 1 fixture-only on this preview
// (release-qualification.ts), so the feat picker offers the release's
// admitted Skill Focus (Acrobatics). A fixture-campaign Fighter's owner takes
// it and the sheet applies CRB p. 134's +3: Acrobatics goes from +0 to +3
// (#724 applies it from the recorded ranks, none here). Another member
// follows. The case's Characters keep fixture provenance, so the release's
// sentinel holds.

const { feat } = releaseQualification;
const tablet = { width: 1024, height: 768 };

function findBlock({ page, name }: { page: Page; name: string }) {
  return page.getByRole('main').getByRole('region', { name, exact: true });
}
function findSkill({ page, total }: { page: Page; total: string }) {
  return findBlock({ page, name: 'Skills' }).getByRole('button', {
    name: `${feat.skill.label} ${total}, breakdown`,
    exact: true,
  });
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
  // A feat the picker doesn't offer fails here, not after the whole budget.
  const list = picker.getByRole('list', { name: 'Feats', exact: true });
  await expect(list).toBeVisible({ timeout: 10_000 });
  await list.getByRole('button', { name, exact: true }).click();
  const form = picker.getByRole('form', { name: 'New feat', exact: true });
  await form
    .getByRole('combobox', { name: 'Level gained', exact: true })
    .click();
  await page.getByRole('option', { name: '1 · Fighter', exact: true }).click();
  await form.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  await expect(slot.getByRole('listitem', { name, exact: true })).toBeVisible();
}

test.use({ caseKey: 'catalogRelease', viewport: tablet });
test('a fixture Character takes the admitted Skill Focus (Acrobatics) from the feat picker under the active Catalog Release and its Acrobatics rises by 3', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(180_000);
  const url = await resolveCaseSheetPath(ownedCase);
  const owner = players.gm;
  const member = players.player;

  await test.step('the owner makes the Character a level-1 Fighter with Acrobatics +0', async () => {
    for (const page of [owner, member]) {
      await page.goto(url);
      await expect(findBlock({ page, name: 'Feats & traits' })).toBeVisible();
    }
    await chooseClass({ page: owner, level: 1, name: 'Fighter' });
    for (const page of [owner, member])
      await expect(findSkill({ page, total: '+0' })).toBeVisible();
  });

  await test.step(`the picker offers the release's ${feat.name}, and taking it gives Acrobatics +${feat.bonus} on both sessions`, async () => {
    await addFeat({
      page: owner,
      slot: findBlock({ page: owner, name: 'Feats & traits' }).getByRole(
        'group',
        { name: 'General feats', exact: true },
      ),
      name: feat.name,
    });
    for (const page of [owner, member]) {
      await expect(
        findBlock({ page, name: 'Feats & traits' }).getByRole('listitem', {
          name: feat.name,
          exact: true,
        }),
      ).toBeVisible();
      await expect(findSkill({ page, total: `+${feat.bonus}` })).toBeVisible();
    }
  });
});
