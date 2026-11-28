'use client';
import type { Id } from '@convex/_generated/dataModel';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Checkbox } from '~/components/ui/checkbox';
import { InlineWarnings } from './inline-warning';
import { fieldLabel, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useFavoredClassesEditor } from './use-favored-classes-editor';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;

// A card that lifts on hover (not under reduced motion) and marks itself checked.
const favoredCard =
  'border-foreground/40 has-checked:border-primary has-checked:text-primary has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-2 border px-2.5 font-mono text-sm transition-[transform,box-shadow] has-checked:shadow-xs has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 md:min-h-8 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm';

/**
 * Which classes are favored (approved prototype's Favored class field), as
 * card-like toggles over the sheet's classes. A sheet may have more than
 * one; none is chosen until a player chooses. Each row's favored class
 * bonus is then asked for on the rows of those classes. The rules about
 * the set itself (how many, a prestige class) warn under the cards.
 */
export function FavoredClassesEditor({
  classChoices,
  favoredClassIds,
  warnings,
  warningController,
  save,
}: {
  classChoices: ReadySheet['classChoices'];
  favoredClassIds: readonly Id<'catalogEntry'>[];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  save: Controller['saveFavoredClasses'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useFavoredClassesEditor({ favoredClassIds, save });
  const isDisabled = editor.isSaving || maintenance.readOnly;
  return (
    <div className="flex flex-col gap-1">
      <p className={fieldLabel}>Favored class</p>
      {classChoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No classes available.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {classChoices.map((classChoice) => {
            const isFavored = favoredClassIds.includes(classChoice._id);
            return (
              <label key={classChoice._id} className={favoredCard}>
                <Checkbox
                  checked={isFavored}
                  disabled={isDisabled}
                  aria-label={`${classChoice.name} favored`}
                  onCheckedChange={(checked) => {
                    if (isDisabled) return;
                    void editor.toggle(classChoice._id, checked);
                  }}
                />
                {classChoice.name}
              </label>
            );
          })}
        </div>
      )}
      <InlineWarnings
        warnings={warnings.filter(
          (warning) => warning.target.kind === 'favoredClasses',
        )}
        controller={warningController}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SaveFeedback status={editor.status} savedText="Favored class saved." />
        <MaintenanceReason notice={maintenance} className="text-xs" />
      </div>
    </div>
  );
}
