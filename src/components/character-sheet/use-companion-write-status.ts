'use client';

import { useMemo } from 'react';
import type { CompanionRelationship } from './character-companions-view-model';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import { sameComponents } from '~/lib/character-sheet-companion-components';

function isSameRelationship(
  before: CompanionRelationship,
  after: CompanionRelationship,
) {
  return (
    before.role === after.role &&
    before.kind === after.kind &&
    before.status === after.status &&
    before.interruption === after.interruption &&
    before.endpoint?.characterId === after.endpoint?.characterId &&
    before.endpoint?.name === after.endpoint?.name &&
    before.sources.length === after.sources.length &&
    before.sources.every((source, index) => {
      const next = after.sources[index];
      return (
        source.key === next?.key &&
        source.label === next.label &&
        source.enabled === next.enabled &&
        source.available === next.available &&
        source.allocatedLevels === next.allocatedLevels &&
        sameComponents(source.allocatedComponents, next.allocatedComponents) &&
        source.sheetEntryId === next.sheetEntryId &&
        source.grantKey?.source === next.grantKey?.source &&
        source.grantKey?.entry === next.grantKey?.entry &&
        source.grantKey?.classLevel === next.grantKey?.classLevel
      );
    })
  );
}

export function useCompanionWriteStatus(
  scopeKey: string,
  relationships: CompanionRelationship[] | undefined,
  isDisabled: boolean,
) {
  const observations = useMemo(
    () =>
      relationships?.map((row) => ({
        key: row.relationshipId,
        operationId: row.lastOperationId,
        value: row,
      })) ?? null,
    [relationships],
  );
  const status = useEntryWriteStatus({
    subject: 'Companion',
    scopeKey,
    observations,
    isEqual: isSameRelationship,
  });
  return {
    ...status,
    write: (key: string, action: () => Promise<unknown>) =>
      isDisabled ? Promise.resolve(false) : status.write(action, { key }),
  };
}
