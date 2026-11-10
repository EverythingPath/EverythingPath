'use client';

import { cn } from '~/lib/utils';
import {
  activeLinkClass,
  idleLinkClass,
  navigationLinkClass,
  type TopBarNavigation,
} from './app-navigation-presentation';
import { AppPageStrip } from './app-page-strip';
import { GuardedLink } from './navigation-guard';
import { PlacePicker } from './place-picker';
import { AccountControl, OrganizationControl } from './shell-frame';
import { KeepLink, TopBarRow } from './top-bar';

export function AppTopBar({ nav }: { nav: TopBarNavigation }) {
  return (
    <>
      <TopBarRow>
        <span className="hidden md:inline-flex">
          <KeepLink />
        </span>
        {nav.campaign ? (
          <span className="text-muted-foreground hidden md:inline" aria-hidden>
            /
          </span>
        ) : null}
        <PlacePicker nav={nav} />
        <nav
          aria-label="Sections"
          className="hidden shrink-0 items-center gap-1 md:flex"
        >
          {nav.sectionLinks.map((item) => (
            <GuardedLink
              key={item.key}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                navigationLinkClass,
                item.active ? activeLinkClass : idleLinkClass,
              )}
            >
              {item.label}
            </GuardedLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden md:inline-flex">
            <OrganizationControl />
          </span>
          <AccountControl />
        </div>
      </TopBarRow>
      <AppPageStrip links={nav.pageStrip} />
    </>
  );
}
