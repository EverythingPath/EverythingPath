'use client';
import { Check, Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { wrap } from '~/components/week-review/review-parts';
import { cn } from '~/lib/utils';
import {
  AdjustmentFields,
  FormNotes,
  ReasonField,
} from './summary-adjustment-fields';
import {
  adjustmentKinds,
  kindLabel,
  type AdjustmentFormValues,
  type AdjustmentKind,
  type AdjustmentTargets,
  type TableAdjustment,
} from './summary-adjustment-form';
import {
  keptNewAdjustment,
  useAdjustmentForm,
  useRemovedDraftRegistration,
  type Edit,
  type LocalFormGuard,
  type RemovedAdjustmentDraft,
} from './use-summary-forms';

// The kind cards that open a new Table Adjustment, its form, and the kept
// input of adjustments another player removed. Values, validation and
// saving live in the form hooks; this file lays them out.

type ListProps = {
  targets: AdjustmentTargets;
  latest: () => readonly TableAdjustment[];
  edit: Edit;
  guard?: LocalFormGuard;
  disabled: boolean;
};

type NewAdjustment = {
  id: string;
  kind: AdjustmentKind;
  initialValues?: AdjustmentFormValues;
};

function NewAdjustmentForm({
  open,
  targets,
  latest,
  edit,
  guard,
  disabled,
  onClose,
}: ListProps & { open: NewAdjustment; onClose: () => void }) {
  const adding = useAdjustmentForm({
    adjustmentId: open.id,
    accepted: null,
    kind: open.kind,
    initialValues: open.initialValues,
    targets,
    latest,
    edit,
    guard,
    onSaved: onClose,
    onCancelled: onClose,
  });
  const label = kindLabel(open.kind);
  const reason = adding.form.watch('reason');
  return (
    <form
      noValidate
      id={adding.elementId}
      aria-label={`New ${label} adjustment`}
      onSubmit={adding.submit}
      className="min-w-0 space-y-3 border p-3"
    >
      <p className="text-sm font-semibold">{label}</p>
      <AdjustmentFields form={adding} disabled={disabled} />
      <ReasonField
        label="Reason"
        registration={adding.form.register('reason')}
        value={reason}
        error={adding.form.formState.errors.reason}
        disabled={disabled}
        onEnter={() => {
          if (!adding.isSaving) void adding.submit();
        }}
      />
      <FormNotes
        failure={adding.failure}
        hasRemoteChange={adding.hasRemoteChange}
        remoteMessage=""
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={disabled || adding.isSaving}
          aria-busy={adding.isSaving || undefined}
        >
          <Check aria-hidden />
          {adding.isSaving ? 'Saving…' : 'Save adjustment'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={adding.cancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RemovedDraftCard({
  draft,
  guard,
  disabled,
  onAddAgain,
}: {
  draft: RemovedAdjustmentDraft;
  guard?: LocalFormGuard;
  disabled: boolean;
  onAddAgain: () => void;
}) {
  const removed = useRemovedDraftRegistration(guard, draft);
  const reason = draft.values.reason.trim();
  return (
    <div
      id={removed.elementId}
      role="status"
      className="min-w-0 space-y-2 border border-amber-500/60 p-3"
    >
      <p className={cn('text-sm', wrap)}>
        Another player removed the {kindLabel(draft.values.kind)} adjustment
        {reason ? ` “${reason}”` : ''} while you were changing it. Your unsaved
        changes are kept.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            removed.discard();
            onAddAgain();
          }}
        >
          Add again as a new adjustment
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={removed.discard}
        >
          Discard changes
        </Button>
      </div>
    </div>
  );
}

/** Kind cards, the form that appends a new adjustment and kept removed drafts. */
export function AddAdjustment({
  localForms,
  removedDrafts,
  ...list
}: ListProps & {
  /** This device's registered local forms, to reopen a new form left open. */
  localForms: readonly { id: string }[];
  removedDrafts: RemovedAdjustmentDraft[];
}) {
  const { guard, disabled } = list;
  const [open, setOpen] = useState<NewAdjustment | null>(() =>
    keptNewAdjustment(guard, localForms),
  );
  const cardRefs = useRef(new Map<AdjustmentKind, HTMLButtonElement>());
  const describedBy = useId();
  const openNew = (next: NewAdjustment) => {
    // Choosing another kind replaces the open new form and its input.
    if (open) guard?.set(`new-adjustment:${open.id}`, null);
    setOpen(next);
  };
  const close = () => {
    const kind = open?.kind;
    setOpen(null);
    if (kind) cardRefs.current.get(kind)?.focus();
  };
  return (
    <div className="min-w-0 space-y-3">
      {removedDrafts.map((draft) => (
        <RemovedDraftCard
          key={draft.formId}
          draft={draft}
          guard={guard}
          disabled={disabled}
          onAddAgain={() =>
            openNew({
              id: crypto.randomUUID(),
              kind: draft.values.kind,
              initialValues: draft.values,
            })
          }
        />
      ))}
      <div
        role="group"
        aria-label="New Table Adjustment"
        data-adjustment-kinds
        // Short viewports stack so a whole card fits the scroll column.
        className="short:grid-cols-1 not-short:@2xl:grid-cols-4 grid grid-cols-2 gap-2"
      >
        {adjustmentKinds.map((kind) => {
          const isOpen = open?.kind === kind.value;
          const noteId = `${describedBy}-${kind.value}`;
          return (
            // Hover only lifts and tints the border so it never resembles the
            // open kind's fill.
            <button
              key={kind.value}
              ref={(node) => {
                if (node) cardRefs.current.set(kind.value, node);
                else cardRefs.current.delete(kind.value);
              }}
              type="button"
              aria-label={kind.label}
              aria-describedby={noteId}
              aria-pressed={isOpen}
              disabled={disabled}
              onClick={() => {
                if (!isOpen)
                  openNew({ id: crypto.randomUUID(), kind: kind.value });
              }}
              className={cn(
                // Words wrap between each other, never inside one: the label
                // shrinks on a phone instead of splitting "Settlement".
                'bg-background short:min-h-0 short:p-2 not-short:sm:p-3 flex h-auto min-h-16 max-w-full min-w-0 flex-col items-start gap-1 rounded-lg border-2 p-2.5 text-left break-normal whitespace-normal transition-transform select-none',
                'hover:border-primary/60 hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none',
                'focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
                'disabled:pointer-events-none disabled:opacity-50',
                isOpen
                  ? 'border-primary bg-primary/15 hover:border-primary'
                  : 'border-border',
              )}
            >
              <span className="flex w-full min-w-0 items-start gap-1.5 text-xs font-semibold sm:text-sm">
                {isOpen ? (
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <Plus aria-hidden className="mt-0.5 size-4 shrink-0" />
                )}
                <span className="min-w-0 break-normal">{kind.label}</span>
              </span>
              <span
                id={noteId}
                className="text-muted-foreground min-w-0 text-xs font-normal"
              >
                {kind.description}
              </span>
            </button>
          );
        })}
      </div>
      {open && (
        <NewAdjustmentForm
          key={open.id}
          open={open}
          {...list}
          onClose={close}
        />
      )}
    </div>
  );
}
