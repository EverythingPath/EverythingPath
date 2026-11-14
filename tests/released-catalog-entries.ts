// The class-feature proofs' shared release steps
// (`convex/characterSheetFeatureGrants*.integration.test.ts`,
// `convex/characterSheetClassLevelSlots.integration.test.ts`): a public
// saved-sheet read with its catalog, and imported-shaped bodies installed as
// a prepared Catalog Release's candidates.
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { candidateDefinition } from '../convex/lib/catalogCandidateDefinition';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import {
  prepare,
  type ReleaseTest,
  type releaseFixture,
} from './catalog-release-fixture';
import { withSheetCatalog } from './character-sheet-catalog';

type Viewer = Awaited<ReturnType<typeof releaseFixture>>['owner'];

/** One public saved-sheet read with its catalog. */
export async function readSavedSheet(
  viewer: Viewer,
  scope: { organizationId: string; characterId: Id<'character'> },
) {
  const sheet = withSheetCatalog(
    await viewer.query(api.characterSheet.read, scope),
  );
  if (!sheet) throw new Error('Missing saved sheet');
  return sheet;
}

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion, as `characterSheetGrantedSpells.integration.test.ts` installs
 * them: each stored identity stub (`id`, inserted before) replaced by its
 * release candidate.
 */
export async function installReleasedBodies(
  t: ReleaseTest,
  bodies: readonly { externalKey: string }[],
  id: (key: string) => Id<'catalogEntry'>,
) {
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
    for (const { externalKey } of bodies) {
      const stored = await ctx.db.get('catalogEntry', id(externalKey));
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });
}
