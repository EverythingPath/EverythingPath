'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { DeletionBlockedNotice } from '~/components/campaign-home/deletion-blocked-notice';
import { DeletionDialog } from '~/components/campaign-home/deletion-dialog';
import { Button } from '~/components/ui/button';
import type { Organization } from './session';
import { useOrganizationDeletion } from './use-organization-deletion';
import { useIsOrganizationAdmin } from './use-organization-role';

// Delete organization with its confirmation (#710). Once the request is
// accepted the campaign list shows the progress and the final step, so the
// item leaves while a deletion is under way.
function DeleteOrganizationControl({
  organization,
  disabled,
}: {
  organization: Organization;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { deletion, status, submit } = useOrganizationDeletion({
    organizationId: organization.id,
  });
  // Null is "none was requested"; undefined is still loading.
  if (deletion !== null) return null;
  const blocked = status.kind === 'blocked' ? status : null;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete organization"
        title="Delete organization"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
      </Button>
      <DeletionDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${organization.name}?`}
        description={
          blocked
            ? 'Not yet: some Characters need attention first.'
            : "This can't be undone."
        }
        status={status}
        confirmLabel="Start deleting"
        pendingLabel="Starting…"
        onConfirm={() => {
          void submit().then((accepted) => {
            if (accepted) setOpen(false);
          });
        }}
        failurePrefix="The organization wasn't deleted"
        unknownMessage="We couldn't confirm whether deleting started. Check the campaign list before trying again."
      >
        {blocked ? (
          <DeletionBlockedNotice
            blockers={blocked}
            container="organization"
            assignHref="/campaigns"
          />
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            <li>Every campaign is deleted first.</li>
            <li>Characters go back to their owners, outside any campaign.</li>
            <li>
              Finished weeks become unreadable once the organization is gone.
            </li>
          </ul>
        )}
      </DeletionDialog>
    </>
  );
}

// Shown only to the active organization's admins: only they can finish
// deleting it with Clerk.
export function OrganizationDeletionItem({
  organization,
  disabled,
}: {
  organization: Organization;
  disabled: boolean;
}) {
  const isAdmin = useIsOrganizationAdmin(organization.id);
  if (!isAdmin) return null;
  return (
    <DeleteOrganizationControl
      organization={organization}
      disabled={disabled}
    />
  );
}
