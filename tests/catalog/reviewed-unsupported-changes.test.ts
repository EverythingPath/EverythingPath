// @vitest-environment node
// stats-d2 fix r2: a `reviewedUnsupportedChanges` row withholds one exact raw
// change of the record it names. When the upstream change moves or goes, the
// row would silently stop matching and the change would map as an
// unconditional Modifier (Dance of the Blades' formula 10 → 20 gave +20 with
// `unsupported: []`). A row that matches no raw change of its record, or
// names a record the verified pinned corpus lacks, now fails the import,
// naming the row. Every case runs on the real pinned records, mutated in
// memory.
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { importCatalog } from '../../scripts/catalog/import';
import { mapEntry } from '../../scripts/catalog/map';
import {
  reviewedUnsupportedChanges,
  staleReviewedUnsupportedChanges,
  type ReviewedUnsupportedChange,
} from '../../scripts/catalog/racial-trait-rules';
import { upstreamRecord } from '../../scripts/catalog/records';
import reviewedRemaps from '../../scripts/catalog/reviewed-remaps.json';
import {
  materializePinnedTree,
  pinnedStore,
  readPinned,
} from './pinned-sources';

type Change = Record<string, unknown>;
type Located = { repo: 'pf1' | 'pf1-content'; path: string };

/** Each row's record in the pinned store, by its upstream key. */
async function locate(externalKey: string): Promise<Located> {
  const [repo, id] = externalKey.split('/') as [Located['repo'], string];
  const top = repo === 'pf1' ? 'packs' : 'src';
  const files = await readdir(join(pinnedStore, repo, top), {
    recursive: true,
  });
  const matches = files.filter(
    (file) => file.endsWith(`.${id}.yaml`) || file.endsWith(`_${id}.yaml`),
  );
  if (matches.length !== 1)
    throw new Error(`Expected one pinned file for ${externalKey}.`);
  return { repo, path: `${top}/${matches[0]}` };
}

const keys = [
  ...new Set(reviewedUnsupportedChanges.map((row) => row.externalKey)),
];
const pinned = new Map(
  await Promise.all(
    keys.map(async (key) => {
      const at = await locate(key);
      const record = upstreamRecord.parse(
        parse(await readPinned(at.repo, at.path)),
      );
      return [key, { ...at, record }] as const;
    }),
  ),
);
const rawChanges = (key: string): Change[] =>
  structuredClone((pinned.get(key)?.record.system.changes ?? []) as Change[]);

/** The pinned corpus as the check reads it, with one record's changes edited. */
function corpusWith(edit?: {
  key: string;
  changes: (changes: Change[]) => Change[] | undefined;
}) {
  return (key: string) => {
    if (!pinned.has(key)) return undefined;
    const changes = rawChanges(key);
    return edit?.key === key ? edit.changes(changes) : changes;
  };
}

/** The raw change a row withholds, located in its record's changes. */
const indexOf = (row: ReviewedUnsupportedChange, changes: Change[]) =>
  changes.findIndex(
    (change) =>
      change.target === row.change.target &&
      change.formula === row.change.formula &&
      change.type === row.change.type,
  );

const label = (row: ReviewedUnsupportedChange) =>
  `${row.externalKey} ${row.change.target} ${row.change.formula} (${row.change.type})`;

/** Each way the upstream record can move away from a row. */
const mutations = {
  'changed formula': (change: Change) => ({
    ...change,
    formula: `${String(change.formula)} + 10`,
  }),
  'changed target': (change: Change) => ({
    ...change,
    target: change.target === 'landSpeed' ? 'climbSpeed' : 'landSpeed',
  }),
  'changed type': (change: Change) => ({
    ...change,
    type: change.type === 'untyped' ? 'enh' : 'untyped',
  }),
} as const;

describe('reviewed unsupported changes on the pinned records', () => {
  it('lists the Cybernetic Leg among the rows: one item is one leg', () => {
    expect(keys).toContain('pf1/oWdvwcpord1iUbEf');
  });

  it('every row matches a raw change of the record it names', () => {
    expect(
      staleReviewedUnsupportedChanges({
        changesOf: corpusWith(),
        wholeCorpus: true,
      }),
    ).toEqual([]);
  });

  describe.each(reviewedUnsupportedChanges.map((row) => [label(row), row]))(
    '%s',
    (_, row) => {
      it.each(Object.entries(mutations))(
        'is reported stale with a %s',
        (_mutation, mutate) => {
          const stale = staleReviewedUnsupportedChanges({
            changesOf: corpusWith({
              key: row.externalKey,
              changes: (changes) => {
                const index = indexOf(row, changes);
                expect(index).toBeGreaterThanOrEqual(0);
                return changes.map((change, at) =>
                  at === index ? mutate(change) : change,
                );
              },
            }),
            wholeCorpus: true,
          });
          expect(stale).toEqual([
            {
              row,
              problem: expect.stringContaining(
                `has no raw change ${row.change.target} ${row.change.formula} (${row.change.type})`,
              ),
            },
          ]);
        },
      );

      it('is reported stale when the change is removed', () => {
        const stale = staleReviewedUnsupportedChanges({
          changesOf: corpusWith({
            key: row.externalKey,
            changes: (changes) =>
              changes.filter((_change, at) => at !== indexOf(row, changes)),
          }),
          wholeCorpus: true,
        });
        expect(stale).toEqual([
          { row, problem: expect.stringContaining('has no raw change') },
        ]);
      });

      it('is reported stale when the record is removed from the verified corpus', () => {
        const stale = staleReviewedUnsupportedChanges({
          changesOf: corpusWith({
            key: row.externalKey,
            changes: () => undefined,
          }),
          wholeCorpus: true,
        });
        // Every row naming the removed record is stale: Ghoran has two.
        expect(stale).toEqual(
          reviewedUnsupportedChanges
            .filter(({ externalKey }) => externalKey === row.externalKey)
            .map((named) => ({
              row: named,
              problem: `The pinned corpus has no record ${row.externalKey}.`,
            })),
        );
      });
    },
  );

  it('cannot tell a removed record from one a reduced tree leaves out', () => {
    // A tree that is not the verified corpus at the pins (a test tree, or
    // --allow-unverified-checkouts) reports only rows whose record it has.
    expect(
      staleReviewedUnsupportedChanges({
        changesOf: () => undefined,
        wholeCorpus: false,
      }),
    ).toEqual([]);
  });
});

describe('mapping a record whose reviewed unsupported change moved', () => {
  const map = (key: string, changes: Change[]) => {
    const { repo, path, record } = pinned.get(key)!;
    return mapEntry({
      source: {
        repo,
        pack: path.split('/')[1]!,
        path,
        record: { ...record, system: { ...record.system, changes } },
      },
      kind: 'classFeature',
      resolveKey: (externalKey) => externalKey,
      lookup: new Map(),
      spellClassTags: new Set(),
    });
  };
  const withFormula = (key: string, from: string, to: string) =>
    rawChanges(key).map((change) =>
      change.target === 'landSpeed' && change.formula === from
        ? { ...change, formula: to }
        : change,
    );

  it('refuses Dance of the Blades at +20 instead of mapping it unconditionally', () => {
    expect(() =>
      map(
        'pf1/3MKN05JEqEYrNx7Q',
        withFormula('pf1/3MKN05JEqEYrNx7Q', '10', '20'),
      ),
    ).toThrow(
      'The reviewed unsupported change no longer matches its record: pf1/3MKN05JEqEYrNx7Q has no raw change landSpeed 10 (base); its landSpeed changes are 20 (base).',
    );
  });

  it('refuses Travel as One at −20', () => {
    expect(() =>
      map(
        'pf1/ebivkqVXZECItLSF',
        withFormula('pf1/ebivkqVXZECItLSF', '-10', '-20'),
      ),
    ).toThrow(/pf1\/ebivkqVXZECItLSF has no raw change landSpeed -10 \(base\)/);
  });

  it('still withholds the pinned change with its reason', () => {
    const entry = map(
      'pf1/3MKN05JEqEYrNx7Q',
      rawChanges('pf1/3MKN05JEqEYrNx7Q'),
    );
    expect(entry.modifiers).toEqual([]);
    expect(entry.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'changes',
        value: { target: 'landSpeed', formula: '10', type: 'base' },
      }),
    );
  });
});

const dance =
  'pf1/packs/class-abilities/dance-of-the-blades.3MKN05JEqEYrNx7Q.yaml';
const tree = await materializePinnedTree([dance]);
afterAll(() => tree.dispose());

describe('the import refuses a stale row', () => {
  const run = (wholeCorpus = false) =>
    importCatalog({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
      remaps: reviewedRemaps,
      wholeCorpus,
    });

  it('imports the pinned record, withheld, from a reduced tree', async () => {
    const artifact = await run();
    const entry = artifact.catalog.entries.find(
      (row) => row.externalKey === 'pf1/3MKN05JEqEYrNx7Q',
    );
    expect(entry?.modifiers).toEqual([]);
  });

  it('fails naming each row whose record a verified corpus lacks', async () => {
    // The reduced tree stands in for a verified corpus that lost the other
    // rows' records: each is named, and Dance of the Blades is not.
    const failure = run(true);
    await expect(failure).rejects.toThrow(
      /^The reviewed unsupported change no longer matches its record: The pinned corpus has no record pf1\/fX9F2amW2BcYoHwb\./,
    );
    await expect(failure).rejects.not.toThrow(/3MKN05JEqEYrNx7Q/);
  });

  it('fails when the record in the tree moved', async () => {
    const text = await readPinned('pf1', dance.slice('pf1/'.length));
    const moved = text.replace(
      /formula: '10'\n(\s+)target: landSpeed/,
      "formula: '20'\n$1target: landSpeed",
    );
    expect(moved).not.toBe(text);
    const path = join(tree.systemPath, dance.slice('pf1/'.length));
    await writeFile(path, moved);
    try {
      await expect(run()).rejects.toThrow(
        /pf1\/3MKN05JEqEYrNx7Q has no raw change landSpeed 10 \(base\); its landSpeed changes are 20 \(base\)\./,
      );
    } finally {
      await writeFile(path, text);
    }
  });
});
