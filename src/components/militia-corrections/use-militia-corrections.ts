'use client';
import { useMemo, useReducer, useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useCanonicalLedger } from '~/components/use-canonical-ledger';
import type { SetupCharacter } from '~/components/militia-setup/roster';
import { findSetupField } from '~/components/militia-setup/use-guided-setup';
import {
  CARRIED_REFERENCE_MESSAGE,
  newMilitiaSetup,
  type MilitiaSetup,
} from '~/lib/canonical-setup';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import {
  correctionImpact,
  stagedReferences,
  type StagedReference,
} from '~/lib/correction-staged-choices';
import {
  MILITIA_ENTRY_LABELS,
  MILITIA_SECTION_KEYS,
  mergeSection,
  militiaEntryForLocation,
  sectionValue,
  type MilitiaEntryKey,
  type MilitiaSectionKey,
} from '~/lib/militia-correction-sections';
import {
  militiaEntryFacts,
  type EntryFacts,
} from '~/lib/militia-section-facts';
import {
  holdsIdentity,
  missingIdentities,
  noCapturedFacts,
  rememberFacts,
  restorableKinds,
  restoredRow,
  type CapturedFacts,
  type MissingIdentity,
  type RestorableRow,
} from '~/lib/reference-restoration';
import {
  militiaCorrectionSchema,
  setupErrorDescriptors,
  setupWarningDescriptors,
  type SetupErrorDescriptor,
} from '~/lib/setup-validation';
import { weeklyDraftSchema } from '~/lib/weekly-draft-contract';
import {
  carriedDependencyError,
  describeChoice,
  identityNames,
  missingTitle,
  namedItemReferences,
  namedSourceReferences,
  neededByNote,
  restorationNeed,
  restoreFirstNote,
  restoreLabel,
  type AffectedChoice,
  type IdentityNames,
  type NeededBy,
} from './affected-choice-copy';
import {
  closedCorrection,
  correctionReducer,
  correctionView,
  planSectionSave,
  sendCorrection,
  type AcceptedMilitia,
  type CorrectionView,
  type SaveAttempt,
  type SavePlan,
} from './correction-lifecycle';
import {
  correctLabel,
  editingNotice,
  errorSummary,
  feedbackMessage,
  REASON_LABEL,
  reasonError,
  type ErrorSummaryItem,
} from './correction-copy';
import { sectionFieldLabels, sectionRowsPath } from './section-fields';

export type MilitiaEntryView = {
  key: MilitiaEntryKey;
  label: string;
  /** Correctable sections, or the read-only week view. */
  group: 'sections' | 'week';
  facts: EntryFacts;
  /** Advisory rules warnings for the accepted facts. */
  warnings: string[];
  /** Label of this entry's Correct button; null for read-only entries. */
  correctLabel: string | null;
  /** Identities the open week still uses that this section can restore. */
  missing: MissingEntry[];
};

/**
 * An identity the open week's choices use but the militia lacks, restored
 * under the same identity through this section's ordinary correction.
 */
export type MissingEntry = {
  key: string;
  /** "Scouts", or "A missing team" when this device never saw its facts. */
  name: string;
  /**
   * The choices that use it, linked to their phase, then restorations that
   * need it first ("Cache at Old Mill").
   */
  neededBy: NeededBy[];
  /** "Restore Scouts" or "Restore missing team for Activity slot 2". */
  restoreLabel: string;
  /**
   * "Restore Ring in Items first.": its facts refer to identities still
   * missing, so it cannot be restored yet. Null when it can.
   */
  blocked: string | null;
  /** Opens this section's correction (or adds to the open one) with it. */
  restore: () => void;
};

/** The one open correction: a section's. */
export type SectionCorrection = {
  entry: MilitiaSectionKey;
  heading: string;
  form: UseFormReturn<MilitiaSetup>;
  /** Campaign characters, for manager choices. */
  characters: SetupCharacter[];
  /** Editing, saving, conflict or week changed. */
  view: Exclude<CorrectionView, { kind: 'closed' }>;
  /** Accessible status text for the editing view, or null. */
  notice: string | null;
  /** Advisory warnings for the corrected section against the latest facts. */
  warnings: string[];
  /** Staged choices this correction would newly leave without their subject. */
  affectsWeek: AffectedChoice[];
  /** Missing identities of this section not yet restored in the form. */
  restorable: MissingEntry[];
  /** Why a restored row is needed, by its identity: "Needed by Activity slot 2". */
  rowNotes: ReadonlyMap<string, string>;
  /** Shown once a Save found errors. */
  errors: ErrorSummaryItem[];
  reason: { label: string; error: string | null };
  /** Their latest section and yours, while in conflict. */
  comparison: { theirs: EntryFacts; yours: EntryFacts } | null;
  focusField: (field: string) => void;
  save: () => void;
  cancel: () => void;
  restart: () => void;
};

export type MilitiaCorrections =
  | { status: 'loading' }
  | {
      status: 'ready';
      entries: MilitiaEntryView[];
      selected: MilitiaEntryKey;
      select: (entry: MilitiaEntryKey) => void;
      /** A correction is open: every other entry and Correct is disabled. */
      locked: boolean;
      open: (entry: MilitiaEntryKey) => void;
      correction: SectionCorrection | null;
      /** Accessible result of the last correction on this device. */
      feedback: string | null;
    };

const setupFrom = (state: CanonicalWeekState, notes = ''): MilitiaSetup => ({
  mode: 'existing',
  phase: 'upkeep',
  notes,
  state,
});

// A section editor's starting values. An accepted militia may have no
// economy yet: its editors start from empty lists, so an added item or order
// is a complete economy. Only the edited list is ever saved.
const editorFrom = (state: CanonicalWeekState): MilitiaSetup =>
  setupFrom(
    state.militiaSnapshot.economy
      ? state
      : {
          ...state,
          militiaSnapshot: {
            ...state.militiaSnapshot,
            economy: { items: [], caches: [], orders: [], markets: [] },
          },
        },
  );

function groupedWarnings(
  state: CanonicalWeekState,
  names: ReadonlyMap<string, string>,
) {
  const grouped = new Map<MilitiaEntryKey, string[]>();
  for (const warning of setupWarningDescriptors(setupFrom(state), names)) {
    const entry = militiaEntryForLocation(warning);
    if (entry)
      grouped.set(entry, [...(grouped.get(entry) ?? []), warning.message]);
  }
  return grouped;
}

// Carried context the candidate would break is an integrity error. Name what
// must stay in place of Setup's general message.
function namedErrors(
  descriptors: SetupErrorDescriptor[],
  carried: readonly StagedReference[],
  names: IdentityNames,
): SetupErrorDescriptor[] {
  if (carried.length === 0) return descriptors;
  const general = descriptors.filter(
    (descriptor) => descriptor.message === CARRIED_REFERENCE_MESSAGE,
  );
  if (general.length === 0) return descriptors;
  return [
    ...carried.map((reference) => ({
      message: carriedDependencyError(reference, names),
      kind: 'refinement' as const,
    })),
    ...descriptors.filter((descriptor) => !general.includes(descriptor)),
  ];
}

const entryGroups: Partial<Record<MilitiaEntryKey, MilitiaEntryView['group']>> =
  { weekCarried: 'week' };

// The Militia page: accepted facts by section, the one local correction and
// its lifecycle. Mount per campaign, militia and organization (keyed), so a
// scope change discards the correction and any late acknowledgement.
export function useMilitiaCorrections({
  campaignId,
  militiaId,
  draftId,
  organizationId,
  initialEntry = 'values',
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  /** The open week's draft, as currently observed. */
  draftId: string;
  organizationId: string;
  /** The entry selected first, e.g. Teams from its link. */
  initialEntry?: MilitiaEntryKey;
}): MilitiaCorrections {
  const { ledger, characters, save } = useCanonicalLedger({
    campaignId,
    militiaId,
    organizationId,
  });
  const { data: observation } = useQuery({
    ...convexQuery(api.canonicalDraftPersistence.observe, {
      campaignId,
      militiaId,
      draftId,
    }),
    throwOnError: true,
  });
  const [correction, dispatch] = useReducer(
    correctionReducer,
    closedCorrection,
  );
  const [selected, setSelected] = useState<MilitiaEntryKey>(initialEntry);
  const [candidateErrors, setCandidateErrors] = useState<
    SetupErrorDescriptor[]
  >([]);
  // Accepted facts this device has seen, so a team or settlement a
  // correction removed can be restored with them. Gone after a reload.
  const [seen, setSeen] = useState<{
    revision: number | null;
    facts: CapturedFacts;
  }>({ revision: null, facts: noCapturedFacts });
  // Set synchronously on Save, before validation settles, so a second press
  // can never send the same correction twice.
  const sending = useRef<SaveAttempt | 'validating' | null>(null);
  const form = useForm<MilitiaSetup>({
    resolver: zodResolver(militiaCorrectionSchema),
    defaultValues: newMilitiaSetup('Loyalty'),
  });
  const values = form.watch();
  const names = useMemo(
    () =>
      new Map(
        characters.map((character) => [character.characterId, character.name]),
      ),
    [characters],
  );
  const warnings = useMemo(
    () =>
      ledger
        ? groupedWarnings(ledger.state, names)
        : new Map<MilitiaEntryKey, string[]>(),
    [ledger, names],
  );
  if (!ledger) return { status: 'loading' };

  const captured =
    seen.revision === ledger.revision
      ? seen.facts
      : rememberFacts(seen.facts, ledger.state.militiaSnapshot);
  if (seen.revision !== ledger.revision)
    setSeen({ revision: ledger.revision, facts: captured });

  const accepted: AcceptedMilitia = {
    revision: ledger.revision,
    draftId,
    state: ledger.state,
  };
  const parsedDraft =
    observation?.status === 'open'
      ? weeklyDraftSchema.safeParse(observation.draft)
      : null;
  const draft = parsedDraft?.success ? parsedDraft.data : null;
  const view = correctionView(correction, accepted);
  // The newest militia settled the open correction (an unconfirmed Save now
  // shows): close it, so the page is free for the next correction.
  if (correction.kind === 'open' && view.kind === 'closed' && view.feedback)
    dispatch({ type: 'reconciled', feedback: view.feedback });
  const locked = correction.kind === 'open' && view.kind !== 'closed';
  const latest = accepted.state.militiaSnapshot;
  const identities = identityNames(latest, captured, names);
  // The open week's choices that already use something the militia lacks.
  const missing = draft
    ? missingIdentities(stagedReferences(draft, latest), captured, latest)
    : [];
  const openSection =
    correction.kind === 'open' && correction.target.kind === 'section'
      ? correction.target.section
      : null;

  // The choices that use a missing identity, then the restorations that
  // need it first.
  const neededBy = (identity: MissingIdentity): NeededBy[] => [
    ...identity.neededBy.map((reference) =>
      describeChoice(reference, campaignId, identities),
    ),
    ...identity.requiredBy.map((reference) =>
      restorationNeed(reference, identities),
    ),
  ];
  function missingEntry(
    section: MilitiaSectionKey,
    identity: MissingIdentity,
  ): MissingEntry {
    return {
      key: `${identity.kind}:${identity.id}`,
      name: missingTitle(identity, identities),
      neededBy: neededBy(identity),
      restoreLabel: restoreLabel(identity, identity.neededBy, identities),
      blocked:
        identity.requires.length > 0
          ? restoreFirstNote(identity.requires, identities)
          : null,
      restore: () => restore(section, identity),
    };
  }
  const missingOf = (section: MilitiaSectionKey) => {
    const kinds = restorableKinds(section);
    return missing.filter((identity) => kinds.includes(identity.kind));
  };

  // Safe cast: the section keys plus 'weekCarried' are every MilitiaEntryKey.
  const entries: MilitiaEntryView[] = (
    [...MILITIA_SECTION_KEYS, 'weekCarried'] as MilitiaEntryKey[]
  ).map((key) => ({
    key,
    label: MILITIA_ENTRY_LABELS[key],
    group: entryGroups[key] ?? 'sections',
    facts: militiaEntryFacts(key, ledger.state, names),
    warnings: warnings.get(key) ?? [],
    correctLabel: key === 'weekCarried' ? null : correctLabel(key),
    missing:
      key === 'weekCarried'
        ? []
        : missingOf(key).map((identity) => missingEntry(key, identity)),
  }));

  // A section edits its own facts from the newest militia.
  function open(entry: MilitiaEntryKey) {
    if (locked || entry === 'weekCarried') return;
    setSelected(entry);
    setCandidateErrors([]);
    form.reset(editorFrom(accepted.state));
    dispatch({
      type: 'open',
      target: { kind: 'section', section: entry },
      accepted,
    });
  }

  // Adds a missing identity back to the section's rows, under the same
  // identity, opening the section's correction first when none is open. It
  // saves only through that correction, with its reason.
  function restore(section: MilitiaSectionKey, identity: MissingIdentity) {
    const path = sectionRowsPath[section];
    // Snapshot integrity needs what its facts refer to restored first.
    if (!path || identity.requires.length > 0) return;
    if (locked && !(openSection === section && view.kind === 'editing')) return;
    if (!locked) open(section);
    // Safe cast: path is a restorable section's row list.
    const rows = form.getValues(path) as RestorableRow[];
    if (holdsIdentity(identity.kind, rows, identity.id)) return;
    // Safe cast: react-hook-form types values per path; these rows match the
    // section at path.
    form.setValue(path, [...rows, restoredRow(identity)] as never, {
      shouldDirty: true,
    });
  }

  // Validates the form, plans the Save and sends it. `sending` is set before
  // validation settles, so a second press can never send the same
  // correction twice. `prepare` returns null when there is nothing to send.
  function submit(
    prepare: (
      setup: MilitiaSetup,
    ) => Extract<SavePlan, { kind: 'send' }> | null,
  ) {
    if (sending.current) return;
    sending.current = 'validating';
    const release = () => {
      sending.current = null;
    };
    void form
      .handleSubmit((setup) => {
        const plan = prepare(setup);
        if (!plan) {
          release();
          return;
        }
        sending.current = plan.attempt;
        void sendCorrection(plan, setup.notes, save, dispatch).finally(() => {
          if (sending.current === plan.attempt) release();
        });
      }, release)()
      .catch(release);
  }

  // A plan that sends nothing reports why (unchanged, conflict).
  function reportUnlessSendable(plan: SavePlan) {
    if (plan.kind === 'send') return plan;
    if (plan.kind !== 'busy') dispatch({ type: plan.kind });
    return null;
  }

  // Merges the section onto the newest militia and validates the merged
  // result before sending it.
  const saveSection = (section: MilitiaSectionKey) =>
    submit((setup) => {
      const plan = reportUnlessSendable(
        planSectionSave(
          correction,
          accepted,
          section,
          sectionValue(section, setup.state.militiaSnapshot),
        ),
      );
      if (!plan) return null;
      const invalid = setupErrorDescriptors(
        setupFrom(
          { ...accepted.state, militiaSnapshot: plan.snapshot },
          setup.notes,
        ),
        militiaCorrectionSchema,
      );
      setCandidateErrors(invalid);
      return invalid.length ? null : plan;
    });

  // A choice field (Focus) has no input for the form to focus: find its
  // first choice the way guided Setup does.
  function focusField(field: string) {
    const control = findSetupField(document.body, field);
    if (control) control.focus();
    // Safe cast: react-hook-form types paths per form; field is one of this
    // form's field names.
    else form.setFocus(field as never);
  }

  const describeReason = () => ({
    label: REASON_LABEL,
    error: reasonError(values.notes, form.formState.errors.notes?.message),
  });

  function cancel() {
    setCandidateErrors([]);
    dispatch({ type: 'cancel' });
  }

  // A new correction from the newest facts: fields and the reason are
  // cleared, so it must be reviewed again.
  function restart() {
    form.reset(editorFrom(accepted.state));
    setCandidateErrors([]);
    dispatch({ type: 'restart', accepted });
  }

  function sectionCorrection(
    section: MilitiaSectionKey,
    view: Exclude<CorrectionView, { kind: 'closed' }>,
  ): SectionCorrection {
    const yours = sectionValue(section, values.state.militiaSnapshot);
    const candidate = mergeSection(section, latest, yours);
    const candidateSetup = setupFrom({
      ...accepted.state,
      militiaSnapshot: candidate,
    });
    // Named against the live week: what this correction newly breaks, and
    // carried context it may not break. Only identities are compared, so
    // an unfinished row elsewhere in the section does not hide it.
    const impact = draft
      ? correctionImpact(draft, latest, candidate)
      : { added: [], existing: [], carried: [] };
    const hasFormErrors = Object.keys(form.formState.errors).length > 0;
    const descriptors = hasFormErrors
      ? setupErrorDescriptors(values, militiaCorrectionSchema)
      : candidateErrors;
    // Items a cache or order refers to that this correction removes, or
    // that another player removed meanwhile, are named with what holds them;
    // so are settlements and characters a condition or benefit names.
    const rowsSnapshot = hasFormErrors
      ? values.state.militiaSnapshot
      : candidate;
    const errors = namedErrors(
      namedSourceReferences(
        namedItemReferences(descriptors, rowsSnapshot, {
          removing: section === 'items',
          carriedOrders: new Set(
            impact.carried.flatMap(({ location }) =>
              location.kind === 'order' ? [location.orderId] : [],
            ),
          ),
          names: identities,
        }),
        rowsSnapshot,
        identities,
      ),
      impact.carried,
      identities,
    );
    const sectionMissing = missingOf(section);
    // Safe cast: yours is the section's row list in the correction form.
    const rows = Array.isArray(yours) ? (yours as RestorableRow[]) : [];
    return {
      entry: section,
      heading: correctLabel(section),
      form,
      characters,
      view,
      notice: view.kind === 'editing' ? editingNotice(view) : null,
      warnings: setupWarningDescriptors(candidateSetup, names)
        .filter((warning) => militiaEntryForLocation(warning) === section)
        .map((warning) => warning.message),
      affectsWeek: impact.added.map((reference) =>
        describeChoice(reference, campaignId, identities),
      ),
      restorable: sectionMissing
        .filter((identity) => !holdsIdentity(identity.kind, rows, identity.id))
        .map((identity) => missingEntry(section, identity)),
      rowNotes: new Map(
        sectionMissing.map((identity) => [
          identity.id,
          neededByNote(neededBy(identity).map((need) => need.label)),
        ]),
      ),
      errors: errorSummary(errors, values, {
        ...sectionFieldLabels(section, values.state.militiaSnapshot),
        notes: { label: REASON_LABEL },
      }),
      reason: describeReason(),
      comparison:
        view.kind === 'conflict'
          ? {
              theirs: militiaEntryFacts(section, accepted.state, names),
              yours: militiaEntryFacts(
                section,
                { ...accepted.state, militiaSnapshot: candidate },
                names,
              ),
            }
          : null,
      focusField,
      save: () => saveSection(section),
      cancel,
      restart,
    };
  }

  function currentCorrection() {
    if (correction.kind !== 'open' || view.kind === 'closed') return null;
    const { target } = correction;
    return target.kind === 'section'
      ? sectionCorrection(target.section, view)
      : null;
  }

  const feedback =
    view.kind === 'closed' && view.feedback
      ? feedbackMessage(view.feedback)
      : null;

  return {
    status: 'ready',
    entries,
    selected,
    select: (entry) => {
      if (!locked) setSelected(entry);
    },
    locked,
    open,
    correction: currentCorrection(),
    feedback,
  };
}
