'use client';
import { useId } from 'react';
import { Form } from '~/components/ui/form';
import { cn } from '~/lib/utils';
import { RowCatalogDefinition } from './row-catalog-definition';
import { ClassLevelActions } from './class-level-actions';
import { CastingAdvancesCell } from './class-level-casting-advances';
import {
  AbilityIncreaseCell,
  ChoicesFeedback,
  ClassChoiceCell,
  FavoredClassBonusCell,
} from './class-level-choices';
import { ClassLevelHitPoints } from './class-level-hit-points';
import { ClassRulesControl } from './class-rules-control';
import { PrerequisiteGroups } from './prerequisite-groups';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useClassLevelChoicesForm } from './use-sheet-forms';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;
type LevelRow = ReadySheet['levels'][number];
type LevelMetadata = ReadySheet['calculated']['classLevels'][number];
type Classes = Controller['classes'];

/** The row's DOM anchor: found again after an append or a deletion. */
export function getLevelAnchorId(entryId: string) {
  return `sheet-level-${entryId}`;
}

/** Level · Class · Hit points · Favored · Ability · actions, from tablet width. */
export const levelColumns =
  'md:grid-cols-[4.5rem_minmax(8rem,10rem)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] md:gap-x-3';

const cell = 'col-span-2 md:col-span-1 md:row-start-1';
const actionsCell =
  'col-start-2 row-start-1 flex items-center justify-end md:col-start-6';

function findClass(classes: Classes, id: string | null) {
  const choice = classes.choices.find((item) => item.classEntryId === id);
  if (!choice) return null;
  return {
    name: choice.name,
    hitDie: choice.hitDie,
  };
}

/** The class's own name for its rules: the original version's, where offered. */
export function findFamilyName(
  classes: Classes,
  row: LevelRow,
  fallback: string,
) {
  return (
    classes
      .rulesChoicesFor(row._id)
      .find((choice) => choice.version === 'original')?.name ?? fallback
  );
}

/**
 * One Class Level, mounted once per stable entry and kept through reorders
 * so its drafts, focus and field errors travel with it. Its label is its
 * current position. The class, favored class bonus and ability increase are
 * chosen in place and saved as chosen; hit points are typed and saved with
 * their own button. Each warning sits by the field it is about; the level's
 * rank allocation is spent and warned about in the Skills block, and its
 * class's weapon proficiency choice is made in the Proficiencies block. A
 * Prestige Class's first level shows its entry prerequisites now and at
 * that level, apart from the level's own order. A class with more than one
 * version or Catalog Copy in the catalogs offers the rules switch for all
 * its levels under the class, on its first level only. A Prestige Class
 * Level that advances existing spellcasting chooses the class for each
 * advance under its other choices.
 */
export function ClassLevelRow({
  row,
  index,
  count,
  metadata,
  classes,
  warnings,
  sheetWarnings,
  warningController,
  saveHitPoints,
  saveClassLevel,
  isChangingLevels,
  moveLevel,
  insertLevel,
  onDelete,
}: {
  row: LevelRow;
  index: number;
  count: number;
  metadata: LevelMetadata | undefined;
  classes: Classes;
  /** The warnings aimed at this level. */
  warnings: SheetWarningView[];
  /** Every warning on the sheet, which name those a version switch touches. */
  sheetWarnings: SheetWarningView[];
  warningController: Controller['warnings'];
  saveHitPoints: Controller['saveHitPoints'];
  saveClassLevel: Controller['saveClassLevel'];
  isChangingLevels: boolean;
  moveLevel: Controller['levels']['move'];
  insertLevel: Controller['levels']['insert'];
  onDelete: () => void;
}) {
  const level = index + 1;
  const headingId = useId();
  const chosenClass = findClass(classes, row.state.classEntryId);
  const familyName = chosenClass
    ? findFamilyName(classes, row, chosenClass.name)
    : null;
  const isFirstOfClass = classes.firstLevelOfClass(row._id) === row._id;
  const choices = useClassLevelChoicesForm({
    classEntryId: row.state.classEntryId,
    operationId: classes.lastOperationId,
    isClassVersionChange: classes.isVersionChange,
    classChoices: classes.choices.map((choice) => choice.definition),
    favoredClassBonus: row.state.favoredClassBonus,
    abilityIncrease: row.state.abilityIncrease,
    save: async (changes) => {
      await saveClassLevel(row._id, changes);
    },
  });
  const cellProps = { level, editor: choices, warnings, warningController };
  return (
    <li
      id={getLevelAnchorId(row._id)}
      aria-labelledby={headingId}
      className={cn(
        'border-foreground/20 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 border p-2 md:items-start',
        levelColumns,
      )}
    >
      <h3
        id={headingId}
        tabIndex={-1}
        className="col-start-1 row-start-1 self-center font-mono text-base md:py-1.5"
      >
        Level {level}
      </h3>
      <Form {...choices.form}>
        <ClassChoiceCell
          {...cellProps}
          classes={classes}
          entryId={row._id}
          versionControl={
            chosenClass && familyName && isFirstOfClass ? (
              <ClassRulesControl
                entryId={row._id}
                className={familyName}
                classes={classes}
                warnings={sheetWarnings}
                disabled={isChangingLevels}
              />
            ) : null
          }
          classLabel={
            chosenClass && metadata?.classLevel
              ? `${chosenClass.name} ${metadata.classLevel}`
              : null
          }
          className={cn(cell, 'md:col-start-2')}
        />
        <ClassLevelHitPoints
          level={level}
          hpGained={row.state.hpGained}
          hitDie={chosenClass?.hitDie ?? null}
          warnings={warnings}
          warningController={warningController}
          save={(hpGained) => saveHitPoints(row._id, hpGained)}
          className={cn(cell, 'md:col-start-3')}
        />
        <FavoredClassBonusCell
          {...cellProps}
          className={cn(cell, 'md:col-start-4')}
        />
        <AbilityIncreaseCell
          {...cellProps}
          isDue={metadata?.abilityIncreaseDue ?? false}
          className={cn(cell, 'md:col-start-5')}
        />
        <ClassLevelActions
          level={level}
          className={chosenClass?.name ?? 'Unspecified'}
          headingId={headingId}
          isFirst={index === 0}
          isLast={index === count - 1}
          isBusy={isChangingLevels}
          cellClassName={actionsCell}
          onInsertBefore={() => void insertLevel(level)}
          onMove={(position) => void moveLevel(row._id, position)}
          onDelete={onDelete}
        />
        <ChoicesFeedback
          level={level}
          editor={choices}
          className="col-span-2 md:col-span-6"
        />
      </Form>
      <CastingAdvancesCell
        entryId={row._id}
        classes={classes}
        warningController={warningController}
        className="col-span-2 md:col-span-6"
      />
      <PrerequisiteGroups
        groups={row.prerequisites}
        warningController={warningController}
        className="col-span-2 md:col-span-6"
      />
      <RowCatalogDefinition
        rowId={row._id}
        target={{ kind: 'entry', entryId: row._id }}
        className="col-span-2 mt-0 min-w-0 md:col-span-6"
      />
    </li>
  );
}
