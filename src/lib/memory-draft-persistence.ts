import {
  acceptedWeeklyPreview,
  prepareWeeklyConfirmation,
} from './weekly-confirmation';
import {
  confirmationOperationSchema,
  type ConfirmationReceipt,
  type ConfirmationTransport,
} from './weekly-confirmation-contract';
import { militiaSnapshotSchema } from './canonical-weekly-source';
import { draftReferenceRequirements } from './weekly-draft-references';
import type { UpkeepSnapshot } from './rules-upkeep';
import {
  weeklyDraftSchema,
  weeklyDraftDataSchema,
  type WeeklyDraft,
} from './weekly-draft-contract';
import { weeklySourceKey } from './canonical-weekly-source';
import { acceptDraftOperation } from './weekly-draft-consistency';
import {
  draftOperationSchema,
  openObservation,
  DraftRejected,
  type DraftObservation,
  type DraftReceipt,
  type DraftTransport,
  type DraftTargetRevision,
} from './weekly-draft-persistence-contract';

export function createMemoryDraftAuthority(
  initial: WeeklyDraft,
  snapshot: UpkeepSnapshot,
) {
  let source = militiaSnapshotSchema.parse(snapshot);
  let sourceRevision = 0;
  let confirmation: { request: string; receipt: ConfirmationReceipt } | null =
    null;
  let current = weeklyDraftSchema.parse(initial);
  let closed = false;
  let targets: DraftTargetRevision[] = [];
  const revisions = new Map([[current.revision, current]]);
  const operations = new Map<
    string,
    { request: string; receipt: DraftReceipt }
  >();
  const observers = new Set<(value: DraftObservation) => void>();
  const observe = (): DraftObservation =>
    structuredClone(
      closed
        ? {
            draftId: current.draftId,
            revision: current.revision,
            status: 'closed',
            draft: null,
            targetRevisions: targets,
          }
        : openObservation(current, targets),
    );
  const publish = () => {
    for (const next of observers) next(observe());
  };
  const reservedDraftIds = new Set<string>();
  const transport: DraftTransport & ConfirmationTransport = {
    read: async () => observe(),
    async preview() {
      if (closed) throw new DraftRejected('Draft closed');
      return acceptedWeeklyPreview(current, source, sourceRevision);
    },
    async confirm(input) {
      const operation = confirmationOperationSchema.parse(input);
      if (confirmation?.receipt.operationId === operation.operationId) {
        if (confirmation.request !== weeklySourceKey(operation))
          throw new DraftRejected('Operation identity reused');
        return structuredClone(confirmation.receipt);
      }
      if (closed) throw new DraftRejected('Draft closed');
      const prepared = prepareWeeklyConfirmation(
        current,
        source,
        sourceRevision,
        operation,
      );
      if (reservedDraftIds.has(prepared.successor.draftId))
        throw new DraftRejected('Draft identity already used');
      source = prepared.after.militiaSnapshot;
      sourceRevision++;
      closed = true;
      revisions.clear();
      targets = [];
      const receipt = {
        operationId: operation.operationId,
        observation: observe(),
        record: prepared.record,
        successor: prepared.successor,
      };
      confirmation = { request: weeklySourceKey(operation), receipt };
      publish();
      return structuredClone(receipt);
    },
    subscribe(next) {
      observers.add(next);
      next(observe());
      return () => observers.delete(next);
    },
    async send(input) {
      const operation = draftOperationSchema.parse(input);
      if (operation.draftId !== current.draftId)
        throw new DraftRejected('Unknown draft');
      const existing = operations.get(operation.operationId);
      if (existing) {
        if (existing.request !== weeklySourceKey(operation))
          throw new DraftRejected('Operation identity reused');
        return { ...structuredClone(existing.receipt), observation: observe() };
      }
      if (closed) throw new DraftRejected('Draft closed');
      const base = revisions.get(operation.baseRevision);
      if (!base) throw new DraftRejected('Unknown revision');
      const accepted = acceptDraftOperation(
        current,
        base,
        targets,
        operation,
        source,
      );
      if (draftReferenceRequirements(accepted.draft, source, source).length)
        throw new DraftRejected('Invalid draft entity reference');
      current = accepted.draft;
      targets = accepted.targetRevisions;
      revisions.set(current.revision, structuredClone(current));
      const receipt = {
        operationId: operation.operationId,
        acceptedRevision: current.revision,
        observation: observe(),
      };
      operations.set(operation.operationId, {
        request: weeklySourceKey(operation),
        receipt,
      });
      publish();
      return receipt;
    },
  };
  return {
    transport,
    inspect() {
      return structuredClone({
        sourceRevision,
        snapshot: source,
        source: observe(),
        openDrafts: closed
          ? confirmation
            ? [confirmation.receipt.successor]
            : []
          : [weeklyDraftDataSchema.parse(current)],
        records: confirmation ? [confirmation.receipt.record] : [],
      });
    },
    changeSource(change: 'revision' | 'treasury' | 'invalid_reference') {
      if (change === 'treasury') source.treasuryCopper += 7;
      if (change === 'invalid_reference')
        source.bonuses.push({
          bonusId: 'broken',
          source: 'fixture',
          check: 'any',
          value: 1,
          teamId: 'foreign',
          phase: 'activity',
          availableWeek: 1,
          consumedWeek: null,
        });
      sourceRevision++;
    },
    reserveDraftIdentity(draftId: string) {
      reservedDraftIds.add(draftId);
    },
    close() {
      closed = true;
      revisions.clear();
      publish();
    },
  };
}
