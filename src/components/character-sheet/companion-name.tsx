'use client';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { cn } from '~/lib/utils';
import type { CompanionRelationshipView } from './character-companions-view-model';

/** The other Character's name: a guarded link while its sheet is accessible. */
export function CompanionName({
  row,
  className,
}: {
  row: Pick<CompanionRelationshipView, 'name' | 'href'>;
  className?: string;
}) {
  const text = cn('font-sans text-base [overflow-wrap:anywhere]', className);
  if (!row.href)
    return (
      <span className={cn(text, 'text-muted-foreground')}>{row.name}</span>
    );
  return (
    <GuardedLink
      href={row.href}
      className={cn(text, 'underline-offset-4 hover:underline')}
    >
      {row.name}
    </GuardedLink>
  );
}
