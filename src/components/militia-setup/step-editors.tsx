'use client';
import { useId } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Textarea } from '~/components/ui/textarea';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import type { SetupStepKey } from '~/lib/setup-steps';
import { SetupAssets } from './assets';
import { SetupCarriedEffects } from './carry';
import { SetupCharacterConditions } from './effects';
import { SetupSectionHeading } from './fields';
import { SetupPeople, SetupTeams, type SetupCharacter } from './roster';
import { SetupMilitiaValues, SetupWeek } from './starting-point';
import { SetupSettlements } from './world';

type EditorStep = Exclude<SetupStepKey, 'review'>;
function editor(step: EditorStep, characters: SetupCharacter[]) {
  switch (step) {
    case 'startingPoint':
      return <SetupMilitiaValues />;
    case 'week':
      return <SetupWeek />;
    case 'people':
      return <SetupPeople characters={characters} />;
    case 'teams':
      return <SetupTeams characters={characters} />;
    case 'settlements':
      return <SetupSettlements />;
    case 'characterConditions':
      return <SetupCharacterConditions characters={characters} />;
    case 'assets':
      return <SetupAssets characters={characters} />;
    case 'carriedEffects':
      return <SetupCarriedEffects characters={characters} />;
  }
}
// The shared section editors for one guided step. The step's own heading names
// a single section; several sections keep their titles one level below it.
export function SetupStepEditor({
  step,
  characters,
}: {
  step: EditorStep;
  characters: SetupCharacter[];
}) {
  return (
    <SetupSectionHeading
      value={step === 'assets' || step === 'carriedEffects' ? 'h3' : 'none'}
    >
      {editor(step, characters)}
    </SetupSectionHeading>
  );
}

// Optional setup notes, persisted unchanged and shown during play.
export function SetupNotes() {
  const { control } = useFormContext<MilitiaSetup>();
  const id = useId();
  return (
    <Controller
      control={control}
      name="notes"
      render={({ field, fieldState }) => (
        <div className="min-w-0 space-y-1">
          <label htmlFor={id} className="text-sm font-medium">
            Setup notes (optional)
          </label>
          <Textarea
            {...field}
            id={id}
            rows={5}
            aria-invalid={Boolean(fieldState.error)}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
          />
          {fieldState.error && (
            <p
              id={`${id}-error`}
              role="alert"
              className="text-destructive text-sm"
            >
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
