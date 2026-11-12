import { expect, type Page } from '@playwright/test';
import { test } from './support/fixtures';
import { fixtureCall, loadRun } from './support/process';

// Membership loss (#706): a player who leaves the organization loses its
// campaign at once in their open session, while another member's session
// keeps working; the player's Character then comes back to them under No
// campaign. The fixture removes the membership through the same removal as
// the signed provider event; the trusted return, its rechecks and its
// authorization are proven by the public Convex tests.

const characterName = 'E2E membership-loss-character';
const unavailable = 'This character isn’t available.';
// The return is trusted background work, so its arrival is awaited.
const returnTimeout = 60_000;

function findCharacterLink(page: Page) {
  return page.getByRole('link', { name: new RegExp(`^${characterName}`) });
}
async function expectUnavailable(page: Page) {
  await expect(
    page.getByRole('main').getByRole('status').filter({ hasText: unavailable }),
  ).toBeVisible();
  await expect(page.getByText(characterName, { exact: true })).toHaveCount(0);
}

test.use({ caseKey: 'membershipLoss' });
test('a player who leaves the organization loses its campaign at once while another member keeps working, and gets their Character back under No campaign', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(180_000);
  const departing = players.player;
  const member = players.gm;
  const campaignCharacters = `/campaigns/${ownedCase.campaignId}/characters`;
  let sheetPath = '';

  await test.step('both members see the player’s Character in the campaign and the player opens its sheet', async () => {
    await member.goto(campaignCharacters);
    await expect(findCharacterLink(member)).toBeVisible();
    await departing.goto(campaignCharacters);
    await findCharacterLink(departing).click();
    await expect(departing).toHaveURL(/\/characters\/[^/?]+(?:\?|$)/);
    await expect(
      departing.getByRole('heading', {
        level: 1,
        name: characterName,
        exact: true,
      }),
    ).toBeVisible();
    sheetPath = new URL(departing.url()).pathname;
  });

  await test.step('the player’s open sheet closes at once and the member’s session keeps working', async () => {
    await fixtureCall(await loadRun(), 'loseMembership', {
      ...ownedCase.caseScope,
      now: Date.now(),
    });
    await expectUnavailable(departing);
    await expect(
      member.getByRole('heading', { level: 1, name: 'Characters' }),
    ).toBeVisible();
    await expect(findCharacterLink(member)).toHaveCount(0, {
      timeout: returnTimeout,
    });
    await member.goto(sheetPath);
    await expectUnavailable(member);
  });

  await test.step('the Character comes back to the player under No campaign', async () => {
    await departing.goto('/characters');
    const returned = departing
      .getByRole('region', { name: 'No campaign', exact: true })
      .getByRole('link', { name: new RegExp(`^${characterName}`) });
    await expect(returned).toBeVisible({ timeout: returnTimeout });
    await expect(
      departing.getByRole('region', {
        name: ownedCase.campaignName,
        exact: true,
      }),
    ).toHaveCount(0);
    await returned.click();
    await expect(
      departing.getByRole('heading', {
        level: 1,
        name: characterName,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      departing.getByText('No campaign', { exact: true }),
    ).toBeVisible();
  });
});
