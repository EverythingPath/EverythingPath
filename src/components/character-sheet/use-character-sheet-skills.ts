'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { sumRanksBySkill } from '~/lib/character-sheet-skills';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import { listFieldWarnings } from './class-level-warnings';
import type { SaveStatus } from './save-status';
import type { useCharacterSheet } from './use-character-sheet';
import { useSheetFormState } from './use-sheet-form-state';

type Controller = ReturnType<typeof useCharacterSheet>;
type Sheet = NonNullable<Controller['sheet']>;

/** Shares the sheet's single subscription and writes one allocation atomically. */
export function useCharacterSheetSkills(
  controller: Pick<Controller, 'sheet' | 'saveClassLevel'>,
) {
  const { sheet, saveClassLevel } = controller;
  return {
    skills: sheet?.calculated.skills ?? [],
    budgets: sheet?.calculated.budgets ?? null,
    levels: (sheet?.levels ?? []).map((row) => {
      const ranks = sumRanksBySkill(row.state.skillRanks ?? {});
      return {
        ...row,
        metadata: sheet?.calculated.classLevels.find(
          (level) => level.entryId === row._id,
        ),
        ranksFor: (key: keyof typeof ranks) => ranks[key] ?? 0,
        warnings: listFieldWarnings(
          sheet?.warnings.filter(
            (warning) =>
              warning.target.kind === 'classLevel' &&
              warning.target.entryId === row._id,
          ) ?? [],
          'skillRanks',
        ),
      };
    }),
    saveRank: (
      entryId: Sheet['levels'][number]['_id'],
      skill: string,
      ranks: number,
    ) => saveClassLevel(entryId, { skillRank: { skill, ranks } }),
  };
}

const rankField = z.string().superRefine((value, context) => {
  if (!value.trim())
    context.addIssue({ code: 'custom', message: 'Ranks are required' });
  else if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)))
    context.addIssue({
      code: 'custom',
      message: 'Ranks must be a whole number of 0 or more',
    });
});

export function useSkillRankForm({
  ranks,
  save,
}: {
  ranks: number;
  save: (ranks: number) => Promise<unknown>;
}) {
  return useSheetTextFieldForm({
    value: String(ranks),
    schema: rankField,
    normalize: (value) => String(Number(value)),
    save: (value) => save(Number(value)),
  });
}

export function useProficiencyChoiceForm({
  choice,
  save,
}: {
  choice: string | null | undefined;
  save: (choice: string | null) => Promise<unknown>;
}) {
  return useSheetTextFieldForm({
    value: choice ?? '',
    schema: z.string(),
    normalize: (value) => value.trim(),
    save: (value) => save(value || null),
  });
}

function useSheetTextFieldForm({
  value,
  schema,
  normalize,
  save: write,
}: {
  value: string;
  schema: z.ZodString;
  normalize: (value: string) => string;
  save: (value: string) => Promise<unknown>;
}) {
  const state = useSheetFormState({
    incoming: { value },
    resolver: zodResolver(z.object({ value: schema })),
    draftPolicy: 'fields',
  });
  const { form, source, expected, latest } = state;
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const busy = useRef(false);

  async function save(): Promise<'saved' | 'failed'> {
    if (busy.current) return 'failed';
    busy.current = true;
    let outcome: 'saved' | 'failed' = 'failed';
    try {
      await form.handleSubmit(async (values) => {
        const submitted = { value: normalize(values.value) };
        expected.current = JSON.stringify(submitted);
        setStatus({ kind: 'saving' });
        try {
          await write(submitted.value);
          const current = form.getValues();
          const next =
            latest.current.source === source
              ? submitted
              : latest.current.source;
          form.reset(next, { keepDirtyValues: false });
          form.reset(
            schema.safeParse(current.value).success &&
              normalize(current.value) === submitted.value
              ? submitted
              : current,
            { keepDefaultValues: true, keepDirtyValues: false },
          );
          setStatus({ kind: 'saved' });
          outcome = 'saved';
        } catch (error) {
          expected.current = null;
          const failure = classifyWriteFailure(error);
          setStatus({
            kind: 'error',
            message:
              failure.kind === 'rejected'
                ? `Changes weren't saved${refusalReason(failure.message)} Your edits are kept. Save to try again.`
                : 'Changes may not have been saved. Your edits are kept. Check them, then Save to try again.',
          });
        }
      })();
      return outcome;
    } finally {
      busy.current = false;
    }
  }

  return {
    form,
    status,
    save,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
  };
}
