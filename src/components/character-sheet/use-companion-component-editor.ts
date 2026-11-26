'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useRef, useState, type RefObject } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import {
  companionComponentLabels,
  mapComponents,
  maxCompanionComponentValue,
  type CompanionAllocatedComponents,
} from '~/lib/character-sheet-companion-components';
import type {
  CompanionAllocationMemberView,
  CompanionAllocationPoolView,
} from './character-companion-allocations-view-model';

type ComponentMember = Extract<
  CompanionAllocationMemberView,
  { kind: 'component' }
>;

// Every component is required: a missing share would leave the eidolon
// unresolved, so the editor records all of them together (#419).
const componentFormSchema = z.object(
  mapComponents((key) =>
    z.string().superRefine((raw, context) => {
      const value = raw.trim();
      if (!value)
        context.addIssue({
          code: 'custom',
          message: `Enter the ${companionComponentLabels[key]} to allocate.`,
        });
      else if (
        !/^\d+$/.test(value) ||
        Number(value) > maxCompanionComponentValue
      )
        context.addIssue({
          code: 'custom',
          message: `Enter a whole number from 0 to ${maxCompanionComponentValue}.`,
        });
    }),
  ),
);
type ComponentDraft = z.infer<typeof componentFormSchema>;
const emptyComponentDraft: ComponentDraft = mapComponents(() => '');

/**
 * One eidolon's divided components, edited together (#419): one editor at a
 * time, prefilled from the recorded share or the brood's remaining budget.
 * Save status and remote-change notices belong to the allocations hook.
 */
export function useComponentEditor({
  scopeKey,
  isCurrent,
  canWrite,
  viewsRef,
  write,
  resetStatus,
}: {
  scopeKey: string;
  isCurrent: () => boolean;
  canWrite: () => boolean;
  viewsRef: RefObject<CompanionAllocationPoolView[] | undefined>;
  write: (
    action: () => Promise<unknown>,
    options: { key: string },
  ) => Promise<boolean>;
  resetStatus: (key: string) => void;
}) {
  const setSourceAllocation = useMutation(
    api.companionRelationships.setSourceAllocation,
  );
  const [editorState, setEditorState] = useState<{
    scopeKey: string;
    key: string;
    relationshipId: ComponentMember['relationshipId'];
    sourceKey: string;
  } | null>(null);
  const componentEditor =
    editorState?.scopeKey === scopeKey ? editorState : null;
  const componentForm = useForm<ComponentDraft>({
    resolver: zodResolver(componentFormSchema),
    defaultValues: emptyComponentDraft,
  });
  const submissions = useRef(new Set<string>());
  function findLiveMember(key: string) {
    for (const pool of viewsRef.current ?? []) {
      if (pool.kind !== 'component') continue;
      const member = pool.members.find((item) => item.key === key);
      if (member) return { pool, member };
    }
    return null;
  }
  function writeComponents({
    member,
    components,
  }: {
    member: Pick<ComponentMember, 'key' | 'relationshipId' | 'sourceKey'>;
    components: CompanionAllocatedComponents | null;
  }) {
    return write(
      () =>
        setSourceAllocation({
          relationshipId: member.relationshipId,
          sourceKey: member.sourceKey,
          components,
          operationId: createCharacterSheetOperationId(),
        }),
      { key: member.key },
    );
  }
  async function submitComponents() {
    const editing = componentEditor;
    if (!editing || !canWrite() || submissions.current.has(editing.key))
      return false;
    submissions.current.add(editing.key);
    try {
      const isValid = await componentForm.trigger();
      if (!isValid || !canWrite()) return false;
      if (!findLiveMember(editing.key)) {
        componentForm.setError('hitDice', {
          message: 'This eidolon no longer shares this budget.',
        });
        return false;
      }
      const draft = componentForm.getValues();
      const accepted = await writeComponents({
        member: editing,
        components: mapComponents((key) => Number(draft[key].trim())),
      });
      if (accepted && isCurrent()) setEditorState(null);
      return accepted;
    } finally {
      submissions.current.delete(editing.key);
    }
  }
  return {
    componentEditor,
    componentForm,
    componentFieldErrors: componentForm.formState.errors,
    openComponentEditor: (member: ComponentMember) => {
      const live = findLiveMember(member.key);
      if (!live || !canWrite() || submissions.current.has(member.key)) return;
      // Prefill the recorded share, else what the brood has left, if any.
      componentForm.reset(
        mapComponents((key) => {
          const recorded = live.member.components?.[key];
          const remaining = live.pool.components.find(
            (item) => item.key === key,
          )?.remaining;
          const prefill =
            recorded ??
            (remaining !== null && remaining !== undefined && remaining > 0
              ? remaining
              : null);
          return prefill === null ? '' : String(prefill);
        }),
      );
      resetStatus(member.key);
      setEditorState({
        scopeKey,
        key: member.key,
        relationshipId: live.member.relationshipId,
        sourceKey: live.member.sourceKey,
      });
    },
    closeComponentEditor: () => {
      if (
        isCurrent() &&
        !(componentEditor && submissions.current.has(componentEditor.key))
      )
        setEditorState(null);
    },
    submitComponents,
    /** Remove an eidolon's recorded components; it becomes unresolved. */
    clearComponents: (member: ComponentMember) =>
      findLiveMember(member.key) && canWrite()
        ? writeComponents({ member, components: null })
        : Promise.resolve(false),
  };
}
