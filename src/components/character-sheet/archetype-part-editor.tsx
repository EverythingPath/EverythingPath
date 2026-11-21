'use client';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  ArchetypePartChoice,
  type PartChoiceRow,
} from './archetype-part-choice';
import {
  findFeatureName,
  findFeatureOption,
  hasOwnReplacements,
  isFeaturePart,
  listEffectiveReplacements,
  type ArchetypeClassView,
  type ArchetypeOptionView,
  type ArchetypeSelection,
  type ArchetypesController,
  type FeatureNames,
  type ReplacementChoice,
  type ReplacementScope,
} from './character-sheet-archetypes-view-model';
import type { SaveStatus } from './save-status';
import { action, SaveFeedback } from './sheet-parts';

type Chosen = Map<string, ReplacementScope | undefined>;
type EditorRow = PartChoiceRow & { choice: ReplacementChoice };

const keyOf = (row: { classLevel: number; catalogEntryId: string }) =>
  `${row.classLevel}:${row.catalogEntryId}`;

/** The class's schedule, then any chosen row the schedule lacks. */
function listEditorRows({
  group,
  option,
  featureNames,
}: {
  group: ArchetypeClassView;
  option: ArchetypeOptionView;
  featureNames: FeatureNames;
}): EditorRow[] {
  const currentLevel = group.calculated?.classLevel ?? 0;
  const scheduled = group.featureOptions.map((feature) => ({
    classLevel: feature.classLevel,
    catalogEntryId: feature.definition._id,
  }));
  const scheduledKeys = new Set(scheduled.map(keyOf));
  const unmatched = listEffectiveReplacements(option).filter(
    (row) => !scheduledKeys.has(keyOf(row)),
  );
  return [...scheduled, ...unmatched].map((choice) => ({
    key: keyOf(choice),
    classLevel: choice.classLevel,
    name: findFeatureName({
      featureOptions: group.featureOptions,
      featureNames,
      catalogEntryId: choice.catalogEntryId,
    }),
    isLater: choice.classLevel > currentLevel,
    isPart: isFeaturePart(
      findFeatureOption(group.featureOptions, choice.catalogEntryId),
    ),
    isUnmatched: !scheduledKeys.has(keyOf(choice)),
    choice,
  }));
}

function readChosen(option: ArchetypeOptionView): Chosen {
  return new Map(
    listEffectiveReplacements(option).map((row) => [keyOf(row), row.scope]),
  );
}

/**
 * The exact class feature rows an Archetype replaces, behind a disclosure:
 * every row of the class's schedule by class level, later levels marked,
 * each part of a larger feature replaced whole or on its own. Save sends
 * the whole set (none is a deliberate choice); "Use catalog replacements"
 * returns to the Archetype's own rows. A conflict never blocks the save.
 */
export function ArchetypePartEditor({
  group,
  option,
  selection,
  featureNames,
  actions,
  feedbackStatus,
  onWrite,
}: {
  group: ArchetypeClassView;
  option: ArchetypeOptionView;
  selection: ArchetypeSelection;
  featureNames: FeatureNames;
  actions: ArchetypesController;
  /** The Selection's save status while its latest save came from here. */
  feedbackStatus: SaveStatus;
  onWrite: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const archetypeName = option.definition.name;
  // A save from anywhere, or a reset, replaces unsaved picks in place.
  const saved = JSON.stringify([
    hasOwnReplacements(option),
    listEffectiveReplacements(option),
  ]);
  const [chosenFrom, setChosenFrom] = useState(saved);
  const [chosen, setChosen] = useState<Chosen>(() => readChosen(option));
  if (chosenFrom !== saved) {
    setChosenFrom(saved);
    setChosen(readChosen(option));
  }
  const isSaving = actions.statusFor(selection._id).kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;
  const rows = listEditorRows({ group, option, featureNames });

  function choose(key: string, scope: ReplacementScope | undefined | null) {
    setChosen((current) => {
      const next = new Map(current);
      if (scope === null) next.delete(key);
      else next.set(key, scope);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          action,
          'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start font-mono text-xs',
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')}
        />
        Choose replaced features{' '}
        <span className="sr-only">
          for {archetypeName}, {group.name}
        </span>
      </button>
      <div id={panelId}>
        {isOpen ? (
          <fieldset className="border-foreground/20 flex min-w-0 flex-col gap-1.5 border p-2">
            <legend className="px-1 text-xs text-sky-300">
              {group.name} features {archetypeName} replaces
            </legend>
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No class features listed for {group.name}.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {rows.map((row) => (
                  <ArchetypePartChoice
                    key={row.key}
                    row={row}
                    archetypeName={archetypeName}
                    baseClassName={group.name}
                    isChecked={chosen.has(row.key)}
                    scope={chosen.get(row.key)}
                    isDisabled={isDisabled}
                    onToggle={(isChecked) =>
                      choose(
                        row.key,
                        isChecked ? (row.isPart ? 'part' : undefined) : null,
                      )
                    }
                    onScopeChange={(scope) => choose(row.key, scope)}
                  />
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={action}
                aria-describedby={reasonId}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  onWrite();
                  void actions.setPartChoices(
                    selection._id,
                    rows.flatMap((row) =>
                      chosen.has(row.key)
                        ? [toChoice(row.choice, chosen.get(row.key))]
                        : [],
                    ),
                  );
                }}
              >
                {feedbackStatus.kind === 'saving'
                  ? 'Saving…'
                  : 'Save replaced features'}{' '}
                <span className="sr-only">for {archetypeName}</span>
              </Button>
              {hasOwnReplacements(option) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(action, 'text-muted-foreground')}
                  aria-describedby={reasonId}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onWrite();
                    void actions.setPartChoices(selection._id, null);
                  }}
                >
                  Use catalog replacements{' '}
                  <span className="sr-only">for {archetypeName}</span>
                </Button>
              ) : null}
            </div>
          </fieldset>
        ) : null}
      </div>
      <SaveFeedback
        status={feedbackStatus}
        savedText="Replaced features saved."
        savingText="Saving replaced features…"
        shouldHideWhenIdle
      />
    </div>
  );
}

function toChoice(
  choice: ReplacementChoice,
  scope: ReplacementScope | undefined,
): ReplacementChoice {
  const row = {
    classLevel: choice.classLevel,
    catalogEntryId: choice.catalogEntryId,
  };
  return scope === undefined ? row : { ...row, scope };
}
