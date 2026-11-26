// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import { openDraft, readOpenDraft } from './lib/canonicalDraftStorage';
import { projectActivityAndEvents } from '../src/lib/rules-event-outcomes';
import { threatEventFixture } from '../tests/rules/threat-event-fixture';
const modules = import.meta.glob('./**/*.ts');

test('[rules.E75.projection-parity] targeted threats, losses, returns and typed input agree in browser and persisted Convex projection', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/rules-event-outcomes.ts'),
        name: 'EventRules',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(bundle) ? bundle[0] : bundle;
  if (!output || !('output' in output)) throw Error('Expected bundle');
  const script = output.output.find((entry) => entry.type === 'chunk');
  if (script?.type !== 'chunk') throw Error('Expected JavaScript');
  for (const value of [62, 82, 70, 78, 90, 58])
    for (const twice of [false, true]) {
      const { draft, snapshot } = threatEventFixture(value, twice);
      draft.context = { ...draft.context, operatedSettlementIds: ['town'] };
      if (value === 78 && twice) {
        const town = snapshot.settlements[0];
        if (!town) throw Error('Missing town');
        snapshot.settlements.push({
          ...town,
          settlementId: 'second-town',
          name: 'Second town',
        });
        const second = draft.event.occurrences[2];
        if (!second) throw Error('Missing second event');
        second.targets = [{ kind: 'settlement', settlementId: 'second-town' }];
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
        return projectActivityAndEvents(stored, snapshot);
      });
      const browser: unknown = runInNewContext(
        `${script.code}; EventRules.projectActivityAndEvents(draft, snapshot)`,
        {
          structuredClone,
          draft: JSON.parse(JSON.stringify(draft)) as unknown,
          snapshot: structuredClone(snapshot),
        },
      );
      expect(browser, `${value}:${twice}`).toEqual(server);
      expect(server.event.ready, `${value}:${twice}`).toBe(true);
      expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(
        draft,
      );
    }
});
