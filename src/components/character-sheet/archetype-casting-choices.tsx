'use client';
import { castingStatusKey } from './use-character-sheet-archetypes';
import type { Id } from '@convex/_generated/dataModel';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type { ResolvedCastingProperty } from '~/lib/character-sheet-archetype-casting';
import { cn } from '~/lib/utils';
import {
  describeAutomaticAbility,
  describeCastingProperty,
  findChosenOption,
  listCastingChoiceOptions,
  type SpellNames,
} from './archetype-casting-view-model';
import type {
  ArchetypeClassView,
  ArchetypesController,
} from './character-sheet-archetypes-view-model';
import { InlineWarnings } from './inline-warning';
import { fieldLabel, missingChoice, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

/** The anchor of a class's casting choices, for the Spellcasting block's waiting line. */
export const archetypeCastingAnchor = (classEntryId: string) =>
  `archetype-casting-${classEntryId}`;

const shownStatuses = new Set<ResolvedCastingProperty['status']>([
  'unresolved',
  'chosen',
  'automatic',
]);

// The warnings of one conflict: while it waits, the choice it asks for;
// once chosen or compared, the advisory conflict with Accept.
function listRowWarnings(
  warnings: SheetWarningView[],
  property: ResolvedCastingProperty,
) {
  const candidates = new Set(
    property.candidates.map((candidate) => candidate.entryId),
  );
  const [check, subject] =
    property.status === 'unresolved'
      ? ['archetypeCastingChoiceMissing', `:castingChoice:${property.key}`]
      : ['archetypeCastingConflict', `:casting:${property.key}`];
  return warnings.filter(
    (warning) =>
      warning.check === check &&
      warning.subject.endsWith(subject) &&
      warning.target.kind === 'entry' &&
      candidates.has(warning.target.entryId),
  );
}

// The option cards read as sentences, left-aligned, and stack on the phone.
const optionCard =
  'min-h-11 justify-start px-2.5 py-1.5 text-left font-sans text-sm [overflow-wrap:anywhere] md:min-h-9';

function CastingChoiceRow({
  group,
  property,
  spellNames,
  actions,
  warnings,
  warningController,
}: {
  group: ArchetypeClassView;
  property: ResolvedCastingProperty;
  spellNames: SpellNames;
  actions: ArchetypesController;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const groupName = useId();
  const descriptionId = useId();
  const label = describeCastingProperty(property, spellNames);
  const status = actions.statusFor(
    castingStatusKey(group.classEntryId, property.key),
  );
  const isDisabled = status.kind === 'saving' || maintenance.readOnly;
  const isMissing = property.status === 'unresolved';
  const options = listCastingChoiceOptions(property);
  const rowWarnings = listRowWarnings(warnings, property);
  const describedBy =
    [rowWarnings.length > 0 ? descriptionId : null, reasonId]
      .filter((id) => id !== null && id !== undefined)
      .join(' ') || undefined;
  return (
    <li className="grid gap-x-3 gap-y-1 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <span className="pt-1 text-sm">{label}</span>
      <div className="flex min-w-0 flex-col gap-1">
        {property.status === 'automatic' ? (
          <p className="text-sm [overflow-wrap:anywhere]">
            {describeAutomaticAbility(property)}
          </p>
        ) : (
          <RadioGroup
            aria-label={`${label} for ${group.name}`}
            aria-describedby={describedBy}
            name={groupName}
            value={findChosenOption(options, property.chosenEntryId)}
            disabled={isDisabled}
            className={cn(
              'flex flex-col gap-1 sm:flex-row sm:flex-wrap',
              isMissing && cn(missingChoice, 'p-0.5'),
            )}
            onValueChange={(value) => {
              if (isDisabled) return;
              // Safe cast: every option value is a candidate Selection's id.
              void actions.chooseCasting({
                classEntryId: group.classEntryId,
                entryId: value as Id<'characterSheetEntry'>,
                property: property.key,
              });
            }}
          >
            {options.map((option) => (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                className={optionCard}
              >
                {option.label}
              </RadioGroupItem>
            ))}
          </RadioGroup>
        )}
        <InlineWarnings
          id={descriptionId}
          warnings={rowWarnings}
          controller={warningController}
        />
        <SaveFeedback
          status={status}
          savedText="Casting choice saved."
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
    </li>
  );
}

/**
 * The casting conflicts of one class's Archetypes (#422), under its cards:
 * one row per property two Archetypes change differently, with an option
 * per candidate and the player's saved choice marked. An open conflict wears
 * the blue outline until chosen; a chosen one keeps its advisory warning,
 * whose Accept changes nothing. Competing casting abilities are compared,
 * not chosen, and read as one line. A removed Spellcasting's row stays, so
 * the choice can be reversed. Nothing renders without a conflict.
 */
export function ArchetypeCastingChoices({
  group,
  spellNames,
  actions,
  warnings,
  warningController,
}: {
  group: ArchetypeClassView;
  spellNames: SpellNames;
  actions: ArchetypesController;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const headingId = useId();
  const rows = (group.casting?.properties ?? []).filter((property) =>
    shownStatuses.has(property.status),
  );
  const selectionIds = new Set<string>(
    group.options.flatMap((option) =>
      option.selection ? [option.selection._id] : [],
    ),
  );
  // An added package missing a property has no choice to make; it reads here.
  const missing = warnings.filter(
    (warning) =>
      warning.check === 'archetypeCastingUnresolved' &&
      warning.target.kind === 'entry' &&
      selectionIds.has(warning.target.entryId),
  );
  if (rows.length === 0 && missing.length === 0) return null;
  return (
    <div
      id={archetypeCastingAnchor(group.classEntryId)}
      role="group"
      aria-labelledby={headingId}
      className="border-foreground/10 flex flex-col gap-1.5 border-t pt-2"
    >
      <p id={headingId} className={fieldLabel}>
        Spellcasting
      </p>
      <InlineWarnings warnings={missing} controller={warningController} />
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((property) => (
            <CastingChoiceRow
              key={property.key}
              group={group}
              property={property}
              spellNames={spellNames}
              actions={actions}
              warnings={warnings}
              warningController={warningController}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
