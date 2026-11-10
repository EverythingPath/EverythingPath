import {
  exerciseImmediateSectionNavigation,
  exerciseSectionNavigation,
  openWeekFromList,
} from './support/shell-navigation';
import { reviewPhoneCorrections } from './support/militia-phone';
import { test } from './support/fixtures';
import { loadRun } from './support/process';

// Split from the access journey with its own case, seeded like `smoke`: one
// campaign with a rank-1 militia and one officer, alone in the cohort's member
// organization. The player starts where access left it: on Week 1 · Event,
// opened from the campaign list.
test.use({ caseKey: 'campaignSections' });
test('members move between campaign sections at every width and through browser history', async ({
  players,
}, info) => {
  await test.step('the player opens the week from the campaign list', () =>
    openWeekFromList(players.player));
  await test.step("a section link shows the section's skeleton before its page arrives", () =>
    exerciseImmediateSectionNavigation(players.player));
  await test.step('the player moves between sections at every width and through browser history', () =>
    exerciseSectionNavigation(players.player));
  // Section navigation ends on the Militia page (#139): an open correction
  // on a phone, cancelled so the militia is unchanged.
  await test.step('a correction open on a phone keeps its fields clear of the reason bar', async () =>
    reviewPhoneCorrections(
      players.player,
      (await loadRun()).artifactDirectory,
      info.project.name,
    ));
});
