import { findMigrationWriteRejection } from './migration-write-rejection';
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from 'convex/server';
import {
  acceptedWeeklyPreviewSchema,
  confirmationReceiptSchema,
  type ConfirmationTransport,
} from './weekly-confirmation-contract';
import type { ConvexClient } from 'convex/browser';
import { ConvexError } from 'convex/values';
import { api } from '../../convex/_generated/api';
import { createDraftTargetReader } from './draft-target-reader';
import type { z } from 'zod';
import type { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import {
  draftObservationSchema,
  draftReceiptSchema,
  DraftRejected,
  DraftTransportFailure,
  type DraftTransport,
} from './weekly-draft-persistence-contract';

export type ConvexDraftClient = Pick<ConvexClient, 'query' | 'mutation'> & {
  onUpdate<Query extends FunctionReference<'query'>>(
    query: Query,
    args: FunctionArgs<Query>,
    next: (value: FunctionReturnType<Query>) => unknown,
    failed?: (error: Error) => unknown,
  ): () => void;
};

type Key = z.infer<typeof draftKeySchema>;
export function createConvexDraftTransport(
  client: ConvexDraftClient,
  key: Key,
): DraftTransport & ConfirmationTransport {
  const hydrate = createDraftTargetReader((request) =>
    client.query(api.canonicalDraftPersistence.targets, { ...key, ...request }),
  );
  return {
    async preview() {
      return acceptedWeeklyPreviewSchema.parse(
        await client.query(api.canonicalDraftPersistence.preview, key),
      );
    },
    async confirm(operation) {
      if (operation.reviewed.draftId !== key.draftId)
        throw new DraftRejected('Unknown draft');
      try {
        return confirmationReceiptSchema.parse(
          await client.mutation(api.canonicalDraftPersistence.confirm, {
            ...key,
            operation,
          }),
        );
      } catch (error) {
        return rejectTransport(error);
      }
    },
    async read() {
      return await hydrate(
        draftObservationSchema.parse(
          await client.query(api.canonicalDraftPersistence.observe, key),
        ),
      );
    },
    async send(operation) {
      if (operation.draftId !== key.draftId)
        throw new DraftRejected('Unknown draft');
      let result;
      try {
        result = await client.mutation(api.canonicalDraftPersistence.edit, {
          campaignId: key.campaignId,
          militiaId: key.militiaId,
          operation,
        });
      } catch (error) {
        return rejectTransport(error);
      }
      // Only mutation rejection proves that no edit was accepted. Parsing or
      // hydrating its receipt can fail after the mutation has already committed.
      const receipt = draftReceiptSchema.parse(result);
      return { ...receipt, observation: await hydrate(receipt.observation) };
    },
    subscribe(next, failed) {
      let active = true;
      const unsubscribe = client.onUpdate(
        api.canonicalDraftPersistence.observe,
        key,
        (value) => {
          void hydrate(draftObservationSchema.parse(value)).then(
            (observation) => {
              if (active) next(observation);
            },
            (error) => {
              if (active) failed(error);
            },
          );
        },
        failed,
      );
      return () => {
        active = false;
        unsubscribe();
      };
    },
  };
}

function rejectTransport(error: unknown): never {
  if (error instanceof ConvexError)
    throw new DraftRejected('Operation rejected', {
      maintenance:
        error.data === DraftRejected.maintenanceReason ||
        findMigrationWriteRejection(error) === 'maintenance',
      reloadRequired: findMigrationWriteRejection(error) === 'reload_required',
    });
  // The SDK retries network connectivity; a closed client is the remaining
  // temporary transport boundary. Validation and authority are never retried.
  if (
    error instanceof Error &&
    error.message === 'ConvexClient has already been closed.'
  )
    throw new DraftTransportFailure('Connection interrupted');
  throw error;
}
