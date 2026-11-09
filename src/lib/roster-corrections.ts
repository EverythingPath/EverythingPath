import type { CanonicalRoster } from './canonical-roster';
import {
  weeklySourceKey,
  type CanonicalWeekState,
} from './canonical-weekly-source';
import { mirrorRosterKinds, type CharacterKind } from './character-kind';
import {
  ABILITY_LABELS,
  BOARD_ROLES,
  heldRoles,
  MISSING_NAME,
  officerBoard,
  ROLE_CHECKS,
  ROLE_LABELS,
  signed,
  type OfficerRole,
  type RoleCard,
} from './officer-board';
import {
  officerAbilitySource,
  unresolvedOfficerAbilities,
  type FoundationCharacter,
  type OrganizationCheck,
} from './rules-officers';
import { countManagedTeams, getTeamManagerLimit } from './team-manager-rules';

// The two reasoned corrections of Characters & officers, as pure changes to
// the accepted militia. Correct officers replaces only the officer
// assignments; Correct roster replaces membership and Hit Dice overrides and
// removes only the roles and team managers of the people it removes. Every
// other fact, character facts included, comes from the latest militia.

type Snapshot = CanonicalWeekState['militiaSnapshot'];
export type Officer = CanonicalRoster['officers'][number];
type Focus = NonNullable<Snapshot['focus']>;

/**
 * What both corrections depend on: roster people (their kind mirror
 * included), officer assignments and who manages which team. Another
 * player's change to any of it is a conflict; team names, conditions and
 * every other section are merged from the latest militia instead.
 */
export function rosterBaselineKey(snapshot: Snapshot): string {
  const { people, officers, teams } = snapshot.roster;
  return weeklySourceKey({
    people,
    officers,
    managers: teams.flatMap((team) =>
      team.managerCharacterId === null
        ? []
        : [[team.teamId, team.managerCharacterId]],
    ),
  });
}

const holds = (officer: Officer, role: OfficerRole, characterId: string) =>
  officer.role === role && officer.characterId === characterId;

/** Adds the role to the person, keeping their other roles; never twice. */
export function assignOfficer(
  officers: readonly Officer[],
  role: OfficerRole,
  characterId: string,
): Officer[] {
  return officers.some((officer) => holds(officer, role, characterId))
    ? [...officers]
    : [...officers, { role, characterId }];
}

export function removeOfficer(
  officers: readonly Officer[],
  role: OfficerRole,
  characterId: string,
): Officer[] {
  return officers.filter((officer) => !holds(officer, role, characterId));
}

/**
 * Move to…: the holder's `from` role is replaced by `to`, joining it after
 * its existing holders. A role they already hold is never added again, so
 * the same person never counts twice.
 */
export function moveOfficer(
  officers: readonly Officer[],
  characterId: string,
  from: OfficerRole,
  to: OfficerRole,
): Officer[] {
  if (from === to) return [...officers];
  return assignOfficer(
    removeOfficer(officers, from, characterId),
    to,
    characterId,
  );
}

/** The roles a holder of `from` can move to: those they do not hold. */
export function moveTargets(
  officers: readonly Officer[],
  characterId: string,
  from: OfficerRole,
): OfficerRole[] {
  return BOARD_ROLES.filter(
    (role) =>
      role !== from &&
      !officers.some((officer) => holds(officer, role, characterId)),
  );
}

/** The latest militia with only its officer assignments replaced. */
export function applyOfficerCorrection(
  latest: Snapshot,
  officers: readonly Officer[],
): Snapshot {
  return { ...latest, roster: { ...latest.roster, officers: [...officers] } };
}

/** One person on the corrected roster: blank Hit Dice follows the record. */
export type RosterEntry = { characterId: string; hitDice: number | null };
export type RecordKind = { characterId: string; kind: CharacterKind };

/**
 * The latest militia with the corrected roster membership and Hit Dice
 * overrides. People who stay keep their place; joining people follow, with
 * their record's kind. The roles and team managers of people it removes
 * are cleared, using the latest teams; nothing else changes. Every roster
 * kind mirrors the current record.
 */
export function applyRosterCorrection(
  latest: Snapshot,
  entries: readonly RosterEntry[],
  records: readonly RecordKind[],
): Snapshot {
  const wanted = new Map(entries.map((entry) => [entry.characterId, entry]));
  const current = new Set(latest.roster.people.map((p) => p.characterId));
  const kinds = new Map(records.map((record) => [record.characterId, record]));
  const people = [
    ...latest.roster.people.flatMap((person) => {
      const entry = wanted.get(person.characterId);
      return entry ? [{ ...person, hitDice: entry.hitDice }] : [];
    }),
    ...entries
      .filter((entry) => !current.has(entry.characterId))
      .map((entry) => ({
        characterId: entry.characterId,
        // A joining person without a record keeps the PC default.
        kind: kinds.get(entry.characterId)?.kind ?? 'pc',
        hitDice: entry.hitDice,
      })),
  ];
  const on = new Set(people.map((person) => person.characterId));
  const removed = (id: string | null) =>
    id !== null && current.has(id) && !on.has(id);
  return {
    ...latest,
    roster: mirrorRosterKinds(
      {
        people,
        officers: latest.roster.officers.filter(
          (officer) => !removed(officer.characterId),
        ),
        teams: latest.roster.teams.map((team) =>
          removed(team.managerCharacterId)
            ? { ...team, managerCharacterId: null }
            : team,
        ),
      },
      records,
    ),
  };
}

/** "A", "A and B", "A, B and C". */
function listed(values: readonly string[]) {
  return values.length <= 2
    ? values.join(' and ')
    : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}
const nameOf = (names: ReadonlyMap<string, string>, id: string) =>
  names.get(id) ?? MISSING_NAME;

/**
 * What leaving the roster takes with it, named before Save: "Removing Sera
 * of Phaendar removes them as Ambassador and clears the manager of
 * Smugglers and Town Watch." A person who held nothing is not warned about.
 */
export function rosterRemovalWarnings(
  latest: Snapshot,
  candidate: Snapshot,
  names: ReadonlyMap<string, string>,
): string[] {
  const staying = new Set(candidate.roster.people.map((p) => p.characterId));
  return latest.roster.people.flatMap(({ characterId }) => {
    if (staying.has(characterId)) return [];
    const roles = heldRoles(latest.roster.officers, characterId).map(
      (role) => ROLE_LABELS[role],
    );
    const teams = latest.roster.teams
      .filter((team) => team.managerCharacterId === characterId)
      .map((team) => team.name);
    const parts = [
      ...(roles.length ? [`removes them as ${listed(roles)}`] : []),
      ...(teams.length ? [`clears the manager of ${listed(teams)}`] : []),
    ];
    return parts.length
      ? [`Removing ${nameOf(names, characterId)} ${parts.join(' and ')}.`]
      : [];
  });
}

/**
 * People whose team limit this correction lowers below the teams they
 * manage: an NPC losing their last role. "Removing Grom's last officer role
 * lowers their team limit to 1; they manage 2 teams."
 */
export function managerLimitWarnings(
  latest: Snapshot,
  candidate: Snapshot,
  names: ReadonlyMap<string, string>,
): string[] {
  const charisma = new Map(
    candidate.characters.map((c) => [c.characterId, c.charisma]),
  );
  return candidate.roster.people.flatMap((person) => {
    const before = latest.roster.people.find(
      (p) => p.characterId === person.characterId,
    );
    const score = charisma.get(person.characterId);
    if (!before || score === undefined) return [];
    const limit = (roster: CanonicalRoster, subject: typeof person) =>
      getTeamManagerLimit({
        officers: roster.officers,
        person: subject,
        charisma: score,
      });
    const was = limit(latest.roster, before);
    const now = limit(candidate.roster, person);
    const managed = countManagedTeams(
      candidate.roster.teams,
      person.characterId,
    );
    if (now >= was || managed <= now) return [];
    return [
      `Removing ${nameOf(names, person.characterId)}'s last officer role lowers their team limit to ${now}; they manage ${managed} teams.`,
    ];
  });
}

/**
 * The PCs this correction newly gives a role: in play that is normally a
 * Change Officer Role action in Activity. "Assigning Aria Vell as
 * Spymaster is normally a Change Officer Role action."
 */
export function pcAssignmentHints(
  latest: Snapshot,
  candidate: Snapshot,
  names: ReadonlyMap<string, string>,
): string[] {
  const kinds = new Map(
    candidate.roster.people.map((p) => [p.characterId, p.kind]),
  );
  return BOARD_ROLES.flatMap((role) =>
    candidate.roster.officers
      .filter(
        (officer) =>
          officer.role === role &&
          (kinds.get(officer.characterId) ?? 'pc') === 'pc' &&
          !latest.roster.officers.some((old) =>
            holds(old, role, officer.characterId),
          ),
      )
      .map(
        (officer) =>
          `Assigning ${nameOf(names, officer.characterId)} as ${ROLE_LABELS[role]} is normally a Change Officer Role action.`,
      ),
  );
}

/** A roster person offered by Assign, with what they would bring. */
export type AssignCandidate = {
  characterId: string;
  name: string;
  kind: 'pc' | 'npc';
  archived: boolean;
  /** Roles they already hold, in board order. */
  holds: OfficerRole[];
  /**
   * Their value and the role's effect with them compared with now:
   * "Dex +3 → Secrecy +3 (currently no Secrecy bonus)", or "Str +2: no
   * change from Security +4".
   */
  detail: string;
};

// A role's effect as a phrase, without the "Vacant:" lead of the board.
function plainEffect(card: RoleCard) {
  const effect = card.vacant
    ? card.effect.replace(/^Vacant: /, '')
    : card.effect;
  return effect.startsWith('No ') ? `no ${effect.slice(3)}` : effect;
}

// "Str +4", or "Str unresolved" when the sheet cannot calculate an ability
// the check compares: a partial score is never previewed.
function checkContribution(
  character: FoundationCharacter,
  check: OrganizationCheck,
) {
  const missing = unresolvedOfficerAbilities(character, check);
  if (missing.length)
    return `${missing.map((ability) => ABILITY_LABELS[ability]).join(' and ')} unresolved`;
  const source = officerAbilitySource(character, check);
  return `${ABILITY_LABELS[source.ability]} ${signed(source.modifier)}`;
}

/**
 * The roster people Assign offers for a role: everyone on the roster not
 * holding it, PCs then NPCs by name, each with the effect they would bring
 * compared with the current effect. Effects come from the officer board's
 * shared rules, never from separate arithmetic.
 */
export function assignCandidates({
  role,
  roster,
  characters,
  names,
  focus,
}: {
  role: OfficerRole;
  roster: CanonicalRoster;
  characters: FoundationCharacter[];
  names: ReadonlyMap<string, string>;
  focus: Focus | null;
}): AssignCandidate[] {
  // Safe cast: `officerBoard` returns a card for every role in BOARD_ROLES,
  // which lists all six officer roles.
  const card = (value: CanonicalRoster) =>
    officerBoard({
      roster: value,
      characters,
      names,
      focus,
      pending: [],
    }).find((entry) => entry.role === role)!;
  const now = card(roster);
  const facts = new Map(characters.map((c) => [c.characterId, c]));
  const check =
    // Safe cast: role is a key of ROLE_CHECKS (checked by in).
    role in ROLE_CHECKS ? ROLE_CHECKS[role as keyof typeof ROLE_CHECKS] : null;
  return roster.people
    .filter(
      ({ characterId }) =>
        !roster.officers.some((officer) => holds(officer, role, characterId)),
    )
    .flatMap((person) => {
      const character = facts.get(person.characterId);
      if (!character) return [];
      const withThem = card({
        ...roster,
        officers: assignOfficer(roster.officers, role, person.characterId),
      });
      const holder = withThem.holders.find(
        (entry) => entry.characterId === person.characterId,
      );
      const own = check
        ? checkContribution(character, check)
        : (holder?.contribution ?? holder?.nonStacking ?? '');
      const detail =
        withThem.effect !== now.effect
          ? `${own} → ${withThem.effect} (currently ${plainEffect(now)})`
          : // A redundant holder is told whose value applies instead.
            holder && !holder.counts && holder.nonStacking && !check
            ? holder.nonStacking
            : `${own}: no change from ${plainEffect(now)}`;
      return [
        {
          characterId: person.characterId,
          name: nameOf(names, person.characterId),
          kind: person.kind,
          archived: !character.isActive,
          holds: heldRoles(roster.officers, person.characterId),
          detail,
        },
      ];
    })
    .sort(
      (left, right) =>
        (left.kind === 'pc' ? 0 : 1) - (right.kind === 'pc' ? 0 : 1) ||
        left.name.localeCompare(right.name, undefined, {
          sensitivity: 'base',
        }) ||
        left.characterId.localeCompare(right.characterId),
    );
}
