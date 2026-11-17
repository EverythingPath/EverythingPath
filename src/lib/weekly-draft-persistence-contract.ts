import { migrationWriteMessages } from './migration-write-messages';
import type { ConfirmationTransport } from './weekly-confirmation-contract';
import { paginationResultValidator } from 'convex/server';
import { v } from 'convex/values';
import { convexToZod } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import {
  weeklyDraftDataSchema,
  weeklyDraftEditSchema,
  type WeeklyDraft,
} from './weekly-draft-contract';
import { identitySchema, integerSchema } from './weekly-draft-facts';

export const draftOperationSchema = z.strictObject({
  draftId: identitySchema,
  operationId: identitySchema,
  baseRevision: integerSchema,
  edit: weeklyDraftEditSchema,
});
export type DraftOperation = z.infer<typeof draftOperationSchema>;
export const draftObservationSchema = z
  .strictObject({
    draftId: identitySchema,
    revision: integerSchema,
    status: z.enum(['open', 'closed']),
    draft: weeklyDraftDataSchema.nullable(),
    targetRevisions: z.array(
      z.strictObject({ target: z.string(), revision: integerSchema }),
    ),
  })
  .superRefine((value, ctx) => {
    if (
      value.status === 'open'
        ? value.draft?.draftId !== value.draftId ||
          value.draft.revision !== value.revision
        : value.draft !== null
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Inconsistent draft observation',
      });
  });
export type DraftObservation = z.infer<typeof draftObservationSchema>;
export const draftReceiptSchema = z.strictObject({
  operationId: identitySchema,
  acceptedRevision: integerSchema,
  observation: draftObservationSchema,
});
export type DraftReceipt = z.infer<typeof draftReceiptSchema>;
export type DraftTransport = Partial<ConfirmationTransport> & {
  read(this: void): Promise<DraftObservation>;
  send(this: void, operation: DraftOperation): Promise<DraftReceipt>;
  subscribe(
    this: void,
    next: (value: DraftObservation) => void,
    failed: (error: unknown) => void,
  ): () => void;
};
export class DraftTransportFailure extends Error {}
export class DraftRejected extends Error {
  static readonly maintenanceReason = migrationWriteMessages.maintenance;
  static readonly reloadReason = migrationWriteMessages.reload_required;
  readonly failureReason: string | null;
  constructor(
    message: string,
    {
      maintenance = false,
      reloadRequired = false,
    }: { maintenance?: boolean; reloadRequired?: boolean } = {},
  ) {
    super(message);
    this.failureReason = reloadRequired
      ? DraftRejected.reloadReason
      : maintenance
        ? DraftRejected.maintenanceReason
        : null;
  }
}
export type DraftTargetRevision = { target: string; revision: number };
export function openObservation(
  draft: WeeklyDraft,
  targetRevisions: DraftTargetRevision[] = [],
): DraftObservation {
  return {
    status: 'open',
    draftId: draft.draftId,
    revision: draft.revision,
    draft: weeklyDraftDataSchema.parse(draft),
    targetRevisions,
  };
}

export const draftTargetPaginationValidator = paginationResultValidator(
  v.object({ target: v.string(), revision: v.number() }),
);
export const draftTargetPageSchema = z.strictObject({
  restart: z.boolean(),
  observation: draftObservationSchema,
  pagination: convexToZod(draftTargetPaginationValidator).nullable(),
});
export type DraftTargetPage = z.infer<typeof draftTargetPageSchema>;
