'use client';
import { useMemo, useReducer, useRef, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { CharacterRecord } from '~/components/character-manager/types';
import { useLedgerCorrection } from '~/components/use-canonical-ledger';
import { useStableByKey } from '~/components/use-stable-by-key';
import type { AffectedChoice } from '~/components/militia-corrections/affected-choice-copy';
import {
  closedCorrection,
  correctionReducer,
  correctionView,
  planRosterSave,
  sendCorrection,
  type AcceptedMilitia,
  type CorrectionView,
  type SaveAttempt,
  type SavePlan,
} from '~/components/militia-corrections/correction-lifecycle';
import {
  CONFLICT_HEADING,
  editingNotice,
  feedbackMessage,
  REASON_LABEL,
  REASON_LIMIT,
  reasonError,
  type ErrorSummaryItem,
} from '~/components/militia-corrections/correction-copy';
import { weekPath } from '~/lib/campaign-routes';
import { rosterOfficerSchema } from '~/lib/canonical-roster';
import {
  militiaSnapshotSchema,
  weeklySourceKey,
  type CanonicalWeekState,
} from '~/lib/canonical-weekly-source';
import {
  officerFacts,
  rosterFacts,
  type EntryFacts,
} from '~/lib/militia-section-facts';
import { ROLE_LABELS, type OfficerRole } from '~/lib/officer-board';
import {
  applyOfficerCorrection,
  applyRosterCorrection,
  assignCandidates,
  assignOfficer,
  moveOfficer,
  moveTargets,
  removeOfficer,
  type AssignCandidate,
  type Officer,
  type RosterEntry,
} from '~/lib/roster-corrections';
import { projectRosterWeek, type RosterWeek } from '~/lib/roster-week-impact';
import {
  weeklyDraftSchema,
  type WeeklyDraft,
} from '~/lib/weekly-draft-contract';
import {
  cannotJoinMessage,
  HIT_DICE_INVALID,
  hitDiceLabel,
  hitDiceSummary,
  INVALID_CORRECTION,
  MODE_HEADINGS,
  QUICK_REASONS,
  type CorrectionMode,
} from './correction-copy';
import { savePoint } from './correction-save-point';

export type { CorrectionMode };
type Snapshot = CanonicalWeekState['militiaSnapshot'];

// The two reasoned corrections of Characters & officers: Correct officers
// (assign, move and remove across the six roles) and Correct roster
// (membership and Hit Dice overrides, with their cascades). They reuse the
// Militia corrections' lifecycle: one correction open on this device, a
// required reason, and a Save applied to the newest militia, refused as a
// conflict when another player changed the roster baseline meanwhile.

const wholeNumber = /^\d+$/;
const validHitDice = (raw: string) => {
  const value = raw.trim();
  return (
    value === '' || (wholeNumber.test(value) && Number.isSafeInteger(+value))
  );
};
const correctionFormSchema = z.object({
  reason: z.string().trim().min(1, 'required').max(REASON_LIMIT, 'too long'),
  officers: z.array(rosterOfficerSchema),
  roster: z.array(
    z
      .object({
        characterId: z.string(),
        onRoster: z.boolean(),
        hitDice: z.string(),
      })
      .superRefine((entry, ctx) => {
        if (entry.onRoster && !validHitDice(entry.hitDice))
          ctx.addIssue({
            code: 'custom',
            path: ['hitDice'],
            message: HIT_DICE_INVALID,
          });
      }),
  ),
});
type CorrectionForm = z.infer<typeof correctionFormSchema>;
type RosterFormEntry = CorrectionForm['roster'][number];

const blankForm: CorrectionForm = { reason: '', officers: [], roster: [] };

// A correction's starting values: the latest assignments, and every roster
// person (in roster order) followed by every other record.
function startingValues(
  latest: Snapshot,
  records: readonly CharacterRecord[],
): CorrectionForm {
  const people = latest.roster.people.map(
    (person): RosterFormEntry => ({
      characterId: person.characterId,
      onRoster: true,
      hitDice: person.hitDice === null ? '' : String(person.hitDice),
    }),
  );
  const others = records
    .filter((record) => !people.some((p) => p.characterId === record._id))
    .map(
      (record): RosterFormEntry => ({
        characterId: record._id,
        onRoster: false,
        hitDice: '',
      }),
    );
  return {
    reason: '',
    officers: latest.roster.officers.map((officer) => ({ ...officer })),
    roster: [...people, ...others],
  };
}

// The roster the form asks for. An override that is not yet a whole number
// keeps the accepted one, so warnings and effects stay readable while it is
// fixed; Save validates it.
function rosterEntries(
  entries: readonly RosterFormEntry[],
  latest: Snapshot,
): RosterEntry[] {
  return entries
    .filter((entry) => entry.onRoster)
    .map((entry) => {
      const raw = entry.hitDice.trim();
      const accepted =
        latest.roster.people.find((p) => p.characterId === entry.characterId)
          ?.hitDice ?? null;
      return {
        characterId: entry.characterId,
        hitDice: raw === '' ? null : validHitDice(raw) ? Number(raw) : accepted,
      };
    });
}

/** Assign's offer for one role: PCs and NPCs apart. */
export type AssignOffer = {
  pcs: AssignCandidate[];
  npcs: AssignCandidate[];
};

/** A character row's roster controls while Correct roster is open. */
export type RosterRowControl = {
  onRoster: boolean;
  /** Why this record cannot join the roster yet; null when it can. */
  cannotJoin: string | null;
  setOnRoster: (onRoster: boolean) => void;
  /** The optional Hit Dice override; null while off the roster. */
  hitDice: {
    /** Form path, for the error summary's focus link. */
    field: string;
    label: string;
    /** The record's number, which a blank override follows. */
    placeholder: string;
    register: UseFormRegisterReturn;
    error: string | null;
  } | null;
};

export type OpenCorrection = {
  mode: CorrectionMode;
  /** "Correct officers" or "Correct roster". */
  heading: string;
  /** Editing, saving, conflict or week changed. */
  view: Exclude<CorrectionView, { kind: 'closed' }>;
  /** Accessible status text for the editing view, or null. */
  notice: string | null;

  // Correct officers
  /** Assign offer for a role, with each candidate's contribution. */
  candidates: (role: OfficerRole) => AssignOffer;
  assign: (role: OfficerRole, characterId: string) => void;
  /** Move to… targets for a holder: the roles they do not hold. */
  moveTargets: (
    characterId: string,
    from: OfficerRole,
  ) => { role: OfficerRole; label: string }[];
  move: (characterId: string, from: OfficerRole, to: OfficerRole) => void;
  remove: (role: OfficerRole, characterId: string) => void;

  // Correct roster
  /** A record's roster controls; null outside Correct roster. */
  rosterRow: (characterId: string) => RosterRowControl | null;

  // Above the reason
  /** "Activity actions this week: 5 → 4", or null. */
  allowance: string | null;
  /** Named cascades and lowered limits. */
  warnings: string[];
  /** Newly assigned PCs: normally a Change Officer Role action. */
  hints: string[];
  /** Go to Activity, for the hints. */
  activityHref: string;
  /** Open-week choices affected, each linked to its phase. */
  affectsWeek: AffectedChoice[];
  /** Shown once a Save found errors. */
  errors: ErrorSummaryItem[];
  focusField: (field: string) => void;
  reason: {
    label: string;
    error: string | null;
    register: UseFormRegisterReturn;
    /** Quick-pick reasons; picking one fills the reason. */
    chips: readonly string[];
    choose: (chip: string) => void;
  };
  /** While in conflict: their latest facts and yours. */
  comparison: {
    heading: string;
    theirs: EntryFacts;
    yours: EntryFacts;
  } | null;
  save: () => void;
  cancel: () => void;
  /** Start again from the newest facts; clears the reason. */
  restart: () => void;
};

export type CharacterCorrections =
  | { status: 'loading' }
  | {
      status: 'ready';
      /** The open correction's mode, or null; one at a time. */
      mode: CorrectionMode | null;
      open: (mode: CorrectionMode) => void;
      /** The corrected militia to show on the board and rows while open. */
      candidate: Snapshot | null;
      /** Accessible result of the last correction on this device. */
      feedback: string | null;
      correction: OpenCorrection | null;
    };

// Characters & officers' corrections for one campaign, militia and
// organization: mount keyed by them, so a scope change discards the open
// correction and any late result of its Save.
export function useCharacterCorrections({
  campaignId,
  militiaId,
  draftId,
  records,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  /** The open week's draft, as currently observed. */
  draftId: string;
  /** Every character record of the campaign, archived included. */
  records: CharacterRecord[];
}): CharacterCorrections {
  const { ledger, write } = useLedgerCorrection({ campaignId, militiaId });
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
  const [candidateErrors, setCandidateErrors] = useState<ErrorSummaryItem[]>(
    [],
  );
  // Set synchronously on Save, before validation settles, so a second press
  // can never send the same correction twice.
  const sending = useRef<SaveAttempt | 'validating' | null>(null);
  const form = useForm<CorrectionForm>({
    resolver: zodResolver(correctionFormSchema),
    defaultValues: blankForm,
  });
  const values = form.watch();

  const parsedDraft =
    observation?.status === 'open'
      ? weeklyDraftSchema.safeParse(observation.draft)
      : null;
  const draft: WeeklyDraft | null = parsedDraft?.success
    ? parsedDraft.data
    : null;
  const latest = ledger?.state.militiaSnapshot ?? null;
  const mode: CorrectionMode | null =
    correction.kind === 'open' && correction.target.kind !== 'section'
      ? correction.target.kind
      : null;
  const recordKinds = useMemo(
    () =>
      records.map((record) => ({
        characterId: record._id,
        kind: record.kind,
      })),
    [records],
  );

  // The corrected militia: only the assignments, or membership and overrides
  // with their cascades, applied to the newest accepted facts.
  const apply = (form: CorrectionForm) => (snapshot: Snapshot) =>
    mode === 'officers'
      ? applyOfficerCorrection(snapshot, form.officers)
      : applyRosterCorrection(
          snapshot,
          rosterEntries(form.roster, snapshot),
          recordKinds,
        );
  const candidate = latest && mode ? apply(values)(latest) : null;

  // The open week over the accepted and the corrected militia. The rules
  // projection is recomputed only when their content changes.
  const stableLatest = useStableByKey(
    latest,
    latest ? weeklySourceKey(latest) : null,
  );
  const stableCandidate = useStableByKey(
    candidate,
    candidate ? weeklySourceKey(candidate) : null,
  );
  const stableDraft = useStableByKey(
    draft,
    draft ? weeklySourceKey(draft) : null,
  );
  const before = useMemo<RosterWeek | null>(
    () =>
      stableLatest && mode
        ? projectRosterWeek(stableLatest, stableDraft)
        : null,
    [stableLatest, stableDraft, mode],
  );
  const after = useMemo<RosterWeek | null>(
    () =>
      stableCandidate ? projectRosterWeek(stableCandidate, stableDraft) : null,
    [stableCandidate, stableDraft],
  );

  if (!ledger || !latest) return { status: 'loading' };

  const accepted: AcceptedMilitia = {
    revision: ledger.revision,
    draftId,
    state: ledger.state,
  };
  const view = correctionView(correction, accepted);
  // The newest militia settled the open correction (an unconfirmed Save now
  // shows): close it, so the page is free for the next correction.
  if (correction.kind === 'open' && view.kind === 'closed' && view.feedback)
    dispatch({ type: 'reconciled', feedback: view.feedback });
  const names = new Map<string, string>(
    records.map((record) => [record._id, record.name]),
  );

  const open = (next: CorrectionMode) => {
    if (correction.kind === 'open' && view.kind !== 'closed') return;
    setCandidateErrors([]);
    form.reset(startingValues(latest, records));
    dispatch({ type: 'open', target: { kind: next }, accepted });
  };

  const feedback =
    view.kind === 'closed' && view.feedback
      ? feedbackMessage(view.feedback)
      : null;
  if (correction.kind !== 'open' || view.kind === 'closed' || !mode)
    return {
      status: 'ready',
      mode: null,
      open,
      candidate: null,
      feedback,
      correction: null,
    };

  // Safe cast: candidate is apply(values)(latest) whenever latest and mode are
  // set, and the loading and `!mode` returns above guarantee both.
  const corrected = candidate!;
  const editing = view.kind === 'editing';
  const setOfficers = (next: Officer[]) =>
    form.setValue('officers', next, { shouldDirty: true });

  // Validates the form, plans the Save against the newest militia and sends
  // it. Integrity errors of the corrected militia block it.
  function save() {
    if (sending.current) return;
    sending.current = 'validating';
    const release = () => {
      sending.current = null;
    };
    void form
      .handleSubmit((submitted) => {
        const plan: SavePlan = planRosterSave(
          correction,
          accepted,
          apply(submitted),
        );
        if (plan.kind !== 'send') {
          if (plan.kind !== 'busy') dispatch({ type: plan.kind });
          release();
          return;
        }
        const parsed = militiaSnapshotSchema.safeParse(plan.snapshot);
        if (!parsed.success) {
          setCandidateErrors([
            { field: null, kind: 'other', message: INVALID_CORRECTION },
          ]);
          release();
          return;
        }
        setCandidateErrors([]);
        sending.current = plan.attempt;
        void sendCorrection(
          plan,
          submitted.reason.trim(),
          write,
          dispatch,
        ).finally(() => {
          if (sending.current === plan.attempt) release();
        });
      }, release)()
      .catch(release);
  }

  function cancel() {
    setCandidateErrors([]);
    dispatch({ type: 'cancel' });
  }

  // A new correction from the newest facts: fields and the reason are
  // cleared, so it must be reviewed again.
  const restart = () => {
    form.reset(startingValues(latest, records));
    setCandidateErrors([]);
    dispatch({ type: 'restart', accepted });
  };

  const hasFacts = new Set(latest.characters.map((c) => c.characterId));
  const rosterRow = (characterId: string): RosterRowControl | null => {
    if (mode !== 'roster') return null;
    const index = values.roster.findIndex(
      (entry) => entry.characterId === characterId,
    );
    const entry = index >= 0 ? values.roster[index] : undefined;
    const onRoster = entry?.onRoster ?? false;
    const name = names.get(characterId) ?? 'This character';
    const level =
      latest.characters.find((c) => c.characterId === characterId)?.level ??
      records.find((record) => record._id === characterId)?.level;
    const field = `roster.${index}.hitDice` as const;
    const error =
      index >= 0
        ? (form.formState.errors.roster?.[index]?.hitDice?.message ?? null)
        : null;
    return {
      onRoster,
      cannotJoin:
        !onRoster && !hasFacts.has(characterId)
          ? cannotJoinMessage(name)
          : null,
      setOnRoster: (next) => {
        if (!editing) return;
        if (next && !onRoster && !hasFacts.has(characterId)) return;
        if (index >= 0)
          form.setValue(`roster.${index}.onRoster`, next, {
            shouldDirty: true,
          });
        else
          form.setValue(
            'roster',
            [
              ...form.getValues('roster'),
              { characterId, onRoster: next, hitDice: '' },
            ],
            { shouldDirty: true },
          );
      },
      hitDice:
        onRoster && index >= 0
          ? {
              field,
              label: hitDiceLabel(name),
              placeholder: level === undefined ? '' : String(level),
              register: form.register(field),
              error,
            }
          : null,
    };
  };

  const reasonMessage = reasonError(
    values.reason,
    form.formState.errors.reason?.message,
  );
  const reasonItems: ErrorSummaryItem[] = reasonMessage
    ? [
        {
          field: 'reason',
          kind: values.reason.trim() ? 'invalid' : 'required',
          message: reasonMessage,
        },
      ]
    : [];
  const fieldErrors: ErrorSummaryItem[] = [
    ...reasonItems,
    ...values.roster.flatMap((entry, index): ErrorSummaryItem[] =>
      form.formState.errors.roster?.[index]?.hitDice
        ? [
            {
              field: `roster.${index}.hitDice`,
              kind: 'invalid',
              message: hitDiceSummary(
                names.get(entry.characterId) ?? 'this character',
              ),
            },
          ]
        : [],
    ),
  ];
  const facts = mode === 'officers' ? officerFacts : rosterFacts;
  const point =
    before && after
      ? savePoint({
          campaignId,
          latest,
          corrected,
          names,
          draft,
          before,
          after,
        })
      : { allowance: null, warnings: [], hints: [], affectsWeek: [] };

  return {
    status: 'ready',
    mode,
    open,
    candidate: corrected,
    feedback: null,
    correction: {
      mode,
      heading: MODE_HEADINGS[mode],
      view,
      notice: view.kind === 'editing' ? editingNotice(view) : null,
      candidates: (role) => {
        const offer = assignCandidates({
          role,
          roster: corrected.roster,
          characters: corrected.characters,
          names,
          focus: corrected.focus,
        });
        return {
          pcs: offer.filter((person) => person.kind === 'pc'),
          npcs: offer.filter((person) => person.kind === 'npc'),
        };
      },
      assign: (role, characterId) => {
        if (!editing || mode !== 'officers') return;
        setOfficers(
          assignOfficer(form.getValues('officers'), role, characterId),
        );
      },
      moveTargets: (characterId, from) =>
        moveTargets(values.officers, characterId, from).map((role) => ({
          role,
          label: ROLE_LABELS[role],
        })),
      move: (characterId, from, to) => {
        if (!editing || mode !== 'officers') return;
        setOfficers(
          moveOfficer(form.getValues('officers'), characterId, from, to),
        );
      },
      remove: (role, characterId) => {
        if (!editing || mode !== 'officers') return;
        setOfficers(
          removeOfficer(form.getValues('officers'), role, characterId),
        );
      },
      rosterRow,
      ...point,
      activityHref: weekPath(campaignId, 'activity'),
      errors:
        Object.keys(form.formState.errors).length > 0
          ? fieldErrors
          : candidateErrors,
      // Safe cast: react-hook-form types paths per form; field is one of this
      // form's field names.
      focusField: (field) => form.setFocus(field as never),
      reason: {
        label: REASON_LABEL,
        error: reasonMessage,
        register: form.register('reason'),
        chips: QUICK_REASONS,
        choose: (chip) => {
          if (!editing) return;
          form.setValue('reason', chip, {
            shouldDirty: true,
            shouldValidate: form.formState.isSubmitted,
          });
        },
      },
      comparison:
        view.kind === 'conflict'
          ? {
              heading: CONFLICT_HEADING,
              theirs: facts(latest, names),
              yours: facts(corrected, names),
            }
          : null,
      save,
      cancel,
      restart,
    },
  };
}
