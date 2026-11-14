import type { WeeklyDraftEdit } from '../../src/lib/weekly-draft-contract';
import { roll } from './upkeep-fixture';

// Worked week for the mid-campaign rehearsal: recover the missing patrol,
// record Upkeep dice, acknowledge the two rank rewards, and roll no new event.
export function initializationEdits(
  teamId: string,
  characterId: string,
): WeeklyDraftEdit[] {
  return [
    {
      kind: 'upkeep_team',
      teamId,
      decision: { teamId, decision: 'recover', roll: roll(20, 20) },
    },
    { kind: 'upkeep_roll', field: 'check', roll: roll(20, 20) },
    { kind: 'upkeep_roll', field: 'training', roll: roll(6, 1) },
    { kind: 'upkeep_roll', field: 'loss', roll: roll(6, 1) },
    { kind: 'upkeep_roll', field: 'notoriety', roll: roll(6, 1) },
    { kind: 'event_chance', roll: roll(100, 100) },
    ...[5, 6].map((rank) => ({
      kind: 'acknowledge' as const,
      acknowledgement: {
        acknowledgementId: `boon:${rank}`,
        subjectId: `upkeep:boon:${rank}:${characterId}`,
        outcome: 'Rehearsal reward recorded',
      },
    })),
  ];
}
