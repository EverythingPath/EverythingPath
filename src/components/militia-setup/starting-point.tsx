import { useFormContext } from 'react-hook-form';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import { SetupField as Field, SetupSection, choices, yesNo } from './fields';

// Focus, rank, training, treasury and notoriety, shared by Setup's Starting
// point and militia value corrections.
export function SetupMilitiaValues() {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2">
      <Field
        name="state.militiaSnapshot.focus"
        label="Focus"
        options={choices(['Loyalty', 'Security', 'Secrecy'])}
      />
      <Field name="state.militiaSnapshot.rank" label="Rank" numeric />
      <Field name="state.militiaSnapshot.training" label="Training" numeric />
      <Field
        name="state.militiaSnapshot.treasuryCopper"
        label="Treasury (copper)"
        numeric
      />
      <Field name="state.militiaSnapshot.notoriety" label="Notoriety" numeric />
    </div>
  );
}

// New or Existing. Switching keeps every entered fact; the only change is
// that Existing clears the first-militia-week skip.
export function SetupModeChoice() {
  const { setValue } = useFormContext<MilitiaSetup>();
  return (
    <Field
      name="mode"
      label="New or existing militia"
      onChoice={(mode) => {
        if (mode === 'existing')
          setValue('state.context.firstMilitiaWeek', false, {
            shouldDirty: true,
          });
      }}
      options={[
        { value: 'new', label: 'New militia' },
        { value: 'existing', label: 'Existing militia' },
      ]}
    />
  );
}

export function SetupWeek() {
  const { watch } = useFormContext<MilitiaSetup>();
  return (
    <SetupSection title="Week context">
      <div className="grid items-start gap-3 md:grid-cols-2">
        <Field name="state.week" label="Current week" numeric />
        <Field name="state.context.startDay" label="Week start day" numeric />
        {watch('mode') === 'new' && (
          <Field
            name="state.context.firstMilitiaWeek"
            label="First militia week"
            options={yesNo}
          />
        )}
        <Field
          name="state.context.uneventfulCarry"
          label="Previous week was uneventful"
          options={yesNo}
        />
        <Field
          name="state.context.lastBuyoffWeek"
          label="Last persistent buyoff week (optional)"
          numeric
        />
        <Field
          name="phase"
          label="Open phase"
          options={choices([
            'upkeep',
            'activity',
            'event',
            'persistent',
            'summary',
          ])}
        />
      </div>
    </SetupSection>
  );
}
