import { getMinimumTrainingForRank } from '~/lib/militia-progression-rules';
import { boonFeatChoices, type ProgressionBoon } from '~/lib/rules-progression';
import type { projectUpkeep } from '~/lib/rules-upkeep';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type {
  UpkeepIssue,
  UpkeepRank,
  UpkeepRankBoon,
  UpkeepRankGain,
} from './types';
import { formatGold } from './week-frame/reference-copy';

type Projection = ReturnType<typeof projectUpkeep>;

// Step 4. Rank waits for every earlier Upkeep decision; then it reports the
// actual transition, the training threshold, the highest-PC-level cap and
// each gained rank's boon for every eligible PC. Boon outcomes stay the
// existing text acknowledgements of `upkeep:boon:<rank>:<characterId>`.
export function rankSection({
  snapshot,
  people,
  projection,
  earlierOpen,
  issues: rankIssues,
}: {
  snapshot: WorkspaceSource['snapshot'];
  people: WorkspaceSource['people'];
  projection: Projection;
  earlierOpen: boolean;
  issues: UpkeepIssue[];
}): UpkeepRank {
  const before = snapshot.rank;
  const noPc = projection.requirements.includes('highest-level-pc');
  const issues = [
    ...(noPc
      ? [
          {
            code: 'highest-level-pc',
            message:
              'The rank cap needs the highest player-character level, but no active player character is on the roster. Add or reactivate one in Characters & officers.',
          },
        ]
      : []),
    ...rankIssues,
  ];
  const progression = projection.progression;
  if (earlierOpen || !progression)
    return {
      status: 'waiting',
      before,
      after: null,
      training: null,
      next: null,
      capped: null,
      gains: [],
      issues,
    };
  const change = projection.plan.find((item) => item.kind === 'rank');
  const after = noPc ? null : change?.kind === 'rank' ? change.after : before;
  const nextTraining =
    after === null ? undefined : getMinimumTrainingForRank(after + 1);
  const gains = projection.boons.map((reward) =>
    rankGain(people, projection, reward),
  );
  const open =
    noPc ||
    projection.requirements.some(
      (key) => key.startsWith('upkeep:boon:') || key.startsWith('rank:'),
    );
  return {
    status: open ? 'open' : 'resolved',
    before,
    after,
    training: progression.training,
    next:
      after !== null && nextTraining !== undefined
        ? { rank: after + 1, minimumTraining: nextTraining }
        : null,
    capped:
      after !== null &&
      nextTraining !== undefined &&
      progression.highestPcLevel !== null &&
      progression.highestPcLevel <= after
        ? {
            trainingRank: progression.trainingRank,
            highestPcLevel: progression.highestPcLevel,
          }
        : null,
    gains,
    issues,
  };
}

function rankGain(
  people: WorkspaceSource['people'],
  projection: Projection,
  reward: ProgressionBoon,
): UpkeepRankGain {
  const options = boonFeatChoices(reward);
  return {
    rank: reward.rank,
    minimumTraining: getMinimumTrainingForRank(reward.rank) ?? 0,
    reward,
    // The projection's boon entries own each PC's subject and recorded
    // acknowledgement.
    boons: projection.plan.flatMap((change) => {
      if (change.kind !== 'boon' || change.reward.rank !== reward.rank)
        return [];
      const { subjectId, characterId, acknowledgement } = change;
      const outcome = acknowledgement?.outcome ?? null;
      const selected =
        outcome !== null && options?.includes(outcome) ? outcome : null;
      return [
        {
          subjectId,
          characterId,
          name:
            people.find((person) => person.characterId === characterId)?.name ??
            'Unnamed character',
          acknowledgementId:
            acknowledgement?.acknowledgementId ?? `ack:${subjectId}`,
          outcome,
          feats: options ? { options, selected } : null,
          required: projection.requirements.includes(
            `${subjectId}:acknowledgement`,
          ),
        },
      ];
    }),
  };
}

// Records a boon's outcome: a chosen feat or the open text.
export function recordBoon(
  boon: UpkeepRankBoon,
  outcome: string,
): WeeklyDraftEdit {
  return {
    kind: 'acknowledge',
    acknowledgement: {
      acknowledgementId: boon.acknowledgementId,
      subjectId: boon.subjectId,
      outcome,
    },
  };
}

// Clears a recorded boon outcome; nothing to send when none is recorded.
export function clearBoon(boon: UpkeepRankBoon): WeeklyDraftEdit | null {
  return boon.outcome === null
    ? null
    : {
        kind: 'clear_acknowledgement',
        acknowledgementId: boon.acknowledgementId,
      };
}

// Tapping a feat card chooses it; tapping the chosen card clears it.
export function chooseBoonFeat(
  boon: UpkeepRankBoon,
  feat: string,
): WeeklyDraftEdit | null {
  return feat === boon.feats?.selected
    ? clearBoon(boon)
    : recordBoon(boon, feat);
}

// What a boon grants each PC, in the words of the PC Boons rules.
export function boonDescription(reward: ProgressionBoon) {
  switch (reward.kind) {
    case 'skilled':
      return `Skilled: ${reward.skillRanks} bonus skill rank for each PC`;
    case 'gift':
      return /\bgp$/.test(reward.gift)
        ? `Gift: a tribute of ${reward.gift} for each PC`
        : `Gift: ${reward.gift} worth ${formatGold(reward.maxValueCopper)} or less for each PC${reward.fullyChargedWands ? '; wands come fully charged' : ''}`;
    case 'title':
      return boonFeatChoices(reward)
        ? `Title: ${reward.title}. Each PC chooses one bonus feat`
        : `Title: ${reward.title}. Each PC gains any one bonus feat they qualify for`;
    case 'xp':
      return `XP award: ${reward.xp.toLocaleString('en-US')} XP split among the PCs${reward.xpPerPc === null ? '' : ` (${reward.xpPerPc.toLocaleString('en-US')} each)`}`;
  }
}
