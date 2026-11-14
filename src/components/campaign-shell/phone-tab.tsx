'use client';

import { cn } from '~/lib/utils';
import {
  navigationIcons,
  phoneTabActiveClass,
  phoneTabClass,
  phoneTabIdleClass,
  type PhoneNavigationTab,
} from './app-navigation-presentation';
import { GuardedLink } from './navigation-guard';

export function PhoneTab({
  item,
  onExplain,
}: {
  item: PhoneNavigationTab;
  onExplain: () => void;
}) {
  const Icon = navigationIcons[item.key];
  const className = cn(
    phoneTabClass,
    item.active ? phoneTabActiveClass : phoneTabIdleClass,
    item.unavailable &&
      'text-muted-foreground/40 hover:text-muted-foreground/40',
  );
  const content = (
    <>
      <Icon aria-hidden className="size-5" />
      <span>{item.label}</span>
    </>
  );
  if (item.href && !item.unavailable)
    return (
      <GuardedLink
        href={item.href}
        aria-current={item.active ? 'page' : undefined}
        className={className}
      >
        {content}
      </GuardedLink>
    );
  // Dimmed, never removed: the tap explains why and offers the next step.
  return (
    <button
      type="button"
      aria-disabled={item.unavailable || undefined}
      aria-haspopup="dialog"
      onClick={onExplain}
      className={className}
    >
      {content}
    </button>
  );
}
