import type { PhaseView } from './types';
import { eventRequirement, eventWarning } from './event-messages';
import { phaseLabels } from './week-frame/labels';
import {
  economyCodeMessage,
  economyMessages,
} from './activity-economy-messages';
import { missionCodeMessage } from './activity-mission-messages';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { abilityKeys, abilityLabels } from '~/lib/character-sheet-abilities';
type Summary = Pick<
  Extract<PhaseView, { phase: 'summary' }>,
  'adjustments' | 'options' | 'eventMessages'
>;
// A departed Character flags the staged choice until it is resubmitted (#316).
export const reviewRequirementMessage =
  'A character left the campaign. Review this choice before continuing.';

// A value the week's rules read that a companion's sheet can't calculate.
const unresolvedAbilityMessages = Object.fromEntries(
  abilityKeys.map((ability) => [
    `unresolved-${ability}`,
    `${abilityLabels[ability]} can’t be calculated from this character’s sheet yet. Supply it on the sheet before confirming the week.`,
  ]),
);

const messages: Record<string, string> = {
  ...economyMessages,
  ...unresolvedAbilityMessages,
  'unresolved-hit-dice':
    'Hit Dice can’t be calculated from this character’s sheet yet. Supply them on the sheet, or enter a roster Hit Dice override, before confirming the week.',
  'upkeep:attrition:roll': 'Enter the attrition Loyalty roll.',
  'upkeep:attrition-training:roll': 'Enter the attrition training roll.',
  'upkeep:notoriety-training:roll': 'Enter the Notoriety training loss roll.',
  'upkeep:notoriety:roll': 'Enter the Notoriety Loyalty roll.',
  'upkeep:shortage:roll': 'Enter the treasury-shortage training roll.',
  'upkeep:notoriety:nearest-settlement':
    'Choose the nearest settlement for Notoriety consequences.',
  'upkeep:notoriety:settlement-reputation':
    'Enter the nearest settlement’s reputation.',
  'rank:boon-acknowledgement': 'Record the earned rank boon.',
  'rank:pc-cap': 'The militia rank exceeds the highest player-character level.',
  'return:roll': 'Enter the missing team’s return roll.',
  'recovery-decision':
    'Choose whether to recover this disabled team or leave it disabled.',
  'recovery-funds': 'Recovery costs exceed the available treasury.',
  'recovery-cost-baseline':
    'The entered recovery cost differs from the calculated cost.',
  'persistent-ending': 'Ending this event requires a reasoned Rules Exception.',
  'ending-acknowledgement': 'Record how this event ended at the table.',
  teams: 'This Rivalry needs its two distinct rival teams.',
  'buyoff-cooldown':
    'This buyoff falls within the militia’s four-week waiting period.',
  'officer-assignment':
    'Choose an assigned officer or record a reasoned Rules Exception.',
  'team-type': 'Choose the type of team to recruit.',
  'upgrade-type': 'Choose the upgraded team type.',
  'recruitment-check': 'Choose the recruitment check.',
  'target-team': 'Choose the target team.',
  'duplicate-team': 'Choose a new team that is not already on the roster.',
  'officer-role': 'Choose an officer role.',
  'from-role': 'Choose the officer role to leave.',
  'duplicate-role': 'This character already holds the selected officer role.',
  character: 'Choose an available character.',
  review: reviewRequirementMessage,
  'officer-pc': 'Officer roles normally go to player characters.',
  'officer-role-limit': 'This character would hold more than one officer role.',
  'manager-limit':
    'Leaving this role would leave the character managing more teams than their normal limit.',
  'recruit-tier':
    'This team type has no recruitment rules; it is normally reached by upgrading.',
  'team-upgrade-limit': 'This team has already been upgraded this Activity.',
  'upgrade-tree':
    'This team type does not normally upgrade into the chosen type.',
  destination: 'Choose where the rescued character goes.',
  'character-level':
    'The character’s level is unknown. Record it in the character ledger.',
  'character-state':
    'This character’s condition is not tracked yet. Record it before resolving this action.',
  capture: 'This character has no recorded capture.',
  'character-captured':
    'The character’s current condition does not normally permit this action.',
  'direct-rescue': 'This character can normally only be rescued in person.',
  'capture-week': 'This character was captured after this week.',
  'active-refuge': 'The chosen settlement has no active refuge this week.',
  'character-location':
    'The character is not at headquarters or an active refuge.',
  mode: 'Choose a mode.',
  effect: 'Name the restorative effect.',
  'effect-level': 'Enter the restorative effect’s spell level.',
  'restorative-level':
    'Restorative effects are normally limited to 3rd-level spells.',
  party: 'There are no player characters on the roster to restore.',
  'target-present':
    'Record whether the character is present for the restoration.',
  'maximum-rank':
    'The militia is already at its maximum rank for the highest player-character level.',
  'overseer-conflict':
    'Keep the same Overseer for every check belonging to this event.',
  'overseer-event': 'Choose the event the Overseer will support.',
  'highest-level-pc': 'Enter the highest player-character level.',
  'unresolved-action': 'Choose an available action.',
  'action-capacity':
    'Move this choice to an available slot, clear it, or restore the action allowance before confirming the week.',
  'team-capacity':
    'Recruitment leaves the roster above the team allowance after this week’s actions.',
  'team-action': 'This team does not normally perform this action.',
  'team-unavailable': 'This team is unavailable for this Activity.',
  'team-condition':
    'This team’s condition does not normally permit this action.',
  'team-action-limit': 'This team has reached its Activity action allowance.',
  'team-used': 'This team has already acted this Activity.',
  'action-blocked': 'An event prevents this action during this Activity.',
  'lie-low-exclusivity': 'Lie Low normally uses the entire Activity.',
  'drill-limit': 'Drill Militia is normally available once per Activity.',
  'calculated-cost':
    'The entered cost differs from the rules calculation. The preview uses the calculated cost; changing this field does not adjust the treasury outcome.',
  'duplicate-decision': 'Keep one decision for this persistent event.',
  'no-mitigation-rule':
    'This event has no standard temporary mitigation option.',
  'no-event': 'Choose an event for this reactive action.',
  'invalid-roll': 'Enter a whole-number check roll.',
  roll: 'Enter the required check roll.',
  treasury: 'The calculated cost exceeds the available treasury.',
  funds: 'This transfer exceeds the available treasury.',
};

// A rules code whose warning means something other than its requirement.
const warningMessages: Record<string, string> = {
  'character-level':
    'The entered level differs from the character’s recorded level; the rules use the recorded level.',
};

// The player-facing wording for a rules code, if there is one.
export function ruleMessage(key: string, warning = false) {
  return (warning ? warningMessages[key] : undefined) ?? messages[key] ?? null;
}

const adjustmentTargets: Record<string, string> = {
  team: 'team',
  settlement: 'settlement',
  event: 'event',
};

function adjustmentMessage(code: string, view: Summary) {
  const adjustment = view.adjustments.find((item) =>
    code.startsWith(`adjustment:${item.adjustmentId}:`),
  );
  if (adjustment)
    return code.endsWith('numeric-overflow')
      ? `Table Adjustment “${adjustment.reason}” exceeds the supported whole-number range.`
      : code.endsWith(`:${adjustment.reason}`)
        ? `Table Adjustment: ${adjustment.reason}`
        : `Table Adjustment “${adjustment.reason}”: choose an available ${adjustmentTargets[code.split(':').pop() ?? ''] ?? 'target'}.`;
  return null;
}

function messageOwner(code: string, view: Summary) {
  return (view.options.subjectId ?? [])
    .filter((item) => `:${code}:`.includes(`:${item.value}:`))
    .sort((a, b) => b.value.length - a.value.length)[0];
}

function requiredRoll(code: string) {
  const match = /^(.*):dice:(\d+d\d+)$/.exec(code);
  if (!match) return null;
  const prompt = messages[`${match[1]}:roll`];
  return prompt
    ? `${prompt.slice(0, -1)} (${match[2]}).`
    : `Enter the required roll (${match[2]}).`;
}

// Persistent's single "earlier phases" item names those phases in order.
function earlierPhasesMessage(code: string) {
  const match = /^persistent:earlier-phases:(.+)$/.exec(code);
  if (!match) return null;
  // Safe cast: the regex's one capture group `(.+)` always participates
  // when exec succeeds.
  const phases = match[1]!;
  const names = phases.split('+').flatMap((phase) => {
    if (!(phase in phaseLabels)) return [];
    // Safe cast: the `in` check above proves phase is a key of phaseLabels.
    return [phaseLabels[phase as keyof typeof phaseLabels]];
  });
  return `Earlier phases still need preparation: ${names.join(', ')}.`;
}

// `actionId` names the Activity action that owns `code`, when it is known.
export function summaryMessage(
  code: string,
  view: Summary,
  warning = false,
  actionId?: StagedActionChoice['actionId'],
) {
  const event = view.eventMessages?.[code];
  if (event) return event;
  const earlier = earlierPhasesMessage(code);
  if (earlier) return earlier;
  const adjustment = adjustmentMessage(code, view);
  if (adjustment) return adjustment;
  const owner = messageOwner(code, view);
  const prefix = owner
    ? `${owner.label}: `
    : code.startsWith('upkeep:')
      ? 'Upkeep: '
      : code.startsWith('event:')
        ? 'Event: '
        : '';
  const tail = owner
    ? code.slice(code.indexOf(owner.value) + owner.value.length + 1)
    : code;
  const mission = missionCodeMessage(tail, actionId, warning);
  if (mission) return prefix + mission;
  const key = tail.replace(/:exception$/, '');
  // A rank boon names its rank; the owner prefix names the PC.
  const boonRank = /^upkeep:boon:(\d+):.+:acknowledgement$/.exec(code)?.[1];
  if (boonRank) return `${prefix}Record the rank ${boonRank} boon.`;
  if (/reference|Unknown|revision/.test(code))
    return `${prefix}A selected character, team, settlement or asset is no longer available. Review the affected choice.`;
  const known =
    ruleMessage(key, warning) ??
    (warning ? null : economyCodeMessage(key, actionId));
  if (known)
    return (
      prefix +
      known +
      (!warning && code.endsWith(':exception')
        ? ' Record a reasoned Rules Exception or revise the choice.'
        : '')
    );
  const roll = requiredRoll(tail);
  if (roll) return prefix + roll;
  if (warning)
    return (
      prefix +
      (/roll-range|calculated-event|event-eligibility|alchemical-reward/.test(
        code,
      )
        ? eventWarning(code)
        : 'Review this rules departure in the affected phase with the table.')
    );
  const translated = eventRequirement(code);
  if (!translated.startsWith('An earlier')) return prefix + translated;
  return `${prefix}Complete the highlighted decision in the affected phase before confirming.`;
}

// The same message for one subject's own code, without the owner prefix that
// the phase-wide lists add (for example inside that Action Slot's details).
export function subjectMessage(
  code: string,
  subjectId: string,
  warning = false,
  actionId?: StagedActionChoice['actionId'],
) {
  return summaryMessage(
    code,
    {
      adjustments: [],
      options: { subjectId: [{ value: subjectId, label: '' }] },
    },
    warning,
    actionId,
  ).replace(/^: /, '');
}
