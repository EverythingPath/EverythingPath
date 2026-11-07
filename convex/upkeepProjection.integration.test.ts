// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import { openDraft, readOpenDraft } from './lib/canonicalDraftStorage';
import { projectUpkeep } from '../src/lib/rules-upkeep';
import { weeklyDraftSchema } from '../src/lib/weekly-draft-contract';
import { upkeepFixture, roll } from '../tests/rules/upkeep-fixture';

const modules = import.meta.glob('./**/*.ts');

test('[rules.U01.projection-parity] the browser build and persisted Convex source produce identical Upkeep plans', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/rules-upkeep.ts'),
        name: 'UpkeepRules',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(bundle) ? bundle[0] : bundle;
  if (!output || !('output' in output))
    throw new Error('Expected browser bundle');
  const script = output.output.find((entry) => entry.type === 'chunk');
  if (script?.type !== 'chunk') throw new Error('Expected browser JavaScript');
  for (const scenario of [
    'ordinary',
    'natural-twenty',
    'maximum-notoriety',
    'persistent-morale',
    'recovery',
    'first-use',
    'incomplete',
  ] as const) {
    const t = convexTest(schema, modules);
    const { snapshot, draft: fresh } = upkeepFixture();
    const draft = weeklyDraftSchema.parse({
      ...fresh,
      context: {
        ...fresh.context,
        firstMilitiaWeek: scenario === 'first-use',
        persistentPhaseEligible: scenario === 'persistent-morale',
        carriedEvents:
          scenario === 'persistent-morale'
            ? [
                {
                  eventId: 'morale',
                  eventType: 'low_morale',
                  startedWeek: 39,
                  order: 0,
                  targets: [],
                },
              ]
            : [],
        queuedEffects: [
          {
            effectId: 'pain-check',
            sourceId: 'pain',
            startsWeek: 40,
            endsWeek: 40,
            effect: { kind: 'check_modifier', check: 'loyalty', value: -1 },
          },
          {
            effectId: 'pain-loss',
            sourceId: 'pain',
            startsWeek: 40,
            endsWeek: 40,
            effect: { kind: 'upkeep_loss_multiplier', value: 2 },
          },
        ],
      },
      upkeep: {
        rolls: {
          check: roll(20, scenario === 'natural-twenty' ? 20 : 8),
          training:
            scenario === 'persistent-morale' ? roll(4, 2, 3) : roll(6, 2),
          loss: roll(4, 2, 3),
          notoriety: roll(20, 2),
        },
        notorietyCheck: roll(20, 13),
        treasuryTransfers: [
          {
            transferId: 'deposit',
            direction: 'deposit',
            copper: 2501,
          },
        ],
        teamDecisions:
          scenario === 'recovery'
            ? [{ teamId: 'recover', decision: 'recover' }]
            : [],
      },
    });
    snapshot.training = 45;
    if (scenario === 'maximum-notoriety') snapshot.notoriety = 100;
    if (scenario === 'incomplete') delete draft.upkeep.rolls.training;
    if (scenario === 'recovery')
      snapshot.roster.teams.push({
        teamId: 'recover',
        teamType: 'patrons',
        name: 'Patrons',
        status: 'disabled',
        managerCharacterId: null,
        rewardCapExempt: false,
        notes: '',
      });
    const scope = await t.run(async (ctx) => {
      await ctx.db.insert('user', {
        tokenIdentifier: 'test|player',
        name: 'Player',
        image: '',
        orgIds: [{ orgId: 'test', role: 'member' }],
      });
      const campaignId = await ctx.db.insert('campaign', {
        name: 'Preview',
        ownerId: 'gm',
        organizationId: 'test',
        description: '',
      });
      const militiaId = await ctx.db.insert('militia', {
        campaignId,
        name: 'Militia',
      });
      return { campaignId, militiaId };
    });
    const player = t.withIdentity({ tokenIdentifier: 'test|player' });
    await player.run((ctx) => openDraft(ctx, { ...scope, draft }));
    const server = await player.run(async (ctx) => {
      const stored = await readOpenDraft(ctx, scope);
      if (!stored) throw new Error('Missing draft');
      return projectUpkeep(stored, snapshot);
    });
    const browser: unknown = runInNewContext(
      `${script.code}; UpkeepRules.projectUpkeep(draft, snapshot)`,
      {
        structuredClone,
        draft: JSON.parse(JSON.stringify(draft)) as unknown,
        snapshot: structuredClone(snapshot),
      },
    );
    expect(browser, scenario).toEqual(server);
    expect(server.outcome.training, scenario).toBe(
      {
        ordinary: 41,
        'natural-twenty': 47,
        'maximum-notoriety': 31,
        'persistent-morale': 29,
        recovery: 25,
        'first-use': 45,
        incomplete: 45,
      }[scenario],
    );
    expect(server.outcome.treasuryCopper, scenario).toBe(
      scenario === 'first-use' ? 3000 : scenario === 'recovery' ? 2501 : 5501,
    );
    expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(draft);
  }
});
