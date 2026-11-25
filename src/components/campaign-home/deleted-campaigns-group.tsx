'use client';
import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { recordDate } from '~/components/historical-week/finished-week-index';
import { RecordTime } from '~/components/historical-week/record-time';
import { Button } from '~/components/ui/button';
import { campaignPath } from '~/lib/campaign-routes';
import { cn } from '~/lib/utils';

export type CampaignDeletionRow = FunctionReturnType<
  typeof api.campaignDeletions.list
>['page'][number];

function DeletedCampaignRow({ row }: { row: CampaignDeletionRow }) {
  return (
    <li className="px-4 py-2.5">
      <span className="block [overflow-wrap:anywhere]">{row.campaignName}</span>
      <span className="text-muted-foreground block text-sm">
        Deleted
        {row.deletedAt !== null ? (
          <>
            {' '}
            <RecordTime date={recordDate(row.deletedAt)} />
          </>
        ) : null}
      </span>
      {row.hasHistory ? (
        <GuardedLink
          href={campaignPath(row.campaignId, 'history')}
          className="focus-visible:ring-ring/50 inline-block min-h-11 py-2 text-sm underline outline-none focus-visible:ring-[3px] md:min-h-9 md:py-1"
        >
          Finished weeks
        </GuardedLink>
      ) : (
        <span className="text-muted-foreground block py-1 text-sm">
          No finished weeks
        </span>
      )}
    </li>
  );
}

// The collapsed group of deleted campaigns under the live list (#710): each
// with when it was deleted and, when it kept finished weeks, the way to read
// them. Render only with at least one row.
export function DeletedCampaignsGroup({
  rows,
  canLoadMore = false,
  loadMore,
  className,
}: {
  rows: CampaignDeletionRow[];
  /** More deleted campaigns than this page holds. */
  canLoadMore?: boolean;
  loadMore?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className={className}>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="min-h-11 w-full justify-start rounded-none px-4 md:min-h-9"
      >
        <ChevronRight
          aria-hidden
          className={cn('transition', open ? 'rotate-90' : null)}
        />
        Deleted campaigns{' '}
        <span className="text-muted-foreground font-normal">
          ({rows.length}
          {canLoadMore ? '+' : ''})
        </span>
      </Button>
      {open ? (
        <ul id={listId} role="list" aria-label="Deleted campaigns">
          {rows.map((row) => (
            <DeletedCampaignRow key={row.campaignId} row={row} />
          ))}
          {canLoadMore && loadMore ? (
            <li className="px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                onClick={loadMore}
                className="min-h-11 md:min-h-9"
              >
                Show more
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
