import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { reviewedAdmissionSchema } from './admission-schema.ts';
import {
  MAX_RELEASE_BATCH_BYTES,
  MAX_RELEASE_BATCHES,
  canonicalReleaseJson,
  isObject,
  parseReleaseJson,
  releaseByteCount,
  releaseFingerprint,
  type ReleaseRow,
} from './release-schema.ts';

const chunkPrefix = 'registry:chunk:';
const chunkManifestSchema = z.strictObject({
  format: z.literal('registry-chunks-v1'),
  chunkCount: z.number().int().min(1).max(MAX_RELEASE_BATCHES),
  byteCount: z.number().int().positive(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

function registryChunkKey(index: number) {
  return `${chunkPrefix}${String(index).padStart(6, '0')}`;
}

export function registryChunkKeys(payload: unknown): string[] {
  if (!isObject(payload) || payload.format !== 'registry-chunks-v1') return [];
  const manifest = chunkManifestSchema.parse(payload);
  return Array.from({ length: manifest.chunkCount }, (_, index) =>
    registryChunkKey(index),
  );
}

export function validateReleaseRegistryRow(key: string, payload: unknown) {
  if (key === 'registry') {
    if (registryChunkKeys(payload).length) return;
    reviewedAdmissionSchema.shape.registry.parse(payload);
    return;
  }
  parseRegistryChunk(key, payload);
}

function parseRegistryChunk(key: string, payload: unknown): string {
  if (
    !/^registry:chunk:\d{6}$/.test(key) ||
    Number(key.slice(chunkPrefix.length)) >= MAX_RELEASE_BATCHES ||
    typeof payload !== 'string' ||
    !payload.length
  )
    throw new ConvexError('Invalid Catalog Release Registry chunk');
  return payload;
}

/** Keep legacy rows when they fit; split only the transport, never notice records. */
export async function boundReleaseRegistryRows(rows: ReleaseRow[]) {
  const result: ReleaseRow[] = [];
  for (const row of rows) {
    if (
      row.kind !== 'legal' ||
      row.key !== 'registry' ||
      releaseByteCount([row]) <= MAX_RELEASE_BATCH_BYTES
    ) {
      result.push(row);
      continue;
    }
    reviewedAdmissionSchema.shape.registry.parse(row.payload);
    const text = canonicalReleaseJson(row.payload);
    const chunks: string[] = [];
    // JSON escaping uses at most six bytes per UTF-16 unit. Leave room for
    // row keys, quotes and batch punctuation; do not split surrogate pairs.
    const chunkUnits = Math.floor(MAX_RELEASE_BATCH_BYTES / 8);
    for (let start = 0; start < text.length; ) {
      let end = Math.min(start + chunkUnits, text.length);
      const last = text.charCodeAt(end - 1);
      if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
      chunks.push(text.slice(start, end));
      start = end;
    }
    const payload = chunkManifestSchema.parse({
      format: 'registry-chunks-v1',
      chunkCount: chunks.length,
      byteCount: releaseByteCount(row.payload),
      fingerprint: await releaseFingerprint(row.payload),
    });
    result.push({ kind: 'legal', key: 'registry', payload });
    result.push(
      ...chunks.map(
        (payload, index): ReleaseRow => ({
          kind: 'legal',
          key: registryChunkKey(index),
          payload,
        }),
      ),
    );
  }
  return result;
}

/** Reconstruct the exact Registry and verify its whole-value commitment. */
export async function reconstructReleaseRegistry(rows: ReleaseRow[]) {
  const registries = rows.filter(
    (row) => row.kind === 'legal' && row.key === 'registry',
  );
  const [registryRow] = registries;
  if (registries.length !== 1 || !registryRow)
    throw new ConvexError('Catalog Release Registry is missing or duplicated');
  const payload = registryRow.payload;
  const chunks = rows.filter(
    (row) => row.kind === 'legal' && row.key.startsWith(chunkPrefix),
  );
  const keys = registryChunkKeys(payload);
  if (!keys.length) {
    if (chunks.length)
      throw new ConvexError('Unexpected Catalog Release Registry chunks');
    return reviewedAdmissionSchema.shape.registry.parse(payload);
  }
  const manifest = chunkManifestSchema.parse(payload);
  if (
    chunks.length !== keys.length ||
    new Set(chunks.map((row) => row.key)).size !== chunks.length
  )
    throw new ConvexError(
      'Catalog Release Registry chunks are incomplete or duplicated',
    );
  const text = keys
    .map((key) => {
      const row = chunks.find((row) => row.key === key);
      if (!row)
        throw new ConvexError('Catalog Release Registry chunk is missing');
      return parseRegistryChunk(row.key, row.payload);
    })
    .join('');
  const registry = parseReleaseJson(JSON.parse(text));
  if (
    canonicalReleaseJson(registry) !== text ||
    releaseByteCount(registry) !== manifest.byteCount ||
    (await releaseFingerprint(registry)) !== manifest.fingerprint
  )
    throw new ConvexError('Catalog Release Registry integrity mismatch');
  return reviewedAdmissionSchema.shape.registry.parse(registry);
}
