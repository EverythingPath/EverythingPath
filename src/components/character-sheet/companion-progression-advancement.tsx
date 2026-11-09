'use client';
import { useId } from 'react';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type { CompanionProgressionView } from './character-companion-progression-view-model';
import {
  alternativeAdvancementTitle,
  describeSpeciesAdvancement,
} from './companion-progression-advancement-copy';
import { CompanionProgressionKeepSwitch } from './companion-progression-keep-switch';
import type { SaveStatus } from './save-status';
import { chip, fieldLabel, SaveFeedback } from './sheet-parts';

type Projection = CompanionProgressionView['ordinary'];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'flex-col items-start justify-start gap-0.5 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

function advancementState(projection: Projection) {
  if (projection.effectiveLevel === null)
    return 'Advancement needs an available source level.';
  return projection.advancement.applied ? 'Applied' : 'Not reached yet';
}

/**
 * The species' published advancement against the ability score
 * alternative, chosen in place, and Keep: whether recorded ranks and
 * ability increases go on counting while no source does. Each writes the
 * whole recorded state with only its own choice changed. Both cards name
 * the engine's own values.
 */
export function CompanionProgressionAdvancement({
  projection,
  alternativeAdvancementLabel,
  choices,
  isDisabled,
  reasonId,
  statusAt,
  onChange,
}: {
  projection: Projection;
  alternativeAdvancementLabel: string;
  choices: AnimalCompanionProgressionState;
  isDisabled: boolean;
  reasonId: string | undefined;
  statusAt: (control: 'advancement' | 'keep') => SaveStatus;
  onChange: (
    control: 'advancement' | 'keep',
    progression: AnimalCompanionProgressionState,
  ) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h4 id={labelId} className={fieldLabel}>
            Advancement
          </h4>
          <span className={chip}>{advancementState(projection)}</span>
        </div>
        <p className={note}>
          Published at effective progression level{' '}
          {projection.advancement.level}.
        </p>
        <RadioGroup
          aria-labelledby={labelId}
          name="companion-advancement"
          value={choices.advancementChoice}
          disabled={isDisabled}
          onValueChange={(value) => {
            if (value === choices.advancementChoice) return;
            onChange('advancement', {
              ...choices,
              advancementChoice:
                value === 'abilityScores' ? 'abilityScores' : 'species',
            });
          }}
          className="grid-cols-1 gap-1 sm:grid-cols-2"
        >
          <RadioGroupItem
            value="species"
            className={card}
            aria-describedby={reasonId}
          >
            <span>Species advancement</span>
            <span className={note}>
              {describeSpeciesAdvancement(choices.species)}
            </span>
          </RadioGroupItem>
          <RadioGroupItem
            value="abilityScores"
            className={card}
            aria-describedby={reasonId}
          >
            <span>{alternativeAdvancementTitle}</span>
            <span className={note}>{alternativeAdvancementLabel}</span>
          </RadioGroupItem>
        </RadioGroup>
        <SaveFeedback
          status={statusAt('advancement')}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
      <CompanionProgressionKeepSwitch
        isKept={choices.keep}
        isDisabled={isDisabled}
        reasonId={reasonId}
        status={statusAt('keep')}
        note="Recorded skill ranks and ability increases go on counting while no supporting source counts."
        onToggle={() => onChange('keep', { ...choices, keep: !choices.keep })}
      />
    </div>
  );
}
