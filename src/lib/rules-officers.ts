import { abilityModifier } from './ability-scores';
import { getEffectiveHitDice, type CanonicalRoster } from './canonical-roster';
import { CANONICAL_WEEKLY_RULESET_VERSION } from './ruleset-versions';
import type { Ability } from './character-sheet-abilities';

export type FoundationCharacter = {
  characterId: string;
  level: number;
  racialHitDice?: number;
  actualHitDice?: number | null;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  /** Scores the Character's sheet cannot calculate yet; never read as known. */
  unresolvedAbilities?: Ability[];
  isActive: boolean;
};
export type OrganizationCheck = 'loyalty' | 'secrecy' | 'security';
const abilities = {
  loyalty: ['constitution', 'charisma'],
  secrecy: ['dexterity', 'intelligence'],
  security: ['strength', 'wisdom'],
} as const;
export type OfficerAbility = (typeof abilities)[OrganizationCheck][number];
/**
 * The ability an officer adds to a check and its modifier: the better of
 * the two the rules allow, the first on a tie.
 */
export function officerAbilitySource(
  character: FoundationCharacter,
  check: OrganizationCheck,
): { ability: OfficerAbility; modifier: number } {
  const [first, second] = abilities[check];
  const one = abilityModifier(character[first]);
  const two = abilityModifier(character[second]);
  return two > one
    ? { ability: second, modifier: two }
    : { ability: first, modifier: one };
}
export function officerAbility(
  character: FoundationCharacter,
  check: OrganizationCheck,
) {
  return officerAbilitySource(character, check).modifier;
}
/**
 * The abilities a check would compare for this officer that their sheet
 * cannot calculate. Either one may be the better, so both must be known.
 */
export function unresolvedOfficerAbilities(
  character: FoundationCharacter,
  check: OrganizationCheck,
): OfficerAbility[] {
  return abilities[check].filter((ability) =>
    character.unresolvedAbilities?.includes(ability),
  );
}
export function projectOfficers(
  roster: CanonicalRoster,
  characters: FoundationCharacter[],
  focus: string | null,
  rulesetVersion = CANONICAL_WEEKLY_RULESET_VERSION,
) {
  const requirements: string[] = [];
  const warnings: string[] = [];
  function holders(role: CanonicalRoster['officers'][number]['role']) {
    return roster.officers
      .filter((x) => x.role === role)
      .flatMap((x) => {
        const character = characters.find(
          (c) => c.characterId === x.characterId,
        );
        if (!character) {
          requirements.push(`officer:${x.characterId}:character`);
          return [];
        }
        // Archiving does not silently unassign a person; the table can correct it.
        if (!character.isActive)
          warnings.push(`officer:${x.characterId}:archived`);
        return [character];
      });
  }
  function best(assigned: FoundationCharacter[], check: OrganizationCheck) {
    return assigned.length
      ? Math.max(...assigned.map((x) => officerAbility(x, check)))
      : 0;
  }
  const overseers = holders('overseer');
  const strategists = holders('strategist');
  const commandants = holders('commandant');
  // Commandants stack: each distinct holder adds their effective Hit Dice.
  // Unresolved Hit Dice add nothing here and are required by a Drill.
  const unresolvedCommandants: string[] = [];
  const commandantTrainingBonus = commandants.reduce((total, character) => {
    const person = roster.people.find(
      (x) => x.characterId === character.characterId,
    );
    const hitDice = person
      ? getEffectiveHitDice(person, character, rulesetVersion)
      : 0;
    if (hitDice === null) {
      unresolvedCommandants.push(character.characterId);
      return total;
    }
    return total + hitDice;
  }, 0);
  const secondary = (check: OrganizationCheck) =>
    focus && check !== focus.toLowerCase() && overseers.length ? 1 : 0;
  // Each check's bonus comes from the holders of one role.
  const checkHolders: Record<OrganizationCheck, FoundationCharacter[]> = {
    loyalty: holders('ambassador'),
    secrecy: holders('spymaster'),
    security: holders('marshal'),
  };
  const bonuses = {
    loyalty: best(checkHolders.loyalty, 'loyalty') + secondary('loyalty'),
    secrecy: best(checkHolders.secrecy, 'secrecy') + secondary('secrecy'),
    security: best(checkHolders.security, 'security') + secondary('security'),
  };
  // Each check's unresolved officer abilities. A check that reads them
  // requires them; Character facts alone never block a week.
  const unresolvedFor = (check: OrganizationCheck) =>
    checkHolders[check].flatMap((character) =>
      unresolvedOfficerAbilities(character, check).map((ability) => ({
        characterId: character.characterId,
        ability,
      })),
    );
  const unresolvedBonuses = {
    loyalty: unresolvedFor('loyalty'),
    secrecy: unresolvedFor('secrecy'),
    security: unresolvedFor('security'),
  };
  return {
    requirements,
    warnings,
    bonuses,
    commandantTrainingBonus,
    unresolvedCommandants,
    unresolvedBonuses,
    strategistAssigned: strategists.length > 0,
    overseers,
  };
}
