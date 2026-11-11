import {
  History,
  House,
  LayoutGrid,
  Map,
  MoreHorizontal,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import type {
  buildAppNavigation,
  NavigationLink,
  PhoneTab,
} from '~/lib/app-navigation';

// The approved shell (variant C, #213): one sticky top bar, a militia rail
// from tablet width, and on phone fixed bottom tabs with the current tab's
// pages in a strip under the top bar. Everything in the shell is presentation
// over the navigation model; `buildAppNavigation` decides what is where.
export type AppNavigation = ReturnType<typeof buildAppNavigation>;
export type TopBarNavigation = Pick<
  AppNavigation,
  'campaign' | 'campaigns' | 'sectionLinks' | 'pageStrip' | 'activeTab'
>;
export type PhoneNavigation = Pick<
  AppNavigation,
  'phoneTabs' | 'militiaUnavailable'
>;
export type PhoneNavigationTab = PhoneNavigation['phoneTabs'][number];
export type MilitiaExplanation = NonNullable<
  PhoneNavigation['militiaUnavailable']
>;

export const navigationLinkClass =
  'focus-visible:ring-ring/50 min-h-9 shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px]';
export const activeLinkClass = 'bg-background text-foreground shadow-sm';
export const idleLinkClass =
  'text-muted-foreground hover:text-foreground hover:bg-foreground/10';

export const phoneTabClass =
  'focus-visible:ring-ring/50 relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset';
export const phoneTabActiveClass =
  'bg-primary/10 text-primary before:bg-primary before:absolute before:inset-x-0 before:top-0 before:h-0.5';
export const phoneTabIdleClass = 'text-muted-foreground hover:text-foreground';

export const navigationIcons: Record<
  NavigationLink['key'] | PhoneTab,
  typeof Users
> = {
  week: LayoutGrid,
  history: History,
  militia: Shield,
  officers: Users,
  setup: Settings,
  home: House,
  campaign: Map,
  campaigns: Map,
  characters: Users,
  more: MoreHorizontal,
};
