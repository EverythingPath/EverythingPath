'use client';
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  TriangleAlert,
} from 'lucide-react';
import { useId, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { Badge } from '~/components/ui/badge';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { InlineDeleteQuestion } from '~/components/character-sheet/inline-delete-question';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Form,
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
import { Textarea } from '~/components/ui/textarea';
import { CHARACTER_KINDS, formatCharacterKind } from '~/lib/character-kind';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { cn } from '~/lib/utils';
import type { CharacterFormValues, CharacterRecord } from './types';
import type { CharacterRecordForm } from './use-character-record';

const SCORE_FIELDS = [
  ['strength', 'STR'],
  ['dexterity', 'DEX'],
  ['constitution', 'CON'],
  ['intelligence', 'INT'],
  ['wisdom', 'WIS'],
  ['charisma', 'CHA'],
] as const satisfies readonly (readonly [keyof CharacterFormValues, string])[];

// Every field in form order with its label, for the save summary.
function fieldLabels(levelLabel: string) {
  return [
    ['name', 'Name'],
    ['level', levelLabel],
    ['kind', 'Kind'],
    ...SCORE_FIELDS,
    ['description', 'Notes'],
  ] as const satisfies readonly (readonly [
    keyof CharacterFormValues,
    string,
  ])[];
}

// After a Save or Archive found errors: each invalid field, linked to its
// control. The field's own message says what is wrong.
function SaveSummary({
  form,
  levelLabel,
}: {
  form: CharacterRecordForm['form'];
  levelLabel: string;
}) {
  const { errors, submitCount } = form.formState;
  const invalid = fieldLabels(levelLabel).filter(([name]) => errors[name]);
  if (submitCount === 0 || invalid.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-destructive/60 text-destructive space-y-1 border p-2 text-sm"
    >
      <p className="font-semibold">Fix these before saving</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {invalid.map(([name, text]) => (
          <li key={name}>
            <button
              type="button"
              className="focus-visible:ring-ring/50 min-h-11 underline underline-offset-4 outline-none focus-visible:ring-[3px] md:min-h-0"
              onClick={() => form.setFocus(name)}
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const label = 'font-mono text-sm';
const control = 'border-primary bg-card border-2 font-mono';
const action = 'min-h-11 md:min-h-9';

function NumberField({
  form,
  name,
  text,
  inputRef,
}: {
  form: CharacterRecordForm['form'];
  name: keyof CharacterFormValues;
  text: string;
  /** The element itself, for focus that cannot wait for a timer. */
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={label}>{text}</FormLabel>
          <FormControl>
            <Input
              {...field}
              ref={(element) => {
                field.ref(element);
                if (inputRef) inputRef.current = element;
              }}
              type="text"
              inputMode="numeric"
              className={control}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// A full Character's level and six scores: facts from its sheet, read here
// and edited there, never a form that looks switched off.
function SheetStatistics({
  record,
  sheetHref,
}: {
  record: CharacterRecord;
  sheetHref: string;
}) {
  const headingId = useId();
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="border-foreground/20 space-y-2 border p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p id={headingId} className={label}>
          Level and scores
        </p>
        <GuardedLink
          href={sheetHref}
          className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4 md:min-h-0"
        >
          Open sheet
          <ArrowRight aria-hidden className="size-4" />
        </GuardedLink>
      </div>
      <dl className="grid grid-cols-4 gap-x-3 gap-y-2 md:grid-cols-7">
        {[
          ['Level', record.level] as const,
          ...SCORE_FIELDS.map(([name, text]) => [text, record[name]] as const),
        ].map(([text, value]) => (
          <div key={text} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
              {text}
            </dt>
            <dd className="font-mono text-base">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Lowering a prepared level removes its trailing Class Levels, named in
// recorded order before anything is written. Keep is the harmless answer
// and the one Escape gives.
function RemovalConfirmation({
  confirmation,
  isBusy,
  onKeep,
  onRemove,
}: {
  confirmation: NonNullable<CharacterRecordForm['removalConfirmation']>;
  isBusy: boolean;
  onKeep: () => void;
  onRemove: () => void;
}) {
  return (
    <InlineDeleteQuestion
      question="Remove Class Levels?"
      subject="Class Levels"
      deleteLabel="Remove"
      isBusy={isBusy}
      className="border-destructive/50 border p-2 text-sm"
      details={
        <div className="space-y-1">
          <p>
            Lowering the level to {confirmation.targetLevel} removes these Class
            Levels.
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {confirmation.levels.map((level) => (
              <li key={level.entryId} className="[overflow-wrap:anywhere]">
                Level {level.position} · {level.name}
              </li>
            ))}
          </ul>
        </div>
      }
      onDelete={onRemove}
      onKeep={onKeep}
    />
  );
}

// The Add/Edit character dialog's markup: every record field with its own
// validation message, the refused write, and Save / Cancel with Archive or
// Un-archive on an existing record. While a level decrease waits for its
// answer the form stays visible but inert under the question.
export function CharacterRecordDialogView({
  open,
  onOpenChange,
  recordForm,
  archiveWarning,
  maintenance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordForm: CharacterRecordForm;
  archiveWarning: string | null;
  maintenance: MigrationMaintenance;
}) {
  const {
    form,
    record,
    submitError,
    pending,
    levelLabel,
    statisticsReadOnly,
    sheetHref,
    removalConfirmation: confirmation,
  } = recordForm;
  const busy = pending !== null;
  const locked = busy || recordForm.readOnly;
  const archived = record?.isActive === false;
  const levelInput = useRef<HTMLInputElement>(null);
  // Both answers settle the question before the Level field takes focus
  // again, so the player can revise it or watch the Save it resumed.
  const answer = (settle: () => void) => {
    flushSync(settle);
    levelInput.current?.focus();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && confirmation) {
          answer(confirmation.cancel);
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="border-primary bg-card max-h-[calc(100dvh-2rem)] overflow-y-auto border-2 font-mono sm:max-w-3xl"
      >
        {/* The badge sits beside the title, so the dialog's name stays
            "Edit character". */}
        <DialogHeader className="flex-row flex-wrap items-center gap-2">
          <DialogTitle className="font-sans text-xl">
            {record ? 'Edit character' : 'Add character'}
          </DialogTitle>
          {archived && (
            <Badge variant="outline" className="font-mono font-normal">
              Archived
            </Badge>
          )}
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            inert={confirmation ? true : undefined}
            className={cn('space-y-4', confirmation && 'opacity-50')}
            onSubmit={(event) => {
              event.preventDefault();
              recordForm.save();
            }}
          >
            {submitError && (
              <div
                role="alert"
                className="border-destructive/50 bg-destructive/10 text-destructive border p-2 text-sm"
              >
                {submitError}
              </div>
            )}
            <SaveSummary form={form} levelLabel={levelLabel} />

            <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className={label}>Name</FormLabel>
                    <FormControl>
                      <Input {...field} className={control} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {statisticsReadOnly ? null : (
                <NumberField
                  form={form}
                  name="level"
                  text={levelLabel}
                  inputRef={levelInput}
                />
              )}
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={label}>Kind</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={`${control} w-full`}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className={control}>
                        {CHARACTER_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {formatCharacterKind(kind)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {statisticsReadOnly && record && sheetHref ? (
              <SheetStatistics record={record} sheetHref={sheetHref} />
            ) : (
              <div className="grid grid-cols-3 items-start gap-3 md:grid-cols-6">
                {SCORE_FIELDS.map(([name, text]) => (
                  <NumberField key={name} form={form} name={name} text={text} />
                ))}
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={label}>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} className={control} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {archiveWarning !== null && record && !archived && (
              <p className="flex items-start gap-2 text-sm text-amber-300">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {archiveWarning}
                </span>
              </p>
            )}

            <MaintenanceReason notice={maintenance} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {record && (
                <Button
                  type="button"
                  variant="outline"
                  className={action}
                  disabled={locked}
                  onClick={() => recordForm.toggleArchive()}
                >
                  {archived ? <ArchiveRestore /> : <Archive />}
                  {archived
                    ? pending === 'archive'
                      ? 'Un-archiving…'
                      : 'Un-archive'
                    : pending === 'archive'
                      ? 'Archiving…'
                      : 'Archive'}
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className={action}
                  disabled={busy}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className={action} disabled={locked}>
                  {pending === 'save' ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
        {confirmation ? (
          <RemovalConfirmation
            confirmation={confirmation}
            isBusy={busy}
            onKeep={() => answer(confirmation.cancel)}
            onRemove={() => answer(confirmation.confirm)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
