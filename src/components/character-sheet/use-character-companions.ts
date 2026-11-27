'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useMemo, useState } from 'react';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import {
  buildCompanionRelationshipView,
  type CompanionRelationshipView,
} from './character-companions-view-model';
import { useCompanionCandidates } from './use-companion-candidates';
import {
  useCompanionEditorForm,
  type SupportingSourceInput,
} from './use-companion-editor-form';
import { useCompanionWriteStatus } from './use-companion-write-status';
import { useCharacterCompanionProgression } from './use-character-companion-progression';
import { useCharacterCompanionAllocations } from './use-character-companion-allocations';
import { useCharacterCombinedForm } from './use-character-combined-form';
import { useCharacterCohort } from './use-character-cohort';
import { isCompanionPooledRuleKind } from '~/lib/character-sheet-companion-sources';

export type { CompanionRelationship } from './character-companions-view-model';

export function useCharacterCompanions(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
  origin?: CharacterSheetOrigin,
) {
  const progression = useCharacterCompanionProgression(scope, snapshot);
  /** A Synthesist's read-only Combined Form (#421). */
  const combinedForm = useCharacterCombinedForm(snapshot, origin);
  const relationships = useQuery(
    api.companionRelationships.list,
    snapshot ? { characterId: snapshot.character._id } : 'skip',
  );
  /** Divided budgets this Character owns for its companions (#410). */
  const allocations = useCharacterCompanionAllocations({
    scope,
    snapshot,
    origin,
    hasBudgets:
      relationships?.some(
        (row) =>
          row.role === 'companion' &&
          row.sources.some((source) =>
            isCompanionPooledRuleKind(source.ruleKind),
          ),
      ) ?? null,
  });
  const create = useMutation(api.companionRelationships.create);
  const link = useMutation(api.companionRelationships.link);
  const replace = useMutation(api.companionRelationships.replace);
  const addSource = useMutation(api.companionRelationships.addSource);
  const setSourceEnabled = useMutation(
    api.companionRelationships.setSourceEnabled,
  );
  const interrupt = useMutation(api.companionRelationships.interrupt);
  const restore = useMutation(api.companionRelationships.restore);
  const maintenance = useInitialMigrationMaintenance();
  const isAvailable = Boolean(snapshot);
  const isDisabled =
    !isAvailable || relationships === undefined || maintenance.readOnly;
  const writeState = useCompanionWriteStatus(
    `${scope.characterId}/${snapshot?.campaign?.campaignId ?? ''}`,
    relationships,
    isDisabled,
  );
  const { scopeKey, isCurrent, write } = writeState;
  const editorForm = useCompanionEditorForm({
    snapshot,
    relationships,
    scopeKey,
    isCurrent,
    isDisabled,
    resetStatus: writeState.resetStatus,
  });
  const { open, submit: submitEditor, ...editorController } = editorForm;
  const { editor, form, sourceOptions } = editorController;
  const candidateState = useCompanionCandidates(
    snapshot,
    editor?.kind === 'link' || editor?.kind === 'replace',
  );
  const { candidates } = candidateState;
  const [createdState, setCreatedState] = useState<{
    scopeKey: string;
    characterId: Id<'character'>;
  } | null>(null);
  const rows = useMemo(
    () =>
      relationships?.map((row) => buildCompanionRelationshipView(row, origin)),
    [relationships, origin],
  );
  /** A cohort's equivalence and its leader's Leadership modifiers (#417). */
  const cohort = useCharacterCohort({ scope, snapshot, rows });
  function findLiveRow(row: CompanionRelationshipView) {
    return (
      rows?.find(
        (candidate) => candidate.relationshipId === row.relationshipId,
      ) ?? null
    );
  }
  function rowWrite(
    row: CompanionRelationshipView,
    action: (
      row: CompanionRelationshipView,
      operationId: string,
    ) => Promise<unknown>,
  ) {
    const live = findLiveRow(row);
    if (!live?.canManage) return Promise.resolve(false);
    return write(row.relationshipId, () =>
      action(live, createCharacterSheetOperationId()),
    );
  }
  function submit() {
    if (!snapshot) return Promise.resolve(false);
    return submitEditor(async (values, editor) => {
      const candidate = candidates?.find(
        (row) => row.characterId === values.companionCharacterId,
      );
      if ((editor.kind === 'link' || editor.kind === 'replace') && !candidate) {
        form.setError('companionCharacterId', {
          message: 'Choose an available Character.',
        });
        return false;
      }
      const option = sourceOptions.find(
        (option) => option.key === values.sourceKey,
      );
      if (
        editor.kind !== 'replace' &&
        values.sourceKey !== 'manual' &&
        !option
      ) {
        form.setError('sourceKey', {
          message: 'Choose an available supporting source.',
        });
        return false;
      }
      const source: SupportingSourceInput = option?.source ?? {
        key: crypto.randomUUID(),
        label: values.sourceLabel,
        enabled: true,
      };
      const key =
        'relationshipId' in editor ? editor.relationshipId : editor.kind;
      return write(key, async () => {
        const operationId = createCharacterSheetOperationId();
        const input = {
          associatedCharacterId: snapshot.character._id,
          kind: values.kind,
          sources: [source],
          operationId,
        };
        if (editor.kind === 'create') {
          const created = await create({ ...input, name: values.name });
          if (isCurrent())
            setCreatedState({
              scopeKey,
              characterId: created.companionCharacterId,
            });
        } else if (candidate && editor.kind === 'link') {
          await link({
            ...input,
            companionCharacterId: candidate.characterId,
          });
        } else if (candidate && editor.kind === 'replace') {
          const row = relationships?.find(
            (row) => row.relationshipId === editor.relationshipId,
          );
          if (!row || !buildCompanionRelationshipView(row, origin).canReplace)
            throw new Error('This relationship is no longer available.');
          await replace({
            relationshipId: row.relationshipId,
            companionCharacterId: candidate.characterId,
            operationId,
          });
        } else if (editor.kind === 'source') {
          const row = relationships?.find(
            (row) => row.relationshipId === editor.relationshipId,
          );
          if (!row || (!row.endpoint && row.role !== 'companion'))
            throw new Error('This relationship is no longer available.');
          await addSource({
            relationshipId: row.relationshipId,
            source,
            operationId,
          });
        }
      });
    });
  }
  return {
    progression,
    allocations,
    combinedForm,
    cohort,
    ...editorController,
    ...candidateState,
    rows,
    isAvailable,
    isLoading: Boolean(snapshot) && relationships === undefined,
    isDisabled,
    isReadOnly: maintenance.readOnly,
    statusFor: writeState.statusFor,
    hasRemoteChange: writeState.hasRemoteChange,
    dismissRemoteChange: writeState.dismissRemoteChange,
    openCreate: () => open({ kind: 'create' }),
    openLink: () => open({ kind: 'link' }),
    openReplace: (row: CompanionRelationshipView) => {
      if (findLiveRow(row)?.canReplace)
        open({
          kind: 'replace',
          relationshipId: row.relationshipId,
        });
    },
    openAddSource: (row: CompanionRelationshipView) => {
      if (findLiveRow(row)?.canManage)
        open({ kind: 'source', relationshipId: row.relationshipId });
    },
    setSourceEnabled: (
      row: CompanionRelationshipView,
      sourceKey: string,
      enabled: boolean,
    ) => {
      if (!findLiveRow(row)?.sources.some((source) => source.key === sourceKey))
        return Promise.resolve(false);
      return rowWrite(row, (live, operationId) =>
        setSourceEnabled({
          relationshipId: live.relationshipId,
          sourceKey,
          enabled,
          operationId,
        }),
      );
    },
    interrupt: (row: CompanionRelationshipView) => {
      if (!findLiveRow(row)?.canInterrupt) return Promise.resolve(false);
      return rowWrite(row, (live, operationId) =>
        interrupt({ relationshipId: live.relationshipId, operationId }),
      );
    },
    restore: (row: CompanionRelationshipView) => {
      if (!findLiveRow(row)?.canRestore) return Promise.resolve(false);
      return rowWrite(row, (live, operationId) =>
        restore({ relationshipId: live.relationshipId, operationId }),
      );
    },
    submit,
    createdCompanion:
      createdState?.scopeKey === scopeKey
        ? {
            characterId: createdState.characterId,
            href: characterSheetPath(createdState.characterId, origin),
          }
        : null,
    dismissCreatedCompanion: () => setCreatedState(null),
  };
}
