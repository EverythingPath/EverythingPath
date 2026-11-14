'use client';

import type { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { FunctionArgs } from 'convex/server';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import {
  companionKindLabels,
  type CompanionRelationship,
} from './character-companions-view-model';

const companionKindSchema = z.enum(
  ['animalCompanion', 'familiar', 'cohort', 'eidolon', 'unchainedEidolon'],
  { error: 'Choose a valid companion kind.' },
);

export type CompanionEditor =
  | { kind: 'create' | 'link' }
  | { kind: 'replace' | 'source'; relationshipId: Id<'companionRelationship'> };

function formSchema(editor: CompanionEditor | null) {
  return z
    .object({
      name: z.string({ error: 'Enter a valid name.' }).trim(),
      kind: companionKindSchema,
      companionCharacterId: z
        .string({ error: 'Choose a valid Character.' })
        .trim(),
      sourceLabel: z
        .string({ error: 'Enter a valid supporting source.' })
        .trim(),
      sourceKey: z
        .string({ error: 'Choose a valid supporting source.' })
        .trim(),
    })
    .superRefine((values, context) => {
      if (editor?.kind === 'create' && !values.name)
        context.addIssue({
          code: 'custom',
          path: ['name'],
          message: 'Enter a name.',
        });
      if (
        editor?.kind !== 'replace' &&
        values.sourceKey === 'manual' &&
        !values.sourceLabel
      )
        context.addIssue({
          code: 'custom',
          path: ['sourceLabel'],
          message: 'Enter a supporting source.',
        });
      if (
        (editor?.kind === 'link' || editor?.kind === 'replace') &&
        !values.companionCharacterId
      )
        context.addIssue({
          code: 'custom',
          path: ['companionCharacterId'],
          message: 'Choose a Character.',
        });
    });
}
const defaults: z.infer<ReturnType<typeof formSchema>> = {
  name: '',
  kind: 'animalCompanion',
  sourceLabel: '',
  companionCharacterId: '',
  sourceKey: 'manual',
};

export type SupportingSourceInput = FunctionArgs<
  typeof api.companionRelationships.addSource
>['source'];

function buildSupportingSourceOptions(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const options: {
    key: string;
    label: string;
    isAvailable: boolean;
    source: SupportingSourceInput;
  }[] = [];
  if (!snapshot) return options;
  for (const entry of snapshot.entries) {
    if (entry.kind !== 'classLevel') continue;
    const name =
      snapshot.catalogEntries.find(
        (row) => row._id === entry.state.classEntryId,
      )?.name ?? 'Unspecified';
    const key = `entry:${entry._id}`;
    const label = `${name} · Class Level ${entry.state.position}`;
    options.push({
      key,
      label,
      isAvailable: entry.active,
      source: { key, label, enabled: true, sheetEntryId: entry._id },
    });
  }
  for (const resolved of snapshot.calculated.resolvedEntries) {
    const { entry } = resolved;
    if (
      entry.kind === 'base' ||
      entry.kind === 'classLevel' ||
      entry.kind === 'abilityDamage' ||
      entry.kind === 'abilityDrain'
    )
      continue;
    const catalogId = 'catalogEntryId' in entry ? entry.catalogEntryId : null;
    const label =
      snapshot.catalogEntries.find((row) => row._id === catalogId)?.name ??
      'Unavailable entry';
    if ('grantKey' in entry && entry.grantKey) {
      const key = `grant:${JSON.stringify(entry.grantKey)}`;
      options.push({
        key,
        label,
        isAvailable: resolved.counting,
        source: { key, label, enabled: true, grantKey: entry.grantKey },
      });
    } else {
      const stored = snapshot.entries.find(
        (row) => row._id === (resolved.storedEntryId ?? entry._id),
      );
      if (!stored) continue;
      const key = `entry:${stored._id}`;
      options.push({
        key,
        label,
        isAvailable: resolved.counting,
        source: { key, label, enabled: true, sheetEntryId: stored._id },
      });
    }
  }
  return options;
}

export function useCompanionEditorForm({
  snapshot,
  relationships,
  scopeKey,
  isCurrent,
  isDisabled,
  resetStatus,
}: {
  snapshot: CharacterSheetSnapshot | null | undefined;
  relationships: CompanionRelationship[] | undefined;
  scopeKey: string;
  isCurrent: () => boolean;
  isDisabled: boolean;
  resetStatus: (key: string) => void;
}) {
  const [editorState, setEditorState] = useState<
    (CompanionEditor & { scopeKey: string }) | null
  >(null);
  const editor = editorState?.scopeKey === scopeKey ? editorState : null;
  const form = useForm({
    resolver: zodResolver(formSchema(editor)),
    defaultValues: defaults,
  });
  const submissions = useRef(new Set<string>());
  const sourceRelationship =
    editor?.kind === 'source'
      ? relationships?.find(
          (row) => row.relationshipId === editor.relationshipId,
        )
      : null;
  const hasAssociatedRole = sourceRelationship?.role === 'associated';
  const sourceOptions = useMemo(
    () =>
      buildSupportingSourceOptions(hasAssociatedRole ? undefined : snapshot),
    [snapshot, hasAssociatedRole],
  );
  function open(next: CompanionEditor) {
    if (!isCurrent() || isDisabled || submissions.current.has(scopeKey)) return;
    form.reset(defaults);
    resetStatus('relationshipId' in next ? next.relationshipId : next.kind);
    setEditorState({ ...next, scopeKey });
  }
  async function submit(
    onValid: (
      values: z.infer<ReturnType<typeof formSchema>>,
      editor: CompanionEditor,
    ) => Promise<boolean>,
  ) {
    if (
      !isCurrent() ||
      !editor ||
      isDisabled ||
      submissions.current.has(scopeKey)
    )
      return false;
    submissions.current.add(scopeKey);
    let isAccepted = false;
    try {
      await form.handleSubmit(async (values) => {
        isAccepted = await onValid(values, editor);
        if (isAccepted && isCurrent()) setEditorState(null);
      })();
      return isAccepted;
    } finally {
      submissions.current.delete(scopeKey);
    }
  }
  const sourceKey = form.watch('sourceKey');
  return {
    editor,
    editorKey: editor
      ? 'relationshipId' in editor
        ? editor.relationshipId
        : editor.kind
      : null,
    form,
    fieldErrors: form.formState.errors,
    sourceOptions,
    isSelectedSourceAvailable:
      sourceKey === 'manual' ||
      sourceOptions.find((option) => option.key === sourceKey)?.isAvailable ===
        true,
    kindOptions: companionKindSchema.options.map((kind) => ({
      kind,
      label: companionKindLabels[kind],
    })),
    selectSource: (sourceKey: string) => {
      form.setValue('sourceKey', sourceKey, { shouldDirty: true });
      form.setValue(
        'sourceLabel',
        sourceOptions.find((row) => row.key === sourceKey)?.label ?? '',
        { shouldDirty: true },
      );
    },
    open,
    closeEditor: () => {
      if (isCurrent() && !submissions.current.has(scopeKey))
        setEditorState(null);
    },
    submit,
  };
}
