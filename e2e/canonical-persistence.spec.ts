import { verifyIndependentAuthorization } from './support/authorization-probes';
import { randomUUID } from 'node:crypto';
import { ConvexClient } from 'convex/browser';
import { draftKeySchema } from '../convex/lib/canonicalStorageValidators';
import { createConvexDraftTransport } from '../src/lib/convex-draft-persistence';
import { test, expect } from './support/fixtures';
import { canonicalPersistenceFixtureCall } from './support/process';
import { sanitizeLog } from './support/artifacts';
import { prepareContract } from './support/canonical-contract';
import { api } from '../convex/_generated/api';
import { runPersistenceContract } from '../tests/persistence/contracts';

test.use({ caseKey: 'canonicalPersistence', comparisonCaseKey: 'isolation' });

test('shared persistence contract uses authenticated isolated Convex', async ({
  players,
  ownedCase,
  comparisonCase,
}) => {
  // Run 2 used 245 s; the limit is 1.6 times that (README, Per-test limits).
  test.setTimeout(395_000);
  const { run, url, comparison, connect } = await prepareContract(
    players,
    comparisonCase!,
  );
  let nativePaginationVerified = false;

  const first = connect(players.gm);
  const second = connect(players.player);
  const outsider = connect(players.outsider);
  const anonymous = new ConvexClient(url, { logger: false });
  try {
    await runPersistenceContract(async () => {
      const scope = draftKeySchema.parse(
        await canonicalPersistenceFixtureCall(run, 'resetAndInitialize', {
          scope: ownedCase.scope,
          now: 1_700_000_000_000,
          draftId: randomUUID(),
        }),
      );
      const firstTransport = createConvexDraftTransport(first, scope);
      const outsiderTransport = createConvexDraftTransport(outsider, scope);
      const anonymousTransport = createConvexDraftTransport(anonymous, scope);
      const crossCampaignTransport = createConvexDraftTransport(first, {
        ...scope,
        campaignId: comparison.campaignId,
      });
      const initial = await firstTransport.read();
      const slotId = initial.draft?.activity.slots[0]?.slotId;
      expect(slotId).toBeDefined();
      await verifyIndependentAuthorization(
        [outsiderTransport, anonymousTransport, crossCampaignTransport].map(
          (denied) => [
            () => expect(denied.read()).rejects.toThrow(),
            () =>
              expect(
                denied.send({
                  draftId: scope.draftId,
                  operationId: randomUUID(),
                  baseRevision: 0,
                  edit: {
                    kind: 'stage',
                    slotId: slotId!,
                    choice: { choiceId: randomUUID(), actionId: 'special' },
                  },
                }),
              ).rejects.toThrow(),
          ],
        ),
        async () => {
          expect(await firstTransport.read()).toEqual(initial);
        },
      );
      return {
        first: firstTransport,
        second: createConvexDraftTransport(second, scope),
        close: async () => {
          await canonicalPersistenceFixtureCall(run, 'close', {
            scope: ownedCase.scope,
            ...scope,
          });
        },
        dispose: async () => {
          const observation = await firstTransport.read();
          if (
            !nativePaginationVerified &&
            observation.status === 'open' &&
            observation.targetRevisions.length > 16
          ) {
            const result = await first.query(
              api.canonicalDraftPersistence.targets,
              {
                ...scope,
                afterRevision: 0,
                observedRevision: observation.revision,
                observedStatus: observation.status,
                paginationOpts: {
                  numItems: 1,
                  cursor: null,
                  endCursor: null,
                  maximumRowsRead: 1,
                  maximumBytesRead: 100_000,
                  id: 79,
                },
              },
            );
            expect(result.restart).toBe(false);
            expect(result.pagination).not.toBeNull();
            expect(result.pagination!.page.length).toBeLessThanOrEqual(1);
            expect(result.pagination!.isDone).toBe(false);
            expect(result.pagination!.continueCursor).not.toBe('');
            nativePaginationVerified = true;
          }
        },
      };
    });
    expect(nativePaginationVerified).toBe(true);
  } catch (error) {
    throw new Error(
      `Isolated authenticated persistence contract: ${sanitizeLog(
        error instanceof Error ? error.message : 'Verification failed',
      )}`,
    );
  } finally {
    await Promise.all([
      first.close(),
      second.close(),
      outsider.close(),
      anonymous.close(),
    ]);
  }
});
