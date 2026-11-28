'use client';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import type { useOrganizationDeletion } from '~/components/campaign-shell/use-organization-deletion';
import { refusalReason } from '~/lib/write-outcome';
import { DeletionBlockedNotice } from './deletion-blocked-notice';

export type OrganizationDeletion = ReturnType<typeof useOrganizationDeletion>;

const action = 'min-h-11 md:min-h-8';

type Deletion = NonNullable<OrganizationDeletion['deletion']>;
type DeletingState = 'preparing' | 'blocked' | 'ready';

/** The organization's deletion is under way, before the provider deletes it. */
export function isOrganizationDeleting(
  deletion: OrganizationDeletion['deletion'],
): deletion is Deletion & { state: DeletingState } {
  return (
    deletion?.state === 'preparing' ||
    deletion?.state === 'blocked' ||
    deletion?.state === 'ready'
  );
}

function campaigns(count: number) {
  return count === 1 ? '1 campaign' : `${count} campaigns`;
}

function Feedback({
  status,
  failurePrefix,
  unknownMessage,
}: {
  status: OrganizationDeletion['status'];
  failurePrefix: string;
  unknownMessage: string;
}) {
  switch (status.kind) {
    case 'blocked':
      return (
        <DeletionBlockedNotice
          blockers={status}
          container="organization"
          assignHref={null}
        />
      );
    case 'rejected':
      return (
        <p role="alert" className="text-destructive">
          {failurePrefix}
          {refusalReason(status.message)}
        </p>
      );
    case 'unknown':
      return (
        <p role="alert" className="text-destructive">
          {unknownMessage}
        </p>
      );
    default:
      return null;
  }
}

/** The banner's line and its action, if any, for the deletion's state. */
function bannerContent(
  deletion: Deletion & { state: DeletingState },
  { status, submit, canFinish, finish }: OrganizationDeletion,
  isAdmin: boolean,
): { text: string; control: ReactNode } {
  const pending = status.kind === 'pending';
  if (deletion.state === 'preparing')
    return {
      text: `Deleting this organization: ${campaigns(deletion.campaignsRemaining)} left.`,
      control: null,
    };
  if (deletion.state === 'blocked')
    return {
      text: `Deleting this organization is paused: ${campaigns(deletion.blockedCampaigns)} ${deletion.blockedCampaigns === 1 ? 'has' : 'have'} Characters that need an owner.`,
      control: (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={action}
          disabled={pending}
          onClick={() => void submit()}
        >
          {pending
            ? 'Continuing…'
            : status.kind === 'unknown'
              ? 'Check again'
              : 'Continue deleting'}
        </Button>
      ),
    };
  if (!isAdmin || !canFinish)
    return {
      text: 'Waiting for an admin to finish deleting this organization.',
      control: null,
    };
  return {
    text: 'Every campaign is deleted. Delete the organization to finish.',
    control: (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={action}
        disabled={pending}
        onClick={() => void finish()}
      >
        {pending ? 'Deleting…' : 'Delete organization'}
      </Button>
    ),
  };
}

// The organization's deletion on the campaign list (#710): campaigns left
// while preparing, the way to continue when a campaign paused for owners,
// and, once every campaign is gone, the admin's final step. Members who
// can't finish see that an admin will.
export function OrganizationDeletionBanner({
  organizationDeletion,
  isAdmin,
}: {
  organizationDeletion: OrganizationDeletion;
  isAdmin: boolean;
}) {
  const { deletion, status } = organizationDeletion;
  if (!isOrganizationDeleting(deletion)) return null;
  const { text, control } = bannerContent(
    deletion,
    organizationDeletion,
    isAdmin,
  );
  return (
    <div className="space-y-3 border-b border-amber-500/50 bg-amber-500/15 px-4 py-3 text-sm">
      <p role="status" aria-live="polite">
        {text}
      </p>
      {control ? (
        <div className="flex flex-wrap items-center gap-2">{control}</div>
      ) : null}
      <Feedback
        status={status}
        failurePrefix={
          deletion.state === 'ready'
            ? "The organization wasn't deleted"
            : "Deleting couldn't continue"
        }
        unknownMessage={
          deletion.state === 'ready'
            ? "We couldn't confirm the organization was deleted. Check your organizations before trying again."
            : "We couldn't confirm that deleting continued."
        }
      />
    </div>
  );
}
