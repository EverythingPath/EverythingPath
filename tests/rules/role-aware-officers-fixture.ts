import { foundationWeek } from './foundation-acceptance-fixtures';
import { roll } from './upkeep-fixture';
import type { CharacterKind } from '../../src/lib/character-kind';

/**
 * A complete week in which `ally` manages two teams: a PC or an NPC, with or
 * without an officer role, at the given Charisma.
 */
export function managerWeek(
  kind: CharacterKind,
  holdsRole: boolean,
  charisma: number,
) {
  const input = foundationWeek(3);
  const snapshot = input.militiaSnapshot;
  snapshot.roster.people.push({ characterId: 'ally', kind, hitDice: null });
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'ally',
    charisma,
  });
  snapshot.roster.officers = holdsRole
    ? [{ role: 'marshal', characterId: 'ally' }]
    : [];
  snapshot.roster.teams = ['one', 'two'].map((teamId) => ({
    teamId,
    teamType: 'patrons' as const,
    name: teamId,
    status: 'active' as const,
    managerCharacterId: 'ally',
    rewardCapExempt: false,
    notes: '',
  }));
  // A team check surfaces the manager's limit in the week's warnings.
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'earn',
    actionId: 'earn_gold',
    teamId: 'one',
    rolls: { check: roll(20, 10) },
  };
  return input;
}

/**
 * A complete week with one Drill and two commandants: the PC with 3 Hit Dice
 * and an NPC of level 4 whose Hit Dice override is blank, zero or explicit.
 * By default a natural one still succeeds through the PC Ambassador's
 * Charisma; Charisma 10 makes it fail.
 */
export function commandantDrillWeek(
  die: number,
  npcHitDice: number | null,
  ambassadorCharisma = die === 1 ? 34 : 10,
) {
  const input = foundationWeek(3);
  const snapshot = input.militiaSnapshot;
  snapshot.characters[0]!.charisma = ambassadorCharisma;
  snapshot.roster.people[0]!.hitDice = 3;
  snapshot.roster.people.push({
    characterId: 'npc',
    kind: 'npc',
    hitDice: npcHitDice,
  });
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'npc',
    level: 4,
  });
  snapshot.roster.officers = [
    { role: 'ambassador', characterId: 'pc' },
    { role: 'commandant', characterId: 'pc' },
    { role: 'commandant', characterId: 'npc' },
  ];
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: {
      check: roll(20, die),
      training: roll(6, 3, 3),
      notoriety: roll(6, 5),
    },
  };
  return input;
}
