'use client';

import { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { CharacterSheetOrigin } from '~/lib/campaign-routes';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import {
  companionAllocatedLevelsSchema,
  maxCompanionAllocatedLevels,
} from '~/lib/character-sheet-companion-sources';
import {
  sameComponents,
  type CompanionAllocatedComponents,
  type CompanionComponentRuleKind,
  type CompanionGroupPurchaseKey,
} from '~/lib/character-sheet-companion-components';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import {
  buildCompanionAllocationPoolView,
  type CompanionAllocationMemberView,
} from './character-companion-allocations-view-model';
import { useComponentEditor } from './use-companion-component-editor';

type Member = Extract<CompanionAllocationMemberView, { kind: 'allocation' }>;
const noPools: FunctionReturnType<
  typeof api.companionRelationships.listAllocationPools
> = [];
type Observed = {
  levels: number | null;
  components: CompanionAllocatedComponents | null;
  counting: boolean;
};

const allocationFormSchema = z.object({
  levels: z.string().superRefine((raw, context) => {
    const value = raw.trim();
    if (!value)
      context.addIssue({
        code: 'custom',
        message: 'Enter the effective levels to allocate.',
      });
    else if (!companionAllocatedLevelsSchema.safeParse(Number(value)).success)
      context.addIssue({
        code: 'custom',
        message: `Enter a whole number from 0 to ${maxCompanionAllocatedLevels}.`,
      });
  }),
});

/**
 * The associated Character's divided budgets: each companion's recorded
 * share, one inline editor at a time, local save feedback and a dismissible
 * notice when another player changes a share.
 */
export function useCharacterCompanionAllocations({
  scope,
  snapshot,
  origin,
  hasBudgets = true,
}: {
  scope: CharacterScope;
  snapshot: CharacterSheetSnapshot | null | undefined;
  origin?: CharacterSheetOrigin;
  /**
   * Whether any of this Character's companion sources divides levels; null
   * while that is still loading. Without one, nothing is subscribed.
   */
  hasBudgets?: boolean | null;
}) {
  const subscribed = useQuery(
    api.companionRelationships.listAllocationPools,
    snapshot && hasBudgets === true
      ? { characterId: snapshot.character._id }
      : 'skip',
  );
  const pools = snapshot && hasBudgets === false ? noPools : subscribed;
  const setSourceAllocation = useMutation(
    api.companionRelationships.setSourceAllocation,
  );
  const setGroupPurchases = useMutation(
    api.companionRelationships.setGroupPurchases,
  );
  const maintenance = useInitialMigrationMaintenance();
  const isDisabled = !snapshot || pools === undefined || maintenance.readOnly;
  const isDisabledRef = useRef(isDisabled);
  isDisabledRef.current = isDisabled;
  const views = useMemo(
    () =>
      pools?.map((pool) => buildCompanionAllocationPoolView({ pool, origin })),
    [pools, origin],
  );
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const observations = useMemo(
    () =>
      views?.flatMap((pool) =>
        pool.members.map((member) => ({
          key: `${pool.ruleKind}/${member.key}`,
          operationId: member.lastOperationId,
          value: {
            levels: member.kind === 'allocation' ? member.levels : null,
            components: member.kind === 'component' ? member.components : null,
            counting: member.counting,
          },
        })),
      ) ?? null,
    [views],
  );
  const writeState = useEntryWriteStatus<Observed>({
    subject: 'Companion allocation',
    scopeKey: `${scope.characterId}/${snapshot?.campaign?.campaignId ?? ''}`,
    observations,
    isEqual: (before, after) =>
      before.levels === after.levels &&
      sameComponents(before.components, after.components) &&
      before.counting === after.counting,
  });
  const { scopeKey, isCurrent } = writeState;
  const [editorState, setEditorState] = useState<{
    scopeKey: string;
    key: string;
    relationshipId: Member['relationshipId'];
    sourceKey: string;
  } | null>(null);
  const editor = editorState?.scopeKey === scopeKey ? editorState : null;
  const form = useForm({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: { levels: '' },
  });
  const submissions = useRef(new Set<string>());
  const canWrite = () => isCurrent() && !isDisabledRef.current;
  const componentEditing = useComponentEditor({
    scopeKey,
    isCurrent,
    canWrite,
    viewsRef,
    write: writeState.write,
    resetStatus: writeState.resetStatus,
  });
  function findLiveMember(key: string) {
    for (const pool of viewsRef.current ?? []) {
      if (pool.kind !== 'allocation') continue;
      const member = pool.members.find((item) => item.key === key);
      if (member) return { pool, member };
    }
    return null;
  }
  function write({
    member,
    levels,
  }: {
    member: Pick<Member, 'key' | 'relationshipId' | 'sourceKey'>;
    levels: number | null;
  }) {
    return writeState.write(
      () =>
        setSourceAllocation({
          relationshipId: member.relationshipId,
          sourceKey: member.sourceKey,
          levels,
          operationId: createCharacterSheetOperationId(),
        }),
      { key: member.key },
    );
  }
  async function submit() {
    if (!editor || !canWrite() || submissions.current.has(editor.key))
      return false;
    submissions.current.add(editor.key);
    try {
      const isValid = await form.trigger();
      if (!isValid || !canWrite()) return false;
      if (!findLiveMember(editor.key)) {
        form.setError('levels', {
          message: 'This companion no longer shares this budget.',
        });
        return false;
      }
      const accepted = await write({
        member: editor,
        levels: Number(form.getValues('levels').trim()),
      });
      if (accepted && isCurrent()) setEditorState(null);
      return accepted;
    } finally {
      submissions.current.delete(editor.key);
    }
  }
  return {
    pools: views,
    isLoading: Boolean(snapshot) && pools === undefined,
    isDisabled,
    isReadOnly: maintenance.readOnly,
    editor,
    form,
    fieldErrors: form.formState.errors,
    statusFor: writeState.statusFor,
    hasRemoteChange: writeState.hasRemoteChange,
    dismissRemoteChange: writeState.dismissRemoteChange,
    openEditor: (member: Member) => {
      const live = findLiveMember(member.key);
      if (!live || !canWrite() || submissions.current.has(member.key)) return;
      const prefill = live.member.levels ?? live.pool.suggestedLevels;
      form.reset({ levels: prefill === null ? '' : String(prefill) });
      writeState.resetStatus(member.key);
      setEditorState({
        scopeKey,
        key: member.key,
        relationshipId: live.member.relationshipId,
        sourceKey: live.member.sourceKey,
      });
    },
    closeEditor: () => {
      if (isCurrent() && !(editor && submissions.current.has(editor.key)))
        setEditorState(null);
    },
    submit,
    /** Remove a recorded share; the companion's progression becomes unresolved. */
    clear: (member: Member) =>
      findLiveMember(member.key) && canWrite()
        ? write({ member, levels: null })
        : Promise.resolve(false),
    /** One eidolon's divided components, edited together (#419). */
    ...componentEditing,
    /**
     * Record or remove one purchase made once for the whole brood, such as
     * Larger Brood's large evolution, on this Character's sheet.
     */
    setGroupPurchase: ({
      ruleKind,
      key,
      purchased,
    }: {
      ruleKind: CompanionComponentRuleKind;
      key: CompanionGroupPurchaseKey;
      purchased: boolean;
    }) => {
      const pool = viewsRef.current?.find(
        (item) => item.kind === 'component' && item.ruleKind === ruleKind,
      );
      if (!snapshot || pool?.kind !== 'component' || !canWrite())
        return Promise.resolve(false);
      const current = pool.groupPurchases.flatMap((item) =>
        item.purchased ? [item.key] : [],
      );
      const purchases = purchased
        ? [...new Set([...current, key])]
        : current.filter((item) => item !== key);
      return writeState.write(
        () =>
          setGroupPurchases({
            characterId: snapshot.character._id,
            ruleKind,
            purchases,
            operationId: createCharacterSheetOperationId(),
          }),
        { key: `${ruleKind}/group/${key}` },
      );
    },
  };
}
