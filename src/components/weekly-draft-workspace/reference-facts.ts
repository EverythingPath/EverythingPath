import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import {
  getAdvancementForRank,
  getMinimumTreasuryForRank,
} from '~/lib/militia-progression-rules';
import { activityFoundations } from '~/lib/rules-activity';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { PhaseView, UpkeepView } from './types';
import { activityLabel } from './activity-labels';

export type ReferenceValues = {
  rank: number;
  training: number;
  treasuryCopper: number;
  minimumTreasuryCopper: number | null;
  notoriety: number;
  focus: WorkspaceSource['snapshot']['focus'];
  teams: {
    teamId: string;
    name: string;
    status: WorkspaceSource['snapshot']['roster']['teams'][number]['status'];
  }[];
};
type ReferenceEvent = {
  eventId: string;
  name: string;
  ageWeeks: number;
  targetNames: string[];
};
export type ReferenceFacts = {
  now: ReferenceValues;
  after: ReferenceValues | null;
  thisWeek: {
    actions: { used: number; allowance: number | null; provisional: boolean };
    eventChance: {
      percent: number;
      guaranteed: boolean;
      provisional: boolean;
    } | null;
  };
  officers: {
    characterId: string;
    name: string;
    roles: UpkeepView['officers'][number]['roles'];
  }[];
  carriedEvents: ReferenceEvent[];
  afterCarriedEvents: ReferenceEvent[] | null;
};

function values(snapshot: WorkspaceSource['snapshot']): ReferenceValues {
  return {
    rank: snapshot.rank,
    training: snapshot.training,
    treasuryCopper: snapshot.treasuryCopper,
    minimumTreasuryCopper: getAdvancementForRank(snapshot.rank)
      ? getMinimumTreasuryForRank(snapshot.rank) * 100
      : null,
    notoriety: snapshot.notoriety,
    focus: snapshot.focus,
    teams: snapshot.roster.teams.map(({ teamId, name, status }) => ({
      teamId,
      name,
      status,
    })),
  };
}

export function referenceFacts(
  source: WorkspaceSource,
  draft: WeeklyDraft,
  preview: CanonicalResolutionPreview,
  views: PhaseView[],
): ReferenceFacts {
  // Safe cast: both callers pass derivePhaseReadiness views, one per phase in
  // phaseOrder, which includes 'upkeep'.
  const upkeep = views.find((view) => view.phase === 'upkeep')!;
  // Safe cast: both callers pass derivePhaseReadiness views, one per phase in
  // phaseOrder, which includes 'activity'.
  const activity = views.find((view) => view.phase === 'activity')!;
  // Safe cast: both callers pass derivePhaseReadiness views, one per phase in
  // phaseOrder, which includes 'event'.
  const event = views.find((view) => view.phase === 'event')!;
  // Safe cast: both callers pass derivePhaseReadiness views, one per phase in
  // phaseOrder, which includes 'persistent'.
  const persistent = views.find((view) => view.phase === 'persistent')!;
  const after = preview.finalPlan?.after;
  return {
    now: values(source.snapshot),
    after: after ? values(after.militiaSnapshot) : null,
    thisWeek: {
      actions: {
        used: activity.occupiedSlots,
        allowance: preview.phases
          ? activityFoundations(draft, preview.phases.activity).capacity.actions
          : null,
        provisional: !upkeep.ready,
      },
      eventChance: preview.phases
        ? {
            percent: event.chance,
            guaranteed: event.guaranteed,
            provisional: !upkeep.ready || !activity.ready,
          }
        : null,
    },
    officers: upkeep.officers.map(({ characterId, name, roles }) => ({
      characterId,
      name: name?.trim() ? name.trim() : 'Unnamed character',
      roles: [...roles],
    })),
    afterCarriedEvents: after
      ? [...after.context.carriedEvents]
          .sort(
            (a, b) =>
              a.startedWeek - b.startedWeek ||
              a.order - b.order ||
              a.eventId.localeCompare(b.eventId),
          )
          .map((event, index) => ({
            eventId: event.eventId,
            name: `${activityLabel(event.eventType)} · Event ${index + 1}`,
            ageWeeks: after.week - event.startedWeek,
            targetNames: event.targets.map((target) => {
              if (target.kind === 'team')
                return (
                  after.militiaSnapshot.roster.teams.find(
                    (team) => team.teamId === target.teamId,
                  )?.name ?? 'Unavailable team'
                );
              // Safe cast: each non-team eventTargetSchema variant is a strict
              // object with exactly one id field beside `kind`.
              const [field, id] = Object.entries(target).find(
                ([key]) => key !== 'kind',
              )!;
              return (
                persistent.options[field]?.find((option) => option.value === id)
                  ?.label ?? `Unavailable ${target.kind}`
              );
            }),
          }))
      : null,
    carriedEvents: persistent.events.map(
      ({ eventId, name, ageWeeks, targetNames }) => ({
        eventId,
        name,
        ageWeeks,
        targetNames: [...targetNames],
      }),
    ),
  };
}
