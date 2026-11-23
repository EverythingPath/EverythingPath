import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { missionCodeMessage } from './activity-mission-messages';
import { ruleMessage } from './summary-messages';
export function activityWarning(
  warning: string,
  choiceId: string,
  actionId?: StagedActionChoice['actionId'],
): string {
  const code = warning.slice(choiceId.length + 1);
  const mission = missionCodeMessage(code, actionId, true);
  if (mission) return mission;
  if (code.endsWith('roll-range'))
    return 'The roll is outside its usual range. The recorded value is retained for the table.';
  if (code === 'calculated-cost')
    return 'The entered cost differs from the rules calculation. The preview uses the calculated cost; changing this field does not adjust the treasury outcome.';
  const reasons: Record<string, string> = {
    'action-capacity':
      'Move this choice to an available slot, clear it, or restore the action allowance before confirming the week.',
    'team-capacity':
      'Recruitment leaves the roster above the team allowance after this week’s actions.',
    'team-action': 'This team does not normally perform this action.',
    'team-unavailable': 'This team is unavailable for this Activity.',
    'team-used': 'This team has already acted this Activity.',
    'action-blocked': 'An event prevents this action during this Activity.',
    'lie-low-exclusivity': 'Lie Low normally uses the entire Activity.',
    'drill-limit': 'Drill Militia is normally available once per Activity.',
    treasury: 'The militia does not have enough funds for the calculated cost.',
  };
  // Safe cast: String.split returns at least one element, even for ''.
  return (
    reasons[code] ??
    ruleMessage(code, true) ??
    `Review this choice with the table: ${code.split(':')[0]!.replaceAll('-', ' ').replaceAll('_', ' ')}.`
  );
}
