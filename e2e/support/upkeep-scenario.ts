import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { weekPath } from '../../src/lib/campaign-routes';
import type { Fixture } from './fixtures';
import { canonicalPersistenceFixtureCall, type Run } from './process';

export type UpkeepScenario = {
  choices?: boolean;
  maximumNotoriety?: boolean;
  missingTeam?: boolean;
  rankGain?: boolean;
  persistent?: boolean;
  // With `choices`: Scouts already recovered at the adjusted 15 gp.
  adjustedRecovery?: boolean;
};

/**
 * A journey's opening week-four Upkeep draft on its freshly reset case. The
 * automatic `ownedCase` fixture has already reset the case for this attempt,
 * so this only initializes it: one fixture call instead of a second reset.
 * A deliberate reset later in a journey stays an explicit `resetCase` call.
 */
export async function initialUpkeep(
  run: Run,
  ownedCase: Pick<Fixture, 'scope'>,
  scenario: UpkeepScenario = {},
): Promise<{ key: z.infer<typeof draftKeySchema>; route: string }> {
  const key = draftKeySchema.parse(
    await canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {
      scope: ownedCase.scope,
      draftId: randomUUID(),
      ...scenario,
    }),
  );
  return { key, route: weekPath(key.campaignId) };
}
