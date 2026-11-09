'use client';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Pencil,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { MilitiaEntryKey } from '~/lib/militia-correction-sections';
import { cn } from '~/lib/utils';
import { FactsView } from './facts-view';
import {
  MissingReferences,
  RulesWarnings,
  SectionCorrectionView,
} from './section-correction';
import type {
  MilitiaCorrections,
  MilitiaEntryView,
} from './use-militia-corrections';
import { useBreakpoint } from '~/components/use-breakpoint';

type Page = Extract<MilitiaCorrections, { status: 'ready' }>;

const action = 'min-h-11 md:min-h-9';
const row =
  'flex w-full min-h-11 items-start gap-2 border-l-4 border-transparent px-4 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset enabled:hover:bg-foreground/5 disabled:opacity-50';
const currentRow = 'border-primary bg-primary/10';

// The selected entry's Correct button, where focus returns when its
// correction closes. Only the selected entry renders one, so a single ref.
const CorrectButtonRef = createContext<RefObject<HTMLButtonElement | null>>({
  current: null,
});

const entryOf = (page: Page, key: MilitiaEntryKey) =>
  page.entries.find((entry) => entry.key === key);
const correcting = (page: Page, key: MilitiaEntryKey) =>
  page.correction !== null && page.correction.entry === key;

// The label, warning and count of one index row, shared by both layouts.
// The open correction and the count read as text, not only as icons.
function RowContent({
  entry,
  correcting,
  trailing,
}: {
  entry: MilitiaEntryView;
  correcting: boolean;
  trailing?: ReactNode;
}) {
  const { count, preview } = entry.facts;
  // Rules warnings and identities the open week still needs both warn.
  const warnings = entry.warnings.length + entry.missing.length;
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block [overflow-wrap:anywhere]">
          {entry.label}
          {correcting && <span className="sr-only">, correcting</span>}
        </span>
        {preview !== '' && (
          <span className="text-muted-foreground hidden truncate pt-0.5 text-xs xl:block">
            {preview}
          </span>
        )}
      </span>
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 pt-0.5 text-sm">
        {warnings > 0 && (
          <>
            <TriangleAlert aria-hidden className="text-primary size-4" />
            <span className="sr-only">
              {warnings} {warnings === 1 ? 'warning' : 'warnings'}
            </span>
          </>
        )}
        {count !== null && (
          <span>
            {count}
            <span className="sr-only">
              {count === 1 ? ' entry' : ' entries'}
            </span>
          </span>
        )}
        {correcting && <Pencil aria-hidden className="size-4" />}
        {trailing}
      </span>
    </>
  );
}

function WeekGroupLabel() {
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs tracking-wide uppercase">
      <Lock aria-hidden className="size-3.5 shrink-0" />
      Changes through the week
    </p>
  );
}

function Feedback({ feedback }: { feedback: string | null }) {
  if (!feedback) return null;
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
      <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{feedback}</span>
    </p>
  );
}

function CorrectButton({
  page,
  entry,
}: {
  page: Page;
  entry: MilitiaEntryView;
}) {
  const ref = useContext(CorrectButtonRef);
  if (entry.correctLabel === null) return null;
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      className={action}
      disabled={page.locked}
      onClick={() => page.open(entry.key)}
    >
      <Pencil /> {entry.correctLabel}
    </Button>
  );
}

// The selected entry: its open correction in place of the read view, or the
// facts with Correct. `wide` places the reason bar and Correct.
function Detail({
  page,
  entry,
  wide,
}: {
  page: Page;
  entry: MilitiaEntryView;
  wide: boolean;
}) {
  const headingId = useId();
  const { correction } = page;
  if (correction?.entry === entry.key)
    return (
      <div className="space-y-4">
        <Feedback feedback={page.feedback} />
        <SectionCorrectionView correction={correction} wide={wide} />
      </div>
    );
  return (
    <section
      aria-labelledby={wide ? headingId : undefined}
      className="min-w-0 space-y-4"
    >
      <Feedback feedback={page.feedback} />
      {wide && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            id={headingId}
            className="min-w-0 text-xl [overflow-wrap:anywhere]"
          >
            {entry.label}
          </h2>
          <div className="ml-auto">
            <CorrectButton page={page} entry={entry} />
          </div>
        </div>
      )}
      <RulesWarnings warnings={entry.warnings} />
      <MissingReferences entries={entry.missing} disabled={page.locked} />
      <FactsView facts={entry.facts} />
      {!wide && <CorrectButton page={page} entry={entry} />}
    </section>
  );
}

// From 768px: the index at the left, the selected entry's detail beside it.
function IndexRow({ page, entry }: { page: Page; entry: MilitiaEntryView }) {
  const selected = page.selected === entry.key;
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        disabled={page.locked && !selected}
        className={cn(row, selected && currentRow)}
        onClick={() => page.select(entry.key)}
      >
        <RowContent entry={entry} correcting={correcting(page, entry.key)} />
      </button>
    </li>
  );
}

function IndexList({
  page,
  entries,
}: {
  page: Page;
  entries: MilitiaEntryView[];
}) {
  return (
    <ul role="list">
      {entries.map((entry) => (
        <IndexRow key={entry.key} page={page} entry={entry} />
      ))}
    </ul>
  );
}

function WideLayout({ page }: { page: Page }) {
  const sections = page.entries.filter((entry) => entry.group === 'sections');
  const week = page.entries.filter((entry) => entry.group === 'week');
  const selected = entryOf(page, page.selected);
  return (
    <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] xl:mx-auto xl:max-w-6xl xl:grid-cols-[22rem_minmax(0,1fr)]">
      <nav
        aria-label="Militia sections"
        className="border-foreground/15 self-start border-r pr-2"
      >
        <IndexList page={page} entries={sections} />
        {week.length > 0 && (
          <>
            <WeekGroupLabel />
            <IndexList page={page} entries={week} />
          </>
        )}
      </nav>
      <div className="min-w-0">
        {selected && <Detail page={page} entry={selected} wide />}
      </div>
    </div>
  );
}

// Below 768px: one list of accordion rows; the selected row is expanded and
// holds the detail (Correct at the end of the facts, the editor in place).
function AccordionRow({
  page,
  entry,
}: {
  page: Page;
  entry: MilitiaEntryView;
}) {
  const id = useId();
  const headerId = `${id}-header`;
  const panelId = `${id}-panel`;
  const selected = page.selected === entry.key;
  return (
    <div className="border-foreground/15 border-b">
      <h2 className="text-base">
        <button
          type="button"
          id={headerId}
          aria-expanded={selected}
          aria-controls={panelId}
          disabled={page.locked && !selected}
          className={cn(row, selected && currentRow)}
          onClick={() => page.select(entry.key)}
        >
          <RowContent
            entry={entry}
            correcting={correcting(page, entry.key)}
            trailing={
              selected ? (
                <ChevronUp aria-hidden className="size-4 shrink-0" />
              ) : (
                <ChevronDown aria-hidden className="size-4 shrink-0" />
              )
            }
          />
        </button>
      </h2>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!selected}
        className="px-4 py-3"
      >
        {selected && <Detail page={page} entry={entry} wide={false} />}
      </div>
    </div>
  );
}

function NarrowLayout({ page }: { page: Page }) {
  const sections = page.entries.filter((entry) => entry.group === 'sections');
  const week = page.entries.filter((entry) => entry.group === 'week');
  return (
    <div className="border-foreground/15 -mx-4 border-t">
      {sections.map((entry) => (
        <AccordionRow key={entry.key} page={page} entry={entry} />
      ))}
      {week.length > 0 && <WeekGroupLabel />}
      {week.map((entry) => (
        <AccordionRow key={entry.key} page={page} entry={entry} />
      ))}
    </div>
  );
}

// The Militia page: accepted facts by entry, with one correction open in
// place. Exactly one layout is mounted, so an open correction has one set of
// controls at any width.
export function MilitiaPage({ page }: { page: Page }) {
  const wide = useBreakpoint('wide');
  const correctButton = useRef<HTMLButtonElement>(null);
  // Focus returns to Correct when a correction closes (saved, cancelled or
  // reconciled), never on the first render.
  const open = page.correction !== null;
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) correctButton.current?.focus();
    wasOpen.current = open;
  }, [open]);
  return (
    <CorrectButtonRef.Provider value={correctButton}>
      <div className="min-w-0">
        <p role="status" aria-live="polite" className="sr-only">
          {page.feedback ?? ''}
        </p>
        {wide ? <WideLayout page={page} /> : <NarrowLayout page={page} />}
      </div>
    </CorrectButtonRef.Provider>
  );
}
