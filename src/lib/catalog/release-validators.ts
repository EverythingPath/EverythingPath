import { v, type Infer } from 'convex/values';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import {
  importedCatalogEntrySchema,
  appliedRemapSchema,
} from './imported-entry-schema';
import { releaseInputCategories, releaseRowKinds } from './release-schema';

// Safe cast: built from every release input category.
const inputFingerprints = Object.fromEntries(
  releaseInputCategories.map((key) => [key, v.string()]),
) as Record<
  (typeof releaseInputCategories)[number],
  ReturnType<typeof v.string>
>;

export const releaseRowKindValidator = v.union(
  ...releaseRowKinds.map((kind) => v.literal(kind)),
);
export const catalogReleaseManifestValidator = v.object({
  formatVersion: v.literal(1),
  releaseNumber: v.number(),
  baseRelease: v.union(
    v.null(),
    v.object({ releaseNumber: v.number(), artifactFingerprint: v.string() }),
  ),
  inputs: v.object(inputFingerprints),
  compatibility: v.object({ schema: v.string(), calculation: v.string() }),
  inputFingerprint: v.string(),
  outputFingerprint: v.string(),
  batches: v.array(
    v.object({
      fingerprint: v.string(),
      rowCount: v.number(),
      byteCount: v.number(),
    }),
  ),
  artifactFingerprint: v.string(),
});
export const catalogReleaseStatusValidator = v.object({
  releaseNumber: v.number(),
  state: v.union(v.literal('preparing'), v.literal('prepared')),
  baseReleaseNumber: v.union(v.number(), v.null()),
  nextBatchIndex: v.number(),
  batchCount: v.number(),
  stagedRows: v.number(),
  manifest: catalogReleaseManifestValidator,
});
export type CatalogReleaseStatus = Infer<typeof catalogReleaseStatusValidator>;

const rowFields = { key: v.string() };
export const catalogReleaseRowValidator = v.union(
  v.object({
    ...rowFields,
    kind: v.literal(releaseRowKinds[0]),
    payload: zodOutputToConvex(importedCatalogEntrySchema),
  }),
  v.object({
    ...rowFields,
    kind: v.literal(releaseRowKinds[1]),
    payload: v.any(),
  }),
  v.object({
    ...rowFields,
    kind: v.literal(releaseRowKinds[2]),
    payload: zodOutputToConvex(appliedRemapSchema),
  }),
  v.object({
    ...rowFields,
    kind: v.literal(releaseRowKinds[3]),
    payload: v.any(),
  }),
  v.object({
    ...rowFields,
    kind: v.literal(releaseRowKinds[4]),
    payload: v.any(),
  }),
);
