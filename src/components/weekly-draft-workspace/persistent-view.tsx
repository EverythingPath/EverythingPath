'use client';
import { Button } from '~/components/ui/button';
import { eventRequirement } from './event-messages';
import {
  decisionCards,
  DecisionCards,
  EndingForm,
  ExceptionBlock,
  Overview,
  ProjectedResult,
  SectionMarker,
} from './persistent-parts';
import { RivalryCheckInputs, TheftCheckInputs } from './persistent-checks';
import { persistentMessage } from './persistent-outcomes';
import { endingNeedsReason, exceptionInUse } from './persistent-sections';
import { persistentEventAnchor } from './source-anchors';
import type { PersistentSourceLink, PersistentView as Facts } from './types';
import {
  usePersistentChoice,
  type PersistentEdit,
} from './use-persistent-choice';
import {
  usePersistentCheck,
  type LatestPersistentDecision,
} from './use-persistent-check';
import { phaseLabels } from './week-frame/labels';
import type { LatestOverseerSupport } from './overseer-support-facts';
import { OverseerSupportProvider } from './use-overseer-support';
import { formatGold } from './week-frame/reference-copy';
import { useEndingForm, type EndingResult } from './use-ending-form';
import { endingFormBasis } from './persistent-ending-guard';
import type { LocalFormGuard } from './use-summary-forms';

// Persistent as one numbered section per carried event, in the order the
// rules resolve them. Each section reads its facts from the view and sends
// its decision through the choice hook; the week frame carries readiness,
// the whole-week totals and saving.

type Props = {
  view: Facts;
  edit: PersistentEdit;
  disabled: boolean;
  openSource?: (link: PersistentSourceLink) => void;
  // The newest Overseer support facts, read between the edits of a move.
  latestOverseer?: LatestOverseerSupport;
  // This device's Confirm guard, which keeps an unsaved table ending.
  localFormGuard?: LocalFormGuard;
};
type Event = Facts['events'][number];

export function PersistentView({
  view,
  edit,
  disabled,
  openSource,
  latestOverseer,
  localFormGuard,
}: Props) {
  // Check fields build their edits from the newest decision, so one never
  // replays a decision captured before a support move or a peer's edit.
  const latest: LatestPersistentDecision | undefined = latestOverseer
    ? (eventId) => {
        const facts = latestOverseer();
        if (!facts) return undefined;
        return (
          facts.source.decisions.find(
            (decision) => decision.eventId === eventId,
          ) ?? null
        );
      }
    : undefined;
  return (
    <OverseerSupportProvider
      facts={view.overseer}
      edit={edit}
      latest={latestOverseer}
      disabled={disabled}
    >
      <section
        aria-label="Persistent preparation"
        className="min-w-0 space-y-6 [&_button]:h-auto [&_button]:max-w-full [&_button]:[overflow-wrap:anywhere] [&_button]:whitespace-normal"
      >
        <Overview view={view} />
        {view.events.map((event, index) => (
          <PersistentEvent
            key={event.eventId}
            number={index + 1}
            event={event}
            view={view}
            edit={edit}
            disabled={disabled}
            openSource={openSource}
            latest={latest}
            guard={localFormGuard}
          />
        ))}
      </section>
    </OverseerSupportProvider>
  );
}

// The Ended at the table form, mounted only while that card is chosen.
function Ending({
  event,
  saved,
  notice,
  isNew,
  needsReason,
  disabled,
  guard,
  onSave,
}: {
  event: Event;
  saved: string;
  notice: string | null;
  isNew: boolean;
  needsReason: boolean;
  disabled: boolean;
  guard?: LocalFormGuard;
  onSave: (outcome: string, reason?: string) => Promise<EndingResult>;
}) {
  const ending = useEndingForm({
    eventId: event.eventId,
    subject: event.name,
    saved,
    isNew,
    needsReason,
    basis: endingFormBasis(event.decision),
    guard,
    onSave,
  });
  return <EndingForm notice={notice} disabled={disabled} ending={ending} />;
}

function savedLabel(saved: string, event: Event) {
  if (saved === 'mitigate') return event.check?.label ?? 'The saved check';
  if (saved === 'buyoff') return 'Buy off';
  if (saved === 'end') return 'Ended at the table';
  return 'Leave it';
}

function PersistentEvent({
  number,
  event,
  view,
  edit,
  disabled,
  openSource,
  latest,
  guard,
}: Omit<Props, 'latestOverseer' | 'localFormGuard'> & {
  number: number;
  event: Event;
  latest?: LatestPersistentDecision;
  guard?: LocalFormGuard;
}) {
  const choice = usePersistentChoice(event, edit, guard);
  const check = usePersistentCheck(event, edit, latest);
  const decision = event.decision;
  const cost = view.buyoffCostCopper;
  const targets = event.targetNames.length
    ? event.targetNames.join(' & ')
    : 'Militia';
  // A warning its Rules Exception block already explains is not repeated.
  const warnings = event.warnings.filter(
    (key) =>
      !event.exceptions.some(
        (exception) => key === `${event.eventId}:${exception.ruleId}`,
      ),
  );
  const requirements = event.requirements.filter(
    (key) => !key.endsWith(':exception'),
  );
  return (
    <section
      role="group"
      id={persistentEventAnchor(event.eventId)}
      tabIndex={-1}
      aria-label={event.name}
      className="border-foreground/20 focus-visible:ring-ring/50 relative min-w-0 rounded-sm border-l-2 pl-6 outline-none focus-visible:ring-[3px]"
    >
      <SectionMarker number={number} ended={event.ended} />
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold">{event.typeLabel}</h3>
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
          since week {event.startedWeek} · {event.ageWeeks}{' '}
          {event.ageWeeks === 1 ? 'week' : 'weeks'} · {event.orderLabel} ·{' '}
          {targets}
        </p>
        <ProjectedResult result={event.result} />
      </header>
      <div className="mt-3 space-y-4 pb-2">
        {event.endedBy ? (
          <p className="text-sm [overflow-wrap:anywhere]">
            <span className="text-emerald-500">Ends this week</span> · staged by{' '}
            {event.endedBy.label}.
            {openSource && (
              <>
                {' '}
                <Button
                  type="button"
                  variant="link"
                  // Only navigates, so a locked week never disables it.
                  className="text-primary h-auto p-0 align-baseline underline underline-offset-4"
                  // Safe cast: this button renders only in the
                  // `event.endedBy ?` branch, and event is a fixed view prop.
                  onClick={() => openSource(event.endedBy!.link)}
                >
                  Change it in {phaseLabels[event.endedBy.link.phase]}
                </Button>
              </>
            )}
          </p>
        ) : (
          <>
            <DecisionCards
              label={`${event.name} decision`}
              cards={decisionCards(event, cost)}
              selected={choice.selected}
              disabled={disabled}
              onChoose={choice.choose}
            />
            {choice.selected === 'buyoff' && (
              <p className="text-sm [overflow-wrap:anywhere]">
                {cost === null
                  ? 'Buyoff cost waits for earlier phases'
                  : `Buyoff cost ${formatGold(cost)} (2 × minimum treasury)`}{' '}
                · taken from the treasury at Confirmation
              </p>
            )}
            {choice.selected === 'mitigate' && event.theftCheck && (
              <TheftCheckInputs
                event={event}
                check={event.theftCheck}
                actions={check}
                disabled={disabled}
              />
            )}
            {choice.selected === 'mitigate' && event.rivalryCheck && (
              <RivalryCheckInputs
                event={event}
                check={event.rivalryCheck}
                actions={check}
                disabled={disabled}
              />
            )}
            {choice.selected === 'end' && (
              <Ending
                key={event.eventId}
                event={event}
                saved={
                  decision?.kind === 'end'
                    ? decision.acknowledgement.outcome
                    : ''
                }
                notice={
                  choice.endingUnsaved
                    ? `Not saved yet. ${savedLabel(choice.saved, event)} still applies until you save how it ended.`
                    : null
                }
                isNew={choice.endingUnsaved}
                needsReason={choice.endingUnsaved && endingNeedsReason(event)}
                disabled={disabled}
                guard={guard}
                onSave={choice.saveEnding}
              />
            )}
          </>
        )}
        {warnings.map((key) => (
          <p key={key} role="note" className="text-sm text-amber-300">
            {persistentMessage(key)}
          </p>
        ))}
        {event.exceptions.map((exception) => (
          <ExceptionBlock
            key={exception.exceptionId}
            message={persistentMessage(`${event.eventId}:${exception.ruleId}`)}
            exception={exception}
            inUse={exceptionInUse(event, exception.ruleId)}
            disabled={disabled}
            onSave={choice.saveException}
            onRemove={choice.removeException}
          />
        ))}
        {requirements.length > 0 && (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {requirements.map((key) => (
              <li key={key}>{eventRequirement(key)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
