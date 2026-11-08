'use client';
import { Plus, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { skillDefinitions, skillKeyPrefix } from '~/lib/character-sheet-skills';
import { racialInput } from './racial-statistics-text-field';
import { action, fieldLabel } from './sheet-parts';
import type { useRacialStatisticsForm } from './use-racial-statistics-form';

type Editor = ReturnType<typeof useRacialStatisticsForm>;

/** The skill ranks bought with the racial Hit Dice, skill by skill. */
export function RacialSkillRankRows({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled: boolean;
}) {
  const { form, ranks } = editor;
  return (
    <div className="flex flex-col gap-1.5">
      <p className={fieldLabel}>Racial skill ranks</p>
      {ranks.fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No skill ranks recorded for the racial Hit Dice.
        </p>
      ) : null}
      {ranks.fields.map((row, index) => (
        <div
          key={row.id}
          className="flex flex-wrap items-start gap-x-2 gap-y-1"
        >
          <FormField
            control={form.control}
            name={`ranks.${index}.skill`}
            render={({ field, fieldState }) => (
              <FormItem className="min-w-40 flex-1 gap-1">
                <FormLabel className="sr-only">Skill {index + 1}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger
                      aria-label={`Skill ${index + 1}`}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      className={racialInput}
                    >
                      <SelectValue placeholder="Skill" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {skillDefinitions.map((skill) => (
                      <SelectItem
                        key={skill.key}
                        value={skill.key.slice(skillKeyPrefix.length)}
                      >
                        {skill.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage
                  role={fieldState.error ? 'alert' : undefined}
                  className="text-xs"
                />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`ranks.${index}.ranks`}
            render={({ field, fieldState }) => (
              <FormItem className="w-24 gap-1">
                <FormLabel className="sr-only">
                  Ranks for skill {index + 1}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={disabled}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ranks"
                    className={`${racialInput} text-center`}
                  />
                </FormControl>
                <FormMessage
                  role={fieldState.error ? 'alert' : undefined}
                  className="text-xs"
                />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 md:size-8"
            disabled={disabled}
            onClick={() => ranks.remove(index)}
          >
            <X aria-hidden className="size-4" />
            <span className="sr-only">Remove skill {index + 1}</span>
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={action}
          disabled={disabled}
          onClick={() => ranks.append({ skill: '', ranks: '' })}
        >
          <Plus aria-hidden className="size-4" />
          Add skill
        </Button>
      </div>
    </div>
  );
}
