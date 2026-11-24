import { abilityModifier } from './ability-scores';
import type { CharacterKind } from './character-kind';

export function getTeamManagerCharismaBonus(charisma: number) {
  return Math.max(0, abilityModifier(charisma));
}

// How many teams a roster person normally manages, from the roster the rules
// are evaluating at that point. An NPC is an Officer exactly while holding a
// role there: pending roles never make one.
export function getTeamManagerLimit({
  officers,
  person,
  charisma,
}: {
  officers: readonly { characterId: string }[];
  person: { characterId: string; kind: CharacterKind };
  charisma: number;
}) {
  const isOfficer = officers.some(
    (officer) => officer.characterId === person.characterId,
  );
  return person.kind === 'pc' || isOfficer
    ? Math.max(1, abilityModifier(charisma))
    : 1;
}

export function countManagedTeams(
  teams: readonly { managerCharacterId: string | null }[],
  characterId: string,
) {
  return teams.filter((team) => team.managerCharacterId === characterId).length;
}
