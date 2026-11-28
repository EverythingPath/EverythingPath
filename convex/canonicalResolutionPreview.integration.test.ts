// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import {
  openDraft,
  readOpenDraft,
  appendResolutionRecord,
  readEffectiveRecord,
} from './lib/canonicalDraftStorage';
import {
  CANONICAL_WEEKLY_RULESET_VERSION,
  projectWeeklyDraft,
  resolveReviewedWeeklyDraft,
  prepareCanonicalResolutionRecord,
} from '../src/lib/canonical-weekly-resolution';
import { persistentEventFixture } from '../tests/rules/persistent-event-fixture';
import { guaranteedWeek } from '../tests/rules/candidate-reroll-fixture';
import { occurrence } from '../tests/rules/event-selection-fixture';
import { roll } from '../tests/rules/upkeep-fixture';
import {
  commandantDrillWeek,
  managerWeek,
} from '../tests/rules/role-aware-officers-fixture';
import type { WeeklyDraft } from '../src/lib/weekly-draft-contract';
import type { UpkeepSnapshot } from '../src/lib/rules-upkeep';
const modules = import.meta.glob('./**/*.ts');

async function loadBrowserRules() {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/canonical-weekly-resolution.ts'),
        name: 'WeeklyRules',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(bundle) ? bundle[0] : bundle;
  if (!output || !('output' in output)) throw Error('Expected bundle');
  const script = output.output.find((entry) => entry.type === 'chunk');
  if (script?.type !== 'chunk') throw Error('Expected JavaScript');
  return script.code;
}

function prepareProjectionFixture(kind: 'low_morale' | 'theft' | 'rivalry') {
  const { draft, snapshot } = persistentEventFixture(kind);
  snapshot.training = 15;
  if (kind === 'low_morale') {
    snapshot.bonuses = [
      {
        bonusId: 'gift',
        source: 'reward',
        check: 'any',
        value: 5,
        phase: 'activity',
        availableWeek: 2,
        consumedWeek: null,
      },
    ];
    draft.activity.consumableIds = ['gift'];
    draft.activity.slots = [
      {
        slotId: 'one',
        choice: {
          choiceId: 'drill',
          actionId: 'drill_militia',
          consumableIds: ['gift'],
          rolls: { check: roll(20, 10), training: roll(6, 3, 4) },
        },
      },
    ];
  }
  draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'carried' }];
  draft.tableAdjustments = [
    {
      kind: 'militia_value',
      adjustmentId: 'copper',
      field: 'treasuryCopper',
      operation: 'add',
      value: 3,
      reason: 'Three copper found at the table',
    },
  ];
  const localPreview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  return { draft, snapshot, localPreview };
}

test('[rules.P78.projection-parity] browser and persisted Convex source yield the same complete preview and immutable source/outcome', async () => {
  const browserRules = await loadBrowserRules();
  for (const kind of ['low_morale', 'theft', 'rivalry'] as const) {
    const { draft, snapshot, localPreview } = prepareProjectionFixture(kind);
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
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      return projectWeeklyDraft({ revision, militiaSnapshot: snapshot });
    });
    const browser: unknown = runInNewContext(
      `${browserRules}; WeeklyRules.projectWeeklyDraft(input)`,
      {
        structuredClone,
        input: JSON.parse(
          JSON.stringify({ revision: draft, militiaSnapshot: snapshot }),
        ) as unknown,
      },
    );
    expect(browser, kind).toEqual(server);
    expect(server.status, kind).toBe('ready');
    expect(server.outcome, `${kind} matches the local preview`).toEqual(
      localPreview.outcome,
    );
    expect(server.requirements).toEqual(localPreview.requirements);
    expect(server.warnings).toEqual(localPreview.warnings);

    expect(server.outcome?.militiaSnapshot.treasuryCopper).toBe(
      kind === 'low_morale' ? 21003 : 24003,
    );
    if (kind === 'low_morale') {
      expect(server.outcome?.militiaSnapshot.training).toBe(21);
      expect(server.outcome?.militiaSnapshot.bonuses[0]?.consumedWeek).toBe(2);
    }
    expect(server.outcome?.context.carriedEvents).toEqual([]);
    const record = await player.run(async (ctx) => {
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      const result = resolveReviewedWeeklyDraft(
        { revision, militiaSnapshot: snapshot },
        server.sourceKey,
      );
      const record = prepareCanonicalResolutionRecord(result, `record-${kind}`);
      await appendResolutionRecord(ctx, { ...scope, record });
      return record;
    });
    expect(
      await player.run((ctx) =>
        readEffectiveRecord(ctx, { ...scope, week: draft.week }),
      ),
    ).toEqual(record);
    expect(record.finalOutcome.data).toEqual(
      JSON.parse(JSON.stringify(server.outcome)),
    );
    expect(record.sourceMilitiaSnapshot).toEqual(snapshot);
    expect(record.source).toEqual(draft);
    expect(record.adjudication.tableAdjustments[0]?.reason).toBe(
      'Three copper found at the table',
    );
    expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
  }
});

test('[rules.A10.reroll-parity] browser preview and Convex Confirmation agree that a candidate Roll Twice is rerolled in place, under the current Ruleset Version', async () => {
  const browserRules = await loadBrowserRules();
  const scenarios = {
    // A chosen candidate's Roll Twice waits for its reroll.
    chosen: guaranteedWeek(
      [occurrence('pick', 50), occurrence('other', 46)],
      'pick',
    ),
    // The candidate not chosen rolls Roll Twice.
    unchosen: guaranteedWeek(
      [occurrence('pick', 10), occurrence('other', 51)],
      'pick',
    ),
    // Rerolled in its own die.
    rerolled: guaranteedWeek(
      [occurrence('pick', 10), occurrence('other', 46)],
      'pick',
    ),
  };
  for (const [name, input] of Object.entries(scenarios)) {
    const { revision: draft, militiaSnapshot: snapshot } = input;
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
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      return projectWeeklyDraft({ revision, militiaSnapshot: snapshot });
    });
    const browser: unknown = runInNewContext(
      `${browserRules}; WeeklyRules.projectWeeklyDraft(input)`,
      {
        structuredClone,
        input: JSON.parse(
          JSON.stringify({ revision: draft, militiaSnapshot: snapshot }),
        ) as unknown,
      },
    );
    expect(browser, name).toEqual(server);
    expect(server.rulesetVersion, name).toBe(CANONICAL_WEEKLY_RULESET_VERSION);
    if (name !== 'rerolled') {
      expect(server.status, name).toBe('incomplete');
      expect(server.requirements, name).toContain(
        `${name === 'chosen' ? 'pick' : 'other'}:replacement:1`,
      );
      continue;
    }
    expect(server.status).toBe('ready');
    expect(server.phases?.event.selected.map((event) => event.eventId)).toEqual(
      ['pick'],
    );
    // Confirmation records the same outcome under the current version and
    // keeps the unused earlier children in its source.
    const record = await player.run(async (ctx) => {
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      const record = prepareCanonicalResolutionRecord(
        resolveReviewedWeeklyDraft(
          { revision, militiaSnapshot: snapshot },
          server.sourceKey,
        ),
        'record-rerolled',
      );
      await appendResolutionRecord(ctx, { ...scope, record });
      return record;
    });
    expect(record.rulesetVersion).toBe(CANONICAL_WEEKLY_RULESET_VERSION);
    expect(record.finalOutcome.data).toEqual(
      JSON.parse(JSON.stringify(server.outcome)),
    );
    expect(record.source).toEqual(draft);
  }
});

test('[rules.O06.role-aware-parity] browser preview and Convex Confirmation agree on role-aware manager limits and commandant Hit Dice, under the current Ruleset Version', async () => {
  const browser = createContext({ structuredClone });
  runInContext(await loadBrowserRules(), browser);
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|player',
      name: 'Player',
      image: '',
      orgIds: [{ orgId: 'test', role: 'member' }],
    }),
  );
  const player = t.withIdentity({ tokenIdentifier: 'test|player' });
  // Each scenario is its own campaign: Confirmation closes its open draft.
  async function confirm(
    name: string,
    input: { revision: WeeklyDraft; militiaSnapshot: UpkeepSnapshot },
  ) {
    const scope = await t.run(async (ctx) => {
      const campaignId = await ctx.db.insert('campaign', {
        name,
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
    // Draft identities are unique across campaigns.
    input.revision.draftId = name;
    const { revision: draft, militiaSnapshot: snapshot } = input;
    await player.run((ctx) => openDraft(ctx, { ...scope, draft }));
    browser.input = JSON.parse(JSON.stringify(input)) as unknown;
    const preview: unknown = runInContext(
      'WeeklyRules.projectWeeklyDraft(input)',
      browser,
    );
    const server = await player.run(async (ctx) => {
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      return projectWeeklyDraft({ revision, militiaSnapshot: snapshot });
    });
    expect(preview, name).toEqual(server);
    expect(server.status, name).toBe('ready');
    const record = await player.run(async (ctx) => {
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      const record = prepareCanonicalResolutionRecord(
        resolveReviewedWeeklyDraft(
          { revision, militiaSnapshot: snapshot },
          server.sourceKey,
        ),
        `record-${name}`,
      );
      await appendResolutionRecord(ctx, { ...scope, record });
      return record;
    });
    expect(record.rulesetVersion, name).toBe(CANONICAL_WEEKLY_RULESET_VERSION);
    expect(record.finalOutcome.data, name).toEqual(
      JSON.parse(JSON.stringify(server.outcome)),
    );
    expect(
      record.warnings.map((warning) => warning.message),
      name,
    ).toEqual(server.warnings);
    return server;
  }

  // Charisma 16, 11 and 6: positive, zero and negative modifiers.
  for (const kind of ['pc', 'npc'] as const)
    for (const holdsRole of [false, true])
      for (const charisma of [16, 11, 6]) {
        const name = `${kind}-${holdsRole ? 'officer' : 'no-role'}-${charisma}`;
        const server = await confirm(
          name,
          managerWeek(kind, holdsRole, charisma),
        );
        const officer = kind === 'pc' || holdsRole;
        const limit = officer && charisma === 16 ? 3 : 1;
        expect(server.warnings.includes('manager:ally:capacity'), name).toBe(
          limit < 2,
        );
      }

  // Successful, failed and natural-one (successful and failed) Drill with a
  // blank, zero or explicit override for the level-4 NPC commandant beside
  // the PC's 3 Hit Dice.
  const notoriety = new Map<string, number>();
  for (const [name, die, charisma, succeeds] of [
    ['success', 10, 10, true],
    ['failure', 2, 10, false],
    ['natural-one-success', 1, 34, true],
    ['natural-one-failure', 1, 10, false],
  ] as const) {
    const drillWeek = (hitDice: number | null) =>
      commandantDrillWeek(die, hitDice, charisma);
    const training = new Map<string, number>();
    // A level change moves a blank override; an archived commandant counts.
    const levelled = () => {
      const input = drillWeek(null);
      input.militiaSnapshot.characters = input.militiaSnapshot.characters.map(
        (character) =>
          character.characterId === 'npc'
            ? { ...character, level: 6 }
            : character,
      );
      return input;
    };
    const archived = () => {
      const input = drillWeek(null);
      input.militiaSnapshot.characters = input.militiaSnapshot.characters.map(
        (character) =>
          character.characterId === 'npc'
            ? { ...character, isActive: false }
            : character,
      );
      return input;
    };
    for (const [label, input] of [
      ['blank', () => drillWeek(null)],
      ['zero', () => drillWeek(0)],
      ['explicit', () => drillWeek(5)],
      ['levelled', levelled],
      ['archived', archived],
    ] as const) {
      const server = await confirm(`drill-${name}-${label}`, input());
      training.set(label, server.outcome!.militiaSnapshot.training);
      notoriety.set(name, server.outcome!.militiaSnapshot.notoriety);
    }
    const zero = training.get('zero')!;
    for (const [label, gain] of [
      ['blank', 4],
      ['explicit', 5],
      ['levelled', 6],
      ['archived', 4],
    ] as const)
      expect(training.get(label)! - zero, `${name} ${label}`).toBe(
        succeeds ? gain : 0,
      );
  }
  // A natural one adds its rolled Notoriety whether the Drill succeeds or not.
  for (const name of ['natural-one-success', 'natural-one-failure'])
    expect(notoriety.get(name)! - notoriety.get('success')!, name).toBe(5);
});
