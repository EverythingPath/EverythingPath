'use client';
import { useId } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { proficiencyCategories } from '~/lib/character-sheet-proficiencies';
import { action, fieldLabel, SaveFeedback } from './sheet-parts';
import { proficiencyLabel } from './use-character-sheet-equipment';
import {
  useManualProficiencyForm,
  type ManualProficiencyChange,
} from './use-manual-proficiency-form';

type Editor = ReturnType<typeof useManualProficiencyForm>;
type Control = Editor['form']['control'];
type CardOption = { value: string; label: string };

const kindOptions: CardOption[] = [
  { value: 'category', label: 'Category' },
  { value: 'baseType', label: 'Weapon name' },
  { value: 'group', label: 'Weapon group' },
];
const dispositionOptions: CardOption[] = [
  { value: 'added', label: 'Add' },
  { value: 'removed', label: 'Remove' },
];
const categoryOptions: CardOption[] = proficiencyCategories.map((category) => ({
  value: category,
  label: proficiencyLabel({ category }),
}));

// Playing-card choices with the native radio kept for the keyboard.
function CardChoice({
  control,
  name,
  label,
  options,
  isDisabled,
  className,
}: {
  control: Control;
  name: 'kind' | 'category' | 'disposition';
  label: string;
  options: CardOption[];
  isDisabled: boolean;
  className: string;
}) {
  const labelId = useId();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <span id={labelId} className={fieldLabel}>
            {label}
          </span>
          <RadioGroup
            aria-labelledby={labelId}
            name={field.name}
            value={field.value}
            disabled={isDisabled}
            onBlur={field.onBlur}
            onValueChange={field.onChange}
            className={className}
          >
            {options.map((option) => (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                className="px-2 text-left"
              >
                {option.label}
              </RadioGroupItem>
            ))}
          </RadioGroup>
        </div>
      )}
    />
  );
}

function WeaponFields({
  editor,
  isDisabled,
}: {
  editor: Editor;
  isDisabled: boolean;
}) {
  const kind = editor.form.watch('kind');
  if (kind === 'category')
    return (
      <CardChoice
        control={editor.form.control}
        name="category"
        label="Proficiency"
        options={categoryOptions}
        isDisabled={isDisabled}
        className="grid-cols-2 sm:grid-cols-4"
      />
    );
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
      <FormField
        control={editor.form.control}
        name="name"
        render={({ field, fieldState }) => (
          <FormItem className="min-w-0 gap-1">
            <FormLabel className={fieldLabel}>
              {kind === 'baseType' ? 'Weapon name' : 'Weapon group'}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={isDisabled}
                type="text"
                autoComplete="off"
                className="h-11 w-full max-w-64 md:h-8 md:w-56"
              />
            </FormControl>
            <FormMessage
              role={fieldState.error ? 'alert' : undefined}
              className="max-w-64"
            />
          </FormItem>
        )}
      />
      {kind === 'baseType' ? (
        <FormField
          control={editor.form.control}
          name="asMartial"
          render={({ field }) => (
            <FormItem className="gap-1">
              <span aria-hidden className={fieldLabel}>
                &nbsp;
              </span>
              <FormLabel className="min-h-11 cursor-pointer gap-2 font-mono text-sm font-normal md:min-h-8">
                <FormControl>
                  <Checkbox
                    name={field.name}
                    ref={field.ref}
                    checked={field.value}
                    disabled={isDisabled}
                    onBlur={field.onBlur}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <span>Treat as martial</span>
              </FormLabel>
              <FormDescription className="max-w-64 text-xs">
                Weapon familiarity: counts only with Martial weapons.
              </FormDescription>
            </FormItem>
          )}
        />
      ) : null}
    </div>
  );
}

/**
 * A manual change to the Character's Proficiencies, chosen from cards: a
 * category, a weapon by name (optionally treated as martial) or a weapon
 * group, added or removed. A removal records the table's decision and
 * leaves the source that grants it untouched. The editor stays open with its
 * acknowledgement after a save.
 */
export function ManualProficiencyEditor({
  save,
  onClose,
  disposition = 'added',
}: {
  save: (change: ManualProficiencyChange) => Promise<unknown>;
  onClose: () => void;
  /** Which way the form starts: Add proficiency or Remove proficiency. */
  disposition?: ManualProficiencyChange['disposition'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useManualProficiencyForm({
    save,
    startingDisposition: disposition,
  });
  const isDirty = editor.form.formState.isDirty;
  const isSaving = editor.status.kind === 'saving';
  const isDisabled = maintenance.readOnly;
  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label={
          disposition === 'removed' ? 'Remove proficiency' : 'Add proficiency'
        }
        className="border-foreground/20 w-full space-y-3 border p-3"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          onClose();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled || isSaving) return;
          void editor.save();
        }}
      >
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <CardChoice
            control={editor.form.control}
            name="disposition"
            label="Change"
            options={dispositionOptions}
            isDisabled={isDisabled}
            className="grid-cols-2"
          />
          <CardChoice
            control={editor.form.control}
            name="kind"
            label="Kind"
            options={kindOptions}
            isDisabled={isDisabled}
            className="grid-cols-3"
          />
        </div>
        <WeaponFields editor={editor} isDisabled={isDisabled} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            disabled={isSaving || isDisabled}
          >
            {isSaving ? 'Saving…' : 'Save'}{' '}
            <span className="sr-only">proficiency change</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            {isDirty ? 'Cancel' : 'Close'}{' '}
            <span className="sr-only">proficiency editor</span>
          </Button>
          <SaveFeedback status={editor.status} savedText="Saved" />
          <MaintenanceReason notice={maintenance} />
        </div>
      </form>
    </Form>
  );
}
