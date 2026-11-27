import { OFFICER_ROLES } from '~/lib/canonical-roster';
import teamTable from '~/lib/militia-team-table';
import { isNaturalOneCheck, teamRecruitmentCheck } from '~/lib/rules-activity';
import {
  isPartyRestoration,
  restorationCostCopper,
} from '~/lib/rules-character-actions';
import { activityRollSpec } from '~/lib/rules-roll-spec';
import { getTeamCost, isUpgradePathAllowed } from '~/lib/rules-teams';
import type { OrganizationCheck } from '~/lib/rules-officers';
import type { RollSpec } from '~/lib/raw-roll';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { gp } from '~/components/week-review/review-text';
import { activityLabel } from './activity-labels';
import type { ActivityTeamFact, ActivityView, OfficerRole } from './types';

// Presentation facts for the people and team actions' detail editors. Every
// option list comes from the view's rule-derived facts and the rules
// helpers; groups guide the table and never filter. A recorded reference
// that no longer matches an option stays listed as a missing option.

type Slot = ActivityView['slots'][number];
type Choice<Id extends StagedActionChoice['actionId']> = Extract<
  StagedActionChoice,
  { actionId: Id }
>;
export const PEOPLE_TEAM_ACTIONS = [
  'change_officer_role',
  'recruit_team',
  'upgrade_team',
  'dismiss_team',
  'rescue_character',
  'restore_character',
  'drill_militia',
  'earn_gold',
  'lie_low',
] as const satisfies readonly StagedActionChoice['actionId'][];
export type PeopleTeamActionId = (typeof PEOPLE_TEAM_ACTIONS)[number];
export function isPeopleTeamChoice(
  choice: StagedActionChoice,
): choice is Choice<PeopleTeamActionId> {
  const actions: readonly string[] = PEOPLE_TEAM_ACTIONS;
  return actions.includes(choice.actionId);
}

export type DetailOption = {
  value: string;
  label: string;
  description: string | null;
  // Listed first. Other options stay selectable with the rules' warning.
  eligible: boolean;
  // The recorded reference no longer matches anything this Activity knows.
  missing: boolean;
};
export type DetailRollField = 'notoriety' | 'training' | 'delivery';
export type DetailRoll = {
  field: DetailRollField;
  label: string;
  spec: RollSpec;
  // When the rules use this roll.
  when: string;
  // For a roll shown only while the entered check meets its condition, what
  // the check reads now ("The check is a natural 1"); null for a roll that
  // is always shown.
  shownBecause: string | null;
  required: boolean;
};
export type DetailConsumables = {
  selected: { value: string; label: string; missing: boolean }[];
  available: { value: string; label: string }[];
};
export type DetailCommon = {
  rolls: DetailRoll[];
  // Null when the action has no check and nothing is recorded.
  consumables: DetailConsumables | null;
};
export type RecruitmentRule = { check: OrganizationCheck; dc: number };
export type RecruitmentCheckState =
  // The chosen team type has recruitment rules and nothing else is recorded.
  | ({ kind: 'rules' } & RecruitmentRule)
  // The type has no recruitment rules (or is not chosen yet while a table
  // check is recorded): the table chooses the check and DC.
  | { kind: 'table' }
  // A recorded table check the type's own rules replace; kept until cleared.
  | { kind: 'retained'; rules: RecruitmentRule }
  | { kind: 'none' };
type Specific =
  | {
      actionId: 'change_officer_role';
      characters: DetailOption[];
      // The selected character's roles at this slot's position.
      heldRoles: OfficerRole[] | null;
      fromRoles: DetailOption[];
      toRoles: DetailOption[];
    }
  | {
      actionId: 'recruit_team';
      teamTypes: DetailOption[];
      recruitment: RecruitmentCheckState;
    }
  | {
      actionId: 'upgrade_team';
      targets: DetailOption[];
      destinations: DetailOption[];
    }
  | { actionId: 'dismiss_team'; targets: DetailOption[] }
  | {
      actionId: 'rescue_character';
      characters: DetailOption[];
      destinations: DetailOption[];
      // The level the rules use for the selected character.
      ruleLevel: number | null;
    }
  | {
      actionId: 'restore_character';
      modes: DetailOption[];
      // Null until a mode is chosen.
      scope: 'party' | 'individual' | null;
      characters: DetailOption[];
      ruleLevel: number | null;
    }
  | { actionId: 'drill_militia' | 'earn_gold' | 'lie_low' };
export type ActionDetail = DetailCommon & Specific;

export function option(
  value: string,
  label: string,
  description: string | null,
  eligible = true,
): DetailOption {
  return { value, label, description, eligible, missing: false };
}
export function withMissing(
  options: DetailOption[],
  recorded: string | undefined,
  label: string,
  description = 'No longer on the roster',
): DetailOption[] {
  if (!recorded || options.some((entry) => entry.value === recorded))
    return options;
  return [
    { value: recorded, label, description, eligible: false, missing: true },
    ...options,
  ];
}
// Eligible options first, keeping each group's order.
export function ordered(options: DetailOption[]) {
  return [
    ...options.filter((entry) => entry.eligible),
    ...options.filter((entry) => !entry.eligible),
  ];
}
function typeFacts(teamType: string | null | undefined) {
  return teamTable.find((entry) => entry.id === teamType);
}
function roleList(roles: string[]) {
  return roles.length ? roles.map(activityLabel).join(', ') : 'No officer role';
}

function heldRoles(slot: Slot, characterId: string | undefined) {
  if (!characterId || !slot.position) return null;
  return slot.position.officers
    .filter((officer) => officer.characterId === characterId)
    .map((officer) => officer.role);
}
function status(slot: Slot, characterId: string) {
  return (
    slot.position?.characterStatus.find(
      (entry) => entry.characterId === characterId,
    )?.status ?? null
  );
}
function level(view: ActivityView, characterId: string | undefined) {
  return (
    view.characters.find((entry) => entry.characterId === characterId)?.level ??
    null
  );
}
function characterOptions(
  view: ActivityView,
  recorded: string | undefined,
  describe: (characterId: string, level: number | null) => string | null,
  eligible: (characterId: string) => boolean = () => true,
) {
  return withMissing(
    ordered(
      view.characters.map((character) =>
        option(
          character.characterId,
          character.name,
          describe(character.characterId, character.level),
          eligible(character.characterId),
        ),
      ),
    ),
    recorded,
    'Missing character',
  );
}
function levelText(value: number | null) {
  return value === null ? 'Level unknown' : `Level ${value}`;
}

// Where a team already acts, is upgraded or is dismissed this Activity,
// other than in `slot` (the same use the team dropdown reports).
function teamUse(view: ActivityView, teamId: string, slot: Slot) {
  return view.slots.find(
    (entry) =>
      entry.slotId !== slot.slotId &&
      entry.choice &&
      (entry.choice.teamId === teamId ||
        ('targetTeamId' in entry.choice &&
          entry.choice.targetTeamId === teamId)),
  );
}
function exists(team: ActivityTeamFact, slot: Slot) {
  return team.recruitedInSlot === null || team.recruitedInSlot < slot.number;
}
function teamState(view: ActivityView, team: ActivityTeamFact, slot: Slot) {
  if (team.recruitedInSlot !== null)
    return team.recruitedInSlot < slot.number
      ? `Recruited in Action Slot ${team.recruitedInSlot}`
      : `Recruited later, in Action Slot ${team.recruitedInSlot}`;
  if (team.condition !== 'active') return activityLabel(team.condition);
  if (team.unavailable) return 'Unavailable this Activity';
  const use = teamUse(view, team.teamId, slot);
  return use ? `Acts in Action Slot ${use.number}` : 'Free';
}
function targetOptions(
  view: ActivityView,
  slot: Slot,
  recorded: string | undefined,
  eligible: (team: ActivityTeamFact) => boolean,
) {
  return withMissing(
    ordered(
      view.teamRoster
        .filter((team) => team.recruitedInSlot !== slot.number)
        .map((team) =>
          option(
            team.teamId,
            team.name,
            [
              [team.typeName, team.tier].filter(Boolean).join(' '),
              teamState(view, team, slot),
            ]
              .filter(Boolean)
              .join(' · '),
            eligible(team),
          ),
        ),
    ),
    recorded,
    'Missing team',
  );
}

const rollWhen: Partial<
  Record<PeopleTeamActionId, Partial<Record<DetailRollField, string>>>
> = {
  dismiss_team: {
    notoriety: 'Rolled if the check fails: Notoriety rises by the roll.',
  },
  drill_militia: {
    notoriety: 'Rolled on a natural 1: Notoriety rises by the roll.',
    training:
      'Rolled if the check succeeds: Training rises by the roll plus any Commandant bonus, multiplied by any queued training effect.',
  },
  earn_gold: {
    notoriety: 'Rolled on a natural 1: Notoriety rises by the roll.',
  },
  recruit_team: {
    notoriety: 'Rolled on a natural 1: Notoriety rises by the roll.',
  },
};
type RollCondition = 'natural-one' | 'check-fails' | 'check-succeeds';
// Rolls the rules use only for one reading of the check, for every action
// and mission. Each is shown only while the entered check meets that reading
// as the rules decide it, and hidden while the check is missing or undecided.
// A hidden roll is never required, and a value entered earlier stays stored
// but unused until the check meets the condition again.
const rollConditions: Partial<
  Record<
    StagedActionChoice['actionId'],
    Partial<Record<DetailRollField, RollCondition>>
  >
> = {
  activate_black_market: { notoriety: 'check-fails' },
  dismiss_team: { notoriety: 'check-fails' },
  drill_militia: { notoriety: 'natural-one', training: 'check-succeeds' },
  earn_gold: { notoriety: 'natural-one' },
  gather_information: { notoriety: 'natural-one' },
  recruit_team: { notoriety: 'natural-one' },
  reduce_danger: { notoriety: 'check-fails' },
};
// What the entered check reads when it meets the condition, else null.
function conditionMet(
  condition: RollCondition,
  choice: StagedActionChoice,
  slot: Slot,
) {
  switch (condition) {
    case 'natural-one':
      return isNaturalOneCheck(choice) ? 'The check is a natural 1' : null;
    case 'check-fails':
      return slot.check?.succeeded === false ? 'The check fails' : null;
    case 'check-succeeds':
      return slot.check?.succeeded === true ? 'The check succeeds' : null;
  }
}
// The action's dice rolls other than its check, with when the rules use them.
export function detailRolls(
  choice: StagedActionChoice,
  slot: Slot,
  when: Partial<Record<DetailRollField, string>> = {},
) {
  const conditions = rollConditions[choice.actionId] ?? {};
  return (['training', 'notoriety', 'delivery'] as const).flatMap<DetailRoll>(
    (field) => {
      const spec = activityRollSpec(choice.actionId, field);
      if (!spec) return [];
      const condition = conditions[field];
      const shownBecause = condition
        ? conditionMet(condition, choice, slot)
        : null;
      if (condition && !shownBecause) return [];
      return [
        {
          field,
          label: activityLabel(field),
          spec,
          when: when[field] ?? '',
          shownBecause,
          required: slot.requirements.includes(
            `${choice.choiceId}:${field}:${spec.count}d${spec.sides}`,
          ),
        },
      ];
    },
  );
}
export function consumables(
  choice: StagedActionChoice,
  slot: Slot,
  view: ActivityView,
): DetailConsumables | null {
  const recorded = choice.consumableIds ?? [];
  if (!slot.check && recorded.length === 0) return null;
  return {
    selected: recorded.map((value) => {
      const known = view.bonuses.find((bonus) => bonus.value === value);
      return {
        value,
        label: known?.label ?? 'Missing bonus',
        missing: !known,
      };
    }),
    available: view.bonuses.filter((bonus) => !recorded.includes(bonus.value)),
  };
}

function recruitmentState(
  choice: Choice<'recruit_team'>,
): RecruitmentCheckState {
  if (!choice.teamType)
    return choice.recruitmentCheck ? { kind: 'table' } : { kind: 'none' };
  const rules = teamRecruitmentCheck(choice.teamType);
  if (!rules) return { kind: 'table' };
  return choice.recruitmentCheck
    ? { kind: 'retained', rules }
    : { kind: 'rules', ...rules };
}

// Rescue's destination as one option value: headquarters or a refuge.
export function destinationValue(choice: Choice<'rescue_character'>) {
  const destination = choice.destination;
  if (!destination) return null;
  return destination.kind === 'headquarters'
    ? 'headquarters'
    : `refuge:${destination.settlementId}`;
}
export function destinationFromValue(
  value: string,
): NonNullable<Choice<'rescue_character'>['destination']> {
  return value.startsWith('refuge:')
    ? { kind: 'refuge', settlementId: value.slice('refuge:'.length) }
    : { kind: 'headquarters' };
}

const RESTORE_MODES = [
  'ability_damage',
  'hit_points',
  'restorative_effect',
  'break_enchantment',
  'raise_dead',
  'restoration',
  'stone_to_flesh',
] as const satisfies readonly NonNullable<
  Choice<'restore_character'>['mode']
>[];

type Build<Id extends PeopleTeamActionId> = (
  choice: Choice<Id>,
  slot: Slot,
  view: ActivityView,
) => Extract<Specific, { actionId: Id }>;

const officerRoleDetail: Build<'change_officer_role'> = (
  choice,
  slot,
  view,
) => {
  const held = heldRoles(slot, choice.characterId);
  // Roles kept after leaving the From role: any would make a second role.
  const kept = held?.filter((role) => role !== choice.fromRole) ?? [];
  const roles = (
    eligible: (role: OfficerRole) => boolean,
    describe: (role: OfficerRole) => string | null,
  ) =>
    ordered(
      OFFICER_ROLES.map((role) =>
        option(role, activityLabel(role), describe(role), eligible(role)),
      ),
    );
  return {
    actionId: choice.actionId,
    characters: characterOptions(view, choice.characterId, (id) =>
      slot.position ? roleList(heldRoles(slot, id) ?? []) : null,
    ),
    heldRoles: held,
    // Without a character every role stays in one list.
    fromRoles: roles(
      (role) => held === null || held.includes(role),
      (role) => (held?.includes(role) ? 'Held now' : null),
    ),
    toRoles: roles(
      (role) => kept.length === 0 && !held?.includes(role),
      (role) =>
        kept.includes(role)
          ? 'Already held'
          : kept.length > 0
            ? 'A second role'
            : null,
    ),
  };
};

const recruitDetail: Build<'recruit_team'> = (choice) => ({
  actionId: choice.actionId,
  teamTypes: ordered(
    teamTable.map((entry) => {
      const rules = teamRecruitmentCheck(entry.id);
      return option(
        entry.id,
        entry.name,
        `Tier ${entry.tier} · ${
          rules
            ? `${activityLabel(rules.check)} DC ${rules.dc}`
            : 'No recruitment rules'
        }`,
        rules !== null,
      );
    }),
  ),
  recruitment: recruitmentState(choice),
});

const upgradeDetail: Build<'upgrade_team'> = (choice, slot, view) => {
  const from = view.teamRoster.find(
    (team) => team.teamId === choice.targetTeamId,
  )?.teamType;
  return {
    actionId: choice.actionId,
    targets: targetOptions(
      view,
      slot,
      choice.targetTeamId,
      (team) =>
        exists(team, slot) &&
        team.condition === 'active' &&
        !team.unavailable &&
        !teamUse(view, team.teamId, slot) &&
        Boolean(typeFacts(team.teamType)?.upgrade?.to.length),
    ),
    // Every type stays listed, including the target's own, so a recorded
    // destination never disappears.
    destinations: ordered(
      teamTable.map((entry) =>
        option(
          entry.id,
          entry.name,
          `Tier ${entry.tier} · ${gp(getTeamCost(entry.id) * 100)}`,
          from ? isUpgradePathAllowed(from, entry.id) : false,
        ),
      ),
    ),
  };
};

const dismissDetail: Build<'dismiss_team'> = (choice, slot, view) => ({
  actionId: choice.actionId,
  targets: targetOptions(view, slot, choice.targetTeamId, (team) =>
    exists(team, slot),
  ),
});

// A character's level and, when tracked, condition at this slot.
function characterNote(slot: Slot) {
  return (characterId: string, value: number | null) => {
    const condition = status(slot, characterId);
    return [levelText(value), condition ? activityLabel(condition) : null]
      .filter(Boolean)
      .join(' · ');
  };
}

const rescueDetail: Build<'rescue_character'> = (choice, slot, view) => {
  const refuges = slot.position?.refugeSettlementIds ?? [];
  const recorded =
    choice.destination?.kind === 'refuge'
      ? `refuge:${choice.destination.settlementId}`
      : undefined;
  const settlements = view.settlements.map((settlement) => {
    const active = refuges.includes(settlement.value);
    return option(
      `refuge:${settlement.value}`,
      `Refuge in ${settlement.label}`,
      active ? 'Active refuge' : 'No active refuge this week',
      active,
    );
  });
  return {
    actionId: choice.actionId,
    characters: characterOptions(
      view,
      choice.characterId,
      characterNote(slot),
      (id) => status(slot, id) === 'captured',
    ),
    destinations: withMissing(
      [option('headquarters', 'Headquarters', null), ...ordered(settlements)],
      recorded,
      'Refuge in a missing settlement',
      'No longer one of the campaign’s settlements',
    ),
    ruleLevel: level(view, choice.characterId),
  };
};

const restoreDetail: Build<'restore_character'> = (choice, slot, view) => ({
  actionId: choice.actionId,
  modes: RESTORE_MODES.map((mode) =>
    option(
      mode,
      activityLabel(mode),
      isPartyRestoration(mode)
        ? 'Every player character'
        : `One character · scroll ${gp(restorationCostCopper(mode))}`,
    ),
  ),
  scope: choice.mode
    ? isPartyRestoration(choice.mode)
      ? 'party'
      : 'individual'
    : null,
  characters: characterOptions(
    view,
    choice.characterId,
    characterNote(slot),
    (id) => status(slot, id) !== 'captured',
  ),
  ruleLevel: level(view, choice.characterId),
});

function specific(
  choice: Choice<PeopleTeamActionId>,
  slot: Slot,
  view: ActivityView,
): Specific {
  switch (choice.actionId) {
    case 'change_officer_role':
      return officerRoleDetail(choice, slot, view);
    case 'recruit_team':
      return recruitDetail(choice, slot, view);
    case 'upgrade_team':
      return upgradeDetail(choice, slot, view);
    case 'dismiss_team':
      return dismissDetail(choice, slot, view);
    case 'rescue_character':
      return rescueDetail(choice, slot, view);
    case 'restore_character':
      return restoreDetail(choice, slot, view);
    case 'drill_militia':
    case 'earn_gold':
    case 'lie_low':
      return { actionId: choice.actionId };
  }
}

// The detail facts for a people or team action, or null for other actions,
// which keep the general choice editor.
export function actionDetail(
  view: ActivityView,
  slot: Slot,
): ActionDetail | null {
  const choice = slot.choice;
  if (!choice || !isPeopleTeamChoice(choice)) return null;
  return {
    ...specific(choice, slot, view),
    rolls: detailRolls(choice, slot, rollWhen[choice.actionId]),
    consumables: consumables(choice, slot, view),
  };
}
