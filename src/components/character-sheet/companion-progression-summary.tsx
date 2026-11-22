'use client';
import { useId, useState } from 'react';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import type { CompanionProgressionView } from './character-companion-progression-view-model';
import { CompanionProgressionAdvancement } from './companion-progression-advancement';
import { CompanionProgressionChoices } from './companion-progression-choices';
import { CompanionProgressionFacts } from './companion-progression-facts';
import { CompanionProgressionSources } from './companion-progression-sources';
import { InlineWarnings } from './inline-warning';
import type { useCharacterSheet } from './use-character-sheet';
import type { SaveStatus } from './save-status';
import { chip, fieldLabel, missingChoice } from './sheet-parts';

type Projection = 'ordinary' | 'permanent';

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
const projections: { value: Projection; label: string }[] = [
  { value: 'ordinary', label: 'Current' },
  { value: 'permanent', label: 'Permanent' },
];

/**
 * The calculated progression for one projection at a time, Current or
 * Permanent, each exactly as the sheet supplies it; the recorded choices
 * below are the same for both.
 */
export function CompanionProgressionSummary({
  summary,
  warningController,
  isDisabled,
  reasonId,
  statusAt,
  onChange,
}: {
  summary: CompanionProgressionView;
  warningController: ReturnType<typeof useCharacterSheet>['warnings'];
  isDisabled: boolean;
  reasonId: string | undefined;
  statusAt: (control: 'advancement' | 'keep') => SaveStatus;
  onChange: (
    control: 'advancement' | 'keep',
    progression: AnimalCompanionProgressionState,
  ) => void;
}) {
  const [shown, setShown] = useState<Projection>('ordinary');
  const projectionLabelId = useId();
  const projection = summary[shown];
  const choices = summary.choices;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={fieldLabel}>Species</span>
          <span className="text-base">{summary.speciesName}</span>
          <span
            className={cn(
              chip,
              projection.status !== 'active' && 'text-muted-foreground',
              projection.status === 'unresolved' && missingChoice,
            )}
          >
            {projection.statusLabel}
          </span>
          <span className={chip}>Size {projection.sizeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span id={projectionLabelId} className={fieldLabel}>
            Values
          </span>
          <RadioGroup
            aria-labelledby={projectionLabelId}
            name="companion-progression-projection"
            value={shown}
            onValueChange={(value) =>
              setShown(value === 'permanent' ? 'permanent' : 'ordinary')
            }
            className="grid-cols-2 gap-0"
          >
            {projections.map((option) => (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                className="px-2.5 text-xs"
              >
                {option.label}
              </RadioGroupItem>
            ))}
          </RadioGroup>
        </div>
      </div>
      {shown === 'permanent' ? (
        <p className={note}>Permanent values leave out temporary effects.</p>
      ) : null}
      {projection.status === 'dormant' ? (
        <p className="text-sm">Recorded choices are retained.</p>
      ) : null}
      <InlineWarnings
        warnings={projection.warnings}
        controller={warningController}
      />
      <CompanionProgressionFacts projection={projection} />
      <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
        <CompanionProgressionSources projection={projection} />
        <div className="flex min-w-0 flex-col gap-3">
          {choices ? (
            <>
              <CompanionProgressionAdvancement
                projection={projection}
                alternativeAdvancementLabel={
                  summary.alternativeAdvancementLabel
                }
                choices={choices}
                isDisabled={isDisabled}
                reasonId={reasonId}
                statusAt={statusAt}
                onChange={onChange}
              />
              <div className="flex flex-col gap-1">
                <h4 className={fieldLabel}>Recorded choices</h4>
                <CompanionProgressionChoices choices={choices} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
