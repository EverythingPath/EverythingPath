import {
  expectOutsiderShutOut,
  openWeekFromList,
} from './support/shell-navigation';
import { loadRun } from './support/process';
import { navigationAndPersistence } from './support/nightly-flows';
import { test } from './support/fixtures';
import { runsNightlyExtension } from './support/matrix';

test.use({ caseKey: 'smoke' });
test('organization members can open their campaign and outsiders cannot', async ({
  players,
  ownedCase,
}, info) => {
  // Members open their campaign from the list. The list and home themselves
  // (landing, selection, header edits, outsider view) are the campaign-home
  // journey; section navigation and week links are their own journeys, split
  // from this one.
  await test.step('members open the week from the campaign list', () =>
    Promise.all([players.gm, players.player].map(openWeekFromList)));
  await test.step('the outsider cannot open any section of the campaign', () =>
    expectOutsiderShutOut(
      players.player,
      players.outsider,
      ownedCase.campaignName,
    ));
  if (
    runsNightlyExtension({
      suite: (await loadRun()).suite,
      project: info.project.name,
    })
  )
    await navigationAndPersistence(players.player, ownedCase.campaignName);
  if (process.env.E2E_FORCE_FAILURE === 'true' && info.retry === 0)
    throw new Error(
      'E2E forced failure: verify sanitized evidence and red diagnostic retry',
    );
});
