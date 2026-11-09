import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { MILITIA_ACTIVITY_ACTION_IDS } from '~/lib/militia-domain';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import {
  SETUP_CARRIED_SUBSECTIONS,
  type SetupCarriedSubsection,
} from '~/lib/setup-sections';
import {
  SetupField as Field,
  SetupEntry,
  SetupSection,
  choices,
} from './fields';
import { SetupMarketDayBenefits, SetupSkillBenefits } from './effects';
import type { SetupCharacter } from './roster';
import { SetupCarriedEvents } from './world';
const effects = [
  {
    label: 'Check modifier',
    effect: { kind: 'check_modifier', check: 'loyalty', value: 0 },
  },
  {
    label: 'Upkeep loss multiplier',
    effect: { kind: 'upkeep_loss_multiplier', value: 2 },
  },
  {
    label: 'Activity training multiplier',
    effect: { kind: 'activity_training_multiplier', value: 2 },
  },
  { label: 'Event chance', effect: { kind: 'event_chance', value: 0 } },
  { label: 'All is calm', effect: { kind: 'all_is_calm' } },
  { label: 'Automatic events', effect: { kind: 'automatic_events', count: 1 } },
  {
    label: 'Blocked action',
    effect: { kind: 'block_action', actionId: 'secure_cache' },
  },
  {
    label: 'Team unavailable',
    effect: { kind: 'team_unavailable', teamId: '' },
  },
  {
    label: 'Team return',
    effect: { kind: 'team_return', teamId: '', status: 'active' },
  },
  { label: 'Narrative', effect: { kind: 'narrative', instruction: '' } },
] as const;
function useTeamOptions() {
  const { watch } = useFormContext<MilitiaSetup>();
  return watch('state.militiaSnapshot.roster.teams').map((team) => ({
    value: team.teamId,
    label: team.name,
  }));
}
export function SetupQueuedEffects() {
  const { control, watch, setValue } = useFormContext<MilitiaSetup>();
  const queues = useFieldArray({
    control,
    name: 'state.context.queuedEffects',
  });
  const values = watch();
  const teams = useTeamOptions();
  return (
    <SetupSection
      title="Queued effects"
      add="Add queued effect"
      onAdd={() =>
        queues.append({
          effectId: crypto.randomUUID(),
          sourceId: '',
          startsWeek: values.state.week + 1,
          endsWeek: values.state.week + 1,
          effect: { kind: 'narrative', instruction: '' },
        })
      }
    >
      {queues.fields.map((row, i) => {
        // Safe cast: queues.fields mirrors the watched queuedEffects array of
        // the same form, so it has row i.
        const effect = values.state.context.queuedEffects[i]!.effect;
        return (
          <SetupEntry
            key={row.id}
            label={`Queued effect ${i + 1}`}
            onRemove={() => queues.remove(i)}
          >
            <Field
              name={`state.context.queuedEffects.${i}.sourceId`}
              label="Effect source"
            />
            <Field
              name={`state.context.queuedEffects.${i}.startsWeek`}
              label="Starts week"
              numeric
            />
            <Field
              name={`state.context.queuedEffects.${i}.endsWeek`}
              label="Ends week"
              numeric
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">Effect</p>
              <div className="flex flex-wrap gap-2">
                {effects.map((choice) => (
                  <Button
                    key={choice.label}
                    type="button"
                    variant={
                      effect.kind === choice.effect.kind ? 'default' : 'outline'
                    }
                    aria-pressed={effect.kind === choice.effect.kind}
                    onClick={() => {
                      if (effect.kind !== choice.effect.kind)
                        setValue(
                          `state.context.queuedEffects.${i}.effect`,
                          choice.effect,
                        );
                    }}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
            {'value' in effect && (
              <Field
                name={`state.context.queuedEffects.${i}.effect.value`}
                label="Effect amount"
                numeric
              />
            )}
            {effect.kind === 'check_modifier' && (
              <Field
                name={`state.context.queuedEffects.${i}.effect.check`}
                label="Affected check"
                options={choices(['loyalty', 'security', 'secrecy'])}
              />
            )}
            {effect.kind === 'check_modifier' && (
              <Field
                name={`state.context.queuedEffects.${i}.effect.phase`}
                label="Effect phase (optional)"
                options={[
                  { value: undefined, label: 'All phases' },
                  ...choices(['upkeep', 'activity', 'event', 'persistent']),
                ]}
              />
            )}
            {effect.kind === 'automatic_events' && (
              <Field
                name={`state.context.queuedEffects.${i}.effect.count`}
                label="Number of events"
                numeric
              />
            )}
            {effect.kind === 'block_action' && (
              <Field
                name={`state.context.queuedEffects.${i}.effect.actionId`}
                label="Blocked action"
                options={choices(MILITIA_ACTIVITY_ACTION_IDS)}
              />
            )}
            {'teamId' in effect && (
              <Field
                name={`state.context.queuedEffects.${i}.effect.teamId`}
                label="Affected team"
                options={teams}
              />
            )}
            {effect.kind === 'team_return' && (
              <Field
                name={`state.context.queuedEffects.${i}.effect.status`}
                label="Return condition"
                options={choices(['active', 'disabled'])}
              />
            )}
            {effect.kind === 'narrative' && (
              <Field
                name={`state.context.queuedEffects.${i}.effect.instruction`}
                label="Effect instruction"
              />
            )}
          </SetupEntry>
        );
      })}
    </SetupSection>
  );
}
export function SetupOneUseBonuses() {
  const { control, watch } = useFormContext<MilitiaSetup>();
  const bonuses = useFieldArray({
    control,
    name: 'state.militiaSnapshot.bonuses',
  });
  const week = watch('state.week');
  const teams = useTeamOptions();
  return (
    <SetupSection
      title="One-use bonuses"
      add="Add bonus"
      onAdd={() =>
        bonuses.append({
          bonusId: crypto.randomUUID(),
          source: '',
          check: 'loyalty',
          value: 0,
          availableWeek: week,
          consumedWeek: null,
        })
      }
    >
      {bonuses.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Bonus ${i + 1}`}
          onRemove={() => bonuses.remove(i)}
        >
          <Field
            name={`state.militiaSnapshot.bonuses.${i}.source`}
            label="Bonus source"
          />
          <Field
            name={`state.militiaSnapshot.bonuses.${i}.check`}
            label="Applies to"
            options={choices([
              'loyalty',
              'security',
              'secrecy',
              'event_chance',
              'any',
            ])}
          />
          <Field
            name={`state.militiaSnapshot.bonuses.${i}.teamId`}
            label="Bonus team (optional)"
            options={[{ value: undefined, label: 'All teams' }, ...teams]}
          />
          <Field
            name={`state.militiaSnapshot.bonuses.${i}.phase`}
            label="Bonus phase (optional)"
            options={[
              { value: undefined, label: 'All phases' },
              ...choices(['upkeep', 'activity', 'event', 'persistent']),
            ]}
          />
          <Field
            name={`state.militiaSnapshot.bonuses.${i}.value`}
            label="Bonus amount"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.bonuses.${i}.availableWeek`}
            label="Available week (optional)"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.bonuses.${i}.consumedWeek`}
            label="Consumed week (optional)"
            numeric
          />
        </SetupEntry>
      ))}
    </SetupSection>
  );
}

// The Carried effects step. Correction callers may choose which lists to show.
export function SetupCarriedEffects({
  characters,
  subsections = SETUP_CARRIED_SUBSECTIONS,
}: {
  characters: SetupCharacter[];
  subsections?: readonly SetupCarriedSubsection[];
}) {
  const show = (subsection: SetupCarriedSubsection) =>
    subsections.includes(subsection);
  return (
    <>
      {show('events') ? <SetupCarriedEvents characters={characters} /> : null}
      {show('queuedEffects') ? <SetupQueuedEffects /> : null}
      {show('bonuses') ? <SetupOneUseBonuses /> : null}
      {show('skillBenefits') ? (
        <SetupSkillBenefits characters={characters} />
      ) : null}
      {show('marketDayBenefits') ? <SetupMarketDayBenefits /> : null}
    </>
  );
}
