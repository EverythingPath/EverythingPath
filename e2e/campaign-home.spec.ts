import { exerciseCampaignHome } from './support/campaign-home';
import {
  reviewCampaignHomeLayout,
  reviewListSkeleton,
} from './support/campaign-home-layout';
import { test } from './support/fixtures';
import { loadRun } from './support/process';

// Split from the access journey (#187) with its own case, seeded like
// `smoke`: one campaign with a rank-1 militia and one officer, alone in the
// cohort's member organization. The GM, player and outsider are separate
// signed-in sessions, as in access.
test.use({ caseKey: 'campaignHome' });
test('members choose and edit their campaign home and outsiders never see it', async ({
  players,
  ownedCase,
}, info) => {
  // Members land on the list and home; outsiders see an empty organization.
  await test.step('members choose and edit the home; outsiders never see it', () =>
    exerciseCampaignHome(
      players.player,
      players.gm,
      players.outsider,
      ownedCase.campaignName,
    ));
  const run = await loadRun();
  // Layout evidence (#147): the home, its editor and the create form at
  // phone, tablet and desktop sizes, and the list skeleton while loading.
  await test.step('the home, its editor and the create form fit every size', () =>
    reviewCampaignHomeLayout(
      players.player,
      ownedCase.campaignName,
      run.artifactDirectory,
      info.project.name,
    ));
  await test.step('the list shows its skeleton until the campaigns load', async () => {
    const page = await players.player.context().newPage();
    try {
      await reviewListSkeleton(
        page,
        run.fixture!.convexUrl,
        ownedCase.campaignName,
        run.artifactDirectory,
        info.project.name,
      );
    } finally {
      await page.close();
    }
  });
});
