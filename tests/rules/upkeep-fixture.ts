import { createWeeklyDraft } from '../../src/lib/weekly-draft';
import type { UpkeepSnapshot } from '../../src/lib/rules-upkeep';
import type { WeeklyDraft } from '../../src/lib/weekly-draft-contract';

export function upkeepFixture() {
  const draft = createWeeklyDraft({
    draftId: 'week-40',
    week: 40,
    slotIds: ['one', 'two'],
    context: {
      firstMilitiaWeek: false,
      startDay: 273,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  const snapshot: UpkeepSnapshot = {
    rank: 3,
    training: 30,
    treasuryCopper: 3000,
    notoriety: 0,
    focus: 'Loyalty',
    roster: {
      people: [{ characterId: 'pc', kind: 'pc', hitDice: 10 }],
      officers: [{ role: 'ambassador', characterId: 'pc' }],
      teams: [],
    },
    characters: [
      {
        characterId: 'pc',
        level: 10,
        isActive: true,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    ],
    settlements: [],
    bonuses: [],
  };
  return { draft, snapshot };
}
// A table roll recorded as its dice total: `roll(4, 3, 2)` is 2d4 totalling 5.
export function roll(
  sides: number,
  ...dice: number[]
): WeeklyDraft['upkeep']['rolls']['check'] & {} {
  return {
    sides,
    diceTotal: dice.reduce((sum, die) => sum + die, 0),
    diceCount: dice.length,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
