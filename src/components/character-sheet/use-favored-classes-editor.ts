'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useRef, useState } from 'react';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';

type ClassId = Id<'catalogEntry'>;

/**
 * The favored-class entitlement as toggles: each toggle writes the whole
 * recorded set at once, one write at a time, and reports beside itself. The
 * checked state is the sheet's; a refused write leaves it as recorded.
 */
export function useFavoredClassesEditor({
  favoredClassIds,
  save,
}: {
  favoredClassIds: readonly ClassId[];
  save: (favoredClassIds: ClassId[]) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const isBusy = useRef(false);

  async function toggle(classId: ClassId, isFavored: boolean) {
    if (isBusy.current) return;
    isBusy.current = true;
    setStatus({ kind: 'saving' });
    const next = isFavored
      ? [...new Set([...favoredClassIds, classId])]
      : favoredClassIds.filter((id) => id !== classId);
    try {
      await save(next);
      setStatus({ kind: 'saved' });
    } catch (error) {
      const failure = classifyWriteFailure(error);
      setStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `Favored class wasn't saved${refusalReason(failure.message)} Try again.`
            : 'Favored class may not have been saved. Check it before trying again.',
      });
    } finally {
      isBusy.current = false;
    }
  }

  return { status, isSaving: status.kind === 'saving', toggle };
}
