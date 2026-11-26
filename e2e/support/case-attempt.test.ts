// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  caseAttempt,
  claimCaseKey,
  CleanupFailure,
  clearLeftoverCase,
  describeResetFailure,
  handleCleanupFailure,
  retryCleanup,
} from './case-attempt';
import { HarnessFailure } from './diagnostics';
import { CommandFailure } from './process';
import { browserProjects, suites } from './matrix';

describe('case ownership and retry lifecycle', () => {
  it('gives editing and Confirmation separate ownership for their declared cases', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-contract-ownership-'));
    try {
      for (const file of [
        'canonical-persistence.spec.ts',
        'canonical-confirmation.spec.ts',
      ]) {
        const project = browserProjects(suites.live).find((candidate) =>
          [candidate.testMatch].flat().includes(file),
        );
        expect(project?.name).toBeDefined();
        for (const caseKey of ['canonicalPersistence', 'isolation']) {
          await claimCaseKey(
            directory,
            `${project?.name}-worker-0`,
            caseKey,
            file,
          );
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('resets before contexts on both the initial attempt and retry, even when cleanup fails', async () => {
    const order: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      await caseAttempt(
        async () => {
          order.push('reset');
        },
        async () => {
          order.push('contexts');
        },
        async () => {
          order.push('cleanup');
          throw new Error('offline');
        },
        () => {
          order.push('cleanup warning');
        },
      );
    }
    expect(order).toEqual([
      'reset',
      'contexts',
      'cleanup',
      'cleanup warning',
      'reset',
      'contexts',
      'cleanup',
      'cleanup warning',
    ]);
  });
  it('fails the attempt on a write epoch change in cleanup and only warns otherwise', async () => {
    const warnings: string[] = [];
    const attempt = (failure: Error) =>
      caseAttempt(
        async () => undefined,
        async () => undefined,
        async () => {
          throw failure;
        },
        (error) =>
          handleCleanupFailure({
            error,
            scope: { workerKey: 'worker-0', caseKey: 'smoke' },
            warn: (line) => warnings.push(line),
          }),
      );
    await attempt(new Error('offline'));
    expect(warnings).toEqual([
      'E2E case cleanup failed for smoke in worker-0 after 1 attempt; other tests in worker-0 fail the isolation check until the case is reset.\n',
    ]);
    await expect(
      attempt(
        new HarnessFailure({
          kind: 'write-epoch',
          stage: 'fixture cleanupCase',
          read: 1,
          now: 2,
          outcome: 'cleaned',
        }),
      ),
    ).rejects.toThrow(
      'E2E fixture write epoch changed during the session (fixture cleanupCase: read 1, now 2); the case was cleaned up with the new epoch',
    );
    expect(warnings).toHaveLength(1);
  });
  it('never creates contexts after a failed reset', async () => {
    const contexts = vi.fn();
    await expect(
      caseAttempt(
        async () => {
          throw new Error('refused');
        },
        contexts,
        vi.fn(),
        vi.fn(),
      ),
    ).rejects.toThrow('refused');
    expect(contexts).not.toHaveBeenCalled();
  });
  it('allows a retry to reclaim its key and refuses sharing between tests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-ownership-test-'));
    try {
      await claimCaseKey(directory, 'worker-0', 'smoke', 'test-one');
      await claimCaseKey(directory, 'worker-0', 'smoke', 'test-one');
      await expect(
        claimCaseKey(directory, 'worker-0', 'smoke', 'test-two'),
      ).rejects.toThrow('distinct fixture');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('lets exactly one of two simultaneous tests claim a key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-ownership-race-'));
    try {
      for (let round = 0; round < 20; round++) {
        const caseKey = `smoke-${round}`;
        const results = await Promise.allSettled(
          ['test-one', 'test-two'].map((testId) =>
            claimCaseKey(directory, 'worker-0', caseKey, testId),
          ),
        );
        const winners = results.flatMap((result, index) =>
          result.status === 'fulfilled' ? [index] : [],
        );
        expect(winners).toHaveLength(1);
        const loser = results[1 - winners[0]!];
        expect(loser).toMatchObject({
          status: 'rejected',
          reason: expect.objectContaining({
            message: expect.stringContaining('distinct fixture'),
          }),
        });
        const winner = winners[0] === 0 ? 'test-one' : 'test-two';
        await claimCaseKey(directory, 'worker-0', caseKey, winner);
      }
      expect(await readdir(join(directory, 'case-owners'))).toHaveLength(20);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

// The local baseline run at 4a2efe21: a cleanup right after a Confirmation
// lost its write conflicts with the scheduled draft retirement.
const writeConflict = () =>
  new CommandFailure('fixture cleanupCase', 1, undefined, undefined, [
    'application or service reported an error',
    'Convex write conflict (the data changed while the mutation ran)',
  ]);

describe('cleanup retry', () => {
  const clock = () => {
    let time = 1_000;
    const sleeps: number[] = [];
    return {
      sleeps,
      now: () => time,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        time += ms;
      },
    };
  };

  it('repeats a cleanup the server rejected until it succeeds, after a short delay', async () => {
    const { sleeps, now, sleep } = clock();
    const cleanup = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(writeConflict())
      .mockResolvedValueOnce(undefined);
    await retryCleanup({ cleanup, stopAt: 60_000, now, sleep });
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([500]);
  });

  it('gives up after three attempts and reports them', async () => {
    const { sleeps, now, sleep } = clock();
    const cleanup = vi.fn(async () => {
      throw writeConflict();
    });
    const failure = await retryCleanup({
      cleanup,
      stopAt: 60_000,
      now,
      sleep,
    }).catch((error: unknown) => error);
    expect(cleanup).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([500, 1_000]);
    expect(failure).toBeInstanceOf(CleanupFailure);
    expect(failure).toMatchObject({ attempts: 3 });
  });

  it.each<[string, Error]>([
    [
      'a write epoch change',
      new HarnessFailure({
        kind: 'write-epoch',
        stage: 'fixture cleanupCase',
        read: 1,
        now: 2,
        outcome: 'cleanup-failed',
      }),
    ],
    [
      'a timed-out or interrupted command',
      new CommandFailure('fixture cleanupCase', null),
    ],
    [
      'a command that could not start',
      new CommandFailure('fixture cleanupCase', null, 'ENOENT'),
    ],
    [
      'a graph over the cleanup limit',
      new CommandFailure('fixture cleanupCase', 1, undefined, undefined, [
        'E2E fixture graph exceeds cleanup limit',
      ]),
    ],
    ...(
      [
        ['a refused fixture capability', 'fixture authorization refused'],
        ['a rejected identity', 'service rejected authentication'],
        ['a bad token or issuer', 'authentication token or issuer failure'],
        ['a schema validation failure', 'Convex schema validation failed'],
        ['a missing function', 'Convex function is missing'],
        ['an argument validation failure', 'Convex argument validation failed'],
        [
          'an unlabelled server error',
          'application or service reported an error',
        ],
      ] as const
    ).map(([name, label]): [string, Error] => [
      `a server rejection with ${name}`,
      new CommandFailure('fixture cleanupCase', 1, undefined, undefined, [
        label,
      ]),
    ]),
    [
      'a server rejection with no label',
      new CommandFailure('fixture cleanupCase', 1),
    ],
    ['an unclassified harness error', new Error('offline')],
  ])('never repeats %s', async (_name, error) => {
    const { now, sleep } = clock();
    const cleanup = vi.fn(async () => {
      throw error;
    });
    const failure = await retryCleanup({
      cleanup,
      stopAt: 60_000,
      now,
      sleep,
    }).catch((caught: unknown) => caught);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(failure).toMatchObject({ attempts: 1, cause: error });
  });

  it('never waits past the point where the browsers must stop', async () => {
    const { sleeps, now, sleep } = clock();
    const cleanup = vi.fn(async () => {
      throw writeConflict();
    });
    const failure = await retryCleanup({
      cleanup,
      stopAt: 1_400,
      now,
      sleep,
    }).catch((error: unknown) => error);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
    expect(failure).toMatchObject({ attempts: 1 });
  });

  it('starts no further cleanup when the deadline passes during the wait', async () => {
    let time = 1_000;
    const cleanup = vi.fn(async () => {
      throw writeConflict();
    });
    const failure = await retryCleanup({
      cleanup,
      stopAt: 2_000,
      now: () => time,
      // A timer that fires late: the 500 ms wait ends after the deadline.
      sleep: async () => {
        time += 1_200;
      },
    }).catch((error: unknown) => error);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(failure).toMatchObject({ attempts: 1 });
  });

  it('stops waiting at once and starts no further cleanup when the run is cancelled', async () => {
    const stop = new AbortController();
    const cleanup = vi.fn(async () => {
      // Ctrl+C arrives while the retry waits.
      setTimeout(() => stop.abort(), 10);
      throw writeConflict();
    });
    const started = performance.now();
    const failure = await retryCleanup({
      cleanup,
      stopAt: Number.POSITIVE_INFINITY,
      signal: stop.signal,
      delayMs: 60_000,
    }).catch((error: unknown) => error);
    expect(performance.now() - started).toBeLessThan(5_000);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(failure).toMatchObject({ attempts: 1 });
  });

  it('names the case and its attempts when the cleanup finally fails', async () => {
    const warnings: string[] = [];
    await handleCleanupFailure({
      error: new CleanupFailure(writeConflict(), 3),
      scope: { workerKey: 'worker-0', caseKey: 'workspacePersistent' },
      warn: (line) => warnings.push(line),
    });
    await expect(
      handleCleanupFailure({
        error: new CleanupFailure(
          new HarnessFailure({
            kind: 'write-epoch',
            stage: 'fixture cleanupCase',
            read: 1,
            now: 2,
            outcome: 'cleanup-failed',
          }),
          1,
        ),
        scope: { workerKey: 'worker-0', caseKey: 'workspacePersistent' },
        warn: (line) => warnings.push(line),
      }),
    ).rejects.toBeInstanceOf(HarnessFailure);
    expect(warnings).toEqual([
      'E2E case cleanup failed for workspacePersistent in worker-0 after 3 attempts; other tests in worker-0 fail the isolation check until the case is reset.\n',
    ]);
  });
});

describe('one leftover case, one cause', () => {
  const isolationFailure = () =>
    new CommandFailure('fixture resetCase', 1, undefined, undefined, [
      'application or service reported an error',
      'E2E cohort isolation check failed',
    ]);

  it('reports later isolation failures in its cohort as blocked by the case a failed cleanup left behind', async () => {
    const privateDirectory = await mkdtemp(join(tmpdir(), 'e2e-leftover-'));
    try {
      await handleCleanupFailure({
        error: new CleanupFailure(writeConflict(), 3),
        scope: { workerKey: 'worker-0', caseKey: 'workspacePersistent' },
        warn: () => undefined,
        privateDirectory,
      });
      const reset = isolationFailure();
      const blocked = await describeResetFailure({
        error: reset,
        privateDirectory,
        workerKey: 'worker-0',
      });
      expect(blocked).toBeInstanceOf(Error);
      expect((blocked as Error).message).toBe(
        'fixture resetCase: blocked by leftover case workspacePersistent in worker-0, whose cleanup failed earlier in this run',
      );
      expect((blocked as Error).cause).toBe(reset);

      // Another cohort, or a reset that failed for another reason, is
      // reported as it was.
      const elsewhere = isolationFailure();
      expect(
        await describeResetFailure({
          error: elsewhere,
          privateDirectory,
          workerKey: 'worker-1',
        }),
      ).toBe(elsewhere);
      const refused = new CommandFailure(
        'fixture resetCase',
        1,
        undefined,
        undefined,
        ['fixture authorization refused'],
      );
      expect(
        await describeResetFailure({
          error: refused,
          privateDirectory,
          workerKey: 'worker-0',
        }),
      ).toBe(refused);

      // Once that case resets again, its leftover is gone.
      await clearLeftoverCase({
        privateDirectory,
        workerKey: 'worker-0',
        caseKey: 'workspacePersistent',
      });
      const later = isolationFailure();
      expect(
        await describeResetFailure({
          error: later,
          privateDirectory,
          workerKey: 'worker-0',
        }),
      ).toBe(later);
    } finally {
      await rm(privateDirectory, { recursive: true, force: true });
    }
  });
});
