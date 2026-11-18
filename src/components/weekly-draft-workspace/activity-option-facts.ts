import { declaredChoiceEntities } from '~/lib/weekly-draft-identities';
import { actionChoiceEvents } from '~/lib/weekly-draft-facts';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { ActivityProjection } from '~/lib/rules-activity';
import { activityLabel } from './activity-labels';
function distinct<T extends { value: string }>(options: T[]): T[] {
  return [...new Map(options.map((option) => [option.value, option])).values()];
}
export function activityOptionFacts(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  projection: ActivityProjection | null | undefined,
  // Current-week occurrences go by their Event label ("Event 2A").
  eventLabels: ReadonlyMap<string, string> = new Map(),
) {
  const declared = draft.activity.slots.flatMap((slot, index) =>
    slot.choice
      ? [
          {
            choice: slot.choice,
            entities: declaredChoiceEntities(slot.choice),
            label: `${activityLabel(slot.choice.actionId)} · Slot ${index + 1}`,
          },
        ]
      : [],
  );
  const states = [source.snapshot, ...(projection ? [projection.outcome] : [])];
  const bonuses = distinct(
    states.flatMap((state) =>
      state.bonuses.map((bonus) => ({
        value: bonus.bonusId,
        label: `${bonus.source}: ${bonus.value >= 0 ? '+' : ''}${bonus.value} ${activityLabel(bonus.check)}`,
      })),
    ),
  );
  return {
    teams: distinct([
      ...declared.flatMap(({ entities, label }) =>
        entities.team.map((value) => ({
          value,
          label,
          description: 'Staged recruitment',
        })),
      ),
      ...states.flatMap((state) =>
        state.roster.teams.map((team) => ({
          value: team.teamId,
          label: team.name,
          description: activityLabel(team.status),
        })),
      ),
    ]),
    items: distinct([
      ...declared.flatMap(({ choice, entities, label }) =>
        entities.item.map((value, index) => ({
          value,
          label:
            ('purchases' in choice
              ? choice.purchases?.find((item) => item.itemId === value)?.name
              : 'name' in choice
                ? choice.name
                : undefined) ?? `${label} · Item ${index + 1}`,
        })),
      ),
      ...states.flatMap((state) =>
        (state.economy?.items ?? []).map((item) => ({
          value: item.itemId,
          label: item.name,
        })),
      ),
    ]),
    caches: distinct([
      ...declared.flatMap(({ choice, entities, label }) =>
        entities.cache.map((value) => ({
          value,
          label:
            'location' in choice && choice.location ? choice.location : label,
        })),
      ),
      ...states.flatMap((state) =>
        (state.economy?.caches ?? []).map((cache) => ({
          value: cache.cacheId,
          label: cache.location,
        })),
      ),
    ]),
    events: distinct(
      [
        ...draft.context.carriedEvents,
        ...draft.event.occurrences,
        ...draft.activity.slots.flatMap((slot) =>
          actionChoiceEvents(slot.choice),
        ),
      ].map((event, index) => {
        const label = eventLabels.get(event.eventId);
        return {
          value: event.eventId,
          label: label
            ? event.eventType
              ? `${label} · ${activityLabel(event.eventType)}`
              : label
            : `${activityLabel(event.eventType ?? 'unselected_event')} · Event ${index + 1}`,
        };
      }),
    ),
    bonuses,
    automaticSources: distinct(
      draft.context.queuedEffects
        .filter(
          (effect) =>
            effect.startsWeek <= draft.week &&
            effect.endsWeek >= draft.week &&
            effect.effect.kind === 'automatic_events',
        )
        .map((effect, index) => ({
          value: effect.sourceId,
          label: `${activityLabel(effect.eventType ?? 'automatic_event')} · ${index + 1}`,
        })),
    ),
    modifierSources: [
      { value: 'helpful', label: 'Helpful settlement support' },
      ...bonuses.map((bonus) => ({ ...bonus, value: `bonus:${bonus.value}` })),
    ],
  };
}
