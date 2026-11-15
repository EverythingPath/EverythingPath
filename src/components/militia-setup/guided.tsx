'use client';
import { FormProvider } from 'react-hook-form';
import { PhoneSetup } from './guided-phone';
import { SetupAddCharacter } from './roster';
import { WideSetup } from './guided-wide';
import { useGuidedSetup, type GuidedSetupProps } from './use-guided-setup';

// Guided Militia Setup: nine steps over one form. Below 768px every step is
// an accordion row; from 768px a step index sits beside one detail pane.
export function GuidedMilitiaSetup({
  onAddCharacter,
  ...props
}: GuidedSetupProps) {
  const setup = useGuidedSetup(props);
  return (
    <SetupAddCharacter value={onAddCharacter ?? null}>
      <FormProvider {...setup.form}>
        <div
          {...setup.rootProps}
          data-setup-layout={setup.layout}
          className="min-w-0"
        >
          <form
            noValidate
            onSubmit={(event) => event.preventDefault()}
            className="[&_button]:h-auto [&_button]:min-h-9 [&_button]:max-w-full [&_button]:[overflow-wrap:anywhere] [&_button]:whitespace-normal [&_fieldset]:min-w-0"
          >
            <fieldset disabled={setup.pending} className="min-w-0">
              {setup.layout === 'wide' ? (
                <WideSetup setup={setup} />
              ) : (
                <PhoneSetup setup={setup} />
              )}
            </fieldset>
          </form>
        </div>
      </FormProvider>
    </SetupAddCharacter>
  );
}
