import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import {
  gatedMutation,
  gatedInternalMutation,
  generalInternalMutation,
} from './lib/writeGate';
import { internal } from './_generated/api';
import { isolationArgs } from './e2eFixtures';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import { v } from 'convex/values';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';
import {
  internalMutation as readOnlyMutation,
  type MutationCtx,
} from './_generated/server';
import {
  scopeSchema as fixtureScopeSchema,
  guardFixtureScope,
  isCanonicalCase,
} from '../e2e/fixtures/catalog';
import {
  draftKeySchema,
  canonicalRecordValidator,
} from './lib/canonicalStorageValidators';
import { weeklyDraftDataSchema } from '../src/lib/weekly-draft-contract';
import { createWeeklyDraft } from '../src/lib/weekly-draft';
import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import {
  canonicalResolutionRecordSchema,
  type CanonicalResolutionRecord,
} from '../src/lib/canonical-resolution-record';

type Scope = z.infer<typeof fixtureScopeSchema>;
async function ownedCampaign(ctx: MutationCtx, scope: Scope) {
  guardFixtureScope(process.env, scope);
  if (!isCanonicalCase(scope.caseKey)) throw new Error('Wrong fixture case');
  const campaign = await ctx.db
    .query('campaign')
    .withIndex('by_e2eFixture_namespace_and_workerKey_and_caseKey', (q) =>
      q
        .eq('e2eFixture.namespace', scope.namespace)
        .eq('e2eFixture.workerKey', scope.workerKey)
        .eq('e2eFixture.caseKey', scope.caseKey),
    )
    .unique();
  if (campaign?.e2eFixture?.version !== scope.version)
    throw new Error('Missing owned fixture campaign');
  return campaign;
}
export const initialize = generalInternalMutation({
  args: { scope: zodOutputToConvex(fixtureScopeSchema), draftId: v.string() },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args) => {
    const campaign = await ownedCampaign(ctx, args.scope);
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .unique();
    if (!militia) throw new Error('Missing fixture militia');
    const existing = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .first();
    if (existing) throw new Error('Reset the owned case before initializing');
    const key = {
      campaignId: campaign._id,
      militiaId: militia._id,
      draftId: args.draftId,
    };
    const draft = weeklyDraftDataSchema.parse(
      createWeeklyDraft({
        draftId: args.draftId,
        week: 1,
        slotIds: ['left', 'right', 'extra'],
        context: {
          firstMilitiaWeek: true,
          startDay: 0,
          uneventfulCarry: false,
          carriedEvents: [],
          queuedEffects: [],
          orders: [],
          lastBuyoffWeek: null,
        },
      }),
    );
    const snapshot = militiaSnapshotSchema.parse({
      rank: 1,
      training: 0,
      treasuryCopper: 100,
      notoriety: 0,
      focus: 'Loyalty',
      roster: { people: [], teams: [], officers: [] },
      characters: [],
      settlements: [],
      bonuses: [],
    });
    await ctx.db.insert('canonicalMilitiaState', {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      revision: 0,
      snapshot,
    });
    await ctx.db.insert('canonicalWeeklyDraft', {
      ...key,
      status: 'open',
      draft,
      initialDraft: draft,
      revision: 0,
    });
    return key;
  },
});
// One guarded transaction avoids a separate CLI startup for every contract case.
export const resetAndInitialize = gatedInternalMutation({
  args: {
    scope: zodOutputToConvex(fixtureScopeSchema),
    draftId: v.string(),
    now: v.number(),
    ...isolationArgs,
  },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args): Promise<z.infer<typeof draftKeySchema>> => {
    await ctx.runMutation(internal.e2eFixtures.resetCase, {
      ...args.scope,
      writeEpoch: ctx.writeEpoch,
      now: args.now,
      isolatedWith: args.isolatedWith,
    });
    return await ctx.runMutation(
      internal.canonicalPersistenceFixtures.initialize,
      {
        scope: args.scope,
        writeEpoch: ctx.writeEpoch,
        draftId: args.draftId,
      },
    );
  },
});

export const close = generalInternalMutation({
  args: zodOutputToConvex(draftKeySchema.extend({ scope: fixtureScopeSchema })),
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ownedCampaign(ctx, args.scope);
    if (campaign._id !== args.campaignId)
      throw new Error('Wrong fixture campaign');
    const row = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', args.draftId))
      .unique();
    if (row?.campaignId !== args.campaignId || row.militiaId !== args.militiaId)
      throw new Error('Wrong fixture draft');
    await ctx.db.patch('canonicalWeeklyDraft', row._id, {
      status: 'closed',
      draft: null,
      initialDraft: undefined,
    });
    const sourceReviews = await ctx.db
      .query('canonicalDraftSourceReview')
      .withIndex('by_draftId_and_revision', (q) =>
        q.eq('draftId', args.draftId),
      )
      .take(101);
    if (sourceReviews.length > 100)
      throw new Error('Fixture review checkpoint limit exceeded');
    for (const review of sourceReviews)
      await ctx.db.delete('canonicalDraftSourceReview', review._id);
    const operations = await ctx.db
      .query('canonicalDraftOperation')
      .withIndex('by_draftId_and_operationId', (q) =>
        q.eq('draftId', args.draftId),
      )
      .take(101);
    if (operations.length > 100)
      throw new Error('Fixture operation limit exceeded');
    for (const operation of operations)
      await ctx.db.patch('canonicalDraftOperation', operation._id, {
        acceptedDraft: undefined,
      });
    return null;
  },
});

const lifecycleArgs = draftKeySchema.extend({ scope: fixtureScopeSchema });
async function ownedSource(
  ctx: MutationCtx,
  args: z.infer<typeof lifecycleArgs>,
) {
  const campaign = await ownedCampaign(ctx, args.scope);
  if (campaign._id !== args.campaignId)
    throw new Error('Wrong fixture campaign');
  const state = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
    .unique();
  if (state?.campaignId !== campaign._id)
    throw new Error('Wrong fixture militia');
  const row = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_draftId', (q) => q.eq('draftId', args.draftId))
    .unique();
  if (row?.militiaId !== state.militiaId || row.campaignId !== campaign._id)
    throw new Error('Wrong fixture draft');
  return { state, row };
}
export const changeSource = generalInternalMutation({
  args: zodOutputToConvex(
    lifecycleArgs.extend({
      change: z.enum(['revision', 'treasury', 'invalid_reference']),
    }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { state } = await ownedSource(ctx, args);
    const snapshot = militiaSnapshotSchema.parse(state.snapshot);
    if (args.change === 'treasury') snapshot.treasuryCopper += 7;
    if (args.change === 'invalid_reference')
      snapshot.bonuses.push({
        bonusId: 'broken',
        source: 'fixture',
        check: 'any',
        value: 1,
        teamId: 'foreign',
        phase: 'activity',
        availableWeek: 1,
        consumedWeek: null,
      });
    await ctx.db.patch('canonicalMilitiaState', state._id, {
      revision: state.revision + 1,
      snapshot,
    });
    return null;
  },
});
export const blockSuccessor = generalInternalMutation({
  args: zodOutputToConvex(
    lifecycleArgs.extend({ operationId: z.string().min(1) }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSource(ctx, args);
    // A real final-write identity collision proves rollback after snapshot,
    // immutable record and source closure writes, without a production fault flag.
    await ctx.db.insert('canonicalWeeklyDraft', {
      campaignId: args.campaignId,
      militiaId: args.militiaId,
      draftId: `next:${args.operationId}`,
      revision: 0,
      status: 'closed',
      draft: null,
    });
    return null;
  },
});
export const inspect = readOnlyMutation({
  args: zodOutputToConvex(lifecycleArgs),
  returns: v.object({
    ...zodOutputToConvex(confirmationInspectionSchema.omit({ records: true }))
      .fields,
    records: v.array(canonicalRecordValidator),
  }),
  handler: async (ctx, args) => {
    const { state, row } = await ownedSource(ctx, args);
    const drafts = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_campaignId_and_status', (q) =>
        q.eq('campaignId', args.campaignId).eq('status', 'open'),
      )
      .take(2);
    const records = await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .take(10);
    return confirmationInspectionSchema.parse({
      sourceRevision: state.revision,
      snapshot: state.snapshot,
      source: {
        draftId: row.draftId,
        revision: row.revision,
        status: row.status,
        draft: row.draft,
        targetRevisions: [],
      },
      openDrafts: drafts.map((draft) => draft.draft),
      records: records.map((row) => row.record),
    });
  },
});

export const initializeUpkeep = generalInternalMutation({
  args: {
    scope: zodOutputToConvex(fixtureScopeSchema),
    draftId: v.string(),
    choices: v.optional(v.boolean()),
    // Maximum notoriety, so the Upkeep settlement choice applies.
    maximumNotoriety: v.optional(v.boolean()),
    // Adds a missing team that rolls to return during Upkeep.
    missingTeam: v.optional(v.boolean()),
    // Rank 8 with enough training, treasury and PC level that settling every
    // earlier Upkeep step gains rank 9 (Captain) and its feat choice.
    rankGain: v.optional(v.boolean()),
    persistent: v.optional(v.boolean()),
    // With `choices`: attrition rolls of 10 and 3 entered, and the disabled
    // Scouts recovered at 15 gp instead of the 20 gp rules cost, with its
    // reason. The recovery journey reaches this state through the UI.
    adjustedRecovery: v.optional(v.boolean()),
  },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args): Promise<z.infer<typeof draftKeySchema>> => {
    if (args.adjustedRecovery && !args.choices)
      throw new Error('An adjusted recovery needs the Scouts choice');
    const key = await ctx.runMutation(
      internal.canonicalPersistenceFixtures.initialize,
      { scope: args.scope, draftId: args.draftId, writeEpoch: ctx.writeEpoch },
    );
    const { state, row } = await ownedSource(ctx, {
      ...key,
      scope: args.scope,
    });
    const character = await ctx.db
      .query('character')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', key.campaignId))
      .first();
    if (!character) throw new Error('Missing fixture officer');
    const snapshot = militiaSnapshotSchema.parse({
      ...state.snapshot,
      rank: args.rankGain ? 8 : 2,
      training: args.rankGain ? 130 : 14,
      treasuryCopper: args.rankGain ? 20000 : 5000,
      notoriety: args.maximumNotoriety ? 100 : state.snapshot.notoriety,
      roster: {
        people: [
          {
            characterId: character._id,
            kind: 'pc',
            hitDice: args.rankGain ? 9 : 2,
          },
        ],
        teams: args.choices
          ? [
              {
                teamId: 'upkeep-scouts',
                teamType: 'patrons',
                name: 'Scouts',
                status: 'disabled',
                managerCharacterId: null,
                rewardCapExempt: false,
                notes: '',
              },
              ...(args.missingTeam
                ? [
                    {
                      teamId: 'upkeep-riders',
                      teamType: 'defenders' as const,
                      name: 'Riders',
                      status: 'missing' as const,
                      managerCharacterId: null,
                      rewardCapExempt: false,
                      notes: '',
                    },
                  ]
                : []),
            ]
          : [],
        officers: [{ characterId: character._id, role: 'ambassador' }],
      },
      settlements: args.choices
        ? [
            {
              settlementId: 'phaendar',
              name: 'Phaendar',
              reputation: 'Indifferent',
              secured: false,
              occupied: false,
              temporaryReputationShift: 0,
              refugeActivatedWeek: null,
              refugeActiveUntilWeek: null,
            },
            {
              settlementId: 'misthome',
              name: 'Misthome',
              reputation: 'Indifferent',
              secured: false,
              occupied: false,
              temporaryReputationShift: 0,
              refugeActivatedWeek: null,
              refugeActiveUntilWeek: null,
            },
          ]
        : [],
      characters: [
        {
          characterId: character._id,
          level: args.rankGain ? 9 : 2,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
          isActive: true,
        },
      ],
    });
    const draft = createWeeklyDraft({
      draftId: args.draftId,
      week: 4,
      slotIds: ['left', 'right', 'extra'],
      context: {
        firstMilitiaWeek: false,
        startDay: 21,
        uneventfulCarry: false,
        carriedEvents: [],
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    });
    draft.event.chanceRoll = {
      diceTotal: 100,
      diceCount: 1,
      sides: 100,
      provenance: { kind: 'table' },
      modifiers: [],
    };
    if (args.persistent) {
      snapshot.treasuryCopper = 50000;
      snapshot.roster.teams = ['Scouts', 'Rangers'].map((name, index) => ({
        teamId: `persistent-team-${index}`,
        teamType: 'patrons',
        name,
        status: 'active',
        managerCharacterId: null,
        rewardCapExempt: false,
        notes: '',
      }));
      draft.context = {
        ...draft.context,
        persistentPhaseEligible: true,
        carriedEvents: [
          {
            eventId: 'theft-old',
            eventType: 'theft',
            startedWeek: 1,
            order: 0,
            targets: [],
          },
          {
            eventId: 'theft-new',
            eventType: 'theft',
            startedWeek: 2,
            order: 1,
            targets: [],
          },
          {
            eventId: 'rivalry',
            eventType: 'rivalry',
            startedWeek: 3,
            order: 2,
            targets: snapshot.roster.teams.map((team) => ({
              kind: 'team',
              teamId: team.teamId,
            })),
          },
        ],
      };
      draft.upkeep.rolls = {
        check: {
          diceTotal: 20,
          diceCount: 1,
          sides: 20,
          provenance: { kind: 'table' },
          modifiers: [],
        },
        training: {
          diceTotal: 1,
          diceCount: 1,
          sides: 6,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      };
    }
    if (args.adjustedRecovery) {
      // The same facts the Upkeep page writes: total rolls (a successful
      // check's training roll is 1d6), the recovery at its rules cost and the
      // reasoned difference as the recovery's Table Adjustment.
      const total = (sides: number, diceTotal: number) => ({
        diceTotal,
        diceCount: 1,
        sides,
        provenance: { kind: 'table' as const },
        modifiers: [],
      });
      draft.upkeep.rolls = { check: total(20, 10), training: total(6, 3) };
      draft.upkeep.teamDecisions = [
        { teamId: 'upkeep-scouts', decision: 'recover', costCopper: 2000 },
      ];
      draft.tableAdjustments = [
        {
          kind: 'militia_value',
          adjustmentId: 'upkeep-recovery:upkeep-scouts',
          field: 'treasuryCopper',
          operation: 'add',
          value: 500,
          reason: 'Local healer donated supplies',
        },
      ];
    }
    await ctx.db.patch('canonicalMilitiaState', state._id, { snapshot });
    await ctx.db.patch('canonicalWeeklyDraft', row._id, {
      draft: weeklyDraftDataSchema.parse(draft),
      initialDraft: weeklyDraftDataSchema.parse(draft),
    });
    return key;
  },
});

// Test-only source installation remains bound to the owned disposable campaign.
export const installAcceptanceSource = generalInternalMutation({
  args: zodOutputToConvex(
    lifecycleArgs.extend({
      draft: weeklyDraftDataSchema,
      snapshot: militiaSnapshotSchema,
    }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { state, row } = await ownedSource(ctx, args);
    if (row.status !== 'open' || row.revision !== 0 || state.revision !== 0)
      throw new Error('Acceptance source requires a fresh fixture');
    if (args.draft.draftId !== row.draftId || args.draft.revision !== 0)
      throw new Error('Acceptance draft identity mismatch');
    const draft = weeklyDraftDataSchema.parse(args.draft);
    const snapshot = militiaSnapshotSchema.parse(args.snapshot);
    await ctx.db.patch('canonicalMilitiaState', state._id, { snapshot });
    await ctx.db.patch('canonicalWeeklyDraft', row._id, {
      draft,
      initialDraft: draft,
    });
    return null;
  },
});

// Finished-weeks history beyond one confirmed week (#146): after the source
// draft was confirmed, `corrections` historical corrections of its week and
// a historical reconstruction of `reconstructWeek`, each a copy of the
// confirmed record. Written as append-only storage would write them, without
// a signed-in caller; no application path creates such records yet.
export const appendHistory = generalInternalMutation({
  args: zodOutputToConvex(
    lifecycleArgs.extend({
      corrections: z.number().int().min(1).max(10),
      reconstructWeek: z.number().int().nonnegative(),
    }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { row } = await ownedSource(ctx, args);
    if (row.status !== 'closed')
      throw new Error('Append history after the source week is confirmed');
    const confirmed = await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_sourceDraftId', (q) =>
        q.eq('record.source.draftId', args.draftId),
      )
      .first();
    if (confirmed?.militiaId !== args.militiaId || confirmed.sequence !== 0)
      throw new Error('Missing the confirmed fixture record');
    const weekRecords = (week: number) =>
      ctx.db
        .query('canonicalResolutionRecord')
        .withIndex('by_campaignId_and_week_and_sequence', (q) =>
          q.eq('campaignId', args.campaignId).eq('week', week),
        )
        .order('desc');
    const open = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_campaignId_and_status', (q) =>
        q.eq('campaignId', args.campaignId).eq('status', 'open'),
      )
      .first();
    if (
      open?.draft?.week === args.reconstructWeek ||
      (await weekRecords(args.reconstructWeek).first())
    )
      throw new Error('The reconstructed week must be free');
    const base = canonicalResolutionRecordSchema.parse(confirmed.record);
    const append = async (
      record: CanonicalResolutionRecord,
      sequence: number,
    ) => {
      const parsed = canonicalResolutionRecordSchema.parse(record);
      await ctx.db.insert('canonicalResolutionRecord', {
        campaignId: args.campaignId,
        militiaId: args.militiaId,
        recordId: parsed.recordId,
        week: parsed.source.week,
        sequence,
        record: parsed,
      });
    };
    // Each correction supersedes the week's then effective record.
    const latest = (await weekRecords(confirmed.week).first()) ?? confirmed;
    let effective = { recordId: latest.recordId, sequence: latest.sequence };
    for (let i = 1; i <= args.corrections; i++) {
      const recordId = `${base.recordId}-correction-${i}`;
      await append(
        {
          ...base,
          recordId,
          provenance: 'historical_correction',
          supersedesRecordId: effective.recordId,
        },
        effective.sequence + 1,
      );
      effective = { recordId, sequence: effective.sequence + 1 };
    }
    await append(
      {
        ...base,
        recordId: `${base.recordId}-week-${args.reconstructWeek}`,
        provenance: 'historical_reconstruction',
        supersedesRecordId: null,
        source: {
          ...base.source,
          week: args.reconstructWeek,
          draftId: `${base.source.draftId}-week-${args.reconstructWeek}`,
        },
      },
      0,
    );
    return null;
  },
});

// A guarded canonical-only fixture replaces the completed migration rehearsal.
export const acceptedCampaign = gatedMutation({
  args: { scope: zodOutputToConvex(fixtureScopeSchema) },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args) => {
    const campaign = await ownedCampaign(ctx, args.scope);
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .unique();
    if (!militia) throw new Error('Missing fresh fixture militia');
    const state = await ctx.db
      .query('canonicalMilitiaState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .first();
    if (state) throw new Error('Reset the accepted campaign fixture first');
    await ctx.db.delete('militia', militia._id);
    return (await seedAcceptedCampaign(ctx, campaign._id)).key;
  },
});
