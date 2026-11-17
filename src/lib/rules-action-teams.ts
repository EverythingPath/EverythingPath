import { characterActionTeams } from './rules-character-actions';
import { economyActionTeams } from './rules-economy';
import { eventActionTeams } from './rules-event-actions';
import { settlementActionTeams } from './rules-settlement-actions';
import type { TEAM_IDS } from './militia-domain';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { StagedActionChoice } from './weekly-draft-facts';

type TeamType = (typeof TEAM_IDS)[number];
const actionTeams: Partial<
  Record<StagedActionChoice['actionId'], readonly TeamType[]>
> = {
  ...economyActionTeams,
  ...settlementActionTeams,
  ...characterActionTeams,
  ...eventActionTeams,
};

// The team types the resolvers accept for an action without a `team-action`
// Rules Exception, or null when the action is taken without a team. Special
// accepts an optional team of any type, so it needs none.
export function actionTeamTypes(
  actionId: StagedActionChoice['actionId'],
): readonly TeamType[] | null {
  const types = actionTeams[actionId];
  return types?.length ? types : null;
}

// A queued effect or a carried Rivalry keeps a team out of this Activity; the
// resolver then requires a `team-unavailable` Rules Exception.
export function isTeamUnavailableThisActivity(
  draft: WeeklyDraft,
  teamId: string,
) {
  return (
    draft.context.queuedEffects.some(
      (effect) =>
        effect.startsWeek <= draft.week &&
        draft.week <= effect.endsWeek &&
        effect.effect.kind === 'team_unavailable' &&
        effect.effect.teamId === teamId,
    ) ||
    draft.context.carriedEvents.some(
      (event) =>
        event.eventType === 'rivalry' &&
        event.targets.some(
          (target) => target.kind === 'team' && target.teamId === teamId,
        ),
    )
  );
}
