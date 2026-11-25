'use client';
import { useWatch } from 'react-hook-form';
import { animalCompanionAllowedSkills } from '~/lib/catalog/representative-animal-companions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { skillDefinitions, skillKeyPrefix } from '~/lib/character-sheet-skills';
import { CompanionProgressionNumberField } from './companion-progression-number-field';
import { fieldLabel } from './sheet-parts';
import { useProgressionChoiceForm } from './use-companion-progression-form';

const skills = skillDefinitions.map((skill) => ({
  key: skill.key.slice(skillKeyPrefix.length),
  name: skill.name,
}));

/**
 * Ranks skill by skill: the base list always (the Animal Skills unless the
 * editor names its own), any other skill once it has ranks or is added. An
 * empty field records no ranks for that skill.
 */
export function CompanionProgressionRankFields({
  disabled,
  baseSkills = animalCompanionAllowedSkills,
}: {
  disabled: boolean;
  /** Short skill keys always shown. */
  baseSkills?: readonly string[];
}) {
  const form = useProgressionChoiceForm();
  const ranks = useWatch({ control: form.control, name: 'ranks' });
  const shown = skills.filter(
    (skill) => baseSkills.includes(skill.key) || skill.key in ranks,
  );
  const addable = skills.filter((skill) => !shown.includes(skill));
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={fieldLabel}>Skill ranks</legend>
      <p className="text-muted-foreground text-xs">
        Leave a skill empty for no ranks.
      </p>
      <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((skill) => (
          <CompanionProgressionNumberField
            key={skill.key}
            name={`ranks.${skill.key}`}
            label={`${skill.name} ranks`}
            visibleLabel={skill.name}
            disabled={disabled}
          />
        ))}
      </div>
      {addable.length > 0 ? (
        <Select
          value=""
          disabled={disabled}
          onValueChange={(key) =>
            form.setValue(`ranks.${key}`, '', { shouldDirty: true })
          }
        >
          <SelectTrigger
            aria-label="Add another skill"
            className="h-11 w-full max-w-64 text-sm md:h-8"
          >
            <SelectValue placeholder="Add another skill" />
          </SelectTrigger>
          <SelectContent>
            {addable.map((skill) => (
              <SelectItem key={skill.key} value={skill.key}>
                {skill.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </fieldset>
  );
}
