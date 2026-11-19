import { describe, expect, it } from 'vitest';
import { CHARACTER_KINDS } from './character-kind';
import {
  getTeamManagerCharismaBonus,
  getTeamManagerLimit,
} from './team-manager-rules';

describe('team manager rules', () => {
  it('adds only a nonnegative Charisma bonus to manager checks', () => {
    expect(getTeamManagerCharismaBonus(8)).toBe(0);
    expect(getTeamManagerCharismaBonus(18)).toBe(4);
  });

  it('[rules.O06.role-aware] a PC, or an NPC holding a role, manages max(1, Charisma modifier) teams; an NPC holding none manages one', () => {
    // Charisma 16, 11 and 6: positive, zero and negative modifiers.
    const charismas = [
      [16, 3],
      [11, 1],
      [6, 1],
    ] as const;
    for (const kind of CHARACTER_KINDS) {
      const person = { characterId: 'a', kind };
      for (const [charisma, officerLimit] of charismas) {
        const withRole = getTeamManagerLimit({
          officers: [{ characterId: 'a' }],
          person,
          charisma,
        });
        // Another person's role never makes this one an Officer.
        const withoutRole = getTeamManagerLimit({
          officers: [{ characterId: 'b' }],
          person,
          charisma,
        });
        expect(withRole, `${kind} ${charisma} with a role`).toBe(officerLimit);
        expect(withoutRole, `${kind} ${charisma} without a role`).toBe(
          kind === 'pc' ? officerLimit : 1,
        );
      }
    }
  });
});
