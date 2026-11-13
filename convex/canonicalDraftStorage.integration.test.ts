// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from './schema';
import { canonicalResolutionRecordSchema } from '../src/lib/canonical-resolution-record';
import { recordSnapshot } from '../tests/history/resolution-record-fixtures';
import { createWeeklyDraft, editWeeklyDraft } from '../src/lib/weekly-draft';
import {
  openDraft,
  readOpenDraft,
  saveDraftRevision,
  readDraftMetadata,
  appendResolutionRecord,
  readEffectiveRecord,
  readResolutionRecord,
} from './lib/canonicalDraftStorage';

const modules = import.meta.glob('./**/*.ts');
const fresh = (draftId = 'draft-11') =>
  createWeeklyDraft({
    draftId,
    week: 11,
    slotIds: ['left', 'right'],
    context: {
      firstMilitiaWeek: false,
      startDay: 70,
      uneventfulCarry: true,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
async function fixture() {
  const t = convexTest(schema, modules);
  const scope = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|player',
      name: 'Player',
      image: '',
      orgIds: [{ orgId: 'org-test', role: 'member' }],
    });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Test',
      ownerId: 'gm',
      organizationId: 'org-test',
      description: '',
    });
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Militia',
    });
    return { campaignId, militiaId };
  });
  const player = t.withIdentity({ tokenIdentifier: 'test|player' });
  return { t, player, scope };
}

test('[storage.open] initialization is restartable and permits one open draft per campaign', async () => {
  const { player, scope } = await fixture();
  await player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() }));
  await player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() }));
  await expect(
    player.run((ctx) =>
      openDraft(ctx, { ...scope, draft: fresh('duplicate') }),
    ),
  ).rejects.toThrow('already has an open draft');
  expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(fresh());
});

test('[storage.retry] accepted revisions retain conflict metadata and retries do not write twice', async () => {
  const { player, scope } = await fixture();
  const draft = fresh();
  await player.run((ctx) => openDraft(ctx, { ...scope, draft }));
  const edit = {
    kind: 'stage' as const,
    slotId: 'left',
    choice: { choiceId: 'gold', actionId: 'earn_gold' as const },
  };
  const next = editWeeklyDraft(draft, edit);
  if (!next.ok) throw new Error(next.error);
  const request = {
    ...scope,
    draftId: draft.draftId,
    operationId: 'op-1',
    baseRevision: 0,
    edit,
    expectedRevision: 0,
    draft: next.draft,
    targets: ['slot:left'],
  };
  expect(await player.run((ctx) => saveDraftRevision(ctx, request))).toEqual({
    revision: 1,
  });
  expect(await player.run((ctx) => saveDraftRevision(ctx, request))).toEqual({
    revision: 1,
  });
  expect(
    await player.run((ctx) =>
      readDraftMetadata(ctx, { ...scope, draftId: draft.draftId }),
    ),
  ).toEqual({
    status: 'open',
    revision: 1,
  });
  expect(
    await player.run(async (ctx) => {
      const target = await ctx.db
        .query('canonicalDraftTarget')
        .withIndex('by_draftId_and_target', (q) =>
          q.eq('draftId', draft.draftId).eq('target', 'slot:left'),
        )
        .unique();
      return target && { target: target.target, revision: target.revision };
    }),
  ).toEqual({ target: 'slot:left', revision: 1 });
  await expect(
    player.run((ctx) =>
      saveDraftRevision(ctx, {
        ...request,
        edit: { kind: 'clear', slotId: 'left', choiceId: 'gold' },
      }),
    ),
  ).rejects.toThrow('Operation identity already used');
  await expect(
    player.run((ctx) =>
      saveDraftRevision(ctx, { ...request, operationId: 'stale' }),
    ),
  ).rejects.toThrow('Draft revision changed');
});

function record(recordId = 'record-11') {
  return canonicalResolutionRecordSchema.parse({
    recordId,
    source: fresh(),
    sourceMilitiaSnapshot: recordSnapshot(),
    provenance: 'confirmation',
    rulesetVersion: 1,
    baselinePlan: { formatVersion: 2, data: { treasuryCopper: 10001 } },
    finalPlan: { formatVersion: 2, data: { treasuryCopper: 10001 } },
    finalOutcome: { formatVersion: 2, data: { treasuryCopper: 10001 } },
    adjudication: {
      acknowledgements: [],
      rulesExceptions: [],
      tableAdjustments: [],
    },
    warnings: [],
    successorContext: {
      firstMilitiaWeek: false,
      startDay: 77,
      uneventfulCarry: true,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
    supersedesRecordId: null,
  });
}

test('[storage.history] closing preserves complete source and appends immutable corrections', async () => {
  const { t, player, scope } = await fixture();
  await player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() }));
  await player.run((ctx) =>
    appendResolutionRecord(ctx, { ...scope, record: record() }),
  );
  expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
  expect(
    await player.run((ctx) => readEffectiveRecord(ctx, { ...scope, week: 11 })),
  ).toEqual(record());
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|gm',
      name: 'GM',
      image: '',
      orgIds: [{ orgId: 'org-test', role: 'admin' }],
    }),
  );
  const correction = {
    ...record('correction-11'),
    provenance: 'historical_correction' as const,
    supersedesRecordId: 'record-11',
    finalOutcome: {
      formatVersion: 2 as const,
      data: { treasuryCopper: 10002 },
    },
  };
  await gm.run((ctx) =>
    appendResolutionRecord(ctx, { ...scope, record: correction }),
  );
  expect(
    await player.run((ctx) => readEffectiveRecord(ctx, { ...scope, week: 11 })),
  ).toEqual(correction);
  expect(
    await player.run((ctx) =>
      readResolutionRecord(ctx, { ...scope, recordId: 'record-11' }),
    ),
  ).toEqual(record());
  await expect(
    gm.run((ctx) =>
      appendResolutionRecord(ctx, {
        ...scope,
        record: { ...correction, recordId: 'fork' },
      }),
    ),
  ).rejects.toThrow('effective record');
  await expect(
    player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() })),
  ).rejects.toThrow('identity already used');
});

test('[storage.scope] authentication and campaign-owned draft/militia/record references are enforced', async () => {
  const { t, player, scope } = await fixture();
  await expect(
    t.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() })),
  ).rejects.toThrow('Campaign access required');
  const outsider = t.withIdentity({ tokenIdentifier: 'test|org-test-forged' });
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|org-test-forged',
      name: 'Outsider',
      image: '',
      orgIds: [],
    }),
  );
  await expect(
    outsider.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() })),
  ).rejects.toThrow('Campaign access required');
  const other = await t.run(async (ctx) => {
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Other',
      ownerId: 'gm',
      organizationId: 'org-test',
      description: '',
    });
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Other',
    });
    return { campaignId, militiaId };
  });
  await expect(
    player.run((ctx) =>
      openDraft(ctx, { ...scope, militiaId: other.militiaId, draft: fresh() }),
    ),
  ).rejects.toThrow('Invalid campaign/militia reference');
  await player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() }));
  await expect(
    player.run((ctx) =>
      readDraftMetadata(ctx, { ...other, draftId: fresh().draftId }),
    ),
  ).rejects.toThrow('Invalid draft reference');
  await player.run((ctx) =>
    appendResolutionRecord(ctx, { ...scope, record: record() }),
  );
  await expect(
    player.run((ctx) =>
      readResolutionRecord(ctx, { ...other, recordId: 'record-11' }),
    ),
  ).rejects.toThrow('Invalid record reference');
  await player.run((ctx) =>
    appendResolutionRecord(ctx, {
      ...scope,
      record: {
        ...record('correction'),
        provenance: 'historical_correction',
        supersedesRecordId: 'record-11',
      },
    }),
  );
  expect(
    (
      await player.run((ctx) =>
        readEffectiveRecord(ctx, { ...scope, week: 11 }),
      )
    )?.recordId,
  ).toBe('correction');
});

test('[storage.integrity] canonical refinements, exact revisions and immutable context survive persistence', async () => {
  const { player, scope } = await fixture();
  await expect(
    player.run((ctx) =>
      openDraft(ctx, { ...scope, draft: { ...fresh(), revision: 0.5 } }),
    ),
  ).rejects.toThrow();
  await expect(
    player.run((ctx) =>
      openDraft(ctx, {
        ...scope,
        draft: {
          ...fresh(),
          activity: {
            slots: [
              { slotId: 'same', choice: null },
              { slotId: 'same', choice: null },
            ],
            consumableIds: [],
          },
        },
      }),
    ),
  ).rejects.toThrow('Duplicate slot identity');
  await player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() }));
  const edited = editWeeklyDraft(fresh(), { kind: 'event_chance', roll: null });
  if (!edited.ok) throw new Error(edited.error);
  await expect(
    player.run((ctx) =>
      saveDraftRevision(ctx, {
        ...scope,
        draftId: 'draft-11',
        operationId: 'context',
        baseRevision: 0,
        expectedRevision: 0,
        edit: { kind: 'event_chance', roll: null },
        targets: ['event:chance'],
        draft: {
          ...edited.draft,
          context: { ...edited.draft.context, startDay: 99 },
        },
      }),
    ),
  ).rejects.toThrow('week context are immutable');
  await expect(
    player.run((ctx) =>
      appendResolutionRecord(ctx, {
        ...scope,
        record: {
          ...record(),
          source: { ...record().source, revision: 1 },
        },
      }),
    ),
  ).rejects.toThrow('exact stored draft revision');
  expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(fresh());
  expect(
    await player.run((ctx) => readEffectiveRecord(ctx, { ...scope, week: 11 })),
  ).toBeNull();
});

test('[storage.atomic] a failed caller transaction leaves neither history nor closure nor a successor', async () => {
  const { player, scope } = await fixture();
  await player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() }));
  await expect(
    player.run(async (ctx) => {
      await appendResolutionRecord(ctx, { ...scope, record: record() });
      await openDraft(ctx, {
        ...scope,
        draft: { ...fresh('successor'), week: 12 },
      });
      throw new Error('Authoritative plan application failed');
    }),
  ).rejects.toThrow('Authoritative plan application failed');
  expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(fresh());
  expect(
    await player.run((ctx) => readEffectiveRecord(ctx, { ...scope, week: 11 })),
  ).toBeNull();
  await player.run(async (ctx) => {
    await appendResolutionRecord(ctx, { ...scope, record: record() });
    await openDraft(ctx, {
      ...scope,
      draft: { ...fresh('successor'), week: 12 },
    });
  });
  await expect(
    player.run((ctx) =>
      saveDraftRevision(ctx, {
        ...scope,
        draftId: 'draft-11',
        operationId: 'late',
        baseRevision: 0,
        expectedRevision: 0,
        edit: { kind: 'event_chance', roll: null },
        targets: ['event:chance'],
        draft: { ...fresh(), revision: 1 },
      }),
    ),
  ).rejects.toThrow('Draft is closed');
  expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toMatchObject({
    draftId: 'successor',
    week: 12,
    revision: 0,
  });
});

test('[storage.concurrent-open] competing initializations produce exactly one open identity', async () => {
  const { player, scope } = await fixture();
  const results = await Promise.allSettled([
    player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh('first') })),
    player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh('second') })),
  ]);
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  expect(await player.run((ctx) => readOpenDraft(ctx, scope))).not.toBeNull();
});

test('[storage.reconstruction] historical source cannot reuse allocated identities across campaigns or weeks', async () => {
  const { t, player, scope } = await fixture();
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|gm',
      name: 'GM',
      image: '',
      orgIds: [{ orgId: 'org-test', role: 'admin' }],
    }),
  );
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const other = await t.run(async (ctx) => {
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Other',
      ownerId: 'gm',
      organizationId: 'org-test',
      description: '',
    });
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Other',
    });
    return { campaignId, militiaId };
  });
  await player.run((ctx) => openDraft(ctx, { ...scope, draft: fresh() }));
  const historical = {
    ...record(),
    provenance: 'historical_reconstruction' as const,
  };
  await expect(
    gm.run((ctx) =>
      appendResolutionRecord(ctx, { ...other, record: historical }),
    ),
  ).rejects.toThrow('Historical draft identity already used');
  await expect(
    gm.run((ctx) =>
      appendResolutionRecord(ctx, {
        ...scope,
        record: { ...historical, source: { ...historical.source, week: 10 } },
      }),
    ),
  ).rejects.toThrow('Historical draft identity already used');
  const reconstructed = {
    ...historical,
    source: { ...historical.source, draftId: 'reconstructed-11' },
  };
  await gm.run((ctx) =>
    appendResolutionRecord(ctx, { ...other, record: reconstructed }),
  );
  expect(
    await gm.run((ctx) => readEffectiveRecord(ctx, { ...other, week: 11 })),
  ).toEqual(reconstructed);
  await expect(
    gm.run((ctx) =>
      appendResolutionRecord(ctx, {
        ...other,
        record: {
          ...reconstructed,
          recordId: 'reconstructed-12',
          source: { ...reconstructed.source, week: 12 },
        },
      }),
    ),
  ).rejects.toThrow('Historical draft identity already used');
  await expect(
    gm.run((ctx) =>
      openDraft(ctx, { ...other, draft: fresh('reconstructed-11') }),
    ),
  ).rejects.toThrow('Draft identity already used');
});

test('[storage.source] confirmed history round-trips raw facts, copper precision and reasoned adjudication independently of live state', async () => {
  const { t, player, scope } = await fixture();
  const complete = canonicalResolutionRecordSchema.parse({
    ...record(),
    source: {
      ...fresh(),
      activity: {
        consumableIds: ['bonus-1'],
        operatingSettlementId: 'settlement-1',
        slots: [
          {
            slotId: 'left',
            choice: {
              choiceId: 'gold',
              actionId: 'earn_gold',
              costCopper: 0,
              rolls: {
                check: {
                  diceTotal: 12,
                  diceCount: 1,
                  sides: 20,
                  provenance: { kind: 'table' },
                  modifiers: [
                    {
                      sourceId: 'officer-1',
                      value: -2,
                      reason: 'Wounded officer',
                    },
                  ],
                },
              },
            },
          },
        ],
      },
      rulesExceptions: [
        {
          exceptionId: 'exception-1',
          subjectId: 'gold',
          ruleId: 'eligibility',
          reason: 'GM ruling',
        },
      ],
      tableAdjustments: [
        {
          adjustmentId: 'adjustment-1',
          kind: 'militia_value',
          field: 'treasuryCopper',
          operation: 'add',
          value: 1,
          reason: 'Recovered copper',
        },
      ],
      acknowledgements: [
        {
          acknowledgementId: 'ack-1',
          subjectId: 'gold',
          outcome: 'Scout returned',
        },
      ],
    },
    adjudication: {
      rulesExceptions: [
        {
          exceptionId: 'exception-1',
          subjectId: 'gold',
          ruleId: 'eligibility',
          reason: 'GM ruling',
        },
      ],
      tableAdjustments: [
        {
          adjustmentId: 'adjustment-1',
          kind: 'militia_value',
          field: 'treasuryCopper',
          operation: 'add',
          value: 1,
          reason: 'Recovered copper',
        },
      ],
      acknowledgements: [
        {
          acknowledgementId: 'ack-1',
          subjectId: 'gold',
          outcome: 'Scout returned',
        },
      ],
    },
  });
  await player.run((ctx) =>
    openDraft(ctx, { ...scope, draft: complete.source }),
  );
  await player.run((ctx) =>
    appendResolutionRecord(ctx, { ...scope, record: complete }),
  );
  await t.run((ctx) =>
    ctx.db.patch('militia', scope.militiaId, { name: 'Changed today' }),
  );
  expect(
    await player.run((ctx) =>
      readResolutionRecord(ctx, { ...scope, recordId: 'record-11' }),
    ),
  ).toEqual(complete);
});

test('storage rejects retired rolls in open and historical sources without writing partial records', async () => {
  const { player, scope } = await fixture();
  const draft = fresh();
  const unsupported = {
    ...draft,
    upkeep: {
      ...draft.upkeep,
      rolls: {
        reward: {
          diceTotal: 4,
          diceCount: 1,
          sides: 6,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      },
    },
  };
  await expect(
    player.run((ctx) =>
      Reflect.apply(openDraft, undefined, [
        ctx,
        { ...scope, draft: unsupported },
      ]),
    ),
  ).rejects.toThrow(/reward/);
  expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
  await player.run((ctx) => openDraft(ctx, { ...scope, draft }));
  await expect(
    player.run((ctx) =>
      Reflect.apply(appendResolutionRecord, undefined, [
        ctx,
        { ...scope, record: { ...record(), source: unsupported } },
      ]),
    ),
  ).rejects.toThrow(/reward/);
  expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(draft);
  expect(
    await player.run((ctx) => readEffectiveRecord(ctx, { ...scope, week: 11 })),
  ).toBeNull();
  await player.run((ctx) =>
    appendResolutionRecord(ctx, { ...scope, record: record() }),
  );
  expect(
    await player.run((ctx) => readEffectiveRecord(ctx, { ...scope, week: 11 })),
  ).toEqual(record());
});
