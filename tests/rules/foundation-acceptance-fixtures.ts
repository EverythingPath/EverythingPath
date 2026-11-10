import { upkeepFixture, roll } from './upkeep-fixture';
import type { projectWeeklyDraft } from '../../src/lib/canonical-weekly-resolution';
type CanonicalResolutionInput = Parameters<typeof projectWeeklyDraft>[0];

// Independent transcription of Table 6-1: rank, training, focused, secondary, actions, teams.
export const foundationRows = [
  [1, 0, 2, 0, 1, 2],
  [2, 10, 3, 0, 2, 2],
  [3, 15, 3, 1, 2, 3],
  [4, 20, 4, 1, 2, 3],
  [5, 30, 4, 1, 2, 4],
  [6, 40, 5, 2, 2, 4],
  [7, 55, 5, 2, 3, 4],
  [8, 75, 6, 2, 3, 5],
  [9, 105, 6, 3, 3, 5],
  [10, 160, 7, 3, 3, 5],
  [11, 235, 7, 3, 4, 6],
  [12, 330, 8, 4, 4, 6],
  [13, 475, 8, 4, 4, 6],
  [14, 665, 9, 4, 4, 6],
  [15, 855, 9, 5, 5, 7],
  [16, 1350, 10, 5, 5, 7],
  [17, 1900, 10, 5, 5, 7],
  [18, 2700, 11, 6, 5, 7],
  [19, 3850, 11, 6, 6, 7],
  [20, 5350, 12, 6, 6, 8],
] as const;

export function foundationWeek(
  rank = 3,
  focus: 'Loyalty' | 'Secrecy' | 'Security' = 'Loyalty',
): CanonicalResolutionInput {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = rank;
  snapshot.training = foundationRows[rank - 1]![1] + 1;
  snapshot.treasuryCopper = 100000;
  snapshot.focus = focus;
  snapshot.roster.officers = [];
  snapshot.characters[0]!.level = 20;
  draft.upkeep.rolls = { check: roll(20, 19), training: roll(6, 1) };
  draft.event.chanceRoll = roll(100, 100);
  return { revision: draft, militiaSnapshot: snapshot };
}

export function foundationAcceptanceFixtures(): {
  name: string;
  input: CanonicalResolutionInput;
}[] {
  return foundationRows.flatMap(([rank]) =>
    (['Loyalty', 'Secrecy', 'Security'] as const).map((focus) => ({
      name: `rank-${rank}-${focus}`,
      input: foundationWeek(rank, focus),
    })),
  );
}

export function foundationCompoundFixtures(): {
  name: string;
  input: CanonicalResolutionInput;
}[] {
  const commandants = foundationWeek(3);
  commandants.militiaSnapshot.characters[0]!.charisma = 34;
  commandants.militiaSnapshot.roster.people[0]!.hitDice = 3;
  commandants.militiaSnapshot.roster.people.push({
    characterId: 'npc',
    kind: 'npc',
    hitDice: 7,
  });
  commandants.militiaSnapshot.characters.push({
    ...commandants.militiaSnapshot.characters[0]!,
    characterId: 'npc',
    level: 2,
  });
  commandants.militiaSnapshot.roster.officers = [
    { role: 'ambassador', characterId: 'pc' },
    { role: 'commandant', characterId: 'pc' },
    { role: 'commandant', characterId: 'npc' },
  ];
  commandants.revision.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: {
      check: roll(20, 1),
      training: roll(6, 3, 3),
      notoriety: roll(6, 5),
    },
  };
  const boons = foundationWeek(1);
  boons.militiaSnapshot.training = 5351;
  for (let rank = 2; rank <= 20; rank++)
    boons.revision.acknowledgements.push({
      acknowledgementId: `boon-${rank}`,
      subjectId: `upkeep:boon:${rank}:pc`,
      outcome:
        rank === 19
          ? 'Champion: player confirmed prerequisites for Power Attack and recorded the feat.'
          : `Player recorded rank ${rank} reward.`,
    });
  return [
    { name: 'commandants-natural-one', input: commandants },
    { name: 'all-boon-acknowledgements', input: boons },
  ];
}
