import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';

// The Event phase's hierarchical labels ("Event 1", "Event 2A", "Event 2A.1")
// derived from a frozen record's own recorded tree, with the same numbering
// as the live Event phase. Which top-level events took part is read from
// recorded facts only (queued automatic events, a recorded All Is Calm and
// the recorded event guarantees); the rules engine is never consulted.

type Source = CanonicalResolutionRecord['source'];
type Occurrence = Source['event']['occurrences'][number];
type QueuedKind = Source['context']['queuedEffects'][number]['effect']['kind'];
export type RecordedOccurrence = {
  occurrence: Occurrence;
  /** The Activity choice whose candidates hold this occurrence, if any. */
  owner: StagedActionChoice | null;
  label: string;
};
type Located = Omit<RecordedOccurrence, 'label'> & {
  tree: readonly Occurrence[];
};
type Unit = { roots: Located[]; isLettered: boolean; isActive: boolean };

const candidateActions = new Set(['guarantee_event', 'manipulate_events']);

/** Whether a recorded queued effect of this kind applied in the record's week. */
export function isInForce(source: Source, kind: QueuedKind, sourceId?: string) {
  return source.context.queuedEffects.some(
    (effect) =>
      effect.effect.kind === kind &&
      effect.startsWeek <= source.week &&
      source.week <= effect.endsWeek &&
      (sourceId === undefined || effect.sourceId === sourceId),
  );
}

function locate(source: Source): Located[] {
  const tree = source.event.occurrences;
  return [
    ...tree.map((occurrence) => ({ occurrence, owner: null, tree })),
    ...source.activity.slots.flatMap(({ choice }) => {
      if (!choice || !candidateActions.has(choice.actionId)) return [];
      const events = 'candidates' in choice ? (choice.candidates ?? []) : [];
      return events.map((occurrence) => ({
        occurrence,
        owner: choice,
        tree: events,
      }));
    }),
  ];
}

/**
 * Top-level units in resolution order. All Is Calm replaces guaranteed and
 * rolled events; automatic events and a guarantee's candidates are the only
 * other ways an event takes part.
 */
function topLevelUnits(
  source: Source,
  roots: Located[],
  guaranteedChoiceIds: ReadonlySet<string>,
): Unit[] {
  const isCalm = isInForce(source, 'all_is_calm');
  const isGuaranteed = guaranteedChoiceIds.size > 0;
  const single = (root: Located): Unit => {
    const { origin } = root.occurrence;
    return {
      roots: [root],
      isLettered: false,
      isActive:
        origin.kind === 'automatic'
          ? isInForce(source, 'automatic_events', origin.sourceId)
          : !isCalm && !isGuaranteed,
    };
  };
  const candidateSets = source.activity.slots.flatMap(({ choice }) =>
    choice && candidateActions.has(choice.actionId) ? [choice.choiceId] : [],
  );
  return [
    ...roots
      .filter(
        (root) => !root.owner && root.occurrence.origin.kind === 'automatic',
      )
      .map(single),
    ...roots
      .filter((root) => !root.owner && root.occurrence.origin.kind === 'rolled')
      .map(single),
    ...candidateSets.map((choiceId) => ({
      roots: roots.filter((root) => root.owner?.choiceId === choiceId),
      isLettered: true,
      isActive: !isCalm && guaranteedChoiceIds.has(choiceId),
    })),
  ];
}

/**
 * Numbering matches the Event phase: active units in resolution order, then
 * recorded ones that took no part; a candidate set shares one number and
 * letters its candidates; nested events extend their parent's label by their
 * position among all recorded siblings.
 */
function assignLabels(
  units: Unit[],
  order: Located[],
  childrenOf: (entry: Located) => Located[],
) {
  const labels = new Map<Located, string>();
  const assign = (entry: Located, label: string) => {
    labels.set(entry, label);
    childrenOf(entry).forEach((child, index) =>
      assign(child, `${label}.${index + 1}`),
    );
  };
  const numbered = [
    ...units.filter((unit) => unit.isActive),
    ...units.filter((unit) => !unit.isActive),
  ].filter((unit) => unit.roots.length > 0);
  numbered.forEach((unit, index) =>
    unit.roots.forEach((root, position) =>
      assign(
        root,
        `Event ${index + 1}${unit.isLettered ? String.fromCharCode(65 + position) : ''}`,
      ),
    ),
  );
  let next = numbered.length;
  for (const entry of order)
    if (!labels.has(entry)) assign(entry, `Event ${++next}`);
  return labels;
}

/**
 * Every recorded occurrence in resolution order with its hierarchical label.
 * `guaranteedChoiceIds` names the Activity choices whose recorded plan
 * guaranteed an event this week.
 */
export function recordedEventTree(
  source: Source,
  guaranteedChoiceIds: ReadonlySet<string>,
): RecordedOccurrence[] {
  const located = locate(source);
  const childrenOf = (entry: Located) =>
    located.filter(
      (other) =>
        other.tree === entry.tree &&
        'parentEventId' in other.occurrence.origin &&
        other.occurrence.origin.parentEventId === entry.occurrence.eventId,
    );
  const roots = located.filter(
    (entry) => !('parentEventId' in entry.occurrence.origin),
  );
  const units = topLevelUnits(source, roots, guaranteedChoiceIds);
  // Each root before its nested events: automatic, rolled, then candidates.
  const order: Located[] = [];
  const visit = (entry: Located) => {
    order.push(entry);
    childrenOf(entry).forEach(visit);
  };
  units.flatMap((unit) => unit.roots).forEach(visit);
  for (const entry of located) if (!order.includes(entry)) order.push(entry);
  const labels = assignLabels(units, order, childrenOf);
  return order.map((entry) => ({
    occurrence: entry.occurrence,
    owner: entry.owner,
    label: labels.get(entry) ?? 'Event',
  }));
}
