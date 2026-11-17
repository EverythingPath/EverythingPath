import type { Id } from '@convex/_generated/dataModel';
import { useRef, useState } from 'react';

type EntryId = Id<'characterSheetEntry'>;

/**
 * A creating save: the first one creates, and once the entry exists any
 * save of input typed meanwhile edits that same entry instead of creating a
 * twin. The ref answers the save in flight; the state lets the editor find
 * its new row.
 */
export function useCreateThenEdit<Input>({
  create,
  edit,
}: {
  create: (input: Input) => Promise<EntryId>;
  edit: (entryId: EntryId, input: Input) => Promise<unknown>;
}) {
  const created = useRef<EntryId | null>(null);
  const [createdId, setCreatedId] = useState<EntryId | null>(null);
  const save = async (input: Input) => {
    if (created.current) return edit(created.current, input);
    created.current = await create(input);
    setCreatedId(created.current);
  };
  return { save, createdId };
}
