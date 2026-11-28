// @vitest-environment node
// pbl-catalog-digest (PRD #251): for each committed release scope, the store
// import of its selection (`importReleasedScope`: the whole pinned store,
// scoped as the release operator scopes its import) emits the same entries as
// when the committed digest was written, each with the same canonical form.
// It does not prove that an entry is right, and it does not prove a release
// build. A selected key the import does not emit is not refused (the
// operator's import leaves the same keys out); it is simply not listed. A
// record added to the store can change a row whose entry refers to it;
// `catalog-digest-fidelity.test.ts` (a gate-host audit) says whether the
// store holds what an import faithful to the pinned checkouts needs.
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  canonicalJson,
  checkDigest,
  digestPath,
  digestScopes,
  entryHash,
  formatDigest,
  importScopeRows,
  regenerateCommand,
  runCatalogDigest,
  type DigestRow,
  type DigestScope,
} from './catalog-digest';

// Each scope's import runs once, inside its equality test, so the file's
// reported duration (its shard weight, scripts/orchestration/shard_weights.py,
// counts test bodies only) includes it; the later describes' hooks reuse it,
// or import when run alone.
const rows = new Map<DigestScope, readonly DigestRow[]>();
const imports = new Map<DigestScope, Promise<unknown>>();
const load = (scope: DigestScope) => {
  let started = imports.get(scope);
  if (!started) {
    started = importScopeRows(scope).then((emitted) =>
      rows.set(scope, emitted),
    );
    imports.set(scope, started);
  }
  return started;
};
const loadAll = async () => {
  for (const scope of digestScopes) await load(scope);
};
const rowsOf = (scope: DigestScope) => {
  const found = rows.get(scope);
  if (!found) throw new Error(`No import of ${scope}.`);
  return found;
};

describe.each(digestScopes)('the committed %s digest', (scope) => {
  it('equals the store import of the scope’s selection', async () => {
    await load(scope);
    const committed = await readFile(digestPath(scope), 'utf8');
    expect(checkDigest(scope, committed, rowsOf(scope))).toEqual([]);
  }, 120_000);
});

// The refusals, on the party scope's own digest with one line edited.
const scope = 'campaign-party-v1';
const digest = () => formatDigest(scope, rowsOf(scope));
const entryLines = () => digest().split('\n').slice(3, -1);
const first = () => entryLines()[0] ?? '';
const second = () => entryLines()[1] ?? '';
const third = () => entryLines()[2] ?? '';
const keyOf = (line: string) => line.split(' ')[0] ?? '';
const replaceLine = (from: string, to: string) => {
  const text = digest();
  if (!text.includes(`\n${from}\n`)) throw new Error(`No line ${from}.`);
  return text.replace(`\n${from}\n`, to === '' ? '\n' : `\n${to}\n`);
};
const recount = (text: string, by: number) =>
  text.replace(
    /^entries (\d+)$/m,
    (_, count: string) => `entries ${Number(count) + by}`,
  );

/** A committed text with each digest fault the check must name. */
const faults = [
  {
    fault: 'lacks an emitted key',
    text: () => recount(replaceLine(second(), ''), -1),
    names: () => `emitted but not listed (1): ${keyOf(second())}`,
  },
  {
    fault: 'names a key that is not emitted',
    text: () =>
      recount(
        replaceLine(
          first(),
          `${first()}\n${keyOf(first())}-gone ${'0'.repeat(64)}`,
        ),
        1,
      ),
    names: () => `listed but no longer emitted (1): ${keyOf(first())}-gone`,
  },
  {
    fault: 'holds a different hash for a key',
    text: () => replaceLine(second(), `${keyOf(second())} ${'0'.repeat(64)}`),
    names: () => `changed (1): ${keyOf(second())}`,
  },
  {
    fault: 'is unsorted',
    text: () =>
      replaceLine(`${second()}\n${third()}`, `${third()}\n${second()}`),
    names: () =>
      `it is not sorted by key: ${keyOf(second())} follows ${keyOf(third())}`,
  },
  {
    fault: 'lists a key twice',
    text: () => recount(replaceLine(second(), `${second()}\n${second()}`), 1),
    names: () => `it lists ${keyOf(second())} twice`,
  },
] as const;

describe('a committed digest that', () => {
  beforeAll(loadAll, 300_000);

  it.each(faults)(
    '$fault fails the test, naming the key',
    ({ text, names }) => {
      const problems = checkDigest(scope, text(), rowsOf(scope));
      expect(problems).toContain(`  ${names()}`);
      expect(problems.at(-1)).toContain(regenerateCommand);
    },
  );

  it.each(faults)(
    '$fault fails catalog:digest --check, naming the key',
    async ({ text, names }) => {
      const printed: string[] = [];
      const code = await runCatalogDigest(['--check'], {
        rows: (at) => Promise.resolve(rowsOf(at)),
        read: (path) =>
          Promise.resolve(
            path === digestPath(scope)
              ? text()
              : formatDigest('campaign-mvp-v1', rowsOf('campaign-mvp-v1')),
          ),
        write: () => Promise.reject(new Error('--check writes nothing')),
        print: (line) => printed.push(line),
      });
      expect(code).toBe(1);
      expect(printed.join('\n')).toContain(`\n  ${names()}\n`);
    },
  );

  it('lists the first twenty keys of a kind, then the count', () => {
    const edited = entryLines()
      .slice(0, 25)
      .reduce(
        (text, line) =>
          text.replace(`\n${line}\n`, `\n${keyOf(line)} ${'0'.repeat(64)}\n`),
        digest(),
      );
    const [changed] = checkDigest(scope, edited, rowsOf(scope)).filter((line) =>
      line.startsWith('  changed'),
    );
    const keys = entryLines().map(keyOf);
    expect(changed).toBe(
      `  changed (25): ${keys.slice(0, 20).join(', ')}, and 5 more`,
    );
  });
});

// An import that emits a key twice: the party scope's rows with the first
// class schedule increment (`everythingpath/…-<level>`) appended again, as a
// schedule assembled twice would emit it.
const repeatedRows = () => {
  const emitted = rowsOf(scope);
  const increment = emitted.find(({ externalKey }) =>
    /^everythingpath\/.+-\d+$/.test(externalKey),
  );
  if (!increment) throw new Error('No schedule increment.');
  return { emitted: [...emitted, increment], key: increment.externalKey };
};

describe('a store import that emits a key twice', () => {
  beforeAll(loadAll, 300_000);

  it('fails the test, naming the key and its count, before indexing', () => {
    const { emitted, key } = repeatedRows();
    expect(checkDigest(scope, digest(), emitted)).toEqual([
      `The store import of ${scope} emits a key more than once, so it has no digest:`,
      `  emitted more than once (1): ${key} (2 times)`,
    ]);
  });

  it('fails catalog:digest --check, naming the key and its count', async () => {
    const { emitted, key } = repeatedRows();
    const printed: string[] = [];
    const code = await runCatalogDigest(['--check'], {
      rows: (at) => Promise.resolve(at === scope ? emitted : rowsOf(at)),
      read: (path) =>
        Promise.resolve(
          path === digestPath(scope)
            ? digest()
            : formatDigest('campaign-mvp-v1', rowsOf('campaign-mvp-v1')),
        ),
      write: () => Promise.reject(new Error('--check writes nothing')),
      print: (line) => printed.push(line),
    });
    expect(code).toBe(1);
    expect(printed.join('\n')).toContain(
      `  emitted more than once (1): ${key} (2 times)`,
    );
  });

  it('writes no digest with catalog:digest --write', async () => {
    const { emitted, key } = repeatedRows();
    const written: string[] = [];
    await expect(
      runCatalogDigest(['--write'], {
        rows: () => Promise.resolve(emitted),
        read: () => Promise.reject(new Error('--write reads no digest')),
        write: (path) => {
          written.push(path);
          return Promise.resolve();
        },
        print: () => undefined,
      }),
    ).rejects.toThrow(
      `The store import of ${scope} emits 1 key(s) more than once: ${key} (2 times)`,
    );
    expect(written).toEqual([]);
  });
});

describe('catalog:digest --write', () => {
  beforeAll(loadAll, 300_000);

  it('writes each scope’s digest, the same bytes on a second run', async () => {
    const written: Record<string, string>[] = [{}, {}];
    for (const run of written)
      await runCatalogDigest(['--write'], {
        rows: (at) => Promise.resolve(rowsOf(at)),
        read: () => Promise.reject(new Error('--write reads no digest')),
        write: (path, text) => {
          run[path] = text;
          return Promise.resolve();
        },
        print: () => undefined,
      });
    expect(Object.keys(written[0] ?? {})).toEqual(digestScopes.map(digestPath));
    expect(written[1]).toEqual(written[0]);
    for (const at of digestScopes)
      expect(written[0]?.[digestPath(at)]).toBe(formatDigest(at, rowsOf(at)));
  });
});

describe('the canonical form', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(
      canonicalJson({ b: [2, { d: 1, c: undefined, a: 'é' }], a: 1 }),
    ).toBe('{"a":1,"b":[2,{"a":"é","d":1}]}');
    expect(entryHash({ b: 1, a: 2 })).toBe(entryHash({ a: 2, b: 1 }));
  });
});
