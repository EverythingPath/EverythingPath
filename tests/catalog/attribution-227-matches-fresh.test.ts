// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  attribution227MatchesCheck,
  attribution227PinnedCheckouts,
  freshComparisonRun,
  isRemoteCi,
} from '../../scripts/catalog/attribution-227-generation';

// A gate-host audit (scripts/orchestration/host-audits.json): the scripted
// match authorizes admission, so the landing suite holds the committed file
// to a fresh generation, as `catalog:attribution-227-matches --check` does
// (cavalier-master-tactician fix r4). Only remote CI, which has no pinned
// checkouts, skips it, saying so; on the landing host a checkout missing,
// dirty or at another pin fails it, naming why, and a local landing refuses a
// listed audit that did not pass (`remote_checks.py landing-audits`, fix r5).
const run = freshComparisonRun({
  checkouts: attribution227PinnedCheckouts,
  remoteCi: isRemoteCi(process.env),
});
if (run.kind === 'skip') process.stdout.write(`${run.note}\n`);

describe('the committed scripted match against a fresh generation', () => {
  it.skipIf(run.kind === 'skip')(
    'equals a fresh generation over the pinned checkouts, record for record and as text',
    async () => {
      if (run.kind === 'refuse') throw new Error(run.reason);
      const { problems } = await attribution227MatchesCheck('.');
      expect(problems).toEqual([]);
    },
    900_000,
  );
});
