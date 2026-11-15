'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import { formatGrantKeyId } from '~/lib/character-sheet-grants';
import { isSelectableCatalogSheetEntryKind } from '~/lib/character-sheet-entries';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

export type OneOffCatalogInput = Pick<
  FunctionArgs<typeof api.catalogCopies.createOneOff>,
  'definition' | 'choice'
>;
export type CatalogDefinitionChanges = Pick<
  FunctionArgs<typeof api.catalogCopies.editDefinition>,
  'name' | 'modifiers' | 'detail'
>;
export type CatalogDetachTarget = FunctionArgs<
  typeof api.catalogCopies.detach
>['target'];
export type CatalogSelectionInput = Pick<
  FunctionArgs<typeof api.characterSheet.selectEntry>,
  | 'catalogEntryId'
  | 'active'
  | 'choice'
  | 'notes'
  | 'selectionSource'
  | 'gainedAtClassLevel'
>;

function selectionKey(id: Id<'catalogEntry'>) {
  return `select:${id}`;
}

function targetKey(target: CatalogDetachTarget) {
  return target.kind === 'entry'
    ? `entry:${target.entryId}`
    : formatGrantKeyId(target.grantKey);
}

export function useCharacterSheetCatalog(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const createOneOff = useMutation(api.catalogCopies.createOneOff);
  const editDefinition = useMutation(api.catalogCopies.editDefinition);
  const saveToCatalog = useMutation(api.catalogCopies.saveToCatalog);
  const customizeForCampaign = useMutation(
    api.catalogCopies.customizeForCampaign,
  );
  const detach = useMutation(api.catalogCopies.detach);
  const selectEntry = useMutation(api.characterSheet.selectEntry);
  const queryScope =
    snapshot && !snapshot.catalogView
      ? { ...scope, characterId: snapshot.character._id }
      : 'skip';
  const legacyDefinitions = useQuery(api.catalogCopies.list, queryScope);
  const legacyAdvisories = useQuery(api.catalogCopies.advisories, queryScope);
  const definitions = snapshot?.catalogView?.definitions ?? legacyDefinitions;
  const advisories = snapshot?.catalogView?.advisories ?? legacyAdvisories;
  const writeState = useEntryWriteStatus({
    signature: snapshot
      ? JSON.stringify({
          entries: snapshot.entries,
          catalog: snapshot.catalogEntries,
        })
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Catalog Entry',
  });
  const [createdEntryId, setCreatedEntryId] =
    useState<Id<'characterSheetEntry'> | null>(null);
  function createWriteOperation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  function getCatalogDefinition(id: string) {
    return (
      definitions?.find((entry) => entry._id === id) ??
      snapshot?.catalogEntries.find((entry) => entry._id === id)
    );
  }
  function capabilitiesFor(id: Id<'catalogEntry'>) {
    const definition = getCatalogDefinition(id);
    const editableDefinition = definitions?.find((entry) => entry._id === id);
    const available = Boolean(
      snapshot && definition && definition.detail.kind !== 'base',
    );
    const hasCampaign = Boolean(snapshot?.character.campaignId);
    return {
      canSelect: Boolean(
        snapshot &&
        definitions?.some(
          (row) =>
            row._id === id &&
            isSelectableCatalogSheetEntryKind(row.detail.kind),
        ),
      ),
      canEdit: Boolean(
        available &&
        editableDefinition &&
        editableDefinition.scope !== 'global',
      ),
      canSaveToCatalog:
        available && hasCampaign && definition?.scope === 'character',
      canCustomizeForCampaign:
        available && hasCampaign && definition?.scope === 'global',
      canDetach: available && definition?.scope !== 'character',
    };
  }
  function writeDefinition(
    id: Id<'catalogEntry'>,
    action: () => Promise<unknown>,
  ) {
    return writeState.write(action, {
      key: id,
      subject: getCatalogDefinition(id)?.name ?? 'Catalog Entry',
    });
  }
  function getDefinitionForTarget(target: CatalogDetachTarget) {
    const stored = snapshot?.entries.find((entry) =>
      target.kind === 'entry'
        ? entry._id === target.entryId
        : 'grantKey' in entry &&
          entry.grantKey &&
          formatGrantKeyId(entry.grantKey) ===
            formatGrantKeyId(target.grantKey),
    );
    const grant = snapshot?.calculated.resolvedEntries.find((row) =>
      target.kind === 'entry'
        ? row.origin === 'grant' && row.storedEntryId === target.entryId
        : 'grantKey' in row.entry &&
          row.entry.grantKey &&
          formatGrantKeyId(row.entry.grantKey) ===
            formatGrantKeyId(target.grantKey),
    )?.entry;
    const entry = grant ?? stored;
    const id =
      entry && 'catalogEntryId' in entry
        ? entry.catalogEntryId
        : entry?.kind === 'classLevel'
          ? entry.state.classEntryId
          : undefined;
    return id ? getCatalogDefinition(id) : undefined;
  }
  async function createForForm(input: OneOffCatalogInput) {
    const entryId = await createOneOff({ ...createWriteOperation(), ...input });
    setCreatedEntryId(entryId);
    return entryId;
  }
  async function selectForForm(input: CatalogSelectionInput) {
    const definition = definitions?.find(
      (row) => row._id === input.catalogEntryId,
    );
    if (!definition)
      throw new ConvexError('Catalog Entry is not available for selection');
    if (!isSelectableCatalogSheetEntryKind(definition.detail.kind))
      throw new ConvexError('Choose a feature or Selection');
    const entryId = await selectEntry({ ...createWriteOperation(), ...input });
    setCreatedEntryId(entryId);
    return entryId;
  }
  function editForForm(
    catalogEntryId: Id<'catalogEntry'>,
    changes: CatalogDefinitionChanges,
  ) {
    const definition = definitions?.find(
      (entry) => entry._id === catalogEntryId,
    );
    if (!definition || definition.detail.kind === 'base')
      throw new ConvexError('Catalog Entry is not available for editing');
    if (definition.scope === 'global')
      throw new ConvexError('Global catalog content is read-only');
    return editDefinition({
      ...createWriteOperation(),
      catalogEntryId,
      ...changes,
    });
  }
  return {
    available: Boolean(snapshot),
    definitions,
    advisories,
    capabilitiesFor,
    getDefinitionForTarget,
    targetKey,
    selectionKey,
    statusFor: writeState.statusFor,
    hasRemoteChange: writeState.hasRemoteChange,
    dismissRemoteChange: writeState.dismissRemoteChange,
    createdEntryId,
    acknowledgeCreate: () => setCreatedEntryId(null),
    // Validated forms own their acknowledgement and must receive rejections.
    createForForm,
    selectForForm,
    select: (input: CatalogSelectionInput) =>
      writeState.write(() => selectForForm(input), {
        key: selectionKey(input.catalogEntryId),
        subject:
          getCatalogDefinition(input.catalogEntryId)?.name ?? 'Catalog Entry',
      }),
    editForForm,
    create: (input: OneOffCatalogInput) =>
      writeState.write(() => createForForm(input), { key: 'create' }),
    edit: (
      catalogEntryId: Id<'catalogEntry'>,
      changes: CatalogDefinitionChanges,
    ) =>
      writeDefinition(catalogEntryId, () =>
        editForForm(catalogEntryId, changes),
      ),
    saveToCatalog: (catalogEntryId: Id<'catalogEntry'>) =>
      writeDefinition(catalogEntryId, () => {
        if (!snapshot?.character.campaignId)
          throw new ConvexError('Save to catalog requires a campaign');
        if (!capabilitiesFor(catalogEntryId).canSaveToCatalog)
          throw new ConvexError(
            'Only Character-specific definitions can be saved to the campaign catalog',
          );
        return saveToCatalog({ ...createWriteOperation(), catalogEntryId });
      }),
    customizeForCampaign: (catalogEntryId: Id<'catalogEntry'>) =>
      writeDefinition(catalogEntryId, () => {
        if (!snapshot?.character.campaignId)
          throw new ConvexError('Customize for campaign requires a campaign');
        if (!capabilitiesFor(catalogEntryId).canCustomizeForCampaign)
          throw new ConvexError(
            'Only global definitions can be customized for the campaign',
          );
        return customizeForCampaign({
          ...createWriteOperation(),
          catalogEntryId,
        });
      }),
    detach: (target: CatalogDetachTarget) =>
      writeState.write(
        () => {
          const definition = getDefinitionForTarget(target);
          if (!definition || !capabilitiesFor(definition._id).canDetach)
            throw new ConvexError('Only shared definitions can be detached');
          return detach({ ...createWriteOperation(), target });
        },
        {
          key: targetKey(target),
        },
      ),
  };
}
