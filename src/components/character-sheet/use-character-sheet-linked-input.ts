'use client';

import { api } from '@convex/_generated/api';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import {
  isLinkedInputInterpretationCandidate,
  linkedInputKey,
} from '~/lib/character-sheet-linked-inputs';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import { buildLinkedInputView } from './character-sheet-linked-input-view-model';

export type LinkedInputScope = FunctionArgs<
  typeof api.characterSheetLinkedInputs.read
>;
export type LinkedInputSnapshot = FunctionReturnType<
  typeof api.characterSheetLinkedInputs.read
>;
type Editor = 'fallback' | 'interpretation';

function editorSchema(editor: Editor | null) {
  return z
    .object({ value: z.string(), sourceKey: z.string() })
    .superRefine((values, context) => {
      if (editor === 'fallback') {
        const value = values.value.trim();
        if (!/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
          context.addIssue({
            code: 'custom',
            path: ['value'],
            message: value
              ? 'Enter a finite whole number.'
              : 'Enter a fallback value.',
          });
      }
      if (editor === 'interpretation' && !values.sourceKey)
        context.addIssue({
          code: 'custom',
          path: ['sourceKey'],
          message: 'Choose an interpretation.',
        });
    });
}

export function useCharacterSheetLinkedInput({
  scope,
  snapshot,
  isAvailable = true,
  classLabel,
}: {
  scope: LinkedInputScope;
  snapshot: LinkedInputSnapshot | undefined;
  isAvailable?: boolean;
  classLabel?: string;
}) {
  const saveFallback = useMutation(api.characterSheetLinkedInputs.saveFallback);
  const clearFallback = useMutation(
    api.characterSheetLinkedInputs.clearFallback,
  );
  const saveInterpretation = useMutation(
    api.characterSheetLinkedInputs.saveInterpretation,
  );
  const clearInterpretation = useMutation(
    api.characterSheetLinkedInputs.clearInterpretation,
  );
  const maintenance = useInitialMigrationMaintenance();
  const isDisabled = !isAvailable || !snapshot || maintenance.readOnly;
  const isDisabledRef = useRef(isDisabled);
  isDisabledRef.current = isDisabled;
  const currentSnapshot = useRef(snapshot);
  currentSnapshot.current = snapshot;
  const scopeIdentity = JSON.stringify([
    scope.characterId,
    scope.relationshipId,
    linkedInputKey(scope.input),
    scope.projection ?? 'current',
  ]);
  const signature = snapshot
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(snapshot).filter(
            ([key]) =>
              !['revision', 'lastOperationId', 'updatedBy'].includes(key),
          ),
        ),
      )
    : null;
  const writeState = useEntryWriteStatus({
    subject: 'Linked input',
    scopeKey: scopeIdentity,
    signature,
    operationId: snapshot?.lastOperationId,
  });
  const { scopeKey, isCurrent } = writeState;
  const [editorState, setEditorState] = useState<{
    scopeKey: string;
    kind: Editor;
  } | null>(null);
  const editor = editorState?.scopeKey === scopeKey ? editorState.kind : null;
  const form = useForm({
    resolver: zodResolver(editorSchema(editor)),
    defaultValues: { value: '', sourceKey: '' },
  });
  const submissions = useRef(new Set<string>());
  function canWrite() {
    return isCurrent() && !isDisabledRef.current;
  }
  function buildWriteArgs() {
    return {
      characterId: scope.characterId,
      relationshipId: scope.relationshipId,
      input: scope.input,
      operationId: createCharacterSheetOperationId(),
    };
  }
  function openEditor(kind: Editor) {
    if (!canWrite() || submissions.current.has(scopeKey)) return;
    form.reset({
      value:
        snapshot?.fallback === null || snapshot?.fallback === undefined
          ? ''
          : String(snapshot.fallback),
      sourceKey: snapshot?.interpretation?.sourceKey ?? '',
    });
    writeState.resetStatus('');
    setEditorState({ scopeKey, kind });
  }
  async function submit() {
    if (!canWrite() || !editor || submissions.current.has(scopeKey))
      return false;
    submissions.current.add(scopeKey);
    try {
      const isValid = await form.trigger();
      if (!isValid || !canWrite()) return false;
      const values = form.getValues();
      if (
        editor === 'interpretation' &&
        !currentSnapshot.current?.candidates.some(
          (candidate) =>
            isLinkedInputInterpretationCandidate(candidate) &&
            candidate.sourceKey === values.sourceKey,
        )
      ) {
        form.setError('sourceKey', {
          message: 'Choose an available interpretation.',
        });
        return false;
      }
      const accepted = await writeState.write(() =>
        editor === 'fallback'
          ? saveFallback({ ...buildWriteArgs(), value: Number(values.value) })
          : saveInterpretation({
              ...buildWriteArgs(),
              sourceKey: values.sourceKey,
            }),
      );
      if (accepted && isCurrent()) setEditorState(null);
      return accepted;
    } finally {
      submissions.current.delete(scopeKey);
    }
  }
  return {
    snapshot,
    view: snapshot ? buildLinkedInputView({ snapshot, classLabel }) : null,
    isAvailable,
    isLoading: isAvailable && snapshot === undefined,
    isDisabled,
    isReadOnly: maintenance.readOnly,
    editor,
    form,
    fieldErrors: form.formState.errors,
    status: writeState.status,
    hasRemoteChange: writeState.hasRemoteChange,
    dismissRemoteChange: writeState.dismissRemoteChange,
    openFallback: () => openEditor('fallback'),
    openInterpretation: () => openEditor('interpretation'),
    closeEditor: () => {
      if (isCurrent() && !submissions.current.has(scopeKey))
        setEditorState(null);
    },
    submit,
    clearFallback: () =>
      canWrite() && !submissions.current.has(scopeKey)
        ? writeState.write(() => clearFallback(buildWriteArgs()))
        : Promise.resolve(false),
    clearInterpretation: () =>
      canWrite() && !submissions.current.has(scopeKey)
        ? writeState.write(() => clearInterpretation(buildWriteArgs()))
        : Promise.resolve(false),
  };
}
