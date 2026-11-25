import { expect, test } from 'vitest';
import { roll, upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { derivePhaseReadiness } from './phase-readiness';
import { phaseView } from './phase-view';
import {
  boonDescription,
  chooseBoonFeat,
  clearBoon,
  recordBoon,
} from './upkeep-rank';

// Rank 8 with 110 training and plenty of treasury: an ordinary attrition
// success losing 1 training still reaches rank 9 (105), Captain.
function rank(
  arrange: (draft: WeeklyDraft, snapshot: UpkeepSnapshot) => void = () =>
    undefined,
) {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 8;
  snapshot.training = 110;
  snapshot.treasuryCopper = 100000;
  draft.upkeep.rolls = { check: roll(20, 12), training: roll(6, 1) };
  arrange(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [
      { characterId: 'pc', name: 'Ameiko' },
      { characterId: 'pc-2', name: 'Koya' },
      { characterId: 'npc', name: 'Rowan' },
    ],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('upkeep', draft, source, preview);
  if (view.phase !== 'upkeep' || !view.sections)
    throw new Error('Expected Upkeep sections');
  const readiness = () =>
    derivePhaseReadiness(draft, source, preview).phases.find(
      (phase) => phase.phase === 'upkeep',
    )!;
  return { view, rank: view.sections.rank, readiness };
}

function secondPc(snapshot: UpkeepSnapshot) {
  snapshot.roster.people.push(
    { characterId: 'pc-2', kind: 'pc', hitDice: 9 },
    { characterId: 'npc', kind: 'npc', hitDice: 20 },
  );
  snapshot.characters.push(
    { ...snapshot.characters[0]!, characterId: 'pc-2', level: 9 },
    { ...snapshot.characters[0]!, characterId: 'npc', level: 20 },
  );
}

test('rank waits for the earlier steps without implying a transition or boon', () => {
  const { rank: waiting } = rank((draft) => {
    draft.upkeep.rolls = {};
  });
  expect(waiting).toEqual({
    status: 'waiting',
    before: 8,
    after: null,
    training: null,
    next: null,
    capped: null,
    gains: [],
    issues: [],
  });
});

test('reaching Captain offers each PC the Captain feat cards from the rules', () => {
  const { rank: captain, view } = rank((_, snapshot) => secondPc(snapshot));
  expect(captain).toMatchObject({
    status: 'open',
    before: 8,
    after: 9,
    training: 109,
    next: { rank: 10, minimumTraining: 160 },
    capped: null,
  });
  expect(captain.gains).toHaveLength(1);
  const [gain] = captain.gains;
  expect(gain).toMatchObject({
    rank: 9,
    minimumTraining: 105,
    reward: { kind: 'title', title: 'Captain' },
  });
  // Only PCs gain boons; the NPC officer does not.
  expect(gain!.boons).toEqual(
    ['pc', 'pc-2'].map((characterId) => ({
      subjectId: `upkeep:boon:9:${characterId}`,
      characterId,
      name: characterId === 'pc' ? 'Ameiko' : 'Koya',
      acknowledgementId: `ack:upkeep:boon:9:${characterId}`,
      outcome: null,
      feats: {
        options: ['Great Fortitude', 'Iron Will', 'Lightning Reflexes'],
        selected: null,
      },
      required: true,
    })),
  );
  expect(view.requirements).toEqual([
    'upkeep:boon:9:pc:acknowledgement',
    'upkeep:boon:9:pc-2:acknowledgement',
  ]);
});

test('each unrecorded boon is its own named decision in This phase', () => {
  const { readiness } = rank((_, snapshot) => secondPc(snapshot));
  expect(readiness()).toMatchObject({
    ready: false,
    requirements: [
      {
        id: 'upkeep:boon:9:pc:acknowledgement',
        message: 'Ameiko: Record the rank 9 boon.',
      },
      {
        id: 'upkeep:boon:9:pc-2:acknowledgement',
        message: 'Koya: Record the rank 9 boon.',
      },
    ],
  });
});

test('a chosen feat card resolves the boon', () => {
  const { rank: chosen } = rank((draft) => {
    draft.acknowledgements = [
      {
        acknowledgementId: 'ack-ameiko',
        subjectId: 'upkeep:boon:9:pc',
        outcome: 'Iron Will',
      },
    ];
  });
  expect(chosen.status).toBe('resolved');
  expect(chosen.gains[0]!.boons[0]).toMatchObject({
    acknowledgementId: 'ack-ameiko',
    outcome: 'Iron Will',
    feats: { selected: 'Iron Will' },
    required: false,
  });
});

test('feat cards choose, replace and clear through the existing acknowledgement', () => {
  const { rank: open } = rank();
  const boon = open.gains[0]!.boons[0]!;
  expect(chooseBoonFeat(boon, 'Iron Will')).toEqual({
    kind: 'acknowledge',
    acknowledgement: {
      acknowledgementId: 'ack:upkeep:boon:9:pc',
      subjectId: 'upkeep:boon:9:pc',
      outcome: 'Iron Will',
    },
  });
  expect(clearBoon(boon)).toBeNull();
  const { rank: chosen } = rank((draft) => {
    draft.acknowledgements = [
      {
        acknowledgementId: 'ack-old',
        subjectId: 'upkeep:boon:9:pc',
        outcome: 'Iron Will',
      },
    ];
  });
  const selected = chosen.gains[0]!.boons[0]!;
  expect(chooseBoonFeat(selected, 'Iron Will')).toEqual({
    kind: 'clear_acknowledgement',
    acknowledgementId: 'ack-old',
  });
  expect(chooseBoonFeat(selected, 'Great Fortitude')).toEqual({
    kind: 'acknowledge',
    acknowledgement: {
      acknowledgementId: 'ack-old',
      subjectId: 'upkeep:boon:9:pc',
      outcome: 'Great Fortitude',
    },
  });
});

test('several rank gains list every rank and threshold with open text boons', () => {
  const { rank: gains } = rank((draft, snapshot) => {
    snapshot.rank = 3;
    snapshot.training = 41;
    snapshot.treasuryCopper = 100000;
    draft.acknowledgements = [
      {
        acknowledgementId: 'ack-gift',
        subjectId: 'upkeep:boon:6:pc',
        outcome: 'Took the gold',
      },
    ];
  });
  expect(gains).toMatchObject({
    status: 'open',
    before: 3,
    after: 6,
    training: 40,
    next: { rank: 7, minimumTraining: 55 },
  });
  expect(
    gains.gains.map((gain) => [
      gain.rank,
      gain.minimumTraining,
      gain.reward.kind,
      gain.boons.map((boon) => boon.feats?.options ?? boon.outcome),
    ]),
  ).toEqual([
    [4, 20, 'title', [['Alertness', 'Deceitful', 'Persuasive', 'Stealthy']]],
    [5, 30, 'xp', [null]],
    [6, 40, 'gift', ['Took the gold']],
  ]);
  const gift = gains.gains[2]!.boons[0]!;
  expect(gift).toMatchObject({ feats: null, required: false });
  expect(recordBoon(gift, 'Kept the gold')).toMatchObject({
    acknowledgement: {
      acknowledgementId: 'ack-gift',
      outcome: 'Kept the gold',
    },
  });
  expect(clearBoon(gift)).toEqual({
    kind: 'clear_acknowledgement',
    acknowledgementId: 'ack-gift',
  });
});

test('the highest PC level caps the rank training alone would reach', () => {
  const { rank: capped } = rank((_, snapshot) => {
    snapshot.characters[0]!.level = 8;
    snapshot.training = 170;
  });
  expect(capped).toMatchObject({
    after: 8,
    training: 169,
    capped: { trainingRank: 10, highestPcLevel: 8 },
    gains: [],
    next: { rank: 9, minimumTraining: 105 },
  });
});

test('an unchanged rank reports its next threshold and any PC-level warning', () => {
  const { rank: stays } = rank((_, snapshot) => {
    snapshot.training = 90;
    snapshot.characters[0]!.level = 7;
  });
  expect(stays).toMatchObject({
    status: 'resolved',
    before: 8,
    after: 8,
    training: 89,
    next: { rank: 9, minimumTraining: 105 },
    capped: { trainingRank: 8, highestPcLevel: 7 },
    gains: [],
    issues: [{ code: 'rank:pc-cap' }],
  });
  // Level and rank equal: training is short too, but the level also caps.
  const { rank: atLevel } = rank((_, snapshot) => {
    snapshot.training = 90;
    snapshot.characters[0]!.level = 8;
  });
  expect(atLevel).toMatchObject({
    capped: { trainingRank: 8, highestPcLevel: 8 },
    issues: [],
  });
  const { rank: belowLevel } = rank((_, snapshot) => {
    snapshot.training = 90;
  });
  expect(belowLevel.capped).toBeNull();
});

test('boon descriptions name what each PC gains', () => {
  const { rank: gains } = rank((_, snapshot) => {
    snapshot.rank = 1;
    snapshot.training = 170;
  });
  expect(gains.gains.map((gain) => boonDescription(gain.reward))).toEqual([
    'Skilled: 1 bonus skill rank for each PC',
    'Gift: potion worth 300 gp or less for each PC',
    'Title: Director. Each PC chooses one bonus feat',
    'XP award: 1,200 XP split among the PCs (1,200 each)',
    'Gift: a tribute of 750 gp for each PC',
    'Skilled: 1 bonus skill rank for each PC',
    'Gift: armor or wand worth 1,200 gp or less for each PC; wands come fully charged',
    'Title: Captain. Each PC chooses one bonus feat',
    'XP award: 3,200 XP split among the PCs (3,200 each)',
  ]);
});
