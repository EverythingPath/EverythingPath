'use client';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import {
  deletionBlockerReasons,
  type DeletionBlockers,
} from '~/lib/container-deletion';

/** What the refusal is about: the thing that can't be deleted yet. */
export type DeletionContainer = 'campaign' | 'organization';

/**
 * The refusal, worded from the counts (#710): Characters that need an owner
 * before the deletion can go on, and legacy Characters that can't go back
 * to their owner yet. Both lines can apply at once.
 */
function blockedLines(
  blockers: DeletionBlockers,
  container: DeletionContainer,
) {
  const { ownerless, unreturnable } = deletionBlockerReasons(blockers);
  return [
    ownerless && `${ownerless} before this ${container} can be deleted.`,
    unreturnable && `${unreturnable}, so this ${container} can't be deleted.`,
  ].filter((line) => line !== null);
}

// The refusal with its way out: Assign owners leads to where the Needs an
// owner badges, Take ownership and Assign owner controls do the work.
// Unreturnable Characters offer no action.
export function DeletionBlockedNotice({
  blockers,
  container,
  assignHref,
}: {
  blockers: DeletionBlockers;
  container: DeletionContainer;
  /** Where owners are assigned; null when the reader is already there. */
  assignHref: string | null;
}) {
  return (
    <div role="alert" className="space-y-3 text-sm">
      {blockedLines(blockers, container).map((line) => (
        <p key={line}>{line}</p>
      ))}
      {blockers.ownerless > 0 && assignHref ? (
        <Button asChild variant="outline" className="min-h-11 md:min-h-9">
          <GuardedLink href={assignHref}>Assign owners</GuardedLink>
        </Button>
      ) : null}
    </div>
  );
}
