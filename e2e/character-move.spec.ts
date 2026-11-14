import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './support/fixtures';

// Character moves (#316, #703, #711): the owner takes a Character out of its
// campaign and adds it back, and its active familiar, owned by the same
// player, moves with it as one group both ways. Nothing moves until the
// owner completes the move; another member watching the campaign sees the
// whole group leave and arrive, never half of it. Moving the familiar on its
// own would never take the Character it belongs to. Closure, rechecks,
// retries and group publication are proven by the Convex tests.

const tablet = { width: 1024, height: 768 };
const characterName = 'E2E character-move-character';
const familiarName = 'E2E familiar-cat';
// Preparing the pair's homebrew takes about 30 bounded steps per move.
const maxMoveSteps = 120;

function findLink({ page, name }: { page: Page; name: string }) {
  return page.getByRole('link', { name, exact: true });
}
function findScore(page: Page) {
  return page
    .getByRole('main')
    .getByRole('region', { name: 'Ability scores', exact: true })
    .getByRole('textbox', { name: 'Strength', exact: true });
}
function findStatus({ page, text }: { page: Page; text: string }) {
  return page.getByRole('main').getByRole('status').filter({ hasText: text });
}
async function expectGroup(container: Locator) {
  const group = container.getByRole('region', {
    name: 'Moving together',
    exact: true,
  });
  await expect(group.getByRole('listitem')).toHaveText([
    characterName,
    familiarName,
  ]);
}
// Continue move until the move is ready, then complete it. A click while the
// previous step is still saving is ignored, so the loop only ever advances.
async function completeMove({
  page,
  outcome,
}: {
  page: Page;
  outcome: string;
}) {
  const progress = page.getByRole('region', {
    name: 'Move progress',
    exact: true,
  });
  await expect(progress).toContainText(
    /Preserving homebrew for 2 Characters…|Ready to move/,
  );
  await expect(progress).toContainText(
    /All 2 Characters stay in their current campaigns|all 2 Characters move together/,
  );
  const proceed = progress.getByRole('button', {
    name: /^(?:Continue|Complete) move$/,
  });
  const done = findStatus({ page, text: outcome });
  for (let step = 0; step < maxMoveSteps; step++) {
    await expect(proceed.and(page.locator(':enabled')).or(done)).toBeVisible({
      timeout: 30_000,
    });
    if (await done.isVisible()) return;
    await proceed.click();
  }
  await expect(done).toBeVisible();
}

test.use({ caseKey: 'characterMove', familiarDemo: true, viewport: tablet });
test('an owner moves a Character and its familiar out of a campaign and back as one group while another member watches', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(300_000);
  const owner = players.gm;
  const member = players.player;
  const campaignCharacters = `/campaigns/${ownedCase.campaignId}/characters`;
  let sheetPath = '';

  await test.step('both members see the pair in the campaign, and only the owner can move it', async () => {
    await member.goto(campaignCharacters);
    await expect(findLink({ page: member, name: characterName })).toBeVisible();
    await expect(findLink({ page: member, name: familiarName })).toBeVisible();
    await findLink({ page: member, name: characterName }).click();
    await expect(
      member.getByRole('heading', { level: 1, name: characterName }),
    ).toBeVisible();
    await expect(findScore(member)).toBeVisible();
    for (const name of ['Move to campaign', 'Leave campaign'])
      await expect(
        member.getByRole('button', { name, exact: true }),
      ).toHaveCount(0);
    await member.goto(campaignCharacters);

    await owner.goto(campaignCharacters);
    await findLink({ page: owner, name: characterName }).click();
    await expect(
      owner.getByRole('heading', { level: 1, name: characterName }),
    ).toBeVisible();
    sheetPath = new URL(owner.url()).pathname;
    await findScore(owner).fill('14');
    await owner
      .getByRole('main')
      .getByRole('button', { name: 'Save scores', exact: true })
      .click();
    await expect(
      findStatus({ page: owner, text: 'Scores saved.' }),
    ).toBeVisible();
  });

  await test.step('leaving names the familiar that leaves with it, and nothing moves until the move completes', async () => {
    await owner
      .getByRole('button', { name: 'Leave campaign', exact: true })
      .click();
    const question = owner.getByRole('dialog', {
      name: `Take ${characterName} and its Companion out of ${ownedCase.campaignName}?`,
      exact: true,
    });
    await expectGroup(question);
    await expect(question).toContainText(
      'The Companion moving with it is removed from the militia roster',
    );
    await question
      .getByRole('button', { name: 'Leave campaign', exact: true })
      .click();
    await expect(question).toHaveCount(0);
    // Preparation leaves both where they are for everyone.
    await expect(findLink({ page: member, name: characterName })).toBeVisible();
    await expect(findLink({ page: member, name: familiarName })).toBeVisible();
    await completeMove({ page: owner, outcome: '2 Characters left campaign.' });
    await expect(
      owner.getByRole('main').getByText('No campaign', { exact: true }),
    ).toBeVisible();
    await expect(findLink({ page: member, name: characterName })).toHaveCount(
      0,
    );
    await expect(findLink({ page: member, name: familiarName })).toHaveCount(0);
    await expect(
      member.getByText('No characters in this campaign yet.', { exact: true }),
    ).toBeVisible();
  });

  await test.step('both are the owner’s, under No campaign', async () => {
    await owner.goto('/characters');
    const noCampaign = owner.getByRole('region', {
      name: 'No campaign',
      exact: true,
    });
    await expect(
      noCampaign.getByRole('link', { name: new RegExp(`^${characterName}`) }),
    ).toBeVisible();
    await expect(
      noCampaign.getByRole('link', { name: new RegExp(`^${familiarName}`) }),
    ).toBeVisible();
  });

  await test.step('adding it back to the campaign brings the familiar too, with the sheet unchanged', async () => {
    await owner.goto(sheetPath);
    await owner
      .getByRole('button', { name: 'Add to campaign', exact: true })
      .click();
    const picker = owner.getByRole('dialog', {
      name: 'Add to campaign',
      exact: true,
    });
    await expectGroup(picker);
    await expect(picker).toContainText(
      `Everyone in the campaign you choose can see and edit ${characterName} and its Companion. None of them is added to a militia roster.`,
    );
    // The radio itself is visually hidden behind its card, so choose it as
    // a keyboard user would.
    const destination = picker
      .getByRole('radiogroup', { name: 'Campaigns', exact: true })
      .getByRole('radio', { name: ownedCase.campaignName, exact: true });
    await destination.focus();
    await owner.keyboard.press('Space');
    await expect(destination).toBeChecked();
    await picker
      .getByRole('button', { name: 'Join campaign', exact: true })
      .click();
    await expect(picker).toHaveCount(0);
    await completeMove({
      page: owner,
      outcome: '2 Characters added to campaign.',
    });
    await expect(findLink({ page: member, name: characterName })).toBeVisible();
    await expect(findLink({ page: member, name: familiarName })).toBeVisible();
    await expect(findScore(owner)).toHaveValue('14');
    await expect(
      owner.getByRole('button', { name: 'Leave campaign', exact: true }),
    ).toBeVisible();
  });

  await test.step('the familiar alone would leave without the Character it belongs to', async () => {
    await owner.goto(campaignCharacters);
    await findLink({ page: owner, name: familiarName }).click();
    await expect(
      owner.getByRole('heading', { level: 1, name: familiarName }),
    ).toBeVisible();
    await owner
      .getByRole('button', { name: 'Leave campaign', exact: true })
      .click();
    const question = owner.getByRole('dialog', {
      name: `Take ${familiarName} out of ${ownedCase.campaignName}?`,
      exact: true,
    });
    const staying = question.getByRole('list', {
      name: 'Staying',
      exact: true,
    });
    await expect(staying.getByRole('listitem')).toHaveCount(1);
    await expect(staying).toContainText(characterName);
    await expect(staying).toContainText(
      'Moving a Companion never moves its associated Character.',
    );
    await question
      .getByRole('button', {
        name: `Stay in ${ownedCase.campaignName}`,
        exact: true,
      })
      .click();
    await expect(question).toHaveCount(0);
    await expect(findLink({ page: member, name: familiarName })).toBeVisible();
    await expect(findLink({ page: member, name: characterName })).toBeVisible();
  });
});
