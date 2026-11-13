import type { ReactNode } from 'react';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import type { ReviewAdjustment, ReviewException } from './review-facts';

// Shared primitives of the six-section week renderer. With no capabilities
// the renderer is a read-only record; the live Summary hands in the editing
// controls it wants shown at each seam.

export type WeekReviewCapabilities = {
  /** Live only: controls shown under an exception (reason editor / removal). */
  exception?: (note: ReviewException) => ReactNode;
  /** Live only: controls shown inside a numbered adjustment. */
  adjustment?: (adjustment: ReviewAdjustment, index: number) => ReactNode;
  /** Live only: add-adjustment kind cards and form, below the list. */
  addAdjustment?: ReactNode;
};

export const warningText = 'text-amber-700 dark:text-amber-300';
export const wrap = 'min-w-0 [overflow-wrap:anywhere]';

export function Chip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'max-w-full font-mono text-xs font-normal whitespace-normal',
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export function Frame({
  label,
  heading,
  right,
  className,
  children,
}: {
  label: string;
  heading: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        'bg-card text-card-foreground min-w-0 space-y-3 border p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 className={cn('text-base font-semibold', wrap)}>{heading}</h3>
        {right}
      </header>
      {children}
    </section>
  );
}

export function SectionNumber({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground mr-2 font-mono">{children}</span>
  );
}

export function Quoted({ label, text }: { label?: string; text: string }) {
  return (
    <p className={cn('text-sm', wrap)}>
      {label && (
        <span className="text-muted-foreground mr-2 text-xs tracking-wider uppercase">
          {label}
        </span>
      )}
      “<span>{text}</span>”
    </p>
  );
}
