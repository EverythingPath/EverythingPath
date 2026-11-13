import teams from './militia-team-table';
import type { CanonicalRoster } from './canonical-roster';
import type { FoundationCharacter } from './rules-officers';
import {
  countManagedTeams,
  getTeamManagerCharismaBonus,
  getTeamManagerLimit,
} from './team-manager-rules';

export function getTeamCost(teamType: string) {
  return (
    teams.find((team) => team.upgrade?.to.includes(teamType))?.upgrade?.cost ??
    0
  );
}
export function isUpgradePathAllowed(from: string, to: string) {
  return (
    teams.find((team) => team.id === from)?.upgrade?.to.includes(to) ?? false
  );
}
export type ActivityTeamUse = {
  usedTeamIds: string[];
  upgradedTeamIds: string[];
};
export function projectTeams(
  roster: CanonicalRoster,
  characters: FoundationCharacter[],
  activity?: ActivityTeamUse,
) {
  const requirements: string[] = [];
  const warnings: string[] = [];
  const managers = new Map(
    roster.people.map((person) => {
      const character = characters.find(
        (x) => x.characterId === person.characterId,
      );
      if (!character) return [person.characterId, null];
      const maxTeams = getTeamManagerLimit({
        officers: roster.officers,
        person,
        charisma: character.charisma,
      });
      const managedTeams = countManagedTeams(roster.teams, person.characterId);
      if (managedTeams > maxTeams)
        warnings.push(`manager:${person.characterId}:capacity`);
      if (managedTeams && !character.isActive)
        warnings.push(`manager:${person.characterId}:archived`);
      return [
        person.characterId,
        {
          characterId: person.characterId,
          maxTeams,
          managedTeams,
          bonus: getTeamManagerCharismaBonus(character.charisma),
          // The bonus reads Charisma; a check that adds it requires it first.
          isCharismaUnresolved:
            character.unresolvedAbilities?.includes('charisma') ?? false,
        },
      ];
    }),
  );
  const projected = roster.teams.map((team) => {
    // Safe cast: the roster schema limits `teamType` to TEAM_IDS, and the team
    // table defines every one of them.
    const definition = teams.find((x) => x.id === team.teamType)!;
    const manager = team.managerCharacterId
      ? (managers.get(team.managerCharacterId) ?? null)
      : null;
    if (team.managerCharacterId && !manager)
      requirements.push(`manager:${team.managerCharacterId}:character`);
    return {
      ...team,
      tier: definition.tier,
      size: definition.size,
      actions: definition.grantedActions,
      recruitment: definition.recruitment ?? null,
      upgrades: (definition.upgrade?.to ?? []).map((teamType) => ({
        teamType,
        costCopper: getTeamCost(teamType) * 100,
      })),
      available:
        team.status === 'active' &&
        !activity?.usedTeamIds.includes(team.teamId) &&
        !activity?.upgradedTeamIds.includes(team.teamId),
      manager,
    };
  });
  return { teams: projected, requirements, warnings };
}
