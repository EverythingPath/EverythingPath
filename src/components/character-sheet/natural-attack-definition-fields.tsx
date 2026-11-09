'use client';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { naturalAttackRoles } from '~/lib/character-sheet-attack-types';
import { createNaturalAttackWeapon } from '~/lib/character-sheet-natural-attacks';
import { cn } from '~/lib/utils';
import { weaponCard } from './attack-routine-card-style';
import { describeWeapon } from './attack-routine-view-model';
import { fieldLabel } from './sheet-parts';
import type { useNaturalAttackForm } from './use-natural-attack-form';
const roleLabels = { primary: 'Primary', secondary: 'Secondary' } as const;

export function NaturalAttackDefinitionFields({
  editor,
  headingId,
  typeLabelId,
  roleLabelId,
  reasonId,
  isReadOnly,
}: {
  editor: ReturnType<typeof useNaturalAttackForm>;
  headingId: string;
  typeLabelId: string;
  roleLabelId: string;
  reasonId?: string;
  isReadOnly: boolean;
}) {
  const { form } = editor;
  return (
    <>
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem className="gap-1">
            <span id={typeLabelId} className={fieldLabel}>
              Natural attack type
            </span>
            <FormControl>
              <RadioGroup
                aria-labelledby={typeLabelId}
                name={field.name}
                value={field.value}
                disabled={isReadOnly}
                onBlur={field.onBlur}
                onValueChange={(next) => {
                  const choice = editor.typeChoices.find(
                    (candidate) => candidate.type === next,
                  );
                  if (choice) editor.selectType(choice.type);
                }}
                className="grid-cols-2 gap-1 sm:grid-cols-3"
              >
                {editor.typeChoices.map((choice) => (
                  <RadioGroupItem
                    key={choice.type}
                    value={choice.type}
                    aria-label={choice.name}
                    aria-describedby={cn(
                      `${typeLabelId}-${choice.type}`,
                      reasonId,
                    )}
                    className={weaponCard}
                  >
                    <span className="min-w-0 font-sans text-sm leading-tight [overflow-wrap:anywhere]">
                      {choice.name}
                    </span>
                    <span
                      id={`${typeLabelId}-${choice.type}`}
                      className="text-muted-foreground text-xs [overflow-wrap:anywhere]"
                    >
                      {describeWeapon(createNaturalAttackWeapon(choice.type))}
                    </span>
                  </RadioGroupItem>
                ))}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <FormItem className="min-w-0 flex-1 basis-40 gap-1">
              <FormLabel className={fieldLabel}>Attack name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  autoComplete="off"
                  disabled={isReadOnly}
                  aria-describedby={cn(
                    fieldState.error && `${headingId}-name-error`,
                    reasonId,
                  )}
                  className="h-11 font-sans md:h-9"
                />
              </FormControl>
              <FormMessage
                id={`${headingId}-name-error`}
                role={fieldState.error ? 'alert' : undefined}
                className={fieldState.error ? undefined : 'hidden'}
              />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dice"
          render={({ field, fieldState }) => (
            <FormItem className="w-36 gap-1">
              <FormLabel className={fieldLabel}>Medium damage</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  autoComplete="off"
                  disabled={isReadOnly}
                  aria-describedby={cn(
                    `${headingId}-dice-hint`,
                    fieldState.error && `${headingId}-dice-error`,
                    reasonId,
                  )}
                  className="h-11 font-mono md:h-9"
                />
              </FormControl>
              <FormDescription
                id={`${headingId}-dice-hint`}
                className="text-xs"
              >
                Damage changes with size.
              </FormDescription>
              <FormMessage
                id={`${headingId}-dice-error`}
                role={fieldState.error ? 'alert' : undefined}
                className={fieldState.error ? undefined : 'hidden'}
              />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem className="gap-1">
            <span id={roleLabelId} className={fieldLabel}>
              Primary or secondary
            </span>
            <FormControl>
              <RadioGroup
                aria-labelledby={roleLabelId}
                name={field.name}
                value={field.value}
                disabled={isReadOnly}
                onBlur={field.onBlur}
                onValueChange={(next) =>
                  editor.selectRole(
                    next === 'primary' ? 'primary' : 'secondary',
                  )
                }
                className="grid-cols-2 gap-1"
              >
                {naturalAttackRoles.map((role) => (
                  <RadioGroupItem
                    key={role}
                    value={role}
                    aria-describedby={reasonId}
                  >
                    {roleLabels[role]}
                  </RadioGroupItem>
                ))}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );
}
