// @vitest-environment edge-runtime
import { editWeeklyDraft } from '../src/lib/weekly-draft';
import { canonicalResolutionRecordSchema } from '../src/lib/canonical-resolution-record';
import { createPersistentSuccessor } from '../src/lib/rules-persistent-events';
import { projectActivity } from '../src/lib/rules-activity';
import { roll } from '../tests/rules/upkeep-fixture';
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import {
  appendResolutionRecord,
  saveDraftRevision,
  openDraft,
  readOpenDraft,
} from './lib/canonicalDraftStorage';
import { projectPersistentWeek } from '../src/lib/rules-persistent-events';
import { persistentEventFixture } from '../tests/rules/persistent-event-fixture';
const modules = import.meta.glob('./**/*.ts');

test('[rules.P77.projection-parity] persistent decisions, temporary mitigation and ordered endings agree in browser and persisted Convex projection', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/rules-persistent-events.ts'),
        name: 'EventRules',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(bundle) ? bundle[0] : bundle;
  if (!output || !('output' in output)) throw Error('Expected bundle');
  const script = output.output.find((entry) => entry.type === 'chunk');
  if (script?.type !== 'chunk') throw Error('Expected JavaScript');
  for (const value of [
    'rivalry',
    'theft',
    'double_agent',
    'low_morale',
  ] as const)
    for (const decision of ['unattempted', 'mitigate', 'buyoff'] as const) {
      const { draft, snapshot } = persistentEventFixture(value);
      snapshot.training = 15;
      if (decision === 'mitigate' && !['rivalry', 'theft'].includes(value))
        continue;
      draft.persistent.decisions = [
        decision === 'mitigate'
          ? value === 'rivalry'
            ? {
                eventId: 'carried',
                kind: 'mitigate',
                officerCheck: {
                  characterId: 'pc',
                  skill: 'diplomacy',
                  skillBonus: 0,
                  roll: {
                    sides: 20,
                    diceTotal: 20,
                    diceCount: 1,
                    provenance: { kind: 'table' },
                    modifiers: [],
                  },
                },
              }
            : {
                eventId: 'carried',
                kind: 'mitigate',
                rolls: {
                  check: {
                    sides: 20,
                    diceTotal: 20,
                    diceCount: 1,
                    provenance: { kind: 'table' },
                    modifiers: [],
                  },
                },
              }
          : { eventId: 'carried', kind: decision },
      ];
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
        return projectPersistentWeek(stored, snapshot);
      });
      const browser: unknown = runInNewContext(
        `${script.code}; EventRules.projectPersistentWeek(draft, snapshot)`,
        {
          structuredClone,
          draft: JSON.parse(JSON.stringify(draft)) as unknown,
          snapshot: structuredClone(snapshot),
        },
      );
      expect(browser, `${value}:${decision}`).toEqual(server);
      expect(server.ready, `${value}:${decision}`).toBe(true);
      expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(
        draft,
      );
    }
});

test('[rules.P77.rivalry-mutation] persisted week-two through four keeps targets and restrictions until successful officer ending, then prepares one empty successor', async () => {
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
  let { draft, snapshot } = persistentEventFixture();
  snapshot.training = 10;
  await player.run((ctx) => openDraft(ctx, { ...scope, draft }));
  for (const week of [2, 3, 4]) {
    const result = await player.run(async (ctx) => {
      const stored = await readOpenDraft(ctx, scope);
      if (!stored) throw Error('Missing source');
      const staged = editWeeklyDraft(stored, {
        kind: 'persistent_decision',
        decision:
          week === 2
            ? { kind: 'unattempted', eventId: 'carried' }
            : {
                kind: 'mitigate',
                eventId: 'carried',
                officerCheck: {
                  characterId: 'pc',
                  skill: 'bluff',
                  skillBonus: 0,
                  roll: roll(20, week === 4 ? 20 : 19),
                },
              },
      });
      if (!staged.ok) throw Error(staged.error);
      const decision = staged.draft.persistent.decisions[0];
      if (!decision) throw Error('Missing staged decision');
      await saveDraftRevision(ctx, {
        ...scope,
        draftId: stored.draftId,
        operationId: `officer-${week}`,
        baseRevision: stored.revision,
        expectedRevision: stored.revision,
        edit: {
          kind: 'persistent_decision',
          decision,
        },
        draft: staged.draft,
        targets: ['persistent:carried'],
      });
      const source = await readOpenDraft(ctx, scope);
      if (!source) throw Error('Missing revised source');
      const work = {
        ...source,
        activity: {
          ...source.activity,
          slots: [
            {
              slotId: 'one',
              choice: {
                choiceId: 'work',
                actionId: 'special' as const,
                teamId: 'team',
                instruction: 'Patrol',
              },
            },
          ],
        },
      };
      expect(projectActivity(work, snapshot).requirements).toContain(
        'work:team-unavailable:exception',
      );
      const projection = projectPersistentWeek(source, snapshot);
      expect(projection.ready).toBe(true);
      const next = createPersistentSuccessor(
        source,
        projection.event,
        projection.persistent,
        `next-${week + 1}`,
        [],
      );
      const record = canonicalResolutionRecordSchema.parse({
        recordId: `record-${week}`,
        source,
        sourceMilitiaSnapshot: snapshot,
        provenance: 'confirmation',
        rulesetVersion: 1,
        baselinePlan: {
          formatVersion: 2,
          data: { persistent: projection.persistent.plan },
        },
        finalPlan: {
          formatVersion: 2,
          data: { persistent: projection.persistent.plan },
        },
        adjudication: {
          acknowledgements: source.acknowledgements,
          rulesExceptions: source.rulesExceptions,
          tableAdjustments: source.tableAdjustments,
        },
        warnings: [],
        finalOutcome: {
          formatVersion: 2,
          data: {
            persistentEvents: projection.persistent.persistentEvents,
            outcome: JSON.parse(JSON.stringify(projection.persistent.outcome)),
          },
        },
        successorContext: next.context,
        supersedesRecordId: null,
      });
      await appendResolutionRecord(ctx, { ...scope, record });
      next.draft.upkeep.rolls = { check: roll(20, 19), training: roll(6, 1) };
      next.draft.event.chanceRoll = roll(100, 100);
      await openDraft(ctx, { ...scope, draft: next.draft });
      return next;
    });
    draft = result.draft;
    snapshot = result.outcome;
    expect(draft.context.carriedEvents).toHaveLength(week === 4 ? 0 : 1);
    if (week < 4)
      expect(draft.context.carriedEvents[0]?.targets).toEqual([
        { kind: 'team', teamId: 'team' },
        { kind: 'team', teamId: 'second-team' },
      ]);
    expect(
      (await player.run((ctx) => readOpenDraft(ctx, scope)))?.draftId,
    ).toBe(`next-${week + 1}`);
  }
});
