'use client';
import { Check, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { ReviewException } from '~/components/week-review/review-facts';
import { FormNotes, ReasonField } from './summary-adjustment-fields';
import {
  useExceptionReasonForm,
  type Edit,
  type LocalFormGuard,
} from './use-summary-forms';

type Props = {
  note: ReviewException;
  /** Readable subject of the exception, e.g. "Activity 2: Earn Gold". */
  subject: string;
  edit: Edit;
  guard?: LocalFormGuard;
  disabled: boolean;
};

/** The live Summary's controls under a Rules Exception: reason editor or removal. */
export function ExceptionControl(props: Props) {
  const { note, edit, disabled } = props;
  if (note.obsolete)
    return (
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          void edit({
            kind: 'clear_rules_exception',
            exceptionId: note.exceptionId,
          })
        }
      >
        Remove obsolete exception
      </Button>
    );
  return <ExceptionReasonForm {...props} />;
}

function ExceptionReasonForm({ note, subject, edit, guard, disabled }: Props) {
  const reasonForm = useExceptionReasonForm({
    note,
    subject,
    edit,
    guard,
    // Save disappears once saved; keep focus in the reason.
    onSaved: () => setTimeout(() => reasonForm.form.setFocus('reason'), 0),
  });
  const reason = reasonForm.form.watch('reason');
  return (
    <form
      noValidate
      id={reasonForm.elementId}
      aria-label={`${note.rule} exception`}
      onSubmit={reasonForm.submit}
      className="min-w-0 space-y-2"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <ReasonField
          label={`Reason for ${note.rule} exception`}
          registration={reasonForm.form.register('reason')}
          value={reason}
          error={reasonForm.form.formState.errors.reason}
          disabled={disabled}
          onEnter={() => {
            if (reasonForm.isDirty && !reasonForm.isSaving)
              void reasonForm.submit();
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Clear ${note.rule} exception`}
          disabled={disabled}
          onClick={() => void reasonForm.clear()}
        >
          <X aria-hidden />
        </Button>
      </div>
      <FormNotes
        failure={reasonForm.failure}
        hasRemoteChange={reasonForm.hasRemoteChange}
        remoteMessage="Another player changed this reason. Your unsaved text is kept: Save replaces theirs, Cancel shows theirs."
      />
      {reasonForm.isDirty && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={disabled || reasonForm.isSaving}
            aria-busy={reasonForm.isSaving || undefined}
          >
            <Check aria-hidden />
            {reasonForm.isSaving ? 'Saving…' : `Save ${note.rule} reason`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={reasonForm.cancel}
          >
            Cancel {note.rule} reason
          </Button>
        </div>
      )}
    </form>
  );
}
