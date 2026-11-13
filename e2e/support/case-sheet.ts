import { z } from 'zod';
import {
  campaignPath,
  characterSheetPath,
} from '../../src/lib/campaign-routes';
import type { Fixture } from './fixtures';

const inspectedCase = z.object({
  characterIds: z.tuple([z.string()], z.string()),
});

/**
 * The sheet of a case's first Character, opened from its campaign's
 * Characters page as a member would reach it.
 */
export async function resolveCaseSheetPath(
  ownedCase: Pick<Fixture, 'campaignId' | 'inspect'>,
) {
  const { characterIds } = inspectedCase.parse(await ownedCase.inspect());
  return characterSheetPath(characterIds[0], {
    href: campaignPath(ownedCase.campaignId, 'characters'),
    organization: { kind: 'unrecorded' },
  });
}
