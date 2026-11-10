// @vitest-environment edge-runtime
// The patched convex-test (patches/convex-test@0.0.50.patch) must accept and
// refuse exactly what the published one does; only its speed changes.
import { convexTest } from 'convex-test';
import {
  defineSchema,
  defineTable,
  makeFunctionReference,
  mutationGeneric,
  type DataModelFromSchemaDefinition,
  type GenericQueryCtx,
} from 'convex/server';
import { v, type GenericId } from 'convex/values';
import { expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import appSchema from './schema';

const modules = import.meta.glob('./**/*.ts');
const schema = defineSchema({
  shapes: defineTable({
    shape: v.union(
      v.object({ kind: v.literal('circle'), radius: v.number() }),
      v.object({ kind: v.literal('square'), side: v.number() }),
      v.null(),
    ),
    tags: v.optional(
      v.array(v.union(v.string(), v.object({ id: v.id('notes') }))),
    ),
  }),
  notes: defineTable({
    text: v.string(),
    rank: v.optional(v.number()),
    scores: v.optional(v.union(v.null(), v.record(v.string(), v.number()))),
  }).index('by_rank', ['rank']),
});

// Player-authored campaign notes exercise the release/kind/key query shape
// without introducing published rules or changing the Catalog fixtures.
const noteFields = {
  release: v.string(),
  kind: v.string(),
  key: v.optional(v.union(v.string(), v.number(), v.null())),
  text: v.string(),
  reference: v.optional(v.object({ key: v.string() })),
};
const equalitySchema = defineSchema({
  campaignNotes: defineTable(noteFields)
    .index('by_release_and_kind_and_key', ['release', 'kind', 'key'])
    .index('by_reference_key', ['reference.key']),
});
type NoteCtx = GenericQueryCtx<
  DataModelFromSchemaDefinition<typeof equalitySchema>
>;
const watchNote = {
  release: 'Ironfang table notes',
  kind: 'watch rota',
  key: 'Phaendar',
  text: 'Meet at the bridge',
};
function findNotes(ctx: NoteCtx, note = watchNote) {
  return ctx.db
    .query('campaignNotes')
    .withIndex('by_release_and_kind_and_key', (q) =>
      q.eq('release', note.release).eq('kind', note.kind).eq('key', note.key),
    );
}

test('repeated equality lookups distinguish releases, kinds and string field boundaries, including missing and duplicate results', async () => {
  const t = convexTest(equalitySchema, modules);
  await t.run(async (ctx) => {
    for (const note of [
      watchNote,
      { ...watchNote, release: 'Second campaign' },
      { ...watchNote, kind: 'session notes' },
      { ...watchNote, release: 'Ironfang:watch', kind: 'rota' },
      { ...watchNote, release: 'Ironfang', kind: 'watch:rota' },
      { ...watchNote, key: 'Phaendar\u0000bridge' },
      { ...watchNote, key: 'Phaendar"bridge' },
    ])
      await ctx.db.insert('campaignNotes', note);
    for (let round = 0; round < 3; round++) {
      expect(await findNotes(ctx).unique()).toMatchObject(watchNote);
      expect(
        await findNotes(ctx, { ...watchNote, key: 'Next session' }).unique(),
      ).toBeNull();
      expect(
        await findNotes(ctx, {
          ...watchNote,
          release: 'Second campaign',
        }).unique(),
      ).toMatchObject({ release: 'Second campaign' });
      expect(
        await findNotes(ctx, { ...watchNote, kind: 'session notes' }).unique(),
      ).toMatchObject({ kind: 'session notes' });
      expect(
        await findNotes(ctx, {
          ...watchNote,
          release: 'Ironfang:watch',
          kind: 'rota',
        }).collect(),
      ).toHaveLength(1);
      expect(
        await findNotes(ctx, {
          ...watchNote,
          key: 'Phaendar\u0000bridge',
        }).unique(),
      ).toMatchObject({ key: 'Phaendar\u0000bridge' });
      expect(
        await findNotes(ctx, { ...watchNote, key: 'Phaendar"bridge' }).unique(),
      ).toMatchObject({ key: 'Phaendar"bridge' });
    }
    await ctx.db.insert('campaignNotes', watchNote);
    for (let round = 0; round < 2; round++)
      await expect(findNotes(ctx).unique()).rejects.toThrow(
        'unique() query returned more than one result from table campaignNotes:',
      );
  });
});

test('equality reads follow inserts, non-key patches, key moves, replacements and deletes within and after a transaction', async () => {
  const t = convexTest(equalitySchema, modules);
  const id = await t.run((ctx) => ctx.db.insert('campaignNotes', watchNote));
  await t.run(async (ctx) => {
    expect(await findNotes(ctx).unique()).toMatchObject(watchNote);
    await ctx.db.patch('campaignNotes', id, { text: 'Meet at dusk' });
    expect(await findNotes(ctx).unique()).toMatchObject({
      text: 'Meet at dusk',
    });
    const moved = { ...watchNote, key: 'Bridge' };
    expect(await findNotes(ctx, moved).unique()).toBeNull();
    await ctx.db.patch('campaignNotes', id, { key: moved.key });
    expect(await findNotes(ctx).unique()).toBeNull();
    expect(await findNotes(ctx, moved).unique()).toMatchObject({
      text: 'Meet at dusk',
    });
    await ctx.db.replace('campaignNotes', id, watchNote);
    expect(await findNotes(ctx, moved).unique()).toBeNull();
    expect(await findNotes(ctx).unique()).toMatchObject(watchNote);
    const movedRelease = {
      ...watchNote,
      release: 'Second campaign',
      kind: 'session notes',
    };
    await ctx.db.patch('campaignNotes', id, movedRelease);
    expect(await findNotes(ctx).unique()).toBeNull();
    expect(await findNotes(ctx, movedRelease).unique()).toMatchObject(
      movedRelease,
    );
    await ctx.db.replace('campaignNotes', id, watchNote);
    expect(await findNotes(ctx, movedRelease).unique()).toBeNull();
    await ctx.db.delete('campaignNotes', id);
    expect(await findNotes(ctx).unique()).toBeNull();
    await ctx.db.insert('campaignNotes', watchNote);
    const first = await findNotes(ctx).unique();
    if (!first) throw new Error('Missing campaign note');
    first.text = 'Unsaved edit';
    expect(await findNotes(ctx).unique()).toMatchObject(watchNote);
  });
  expect(await t.query((ctx) => findNotes(ctx).collect())).toHaveLength(1);
});

test('equality snapshots follow nested rollback and commit, outer abort, and independent instances', async () => {
  const child = makeFunctionReference<'mutation', { abort: boolean }, null>(
    'harness:child',
  );
  const childMutation = mutationGeneric({
    args: { abort: v.boolean() },
    returns: v.null(),
    handler: async (ctx, args) => {
      const existing = await findNotes(ctx).unique();
      if (!existing) throw new Error('Missing campaign note');
      await ctx.db.patch('campaignNotes', existing._id, {
        text: 'Nested edit',
      });
      expect(await findNotes(ctx).unique()).toMatchObject({
        text: 'Nested edit',
      });
      await ctx.db.insert('campaignNotes', { ...watchNote, key: 'Bridge' });
      expect(
        await findNotes(ctx, { ...watchNote, key: 'Bridge' }).unique(),
      ).toMatchObject({ key: 'Bridge' });
      if (args.abort) throw new Error('Abort child');
      return null;
    },
  });
  const t = convexTest(equalitySchema, {
    ...modules,
    './harness.ts': async () => ({ child: childMutation }),
  });
  const other = convexTest(equalitySchema, modules);
  await t.run((ctx) => ctx.db.insert('campaignNotes', watchNote));
  await other.run((ctx) =>
    ctx.db.insert('campaignNotes', { ...watchNote, text: 'Another table' }),
  );
  await expect(
    t.mutation(async (ctx) => {
      expect(await findNotes(ctx).unique()).toMatchObject(watchNote);
      await expect(ctx.runMutation(child, { abort: true })).rejects.toThrow(
        'Abort child',
      );
      expect(await findNotes(ctx).unique()).toMatchObject(watchNote);
      expect(
        await findNotes(ctx, { ...watchNote, key: 'Bridge' }).unique(),
      ).toBeNull();
      await ctx.runMutation(child, { abort: false });
      expect(await findNotes(ctx).unique()).toMatchObject({
        text: 'Nested edit',
      });
      expect(
        await findNotes(ctx, { ...watchNote, key: 'Bridge' }).unique(),
      ).toMatchObject({ key: 'Bridge' });
      throw new Error('Abort parent');
    }),
  ).rejects.toThrow('Abort parent');
  expect(await t.query((ctx) => findNotes(ctx).unique())).toMatchObject(
    watchNote,
  );
  expect(
    await t.query((ctx) =>
      findNotes(ctx, { ...watchNote, key: 'Bridge' }).unique(),
    ),
  ).toBeNull();
  await t.mutation(async (ctx) => {
    expect(await findNotes(ctx).unique()).toMatchObject(watchNote);
    await ctx.runMutation(child, { abort: false });
    expect(await findNotes(ctx).unique()).toMatchObject({
      text: 'Nested edit',
    });
  });
  expect(await t.query((ctx) => findNotes(ctx).unique())).toMatchObject({
    text: 'Nested edit',
  });
  expect(await other.query((ctx) => findNotes(ctx).unique())).toMatchObject({
    text: 'Another table',
  });
});

test('equality results retain filters, limits, ordering, creation-time and ID ties, and pagination boundaries', async () => {
  const t = convexTest(equalitySchema, modules);
  const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
  // At 2**53 the emulator's 0.001 increment rounds away, creating real ties.
  const ids = await t.run(async (ctx) => {
    const early = await ctx.db.insert('campaignNotes', {
      ...watchNote,
      text: 'Earlier',
    });
    now.mockReturnValue(2 ** 53);
    const firstTie = await ctx.db.insert('campaignNotes', {
      ...watchNote,
      text: 'First tie',
    });
    const secondTie = await ctx.db.insert('campaignNotes', {
      ...watchNote,
      text: 'Second tie',
    });
    return [early, firstTie, secondTie];
  });
  now.mockRestore();
  await t.query(async (ctx) => {
    expect((await findNotes(ctx).collect()).map((r) => r._id)).toEqual(ids);
    expect(
      (await findNotes(ctx).order('desc').take(2)).map((r) => r.text),
    ).toEqual(['Second tie', 'First tie']);
    expect(
      (
        await findNotes(ctx)
          .filter((q) => q.neq(q.field('text'), 'Earlier'))
          .take(1)
      ).map((r) => r.text),
    ).toEqual(['First tie']);
    for (const order of ['asc', 'desc'] as const) {
      const first = await findNotes(ctx)
        .order(order)
        .paginate({ cursor: null, numItems: 1 });
      const rest = await findNotes(ctx)
        .order(order)
        .paginate({ cursor: first.continueCursor, numItems: 5 });
      expect([...first.page, ...rest.page].map((r) => r._id)).toEqual(
        order === 'asc' ? ids : [...ids].reverse(),
      );
      expect(rest.isDone).toBe(true);
      const bounded = await findNotes(ctx).order(order).paginate({
        cursor: null,
        endCursor: first.continueCursor,
        numItems: 5,
      });
      expect(bounded.page.map((r) => r._id)).toEqual([first.page[0]?._id]);
    }
    const split = await findNotes(ctx)
      .filter((q) => q.neq(q.field('text'), 'Earlier'))
      .paginate({ cursor: null, numItems: 5, maximumRowsRead: 2 });
    expect(split.page.map((r) => r.text)).toEqual(['First tie']);
    expect(split.pageStatus).toBe('SplitRequired');
    expect(split.splitCursor).toBeTypeOf('string');
    expect(
      (
        await findNotes(ctx).paginate({
          cursor: null,
          numItems: 5,
          maximumBytesRead: 1,
        })
      ).page.map((r) => r.text),
    ).toEqual(['Earlier']);
  });
});

test('partial, range, non-string and missing equality keys keep scan semantics, and nested string paths work', async () => {
  const t = convexTest(equalitySchema, modules);
  await t.run(async (ctx) => {
    for (const key of [undefined, null, 2, 'Phaendar', 'Bridge']) {
      await ctx.db.insert('campaignNotes', {
        ...watchNote,
        key,
        reference: { key: 'Bridge' },
      });
    }
    for (let round = 0; round < 2; round++) {
      expect(
        (
          await ctx.db
            .query('campaignNotes')
            .withIndex('by_release_and_kind_and_key', (q) =>
              q.eq('release', watchNote.release),
            )
            .collect()
        ).map((r) => r.key),
      ).toEqual([undefined, null, 2, 'Bridge', 'Phaendar']);
      for (const key of [undefined, null, 2])
        expect(
          await ctx.db
            .query('campaignNotes')
            .withIndex('by_release_and_kind_and_key', (q) =>
              q
                .eq('release', watchNote.release)
                .eq('kind', watchNote.kind)
                .eq('key', key),
            )
            .unique(),
        ).toMatchObject({ text: watchNote.text });
      expect(
        (
          await ctx.db
            .query('campaignNotes')
            .withIndex('by_release_and_kind_and_key', (q) =>
              q
                .eq('release', watchNote.release)
                .eq('kind', watchNote.kind)
                .gte('key', 'Bridge')
                .lt('key', 'Phaendar'),
            )
            .collect()
        ).map((r) => r.key),
      ).toEqual(['Bridge']);
      expect(
        await ctx.db
          .query('campaignNotes')
          .withIndex('by_reference_key', (q) => q.eq('reference.key', 'Bridge'))
          .collect(),
      ).toHaveLength(5);
    }
  });
});

test('invalid index declarations and equality chains keep their original errors', async () => {
  const t = convexTest(equalitySchema, modules);
  await t.query(async (ctx) => {
    expect(await findNotes(ctx).unique()).toBeNull();
    await expect(
      ctx.db
        .query('campaignNotes')
        // @ts-expect-error Undeclared indexes must still be rejected.
        .withIndex('not_declared')
        .collect(),
    ).rejects.toThrow(
      'Cannot use index "not_declared" for table "campaignNotes" because it is not declared in the schema.',
    );
    await expect(
      ctx.db
        .query('campaignNotes')
        .withIndex('by_release_and_kind_and_key', (q) =>
          // @ts-expect-error Wrong field order is deliberately invalid.
          q.eq('kind', watchNote.kind),
        )
        .collect(),
    ).rejects.toThrow(
      'Incorrect field used in `withIndex`, expected "release", got "kind"',
    );
    await expect(
      ctx.db
        .query('campaignNotes')
        .withIndex('by_release_and_kind_and_key', (q) =>
          // @ts-expect-error Equality after a range is deliberately invalid.
          q.gt('release', '').eq('kind', watchNote.kind),
        )
        .collect(),
    ).rejects.toThrow(
      'Incorrect operator used in `withIndex`, cannot chain `.eq()` after `.gt()`',
    );
  });
});

test('repeated equality queries preserve document, byte and index-range budgets', async () => {
  for (const transactionLimits of [
    { documentsRead: 1 },
    { bytesRead: 1 },
    { databaseQueries: 1 },
  ]) {
    const t = convexTest({
      schema: equalitySchema,
      modules,
      transactionLimits,
    });
    await t.run((ctx) => ctx.db.insert('campaignNotes', watchNote));
    await expect(
      t.query(async (ctx) => {
        await findNotes(ctx).unique();
        await findNotes(ctx).unique();
      }),
    ).rejects.toThrow(
      transactionLimits.documentsRead
        ? 'Scanned too many documents'
        : transactionLimits.bytesRead
          ? 'Read too much data'
          : 'Too many index ranges read',
    );
  }
});

test('a union accepts any of its members and refuses a value matching none with the published message', async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const note = await ctx.db.insert('notes', { text: 'a' });
    return [
      await ctx.db.insert('shapes', { shape: { kind: 'circle', radius: 1 } }),
      await ctx.db.insert('shapes', {
        shape: { kind: 'square', side: 2 },
        tags: ['plain', { id: note }],
      }),
      await ctx.db.insert('shapes', { shape: null }),
    ];
  });
  expect(ids).toHaveLength(3);
  for (const shape of [
    { kind: 'circle', radius: 'wide' },
    { kind: 'square', radius: 1, side: 2 },
    { kind: 'triangle' },
    [],
  ])
    await expect(
      t.run((ctx) =>
        // @ts-expect-error The shape is invalid on purpose.
        ctx.db.insert('shapes', { shape }),
      ),
    ).rejects.toThrow(
      `Validator error: Expected one of object, object, null, got \`${JSON.stringify(shape)}\``,
    );
  await expect(
    t.run(async (ctx) => {
      const shape = await ctx.db.insert('shapes', { shape: null });
      // @ts-expect-error An ID from another table is invalid on purpose.
      await ctx.db.insert('shapes', { shape: null, tags: [{ id: shape }] });
    }),
  ).rejects.toThrow('Validator error: Expected one of string, object');
});

test('a query reads only its own table in creation order, with the transaction’s own inserts and deletes', async () => {
  const t = convexTest(schema, modules);
  const [one, two] = await t.run(async (ctx) => {
    const ids: GenericId<'notes'>[] = [];
    for (const text of ['one', 'two', 'three']) {
      ids.push(await ctx.db.insert('notes', { text }));
      await ctx.db.insert('shapes', { shape: null });
    }
    return ids;
  });
  if (!one || !two) throw new Error('Missing notes');
  const texts = await t.run(async (ctx) => {
    await ctx.db.delete('notes', two);
    await ctx.db.insert('notes', { text: 'four' });
    await ctx.db.patch('notes', one, { text: 'one again' });
    return (await ctx.db.query('notes').collect()).map((row) => row.text);
  });
  expect(texts).toEqual(['one again', 'three', 'four']);
  expect(
    await t.run(async (ctx) => {
      const notes = await ctx.db.query('notes').order('desc').collect();
      const shapes = await ctx.db.query('shapes').collect();
      return { notes: notes.map((row) => row.text), shapes: shapes.length };
    }),
  ).toEqual({ notes: ['four', 'three', 'one again'], shapes: 3 });
});

test('a record inside a union is accepted as the published validator accepts it', async () => {
  const t = convexTest(schema, modules);
  expect(
    await t.run(async (ctx) => {
      await ctx.db.insert('notes', { text: 'a', scores: { might: 2 } });
      await ctx.db.insert('notes', { text: 'b', scores: null });
      return (await ctx.db.query('notes').collect()).map((row) => row.scores);
    }),
  ).toEqual([{ might: 2 }, null]);
});

test('an index range reads its own table in index order, ascending and descending, with the transaction’s own writes', async () => {
  const t = convexTest(schema, modules);
  const removed = await t.run(async (ctx) => {
    for (const rank of [5, 1, 4]) {
      await ctx.db.insert('notes', { text: `rank ${rank}`, rank });
      await ctx.db.insert('shapes', { shape: null });
    }
    return ctx.db.insert('notes', { text: 'rank 3', rank: 3 });
  });
  expect(
    await t.run(async (ctx) => {
      await ctx.db.delete('notes', removed);
      await ctx.db.insert('notes', { text: 'rank 2', rank: 2 });
      const range = (order: 'asc' | 'desc') =>
        ctx.db
          .query('notes')
          .withIndex('by_rank', (q) => q.gte('rank', 2).lt('rank', 5))
          .order(order)
          .collect();
      return {
        asc: (await range('asc')).map((row) => row.rank),
        desc: (await range('desc')).map((row) => row.rank),
      };
    }),
  ).toEqual({ asc: [2, 4], desc: [4, 2] });
});

test('pages of an index read every row once, in order, past other tables', async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const rank of [7, 3, 9, 1, 5]) {
      await ctx.db.insert('notes', { text: `rank ${rank}`, rank });
      await ctx.db.insert('shapes', { shape: null });
    }
  });
  const ranks: (number | undefined)[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page++) {
    const result: {
      page: { rank?: number }[];
      isDone: boolean;
      continueCursor: string;
    } = await t.run((ctx) =>
      ctx.db
        .query('notes')
        .withIndex('by_rank')
        .paginate({ cursor, numItems: 2 }),
    );
    ranks.push(...result.page.map((row) => row.rank));
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  expect(ranks).toEqual([1, 3, 5, 7, 9]);
});

test('each function’s arguments are validated by its own validator on every call', async () => {
  const t = convexTest(appSchema, modules);
  const backfill = (args: Record<string, unknown>) =>
    // @ts-expect-error Some arguments are invalid on purpose.
    t.mutation(internal.organizationMembership.backfill, args);
  const status = (args: Record<string, unknown>) =>
    // @ts-expect-error Some arguments are invalid on purpose.
    t.query(api.cutover.status, args);
  for (let round = 0; round < 2; round++) {
    await expect(status({ cursor: null })).rejects.toThrow(
      'Validator error: Unexpected field `cursor` in object',
    );
    await expect(backfill({ cursor: null })).resolves.toMatchObject({
      isDone: true,
    });
    await expect(status({})).resolves.toBe('canonical');
    await expect(backfill({ cursor: 1 })).rejects.toThrow(
      'Validator error: Expected one of string, null, got `1`',
    );
    await expect(backfill({})).rejects.toThrow(
      'Validator error: Missing required field `cursor` in object',
    );
  }
});

test('reading a document twice gives equal, independent copies that follow later writes', async () => {
  const t = convexTest(schema, modules);
  const id = await t.run((ctx) => ctx.db.insert('notes', { text: 'a' }));
  await t.run(async (ctx) => {
    const first = await ctx.db.get('notes', id);
    if (!first) throw new Error('Missing note');
    first.text = 'changed in memory';
    expect(await ctx.db.get('notes', id)).toMatchObject({ text: 'a' });
    expect((await ctx.db.query('notes').first())?.text).toBe('a');
  });
  await t.run((ctx) => ctx.db.patch('notes', id, { text: 'b' }));
  expect(
    await t.run(async (ctx) => ({
      get: (await ctx.db.get('notes', id))?.text,
      query: (await ctx.db.query('notes').collect()).map((row) => row.text),
    })),
  ).toEqual({ get: 'b', query: ['b'] });
});
