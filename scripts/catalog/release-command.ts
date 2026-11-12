import {
  validateCatalogReleaseArtifact,
  type CatalogReleaseArtifact,
  type CatalogReleaseManifest,
  type ReleaseRow,
} from '../../src/lib/catalog/release-schema.ts';

import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators.ts';
export type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators.ts';
export type CatalogReleaseCommandAdapter = {
  begin(args: {
    manifest: CatalogReleaseManifest;
    writeEpoch: number;
  }): Promise<CatalogReleaseStatus>;
  writeBatch(args: {
    releaseNumber: number;
    batchIndex: number;
    rows: ReleaseRow[];
    writeEpoch: number;
  }): Promise<CatalogReleaseStatus>;
  finalize(args: {
    releaseNumber: number;
    writeEpoch: number;
  }): Promise<CatalogReleaseStatus>;
  inspect(args: { releaseNumber: number }): Promise<CatalogReleaseStatus>;
  inspectRows?(args: {
    releaseNumber: number;
    kind: ReleaseRow['kind'];
    paginationOpts: {
      cursor: string | null;
      numItems: number;
      maximumRowsRead: number;
      maximumBytesRead: number;
    };
  }): Promise<unknown>;
};
export async function runCatalogReleaseCommand({
  command,
  adapter,
  writeEpoch = 0,
}: {
  command:
    | { kind: 'prepare'; artifact: CatalogReleaseArtifact }
    | { kind: 'inspect'; releaseNumber: number };
  adapter: CatalogReleaseCommandAdapter;
  writeEpoch?: number;
}): Promise<CatalogReleaseStatus> {
  if (!Number.isSafeInteger(writeEpoch) || writeEpoch < 0)
    throw new Error('Invalid release write epoch.');
  if (command.kind === 'inspect')
    return adapter.inspect({ releaseNumber: command.releaseNumber });
  const artifact = await validateCatalogReleaseArtifact(command.artifact);
  const releaseNumber = artifact.manifest.releaseNumber;
  let status = await adapter.begin({ manifest: artifact.manifest, writeEpoch });
  if (
    status.manifest.artifactFingerprint !==
      artifact.manifest.artifactFingerprint ||
    status.releaseNumber !== releaseNumber ||
    status.nextBatchIndex < 0 ||
    status.nextBatchIndex > artifact.batches.length
  )
    throw new Error('Remote candidate does not match the immutable artifact.');
  if (status.state === 'prepared') return status;
  for (
    let batchIndex = status.nextBatchIndex;
    batchIndex < artifact.batches.length;
    batchIndex++
  ) {
    const rows = artifact.batches[batchIndex];
    if (!rows) throw new Error('Missing release batch.');
    status = await adapter.writeBatch({
      releaseNumber,
      batchIndex,
      rows,
      writeEpoch,
    });
  }
  return adapter.finalize({ releaseNumber, writeEpoch });
}
