'use client';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import type { DeletionRequestStatus } from '~/lib/container-deletion';
import { refusalReason } from '~/lib/write-outcome';

const action = 'max-md:min-h-11';

// The explicit confirmation step before a campaign or organization is
// deleted (#710), in the shell's Dialog-and-destructive-button pattern.
// The dialog has no close cross: Cancel is the way out, and nothing closes
// it while the request is pending. A blocked refusal keeps it open with the
// refusal as its body; the destructive button stays, so assigning owners
// and asking again needs no new dialog. An unconfirmed outcome says so and
// offers to check again, which repeats the request safely.
export function DeletionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  status,
  confirmLabel,
  pendingLabel,
  onConfirm,
  failurePrefix,
  unknownMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The one-line lead; the body follows as children. */
  description: string;
  children: ReactNode;
  status: DeletionRequestStatus;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => void;
  /** "Campaign wasn't deleted"; the reason follows. */
  failurePrefix: string;
  unknownMessage: string;
}) {
  const pending = status.kind === 'pending';
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="[overflow-wrap:anywhere]">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">{children}</div>
        {status.kind === 'rejected' ? (
          <p role="alert" className="text-destructive text-sm">
            {failurePrefix}
            {refusalReason(status.message)}
          </p>
        ) : null}
        {status.kind === 'unknown' ? (
          <p role="alert" className="text-destructive text-sm">
            {unknownMessage}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={action}
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className={action}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending
              ? pendingLabel
              : status.kind === 'unknown'
                ? 'Check again'
                : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
