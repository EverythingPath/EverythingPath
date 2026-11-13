import { expect, test } from 'vitest';
import { roll, upkeepFixture } from '../../tests/rules/upkeep-fixture';
import { MILITIA_ADVANCEMENT } from './militia-progression-rules';
import { boonFeatChoices, projectProgression } from './rules-progression';
import { projectUpkeep } from './rules-upkeep';

function everyBoon() {
  const { snapshot } = upkeepFixture();
  snapshot.characters[0]!.level = 20;
  return projectProgression(
    1,
    MILITIA_ADVANCEMENT.at(-1)!.training,
    snapshot.roster,
    snapshot.characters,
  ).boons;
}

test('only titles with a fixed feat package offer feat choices', () => {
  const choices = everyBoon().map((reward) => [
    reward.rank,
    boonFeatChoices(reward),
  ]);
  expect(choices.filter(([, feats]) => feats !== null)).toEqual([
    [4, ['Alertness', 'Deceitful', 'Persuasive', 'Stealthy']],
    [9, ['Great Fortitude', 'Iron Will', 'Lightning Reflexes']],
    [14, ['Fleet', 'Improved Initiative', 'Toughness']],
  ]);
  // Skilled, Gift, XP and Champion's any feat remain open text outcomes.
  expect(
    choices.filter(([, feats]) => feats === null).map(([rank]) => rank),
  ).toEqual([2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20]);
});

test('rank reports the training it judged, the PC level cap and the rank training alone reaches', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 81;
  snapshot.characters[0]!.level = 5;
  draft.upkeep.rolls = { check: roll(20, 12), training: roll(6, 1) };
  const result = projectUpkeep(draft, snapshot);
  expect(result.progression).toEqual({
    training: 80,
    highestPcLevel: 5,
    trainingRank: 8,
  });
  expect(result.outcome.rank).toBe(5);
});

test('rank facts stay unknown while an earlier Upkeep step is open', () => {
  const { draft, snapshot } = upkeepFixture();
  expect(projectUpkeep(draft, snapshot).progression).toBeNull();
});
