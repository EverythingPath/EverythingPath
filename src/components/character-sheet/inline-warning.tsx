'use client';
import { TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import {
  MaintenanceReason,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { getScrollBehavior, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type WarningKey = { check: string; subject: string };

const message = 'min-w-0 [overflow-wrap:anywhere]';

/** A rules warning carries this, so a notice can lead to its Accept. */
export const warningAnchorAttribute = 'data-warning-key';
const warningAnchorKey = ({ check, subject }: WarningKey) =>
  `${check}:${subject}`;

/**
 * Moves to a rules warning where it is shown: it scrolls into view,
 * respecting reduced motion, and its Accept or Reopen takes focus. False
 * while the warning isn't on the page.
 */
export function focusInlineWarning(key: WarningKey) {
  const target = [
    ...document.querySelectorAll<HTMLElement>(`[${warningAnchorAttribute}]`),
  ].find(
    (element) =>
      element.getAttribute(warningAnchorAttribute) === warningAnchorKey(key),
  );
  if (!target) return false;
  target.scrollIntoView?.({ block: 'nearest', behavior: getScrollBehavior() });
  (target.querySelector<HTMLElement>('button') ?? target).focus();
  return true;
}

function actionLabel({
  isSaving,
  isAccepted,
}: {
  isSaving: boolean;
  isAccepted: boolean;
}) {
  if (isSaving) return 'Saving…';
  return isAccepted ? 'Reopen' : 'Accept';
}

// A failed rules check, beside the field it is about (approved prototype,
// #208). Accepting records the table's choice and nothing else: the numbers
// stay as calculated, and an edit to the facts shows the warning again.
function RulesWarning({
  warning,
  controller,
  isNamedByMessage,
}: {
  warning: SheetWarningView;
  controller: Controller['warnings'];
  isNamedByMessage: boolean;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const messageId = useId();
  const ownReasonId = useId();
  const reasonId = useMaintenanceReasonId(maintenance) ?? ownReasonId;
  const status = controller.statusFor(warning);
  const isSaving = status.kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;
  const label = actionLabel({ isSaving, isAccepted: warning.accepted });
  // Named by its message, the message no longer also describes the button.
  const describedBy = [
    isNamedByMessage ? null : messageId,
    maintenance.readOnly ? reasonId : null,
  ].filter((id) => id !== null);
  return (
    <div
      {...{ [warningAnchorAttribute]: warningAnchorKey(warning) }}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
    >
      {warning.accepted ? (
        <span className="text-muted-foreground">
          Accepted
          <span id={messageId} className="sr-only">
            {' '}
            {warning.message}
          </span>
        </span>
      ) : (
        <span className="flex items-start gap-1.5 text-amber-300">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span id={messageId} className={message}>
            {warning.message}
          </span>
        </span>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2 text-xs md:h-6"
        aria-label={
          isNamedByMessage ? `${label} ${warning.message}` : undefined
        }
        aria-describedby={describedBy.join(' ') || undefined}
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return;
          if (warning.accepted) void controller.reopen(warning);
          else void controller.accept(warning);
        }}
      >
        {label}
      </Button>
      <SaveFeedback
        status={status}
        savedText={warning.accepted ? 'Warning accepted.' : 'Warning reopened.'}
      />
      <MaintenanceReason
        id={ownReasonId}
        notice={maintenance}
        className="text-xs"
      />
    </div>
  );
}

/**
 * One calculation warning where its subject is edited. The three kinds read
 * differently: a choice the sheet still needs is blue like the outline on
 * the empty field, a value the sheet cannot resolve yet is a muted
 * explanation, and a failed rules check is amber with Accept. Only the last
 * is a decision; the other two can never be accepted away.
 */
export function InlineWarning({
  warning,
  controller,
  className,
  isNamedByMessage = false,
}: {
  warning: SheetWarningView;
  controller: Controller['warnings'];
  className?: string;
  /** Names Accept and Reopen "Accept {message}" rather than describing them. */
  isNamedByMessage?: boolean;
}) {
  if (warning.kind === 'rules')
    return (
      <div className={className}>
        <RulesWarning
          warning={warning}
          controller={controller}
          isNamedByMessage={isNamedByMessage}
        />
      </div>
    );
  return (
    <p
      className={cn(
        'text-xs',
        message,
        warning.kind === 'incomplete'
          ? 'text-sky-300'
          : 'text-muted-foreground',
        className,
      )}
    >
      {warning.message}
    </p>
  );
}

/** The warnings aimed at one place on the sheet, in calculation order. */
export function InlineWarnings({
  warnings,
  controller,
  className,
  id,
  isNamedByMessage = false,
}: {
  warnings: SheetWarningView[];
  controller: Controller['warnings'];
  className?: string;
  /** Lets a field name this list as its description. */
  id?: string;
  /** Names Accept and Reopen "Accept {message}" rather than describing them. */
  isNamedByMessage?: boolean;
}) {
  if (warnings.length === 0) return null;
  return (
    <div id={id} className={cn('flex flex-col gap-1', className)}>
      {warnings.map((warning) => (
        <InlineWarning
          key={`${warning.check}:${warning.subject}`}
          warning={warning}
          controller={controller}
          isNamedByMessage={isNamedByMessage}
        />
      ))}
    </div>
  );
}
