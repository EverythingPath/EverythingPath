import { createDraftAttribution } from './weekly-draft-attribution';
import { weeklySourceKey } from './canonical-weekly-source';
import {
  acceptedWeeklyPreviewSchema,
  confirmationReceiptSchema,
  type AcceptedWeeklyPreview,
  type ConfirmationReceipt,
} from './weekly-confirmation-contract';
import {
  rebaseDraftEdit,
  requireUnchangedTargets,
} from './weekly-draft-consistency';
import {
  draftObservationSchema,
  draftReceiptSchema,
  DraftTransportFailure,
  DraftRejected,
  type DraftObservation,
  type DraftOperation,
  type DraftReceipt,
  type DraftTransport,
} from './weekly-draft-persistence-contract';
import { editWeeklyDraft } from './weekly-draft';
import type { WeeklyDraft, WeeklyDraftEdit } from './weekly-draft-contract';

function safeFailureReason(error: unknown): string | null {
  return error instanceof DraftRejected &&
    (error.failureReason === DraftRejected.maintenanceReason ||
      error.failureReason === DraftRejected.reloadReason)
    ? error.failureReason
    : null;
}

function isCorrelatedReceipt(receipt: DraftReceipt, operation: DraftOperation) {
  return (
    receipt.operationId === operation.operationId &&
    receipt.observation.draftId === operation.draftId &&
    receipt.acceptedRevision > operation.baseRevision &&
    receipt.acceptedRevision <= receipt.observation.revision
  );
}

export function createDraftPersistence(
  transport: DraftTransport,
  options: { operationId?: () => string; retries?: number } = {},
) {
  let observation: DraftObservation | null = null;
  let pending = 0;
  let confirming = false;
  let failureReason: string | null = null;
  let acceptedReview: AcceptedWeeklyPreview | null = null;
  let confirmation: ConfirmationReceipt | null = null;
  let pendingDraft: WeeklyDraft | null = null;
  let disposed = false;
  let chain = Promise.resolve();
  const ownRevisions = new Set<number>();
  const attribution = createDraftAttribution(ownRevisions);
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  function accept(value: DraftObservation) {
    if (disposed) return;
    const next = draftObservationSchema.parse(value);
    if (
      observation &&
      (next.draftId !== observation.draftId ||
        next.revision < observation.revision ||
        observation.status === 'closed')
    )
      return;
    observation = next;
    attribution.observe(next);
    notify();
  }
  const unsubscribe = transport.subscribe(accept, () => {
    /* A failed read/edit is surfaced through its operation result. */
  });
  const ready = transport.read().then(accept);
  async function retry<T>(
    request: () => Promise<T>,
    onFailure?: (error: unknown) => void,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await request();
      } catch (error) {
        onFailure?.(error);
        if (
          !(error instanceof DraftTransportFailure) ||
          attempt >= (options.retries ?? 2)
        )
          throw error;
      }
    }
  }
  return {
    ready,
    getSnapshot: () => ({
      observation,
      remoteChange: attribution.getChange(),
      failureReason,
      pending,
      confirming,
      confirmation: structuredClone(confirmation),
    }),
    async preview(): Promise<AcceptedWeeklyPreview | null> {
      if (pending || confirming || disposed || !transport.preview) return null;
      await ready;
      const preview = acceptedWeeklyPreviewSchema.parse(
        await transport.preview(),
      );
      if (
        pending ||
        confirming ||
        disposed ||
        observation?.status !== 'open' ||
        preview.reviewed.draftId !== observation.draftId ||
        preview.reviewed.revision !== observation.revision
      )
        return null;
      if (
        acceptedReview &&
        preview.reviewed.sourceRevision < acceptedReview.reviewed.sourceRevision
      )
        return null;
      acceptedReview = structuredClone(preview);
      return preview;
    },
    confirm(review: AcceptedWeeklyPreview): Promise<'accepted' | 'failed'> {
      failureReason = null;
      const parsed = acceptedWeeklyPreviewSchema.safeParse(review);
      if (
        confirming ||
        disposed ||
        observation?.status !== 'open' ||
        !transport.confirm ||
        !parsed.success ||
        parsed.data.status !== 'ready' ||
        !acceptedReview ||
        weeklySourceKey(parsed.data) !== weeklySourceKey(acceptedReview)
      )
        return Promise.resolve('failed');
      const operation = {
        operationId: options.operationId?.() ?? crypto.randomUUID(),
        reviewed: parsed.data.reviewed,
      };
      const confirm = transport.confirm;
      acceptedReview = null;
      confirming = true;
      notify();
      const task = chain.then(async (): Promise<'accepted' | 'failed'> => {
        failureReason = null;
        try {
          await ready;
          if (disposed) return 'failed';
          const receipt = confirmationReceiptSchema.parse(
            await retry(() => confirm(operation)),
          );
          if (receipt.operationId !== operation.operationId) return 'failed';
          failureReason = null;
          confirmation = receipt;
          accept(receipt.observation);
          return 'accepted';
        } catch (error) {
          if (!disposed) failureReason = safeFailureReason(error);
          try {
            accept(await transport.read());
          } catch {
            /* Retain last accepted state. */
          }
          return 'failed';
        } finally {
          confirming = false;
          notify();
        }
      });
      chain = task.then(() => undefined);
      return task;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    edit(edit: WeeklyDraftEdit): Promise<'accepted' | 'failed'> {
      failureReason = null;
      if (confirming || disposed) return Promise.resolve('failed');
      const submitted = pendingDraft ?? observation?.draft;
      const observedBaseRevision = observation?.revision;
      const submittedEdit = structuredClone(edit);
      if (submitted) {
        const projected = editWeeklyDraft(submitted, submittedEdit);
        if (projected.ok) pendingDraft = projected.draft;
      }
      const operationId = options.operationId?.() ?? crypto.randomUUID();
      pending++;
      notify();
      const task = chain.then(async (): Promise<'accepted' | 'failed'> => {
        failureReason = null;
        let uncertainAttempt = false;
        let definitiveRejection = false;
        try {
          await ready;
          const current = observation?.draft;
          if (
            disposed ||
            !submitted ||
            !current ||
            observedBaseRevision === undefined ||
            observation?.status !== 'open'
          )
            return 'failed';
          const intent = {
            draftId: current.draftId,
            operationId,
            baseRevision: observedBaseRevision,
            edit: submittedEdit,
          };
          const targets = requireUnchangedTargets(
            submitted,
            observation.targetRevisions,
            intent,
            ownRevisions,
          );
          const operation = {
            ...intent,
            baseRevision: current.revision,
            edit: rebaseDraftEdit(submitted, current, submittedEdit),
          };
          attribution.begin(current.revision, targets);
          const receipt = draftReceiptSchema.parse(
            await retry(
              () => transport.send(operation),
              (error) => {
                uncertainAttempt ||= !(error instanceof DraftRejected);
                definitiveRejection =
                  error instanceof DraftRejected && !uncertainAttempt;
              },
            ),
          );
          if (!isCorrelatedReceipt(receipt, operation)) return 'failed';
          failureReason = null;
          ownRevisions.add(receipt.acceptedRevision);
          attribution.accepted(receipt.observation);
          accept(receipt.observation);
          return 'accepted';
        } catch (error) {
          if (!disposed) failureReason = safeFailureReason(error);
          try {
            accept(await transport.read());
          } catch {
            /* Retain the newest known accepted state. */
          }
          return 'failed';
        } finally {
          attribution.failed(definitiveRejection);
          pending--;
          if (pending === 0) pendingDraft = null;
          notify();
        }
      });
      chain = task.then(() => undefined);
      return task;
    },
    settled: () => chain,
    dispose() {
      disposed = true;
      failureReason = null;
      attribution.close();
      unsubscribe();
      listeners.clear();
    },
  };
}
