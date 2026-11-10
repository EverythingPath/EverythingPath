'use client';
import { ArrowDown, ArrowUp, Check, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import type { ReviewAdjustment } from '~/components/week-review/review-facts';
import { cn } from '~/lib/utils';
import {
  AdjustmentFields,
  FormNotes,
  ReasonField,
} from './summary-adjustment-fields';
import type {
  AdjustmentTargets,
  TableAdjustment,
} from './summary-adjustment-form';
import {
  useAdjustmentForm,
  useAdjustmentListEdits,
  type Edit,
  type LocalFormGuard,
} from './use-summary-forms';

// One existing Table Adjustment in the live Summary: earlier/later, its
// inline reason, the full editor and removal. Values, validation and saving
// live in the form hooks; this file lays them out.

const remoteChangedRow =
  'Another player changed this adjustment. Your unsaved changes are kept: Save replaces theirs, Cancel shows theirs.';

/** Runs after React has applied the change a saved edit produces. */
const afterRender = (run: () => void) => setTimeout(run, 0);

export const firstControl = (root: Element | null | undefined) =>
  root?.querySelector<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
  ) ?? null;

export const kindCardsSelector = '[data-adjustment-kinds]';

export function AdjustmentRow({
  adjustment,
  index,
  count,
  accepted,
  targets,
  latest,
  edit,
  guard,
  disabled,
}: {
  adjustment: ReviewAdjustment;
  index: number;
  count: number;
  accepted: TableAdjustment;
  targets: AdjustmentTargets;
  latest: () => readonly TableAdjustment[];
  edit: Edit;
  guard?: LocalFormGuard;
  disabled: boolean;
}) {
  const [isEditing, setEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const earlierRef = useRef<HTMLButtonElement>(null);
  const laterRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const row = useAdjustmentForm({
    adjustmentId: adjustment.adjustmentId,
    accepted,
    kind: accepted.kind,
    number: adjustment.number,
    effect: adjustment.effect,
    targets,
    latest,
    edit,
    guard,
    onSaved: () => {
      setEditing(false);
      afterRender(() => editRef.current?.focus());
    },
    onCancelled: () => setEditing(false),
  });
  const { move, remove } = useAdjustmentListEdits({ latest, edit });
  const number = adjustment.number;
  const reason = row.form.watch('reason');
  // A field other than the reason with an error stays visible, so its
  // Required decision can always reach it.
  const hasFieldError = Object.keys(row.form.formState.errors).some(
    (field) => field !== 'reason',
  );
  const isEditorShown = isEditing || hasFieldError;
  const hasActions = isEditorShown || row.isDirty;

  async function moveBy(offset: -1 | 1) {
    const pressed = offset === -1 ? earlierRef : laterRef;
    const other = offset === -1 ? laterRef : earlierRef;
    if ((await move(adjustment.adjustmentId, offset)) !== 'accepted') return;
    // React moves the keyed row's node, which blurs it: keep the same button
    // focused, or its neighbour once this one is at the end of the list.
    afterRender(() => {
      const target = pressed.current?.disabled
        ? other.current
        : pressed.current;
      target?.focus();
    });
  }

  async function removeRow() {
    const item = formRef.current?.closest('li');
    const neighbour = item?.nextElementSibling ?? item?.previousElementSibling;
    const section = formRef.current?.closest('section');
    // This device's own removal drops its unsaved input with it.
    row.release();
    if ((await remove(adjustment.adjustmentId)) === 'failed') return;
    afterRender(() => {
      const target =
        (neighbour?.isConnected ? firstControl(neighbour) : null) ??
        firstControl(section?.querySelector(kindCardsSelector));
      target?.focus();
    });
  }

  const moveButton = (
    ref: typeof earlierRef,
    offset: -1 | 1,
    Icon: typeof ArrowUp,
  ) => (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Move adjustment ${number} ${offset === -1 ? 'earlier' : 'later'}`}
      disabled={disabled || (offset === -1 ? index === 0 : index === count - 1)}
      onClick={() => void moveBy(offset)}
    >
      <Icon aria-hidden />
    </Button>
  );

  return (
    <form
      ref={formRef}
      noValidate
      id={row.elementId}
      aria-label={`Adjustment ${number} editor`}
      onSubmit={row.submit}
      className={cn(
        'grid items-start gap-2',
        count > 1
          ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
          : 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      {count > 1 && (
        <div className="flex gap-1 sm:flex-col">
          {moveButton(earlierRef, -1, ArrowUp)}
          {moveButton(laterRef, 1, ArrowDown)}
        </div>
      )}
      <div className="flex justify-end gap-1 sm:order-last">
        <Button
          ref={editRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Edit adjustment ${number}`}
          aria-expanded={isEditorShown}
          aria-controls={`${row.elementId}-fields`}
          disabled={disabled}
          onClick={() => setEditing((open) => !open)}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove adjustment ${number}`}
          disabled={disabled}
          onClick={() => void removeRow()}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div
        className={cn(
          'min-w-0 space-y-2 sm:row-start-1',
          count > 1
            ? 'col-span-3 sm:col-span-1 sm:col-start-2'
            : 'col-span-2 sm:col-span-1',
        )}
      >
        <div id={`${row.elementId}-fields`} hidden={!isEditorShown}>
          {isEditorShown && <AdjustmentFields form={row} disabled={disabled} />}
        </div>
        <ReasonField
          label={`Reason for adjustment ${number}`}
          registration={row.form.register('reason')}
          value={reason}
          error={row.form.formState.errors.reason}
          disabled={disabled}
          onEnter={() => {
            if (row.isDirty && !row.isSaving) void row.submit();
          }}
        />
        <FormNotes
          failure={row.failure}
          hasRemoteChange={row.hasRemoteChange}
          remoteMessage={remoteChangedRow}
        />
        {hasActions && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={disabled || row.isSaving || !row.isDirty}
              aria-busy={row.isSaving || undefined}
            >
              <Check aria-hidden />
              {row.isSaving ? 'Saving…' : `Save adjustment ${number}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                row.cancel();
                editRef.current?.focus();
              }}
            >
              Cancel changes to adjustment {number}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
