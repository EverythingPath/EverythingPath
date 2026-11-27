'use client';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  characterLedgerDetails,
  characterMetadataKeys,
} from '~/lib/character-ledger';
import {
  characterRecordFormSchema,
  defaultCharacterFormValues,
  getCharacterErrorMessage,
  toCharacterFormValues,
  toCharacterPayload,
  type CharacterFormValues,
  type CharacterRecord,
  type MilitiaOnlyClassLevel,
} from './types';

export type CharacterRecordForm = {
  form: UseFormReturn<CharacterFormValues>;
  /** The existing record being edited; undefined when adding one. */
  record: CharacterRecord | undefined;
  /** The last refused write, shown in the dialog. */
  submitError: string | undefined;
  /** The write in flight: its button shows progress, every button waits. */
  pending: 'save' | 'archive' | null;
  levelLabel: 'Level' | 'Hit Dice';
  statisticsReadOnly: boolean;
  sheetHref: string | null;
  readOnly: boolean;
  removalConfirmation: {
    levels: MilitiaOnlyClassLevel[];
    targetLevel: number;
    confirm: () => void;
    cancel: () => void;
  } | null;
  save: () => void;
  /** Archives or un-archives the record together with the edited fields. */
  toggleArchive: () => void;
  clearError: () => void;
};

// One character record's form and its writes through the existing record
// APIs. Every write first validates the whole form. An edit sends only the
// fields changed since opening; Archive and Un-archive send those edits in
// the same write, so unsaved edits are never dropped, and Save keeps the
// record's archive state. Values live as long as the hook's owner: a refused
// write keeps them; `onSaved` runs after an accepted one.
export function useCharacterRecord({
  campaignId,
  organizationId,
  record,
  onSaved,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
  record?: CharacterRecord;
  onSaved: () => void;
}): CharacterRecordForm {
  // The values the dialog opened with; later record changes don't reset
  // the form, so the player's input is never replaced under them.
  const [initialValues] = useState(() =>
    record ? toCharacterFormValues(record) : defaultCharacterFormValues,
  );
  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterRecordFormSchema(record)),
    defaultValues: initialValues,
  });
  const [submitError, setSubmitError] = useState<string>();
  const [pending, setPending] = useState<CharacterRecordForm['pending']>(null);
  const [removal, setRemoval] = useState<{
    values: CharacterFormValues;
    archive: boolean;
    levels: MilitiaOnlyClassLevel[];
    revision: number | undefined;
  } | null>(null);
  const maintenance = useInitialMigrationMaintenance();
  const { statisticsReadOnly, sheetHref } = record
    ? characterLedgerDetails(record, { campaignId, organizationId })
    : { statisticsReadOnly: false, sheetHref: null };
  // Set before validation settles, so a second press never writes twice.
  const busy = useRef(false);
  const createCharacter = useMutation(api.character.createCharacter);
  const updateCharacter = useMutation(api.character.updateCharacter);
  const archiveCharacter = useMutation(api.character.archiveCharacter);

  // The fields this player changed since opening: an edit never writes back
  // a field another player changed in the meantime.
  function edits(values: CharacterFormValues) {
    const payload = toCharacterPayload(values);
    // Safe cast: a filtered subset of payload's own entries.
    return Object.fromEntries(
      Object.entries(payload).filter(([key]) => {
        if (
          statisticsReadOnly &&
          !characterMetadataKeys.some((metadataKey) => metadataKey === key)
        )
          return false;
        // Safe cast: payload keys are form fields, as toCharacterPayload maps
        // each one.
        const field = key as keyof CharacterFormValues;
        return values[field] !== initialValues[field];
      }),
    ) as Partial<typeof payload>;
  }

  async function writeRecord(
    current: CharacterRecord,
    values: CharacterFormValues,
    archive: boolean,
    confirmedRemoval?: NonNullable<typeof removal>,
  ) {
    const patch = edits(values);
    const changed = Object.keys(patch).length > 0;
    const isActive = current.isActive === false;
    if (archive && !changed)
      await archiveCharacter({
        organizationId,
        characterId: current._id,
        isActive,
      });
    else if (archive || changed)
      await updateCharacter({
        operationId: createCharacterSheetOperationId(),
        organizationId,
        characterId: current._id,
        patch: archive ? { ...patch, isActive } : patch,
        ...(confirmedRemoval && {
          confirmedRemovedLevelIds: confirmedRemoval.levels.map(
            (level) => level.entryId,
          ),
          expectedSheetRevision: confirmedRemoval.revision,
        }),
      });
  }

  async function write(
    values: CharacterFormValues,
    archive: boolean,
    confirmedRemoval?: NonNullable<typeof removal>,
  ) {
    setPending(archive ? 'archive' : 'save');
    setSubmitError(undefined);
    try {
      if (record) await writeRecord(record, values, archive, confirmedRemoval);
      else
        await createCharacter({
          organizationId,
          character: { campaignId, ...toCharacterPayload(values) },
        });
      onSaved();
    } catch (error) {
      setSubmitError(
        getCharacterErrorMessage(
          error,
          !archive
            ? 'Failed to save character.'
            : record?.isActive === false
              ? 'Failed to un-archive character.'
              : 'Failed to archive character.',
        ),
      );
    } finally {
      setPending(null);
    }
  }

  function submit(archive: boolean) {
    if (busy.current || maintenance.readOnly || removal) return;
    busy.current = true;
    void form
      .handleSubmit((values) => {
        const levels =
          !statisticsReadOnly &&
          values.level !== initialValues.level &&
          record?.classLevels
            ? record.classLevels.filter(
                (level) => level.position > Number(values.level),
              )
            : [];
        if (levels.length > 0) {
          setSubmitError(undefined);
          setRemoval({
            values,
            archive,
            levels,
            revision: record?.sheetRevision,
          });
          return;
        }
        return write(values, archive);
      })()
      .finally(() => {
        busy.current = false;
      });
  }

  return {
    form,
    record,
    submitError,
    pending,
    levelLabel: record?.sheetMode ? 'Level' : 'Hit Dice',
    statisticsReadOnly,
    sheetHref,
    readOnly: maintenance.readOnly,
    removalConfirmation: removal
      ? {
          levels: removal.levels,
          targetLevel: Number(removal.values.level),
          cancel: () => setRemoval(null),
          confirm: () => {
            if (busy.current || maintenance.readOnly) return;
            busy.current = true;
            setRemoval(null);
            void write(removal.values, removal.archive, removal).finally(() => {
              busy.current = false;
            });
          },
        }
      : null,
    save: () => submit(false),
    toggleArchive: () => submit(true),
    clearError: () => setSubmitError(undefined),
  };
}
