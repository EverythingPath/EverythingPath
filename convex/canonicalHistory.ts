import { ConvexError, v } from 'convex/values';
import { query, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import {
  requireOrganizationMembership,
  requireScope,
  readScopedResolutionRecordEntry,
} from './lib/canonicalDraftStorage';
import { readCampaignDeletion } from './lib/campaignDeletion';
import { canonicalRecordValidator } from './lib/canonicalStorageValidators';
import { canonicalResolutionRecordSchema } from '../src/lib/canonical-resolution-record';
import { projectHeadlineFacts } from '../src/lib/finished-week-headlines';
import { z } from 'zod';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';

const provenanceValidator = zodOutputToConvex(
  canonicalResolutionRecordSchema.shape.provenance,
);
const headlineValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
);
const finishedWeekValidator = v.object({
  week: v.number(),
  effectiveRecordId: v.string(),
  effectiveSequence: v.number(),
  entryCount: v.number(),
  provenance: provenanceValidator,
  rulesetVersion: v.number(),
  createdAt: v.number(),
  headlineFacts: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      before: headlineValueValidator,
      final: headlineValueValidator,
      beforeRecorded: v.boolean(),
      finalRecorded: v.boolean(),
      unit: v.union(v.literal('number'), v.literal('gp'), v.literal('text')),
    }),
  ),
});

type RecordRow = Doc<'canonicalResolutionRecord'>;
type HistoryScope = { campaignId: Id<'campaign'>; militiaId: Id<'militia'> };
type WeekSeek =
  | { kind: 'latest' }
  | { kind: 'before'; week: number }
  | { kind: 'exact'; week: number };

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const listArgsSchema = z.strictObject({
  beforeWeek: nonnegativeIntegerSchema.optional(),
  limit: z.number().int().min(1).max(50).default(25),
  selectedWeek: nonnegativeIntegerSchema.optional(),
});

// The militia row is used solely to authorize campaign ownership, never to
// reconstruct historical facts. A campaign without a militia has no history.
// Membership is checked first, so an outsider learns nothing about a campaign,
// live or deleted, not even whether it has history.
async function requireHistoryScope(
  ctx: QueryCtx,
  campaignId: Id<'campaign'>,
): Promise<HistoryScope> {
  const campaign = await ctx.db.get('campaign', campaignId);
  if (!campaign) return requireDeletedCampaignHistoryScope(ctx, campaignId);
  await requireOrganizationMembership(ctx, campaign.organizationId);
  const militia = await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .unique();
  if (!militia) throw new ConvexError('Campaign militia unavailable');
  return await requireScope(ctx, { campaignId, militiaId: militia._id });
}

/**
 * A deleted campaign's retained history (#710): read-only to the current
 * members of its surviving organization. Its deletion kept the militia it
 * had; an organization's deletion leaves nobody with access. An unknown
 * campaign refuses exactly as one the viewer can't access.
 */
async function requireDeletedCampaignHistoryScope(
  ctx: QueryCtx,
  campaignId: Id<'campaign'>,
): Promise<HistoryScope> {
  const deletion = await readCampaignDeletion(ctx, campaignId);
  if (!deletion) throw new ConvexError('Campaign access required');
  await requireOrganizationMembership(ctx, deletion.organizationId);
  if (!deletion.militiaId)
    throw new ConvexError('Campaign militia unavailable');
  return { campaignId, militiaId: deletion.militiaId };
}

function requireRecordMilitia(row: RecordRow, scope: HistoryScope) {
  if (row.militiaId !== scope.militiaId)
    throw new ConvexError('Invalid record militia reference');
  return row;
}

// Append-only storage gives each week a single chain: every later sequence
// supersedes the then effective record, so a week's highest sequence is its
// effective record. A descending seek below a week boundary therefore lands on
// the next older week's effective record, skipping that week's whole chain.
async function findEffectiveRecord(
  ctx: QueryCtx,
  scope: HistoryScope,
  seek: WeekSeek,
) {
  const row = await ctx.db
    .query('canonicalResolutionRecord')
    .withIndex('by_campaignId_and_week_and_sequence', (q) => {
      const campaign = q.eq('campaignId', scope.campaignId);
      if (seek.kind === 'exact') return campaign.eq('week', seek.week);
      if (seek.kind === 'before') return campaign.lt('week', seek.week);
      return campaign;
    })
    .order('desc')
    .first();
  return row && requireRecordMilitia(row, scope);
}

// Seeks up to `limit` + 1 distinct weeks; the extra one only reveals whether an
// older page exists.
async function findEffectiveRecordPage(
  ctx: QueryCtx,
  scope: HistoryScope,
  { beforeWeek, limit }: { beforeWeek?: number; limit: number },
) {
  const rows: RecordRow[] = [];
  let seek: WeekSeek =
    beforeWeek === undefined
      ? { kind: 'latest' }
      : { kind: 'before', week: beforeWeek };
  while (rows.length <= limit) {
    const row = await findEffectiveRecord(ctx, scope, seek);
    if (!row) break;
    rows.push(row);
    seek = { kind: 'before', week: row.week };
  }
  return { rows: rows.slice(0, limit), hasEarlier: rows.length > limit };
}

function toFinishedWeek(row: RecordRow) {
  return {
    week: row.week,
    effectiveRecordId: row.recordId,
    effectiveSequence: row.sequence,
    // Sequences start at zero, so the effective sequence + 1 counts the chain.
    entryCount: row.sequence + 1,
    provenance: row.record.provenance,
    rulesetVersion: row.record.rulesetVersion,
    createdAt: row._creationTime,
    headlineFacts: projectHeadlineFacts(row.record),
  };
}

// One bounded listing for Finished weeks and Campaign home's latest weeks:
// compact effective-record metadata only, never full records or artifacts.
export const list = query({
  args: {
    campaignId: v.id('campaign'),
    beforeWeek: v.optional(v.number()),
    limit: v.optional(v.number()),
    selectedWeek: v.optional(v.number()),
  },
  returns: v.object({
    weeks: v.array(finishedWeekValidator),
    earlierWeek: v.union(v.number(), v.null()),
    selected: v.union(finishedWeekValidator, v.null()),
  }),
  handler: async (ctx, { campaignId, ...selectors }) => {
    const parsed = listArgsSchema.safeParse(selectors);
    if (!parsed.success)
      throw new ConvexError('Invalid finished-week selection');
    const { selectedWeek, ...page } = parsed.data;
    const scope = await requireHistoryScope(ctx, campaignId);
    const { rows, hasEarlier } = await findEffectiveRecordPage(
      ctx,
      scope,
      page,
    );
    const weeks = rows.map(toFinishedWeek);
    const earlierWeek = hasEarlier
      ? (weeks[weeks.length - 1]?.week ?? null)
      : null;
    if (selectedWeek === undefined)
      return { weeks, earlierWeek, selected: null };
    const listed = weeks.find((row) => row.week === selectedWeek);
    if (listed) return { weeks, earlierWeek, selected: listed };
    const row = await findEffectiveRecord(ctx, scope, {
      kind: 'exact',
      week: selectedWeek,
    });
    return { weeks, earlierWeek, selected: row && toFinishedWeek(row) };
  },
});

// Read-only history is separate from the open Workspace.
export const read = query({
  args: {
    campaignId: v.id('campaign'),
    week: v.optional(v.number()),
    recordId: v.optional(v.string()),
    beforeSequence: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      week: v.number(),
      effectiveRecordId: v.string(),
      record: canonicalRecordValidator,
      createdAt: v.number(),
      previousWeek: v.union(v.number(), v.null()),
      nextWeek: v.union(v.number(), v.null()),
      audit: v.array(
        v.object({
          recordId: v.string(),
          sequence: v.number(),
          provenance: provenanceValidator,
          createdAt: v.number(),
        }),
      ),
      earlierSequence: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const scope = await requireHistoryScope(ctx, args.campaignId);
    const week =
      args.week === undefined
        ? undefined
        : nonnegativeIntegerSchema.parse(args.week);
    const before =
      args.beforeSequence === undefined
        ? undefined
        : nonnegativeIntegerSchema.parse(args.beforeSequence);
    const effective = await findEffectiveRecord(
      ctx,
      scope,
      week === undefined ? { kind: 'latest' } : { kind: 'exact', week },
    );
    if (!effective) return null;
    const selected =
      args.recordId === undefined
        ? {
            record: canonicalResolutionRecordSchema.parse(effective.record),
            createdAt: effective._creationTime,
          }
        : await readScopedResolutionRecordEntry(ctx, scope, args.recordId);
    if (selected?.record.source.week !== effective.week)
      throw new ConvexError('Invalid historical week reference');
    const [previous, next, audit] = await Promise.all([
      ctx.db
        .query('canonicalResolutionRecord')
        .withIndex('by_campaignId_and_week_and_sequence', (q) =>
          q.eq('campaignId', args.campaignId).lt('week', effective.week),
        )
        .order('desc')
        .first(),
      ctx.db
        .query('canonicalResolutionRecord')
        .withIndex('by_campaignId_and_week_and_sequence', (q) =>
          q.eq('campaignId', args.campaignId).gt('week', effective.week),
        )
        .order('asc')
        .first(),
      ctx.db
        .query('canonicalResolutionRecord')
        .withIndex('by_campaignId_and_week_and_sequence', (q) => {
          const records = q
            .eq('campaignId', args.campaignId)
            .eq('week', effective.week);
          return before === undefined
            ? records
            : records.lt('sequence', before);
        })
        .order('desc')
        .take(6),
    ]);
    return {
      week: effective.week,
      effectiveRecordId: effective.recordId,
      record: selected.record,
      createdAt: selected.createdAt,
      previousWeek: previous?.week ?? null,
      nextWeek: next?.week ?? null,
      audit: audit
        .slice(0, 5)
        .map(({ recordId, sequence, record, _creationTime }) => ({
          recordId,
          sequence,
          provenance: record.provenance,
          createdAt: _creationTime,
        })),
      earlierSequence: audit.length > 5 ? (audit[4]?.sequence ?? null) : null,
    };
  },
});
