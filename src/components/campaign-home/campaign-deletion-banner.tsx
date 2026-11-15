'use client';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import {
  deletionBlockerReasons,
  type DeletionBlockers,
} from '~/lib/container-deletion';
import { refusalReason } from '~/lib/write-outcome';
import type { CampaignDeletion } from './delete-campaign-control';
import { DeletionBlockedNotice } from './deletion-blocked-notice';

const action = 'min-h-11 md:min-h-8';

/** "Deleting this campaign. 3 Characters are going back to their owners." */
function returningText(remaining: number, setAside: number) {
  const going =
    remaining === 0
      ? null
      : remaining === 1
        ? '1 Character is going back to its owner.'
        : `${remaining} Characters are going back to their owners.`;
  const held =
    setAside === 0
      ? null
      : `${setAside} couldn't be moved yet and will be tried again.`;
  return ['Deleting this campaign.', going, held].filter(Boolean).join(' ');
}

/** "Deleting this campaign is paused: 2 Characters need an owner." */
function pausedText(blockers: DeletionBlockers | null) {
  const { ownerless, unreturnable } = deletionBlockerReasons(
    blockers ?? { ownerless: 0, unreturnable: 0 },
  );
  const reasons = [ownerless, unreturnable].filter(Boolean);
  return reasons.length
    ? `Deleting this campaign is paused: ${reasons.join(', and ')}.`
    : 'Deleting this campaign is paused.';
}

// Progress while a campaign's Characters return (#710), for every member,
// on Campaign Home and the campaign Characters page. The campaign stays
// usable meanwhile. A paused deletion offers the way to assign owners and
// to continue; a new refusal shows the same copy as the confirmation.
export function CampaignDeletionBanner({
  campaignDeletion,
  assignHref,
}: {
  campaignDeletion: CampaignDeletion;
  /** The campaign Characters page; null when the reader is already there. */
  assignHref: string | null;
}) {
  const { deletion, status, submit } = campaignDeletion;
  if (deletion?.state !== 'returning' && deletion?.state !== 'blocked')
    return null;
  const pending = status.kind === 'pending';
  return (
    <div className="space-y-3 rounded-md border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-sm">
      <p role="status" aria-live="polite">
        {deletion.state === 'returning'
          ? returningText(deletion.remaining, deletion.setAside)
          : pausedText(deletion.blockers)}
      </p>
      {deletion.state === 'returning' ? (
        <div
          aria-hidden
          className="h-1 w-full animate-pulse rounded-full bg-amber-500/40"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {assignHref && (deletion.blockers?.ownerless ?? 0) > 0 ? (
              <Button asChild variant="outline" size="sm" className={action}>
                <GuardedLink href={assignHref}>Assign owners</GuardedLink>
              </Button>
            ) : null}
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
          </div>
          {status.kind === 'blocked' ? (
            <DeletionBlockedNotice
              blockers={status}
              container="campaign"
              assignHref={assignHref}
            />
          ) : null}
          {status.kind === 'rejected' ? (
            <p role="alert" className="text-destructive">
              Campaign wasn&apos;t deleted{refusalReason(status.message)}
            </p>
          ) : null}
          {status.kind === 'unknown' ? (
            <p role="alert" className="text-destructive">
              We couldn&apos;t confirm that deleting continued.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
