'use client';
import { Fragment, useEffect, useId, useRef, type ComponentType } from 'react';
import { Controller, FormProvider } from 'react-hook-form';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import {
  PhoneStatusStrip,
  useShellSlotHost,
} from '~/components/campaign-shell/shell-slots';
import {
  SetupCaches,
  SetupItems,
  SetupMarketplaces,
  SetupOrders,
} from '~/components/militia-setup/assets';
import {
  SetupCharacterConditions,
  SetupMarketDayBenefits,
  SetupSkillBenefits,
} from '~/components/militia-setup/effects';
import { SetupSectionHeading } from '~/components/militia-setup/fields';
import {
  SetupTeams,
  type SetupCharacter,
} from '~/components/militia-setup/roster';
import { SetupMilitiaValues } from '~/components/militia-setup/starting-point';
import { SetupSettlements } from '~/components/militia-setup/world';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { cn } from '~/lib/utils';
import type { AffectedChoice, NeededBy } from './affected-choice-copy';
import {
  AFFECTS_WEEK_HEADING,
  CONFLICT_HEADING,
  MISSING_HEADING,
  NEEDED_BY_LABEL,
  RESTART_FROM_THEIRS,
  RESTART_FROM_WEEK,
  SAVING_MESSAGE,
  WEEK_CHANGED_MESSAGE,
} from './correction-copy';
import { FactsView } from './facts-view';
import type { CorrectableEntry } from './section-fields';
import type {
  MissingEntry,
  SectionCorrection,
} from './use-militia-corrections';

export type SectionEditorProps = {
  characters: SetupCharacter[];
  /** Why a restored row is needed, by its identity. */
  rowNotes: ReadonlyMap<string, string>;
};

// The list editors render under the pane's own "Correct teams" heading, so
// Setup's section title is dropped.
function TeamsEditor({ characters, rowNotes }: SectionEditorProps) {
  return (
    <SetupSectionHeading value="none">
      <SetupTeams characters={characters} rowNotes={rowNotes} />
    </SetupSectionHeading>
  );
}

function SettlementsEditor({ rowNotes }: SectionEditorProps) {
  return (
    <SetupSectionHeading value="none">
      <SetupSettlements rowNotes={rowNotes} />
    </SetupSectionHeading>
  );
}

function ItemsEditor({ characters, rowNotes }: SectionEditorProps) {
  return (
    <SetupSectionHeading value="none">
      <SetupItems characters={characters} rowNotes={rowNotes} />
    </SetupSectionHeading>
  );
}

function CachesEditor({ rowNotes }: SectionEditorProps) {
  return (
    <SetupSectionHeading value="none">
      <SetupCaches rowNotes={rowNotes} />
    </SetupSectionHeading>
  );
}

function OrdersEditor() {
  return (
    <SetupSectionHeading value="none">
      <SetupOrders />
    </SetupSectionHeading>
  );
}

function MarketplacesEditor() {
  return (
    <SetupSectionHeading value="none">
      <SetupMarketplaces />
    </SetupSectionHeading>
  );
}

function CharacterConditionsEditor({ characters }: SectionEditorProps) {
  return (
    <SetupSectionHeading value="none">
      <SetupCharacterConditions characters={characters} />
    </SetupSectionHeading>
  );
}

// Two subsections under the pane's heading, each keeping Setup's own title.
function CarriedBenefitsEditor({ characters }: SectionEditorProps) {
  return (
    <SetupSectionHeading value="h3">
      <div className="space-y-6">
        <SetupSkillBenefits characters={characters} />
        <SetupMarketDayBenefits />
      </div>
    </SetupSectionHeading>
  );
}

// The editor of every entry the page corrects in place.
export const sectionEditors: Record<
  CorrectableEntry,
  ComponentType<SectionEditorProps>
> = {
  values: SetupMilitiaValues,
  teams: TeamsEditor,
  settlements: SettlementsEditor,
  characterConditions: CharacterConditionsEditor,
  items: ItemsEditor,
  caches: CachesEditor,
  orders: OrdersEditor,
  marketplaces: MarketplacesEditor,
  carriedBenefits: CarriedBenefitsEditor,
};

const action = 'min-h-11 md:min-h-9';
const advisory = 'border-primary/40 bg-primary/10 space-y-1 border p-3';
// Headings that take programmatic focus (`tabIndex={-1}`) so keyboard and
// screen-reader users land on the state that just opened.
const focusTarget = 'outline-none';

/** Moves focus to the element on mount: the heading of a state that opened. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

/** Advisory rules warnings, on the read view and on an open correction. */
export function RulesWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <aside aria-label="Rules warnings" className={advisory}>
      <h3 className="text-sm font-semibold">Rules warnings</h3>
      {warnings.map((message) => (
        <p key={message} className="flex items-start gap-2 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{message}</span>
        </p>
      ))}
    </aside>
  );
}

// The choice's name, linked to the phase that repairs it; plain text for
// read-only carried context.
function ChoiceName({ choice }: { choice: NeededBy }) {
  if (choice.href === null) return <>{choice.label}</>;
  return (
    <GuardedLink href={choice.href} className="underline underline-offset-4">
      {choice.label}
    </GuardedLink>
  );
}

// The open week's choices this correction would leave without their
// subject, one sentence each: "Removing Scouts leaves Activity slot 2
// (Drill Militia) without a team."
export function AffectsWeek({ choices }: { choices: AffectedChoice[] }) {
  if (choices.length === 0) return null;
  return (
    <aside aria-label={AFFECTS_WEEK_HEADING} className={advisory}>
      <h3 className="text-sm font-semibold">{AFFECTS_WEEK_HEADING}</h3>
      <ul role="list" className="space-y-1 text-sm">
        {choices.map((choice) => (
          <li key={choice.key} className="flex items-start gap-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {choice.before} <ChoiceName choice={choice} /> {choice.after}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// One missing identity: what needs it, and its Restore button. While its
// restoration is blocked, the reason is read out with the disabled button.
function MissingReferenceItem({
  entry,
  disabled,
}: {
  entry: MissingEntry;
  disabled: boolean;
}) {
  const id = useId();
  const blockedId = `${id}-blocked`;
  return (
    <li className="min-w-0 space-y-1.5 [overflow-wrap:anywhere]">
      <p className="font-medium">{entry.name}</p>
      <p className="text-sm">
        {NEEDED_BY_LABEL}:{' '}
        {entry.neededBy.map((choice, index) => (
          <Fragment key={choice.key}>
            {index > 0 && ', '}
            <ChoiceName choice={choice} />
            {choice.action !== null && ` · ${choice.action}`}
          </Fragment>
        ))}
      </p>
      {entry.blocked !== null && (
        <p id={blockedId} className="text-muted-foreground text-sm">
          {entry.blocked}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className={action}
          disabled={disabled || entry.blocked !== null}
          aria-describedby={entry.blocked !== null ? blockedId : undefined}
          onClick={entry.restore}
        >
          {entry.restoreLabel}
        </Button>
      </div>
    </li>
  );
}

/**
 * Identities the open week still uses but the militia lacks, each with the
 * choices that need it and a button that adds it back to this section. On
 * the read view and on an open correction.
 */
export function MissingReferences({
  entries,
  disabled,
}: {
  entries: MissingEntry[];
  disabled: boolean;
}) {
  const id = useId();
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby={id} className="min-w-0 space-y-2">
      <h3 id={id} className="text-sm font-semibold">
        {MISSING_HEADING}
      </h3>
      <ul role="list" className="space-y-3">
        {entries.map((entry) => (
          <MissingReferenceItem
            key={entry.key}
            entry={entry}
            disabled={disabled}
          />
        ))}
      </ul>
    </section>
  );
}

function ErrorList({
  title,
  items,
  focusField,
}: {
  title: string;
  items: SectionCorrection['errors'];
  focusField: SectionCorrection['focusField'];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul role="list" className="space-y-1 text-sm">
        {items.map(({ field, message }) => (
          <li key={`${field}:${message}`}>
            {field ? (
              <button
                type="button"
                className="min-h-11 text-left underline underline-offset-4 md:min-h-0"
                onClick={() => focusField(field)}
              >
                {message}
              </button>
            ) : (
              message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorSummary({ correction }: { correction: SectionCorrection }) {
  const { errors, focusField } = correction;
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-destructive/60 text-destructive space-y-2 border p-3"
    >
      <h3 className="font-semibold">Fix these before saving</h3>
      <ErrorList
        title="Required"
        items={errors.filter((item) => item.kind === 'required')}
        focusField={focusField}
      />
      <ErrorList
        title="Invalid"
        items={errors.filter((item) => item.kind !== 'required')}
        focusField={focusField}
      />
    </div>
  );
}

function Notice({ correction }: { correction: SectionCorrection }) {
  const { view, notice } = correction;
  if (!notice) return null;
  const failed =
    view.kind === 'editing' &&
    (view.notice === 'rejected' || view.notice === 'unconfirmed');
  return (
    <p
      role="status"
      className={cn(
        'text-sm',
        failed ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {notice}
    </p>
  );
}

// The reason and Save/Cancel. Inline at the end of the form from 768px; on
// the phone in the shell's strip above the bottom tabs, which sits outside
// the form, so Save submits through `form={formId}`.
function ReasonBar({
  correction,
  formId,
  inStrip,
}: {
  correction: SectionCorrection;
  formId: string;
  inStrip: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const { view, reason } = correction;
  const maintenance = useInitialMigrationMaintenance();
  const editing = view.kind === 'editing';
  return (
    <div
      data-reason-bar
      className={cn('grid gap-3', inStrip && 'bg-background px-3 py-2')}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{reason.label}</Label>
        <Controller
          control={correction.form.control}
          name="notes"
          render={({ field }) => (
            <Textarea
              {...field}
              ref={field.ref}
              id={id}
              rows={2}
              value={field.value ?? ''}
              disabled={!editing}
              aria-invalid={reason.error ? true : undefined}
              aria-describedby={reason.error ? errorId : undefined}
            />
          )}
        />
        {reason.error && (
          <p
            id={errorId}
            className="text-destructive flex items-start gap-1.5 text-sm"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {reason.error}
            </span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          form={formId}
          className={action}
          disabled={!editing || maintenance.readOnly}
        >
          {view.kind === 'saving' ? SAVING_MESSAGE : 'Save correction'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={action}
          disabled={!editing}
          onClick={correction.cancel}
        >
          Cancel
        </Button>
        {view.kind === 'saving' && (
          <p role="status" className="sr-only">
            {SAVING_MESSAGE}
          </p>
        )}
        <MaintenanceReason notice={maintenance} />
      </div>
    </div>
  );
}

function Editor({
  correction,
  wide,
}: {
  correction: SectionCorrection;
  wide: boolean;
}) {
  const id = useId();
  const formId = `${id}-form`;
  const strip = useShellSlotHost('phone-status-strip');
  // Exactly one bar: the phone strip when the shell offers it, else inline.
  const inStrip = !wide && strip;
  const SectionEditor = sectionEditors[correction.entry];
  const { view } = correction;
  return (
    <FormProvider {...correction.form}>
      <form
        noValidate
        id={formId}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          correction.save();
        }}
      >
        <fieldset
          disabled={view.kind !== 'editing'}
          className="min-w-0 space-y-4"
        >
          <SectionEditor
            characters={correction.characters}
            rowNotes={correction.rowNotes}
          />
        </fieldset>
        <MissingReferences
          entries={correction.restorable}
          disabled={view.kind !== 'editing'}
        />
        <RulesWarnings warnings={correction.warnings} />
        <AffectsWeek choices={correction.affectsWeek} />
        <ErrorSummary correction={correction} />
        <Notice correction={correction} />
        {!inStrip && (
          <ReasonBar correction={correction} formId={formId} inStrip={false} />
        )}
      </form>
      {inStrip && (
        <PhoneStatusStrip>
          <ReasonBar correction={correction} formId={formId} inStrip />
        </PhoneStatusStrip>
      )}
    </FormProvider>
  );
}

function Conflict({ correction }: { correction: SectionCorrection }) {
  const id = useId();
  const theirsId = `${id}-theirs`;
  const yoursId = `${id}-yours`;
  const { comparison } = correction;
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className="space-y-4">
      <div role="alert">
        <h3
          ref={heading}
          tabIndex={-1}
          className={cn('font-semibold', focusTarget)}
        >
          {CONFLICT_HEADING}
        </h3>
      </div>
      {comparison && (
        <div className="grid gap-4 md:grid-cols-2">
          <section
            aria-labelledby={theirsId}
            className="border-foreground/15 min-w-0 space-y-3 border p-3"
          >
            <h4 id={theirsId} className="font-medium">
              Their values
            </h4>
            <FactsView facts={comparison.theirs} />
          </section>
          <section
            aria-labelledby={yoursId}
            className="border-foreground/15 min-w-0 space-y-3 border p-3"
          >
            <h4 id={yoursId} className="font-medium">
              Your values
            </h4>
            <FactsView facts={comparison.yours} />
          </section>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={action} onClick={correction.restart}>
          {RESTART_FROM_THEIRS}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={action}
          onClick={correction.cancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function WeekChanged({ correction }: { correction: SectionCorrection }) {
  const message = useFocusOnMount<HTMLParagraphElement>();
  return (
    <div className="space-y-4">
      <p ref={message} role="alert" tabIndex={-1} className={focusTarget}>
        {WEEK_CHANGED_MESSAGE}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={action} onClick={correction.restart}>
          {RESTART_FROM_WEEK}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={action}
          onClick={correction.cancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// One section's correction in place of its read view: the editor, then the
// conflict comparison or the week-changed notice when the militia moved.
export function SectionCorrectionView({
  correction,
  wide,
}: {
  correction: SectionCorrection;
  wide: boolean;
}) {
  const { view } = correction;
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section className="min-w-0 space-y-4">
      <h2
        ref={heading}
        tabIndex={-1}
        className={cn('text-xl [overflow-wrap:anywhere]', focusTarget)}
      >
        {correction.heading}
      </h2>
      {view.kind === 'conflict' ? (
        <Conflict correction={correction} />
      ) : view.kind === 'weekChanged' ? (
        <WeekChanged correction={correction} />
      ) : (
        <Editor correction={correction} wide={wide} />
      )}
    </section>
  );
}
