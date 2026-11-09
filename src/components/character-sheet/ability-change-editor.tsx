'use client';
import { abilityChangeKinds } from '~/lib/character-sheet-entries';
import { useId } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { abilityKeys, abilityLabels } from '~/lib/character-sheet';
import { action, fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import { useAbilityChangeForm } from './use-ability-change-form';
import type { AbilityChangeInput } from './use-character-sheet-entries';

type Kind = AbilityChangeInput['kind'];
type FormControlOf = ReturnType<typeof useAbilityChangeForm>['form']['control'];

export const abilityChangeKindLabels: Record<Kind, string> = {
  abilityDamage: 'Ability damage',
  abilityDrain: 'Ability drain',
};
// What each kind does to the sheet, beside its card (PRD Decision 12).
const kindConsequences: Record<Kind, string> = {
  abilityDamage:
    'Leaves the score alone; lowers the modifier by 1 per 2 points of damage.',
  abilityDrain: 'Lowers the score itself.',
};

// Playing-card choices: the native radio keeps the keyboard and the name,
// the card shows the choice and its consequence.
function KindCards({
  control,
  isDisabled,
}: {
  control: FormControlOf;
  isDisabled: boolean;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <FormField
      control={control}
      name="kind"
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <span id={labelId} className={fieldLabel}>
            Kind
          </span>
          <RadioGroup
            aria-labelledby={labelId}
            name={field.name}
            value={field.value}
            disabled={isDisabled}
            onBlur={field.onBlur}
            onValueChange={field.onChange}
            className="grid-cols-1 sm:grid-cols-2"
          >
            {abilityChangeKinds.map((kind) => (
              <RadioGroupItem
                key={kind}
                value={kind}
                aria-label={abilityChangeKindLabels[kind]}
                aria-describedby={`${descriptionId}-${kind}`}
                className="flex-col items-start gap-0.5 px-3 py-2 text-left"
              >
                <span>{abilityChangeKindLabels[kind]}</span>
                <span
                  id={`${descriptionId}-${kind}`}
                  className="text-muted-foreground font-sans text-xs"
                >
                  {kindConsequences[kind]}
                </span>
              </RadioGroupItem>
            ))}
          </RadioGroup>
        </div>
      )}
    />
  );
}

function AbilityCards({
  control,
  isDisabled,
}: {
  control: FormControlOf;
  isDisabled: boolean;
}) {
  const labelId = useId();
  return (
    <FormField
      control={control}
      name="ability"
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <span id={labelId} className={fieldLabel}>
            Ability
          </span>
          <RadioGroup
            aria-labelledby={labelId}
            name={field.name}
            value={field.value}
            disabled={isDisabled}
            onBlur={field.onBlur}
            onValueChange={field.onChange}
            className="grid-cols-3 md:grid-cols-6 lg:grid-cols-3"
          >
            {abilityKeys.map((ability) => (
              <RadioGroupItem key={ability} value={ability} className="px-2">
                {abilityLabels[ability]}
              </RadioGroupItem>
            ))}
          </RadioGroup>
        </div>
      )}
    />
  );
}

/**
 * One ability damage or drain entry: its kind, the ability and the points.
 * A new entry chooses its kind; an existing one keeps it, so only the
 * ability and points can change. A new editor closes after a clean save.
 */
export function AbilityChangeEditor({
  value,
  save,
  onClose,
  isNew,
  isRemoved = false,
}: {
  value?: AbilityChangeInput;
  save: (input: AbilityChangeInput) => Promise<unknown>;
  onClose: () => void;
  isNew: boolean;
  /** Another player removed the entry this draft belongs to. */
  isRemoved?: boolean;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useAbilityChangeForm({ value, save });
  const isDirty = editor.form.formState.isDirty;
  const isSaving = editor.status.kind === 'saving';
  const isDisabled = maintenance.readOnly;
  const kind = editor.form.watch('kind');

  // The form state this render holds is a snapshot; the subscription hears
  // what the save's reset leaves behind, so a new editor closes only when
  // nothing newer than the saved input remains.
  async function saveAndCloseWhenClean() {
    let hasNewerInput = isDirty;
    const unsubscribe = editor.form.subscribe({
      formState: { isDirty: true },
      callback: (state) => {
        if (state.isDirty !== undefined) hasNewerInput = state.isDirty;
      },
    });
    const outcome = await editor.save();
    unsubscribe();
    if (isNew && outcome === 'saved' && !hasNewerInput) onClose();
  }

  if (isRemoved && !isDirty)
    return (
      <div
        role="status"
        className="border-foreground/20 flex flex-wrap items-center gap-x-3 gap-y-1 border p-3 text-sm"
      >
        <span>This entry is no longer on the sheet.</span>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close <span className="sr-only">editor</span>
        </Button>
      </div>
    );

  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label={
          isNew
            ? 'New ability damage or drain'
            : `Edit ${abilityChangeKindLabels[kind].toLowerCase()}`
        }
        className="border-foreground/20 space-y-3 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void saveAndCloseWhenClean();
        }}
      >
        <KindCards
          control={editor.form.control}
          isDisabled={isDisabled || !isNew}
        />
        <AbilityCards control={editor.form.control} isDisabled={isDisabled} />
        <FormField
          control={editor.form.control}
          name="points"
          render={({ field, fieldState }) => (
            <FormItem className="gap-1">
              <FormLabel className={fieldLabel}>Points</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled={isDisabled}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-11 w-24 text-center font-mono md:h-8"
                />
              </FormControl>
              <FormMessage
                role={fieldState.error ? 'alert' : undefined}
                className="max-w-sm"
              />
            </FormItem>
          )}
        />
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            isDirty
              ? 'This entry changed while you were editing. Your edits are kept.'
              : 'Updated by another player.'
          }
          subject="ability change"
          onDismiss={editor.dismissRemoteChange}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            disabled={isSaving || isDisabled}
          >
            {isSaving ? 'Saving…' : 'Save ability change'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Close <span className="sr-only">editor</span>
          </Button>
          <SaveFeedback status={editor.status} savedText="Saved." />
          <MaintenanceReason notice={maintenance} />
        </div>
      </form>
    </Form>
  );
}
