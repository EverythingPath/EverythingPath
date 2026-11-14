'use client';
import { eidolonChosenClassSkillCount } from '~/lib/catalog/representative-eidolons';
import { Checkbox } from '~/components/ui/checkbox';
import { FormControl, FormField, FormItem } from '~/components/ui/form';
import { fieldLabel } from './sheet-parts';
import {
  eidolonClassSkillChoices,
  type EidolonProgressionForm,
} from './use-eidolon-progression-form';

/**
 * The additional class skills the summoner chooses at 1st level, ticked
 * from every skill the eidolon does not already have. Choosing more than
 * the published count is advisory: the sheet warns and keeps them.
 */
export function EidolonClassSkillFields({
  form,
  disabled,
}: {
  form: EidolonProgressionForm;
  disabled: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="classSkills"
      render={({ field }) => (
        <FormItem className="gap-1.5">
          <fieldset className="flex flex-col gap-1.5">
            <legend className={fieldLabel}>Additional class skills</legend>
            <p className="text-muted-foreground text-xs">
              The summoner chooses {eidolonChosenClassSkillCount}.
            </p>
            <FormControl>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                {eidolonClassSkillChoices.map((skill) => (
                  <li key={skill.key}>
                    <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-8">
                      <Checkbox
                        name={field.name}
                        value={skill.key}
                        checked={field.value.includes(skill.key)}
                        disabled={disabled}
                        onBlur={field.onBlur}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, skill.key]
                              : field.value.filter((key) => key !== skill.key),
                          )
                        }
                      />
                      {skill.name}
                    </label>
                  </li>
                ))}
              </ul>
            </FormControl>
          </fieldset>
        </FormItem>
      )}
    />
  );
}
