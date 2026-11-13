import type { Id } from '@convex/_generated/dataModel';
import {
  getEffectiveHitDice,
  rosterWarningDescriptors,
  type CanonicalRoster,
} from './canonical-roster';
import type { CharacterKind } from './character-kind';
import { abilityLabels, type Ability } from './character-sheet-abilities';
import {
  officerAbilitySource,
  projectOfficers,
  unresolvedOfficerAbilities,
  type FoundationCharacter,
  type OfficerAbility,
  type OrganizationCheck,
} from './rules-officers';
import { countManagedTeams, getTeamManagerLimit } from './team-manager-rules';
import type { StagedActionChoice } from './weekly-draft-facts';

// What the Characters & officers page shows about the six officer roles and
// the character records. Every number comes from the shared rules
// (`rules-officers`, `canonical-roster`, `team-manager-rules`) applied to the
// accepted roster; pending weekly changes are listed, never applied.

export type OfficerRole = CanonicalRoster['officers'][number]['role'];
type Focus = 'Loyalty' | 'Security' | 'Secrecy';

/** The six roles in board order: three check roles, then the others. */
export const BOARD_ROLES = [
  'marshal',
  'ambassador',
  'spymaster',
  'strategist',
  'commandant',
  'overseer',
] as const satisfies readonly OfficerRole[];

export const ROLE_LABELS: Record<OfficerRole, string> = {
  ambassador: 'Ambassador',
  commandant: 'Commandant',
  marshal: 'Marshal',
  overseer: 'Overseer',
  spymaster: 'Spymaster',
  strategist: 'Strategist',
};

const ROLE_RULES: Record<OfficerRole, string> = {
  marshal: 'Security bonus from Str or Wis',
  ambassador: 'Loyalty bonus from Con or Cha',
  spymaster: 'Secrecy bonus from Dex or Int',
  strategist: '+1 militia action; that action gets +2',
  commandant: 'Hit Dice as training on a successful Drill',
  overseer: '+1 to both secondary checks; adds to one chosen event',
};

const CHECK_LABELS: Record<OrganizationCheck, Focus> = {
  loyalty: 'Loyalty',
  security: 'Security',
  secrecy: 'Secrecy',
};
export const ABILITY_LABELS: Record<OfficerAbility, string> = {
  strength: 'Str',
  dexterity: 'Dex',
  constitution: 'Con',
  intelligence: 'Int',
  wisdom: 'Wis',
  charisma: 'Cha',
};
export const MISSING_NAME = 'Missing character';

/** "+3" or "−1", as the board shows modifiers. */
export function signed(value: number) {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

/** The organization check each check role adds to. */
export const ROLE_CHECKS = {
  marshal: 'security',
  ambassador: 'loyalty',
  spymaster: 'secrecy',
} as const satisfies Partial<Record<OfficerRole, OrganizationCheck>>;

/** The roles a person holds, in board order. */
export function heldRoles(
  officers: readonly CanonicalRoster['officers'][number][],
  characterId: string,
): OfficerRole[] {
  return BOARD_ROLES.filter((role) =>
    officers.some(
      (officer) => officer.role === role && officer.characterId === characterId,
    ),
  );
}

/** A Change Officer Role staged in the open week's Activity. */
export type PendingRoleChange = {
  key: string;
  /** The Activity slot, counted from 1. */
  slot: number;
  characterId: string;
  fromRole: OfficerRole | null;
  toRole: OfficerRole | null;
  /** "Kess: Strategist → Spymaster (Activity, slot 2)" */
  text: string;
};

export type RoleHolder = {
  characterId: string;
  name: string;
  archived: boolean;
  /** Whether this holder's bonus is the one the rules use. */
  counts: boolean;
  /**
   * "Security +4" or "5 HD" for a holder who counts, "Unresolved" for one
   * whose role ability the sheet cannot calculate yet; null when this holder
   * adds nothing.
   */
  contribution: string | null;
  /** "Doesn't stack with Grom" for a redundant holder. */
  nonStacking: string | null;
};

export type RoleCard = {
  role: OfficerRole;
  label: string;
  rule: string;
  vacant: boolean;
  holders: RoleHolder[];
  /** The role's current effect, or what its vacancy means. */
  effect: string;
  /** Whose value the effect comes from; null when nobody's does. */
  source: string | null;
  /** Advisory warnings about the holders, e.g. an archived one. */
  warnings: string[];
  pending: PendingRoleChange[];
};

/** The Change Officer Role actions staged in the open week, in slot order. */
export function pendingRoleChanges(
  slots: readonly { choice: StagedActionChoice | null }[],
  names: ReadonlyMap<string, string>,
): PendingRoleChange[] {
  return slots.flatMap(({ choice }, index) => {
    if (choice?.actionId !== 'change_officer_role' || !choice.characterId)
      return [];
    if (!choice.fromRole && !choice.toRole) return [];
    const role = (value: OfficerRole | undefined) =>
      value ? ROLE_LABELS[value] : 'no role';
    const name = names.get(choice.characterId) ?? MISSING_NAME;
    return [
      {
        key: choice.choiceId,
        slot: index + 1,
        characterId: choice.characterId,
        fromRole: choice.fromRole ?? null,
        toRole: choice.toRole ?? null,
        text: `${name}: ${role(choice.fromRole)} → ${role(choice.toRole)} (Activity, slot ${index + 1})`,
      },
    ];
  });
}

type Holder = {
  characterId: string;
  name: string;
  /** The holder's rules facts; absent when the record is missing. */
  facts?: FoundationCharacter;
};
type PresentHolder = Holder & { facts: FoundationCharacter };

// What a role's builder derives: the effect, whose value it is and how each
// holder contributes.
type RoleEffect = Pick<RoleCard, 'effect' | 'source' | 'holders'>;
type RoleContext = {
  holders: Holder[];
  present: PresentHolder[];
  officers: ReturnType<typeof projectOfficers>;
  /** A present holder's effective Hit Dice on the roster. */
  hitDice: (holder: PresentHolder) => number | null;
  /** The checks other than the focus: Overseer's secondary checks. */
  secondary: Focus[];
};

// A holder of a role: `counting` is the holder whose value the rules use
// (each commandant for the one stacking role); the others are told whose
// applies instead. A holder without a record adds nothing.
function holderView(
  holder: Holder,
  counting: Holder | undefined,
  contribution: string | null,
): RoleHolder {
  const counts = holder.facts !== undefined && holder === counting;
  return {
    characterId: holder.characterId,
    name: holder.name,
    archived: holder.facts?.isActive === false,
    counts,
    contribution: counts ? contribution : null,
    nonStacking:
      holder.facts && counting && !counts
        ? `Doesn't stack with ${counting.name}`
        : null,
  };
}

// A holder whose role ability is unresolved: shown as such, compared with
// no one, and told of no one else's value.
function unresolvedHolderView(holder: Holder): RoleHolder {
  return {
    ...holderView(holder, undefined, null),
    contribution: 'Unresolved',
    nonStacking: null,
  };
}

function checkRoleEffect(check: OrganizationCheck) {
  return ({ present, holders }: RoleContext): RoleEffect => {
    const label = CHECK_LABELS[check];
    // A holder whose role ability the sheet cannot calculate is unknown: it
    // is never compared, and its partial score never shows as a bonus.
    const unresolved = new Map(
      present.flatMap((holder) => {
        const missing = unresolvedOfficerAbilities(holder.facts, check);
        return missing.length ? [[holder.characterId, missing] as const] : [];
      }),
    );
    // The better allowed ability counts; the first assigned on a tie.
    let best: {
      holder: PresentHolder;
      ability: OfficerAbility;
      modifier: number;
    } | null = null;
    for (const holder of present) {
      if (unresolved.has(holder.characterId)) continue;
      const source = officerAbilitySource(holder.facts, check);
      if (!best || source.modifier > best.modifier)
        best = { holder, ...source };
    }
    const effect = best ? `${label} ${signed(best.modifier)}` : null;
    const missing = [...new Set([...unresolved.values()].flat())];
    return {
      // Like the commandant's Hit Dice: what the bonus still needs.
      effect:
        effect ??
        (missing.length
          ? `${label} bonus needs ${missing.map((ability) => abilityLabels[ability]).join(' and ')}`
          : `No ${label} bonus`),
      source: best
        ? `${best.holder.name}, ${ABILITY_LABELS[best.ability]}`
        : null,
      holders: holders.map((holder) =>
        unresolved.has(holder.characterId)
          ? unresolvedHolderView(holder)
          : holderView(holder, best?.holder, effect),
      ),
    };
  };
}

const ROLE_EFFECTS: Record<OfficerRole, (context: RoleContext) => RoleEffect> =
  {
    marshal: checkRoleEffect(ROLE_CHECKS.marshal),
    ambassador: checkRoleEffect(ROLE_CHECKS.ambassador),
    spymaster: checkRoleEffect(ROLE_CHECKS.spymaster),
    // Commandants stack: every distinct holder counts.
    commandant: ({ holders, present, officers, hitDice }) => ({
      effect: present.some((holder) => hitDice(holder) === null)
        ? 'Drill training bonus needs Hit Dice'
        : present.length
          ? `+${officers.commandantTrainingBonus} training on a successful Drill`
          : 'No Drill training bonus',
      source: present.length
        ? present
            .map(
              (holder) =>
                `${holder.name} ${hitDice(holder) ?? 'Unresolved'} HD`,
            )
            .join(' + ')
        : null,
      holders: holders.map((holder) => {
        const counted = present.find((x) => x === holder);
        return holderView(
          holder,
          counted,
          counted ? `${hitDice(counted) ?? 'Unresolved'} HD` : null,
        );
      }),
    }),
    strategist: ({ holders, present, officers }) => ({
      effect: officers.strategistAssigned
        ? ROLE_RULES.strategist
        : 'No extra action',
      source: present[0]?.name ?? null,
      holders: holders.map((holder) =>
        holderView(holder, present[0], '+1 action, +2 on it'),
      ),
    }),
    overseer: ({ holders, present, secondary }) => ({
      effect: !present.length
        ? 'No secondary-check bonus'
        : secondary.length
          ? `+1 to ${secondary.join(' and ')}; supports one chosen event's checks`
          : "Supports one chosen event's checks",
      source: present[0]?.name ?? null,
      holders: holders.map((holder) =>
        holderView(
          holder,
          present[0],
          secondary.length
            ? `+1 ${secondary.join(', ')}`
            : 'Supports one event',
        ),
      ),
    }),
  };

/** The six role cards for the accepted roster and the open week's changes. */
export function officerBoard({
  roster,
  characters,
  names,
  focus,
  pending,
  rulesetVersion,
}: {
  roster: CanonicalRoster;
  /** The rules facts of the campaign's characters. */
  characters: FoundationCharacter[];
  names: ReadonlyMap<string, string>;
  focus: Focus | null;
  pending: readonly PendingRoleChange[];
  rulesetVersion?: number;
}): RoleCard[] {
  const officers = projectOfficers(roster, characters, focus, rulesetVersion);
  const byId = new Map(characters.map((x) => [x.characterId, x]));
  const people = new Map(roster.people.map((x) => [x.characterId, x]));
  const hitDice = (holder: PresentHolder) => {
    const person = people.get(holder.characterId);
    return person
      ? getEffectiveHitDice(person, holder.facts, rulesetVersion)
      : 0;
  };
  const secondary = focus
    ? (['loyalty', 'secrecy', 'security'] as const)
        .map((check) => CHECK_LABELS[check])
        .filter((check) => check !== focus)
    : [];

  return BOARD_ROLES.map((role) => {
    const holders: Holder[] = roster.officers
      .filter((officer) => officer.role === role)
      .map(({ characterId }) => ({
        characterId,
        name: names.get(characterId) ?? MISSING_NAME,
        facts: byId.get(characterId),
      }));
    const present = holders.filter(
      (holder): holder is PresentHolder => holder.facts !== undefined,
    );
    const shown = ROLE_EFFECTS[role]({
      holders,
      present,
      officers,
      hitDice,
      secondary,
    });
    const vacant = holders.length === 0;
    return {
      role,
      label: ROLE_LABELS[role],
      rule: ROLE_RULES[role],
      vacant,
      ...shown,
      // "Vacant: no Secrecy bonus", so vacancy never rests on styling alone.
      effect: vacant
        ? `Vacant: ${shown.effect.charAt(0).toLowerCase()}${shown.effect.slice(1)}`
        : shown.effect,
      // Shown on the card even while Show archived hides the holder's row.
      warnings: present
        .filter((holder) => !holder.facts.isActive)
        .map((holder) => `${holder.name} is archived but still assigned.`),
      pending: pending.filter(
        (change) => change.fromRole === role || change.toRole === role,
      ),
    };
  });
}

/** The record fields a row needs. */
export type BoardRecord = {
  _id: Id<'character'>;
  name: string;
  kind: CharacterKind;
  level: number;
  charisma: number;
  isActive?: boolean;
  unresolvedAbilities?: Ability[];
};

export type CharacterRow = {
  characterId: Id<'character'>;
  name: string;
  kind: CharacterKind;
  archived: boolean;
  onRoster: boolean;
  /** The roster's override, zero included, or else the record's number. */
  hitDice: number | null;
  /** Held roles, in board order. */
  roles: OfficerRole[];
  /** Managed teams against the role-aware limit; null off the roster. */
  manages: { count: number; limit: number; teams: string[] } | null;
  /** This person's advisory roster warnings. */
  warnings: string[];
  /** Scores the Character's sheet cannot calculate yet. */
  unresolvedAbilities: Ability[];
};

/** Every character record, alphabetically, with its roster facts. */
export function characterRows({
  records,
  roster,
  characters,
  rulesetVersion,
}: {
  records: readonly BoardRecord[];
  /** The accepted roster; null before the militia is set up. */
  roster: CanonicalRoster | null;
  /** The rules facts of the campaign's characters. */
  characters: readonly FoundationCharacter[];
  rulesetVersion?: number;
}): CharacterRow[] {
  const facts = new Map(characters.map((x) => [x.characterId, x]));
  const warnings = roster
    ? rosterWarningDescriptors(
        roster,
        records.map((record) => ({
          characterId: record._id,
          name: record.name,
          charisma: facts.get(record._id)?.charisma ?? record.charisma,
          isActive:
            facts.get(record._id)?.isActive ?? record.isActive !== false,
        })),
        Number.POSITIVE_INFINITY,
      )
    : [];
  return [...records]
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name, undefined, {
          sensitivity: 'base',
        }) || left._id.localeCompare(right._id),
    )
    .map((record) => {
      const person = roster?.people.find((x) => x.characterId === record._id);
      const rules = facts.get(record._id) ?? record;
      return {
        characterId: record._id,
        name: record.name,
        kind: record.kind,
        archived: record.isActive === false,
        onRoster: person !== undefined,
        hitDice: person
          ? getEffectiveHitDice(person, rules, rulesetVersion)
          : record.level,
        roles: roster ? heldRoles(roster.officers, record._id) : [],
        manages:
          roster && person
            ? {
                count: countManagedTeams(roster.teams, record._id),
                limit: getTeamManagerLimit({
                  officers: roster.officers,
                  person,
                  charisma: rules.charisma,
                }),
                teams: roster.teams
                  .filter((team) => team.managerCharacterId === record._id)
                  .map((team) => team.name),
              }
            : null,
        warnings: warnings
          .filter((warning) => warning.characterId === record._id)
          .map((warning) => warning.message),
        unresolvedAbilities: rules.unresolvedAbilities ?? [],
      };
    });
}

function joined(values: string[]) {
  return values.length < 2
    ? (values[0] ?? '')
    : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

/**
 * "Manages 2 of 3 teams", "Manages 1 of 1 team", "Manages 2 of 1 teams" or
 * "Manages no teams".
 */
export function managesText(manages: NonNullable<CharacterRow['manages']>) {
  if (manages.count === 0) return 'Manages no teams';
  const noun = manages.limit === 1 && manages.count === 1 ? 'team' : 'teams';
  return `Manages ${manages.count} of ${manages.limit} ${noun}`;
}

/** What archiving this character keeps, or null when they hold nothing. */
export function archiveKeeps(row: CharacterRow): string | null {
  const kept = [
    ...(row.roles.length
      ? [joined(row.roles.map((role) => ROLE_LABELS[role]))]
      : []),
    ...(row.manages?.count ? [`manager of ${joined(row.manages.teams)}`] : []),
  ];
  return kept.length
    ? `Archiving keeps ${row.name} as ${kept.join(' and ')}.`
    : null;
}
