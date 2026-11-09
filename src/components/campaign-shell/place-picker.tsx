'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { campaignPath } from '~/lib/campaign-routes';
import type { TopBarNavigation } from './app-navigation-presentation';
import { useNavigationGuard } from './navigation-guard';

const CAMPAIGNS_PLACE = '__campaigns';
const CHARACTERS_PLACE = '__characters';

function placeHref(value: string) {
  if (value === CAMPAIGNS_PLACE) return '/campaigns';
  if (value === CHARACTERS_PLACE) return '/characters';
  return campaignPath(value);
}

// Where you are: the two areas and the active organization's campaigns. On
// phone it is the whole top bar title; from tablet width it appears as the
// campaign crumb only inside a campaign (the area links cover the top level).
export function PlacePicker({
  nav,
}: {
  nav: Pick<TopBarNavigation, 'campaign' | 'campaigns' | 'activeTab'>;
}) {
  const guard = useNavigationGuard();
  const area =
    nav.activeTab === 'characters' ? CHARACTERS_PLACE : CAMPAIGNS_PLACE;
  return (
    <Select
      value={nav.campaign?.id ?? area}
      onValueChange={(value) => guard.navigate(placeHref(value))}
    >
      <SelectTrigger
        aria-label="Where you are"
        title={nav.campaign?.name}
        className={cn(
          'hover:bg-foreground/10 min-h-9 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm font-medium shadow-none *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate md:w-fit md:max-w-[11rem] md:flex-initial xl:max-w-[16rem] dark:bg-transparent',
          !nav.campaign && 'md:hidden',
        )}
      >
        <SelectValue>
          {nav.campaign?.name ??
            (nav.activeTab === 'characters' ? 'Characters' : 'Campaigns')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CAMPAIGNS_PLACE} className="min-h-11">
          Campaigns
        </SelectItem>
        <SelectItem value={CHARACTERS_PLACE} className="min-h-11">
          Characters
        </SelectItem>
        {nav.campaigns.length > 0 ? <SelectSeparator /> : null}
        {nav.campaigns.map((item) => (
          <SelectItem key={item.id} value={item.id} className="min-h-11">
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
