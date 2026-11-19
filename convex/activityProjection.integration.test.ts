// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import type { WeeklyDraft } from '../src/lib/weekly-draft-contract';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import { openDraft, readOpenDraft } from './lib/canonicalDraftStorage';
import { projectActivity } from '../src/lib/rules-activity';
import { projectActivityAndEventShaping } from '../src/lib/rules-event-shaping';
import { eventActionFixture } from '../tests/rules/event-action-fixture';
import { roll } from '../tests/rules/upkeep-fixture';
import {
  eventSelectionFixture,
  occurrence,
  pair,
} from '../tests/rules/event-selection-fixture';
import { activityFixture } from '../tests/rules/activity-fixture';
import { settlementFixture } from '../tests/rules/settlement-fixture';
import { characterFixture } from '../tests/rules/character-fixture';
import { economyFixture } from '../tests/rules/economy-fixture';

const modules = import.meta.glob('./**/*.ts');

test('[rules.A06.projection-parity] the browser build and persisted Convex source produce identical Activity plans', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/rules-activity.ts'),
        name: 'ActivityRules',
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
    'change_officer_role',
    'dismiss_team',
    'drill_militia',
    'recruit_team',
    'upgrade_team',
    'lie_low',
    'exceptional-recruitment',
    'persistent-morale',
    'persistent-agent',
    'activate_refuge',
    'reduce_danger',
    'spread_propaganda',
    'activate_black_market',
    'broker_market',
    'earn_gold',
    'secure_cache',
    'special_order',
    'theft-income',
    'theft-sale',
    'rescue_character',
    'restore_character',
    'gather_information',
    'knowledge_check',
    'strike_team',
    'special',
  ] as const) {
    const t = convexTest(schema, modules);
    const fixture =
      scenario === 'rescue_character' ||
      scenario === 'restore_character' ||
      scenario === 'gather_information' ||
      scenario === 'knowledge_check' ||
      scenario === 'strike_team' ||
      scenario === 'special'
        ? characterFixture(scenario)
        : scenario === 'activate_refuge' ||
            scenario === 'reduce_danger' ||
            scenario === 'spread_propaganda'
          ? settlementFixture(scenario)
          : scenario === 'theft-income' || scenario === 'theft-sale'
            ? economyFixture(
                scenario === 'theft-income'
                  ? 'earn_gold'
                  : 'activate_black_market',
              )
            : scenario === 'activate_black_market' ||
                scenario === 'broker_market' ||
                scenario === 'earn_gold' ||
                scenario === 'secure_cache' ||
                scenario === 'special_order'
              ? economyFixture(scenario)
              : activityFixture(
                  scenario === 'persistent-morale'
                    ? 'drill_militia'
                    : scenario === 'persistent-agent' ||
                        scenario === 'exceptional-recruitment'
                      ? 'recruit_team'
                      : scenario,
                );
    const snapshot = fixture.snapshot;
    if (scenario === 'theft-sale') {
      const choice = fixture.draft.activity.slots.find(
        (slot) => slot.slotId === 'one',
      )?.choice;
      const item = snapshot.economy?.items.find(
        (item) => item.itemId === 'gear',
      );
      if (choice?.actionId !== 'activate_black_market' || !item)
        throw Error('Missing market fixture');
      choice.sales = ['gear'];
      item.valueCopper = 100;
    }
    const eventType =
      scenario === 'persistent-morale'
        ? 'low_morale'
        : scenario === 'persistent-agent'
          ? 'double_agent'
          : scenario === 'theft-income' || scenario === 'theft-sale'
            ? 'theft'
            : null;
    const draft: WeeklyDraft = {
      ...fixture.draft,
      context: {
        ...fixture.draft.context,
        persistentPhaseEligible: eventType !== null,
        carriedEvents: eventType
          ? [
              {
                eventId: 'penalty',
                eventType,
                startedWeek: 39,
                order: 0,
                targets: [],
              },
            ]
          : [],
      },
    };
    if (scenario === 'persistent-agent')
      draft.activity.slots = [
        {
          slotId: 'one',
          choice: {
            choiceId: 'recruit',
            actionId: 'recruit_team',
            teamType: 'moles',
            rolls: { check: roll(20, 14) },
          },
        },
      ];
    if (scenario === 'exceptional-recruitment') {
      const slot = draft.activity.slots[0];
      if (!slot) throw new Error('Missing fixture slot');
      slot.choice = {
        choiceId: 'veterans',
        actionId: 'recruit_team',
        teamType: 'merchants',
        recruitmentCheck: { check: 'loyalty', dc: 10 },
        rolls: { check: roll(20, 10) },
      };
      draft.rulesExceptions = [
        {
          exceptionId: 'tier',
          subjectId: 'veterans',
          ruleId: 'recruit-tier',
          reason: 'Veterans join',
        },
      ];
    }
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
      return projectActivity(stored, snapshot);
    });
    const browser: unknown = runInNewContext(
      `${script.code}; ActivityRules.projectActivity(draft, snapshot)`,
      {
        structuredClone,
        draft: JSON.parse(JSON.stringify(draft)) as unknown,
        snapshot: structuredClone(snapshot),
      },
    );
    expect(browser, scenario).toEqual(server);
    expect(server.ready, scenario).toBe(true);
    if (scenario === 'theft-income')
      expect(server.outcome.treasuryCopper).toBe(1001650);
    if (scenario === 'theft-sale')
      expect(server.outcome.treasuryCopper).toBe(995028);
    if (scenario === 'persistent-agent') {
      expect(server.checks[0]?.total).toBe(13);
      expect(server.outcome.roster.teams).toEqual(snapshot.roster.teams);
      expect(server.plan).toEqual([]);
    } else expect(server.plan.length, scenario).toBeGreaterThan(0);
    if (scenario === 'persistent-morale') {
      expect(server.checks[0]?.total).toBe(11);
      expect(server.outcome.training).toBe(30);
    }
    expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(draft);
  }
});

test('[rules.A72.projection-parity] event shaping and reactive rolls agree in the browser bundle and persisted Convex source', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/rules-event-shaping.ts'),
        name: 'EventRules',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(bundle) ? bundle[0] : bundle;
  if (!output || !('output' in output)) throw Error('Expected browser bundle');
  const script = output.output.find((entry) => entry.type === 'chunk');
  if (script?.type !== 'chunk') throw Error('Expected JavaScript');
  for (const action of [
    'covert_action',
    'guarantee_event',
    'manipulate_events',
    'sabotage',
  ] as const) {
    const { draft, snapshot } = eventActionFixture(action);
    draft.event.chanceRoll = roll(100, 100);
    const t = convexTest(schema, modules);
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
      if (!stored) throw Error('Missing draft');
      return projectActivityAndEventShaping(stored, snapshot);
    });
    const browser: unknown = runInNewContext(
      `${script.code}; EventRules.projectActivityAndEventShaping(draft, snapshot)`,
      {
        structuredClone,
        draft: JSON.parse(JSON.stringify(draft)) as unknown,
        snapshot: structuredClone(snapshot),
      },
    );
    expect(browser, action).toEqual(server);
    expect(server.event.ready, action).toBe(true);
    expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(draft);
  }
});

test('[rules.E02.parity] selection trees, duplicate dispatch, carry and incomplete replacements agree in browser and Convex', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/rules-event-shaping.ts'),
        name: 'EventRules',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(bundle) ? bundle[0] : bundle;
  if (!output || !('output' in output)) throw Error('Expected browser bundle');
  const script = output.output.find((entry) => entry.type === 'chunk');
  if (script?.type !== 'chunk') throw Error('Expected JavaScript');
  for (const action of [
    'quiet',
    'duplicate',
    'nested',
    'automatic',
    'impossible',
    'settlement',
  ] as const) {
    const { draft, snapshot } = eventSelectionFixture();
    draft.context = { ...draft.context, uneventfulCarry: true };
    if (action === 'quiet') draft.event.chanceRoll = roll(100, 100);
    if (action === 'duplicate') draft.event.occurrences = pair(22);
    if (action === 'nested') draft.event.occurrences = pair(50);
    if (action === 'automatic') {
      draft.context = {
        ...draft.context,
        queuedEffects: [
          {
            effectId: 'auto',
            sourceId: 'storm',
            startsWeek: 40,
            endsWeek: 40,
            effect: { kind: 'automatic_events', count: 1 },
          },
        ],
      };
      draft.event.chanceRoll = roll(100, 100);
      draft.event.occurrences = [
        occurrence('auto', 10, { kind: 'automatic', sourceId: 'storm' }),
      ];
    }
    if (action === 'impossible') {
      snapshot.roster.teams = [];
      draft.event.occurrences = [occurrence('sick', 90)];
    }
    if (action === 'settlement') {
      const town = snapshot.settlements[0];
      if (!town) throw Error('Missing town');
      town.reputation = 'Friendly';
      draft.event.occurrences = [occurrence('event', 18)];
    }
    const t = convexTest(schema, modules);
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
      if (!stored) throw Error('Missing draft');
      return projectActivityAndEventShaping(stored, snapshot);
    });
    const browser: unknown = runInNewContext(
      `${script.code}; EventRules.projectActivityAndEventShaping(draft, snapshot)`,
      {
        structuredClone,
        draft: JSON.parse(JSON.stringify(draft)) as unknown,
        snapshot: structuredClone(snapshot),
      },
    );
    expect(browser, action).toEqual(server);
    expect(server.event.ready, action).toBe(
      action !== 'nested' && action !== 'impossible',
    );
    expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(draft);
  }
});
