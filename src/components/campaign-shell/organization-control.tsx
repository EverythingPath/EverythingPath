'use client';
import { useEffect, useState } from 'react';
import {
  useAuth,
  useClerk,
  useOrganization,
  useOrganizationList,
} from '@clerk/nextjs';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  organizationSwitchPath,
  PERSONAL_ORGANIZATION,
} from '~/lib/campaign-routes';
import { Plus, Settings2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import { useNavigationGuard } from './navigation-guard';
import { OrganizationDeletionItem } from './organization-deletion-item';

// App-owned organization controls so every identity change waits for the
// departure decision: Clerk's stock switcher activates the organization before
// any redirect, which would drop a campaign editor with pending work. The
// shown value always follows Clerk's actual active organization. Creating and
// managing organizations reuse Clerk's own modals (their membership roles
// apply unchanged); opening them is guarded too, because finishing either
// can change the active organization.
export function OrganizationControl({
  className,
  fill = false,
}: {
  className?: string;
  /** Take the row's full width (phone More sheet) instead of a bar-sized cap. */
  fill?: boolean;
}) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const clerk = useClerk();
  const list = useOrganizationList({ userMemberships: { infinite: true } });
  const guard = useNavigationGuard();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectUrl = organizationSwitchPath(
    pathname,
    searchParams?.toString(),
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const memberships = list.isLoaded ? list.userMemberships : null;
  const loadMore =
    memberships && memberships.hasNextPage && !memberships.isFetching
      ? memberships.fetchNext
      : null;
  useEffect(() => {
    loadMore?.();
  }, [loadMore]);
  if (!authLoaded || !isSignedIn) return null;
  if (!list.isLoaded || !memberships)
    return (
      <Skeleton
        role="status"
        aria-label="Loading organizations"
        className="h-8 w-28"
      />
    );
  const value = organization?.id ?? PERSONAL_ORGANIZATION;
  const setActive = list.setActive;
  const choose = (next: string) => {
    if (next === value) return;
    guard.requestDeparture({
      commit: async () => {
        setBusy(true);
        setFailed(false);
        try {
          await setActive({
            organization: next === PERSONAL_ORGANIZATION ? null : next,
            redirectUrl,
          });
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      },
    });
  };
  const create = () =>
    guard.requestDeparture({
      commit: () =>
        clerk.openCreateOrganization({
          afterCreateOrganizationUrl: redirectUrl,
        }),
    });
  const manage = () =>
    guard.requestDeparture({
      commit: () => clerk.openOrganizationProfile(),
    });
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1',
        fill ? 'w-full items-stretch' : 'items-end',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-0.5">
        <Select value={value} onValueChange={choose} disabled={busy}>
          <SelectTrigger
            aria-label="Organization"
            title={organization?.name ?? 'Personal account'}
            className={cn(
              'min-h-8 min-w-0 border-0 bg-transparent px-1 text-sm shadow-none *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate dark:bg-transparent',
              // 8rem from 768px keeps a section page's top bar on one row
              // at tablet landscape (1180 and 1194px) beside the full
              // section labels; from 1280px there is room again.
              fill
                ? 'w-full flex-1'
                : 'max-w-[10rem] md:max-w-[8rem] xl:max-w-[14rem]',
            )}
          >
            <SelectValue placeholder="Organization" />
          </SelectTrigger>
          <SelectContent>
            {memberships.data.map((membership) => (
              <SelectItem
                key={membership.organization.id}
                value={membership.organization.id}
                className="min-h-11"
              >
                {membership.organization.name}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={PERSONAL_ORGANIZATION} className="min-h-11">
              Personal account
            </SelectItem>
          </SelectContent>
        </Select>
        {organization && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Manage organization"
              title="Manage organization"
              disabled={busy}
              onClick={manage}
            >
              <Settings2 aria-hidden />
            </Button>
            <OrganizationDeletionItem
              organization={{ id: organization.id, name: organization.name }}
              disabled={busy}
            />
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="New organization"
          title="New organization"
          disabled={busy}
          onClick={create}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-xs">
          The organization could not be changed.
        </p>
      )}
    </div>
  );
}
