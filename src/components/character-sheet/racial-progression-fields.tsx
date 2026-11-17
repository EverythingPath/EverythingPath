'use client';
import { useWatch } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { RaceStatisticsView } from './character-sheet-races-view-model';
import { InlineWarnings } from './inline-warning';
import { RacialClassSkillsField } from './racial-class-skills-field';
import {
  babOptions,
  RacialProgressionChoice,
  saveOptions,
} from './racial-progression-choice';
import { RacialStatisticsTextField } from './racial-statistics-text-field';
import { action, fieldLabel } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import type { useRacialStatisticsForm } from './use-racial-statistics-form';

type Controller = ReturnType<typeof useCharacterSheet>;
type Editor = ReturnType<typeof useRacialStatisticsForm>;

const fieldGrid =
  'grid grid-cols-2 items-start gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4';

/**
 * How the racial Hit Dice advance: a creature type fills in a draft of its
 * progression, and every value it filled stays the player's to change,
 * the type's name included. Clearing leaves the race without one; the
 * sheet then explains what it cannot calculate, right here.
 */
export function RacialProgressionFields({
  editor,
  creatureTypeOptions,
  warnings,
  warningController,
  disabled,
  reasonId,
}: {
  editor: Editor;
  creatureTypeOptions: RaceStatisticsView['creatureTypeOptions'];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  disabled: boolean;
  reasonId: string | undefined;
}) {
  const progression = useWatch({
    control: editor.form.control,
    name: 'progression',
  });
  const typeName = progression?.creatureType.trim() ?? '';
  const seeded =
    creatureTypeOptions.find((option) => option.label === typeName)?.value ?? '';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <span aria-hidden className={fieldLabel}>
            Creature type
          </span>
          <Select
            value={seeded}
            disabled={disabled}
            onValueChange={(value) => {
              if (value) editor.chooseCreatureType(value);
            }}
          >
            <SelectTrigger
              aria-label="Creature type"
              className="h-10 w-56 max-w-full rounded-none font-mono text-sm md:h-8 md:py-1"
            >
              <SelectValue
                placeholder={
                  progression ? 'Custom type' : 'Choose a creature type'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {creatureTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {progression ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            aria-describedby={reasonId}
            disabled={disabled}
            onClick={editor.clearProgression}
          >
            Clear progression
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {progression
          ? 'Choosing another creature type replaces the progression below.'
          : 'Choose a creature type to fill in the progression; every value stays editable.'}
      </p>
      <InlineWarnings warnings={warnings} controller={warningController} />
      {progression ? (
        <div className={fieldGrid}>
          <RacialStatisticsTextField
            form={editor.form}
            name="progression.creatureType"
            label="Creature type name"
            placeholder="Creature type"
            disabled={disabled}
          />
          <RacialStatisticsTextField
            form={editor.form}
            name="progression.hitDie"
            label="Hit Die"
            prefix="d"
            isNumeric
            disabled={disabled}
          />
          <RacialStatisticsTextField
            form={editor.form}
            name="progression.skillRanksPerHitDie"
            label="Skill ranks per Hit Die"
            isNumeric
            disabled={disabled}
          />
          <RacialProgressionChoice
            form={editor.form}
            name="progression.bab"
            label="Base attack progression"
            options={babOptions}
            disabled={disabled}
          />
          <RacialProgressionChoice
            form={editor.form}
            name="progression.saves.fort"
            label="Fortitude progression"
            options={saveOptions}
            disabled={disabled}
          />
          <RacialProgressionChoice
            form={editor.form}
            name="progression.saves.ref"
            label="Reflex progression"
            options={saveOptions}
            disabled={disabled}
          />
          <RacialProgressionChoice
            form={editor.form}
            name="progression.saves.will"
            label="Will progression"
            options={saveOptions}
            disabled={disabled}
          />
          <div className="col-span-full">
            <RacialClassSkillsField form={editor.form} disabled={disabled} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
