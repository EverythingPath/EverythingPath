'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { DeletionBlockedNotice } from './deletion-blocked-notice';
import { DeletionDialog } from './deletion-dialog';
import type { useCampaignDeletion } from './use-campaign-deletion';

export type CampaignDeletion = ReturnType<typeof useCampaignDeletion>;

// Delete campaign, with its confirmation (#710). Only prepared campaigns
// offer it; the caller decides. Once the request is accepted the dialog
// closes and the progress banner takes over.
export function DeleteCampaignControl({
  campaignName,
  campaignDeletion,
  charactersHref,
}: {
  campaignName: string;
  campaignDeletion: CampaignDeletion;
  /** The campaign Characters page, where owners are assigned. */
  charactersHref: string;
}) {
  const [open, setOpen] = useState(false);
  const { status, submit } = campaignDeletion;
  const blocked = status.kind === 'blocked' ? status : null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:text-destructive min-h-11 max-md:w-full md:min-h-9"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden /> Delete campaign
      </Button>
      <DeletionDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${campaignName}?`}
        description={
          blocked
            ? 'Not yet: some Characters need attention first.'
            : "This can't be undone."
        }
        status={status}
        confirmLabel="Delete campaign"
        pendingLabel="Deleting…"
        onConfirm={() => {
          void submit().then((accepted) => {
            if (accepted) setOpen(false);
          });
        }}
        failurePrefix="Campaign wasn't deleted"
        unknownMessage="We couldn't confirm whether the campaign is being deleted. Check again before trying once more."
      >
        {blocked ? (
          <DeletionBlockedNotice
            blockers={blocked}
            container="campaign"
            assignHref={charactersHref}
          />
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Every Character with an owner goes back to that owner, outside any
              campaign, and leaves the militia roster, officer roles and team
              management.
            </li>
            <li>
              Campaign homebrew stays with each Character as its own copy.
            </li>
            <li>
              The campaign, its militia and its campaign catalog are deleted.
            </li>
            <li>
              Finished weeks stay readable to the organization&apos;s members.
            </li>
          </ul>
        )}
      </DeletionDialog>
    </>
  );
}
