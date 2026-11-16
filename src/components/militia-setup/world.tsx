import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { REPUTATION_LEVELS, EVENT_TYPES } from '~/lib/militia-domain';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import {
  SetupField as Field,
  SetupEntry,
  SetupSection,
  choices,
  yesNo,
} from './fields';
import type { SetupCharacter } from './roster';
export function SetupSettlements({
  rowNotes,
}: {
  /** A note under a settlement's title, by its identity. */
  rowNotes?: ReadonlyMap<string, string>;
} = {}) {
  const { control, watch, setValue } = useFormContext<MilitiaSetup>();
  const settlements = useFieldArray({
    control,
    name: 'state.militiaSnapshot.settlements',
  });
  const values = watch();
  const snapshot = values.state.militiaSnapshot;
  return (
    <SetupSection
      title="Settlements"
      add="Add settlement"
      onAdd={() =>
        settlements.append({
          settlementId: crypto.randomUUID(),
          name: '',
          reputation: 'Indifferent',
          secured: false,
          occupied: false,
          temporaryReputationShift: 0,
          refugeActivatedWeek: null,
          refugeActiveUntilWeek: null,
        })
      }
    >
      {settlements.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Settlement ${i + 1}`}
          note={rowNotes?.get(row.settlementId)}
          onRemove={() => settlements.remove(i)}
        >
          <Field
            name={`state.militiaSnapshot.settlements.${i}.name`}
            label="Settlement name"
          />
          <Field
            name={`state.militiaSnapshot.settlements.${i}.reputation`}
            label="Reputation"
            options={choices(REPUTATION_LEVELS)}
          />
          <Field
            name={`state.militiaSnapshot.settlements.${i}.secured`}
            label="Secured"
            options={yesNo}
          />
          <Field
            name={`state.militiaSnapshot.settlements.${i}.occupied`}
            label="Occupied"
            options={yesNo}
          />
          <Field
            name={`state.militiaSnapshot.settlements.${i}.temporaryReputationShift`}
            label="Temporary reputation shift"
            numeric
          />
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Safe cast: settlements.fields mirrors the watched settlements
                // array this render read, so it has row i.
                const town = snapshot.settlements[i]!;
                setValue(
                  `state.militiaSnapshot.settlements.${i}`,
                  town.reduceDangerUntilWeek === undefined
                    ? {
                        ...town,
                        reduceDangerReputationShift: 1,
                        reduceDangerUntilWeek: values.state.week,
                      }
                    : {
                        ...town,
                        reduceDangerReputationShift: undefined,
                        reduceDangerUntilWeek: undefined,
                      },
                );
              }}
            >
              {snapshot.settlements[i]?.reduceDangerUntilWeek === undefined
                ? 'Record Reduce Danger benefit'
                : 'Remove Reduce Danger benefit'}
            </Button>
            {snapshot.settlements[i]?.reduceDangerUntilWeek !== undefined && (
              <>
                <Field
                  name={`state.militiaSnapshot.settlements.${i}.reduceDangerReputationShift`}
                  label="Reduce Danger reputation shift"
                  numeric
                />
                <Field
                  name={`state.militiaSnapshot.settlements.${i}.reduceDangerUntilWeek`}
                  label="Reduce Danger ends week"
                  numeric
                />
              </>
            )}
          </div>
          <Field
            name={`state.militiaSnapshot.settlements.${i}.refugeActivatedWeek`}
            label="Refuge activated week (optional)"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.settlements.${i}.refugeActiveUntilWeek`}
            label="Refuge ends week (optional)"
            numeric
          />
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
export function SetupCarriedEvents({
  characters,
}: {
  characters: SetupCharacter[];
}) {
  const { control, watch, setValue } = useFormContext<MilitiaSetup>();
  const events = useFieldArray({
    control,
    name: 'state.context.carriedEvents',
  });
  const values = watch();
  const snapshot = values.state.militiaSnapshot;
  const targets = [
    ...snapshot.settlements.map((x) => ({
      label: x.name,
      target: { kind: 'settlement' as const, settlementId: x.settlementId },
    })),
    ...snapshot.roster.teams.map((x) => ({
      label: x.name,
      target: { kind: 'team' as const, teamId: x.teamId },
    })),
    ...snapshot.characters.map((x) => ({
      label:
        characters.find((c) => c.characterId === x.characterId)?.name ??
        'Character',
      target: { kind: 'character' as const, characterId: x.characterId },
    })),
    ...(snapshot.economy?.items ?? []).map((x) => ({
      label: x.name,
      target: { kind: 'item' as const, itemId: x.itemId },
    })),
    ...(snapshot.economy?.caches ?? []).map((x) => ({
      label: x.location,
      target: { kind: 'cache' as const, cacheId: x.cacheId },
    })),
    ...values.state.context.carriedEvents.map((x, i) => ({
      label: `Event ${i + 1}`,
      target: { kind: 'event' as const, eventId: x.eventId },
    })),
  ];
  return (
    <SetupSection
      title="Carried persistent events"
      add="Add carried event"
      onAdd={() =>
        events.append({
          eventId: crypto.randomUUID(),
          eventType: 'rivalry',
          startedWeek: values.state.week,
          order: events.fields.length,
          targets: [],
        })
      }
    >
      {events.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Event ${i + 1}`}
          onRemove={() => events.remove(i)}
        >
          <Field
            name={`state.context.carriedEvents.${i}.eventType`}
            label="Event type"
            options={choices(EVENT_TYPES)}
          />
          <Field
            name={`state.context.carriedEvents.${i}.startedWeek`}
            label="Started week"
            numeric
          />
          <Field
            name={`state.context.carriedEvents.${i}.order`}
            label="Processing order"
            numeric
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">Event targets</p>
            <div className="flex flex-wrap gap-2">
              {targets.map(({ label, target }) => {
                const current =
                  values.state.context.carriedEvents[i]?.targets ?? [];
                const selected = current.some(
                  (x) => JSON.stringify(x) === JSON.stringify(target),
                );
                return (
                  <Button
                    key={JSON.stringify(target)}
                    type="button"
                    variant={selected ? 'default' : 'outline'}
                    aria-pressed={selected}
                    onClick={() =>
                      setValue(
                        `state.context.carriedEvents.${i}.targets`,
                        selected
                          ? current.filter(
                              (x) =>
                                JSON.stringify(x) !== JSON.stringify(target),
                            )
                          : [...current, target],
                      )
                    }
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
          {values.state.context.carriedEvents[i]?.eventType === 'theft' && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setValue(
                    `state.context.carriedEvents.${i}.mitigation`,
                    values.state.context.carriedEvents[i]?.mitigation
                      ? undefined
                      : {
                          week: values.state.week,
                          retainedIncomePercent: 90,
                        },
                  )
                }
              >
                {values.state.context.carriedEvents[i]?.mitigation
                  ? 'Remove recorded mitigation'
                  : 'Record Theft mitigation'}
              </Button>
              {values.state.context.carriedEvents[i]?.mitigation && (
                <Field
                  name={`state.context.carriedEvents.${i}.mitigation.week`}
                  label="Mitigation week"
                  numeric
                />
              )}
            </div>
          )}
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
