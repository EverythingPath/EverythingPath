import { z } from 'zod';

/**
 * The PRD capture's manifest and checklist files (#716 P8), parsed where
 * `prd-capture.ts` and `prd-pin.ts` read them.
 */
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const byteCount = z.number().int().nonnegative();

export const pageRoleSchema = z.enum([
  'index',
  'archetypes',
  'prestige',
  'classes',
  'license',
]);
export type PageRole = z.infer<typeof pageRoleSchema>;

/** A page listed with its snapshot, not fetched yet. */
export const pendingPageSchema = z.strictObject({
  path: z.string(),
  file: z.string(),
  book: z.string(),
  role: pageRoleSchema,
  originalUrl: z.url(),
  captureUrl: z.url(),
  captureTimestamp: z.string().regex(/^\d{14}$/),
});
export type PendingPage = z.infer<typeof pendingPageSchema>;

/** A page stored in the capture, with its bytes and hash. */
export const capturedPageSchema = pendingPageSchema.extend({
  bytes: byteCount,
  sha256,
});
export type CapturedPage = z.infer<typeof capturedPageSchema>;

/** A page of the manifest draft, in the order the dry run listed it. */
export const draftPageSchema = z.discriminatedUnion('kind', [
  pendingPageSchema.extend({ kind: z.literal('pending') }),
  capturedPageSchema.extend({ kind: z.literal('captured') }),
]);
export type DraftPage = z.infer<typeof draftPageSchema>;

const captureFields = {
  capture: z.string(),
  source: z.string(),
  retiredBy: z.string().regex(/^\d{8}$/),
};

/**
 * The dry run's projected size, checked against the 200-page, 40 MB limit.
 * Pending pages are projected from their snapshots' archived (compressed)
 * lengths and the ratio of original to archived bytes of the pages this run
 * fetched; when it fetched none, from the captured pages' mean size.
 */
const projectionSchema = z.strictObject({
  pages: z.number().int().nonnegative(),
  capturedBytes: byteCount,
  pendingPages: z.number().int().nonnegative(),
  basis: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('archived-ratio'),
      pendingArchivedBytes: byteCount,
      originalToArchivedRatio: z.number().positive(),
    }),
    z.strictObject({ kind: z.literal('mean-page'), meanPageBytes: byteCount }),
  ]),
  projectedBytes: byteCount,
});
export type Projection = z.infer<typeof projectionSchema>;

const draftManifestSchema = z.strictObject({
  status: z.literal('draft'),
  ...captureFields,
  pages: z.array(draftPageSchema),
  projection: projectionSchema,
});
export type DraftManifest = z.infer<typeof draftManifestSchema>;

/** A checklist file, as stored in the capture and recorded in the manifest. */
const checklistEntrySchema = z.strictObject({
  repo: z.url(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  path: z.string(),
  file: z.string(),
  bytes: byteCount,
  sha256,
});

/** The named reasons a checklist archetype may lack a captured page. */
export const exclusionNameSchema = z.enum(['arg-uncommon-races']);
export type ExclusionName = z.infer<typeof exclusionNameSchema>;

/** Where the capture holds a checklist archetype, or why it doesn't. */
const coverageItemSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('page'),
    item: z.string(),
    name: z.string(),
    page: z.string(),
  }),
  z.strictObject({
    kind: z.literal('excluded'),
    item: z.string(),
    name: z.string(),
    exclusion: exclusionNameSchema,
  }),
]);
export type CoverageItem = z.infer<typeof coverageItemSchema>;

/** The named reason a base-class schedule may lack a captured class table. */
export const classExclusionNameSchema = z.enum(['not-in-prd']);
export type ClassExclusionName = z.infer<typeof classExclusionNameSchema>;

/** The captured page that prints a schedule's class table, or why none does. */
const classCoverageItemSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('page'),
    schedule: z.string(),
    name: z.string(),
    page: z.string(),
  }),
  z.strictObject({
    kind: z.literal('excluded'),
    schedule: z.string(),
    name: z.string(),
    exclusion: classExclusionNameSchema,
  }),
]);
export type ClassCoverageItem = z.infer<typeof classCoverageItemSchema>;

export const completeManifestSchema = z.strictObject({
  status: z.literal('complete'),
  ...captureFields,
  pages: z.array(capturedPageSchema),
  totals: z.strictObject({ pages: byteCount, bytes: byteCount }),
  checklist: z.array(checklistEntrySchema),
  coverage: z.strictObject({
    exclusions: z.record(exclusionNameSchema, z.string().min(1)),
    items: z.array(coverageItemSchema),
    classes: z.strictObject({
      exclusions: z.record(classExclusionNameSchema, z.string().min(1)),
      schedules: z.array(classCoverageItemSchema),
    }),
  }),
});
export type CompleteManifest = z.infer<typeof completeManifestSchema>;

/**
 * The PRD supplement's page roles (owner decision of 2026-10-31): `ageTables`
 * is a race age-table page, used only as race age-table evidence. The
 * capture's own roles (`pageRoleSchema`) don't include it.
 */
export const supplementPageRoleSchema = z.enum(['ageTables']);
/** A supplement page: a captured page, with when it was fetched and its status. */
export const supplementPageSchema = capturedPageSchema.extend({
  role: supplementPageRoleSchema,
  fetchedAt: z.iso.datetime(),
  httpStatus: z.literal(200),
});
/**
 * A PRD supplement's manifest: pages captured by the capture's rules, beside
 * the capture it `supplements` and pinned on their own (`prd-supplement.ts`),
 * so the capture and its pin stay as they are.
 */
export const supplementManifestSchema = z.strictObject({
  status: z.literal('complete'),
  ...captureFields,
  supplements: z.string().min(1),
  purpose: z.string().min(1),
  pages: z.array(supplementPageSchema).min(1),
  totals: z.strictObject({ pages: byteCount, bytes: byteCount }),
});

export const manifestSchema = z.discriminatedUnion('status', [
  draftManifestSchema,
  completeManifestSchema,
]);
export type Manifest = z.infer<typeof manifestSchema>;

/**
 * A checklist item's facts: its name, classes and sources (book code and
 * page), with its file and git blob id. Prestige classes have no classes.
 */
export const checklistItemSchema = z.strictObject({
  file: z.string(),
  blob: z.string().regex(/^[0-9a-f]{40}$/),
  name: z.string(),
  type: z.string(),
  subType: z.string(),
  classes: z.array(z.string()).nullable(),
  sources: z.array(z.strictObject({ id: z.string(), pages: z.string() })),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const checklistFileSchema = z.strictObject({
  repo: z.url(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  path: z.string(),
  items: z.array(checklistItemSchema),
});
