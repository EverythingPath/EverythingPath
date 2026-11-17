'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import {
  leadershipReputationKeySchema,
  monsterCohortKeySchema,
} from '~/lib/catalog/representative-cohorts';
import {
  maxCohortCreatureLength,
  maxCohortDeaths,
  maxCohortEquivalence,
  maxOtherLeadershipModifier,
  noLeadershipModifiers,
  type CohortEquivalenceState,
  type LeadershipModifiers,
} from '~/lib/character-sheet-cohort';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import type { CompanionRelationshipView } from './character-companions-view-model';
import {
  buildCohortView,
  buildLeadershipSourcesView,
  cohortCreatureChoices,
  leadershipCohortModifierChoices,
  leadershipReputationChoices,
  type LeadershipSourceView,
} from './character-cohort-view-model';

// Decimal whole numbers only: no exponent, hexadecimal or fraction.
const wholeNumberPattern = /^[+-]?\d+$/;
function wholeNumberField({
  empty,
  minimum,
  maximum,
}: {
  empty: string | null;
  minimum: number;
  maximum: number;
}) {
  return z.string().superRefine((raw, context) => {
    const value = raw.trim();
    if (!value) {
      if (empty) context.addIssue({ code: 'custom', message: empty });
      return;
    }
    const number = Number(value);
    if (!wholeNumberPattern.test(value) || number < minimum || number > maximum)
      context.addIssue({
        code: 'custom',
        message: `Enter a whole number from ${minimum} to ${maximum}.`,
      });
  });
}

const equivalenceFormSchema = z
  .object({
    kind: z.enum(['ordinary', 'published', 'entered']),
    creatureKey: z.string(),
    creature: z.string(),
    // An unlisted creature may be recorded before its equivalence is known.
    level: wholeNumberField({
      empty: null,
      minimum: 1,
      maximum: maxCohortEquivalence,
    }),
  })
  .superRefine((values, context) => {
    if (
      values.kind === 'published' &&
      !monsterCohortKeySchema.safeParse(values.creatureKey).success
    )
      context.addIssue({
        code: 'custom',
        path: ['creatureKey'],
        message: 'Choose a published monster cohort.',
      });
    if (values.kind !== 'entered') return;
    const creature = values.creature.trim();
    if (!creature)
      context.addIssue({
        code: 'custom',
        path: ['creature'],
        message: 'Enter the creature’s name.',
      });
    else if (creature.length > maxCohortCreatureLength)
      context.addIssue({
        code: 'custom',
        path: ['creature'],
        message: `Enter at most ${maxCohortCreatureLength} characters.`,
      });
  });
type EquivalenceForm = z.infer<typeof equivalenceFormSchema>;

const leadershipFormSchema = z.object({
  reputation: z.array(leadershipReputationKeySchema),
  hasCompanion: z.boolean(),
  differentAlignment: z.boolean(),
  cohortDeaths: wholeNumberField({
    empty: 'Enter how many cohorts were killed, or 0.',
    minimum: 0,
    maximum: maxCohortDeaths,
  }),
  other: wholeNumberField({
    empty: 'Enter the other modifiers, or 0.',
    minimum: -maxOtherLeadershipModifier,
    maximum: maxOtherLeadershipModifier,
  }),
});
type LeadershipForm = z.infer<typeof leadershipFormSchema>;
function leadershipValues(modifiers: LeadershipModifiers): LeadershipForm {
  return {
    reputation: [...modifiers.reputation],
    hasCompanion: modifiers.hasCompanion,
    differentAlignment: modifiers.differentAlignment,
    cohortDeaths: String(modifiers.cohortDeaths),
    other: String(modifiers.other),
  };
}

function equivalenceValues(
  recorded: CohortEquivalenceState | null,
): EquivalenceForm {
  if (recorded?.kind === 'published')
    return {
      kind: 'published',
      creatureKey: recorded.creatureKey,
      creature: '',
      level: '',
    };
  if (recorded?.kind === 'entered')
    return {
      kind: 'entered',
      creatureKey: '',
      creature: recorded.creature,
      level: recorded.level === null ? '' : String(recorded.level),
    };
  return { kind: 'ordinary', creatureKey: '', creature: '', level: '' };
}
function equivalenceState(
  values: EquivalenceForm,
): CohortEquivalenceState | null {
  if (values.kind === 'ordinary') return null;
  // The form's resolver already refused an unlisted key.
  if (values.kind === 'published')
    return {
      kind: 'published',
      creatureKey: monsterCohortKeySchema.parse(values.creatureKey),
    };
  const level = values.level.trim();
  return {
    kind: 'entered',
    creature: values.creature.trim(),
    level: level ? Number(level) : null,
  };
}

/**
 * Cohort controls (#417): the cohort's own Cohort Equivalence and, on a
 * leader's sheet, each cohort source's Leadership modifiers. One inline
 * editor of each kind is open at a time; failed writes keep the draft.
 */
export function useCharacterCohort({
  scope,
  snapshot,
  rows,
}: {
  scope: CharacterScope;
  snapshot: CharacterSheetSnapshot | null | undefined;
  rows: readonly CompanionRelationshipView[] | undefined;
}) {
  const setEquivalence = useMutation(api.characterSheet.setCohortEquivalence);
  const setSourceAllocation = useMutation(
    api.companionRelationships.setSourceAllocation,
  );
  const maintenance = useInitialMigrationMaintenance();
  const isDisabled = !snapshot || maintenance.readOnly;
  const isDisabledRef = useRef(isDisabled);
  isDisabledRef.current = isDisabled;
  const view = snapshot ? buildCohortView(snapshot) : null;
  const leadershipSources = (rows ?? []).flatMap((row) =>
    buildLeadershipSourcesView({ row, leader: snapshot }),
  );
  const sourcesRef = useRef(leadershipSources);
  sourcesRef.current = leadershipSources;
  const scopeKey = `${scope.characterId}/${snapshot?.campaign?.campaignId ?? ''}`;
  const equivalenceWrites = useEntryWriteStatus({
    signature: snapshot ? JSON.stringify(view?.recorded ?? null) : null,
    operationId: snapshot?.lastOperationId,
    scopeKey,
    subject: 'Cohort Equivalence',
  });
  const leadershipWrites = useEntryWriteStatus<LeadershipModifiers | null>({
    subject: 'Leadership modifiers',
    scopeKey,
    observations: rows
      ? leadershipSources.map((source) => ({
          key: source.key,
          operationId: rows.find(
            (row) => row.relationshipId === source.relationshipId,
          )?.lastOperationId,
          value: source.recorded,
        }))
      : null,
    isEqual: (before, after) =>
      JSON.stringify(before) === JSON.stringify(after),
  });
  const canWriteEquivalence = () =>
    equivalenceWrites.isCurrent() && !isDisabledRef.current;
  const canWriteLeadership = () =>
    leadershipWrites.isCurrent() && !isDisabledRef.current;

  const [equivalenceScope, setEquivalenceScope] = useState<string | null>(null);
  const isEquivalenceOpen = equivalenceScope === equivalenceWrites.scopeKey;
  const equivalenceForm = useForm<EquivalenceForm>({
    resolver: zodResolver(equivalenceFormSchema),
    defaultValues: equivalenceValues(null),
  });
  const submittingEquivalence = useRef(false);
  function writeEquivalence(equivalence: CohortEquivalenceState | null) {
    if (!snapshot) return Promise.resolve(false);
    return equivalenceWrites.write(() =>
      setEquivalence({
        ...scope,
        characterId: snapshot.character._id,
        equivalence,
        operationId: createCharacterSheetOperationId(),
      }),
    );
  }
  async function submitEquivalence() {
    if (
      !isEquivalenceOpen ||
      !canWriteEquivalence() ||
      submittingEquivalence.current
    )
      return false;
    submittingEquivalence.current = true;
    try {
      if (!(await equivalenceForm.trigger()) || !canWriteEquivalence())
        return false;
      const accepted = await writeEquivalence(
        equivalenceState(equivalenceForm.getValues()),
      );
      if (accepted && equivalenceWrites.isCurrent()) setEquivalenceScope(null);
      return accepted;
    } finally {
      submittingEquivalence.current = false;
    }
  }

  const [leadershipState, setLeadershipState] = useState<{
    scopeKey: string;
    key: string;
    relationshipId: LeadershipSourceView['relationshipId'];
    sourceKey: string;
  } | null>(null);
  const leadershipEditor =
    leadershipState?.scopeKey === leadershipWrites.scopeKey
      ? leadershipState
      : null;
  const leadershipForm = useForm<LeadershipForm>({
    resolver: zodResolver(leadershipFormSchema),
    defaultValues: leadershipValues(noLeadershipModifiers),
  });
  const leadershipSubmissions = useRef(new Set<string>());
  function writeLeadership(
    source: Pick<LeadershipSourceView, 'key' | 'relationshipId' | 'sourceKey'>,
    leadership: LeadershipModifiers | null,
  ) {
    return leadershipWrites.write(
      () =>
        setSourceAllocation({
          relationshipId: source.relationshipId,
          sourceKey: source.sourceKey,
          leadership,
          operationId: createCharacterSheetOperationId(),
        }),
      { key: source.key },
    );
  }
  const findLiveSource = (key: string) =>
    sourcesRef.current.find((source) => source.key === key) ?? null;
  async function submitLeadership() {
    const editor = leadershipEditor;
    if (
      !editor ||
      !canWriteLeadership() ||
      leadershipSubmissions.current.has(editor.key)
    )
      return false;
    leadershipSubmissions.current.add(editor.key);
    try {
      if (!(await leadershipForm.trigger()) || !canWriteLeadership())
        return false;
      if (!findLiveSource(editor.key)) {
        leadershipForm.setError('reputation', {
          message: 'This source no longer supports the cohort.',
        });
        return false;
      }
      const values = leadershipForm.getValues();
      const accepted = await writeLeadership(editor, {
        reputation: leadershipReputationKeySchema.options.filter((key) =>
          values.reputation.includes(key),
        ),
        hasCompanion: values.hasCompanion,
        differentAlignment: values.differentAlignment,
        cohortDeaths: Number(values.cohortDeaths.trim()),
        other: Number(values.other.trim()),
      });
      if (accepted && leadershipWrites.isCurrent()) setLeadershipState(null);
      return accepted;
    } finally {
      leadershipSubmissions.current.delete(editor.key);
    }
  }

  return {
    /** The cohort's own equivalence and allowed level; null otherwise. */
    view,
    creatureChoices: cohortCreatureChoices,
    reputationChoices: leadershipReputationChoices,
    cohortModifierChoices: leadershipCohortModifierChoices,
    isDisabled,
    isReadOnly: maintenance.readOnly,
    equivalenceStatus: equivalenceWrites.status,
    hasRemoteEquivalenceChange: equivalenceWrites.hasRemoteChange,
    dismissRemoteEquivalenceChange: equivalenceWrites.dismissRemoteChange,
    isEquivalenceOpen,
    equivalenceForm,
    equivalenceErrors: equivalenceForm.formState.errors,
    openEquivalence: () => {
      if (!canWriteEquivalence() || submittingEquivalence.current) return;
      equivalenceForm.reset(equivalenceValues(view?.recorded ?? null));
      equivalenceWrites.resetStatus('');
      setEquivalenceScope(equivalenceWrites.scopeKey);
    },
    closeEquivalence: () => {
      if (!submittingEquivalence.current) setEquivalenceScope(null);
    },
    submitEquivalence,
    /** Make this an ordinary cohort again; every other choice stays. */
    clearEquivalence: () =>
      canWriteEquivalence() ? writeEquivalence(null) : Promise.resolve(false),
    /** The leader's cohort sources, each with its Leadership preview. */
    leadershipSources,
    leadershipEditor,
    leadershipForm,
    leadershipErrors: leadershipForm.formState.errors,
    leadershipStatusFor: leadershipWrites.statusFor,
    hasRemoteLeadershipChange: leadershipWrites.hasRemoteChange,
    dismissRemoteLeadershipChange: leadershipWrites.dismissRemoteChange,
    openLeadership: (source: LeadershipSourceView) => {
      const live = findLiveSource(source.key);
      if (
        !live ||
        !canWriteLeadership() ||
        leadershipSubmissions.current.has(source.key)
      )
        return;
      leadershipForm.reset(leadershipValues(live.modifiers));
      leadershipWrites.resetStatus(source.key);
      setLeadershipState({
        scopeKey: leadershipWrites.scopeKey,
        key: live.key,
        relationshipId: live.relationshipId,
        sourceKey: live.sourceKey,
      });
    },
    closeLeadership: () => {
      if (
        leadershipEditor &&
        !leadershipSubmissions.current.has(leadershipEditor.key)
      )
        setLeadershipState(null);
    },
    submitLeadership,
    /** Remove the recorded modifiers: the base score applies again. */
    clearLeadership: (source: LeadershipSourceView) =>
      findLiveSource(source.key) && canWriteLeadership()
        ? writeLeadership(source, null)
        : Promise.resolve(false),
  };
}
