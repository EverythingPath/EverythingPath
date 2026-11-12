// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('[retirement.reject] retired writes reject stale clients even without a cutover control row', async () => {
  const t = convexTest(schema, modules);
  for (const endpoint of [
    api.weekBoard.saveWeekBoardState,
    api.weekBoard.commitCurrentPhase,
    api.weekBoard.goToPreviousWeek,
    api.weekBoard.applyTreasuryTransaction,
    api.weekBoard.buyOffPersistentEvent,
    api.weekBoard.rankUpMilitia,
    api.militia.createMilitia,
    api.militia.assignOfficerRole,
    api.migrations.startLegacySchemaMigration,
    internal.migrations.runLegacySchemaMigrationBatch,
  ])
    await expect(t.mutation(endpoint, {})).rejects.toThrow(
      'Open the current militia week',
    );
  await expect(t.query(api.weekBoard.getWeekBoardState, {})).rejects.toThrow(
    'Open the current militia week',
  );
});
