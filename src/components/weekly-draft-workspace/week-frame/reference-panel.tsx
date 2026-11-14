'use client';
import {
  AlertTriangle,
  Check,
  CircleDot,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { campaignPath, historyPath } from '~/lib/campaign-routes';
import { cn } from '~/lib/utils';
import type { ReferenceFacts } from '../reference-facts';
import type { Phase, PhaseReadiness } from '../types';
import { phaseLabels } from './labels';
import {
  actionsLine,
  awaitingDecisions,
  carriedEventLine,
  notYetRecruited,
  eventChanceLine,
  officerRoles,
  stripReadiness,
  stripValues,
  teamRows,
  valueRows,
  type ValueRow,
} from './reference-copy';
import type { ReferencePanel, ReferenceTab } from './use-reference-panel';

// Read-only reference surfaces around the editor: This phase above the
// Militia / Officers / History tabs. Every value comes from the store's one
// publication; nothing here edits. Links keep this campaign and consult the
// departure guard like every other link.

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="text-muted-foreground text-xs tracking-widest uppercase">
      {children}
    </h2>
  );
}

// The current phase's open decisions and warnings, each keyed by its
// existing identity so two items with the same wording both remain.
function ThisPhase({ step }: { step: PhaseReadiness }) {
  const empty = step.requirements.length === 0 && step.warnings.length === 0;
  return (
    <section
      aria-label="This phase"
      className="bg-card border-foreground/20 space-y-2 border p-3"
    >
      <SectionHeading>This phase</SectionHeading>
      {!step.available ? (
        <p className="text-muted-foreground text-sm">No carried events.</p>
      ) : empty ? (
        <p className="flex items-center gap-1.5 text-sm">
          <Check aria-hidden className="size-4" /> Nothing left to decide.
        </p>
      ) : (
        <ul className="space-y-1 [overflow-wrap:anywhere]">
          {step.requirements.map((item) => (
            <li
              key={`requirement:${item.id}`}
              className="flex items-start gap-1.5 text-sm"
            >
              <CircleDot
                aria-hidden
                className="text-primary mt-0.5 size-3.5 shrink-0"
              />
              <span>
                <span className="sr-only">To decide: </span>
                {item.message}
              </span>
            </li>
          ))}
          {step.warnings.map((item) => (
            <li
              key={`warning:${item.id}`}
              className="flex items-start gap-1.5 text-sm text-amber-300"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <span className="sr-only">Warning: </span>
                {item.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NowAfterRows({ rows, label }: { rows: ValueRow[]; label: string }) {
  return (
    <table
      className="w-full table-fixed text-sm [overflow-wrap:anywhere]"
      aria-label={label}
    >
      <thead>
        <tr className="text-muted-foreground text-left text-xs">
          {/* Wide enough for the longest value label ("Notoriety") in the
              narrowest docked panel; long team names still wrap. */}
          <th scope="col" className="w-[36%] pb-1 font-normal">
            <span className="sr-only">Value</span>
          </th>
          <th scope="col" className="pb-1 font-normal">
            Now
          </th>
          <th scope="col" className="pb-1 font-normal">
            After the week
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-foreground/10 border-t align-top">
            <th
              scope="row"
              className="text-muted-foreground py-1 pr-2 font-normal"
            >
              {row.label}
            </th>
            <td
              className={cn(
                'py-1 pr-2 font-mono',
                row.now === notYetRecruited &&
                  'text-muted-foreground font-sans',
              )}
            >
              {row.now}
            </td>
            <td
              className={cn(
                'py-1 font-mono',
                row.after === awaitingDecisions &&
                  'text-muted-foreground font-sans',
              )}
            >
              {row.after}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MilitiaTab({
  facts,
  campaignId,
}: {
  facts: ReferenceFacts;
  campaignId: string | null;
}) {
  const teams = teamRows(facts);
  return (
    <div className="space-y-3 text-sm">
      <NowAfterRows rows={valueRows(facts)} label="Militia values" />
      <section aria-label="Teams" className="space-y-1">
        <SectionHeading>Teams</SectionHeading>
        {teams.length ? (
          <NowAfterRows rows={teams} label="Team conditions" />
        ) : (
          <p className="text-muted-foreground">No teams.</p>
        )}
      </section>
      <section aria-label="This week" className="space-y-1">
        <SectionHeading>This week</SectionHeading>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Actions</dt>
          <dd>{actionsLine(facts)}</dd>
          <dt className="text-muted-foreground">Event chance</dt>
          <dd>{eventChanceLine(facts)}</dd>
        </dl>
      </section>
      <section aria-label="Carried events" className="space-y-1">
        <SectionHeading>Carried events</SectionHeading>
        <CarriedEvents label="Now" events={facts.carriedEvents} />
        <CarriedEvents
          label="After the week"
          events={facts.afterCarriedEvents}
        />
      </section>
      {campaignId && (
        <Button asChild variant="outline" className="w-full">
          <GuardedLink href={campaignPath(campaignId, 'militia')}>
            Open militia
          </GuardedLink>
        </Button>
      )}
    </div>
  );
}

function CarriedEvents({
  label,
  events,
}: {
  label: string;
  events: ReferenceFacts['carriedEvents'] | null;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      {events === null ? (
        <p className="text-muted-foreground">{awaitingDecisions}</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-0.5">
          {events.map((event) => (
            <li key={event.eventId} className="[overflow-wrap:anywhere]">
              {carriedEventLine(event)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OfficersTab({
  facts,
  campaignId,
}: {
  facts: ReferenceFacts;
  campaignId: string | null;
}) {
  return (
    <div className="space-y-3 text-sm">
      {facts.officers.length ? (
        <ul aria-label="Roster" className="space-y-1 [overflow-wrap:anywhere]">
          {facts.officers.map((person) => (
            <li key={person.characterId}>
              <span className="font-medium">{person.name}</span>
              <span className="text-muted-foreground">
                {' '}
                · {officerRoles(person.roles)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No roster members.</p>
      )}
      {campaignId && (
        <Button asChild variant="outline" className="w-full">
          <GuardedLink href={campaignPath(campaignId, 'officers')}>
            Characters & officers
          </GuardedLink>
        </Button>
      )}
    </div>
  );
}

// Recent effective finished weeks from the existing reader (at most three,
// newest first). Its loading, failure and retry stay inside this tab.
function HistoryTab({ panel }: { panel: ReferencePanel }) {
  const { history, campaignId } = panel;
  return (
    <div className="space-y-3 text-sm">
      {!campaignId ? null : history.status === 'failed' ? (
        <FailedLoadCard noun="Recent weeks" retry={history.retry} />
      ) : history.status === 'ready' ? (
        history.weeks.length ? (
          <ul aria-label="Recent weeks" className="space-y-1">
            {history.weeks.map((item) => (
              <li key={item.week}>
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <GuardedLink
                    href={historyPath(campaignId, { week: item.week })}
                  >
                    Week {item.week}
                  </GuardedLink>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No finished weeks yet.</p>
        )
      ) : (
        <p role="status" className="text-muted-foreground">
          Loading recent weeks…
        </p>
      )}
      {campaignId && (
        <Button asChild variant="outline" className="w-full">
          <GuardedLink href={historyPath(campaignId)}>
            All finished weeks
          </GuardedLink>
        </Button>
      )}
    </div>
  );
}

export type ReferenceProps = {
  facts: ReferenceFacts;
  step: PhaseReadiness;
  panel: ReferencePanel;
};

// The shared body: This phase, then the three tabs. The tab choice is one
// piece of state so the docked panel and the phone sheet agree.
function ReferenceBody({ facts, step, panel }: ReferenceProps) {
  return (
    <div className="space-y-3">
      <ThisPhase step={step} />
      <Tabs
        value={panel.tab}
        // Safe cast: the tabs' values are the ReferenceTab names.
        onValueChange={(value) => panel.setTab(value as ReferenceTab)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="militia">Militia</TabsTrigger>
          <TabsTrigger value="officers">Officers</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="militia">
          <MilitiaTab facts={facts} campaignId={panel.campaignId} />
        </TabsContent>
        <TabsContent value="officers">
          <OfficersTab facts={facts} campaignId={panel.campaignId} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab panel={panel} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Tablet/desktop: the closable docked panel; its contents scroll within it. */
export function DockedReferencePanel(props: ReferenceProps) {
  if (!props.panel.open) return null;
  return (
    <aside
      data-week-reference
      aria-label="Reference panel"
      // relative: its visually hidden text stays in its own scroller.
      className="bg-sidebar border-foreground/15 short:p-2 relative hidden w-72 shrink-0 overflow-x-hidden overflow-y-auto border-l p-3 md:block xl:w-80"
    >
      <ReferenceBody {...props} />
    </aside>
  );
}

/** The stepper's end toggle; hidden on phone, where the strip opens the sheet. */
export function ReferencePanelToggle({ panel }: { panel: ReferencePanel }) {
  const Icon = panel.open ? PanelRightClose : PanelRightOpen;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={panel.open ? 'Hide reference panel' : 'Show reference panel'}
      aria-expanded={panel.open}
      onClick={() => panel.setOpen(!panel.open)}
      className="hidden md:inline-flex"
    >
      <Icon aria-hidden />
    </Button>
  );
}

/**
 * Phone: the strip's middle is a button showing Training and Treasury now →
 * after with the short readiness; it opens a bottom sheet holding the full
 * reference body. Focus returns to the button on dismissal (Radix).
 */
export function PhoneReferenceSheet({
  phase,
  confirmationDisabledReason,
  readinessId,
  ...props
}: ReferenceProps & {
  phase: Phase;
  confirmationDisabledReason: string | null;
  /** Names the readiness span so the strip's pinned Confirm can cite it. */
  readinessId?: string;
}) {
  const { panel, facts, step } = props;
  const readiness = stripReadiness(step, confirmationDisabledReason);
  return (
    <Sheet open={panel.sheetOpen} onOpenChange={panel.setSheetOpen}>
      <SheetTrigger asChild>
        {/* The shared Button, laid out as stacked lines (Training, Treasury,
            readiness) that fill the strip's middle; the ghost variant keeps
            the strip's background. Each value stays on one line; truncate is
            only the guard against a pathological width. */}
        <Button
          type="button"
          variant="ghost"
          data-week-strip-trigger
          className="short:min-h-9 h-auto min-h-11 min-w-0 flex-1 flex-col gap-0 rounded-sm px-1 py-0.5 text-center text-xs leading-tight font-normal whitespace-normal"
        >
          <span className="sr-only">Reference: </span>
          {stripValues(facts).map((item) => (
            <span
              key={item.label}
              className="block max-w-full truncate whitespace-nowrap"
            >
              <span className="text-muted-foreground">{item.label} </span>
              <span className="font-mono">{item.value}</span>
            </span>
          ))}
          <span
            id={readinessId}
            data-week-readiness
            className={cn(
              'block max-w-full truncate empty:hidden',
              step.requirements.length && step.phase !== 'summary'
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
          >
            {readiness}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <SheetTitle>Reference</SheetTitle>
          <SheetDescription>
            The militia now and after the week, and what {phaseLabels[phase]}{' '}
            still needs.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <ReferenceBody {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
