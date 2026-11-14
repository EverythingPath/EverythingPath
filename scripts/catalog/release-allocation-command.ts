import type { FunctionArgs } from 'convex/server';
import { validate } from 'convex-helpers/validators';
import type { internal } from '../../convex/_generated/api';
import {
  allocationBatchValidator,
  type AllocationBatch,
  type IdentityConflict,
} from '../../src/lib/catalog/identity-allocation.ts';

type AllocateArgs = FunctionArgs<
  typeof internal.catalogIdentityAllocation.allocate
>;
export type CatalogIdentityAllocationCommandAdapter = {
  allocate(args: AllocateArgs): Promise<unknown>;
};

export type CatalogIdentityAllocationResult = {
  releaseNumber: number;
  allocatedCount: number;
  existingCount: number;
  batchCount: number;
  conflicts: IdentityConflict[];
  stopped: 'complete' | 'conflicts';
};

function parseBatch(value: unknown): AllocationBatch {
  if (!validate(allocationBatchValidator, value))
    throw new Error('Invalid remote identity allocation response.');
  return value;
}

/**
 * #413 F1: allocates a prepared release's missing stable identities, batch
 * by batch until its last definition. Every batch checks before it inserts,
 * so after a lost response or an interruption the operator reruns the same
 * command from the start and ends in the same identities. Conflicts are
 * reported, never resolved: their keys stay without an identity, which
 * reconciliation reports as missing.
 */
export async function runCatalogIdentityAllocationCommand({
  releaseNumber,
  writeEpoch,
  adapter,
}: {
  releaseNumber: number;
  writeEpoch: number;
  adapter: CatalogIdentityAllocationCommandAdapter;
}): Promise<CatalogIdentityAllocationResult> {
  if (!Number.isSafeInteger(releaseNumber) || releaseNumber < 1)
    throw new Error('Invalid Catalog Release number.');
  if (!Number.isSafeInteger(writeEpoch) || writeEpoch < 0)
    throw new Error('Invalid release write epoch.');
  const result: CatalogIdentityAllocationResult = {
    releaseNumber,
    allocatedCount: 0,
    existingCount: 0,
    batchCount: 0,
    conflicts: [],
    stopped: 'complete',
  };
  let cursor: string | null = null;
  while (true) {
    const batch = parseBatch(
      await adapter.allocate({ releaseNumber, cursor, writeEpoch }),
    );
    result.batchCount++;
    result.allocatedCount += batch.allocatedCount;
    result.existingCount += batch.existingCount;
    result.conflicts.push(...batch.conflicts);
    if (batch.isDone) break;
    cursor = batch.continueCursor;
  }
  if (result.conflicts.length) result.stopped = 'conflicts';
  return result;
}
