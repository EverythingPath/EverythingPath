'use client';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { EventBlock } from './event-block';
import {
  ChanceStep,
  EventIssueNotes,
  EventStep,
  PreparationNotice,
  type EventPreparation,
} from './event-steps';
import type { EventView as EventFacts } from './types';
import { useEventEdits } from './use-event-edits';
import type { LatestOverseerSupport } from './overseer-support-facts';
import { OverseerSupportProvider } from './use-overseer-support';

// The Event phase in rules order: the chance roll, any automatic events, the
// rolled event tree (with Roll Twice children nested inside the roll that
// produced them), candidate pairs an Activity choice asks for, and the week
// outcome once everything above is in. Every step renders the view's facts;
// edits go through the gated hook only.

type EventViewProps = {
  view: EventFacts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
  preparation?: EventPreparation;
  openActivity?: () => void;
  // Opens Activity at one choice's slot, or at its top for null.
  openActivitySlot?: (slotId: string | null) => void;
  // The newest Overseer support facts, read between the edits of a move.
  latestOverseer?: LatestOverseerSupport;
};

// The week's one Overseer support is shared by every check toggle below.
export function EventView(props: EventViewProps) {
  return (
    <OverseerSupportProvider
      facts={props.view.overseer}
      edit={props.edit}
      latest={props.latestOverseer}
      disabled={props.disabled}
    >
      <EventSteps {...props} />
    </OverseerSupportProvider>
  );
}

function EventSteps({
  view,
  edit,
  disabled,
  preparation,
  openActivity,
  openActivitySlot,
}: EventViewProps) {
  const edits = useEventEdits(view, edit);
  const blockProps = {
    view,
    edit,
    disabled,
    edits,
    preparation,
    openActivitySlot,
  };
  const activeSets = view.candidates.filter((set) => set.active);
  const keptSets = view.candidates.filter(
    (set) => !set.active && set.blocks.length > 0,
  );
  const keptCount =
    view.inactive.length +
    keptSets.reduce((sum, set) => sum + set.blocks.length, 0);
  // Later steps resolve together with the outcome; the chance step alone
  // knows its own result.
  const later = view.outcome.complete ? 'resolved' : 'open';
  let number = 0;
  const next = () => ++number;
  return (
    <section
      aria-label="Event preparation"
      className="space-y-6 [&_button]:h-auto [&_button]:max-w-full [&_button]:[overflow-wrap:anywhere] [&_button]:whitespace-normal"
    >
      <PreparationNotice view={view} preparation={preparation} />
      <ChanceStep
        number={next()}
        view={view}
        edits={edits}
        disabled={disabled}
        openActivity={openActivity}
      />
      {view.automatic && (
        <EventStep
          number={next()}
          title="Automatic events"
          status={later}
          effect={view.automatic.sources
            .map(
              (source) =>
                `${source.label} (week ${source.week}) · ${source.count} automatic ${source.count === 1 ? 'event' : 'events'}`,
            )
            .join(' · ')}
        >
          {view.automatic.sources.map((source) => (
            <p
              key={source.sourceId}
              className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]"
            >
              {source.label} (week {source.week}) brings {source.count}{' '}
              automatic {source.count === 1 ? 'event' : 'events'} before the
              normal roll. A Roll Twice here is rerolled.
            </p>
          ))}
          <div className="space-y-3">
            {view.automatic.blocks.map((block) => (
              <EventBlock key={block.eventId} block={block} {...blockProps} />
            ))}
          </div>
          <EventIssueNotes issues={view.automatic.issues} />
        </EventStep>
      )}
      {view.chanceStep.applies !== 'guaranteed' &&
        (view.rolled.blocks.length > 0 ? (
          <EventStep
            number={next()}
            title="The event"
            status={later}
            effect={view.rolled.effect}
          >
            <div className="space-y-3">
              {view.rolled.blocks.map((block) => (
                <EventBlock key={block.eventId} block={block} {...blockProps} />
              ))}
            </div>
            <EventIssueNotes issues={view.rolled.issues} />
          </EventStep>
        ) : (
          <EventStep
            number={next()}
            title="The event"
            status="collapsed"
            effect={view.rolled.effect}
            collapsed={
              <>
                <p>{view.rolled.reason}</p>
                <EventIssueNotes issues={view.rolled.issues} />
              </>
            }
          />
        ))}
      {activeSets.length > 0 && (
        <EventStep
          number={next()}
          title="Event candidates"
          status={later}
          effect={activeSets.map((set) => set.label).join(' · ')}
        >
          {activeSets.map((set) => (
            <div key={set.choiceId} className="min-w-0 space-y-3">
              <div>
                <h4 className="font-medium [overflow-wrap:anywhere]">
                  {set.label}
                </h4>
                <p className="text-muted-foreground text-sm">
                  Roll on the event table twice. Both rolls are needed, then
                  choose which event happens. A Roll Twice on either is
                  rerolled.
                </p>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {set.blocks.map((block) => (
                  <EventBlock
                    key={block.eventId}
                    block={block}
                    {...blockProps}
                  />
                ))}
              </div>
              <EventIssueNotes issues={set.issues} />
            </div>
          ))}
        </EventStep>
      )}
      {view.outcome.complete ? (
        <EventStep
          number={next()}
          title="Week outcome"
          status="resolved"
          effect="Every roll and decision is in"
        >
          <ul className="space-y-1 text-sm">
            {view.outcome.lines.map((line) => (
              <li key={line} className="min-w-0 [overflow-wrap:anywhere]">
                {line}
              </li>
            ))}
          </ul>
        </EventStep>
      ) : (
        <EventStep
          number={next()}
          title="Week outcome"
          status="open"
          effect="Waiting for the steps above"
        >
          <p className="text-muted-foreground text-sm">
            The outcome is summarised here once every roll and decision above is
            in.
          </p>
        </EventStep>
      )}
      {keptCount > 0 && (
        <details
          className="min-w-0"
          // A kept event that needs repair is a blocker: never hide it.
          open={view.inactive.some((block) => block.surplus) || undefined}
        >
          <summary className="cursor-pointer text-sm font-medium">
            Kept on record, not used this week ({keptCount})
          </summary>
          <div className="mt-3 space-y-4">
            {view.inactive.length > 0 && (
              <div className="space-y-3">
                {view.inactive.map((block) => (
                  <EventBlock
                    key={block.eventId}
                    block={block}
                    {...blockProps}
                  />
                ))}
              </div>
            )}
            {keptSets.map((set) => (
              <div key={set.choiceId} className="min-w-0 space-y-3">
                <h4 className="font-medium [overflow-wrap:anywhere]">
                  {set.label}
                </h4>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {set.blocks.map((block) => (
                    <EventBlock
                      key={block.eventId}
                      block={block}
                      {...blockProps}
                    />
                  ))}
                </div>
                <EventIssueNotes issues={set.issues} />
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
