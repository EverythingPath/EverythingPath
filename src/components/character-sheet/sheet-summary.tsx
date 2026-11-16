'use client';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { fieldLabel } from './sheet-parts';
import { useIsUnresolved } from './unresolved-statistics';
import { SheetStatistic } from './sheet-statistic';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Calculated = Pick<
  NonNullable<Controller['sheet']>['calculated'],
  'level' | 'hitDice' | 'hp' | 'breakdowns'
>;

// From tablet width the row sticks directly under the shell's top bar, whose
// height changes with wrapping and the maintenance banner, so it is measured
// rather than assumed. The same height, plus the pinned row's own, becomes
// the document's scroll padding so a focused input or an appended level is
// never scrolled under them. A focused control also keeps a bottom margin
// from the viewport's edge (globals.css, html:has([data-sheet-summary])).
function usePinnedUnderTopBar(row: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const summary = row.current;
    const header = document.querySelector<HTMLElement>(
      '[data-shell-frame] > header',
    );
    if (!summary || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const top = header?.offsetHeight ?? 0;
      summary.style.top = `${top}px`;
      const pinned =
        getComputedStyle(summary).position === 'sticky'
          ? summary.offsetHeight
          : 0;
      document.documentElement.style.scrollPaddingTop = `${top + pinned + 8}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    observer.observe(summary);
    return () => {
      observer.disconnect();
      document.documentElement.style.scrollPaddingTop = '';
    };
  }, [row]);
}

// Level and Hit Dice are counts with nothing to explain; HP opens its
// breakdown, and while a Class Level still lacks hit points it stays "not
// complete" rather than showing the partial sum as HP.
function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start">
      <dt className={fieldLabel}>{label}</dt>
      <dd className="font-mono text-xl leading-none">{children}</dd>
    </div>
  );
}

/**
 * The summary row: the name left, level, Hit Dice and HP right. Pinned from
 * tablet width; on the phone it stacks and scrolls with the sheet so no
 * second wall of controls is fixed. The row stays compact (PRD Decision 3):
 * unresolved HP shows as a dash here and is explained under the Class
 * Levels it is summed from.
 */
export function SheetSummary({
  name,
  calculated,
  incompleteHpReason,
}: {
  name: string;
  calculated: Calculated;
  incompleteHpReason: string | null;
}) {
  const row = useRef<HTMLDivElement>(null);
  usePinnedUnderTopBar(row);
  // A familiar without its base creature has no Hit Dice to count yet.
  const isHitDiceUnresolved = useIsUnresolved('hitDice');
  return (
    <div
      ref={row}
      data-sheet-summary
      className="bg-background/95 border-foreground/15 z-20 -mx-4 mb-3 flex flex-col gap-y-1.5 border-b px-4 py-1.5 backdrop-blur md:sticky md:-mx-6 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-x-4 md:px-6"
    >
      <h1 className="min-w-0 font-sans text-xl leading-tight [overflow-wrap:anywhere] md:flex-1">
        {name}
      </h1>
      <dl className="flex flex-wrap items-end gap-x-5 gap-y-1 md:shrink-0 md:flex-nowrap md:justify-end">
        <Figure label="Level">{calculated.level}</Figure>
        <Figure label="Hit Dice">
          {isHitDiceUnresolved ? (
            <span className="text-muted-foreground text-sm">Unresolved</span>
          ) : (
            calculated.hitDice
          )}
        </Figure>
        <Figure label="HP">
          <SheetStatistic
            label="HP"
            statistic={calculated.breakdowns.hp}
            target="hp"
            incompleteReason={
              calculated.hp === null ? incompleteHpReason : null
            }
            className="-mx-1 text-xl"
          />
        </Figure>
      </dl>
    </div>
  );
}
