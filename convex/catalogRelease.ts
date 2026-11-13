import { ConvexError, v, type Infer } from 'convex/values';
import { supersedeCatalogImpactTracking } from './lib/catalogReleaseImpact';
import { internalQuery, query, type MutationCtx } from './_generated/server';
import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server';
import type { Doc } from './_generated/dataModel';
import type { ReadCtx } from './types';
import { generalInternalMutation } from './lib/writeGate';
import {
  MAX_RELEASE_BATCH_BYTES,
  MAX_RELEASE_BATCH_ROWS,
  releaseFingerprint,
  releaseByteCount,
  releaseRowIdentity,
  validateCatalogReleaseManifest,
  validateCatalogReleaseRows,
  verifyCatalogReleaseManifest,
  type CatalogReleaseManifest,
  releaseReportCategories,
  releaseLegalKeys,
  isObject,
  parseReleaseJson,
  type ReleaseRow,
} from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import {
  registryChunkKeys,
  reconstructReleaseRegistry,
  validateReleaseRegistryRow,
} from '../src/lib/catalog/release-registry';
import { legalResourcesSchema } from '../src/lib/catalog/legal-types';
import schema from './schema';
import { releaseLegalInputsSchema } from '../src/lib/catalog/release-legal-inputs';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data';
import {
  importedCatalogEntrySchema,
  appliedRemapSchema,
} from '../src/lib/catalog/imported-entry-schema';
import {
  catalogReleaseManifestValidator,
  catalogReleaseRowValidator,
  catalogReleaseStatusValidator as statusValidator,
  releaseRowKindValidator,
  type CatalogReleaseStatus,
} from '../src/lib/catalog/release-validators';

export async function readActiveCatalogRelease(ctx: ReadCtx) {
  return ctx.db
    .query('catalogReleaseControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
}

async function getCatalogRelease(ctx: ReadCtx, releaseNumber: number) {
  const release = await ctx.db
    .query('catalogRelease')
    .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', releaseNumber))
    .unique();
  if (!release) throw new ConvexError('Catalog Release does not exist');
  return release;
}

function toReleaseStatus(release: CatalogReleaseStatus) {
  return {
    releaseNumber: release.releaseNumber,
    state: release.state,
    baseReleaseNumber: release.baseReleaseNumber,
    nextBatchIndex: release.nextBatchIndex,
    batchCount: release.batchCount,
    stagedRows: release.stagedRows,
    manifest: validateCatalogReleaseManifest(release.manifest),
  };
}

async function requireCurrentBase(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
) {
  await requireComparisonBase(
    ctx,
    validateCatalogReleaseManifest(release.manifest),
  );
}

async function requireComparisonBase(
  ctx: ReadCtx,
  manifest: CatalogReleaseManifest,
) {
  if (!(await isComparisonBaseCurrent(ctx, manifest)))
    throw new ConvexError(
      'Catalog Release comparison base artifact is no longer active',
    );
}

export async function isComparisonBaseCurrent(
  ctx: ReadCtx,
  manifest: CatalogReleaseManifest,
) {
  const active = await readActiveCatalogRelease(ctx);
  if (!active && manifest.baseRelease === null) return true;
  if (!active || manifest.baseRelease?.releaseNumber !== active.releaseNumber)
    return false;
  const base = await ctx.db
    .query('catalogRelease')
    .withIndex('by_releaseNumber', (q) =>
      q.eq('releaseNumber', active.releaseNumber),
    )
    .unique();
  if (!base) return false;
  const baseManifest = validateCatalogReleaseManifest(base.manifest);
  if (
    base.state !== 'prepared' ||
    baseManifest.artifactFingerprint !==
      manifest.baseRelease.artifactFingerprint
  )
    return false;
  return true;
}

export async function readLegalInputs(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
) {
  const result: Record<string, unknown> = {};
  for (const key of releaseLegalKeys) {
    const row = await ctx.db
      .query('catalogReleaseRow')
      .withIndex('by_releaseId_and_kind_and_key', (q) =>
        q.eq('releaseId', release._id).eq('kind', 'legal').eq('key', key),
      )
      .unique();
    if (!row) throw new ConvexError('Catalog Release legal inputs are missing');
    result[key] = row.payload;
  }
  const keys = registryChunkKeys(result.registry);
  const recordedKeys = release.legalKeys.filter((key) =>
    key.startsWith('registry:chunk:'),
  );
  if (
    recordedKeys.length !== keys.length ||
    recordedKeys.some((key) => !keys.includes(key))
  )
    throw new ConvexError(
      'Catalog Release Registry chunks are incomplete or unexpected',
    );
  const registryRows: ReleaseRow[] = [
    {
      kind: 'legal',
      key: 'registry',
      payload: parseReleaseJson(result.registry),
    },
  ];
  for (const key of keys) {
    const row = await ctx.db
      .query('catalogReleaseRow')
      .withIndex('by_releaseId_and_kind_and_key', (q) =>
        q.eq('releaseId', release._id).eq('kind', 'legal').eq('key', key),
      )
      .unique();
    if (!row)
      throw new ConvexError('Catalog Release Registry chunk is missing');
    registryRows.push({
      kind: 'legal',
      key,
      payload: parseReleaseJson(row.payload),
    });
  }
  result.registry = await reconstructReleaseRegistry(registryRows);
  return releaseLegalInputsSchema.parse(result);
}

type LegalInputs = Awaited<ReturnType<typeof readLegalInputs>>;
type LegalPage = ReturnType<typeof buildLegalPageData>;

function noticeVersion(notice: { id: string; text: string }) {
  return JSON.stringify([notice.id, notice.text]);
}

function requirePublishedNotices(page: LegalPage, published: Set<string>) {
  if (
    page.permanentNoticeSuperset.some(
      (notice) => !published.has(noticeVersion(notice)),
    )
  )
    throw new ConvexError(
      'Catalog Release permanent notice superset omits required published notices',
    );
}

async function requirePermanentNoticeSuperset(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  published: Set<string>,
) {
  if (release.baseReleaseNumber === null) return;
  const prior = await readLegalInputs(
    ctx,
    await getCatalogRelease(ctx, release.baseReleaseNumber),
  );
  if (
    prior.permanentNoticeSuperset.some(
      (notice) => !published.has(noticeVersion(notice)),
    )
  )
    throw new ConvexError(
      'Catalog Release permanent notice superset cannot shrink',
    );
}

async function getHoldsReport(ctx: ReadCtx, release: Doc<'catalogRelease'>) {
  const holds = await ctx.db
    .query('catalogReleaseRow')
    .withIndex('by_releaseId_and_kind_and_key', (q) =>
      q.eq('releaseId', release._id).eq('kind', 'report').eq('key', 'holds'),
    )
    .unique();
  const payload: unknown = holds?.payload;
  return isObject(payload) ? payload : {};
}

async function requireRetainedNoticeExceptions(
  report: Record<string, unknown>,
  page: LegalPage,
) {
  const outstanding =
    'outstandingNotices' in report ? report.outstandingNotices : [];
  const retainedRequirements =
    'retainedRequiredNotices' in report ? report.retainedRequiredNotices : [];
  if (
    !Array.isArray(retainedRequirements) ||
    retainedRequirements.some(
      (code) => typeof code !== 'string' || !code.trim(),
    )
  )
    throw new ConvexError(
      'Catalog Release retained notice requirements are invalid',
    );
  if (
    (await releaseFingerprint(outstanding)) !==
      (await releaseFingerprint(page.outstandingNotices)) ||
    page.outstandingNotices.some(
      (notice) => !retainedRequirements.includes(notice.code),
    ) ||
    (page.outstandingNotices.length > 0 &&
      (typeof report.retainedExceptions !== 'number' ||
        report.retainedExceptions < 1))
  )
    throw new ConvexError(
      'Catalog Release outstanding notices are not reported retained exceptions',
    );
}

async function requireLegalGate(ctx: ReadCtx, release: Doc<'catalogRelease'>) {
  const inputs: LegalInputs = await readLegalInputs(ctx, release);
  const page = buildLegalPageData(inputs);
  const published = new Set(inputs.permanentNoticeSuperset.map(noticeVersion));
  requirePublishedNotices(page, published);
  await requirePermanentNoticeSuperset(ctx, release, published);
  await requireRetainedNoticeExceptions(
    await getHoldsReport(ctx, release),
    page,
  );
}

export async function requireCurrentPreparation(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
) {
  await requireCurrentBase(ctx, release);
  const latest = await ctx.db
    .query('catalogRelease')
    .withIndex('by_releaseNumber')
    .order('desc')
    .first();
  if (latest?._id !== release._id)
    throw new ConvexError('Catalog Release preparation was superseded');
}

function validateLegalRow(key: string, payload: unknown) {
  if (key.startsWith('registry:chunk:')) {
    validateReleaseRegistryRow(key, payload);
    return;
  }
  switch (key) {
    case 'requiredNotices':
      if (
        !Array.isArray(payload) ||
        payload.some((item) => typeof item !== 'string' || !item.trim())
      )
        throw new ConvexError('Invalid required Catalog Release notices');
      return;
    case 'permanentNoticeSuperset':
      legalResourcesSchema.shape.permanentNoticeSuperset.parse(payload);
      return;
    case 'registry':
      validateReleaseRegistryRow(key, payload);
      return;
    case 'resources':
      legalResourcesSchema.parse(payload);
      return;
    default:
      throw new ConvexError('Unknown Catalog Release legal input');
  }
}

function validateReportRow(key: string, payload: unknown) {
  if (
    !releaseReportCategories.some((category) => category === key.split(':')[0])
  )
    throw new ConvexError('Unknown Catalog Release report category');
  if (key.includes(':')) return;
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !('gatePassed' in payload) ||
    payload.gatePassed !== true
  )
    throw new ConvexError('Catalog Release report gate did not pass');
  if (
    (key === 'content' || key === 'resources') &&
    (!('coverageComplete' in payload) || payload.coverageComplete !== true)
  )
    throw new ConvexError('Catalog Release coverage is incomplete');
  if (key === 'curation' && (!('passed' in payload) || payload.passed !== true))
    throw new ConvexError('Catalog Release curation did not pass');
}

export const begin = generalInternalMutation({
  args: { manifest: catalogReleaseManifestValidator },
  returns: statusValidator,
  handler: async (ctx, args) => {
    const manifest = validateCatalogReleaseManifest(args.manifest);
    await verifyCatalogReleaseManifest(manifest);
    await requireComparisonBase(ctx, manifest);
    const existing = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) =>
        q.eq('releaseNumber', manifest.releaseNumber),
      )
      .unique();
    if (existing) {
      if (
        (await releaseFingerprint(existing.manifest)) !==
        (await releaseFingerprint(manifest))
      )
        throw new ConvexError(
          'Catalog Release number is already bound to different inputs or output',
        );
      await requireCurrentBase(ctx, existing);
      return toReleaseStatus(existing);
    }
    const highest = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber')
      .order('desc')
      .first();
    const active = await readActiveCatalogRelease(ctx);
    if (
      manifest.releaseNumber <=
      Math.max(highest?.releaseNumber ?? 0, active?.releaseNumber ?? 0)
    )
      throw new ConvexError('Catalog Release number must increase');
    const fields = {
      releaseNumber: manifest.releaseNumber,
      state: 'preparing' as const,
      baseReleaseNumber: active?.releaseNumber ?? null,
      manifest,
      nextBatchIndex: 0,
      batchCount: manifest.batches.length,
      stagedRows: 0,
      reportCategories: [],
      legalKeys: [],
    };
    await ctx.db.insert('catalogRelease', fields);
    await supersedeCatalogImpactTracking(ctx);
    return toReleaseStatus(fields);
  },
});

type StagedReleaseRow = Infer<typeof catalogReleaseRowValidator>;

async function requireBatchCommitment(
  manifest: CatalogReleaseManifest,
  batchIndex: number,
  rows: StagedReleaseRow[],
) {
  if (
    !Number.isSafeInteger(batchIndex) ||
    batchIndex < 0 ||
    batchIndex >= manifest.batches.length
  )
    throw new ConvexError('Invalid Catalog Release batch index');
  const descriptor = manifest.batches[batchIndex];
  if (!descriptor) throw new ConvexError('Invalid Catalog Release batch index');
  const bytes = releaseByteCount(rows);
  if (rows.length > MAX_RELEASE_BATCH_ROWS || bytes > MAX_RELEASE_BATCH_BYTES)
    throw new ConvexError('Catalog Release batch exceeds row or byte limit');
  const fingerprint = await releaseFingerprint(rows);
  if (
    descriptor.fingerprint !== fingerprint ||
    descriptor.rowCount !== rows.length ||
    descriptor.byteCount !== bytes
  )
    throw new ConvexError(
      'Catalog Release batch differs from immutable output',
    );
}

async function requireUniqueReleaseRows(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  rows: StagedReleaseRow[],
) {
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.kind === 'definition')
      importedCatalogEntrySchema.parse(row.payload);
    if (row.kind === 'remap') appliedRemapSchema.parse(row.payload);
    if (row.kind === 'legal') validateLegalRow(row.key, row.payload);
    if (row.kind === 'report') validateReportRow(row.key, row.payload);
    const key = releaseRowIdentity(row);
    if (keys.has(key)) throw new ConvexError('Duplicate Catalog Release row');
    keys.add(key);
    if (row.kind === 'definition' || row.kind === 'resource') {
      const otherKind = row.kind === 'definition' ? 'resource' : 'definition';
      const conflicting = await ctx.db
        .query('catalogReleaseRow')
        .withIndex('by_releaseId_and_kind_and_key', (q) =>
          q
            .eq('releaseId', release._id)
            .eq('kind', otherKind)
            .eq('key', row.key),
        )
        .unique();
      if (conflicting)
        throw new ConvexError(
          'Catalog Release identity cannot name both a definition and a resource',
        );
    }
    const existing = await ctx.db
      .query('catalogReleaseRow')
      .withIndex('by_releaseId_and_kind_and_key', (q) =>
        q.eq('releaseId', release._id).eq('kind', row.kind).eq('key', row.key),
      )
      .unique();
    if (existing) throw new ConvexError('Duplicate Catalog Release row');
  }
}

async function stageReleaseBatch(
  ctx: MutationCtx,
  release: Doc<'catalogRelease'>,
  batchIndex: number,
  rows: StagedReleaseRow[],
) {
  const reportCategories = new Set(release.reportCategories);
  const legalKeys = new Set(release.legalKeys);
  for (const row of rows) {
    await ctx.db.insert('catalogReleaseRow', {
      releaseId: release._id,
      batchIndex,
      ...row,
    });
    if (row.kind === 'report' && !row.key.includes(':'))
      reportCategories.add(row.key);
    if (row.kind === 'legal') legalKeys.add(row.key);
  }
  const patch = {
    nextBatchIndex: release.nextBatchIndex + 1,
    stagedRows: release.stagedRows + rows.length,
    reportCategories: [...reportCategories],
    legalKeys: [...legalKeys],
  };
  return patch;
}

export const writeBatch = generalInternalMutation({
  args: {
    releaseNumber: v.number(),
    batchIndex: v.number(),
    rows: v.array(catalogReleaseRowValidator),
  },
  returns: statusValidator,
  handler: async (ctx, args) => {
    const release = await getCatalogRelease(ctx, args.releaseNumber);
    await requireCurrentPreparation(ctx, release);
    const manifest = validateCatalogReleaseManifest(release.manifest);
    validateCatalogReleaseRows(args.rows);
    const rows = args.rows;
    await requireBatchCommitment(manifest, args.batchIndex, rows);
    if (args.batchIndex < release.nextBatchIndex)
      return toReleaseStatus(release);
    if (
      release.state !== 'preparing' ||
      args.batchIndex !== release.nextBatchIndex
    )
      throw new ConvexError('Write the next Catalog Release batch in order');
    await requireUniqueReleaseRows(ctx, release, rows);
    const patch = await stageReleaseBatch(ctx, release, args.batchIndex, rows);
    await ctx.db.patch('catalogRelease', release._id, patch);
    return toReleaseStatus({ ...release, ...patch });
  },
});

export const finalize = generalInternalMutation({
  args: { releaseNumber: v.number() },
  returns: statusValidator,
  handler: async (ctx, args) => {
    const release = await getCatalogRelease(ctx, args.releaseNumber);
    await requireCurrentPreparation(ctx, release);
    if (release.state === 'prepared') return toReleaseStatus(release);
    if (release.nextBatchIndex !== release.batchCount)
      throw new ConvexError('Catalog Release batches are incomplete');
    if (
      releaseReportCategories.some(
        (key) => !release.reportCategories.includes(key),
      ) ||
      releaseLegalKeys.some((key) => !release.legalKeys.includes(key))
    )
      throw new ConvexError(
        'Catalog Release reports or legal inputs are incomplete',
      );
    await requireLegalGate(ctx, release);
    await ctx.db.patch('catalogRelease', release._id, { state: 'prepared' });
    return toReleaseStatus({ ...release, state: 'prepared' });
  },
});

export const inspect = internalQuery({
  args: { releaseNumber: v.number() },
  returns: statusValidator,
  handler: async (ctx, args) =>
    toReleaseStatus(await getCatalogRelease(ctx, args.releaseNumber)),
});

export const inspectRows = internalQuery({
  args: {
    releaseNumber: v.number(),
    kind: releaseRowKindValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc('catalogReleaseRow')),
  handler: async (ctx, args) => {
    const { numItems, maximumRowsRead, maximumBytesRead } = args.paginationOpts;
    if (
      !Number.isSafeInteger(numItems) ||
      numItems < 1 ||
      numItems > MAX_RELEASE_BATCH_ROWS ||
      maximumRowsRead === undefined ||
      !Number.isSafeInteger(maximumRowsRead) ||
      maximumRowsRead < 1 ||
      maximumRowsRead > MAX_RELEASE_BATCH_ROWS ||
      maximumBytesRead === undefined ||
      !Number.isSafeInteger(maximumBytesRead) ||
      maximumBytesRead < 1 ||
      maximumBytesRead > MAX_RELEASE_BATCH_BYTES
    )
      throw new ConvexError(
        'Catalog Release inspection requires bounded rows and bytes',
      );
    const release = await getCatalogRelease(ctx, args.releaseNumber);
    return ctx.db
      .query('catalogReleaseRow')
      .withIndex('by_releaseId_and_kind_and_key', (q) =>
        q.eq('releaseId', release._id).eq('kind', args.kind),
      )
      .paginate(args.paginationOpts);
  },
});

export const readiness = internalQuery({
  args: {
    releaseNumber: v.number(),
    schemaIdentity: v.string(),
    calculationIdentity: v.string(),
  },
  returns: v.object({
    isPrepared: v.boolean(),
    isBaseCurrent: v.boolean(),
    isCandidateCurrent: v.boolean(),
    isCompatible: v.boolean(),
    isActivationImplemented: v.literal(true),
  }),
  handler: async (ctx, args) => {
    const release = await getCatalogRelease(ctx, args.releaseNumber);
    const manifest = validateCatalogReleaseManifest(release.manifest);
    const latest = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber')
      .order('desc')
      .first();
    return {
      isPrepared: release.state === 'prepared',
      isBaseCurrent: await isComparisonBaseCurrent(ctx, manifest),
      isCandidateCurrent: latest?._id === release._id,
      isCompatible:
        manifest.compatibility.schema === args.schemaIdentity &&
        manifest.compatibility.calculation === args.calculationIdentity &&
        args.schemaIdentity === catalogRuntimeCompatibility.schema &&
        args.calculationIdentity === catalogRuntimeCompatibility.calculation,
      isActivationImplemented: true as const,
    };
  },
});

// Only the active selection may feed the public page. Preparation exposes nothing.
export const legalInputs = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      registry: v.any(),
      resources: v.any(),
      requiredNotices: v.array(v.string()),
      permanentNoticeSuperset: v.any(),
    }),
  ),
  handler: async (ctx) => {
    const active = await readActiveCatalogRelease(ctx);
    if (!active) return null;
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) =>
        q.eq('releaseNumber', active.releaseNumber),
      )
      .unique();
    if (release?.state !== 'prepared') return null;
    return readLegalInputs(ctx, release);
  },
});
