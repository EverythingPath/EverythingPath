'use client';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { FormField, FormItem, FormMessage } from '~/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { skillDefinitions, skillKeyPrefix } from '~/lib/character-sheet-skills';
import { chip, fieldLabel } from './sheet-parts';
import type { useRacialStatisticsForm } from './use-racial-statistics-form';

type Form = ReturnType<typeof useRacialStatisticsForm>['form'];

// Class skills are kept as the compact skill keys ("acr"); the sheet's own
// skill definitions name them. A key the sheet does not know reads as itself.
const skillOptions = skillDefinitions.map((skill) => ({
  value: skill.key.slice(skillKeyPrefix.length),
  label: skill.name,
}));
function skillLabel(key: string) {
  return skillOptions.find((option) => option.value === key)?.label ?? key;
}

/**
 * The racial Hit Dice's class skills as removable chips, with a chooser for
 * any skill not yet among them.
 */
export function RacialClassSkillsField({
  form,
  disabled,
}: {
  form: Form;
  disabled: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="progression.classSkills"
      render={({ field, fieldState }) => {
        const skills: string[] = field.value;
        const remaining = skillOptions.filter(
          (option) => !skills.includes(option.value),
        );
        return (
          <FormItem className="min-w-0 content-start gap-1">
            <p className={fieldLabel}>Class skills</p>
            {skills.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No class skills for the racial Hit Dice.
              </p>
            ) : (
              <ul aria-label="Class skills" className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <li key={skill} className={`${chip} gap-0.5 pr-0`}>
                    {skillLabel(skill)}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 md:size-6"
                      disabled={disabled}
                      onClick={() =>
                        field.onChange(skills.filter((key) => key !== skill))
                      }
                    >
                      <X aria-hidden className="size-3.5" />
                      <span className="sr-only">
                        Remove class skill {skillLabel(skill)}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {remaining.length > 0 ? (
              <Select
                value=""
                disabled={disabled}
                onValueChange={(skill) => {
                  if (skill) field.onChange([...skills, skill]);
                }}
              >
                <SelectTrigger
                  aria-label="Add class skill"
                  className="h-10 w-full rounded-none font-mono text-sm sm:w-56 md:h-8 md:py-1"
                >
                  <SelectValue placeholder="Add class skill" />
                </SelectTrigger>
                <SelectContent>
                  {remaining.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <FormMessage
              role={fieldState.error ? 'alert' : undefined}
              className="text-xs"
            />
          </FormItem>
        );
      }}
    />
  );
}
