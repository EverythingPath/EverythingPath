'use client';
import { useId, useState } from 'react';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type { EidolonProgressionState } from '~/lib/character-sheet-eidolon-progression';
import { cn } from '~/lib/utils';
import {
  withEidolonSubtypeChoice,
  withEidolonVersion,
  withoutEidolonDormantChoice,
  type EidolonProgressionView,
} from './character-eidolon-progression-view-model';
import { CompanionProgressionChoices } from './companion-progression-choices';
import { CompanionProgressionKeepSwitch } from './companion-progression-keep-switch';
import { CompanionProgressionSources } from './companion-progression-sources';
import { EidolonBroodShare } from './eidolon-brood-share';
import { EidolonDormantChoices } from './eidolon-dormant-choices';
import { EidolonEvolutionList } from './eidolon-evolution-list';
import { EidolonEvolutionPool } from './eidolon-evolution-pool';
import { EidolonNaturalAttacks } from './eidolon-natural-attacks';
import { EidolonProgressionFacts } from './eidolon-progression-facts';
import { EidolonRuleConflict } from './eidolon-rule-conflict';
import {
  EidolonSubtypeChoicePrompt,
  missingChoiceForRow,
} from './eidolon-subtype-choice-prompt';
import { EidolonVersionConvert } from './eidolon-version-convert';
import { InlineWarnings } from './inline-warning';
import type { SaveStatus } from './save-status';
import { chip, fieldLabel, missingChoice } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import type { SheetEntryInput } from './use-character-sheet-entries';
import type { EvolutionCatalog } from './use-eidolon-evolution-picker-form';

type Projection = 'ordinary' | 'permanent';
export type EidolonWrittenControl =
  | 'evolutions'
  | 'keep'
  | 'version'
  | 'subtypeChoice'
  | 'dormant';
type ProjectionView = EidolonProgressionView['ordinary'];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
const projections: { value: Projection; label: string }[] = [
  { value: 'ordinary', label: 'Current' },
  { value: 'permanent', label: 'Permanent' },
];

/** The subtype as the projection counts it, or that an Unchained eidolon still needs one. */
function SubtypeLine({ projection }: { projection: ProjectionView }) {
  if (projection.version !== 'unchained') return null;
  const { subtype } = projection;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={fieldLabel}>Subtype</span>
      {subtype ? (
        <>
          <span className="text-base">{subtype.name}</span>
          <span className={chip}>{subtype.alignment}</span>
          {subtype.elementLabel ? (
            <span className={chip}>{subtype.elementLabel}</span>
          ) : null}
        </>
      ) : (
        <span className={cn(chip, 'text-sky-300', missingChoice)}>
          Not chosen yet
        </span>
      )}
    </div>
  );
}

/** The subtype choices no evolution row asks for itself, such as an element. */
function subtypeChoicesWithoutRow(projection: ProjectionView) {
  const { subtype } = projection;
  if (!subtype) return [];
  const asked = new Set(
    projection.evolutions.flatMap((row) => {
      const choice = missingChoiceForRow(subtype, row);
      return choice ? [choice.key] : [];
    }),
  );
  return subtype.missingChoices.filter((choice) => !asked.has(choice.key));
}

/**
 * The calculated eidolon for one projection at a time, Current or
 * Permanent, each exactly as the sheet supplies it: facts, the summoner's
 * pool and source, the evolutions and natural attacks, then the recorded
 * choices, the same for both, with Keep. An Unchained eidolon adds its
 * subtype with the choices it still needs; a version mismatch adds the
 * way to convert; recorded state the current rules do not apply waits
 * under Not counting now.
 */
export function EidolonProgressionSummary({
  eidolon,
  catalog,
  warningController,
  isDisabled,
  reasonId,
  statusAt,
  onChange,
  createNaturalAttack,
}: {
  eidolon: EidolonProgressionView;
  catalog: EvolutionCatalog;
  warningController: ReturnType<typeof useCharacterSheet>['warnings'];
  isDisabled: boolean;
  reasonId: string | undefined;
  statusAt: (control: EidolonWrittenControl) => SaveStatus;
  onChange: (
    control: EidolonWrittenControl,
    progression: EidolonProgressionState,
  ) => Promise<boolean>;
  createNaturalAttack?: (input: SheetEntryInput) => Promise<unknown>;
}) {
  const [shown, setShown] = useState<Projection>('ordinary');
  const projectionLabelId = useId();
  const projection = eidolon[shown];
  const { choices } = eidolon;
  const subtypePrompts = subtypeChoicesWithoutRow(projection);
  const chooseSubtypeChoice = (
    key: Parameters<typeof withEidolonSubtypeChoice>[1],
    value: string,
  ) => {
    if (!choices) return;
    void onChange(
      'subtypeChoice',
      withEidolonSubtypeChoice(choices, key, value),
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={fieldLabel}>Base form</span>
            <span className="text-base">
              {eidolon.baseFormName ?? 'Unresolved'}
            </span>
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
          <SubtypeLine projection={projection} />
        </div>
        <div className="flex items-center gap-2">
          <span id={projectionLabelId} className={fieldLabel}>
            Values
          </span>
          <RadioGroup
            aria-labelledby={projectionLabelId}
            name="eidolon-progression-projection"
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
      {projection.ruleConflict ? (
        <EidolonRuleConflict conflict={projection.ruleConflict} />
      ) : null}
      <InlineWarnings
        warnings={projection.warnings}
        controller={warningController}
      />
      {projection.versionMismatch && choices ? (
        <EidolonVersionConvert
          version={projection.version}
          isDisabled={isDisabled}
          reasonId={reasonId}
          status={statusAt('version')}
          onConvert={(version) =>
            void onChange('version', withEidolonVersion(choices, version))
          }
        />
      ) : null}
      {projection.unsupportedArchetypes.length > 0 ? (
        <ul
          aria-label="Archetypes not applied"
          className="flex flex-col gap-0.5"
        >
          {projection.unsupportedArchetypes.map((name) => (
            <li key={name} className={note}>
              {name}: written for the original summoner; not applied to this
              Unchained eidolon
            </li>
          ))}
        </ul>
      ) : null}
      {projection.subtype && choices && subtypePrompts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {subtypePrompts.map((choice) => (
            <EidolonSubtypeChoicePrompt
              key={choice.key}
              subtypeName={projection.subtype?.name ?? ''}
              choice={choice}
              isDisabled={isDisabled}
              reasonId={reasonId}
              status={statusAt('subtypeChoice')}
              onChoose={chooseSubtypeChoice}
            />
          ))}
        </div>
      ) : null}
      <EidolonProgressionFacts projection={projection} />
      {projection.brood ? <EidolonBroodShare brood={projection.brood} /> : null}
      <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <EidolonEvolutionPool
            pool={projection.pool}
            isAllocated={projection.brood !== null}
          />
          <CompanionProgressionSources
            projection={projection}
            levelLabel={
              projection.reduction ? 'Eidolon table level' : 'Summoner level'
            }
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <EidolonEvolutionList
            projection={projection}
            choices={choices}
            baseFormName={eidolon.baseFormName}
            catalog={catalog}
            isDisabled={isDisabled}
            reasonId={reasonId}
            status={statusAt('evolutions')}
            subtypeChoiceStatus={statusAt('subtypeChoice')}
            onChange={(progression) => onChange('evolutions', progression)}
            onChooseSubtypeChoice={chooseSubtypeChoice}
          />
          <EidolonNaturalAttacks
            projection={projection}
            isDisabled={isDisabled}
            reasonId={reasonId}
            createNaturalAttack={createNaturalAttack}
          />
        </div>
      </div>
      <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h4 className={fieldLabel}>Class skills</h4>
            {projection.classSkills.length > 0 ? (
              <ul aria-label="Class skills" className="flex flex-wrap gap-1">
                {projection.classSkills.map((skill) => (
                  <li key={skill} className={chip}>
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={note}>None recorded.</p>
            )}
          </div>
          {choices ? (
            <div className="flex flex-col gap-1">
              <h4 className={fieldLabel}>Recorded choices</h4>
              <CompanionProgressionChoices choices={choices} />
            </div>
          ) : null}
        </div>
        {choices ? (
          <CompanionProgressionKeepSwitch
            isKept={choices.keep}
            isDisabled={isDisabled}
            reasonId={reasonId}
            status={statusAt('keep')}
            note="Recorded evolutions, skill ranks and ability increases go on counting while no summoner source supports the progression."
            onToggle={() =>
              void onChange('keep', { ...choices, keep: !choices.keep })
            }
          />
        ) : null}
      </div>
      {choices ? (
        <EidolonDormantChoices
          entries={projection.dormantChoices}
          status={statusAt('dormant')}
          onDiscard={(entry) =>
            onChange('dormant', withoutEidolonDormantChoice(choices, entry))
          }
        />
      ) : null}
    </div>
  );
}
