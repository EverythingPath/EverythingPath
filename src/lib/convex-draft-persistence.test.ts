import { upkeepFixture, roll } from '../../tests/rules/upkeep-fixture';
import { createMemoryDraftAuthority } from './memory-draft-persistence';
import { createDraftPersistence } from './weekly-draft-persistence';
import {
  DraftRejected,
  draftOperationSchema,
} from './weekly-draft-persistence-contract';
import { expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { ConvexClient } from 'convex/browser';
import { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { createConvexDraftTransport } from './convex-draft-persistence';

test('a transport bound to a closed draft cannot redirect an edit to its successor', async () => {
  const client = new ConvexClient('https://unused.convex.cloud', {
    disabled: true,
    logger: false,
  });
  const transport = createConvexDraftTransport(
    client,
    draftKeySchema.parse({
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: 'closed',
    }),
  );
  try {
    await expect(
      transport.send({
        draftId: 'successor',
        operationId: 'late',
        baseRevision: 0,
        edit: { kind: 'event_chance', roll: null },
      }),
    ).rejects.toThrow('Unknown draft');
  } finally {
    await client.close();
  }
});

test.each(['edit', 'confirm'] as const)(
  'the %s adapter preserves only the exact public maintenance rejection',
  async (kind) => {
    const client = new ConvexClient('https://unused.convex.cloud', {
      disabled: true,
      logger: false,
    });
    const mutation = vi.spyOn(client, 'mutation');
    const transport = createConvexDraftTransport(
      client,
      draftKeySchema.parse({
        campaignId: 'campaign',
        militiaId: 'militia',
        draftId: 'week',
      }),
    );
    const perform = () =>
      kind === 'edit'
        ? transport.send({
            draftId: 'week',
            operationId: 'edit',
            baseRevision: 0,
            edit: { kind: 'event_chance', roll: null },
          })
        : transport.confirm({
            operationId: 'confirm',
            reviewed: {
              draftId: 'week',
              revision: 0,
              sourceRevision: 0,
              sourceKey: 'source',
              rulesetVersion: 1,
            },
          });
    try {
      mutation.mockRejectedValue(
        new ConvexError(
          'Editing is paused for maintenance. Saved information remains available.',
        ),
      );
      await expect(perform()).rejects.toMatchObject({
        failureReason:
          'Editing is paused for maintenance. Saved information remains available.',
      });
      mutation.mockRejectedValue(
        new ConvexError({
          code: 'RELOAD_REQUIRED',
          message: 'untrusted detail',
        }),
      );
      await expect(perform()).rejects.toMatchObject({
        failureReason:
          'This page is out of date. Reload to keep editing; unsaved changes will be discarded.',
      });
      mutation.mockRejectedValue(
        new ConvexError({ code: 'MAINTENANCE', message: 'untrusted detail' }),
      );
      await expect(perform()).rejects.toMatchObject({
        failureReason: DraftRejected.maintenanceReason,
      });
      for (const data of [
        'Private campaign id secret',
        'Editing is paused for maintenance. Saved information remains available. secret',
        {
          message:
            'Editing is paused for maintenance. Saved information remains available.',
        },
      ]) {
        mutation.mockRejectedValue(new ConvexError(data));
        await expect(perform()).rejects.toMatchObject({ failureReason: null });
      }
    } finally {
      mutation.mockRestore();
      await client.close();
    }
  },
);

test.each(['mutation', 'hydration'] as const)(
  'a %s failure distinguishes mutation rejection from post-acceptance read failure',
  async (failureAt) => {
    const client = new ConvexClient('https://unused.convex.cloud', {
      disabled: true,
      logger: false,
    });
    const { draft, snapshot } = upkeepFixture();
    const authority = createMemoryDraftAuthority(draft, snapshot);
    const initial = await authority.transport.read();
    const page = async () => {
      const observation = await authority.transport.read();
      return {
        observation,
        restart: false,
        pagination: {
          page: observation.targetRevisions,
          isDone: true,
          continueCursor: '',
        },
      };
    };
    const failure = new ConvexError(DraftRejected.maintenanceReason);
    const query = vi.spyOn(client, 'query');
    query.mockResolvedValueOnce(initial).mockImplementationOnce(page);
    if (failureAt === 'hydration') query.mockRejectedValueOnce(failure);
    query
      .mockImplementationOnce(() => authority.transport.read())
      .mockImplementationOnce(page);
    const mutation = vi
      .spyOn(client, 'mutation')
      .mockImplementation(async (_reference, args) => {
        if (failureAt === 'mutation') throw failure;
        return authority.transport.send(
          draftOperationSchema.parse(args.operation),
        );
      });
    const persistence = createDraftPersistence(
      createConvexDraftTransport(
        client,
        draftKeySchema.parse({
          campaignId: 'campaign',
          militiaId: 'militia',
          draftId: draft.draftId,
        }),
      ),
    );
    try {
      await persistence.ready;
      expect(
        await persistence.edit({ kind: 'event_chance', roll: roll(100, 30) }),
      ).toBe('failed');
      expect(mutation).toHaveBeenCalledTimes(1);
      expect(persistence.getSnapshot().observation?.revision).toBe(
        failureAt === 'hydration' ? 1 : 0,
      );
      expect(persistence.getSnapshot().remoteChange).toBeNull();
      expect(persistence.getSnapshot().failureReason).toBe(
        failureAt === 'mutation' ? DraftRejected.maintenanceReason : null,
      );
    } finally {
      persistence.dispose();
      vi.restoreAllMocks();
      await client.close();
    }
  },
);
