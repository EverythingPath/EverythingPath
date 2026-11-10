// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import { openDraft, readOpenDraft } from './lib/canonicalDraftStorage';
import { projectActivityAndEvents } from '../src/lib/rules-event-outcomes';
import { recurringEventFixture } from '../tests/rules/recurring-event-fixture';
const modules = import.meta.glob('./**/*.ts');

test('[rules.E76.projection-parity] recurring events, ordered endings and typed future effects agree in browser and persisted Convex projection', async () => {
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
  for (const value of [54, 98, 42, 26, 86, 66, 74, 100, 2])
    for (const twice of [false, true]) {
      const { draft, snapshot } = recurringEventFixture(value, twice);
      draft.context = { ...draft.context, operatedSettlementIds: ['town'] };
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
