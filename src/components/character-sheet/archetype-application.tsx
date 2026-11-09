'use client';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  ArchetypeFeatureList,
  type ArchetypeFeatureRow,
} from './archetype-feature-list';
import { listArchetypeCastingLines } from './archetype-casting-view-model';
import { ArchetypePartEditor } from './archetype-part-editor';
import { ArchetypeSelectionState } from './archetype-selection-state';
import {
  describeRelation,
  describeSkillChanges,
  findFeatureName,
  findFeatureOption,
  isFeaturePart,
  listFeatureRelations,
  type ArchetypeClassView,
  type ArchetypeGrantProps,
  type ArchetypeOptionView,
  type ArchetypeSelection,
  type ArchetypesController,
  type FeatureNames,
} from './character-sheet-archetypes-view-model';
import { GrantEntryList } from './character-sheet-grants';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import { listGrantEntryWarnings } from './grant-entry-row';
import type { SaveStatus } from './save-status';
import { SelectionChecks } from './selection-checks';
import { useSelectionRow } from './selection-order-context';
import { action, chip, fieldLabel } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

const idle: SaveStatus = { kind: 'idle' };

function listFeatureRows({
  group,
  option,
  featureNames,
}: {
  group: ArchetypeClassView;
  option: ArchetypeOptionView;
  featureNames: FeatureNames;
}) {
  const currentLevel = group.calculated?.classLevel ?? 0;
  const toRow = (row: {
    classLevel: number;
    catalogEntryId: string;
  }): Omit<ArchetypeFeatureRow, 'key'> => ({
    classLevel: row.classLevel,
    name: findFeatureName({
      featureOptions: group.featureOptions,
      featureNames,
      catalogEntryId: row.catalogEntryId,
    }),
    isLater: row.classLevel > currentLevel,
  });
  // The resolver lists each replaced feature row once per class level.
  const replaces = (option.application?.replacements ?? []).map((row) => ({
    ...toRow(row),
    key: `${row.classLevel}:${row.catalogEntryId}`,
    extent:
      row.scope !== 'whole' &&
      isFeaturePart(findFeatureOption(group.featureOptions, row.catalogEntryId))
        ? ('Independent part' as const)
        : ('Whole feature' as const),
  }));
  const adds = (option.application?.additions ?? []).map((row, index) => ({
    ...toRow(row),
    key: `${index}:${row.classLevel}:${row.catalogEntryId}`,
  }));
  return { replaces, adds };
}

// Casting conflicts are chosen and warned about under the class's cards,
// not on each candidate's card.
const castingChecks = new Set([
  'archetypeCastingConflict',
  'archetypeCastingChoiceMissing',
  'archetypeCastingUnresolved',
]);

// "Casting ability: Charisma · Preparation: Spontaneous, spells known": what
// this Archetype does to the class's casting, each change marked when it
// lost a choice or an ability comparison, or still waits for one.
function CastingLine({
  group,
  option,
  selection,
}: {
  group: ArchetypeClassView;
  option: ArchetypeOptionView;
  selection: ArchetypeSelection;
}) {
  const detail = option.definition.detail;
  const lines = listArchetypeCastingLines({
    change: detail.kind === 'archetype' ? detail.casting : undefined,
    entryId: selection._id,
    properties: group.casting?.properties ?? [],
    presence: group.casting?.presence,
  });
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className={fieldLabel}>Spellcasting</p>
      <ul
        aria-label={`${option.definition.name} spellcasting changes`}
        className="flex flex-wrap gap-x-3 gap-y-1"
      >
        {lines.map((line) => (
          <li
            key={line.key}
            className={cn(
              'flex flex-wrap items-baseline gap-x-1.5 text-xs [overflow-wrap:anywhere]',
              line.state !== 'applied' && 'text-muted-foreground',
            )}
          >
            <span>{line.text}</span>
            {line.state === 'notApplied' ? (
              <span className={cn(chip, 'text-muted-foreground')}>
                Not applied
              </span>
            ) : null}
            {line.state === 'waiting' ? (
              <span className={cn(chip, 'text-sky-300')}>
                Waits for a choice
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A chosen Archetype across its class: its recorded choice and notes,
 * Deactivate or Activate, what it replaces and adds by class level, what it
 * does to the class's casting (#422), the class skills it changes, how its
 * features meet the class's other Archetypes, its warnings verbatim, and
 * the exact rows it replaces. A conflict or unmatched row warns and leaves
 * everything editable.
 */
export function ArchetypeApplication({
  group,
  option,
  selection,
  featureNames,
  replacedRows,
  rowProps,
  actions,
  warnings,
  warningController,
}: {
  group: ArchetypeClassView;
  option: ArchetypeOptionView;
  selection: ArchetypeSelection;
  featureNames: FeatureNames;
  /** The class's own features this Archetype replaces, as Grant rows. */
  replacedRows: GrantEntryView[];
  rowProps: ArchetypeGrantProps['rowProps'];
  actions: ArchetypesController;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const name = option.definition.name;
  const status = actions.statusFor(option.definition._id);
  const isDisabled = status.kind === 'saving' || maintenance.readOnly;
  // The Selection's choice, notes and replaced rows save under one status;
  // it is acknowledged beside whichever of them saved last.
  const [writer, setWriter] = useState<'state' | 'parts'>('parts');
  const selectionStatus = actions.statusFor(selection._id);
  const selectionView = useSelectionRow(selection._id);
  const { replaces, adds } = listFeatureRows({ group, option, featureNames });
  const relations = listFeatureRelations(group, option);
  const skillChanges = option.application
    ? describeSkillChanges(option.application)
    : [];
  return (
    <div className="border-foreground/10 flex flex-col gap-2 border-t pt-2">
      <ArchetypeSelectionState
        subject={`${name} for ${group.name}`}
        selection={selection}
        actions={actions}
        feedbackStatus={writer === 'state' ? selectionStatus : idle}
        onWrite={() => setWriter('state')}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={action}
          aria-describedby={reasonId}
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return;
            void actions.setSelected({
              classEntryId: group.classEntryId,
              catalogEntryId: option.definition._id,
              selected: !selection.active,
            });
          }}
        >
          {selection.active ? 'Deactivate' : 'Activate'}{' '}
          <span className="sr-only">
            {name} for {group.name}
          </span>
        </Button>
      </ArchetypeSelectionState>
      <SelectionChecks
        selection={selectionView}
        warnings={listGrantEntryWarnings({
          warnings,
          rowId: selection._id,
        }).filter((warning) => !castingChecks.has(warning.check))}
        warningController={warningController}
      />
      {relations.length > 0 ? (
        <ul
          aria-label={`${name} shared features`}
          className="flex flex-col gap-0.5"
        >
          {relations.map((relation) => (
            <li
              key={relation.key}
              className={cn(
                'flex items-start gap-1.5 text-xs [overflow-wrap:anywhere]',
                relation.kind === 'conflict'
                  ? 'text-amber-300'
                  : 'text-muted-foreground',
              )}
            >
              {relation.kind === 'conflict' ? (
                <TriangleAlert
                  aria-hidden
                  className="mt-px size-3.5 shrink-0"
                />
              ) : (
                <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
              )}
              <span className="min-w-0">{describeRelation(relation)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <ArchetypeFeatureList
          title="Replaces"
          rows={replaces}
          emptyText="No replaced features listed."
        />
        <ArchetypeFeatureList
          title="Adds"
          rows={adds}
          emptyText="No added features listed."
        />
      </div>
      {selection.active ? (
        <CastingLine group={group} option={option} selection={selection} />
      ) : null}
      {replacedRows.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className={fieldLabel}>Replaced class features</p>
          <GrantEntryList
            rows={replacedRows}
            className="border-foreground/10 border-y"
            {...rowProps}
          />
        </div>
      ) : null}
      {skillChanges.map((line) => (
        <p key={line} className="text-xs [overflow-wrap:anywhere]">
          {line}
        </p>
      ))}
      <ArchetypePartEditor
        group={group}
        option={option}
        selection={selection}
        featureNames={featureNames}
        actions={actions}
        feedbackStatus={writer === 'parts' ? selectionStatus : idle}
        onWrite={() => setWriter('parts')}
      />
    </div>
  );
}
