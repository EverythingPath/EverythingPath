import type { Id } from '../convex/_generated/dataModel';
import { candidateDefinition } from '../convex/lib/catalogCandidateDefinition';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { prepare, type ReleaseTest } from './catalog-release-fixture';

/**
 * The gear family's public proofs' shared release step: each item body's
 * stored identity, inserted before the release, then a prepared Catalog
 * Release of the bodies and the app's candidate conversion of each stored
 * identity. Returns each body's Catalog Entry id by its external key. Each
 * proof keeps its own bodies (`gear-proof-armor.ts`,
 * `gear-proof-worn-items.ts`) and assertions.
 */
export async function releaseGearItems(
  t: ReleaseTest,
  bodies: readonly { externalKey: string; name: string }[],
) {
  const ids: Record<string, Id<'catalogEntry'>> = await t.run(async (ctx) => {
    const inserted: Record<string, Id<'catalogEntry'>> = {};
    for (const { externalKey, name } of bodies)
      inserted[externalKey] = await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name,
        ruleIdentity: externalKey,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
        detail: { kind: 'item', consumable: false },
      });
    return inserted;
  });
  await prepare(
    t,
    bodies.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    for (const id of Object.values(ids)) {
      const stored = await ctx.db.get('catalogEntry', id);
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });
  return ids;
}
