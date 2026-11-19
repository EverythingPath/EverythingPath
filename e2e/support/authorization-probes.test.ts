// @vitest-environment node
import { expect, test } from 'vitest';
import { verifyIndependentAuthorization } from './authorization-probes';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('starts every role but preserves read-before-write and waits for every write before fresh poststate', async () => {
  const reads = [deferred(), deferred(), deferred()];
  const writes = [deferred(), deferred(), deferred()];
  const started = [deferred(), deferred(), deferred()];
  const events: string[] = [];
  let settled = false;
  const running = verifyIndependentAuthorization(
    reads.map((read, index) => [
      async () => {
        events.push(`read-${index}`);
        await read.promise;
      },
      async () => {
        events.push(`write-${index}`);
        started[index]!.resolve();
        await writes[index]!.promise;
      },
    ]),
    async () => {
      events.push('poststate');
    },
  );
  const done = running.finally(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(events).toEqual(['read-0', 'read-1', 'read-2']);
  reads[1]!.resolve();
  await started[1]!.promise;
  expect(events).toEqual(['read-0', 'read-1', 'read-2', 'write-1']);
  reads[0]!.resolve();
  reads[2]!.resolve();
  await Promise.all(started.map((item) => item.promise));
  writes[0]!.resolve();
  writes[1]!.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(events).not.toContain('poststate');
  writes[2]!.resolve();
  await done;
  expect(events.at(-1)).toBe('poststate');
  expect(events.filter((event) => event === 'poststate')).toHaveLength(1);
});

test.each(['read', 'write'] as const)(
  'unexpectedly authorized %s still settles every role and checks state before failing',
  async (phase) => {
    const held = deferred();
    const waiting = deferred();
    const events: string[] = [];
    const unexpected = new Error(`Unexpectedly authorized ${phase}`);
    const running = verifyIndependentAuthorization(
      [
        [
          async () => {
            events.push('first-read');
            if (phase === 'read') throw unexpected;
          },
          async () => {
            events.push('first-write');
            if (phase === 'write') throw unexpected;
          },
        ],
        [
          async () => {
            events.push('second-read');
          },
          async () => {
            waiting.resolve();
            await held.promise;
            events.push('second-write-done');
          },
        ],
        [
          async () => {
            events.push('third-read');
          },
          async () => {
            events.push('third-write');
          },
        ],
      ],
      async () => {
        events.push('poststate');
      },
    );
    let settled = false;
    const result = running
      .then(
        () => null,
        (error: unknown) => error,
      )
      .finally(() => {
        settled = true;
      });
    await waiting.promise;
    expect(settled).toBe(false);
    expect(events).not.toContain('poststate');
    held.resolve();
    const error = await result;
    expect(error).toBeInstanceOf(AggregateError);
    if (!(error instanceof AggregateError))
      throw Error('Expected collected probe failures');
    expect(error.errors).toEqual([unexpected]);
    expect(events).toContain('first-write');
    expect(events).toContain('third-write');
    expect(events.at(-1)).toBe('poststate');
  },
);

test('reports failed fresh poststate together with probe failures after completing all checks', async () => {
  const deniedAssertion = new Error('Expected rejected read');
  const changed = new Error('State changed');
  const events: string[] = [];
  const result = verifyIndependentAuthorization(
    [
      [
        async () => {
          throw deniedAssertion;
        },
        async () => {
          events.push('write');
        },
      ],
      [
        async () => {
          events.push('other-read');
        },
      ],
    ],
    async () => {
      events.push('poststate');
      throw changed;
    },
  );
  await expect(result).rejects.toMatchObject({
    errors: [deniedAssertion, changed],
    message: expect.stringContaining('Expected rejected read'),
  });
  await expect(result).rejects.toThrow('State changed');
  expect(events).toContain('write');
  expect(events.at(-1)).toBe('poststate');
});

test('fails a changed poststate even when every denied-role assertion passes', async () => {
  const changed = new Error('State changed');
  await expect(
    verifyIndependentAuthorization(
      [
        [async () => undefined],
        [async () => undefined],
        [async () => undefined],
      ],
      async () => {
        throw changed;
      },
    ),
  ).rejects.toMatchObject({ errors: [changed] });
});
