import { expect, type Page } from '@playwright/test';
import { test } from './support/fixtures';
import { fixtureCall, loadRun } from './support/process';

// Account deletion (#708): when a member deletes their account, their
// campaign Character stays in the campaign with no owner. Every remaining
// member sees it needs an owner at once and can still edit it, and one click
// takes it over. The departing member is a fixture account in the cohort's
// organization with no provider user or session: the cohort's own Clerk users
// and memberships are never deleted or changed. The fixture deletes it
// through the same deletion as the signed provider event; precedence over
// membership events, retries and stale work are proven by the Convex tests.

const characterName = 'E2E account-deletion-character';
const departingName = 'E2E departing member';
const tablet = { width: 1024, height: 768 };
// Clearing the owner is trusted background work, so its arrival is awaited.
const deletionTimeoutMs = 60_000;

function findRow(page: Page) {
  return page.getByRole('row').filter({
    has: page.getByRole('link', { name: characterName, exact: true }),
  });
}
function findTakeOwnership(page: Page) {
  return page.getByRole('button', {
    name: `Take ownership of ${characterName}`,
    exact: true,
  });
}
function findOwnerNotice({ page, text }: { page: Page; text: string }) {
  return page.getByRole('main').getByRole('status').filter({ hasText: text });
}
function findScores(page: Page) {
  return page
    .getByRole('main')
    .getByRole('region', { name: 'Ability scores', exact: true });
}

test.use({ caseKey: 'accountDeletion', viewport: tablet });
test('a member who deletes their account leaves their campaign Character ownerless; the others keep editing it and one takes it over', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(180_000);
  const taker = players.gm;
  const member = players.player;
  const campaignCharacters = `/campaigns/${ownedCase.campaignId}/characters`;

  await test.step('both members see the departing member’s Character, and the GM opens its sheet', async () => {
    await member.goto(campaignCharacters);
    await expect(findRow(member)).toContainText(departingName);
    await expect(findRow(member)).not.toContainText('Needs an owner');
    await expect(
      member.getByText('One Character needs an owner.', { exact: true }),
    ).toHaveCount(0);
    await taker.goto(campaignCharacters);
    await findRow(taker)
      .getByRole('link', { name: characterName, exact: true })
      .click();
    await expect(taker).toHaveURL(/\/characters\/[^/?]+(?:\?|$)/);
    await expect(
      taker.getByRole('heading', {
        level: 1,
        name: characterName,
        exact: true,
      }),
    ).toBeVisible();
    await expect(taker.getByRole('main')).toContainText(departingName);
    // Only a Character's owner can take it out of the campaign.
    await expect(
      taker.getByRole('button', { name: 'Leave campaign', exact: true }),
    ).toHaveCount(0);
    await expect(findTakeOwnership(taker)).toHaveCount(0);
  });

  await test.step('after the deletion, every member sees it needs an owner at once and it stays in the campaign', async () => {
    await fixtureCall(await loadRun(), 'deleteAccount', ownedCase.caseScope);
    await expect(
      findOwnerNotice({
        page: taker,
        text: 'This Character no longer has an owner.',
      }),
    ).toBeVisible({ timeout: deletionTimeoutMs });
    await expect(findTakeOwnership(taker)).toBeEnabled();
    await expect(findRow(member)).toContainText('Needs an owner', {
      timeout: deletionTimeoutMs,
    });
    await expect(
      member.getByText('One Character needs an owner.', { exact: true }),
    ).toBeVisible();
    await expect(findTakeOwnership(member)).toBeVisible();
  });

  await test.step('another member still edits the ownerless Character', async () => {
    await findRow(member)
      .getByRole('link', { name: characterName, exact: true })
      .click();
    await expect(
      member.getByRole('heading', {
        level: 1,
        name: characterName,
        exact: true,
      }),
    ).toBeVisible();
    await findScores(member)
      .getByRole('textbox', { name: 'Strength', exact: true })
      .fill('14');
    await findScores(member)
      .getByRole('button', { name: 'Save scores', exact: true })
      .click();
    await expect(
      findScores(member)
        .getByRole('status')
        .filter({ hasText: 'Scores saved.' }),
    ).toBeVisible();
    await expect(
      findScores(taker).getByRole('textbox', { name: 'Strength', exact: true }),
    ).toHaveValue('14');
  });

  await test.step('one click takes ownership, and the new owner gets the owner’s campaign actions', async () => {
    await findTakeOwnership(taker).click();
    await expect(
      findOwnerNotice({ page: taker, text: 'Owner assigned.' }),
    ).toBeVisible();
    await expect(findTakeOwnership(taker)).toHaveCount(0);
    // The taker's own save replaces the deletion's notice; it is never
    // credited to another player. The other member is told it was.
    await expect(
      findOwnerNotice({
        page: taker,
        text: 'This Character no longer has an owner.',
      }),
    ).toHaveCount(0);
    await expect(
      findOwnerNotice({
        page: taker,
        text: 'Owner changed by another player.',
      }),
    ).toHaveCount(0);
    await expect(
      findOwnerNotice({
        page: member,
        text: 'Owner changed by another player.',
      }),
    ).toBeVisible();
    const me = taker
      .getByRole('main')
      .getByText('(me)', { exact: true })
      .first();
    await expect(me).toBeVisible();
    // The name the provider gave the taker's account, as their own sheet shows it.
    const takerName = (await me.locator('..').textContent())!
      .replace('(me)', '')
      .trim();
    expect(takerName).not.toBe('');
    await expect(
      taker.getByRole('button', { name: 'Leave campaign', exact: true }),
    ).toBeVisible();
    await expect(findTakeOwnership(member)).toHaveCount(0);
    await member.goto(campaignCharacters);
    await expect(findRow(member)).toContainText(takerName);
    await expect(findRow(member)).not.toContainText('Needs an owner');
    await expect(
      member.getByText('One Character needs an owner.', { exact: true }),
    ).toHaveCount(0);
  });
});
