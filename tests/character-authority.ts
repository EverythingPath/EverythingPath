import type { TestConvex } from 'convex-test';
import type schema from '../convex/schema';
import type { CharacterAuthority } from '../src/lib/character-sheet-availability';

/**
 * Seeds the authority an initial migration's activation selects, which no
 * public or operator function sets yet (#413 F6): an open gate at epoch 0.
 */
export async function selectCharacterAuthority(
  t: TestConvex<typeof schema>,
  authority: CharacterAuthority,
) {
  await t.run(async (ctx) => {
    const control = await ctx.db
      .query('initialMigrationControl')
      .withIndex('by_key', (q) => q.eq('key', 'character-sheet'))
      .unique();
    if (control) {
      await ctx.db.patch('initialMigrationControl', control._id, {
        authority,
      });
      return;
    }
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'activation',
      epoch: 0,
      // An activated run carries its activation records; the open gate never
      // reads this run's stage, so a seeded authority needs none.
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60000,
    });
    await ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 0,
      closed: false,
      authority,
      runId,
    });
  });
}
