import type { z } from 'zod';
import type { CharacterKind } from '../../src/lib/character-kind';
import type { militiaSnapshotSchema } from '../../src/lib/canonical-weekly-source';

type Snapshot = z.input<typeof militiaSnapshotSchema>;

// Character records and a roster that mirrors them, with one mismatched
// mirror (Rook's record is PC, the roster still says NPC). Hit Dice cover a
// blank override, explicit zero and positive values.
export const kindRecords = [
  { characterId: 'aubrin', name: 'Aubrin', kind: 'pc', charisma: 14 },
  { characterId: 'mara', name: 'Mara', kind: 'pc', charisma: 8 },
  { characterId: 'ostler', name: 'Ostler', kind: 'npc', charisma: 18 },
  { characterId: 'rook', name: 'Rook', kind: 'pc', charisma: 18 },
  { characterId: 'vessa', name: 'Vessa', kind: 'npc', charisma: 16 },
] as const satisfies ReadonlyArray<{
  characterId: string;
  name: string;
  kind: CharacterKind;
  charisma: number;
}>;

export function kindSnapshot() {
  return {
    rank: 3,
    training: 4,
    treasuryCopper: 5000,
    notoriety: 1,
    focus: 'Loyalty',
    characters: kindRecords.map((record, index) => ({
      characterId: record.characterId,
      level: index + 2,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: record.charisma,
      isActive: record.characterId !== 'rook',
    })),
    roster: {
      people: [
        { characterId: 'aubrin', kind: 'pc', hitDice: null },
        { characterId: 'mara', kind: 'pc', hitDice: 0 },
        { characterId: 'ostler', kind: 'npc', hitDice: 5 },
        { characterId: 'rook', kind: 'npc', hitDice: null },
        { characterId: 'vessa', kind: 'npc', hitDice: 3 },
      ],
      officers: [
        { role: 'commandant', characterId: 'ostler' },
        { role: 'commandant', characterId: 'vessa' },
        { role: 'marshal', characterId: 'mara' },
      ],
      teams: [
        team('first', 'ostler'),
        team('second', 'ostler'),
        team('third', 'rook'),
        team('fourth', 'rook'),
        team('fifth', 'vessa'),
        team('sixth', 'vessa'),
      ],
    },
    settlements: [],
    bonuses: [],
  } satisfies Snapshot;
}

function team(teamId: string, managerCharacterId: string) {
  return {
    teamId,
    teamType: 'defenders',
    name: teamId,
    status: 'active',
    rewardCapExempt: false,
    managerCharacterId,
    notes: '',
  } as const;
}
