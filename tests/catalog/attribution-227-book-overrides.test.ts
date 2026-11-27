// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  attribution227BookOverridesSchema,
  committedAttribution227BookOverrides,
  parseAttribution227BookOverrides,
  type Attribution227BookOverride,
} from '../../scripts/catalog/attribution-227-book-overrides';
import { attribution227MatchesCheckProblems } from '../../scripts/catalog/attribution-227-generation';
import {
  buildAttribution227Matches,
  buildPcgenNameIndex,
  frozenStoredBooksOf,
  frozenStoredLosses,
  matchesPath,
  verifiedFrozenStoredBooks,
  matcherInputPaths,
  serializeAttribution227Matches,
  type StoredBooks,
} from '../../scripts/catalog/attribution-227-matcher';
import {
  committedAttribution227Matches,
  matchedBooks,
  readAttribution227Matches,
  type Attribution227Match,
} from '../../scripts/catalog/legal/attribution-227-matches';
import {
  mapEntry,
  upstreamRecord,
  type PreviewEntry,
} from '../../scripts/catalog/map';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { resolveNotice } from '../../src/lib/catalog/resolve-notice';
import {
  isReviewedNotice,
  reviewedAdmissionSchema,
  type Section15Registry,
} from '../../src/lib/catalog/admission-schema';
import { readPinned } from './pinned-sources';
import { runCapturedProcess } from '../../scripts/catalog/process';

// The reviewed book overrides and the frozen stored-assessment evidence of
// the #227 scripted match (root decision P0 of 2026-11-26, pbl-match-freeze):
// a generation reads neither the legal records nor the Attribution
// Assessments, carries every stored-assessment item forward from the
// committed matches file, and gives an overridden record exactly its
// override's books. Published Magus records and PCGen lists from the pinned
// store.

const pcgenFiles = await Promise.all(
  [
    'roleplaying_game/ultimate_magic/_ultimate_magic.pcc',
    'roleplaying_game/ultimate_magic/um_abilities_class.lst',
    'roleplaying_game/occult_adventures/_occult_adventures.pcc',
    'roleplaying_game/occult_adventures/oa_abilities_class.lst',
  ].map(async (path) => ({
    path,
    text: await readPinned('pcgen', `data/pathfinder/paizo/${path}`),
  })),
);
const index = buildPcgenNameIndex({ files: pcgenFiles });

async function pinnedEntry(
  pack: 'class-abilities' | 'classes',
  file: string,
): Promise<PreviewEntry> {
  const path = `packs/${pack}/${file}`;
  return mapEntry({
    source: {
      repo: 'pf1',
      pack,
      path,
      record: upstreamRecord.parse(parse(await readPinned('pf1', path))),
    },
    kind: pack === 'classes' ? 'class' : 'classFeature',
    resolveKey: (key) => key,
    lookup: new Map(),
    spellClassTags: new Set(),
  });
}
const arcanePool = await pinnedEntry(
  'class-abilities',
  'arcane-pool.mpe3JHJMINddqLWr.yaml',
);
const bonusFeats = await pinnedEntry(
  'class-abilities',
  'bonus-feats-mag.gzBR0qkMdu0KkLV0.yaml',
);
const magus = await pinnedEntry('classes', 'magus.xZLcyrEKYZoJPS2k.yaml');
/** Bonus Feats (MAG)'s 11th-level increment, matched as its attribution owner. */
const increment: PreviewEntry = {
  ...bonusFeats,
  externalKey: 'everythingpath/magus-bonus-feats-11',
  attributionFrom: bonusFeats.externalKey,
};

/** Arcane Pool's frozen stored assessment, as the committed file holds it. */
const frozen: StoredBooks = new Map(
  [...frozenStoredBooksOf(committedAttribution227Matches)].filter(([key]) =>
    [arcanePool.externalKey, bonusFeats.externalKey].includes(key),
  ),
);
/** The legal batch Arcane Pool's frozen stored assessment names. */
const arcanePoolBatch = frozen.get(arcanePool.externalKey)?.batch;
const committedOverride = (key: string) => {
  const found = committedAttribution227BookOverrides.find(
    (row) => row.externalKey === key,
  );
  if (!found) throw new Error(`No committed override for ${key}.`);
  return found;
};
const arcanePoolOverride = committedOverride(arcanePool.externalKey);

function generate(
  overrides: readonly Attribution227BookOverride[],
  {
    stored = frozen,
    entries = [arcanePool, bonusFeats, magus, increment],
  } = {},
) {
  return buildAttribution227Matches({
    entries,
    index,
    stored,
    reviewedRecords: [],
    bookOverrides: overrides,
    inputs: {},
  });
}
const rowOf = (matches: readonly Attribution227Match[], key: string) =>
  matches.find((match) => match.externalKey === key);
const booksOf = (match: Attribution227Match | undefined) =>
  match?.status === 'matched' ? matchedBooks(match) : match?.status;

describe('a reviewed book override', () => {
  it('gives its record exactly its books before the name match, saying so, and keeps the frozen stored assessment', () => {
    // Without the override, the name match reads Occult Adventures' Esoteric
    // ~ Arcane Pool line too.
    expect(
      booksOf(rowOf(generate([]).matches, arcanePool.externalKey)),
    ).toEqual(['PZO1117', 'PZO1131', 'PZO1132']);
    const row = rowOf(
      generate([arcanePoolOverride]).matches,
      arcanePool.externalKey,
    );
    expect(booksOf(row)).toEqual(['PZO1117', 'PZO1131']);
    expect(row).toEqual({
      externalKey: arcanePool.externalKey,
      name: 'Arcane Pool',
      kind: 'classFeature',
      status: 'matched',
      evidence: [
        {
          kind: 'reviewed-override',
          books: ['PZO1117', 'PZO1131'],
          assessment: {
            externalKey: arcanePool.externalKey,
            status: 'confirmed',
            reviewedOn: '2026-11-14',
          },
        },
        {
          kind: 'stored-assessment',
          notices: ['PZO1117', 'PZO1131'],
          batch: arcanePoolBatch,
          comparison: {
            file: 'roleplaying_game/ultimate_magic/um_abilities_class.lst',
            line: 40,
          },
        },
      ],
      classes: [],
    });
  });

  it('is refused for a key the match does not read: no record, one that declares its own book, or one matched as its attribution owner', () => {
    const refusal = (problem: string) =>
      `Reviewed book overrides (attribution-227-book-overrides.json) refused:\n- ${problem}`;
    const at = (externalKey: string) => ({
      ...arcanePoolOverride,
      externalKey,
    });
    expect(() => generate([at('pf1/no-such-record')])).toThrow(
      refusal(
        'pf1/no-such-record: no imported record has this key, so the match reads none.',
      ),
    );
    expect(() => generate([at(magus.externalKey)])).toThrow(
      refusal(
        `${magus.externalKey}: it declares its own book (PZO1117), so the match does not read it.`,
      ),
    );
    expect(() => generate([at(increment.externalKey)])).toThrow(
      refusal(
        `${increment.externalKey}: it takes its attribution owner ${bonusFeats.externalKey}'s books, so the match does not read it.`,
      ),
    );
  });

  it('is refused when its books leave out the frozen stored assessment’s', () => {
    expect(() =>
      generate([{ ...arcanePoolOverride, books: ['PZO1117'] }]),
    ).toThrow(
      `${arcanePool.externalKey}: its frozen stored assessment names PZO1131, which the override leaves out.`,
    );
  });

  it('is refused for a duplicate key, no book, unsorted books or no assessment reference', () => {
    const file = (overrides: unknown[]) => ({ version: 1, overrides });
    const { assessment: _assessment, ...withoutAssessment } =
      arcanePoolOverride;
    const problems = (overrides: unknown[]) => {
      const parsed = attribution227BookOverridesSchema.safeParse(
        file(overrides),
      );
      return parsed.success
        ? []
        : parsed.error.issues.map(({ message }) => message);
    };
    expect(problems([arcanePoolOverride])).toEqual([]);
    expect(problems([arcanePoolOverride, arcanePoolOverride])).toEqual([
      `Duplicate override key ${arcanePool.externalKey}.`,
    ]);
    expect(problems([{ ...arcanePoolOverride, books: [] }])).not.toEqual([]);
    expect(
      problems([{ ...arcanePoolOverride, books: ['PZO1131', 'PZO1117'] }]),
    ).toEqual(['Books must be sorted, each once.']);
    expect(problems([withoutAssessment])).not.toEqual([]);
    expect(
      problems([
        {
          ...arcanePoolOverride,
          assessment: {
            ...arcanePoolOverride.assessment,
            status: 'unresolved',
          },
        },
      ]),
    ).not.toEqual([]);
    expect(() =>
      parseAttribution227BookOverrides(
        file([arcanePoolOverride, arcanePoolOverride]),
      ),
    ).toThrow(`Duplicate override key ${arcanePool.externalKey}.`);
    // The matcher refuses a repeated key too, whatever passes it the rows.
    expect(() => generate([arcanePoolOverride, arcanePoolOverride])).toThrow(
      `${arcanePool.externalKey}: listed twice.`,
    );
  });
});

describe('the frozen stored-assessment evidence', () => {
  it('is carried forward exactly by a generation', () => {
    const { matches } = generate(committedAttribution227BookOverrides);
    expect(frozenStoredBooksOf({ matches })).toEqual(frozen);
    expect(frozenStoredLosses(frozen, matches)).toEqual([]);
  });

  it('refuses a generation that would drop a frozen item', () => {
    expect(() => generate([], { entries: [bonusFeats, magus] })).toThrow(
      `The generation would lose frozen stored-assessment evidence (pbl-match-freeze):\n- ${arcanePool.externalKey}: its frozen stored assessment (${arcanePoolBatch}) would be dropped.`,
    );
  });

  it('finds a frozen item a generation altered', () => {
    const { matches } = generate([]);
    const altered = matches.map((match) =>
      match.externalKey === arcanePool.externalKey && match.status === 'matched'
        ? {
            ...match,
            evidence: match.evidence.map((item) =>
              item.kind === 'stored-assessment'
                ? { ...item, notices: ['PZO1117'] as const }
                : item,
            ),
          }
        : match,
    ) as Attribution227Match[];
    expect(frozenStoredLosses(frozen, altered)).toEqual([
      `${arcanePool.externalKey}: its frozen stored assessment (${arcanePoolBatch}) would be altered.`,
    ]);
  });

  it('is bound in the committed file, beside inputs that name no legal record and no assessment', () => {
    const inputs = Object.keys(committedAttribution227Matches.binding.inputs);
    expect(inputs).toContain(
      'scripts/catalog/legal/attribution-227-matches.json#stored-assessment',
    );
    expect(inputs).toEqual(
      expect.arrayContaining([
        'scripts/catalog/attribution-227-book-overrides.json',
        'scripts/catalog/attribution-227-book-overrides.ts',
      ]),
    );
    // A notice edit never stales the match (fix r1): the register and its
    // resolver are not matcher inputs.
    for (const path of [
      'src/lib/catalog/data/section15-registry.json',
      'src/lib/catalog/resolve-notice.ts',
    ]) {
      expect(inputs).not.toContain(path);
      expect(matcherInputPaths).not.toContain(path);
    }
    for (const path of [...matcherInputPaths, ...inputs])
      expect(path).not.toMatch(
        /attribution-assessments|attribution-evidence|legal\/(?!attribution-227-matches\.json)/,
      );
  });
});

// Fix r2 and r3 (the reviewers' probes): a committed file of the command's
// root that parses as JSON but from which the frozen items cannot be read
// intact (an item edited, a row dropped, an item duplicated, a sole book
// removed) stops the command before anything is imported or written, naming
// the one recovery (fix r4: the executing checkout's own file failing to
// parse is outside this, failing at the static import).
describe('a committed file whose frozen items cannot be read intact', () => {
  const committedText = readFileSync(matchesPath, 'utf8');
  type StoredFile = {
    matches: {
      externalKey: string;
      name: string;
      evidence?: { kind: string; notices?: string[] }[];
    }[];
  };
  /** The committed file with one edit, as a hand edit or a bad merge leaves it. */
  const edited = (edit: (file: StoredFile) => void) => {
    const file = JSON.parse(committedText) as StoredFile;
    edit(file);
    return `${JSON.stringify(file, null, 2)}\n`;
  };
  const frozenItem = (file: StoredFile, books: (count: number) => boolean) => {
    for (const match of file.matches) {
      const at = (match.evidence ?? []).findIndex(
        ({ kind, notices = [] }) =>
          kind === 'stored-assessment' && books(notices.length),
      );
      const item = match.evidence?.[at];
      if (match.evidence && item?.notices)
        return { evidence: match.evidence, at, item, notices: item.notices };
    }
    throw new Error('No such frozen item.');
  };
  const probes = {
    // Fix r2: one book removed from a two-book item.
    'a book removed from a two-book item': edited((file) => {
      frozenItem(file, (count) => count > 1).notices.pop();
    }),
    // Fix r3: the reviewers' three probes.
    'a dropped row (Diverse Obedience)': edited((file) => {
      const at = file.matches.findIndex(
        ({ name }) => name === 'Diverse Obedience',
      );
      if (at < 0) throw new Error('No Diverse Obedience row.');
      file.matches.splice(at, 1);
    }),
    'a duplicated frozen item': edited((file) => {
      const { evidence, at, item } = frozenItem(file, () => true);
      evidence.splice(at, 0, { ...item });
    }),
    'a sole book removed': edited((file) => {
      frozenItem(file, (count) => count === 1).notices.pop();
    }),
    // Fix r4: a file of the command's root that is not JSON.
    'a file that is not JSON (an unresolved merge marker)': `<<<<<<< HEAD\n${committedText}`,
  };
  const guidance =
    /scripts\/catalog\/legal\/attribution-227-matches\.json cannot be read intact for its frozen stored-assessment evidence: [^]*\nNothing was written\. A frozen item cannot be regenerated: restore the file from the last good commit \(git checkout <commit> -- scripts\/catalog\/legal\/attribution-227-matches\.json\)/;

  it('is refused by the digest check when an item was edited, the committed file read as it is', () => {
    expect(
      verifiedFrozenStoredBooks(committedAttribution227Matches).size,
    ).toBeGreaterThan(2000);
    const document = readAttribution227Matches(
      JSON.parse(probes['a book removed from a two-book item']),
    );
    expect(() => verifiedFrozenStoredBooks(document)).toThrow(
      /^its frozen stored-assessment evidence hashes to sha256:[a-f0-9]{64}, not the sha256:[a-f0-9]{64} its binding records/,
    );
  });

  it.each(
    Object.keys(probes).flatMap((probe) =>
      ['--write', '--check'].map((mode) => [probe, mode] as const),
    ),
  )(
    '%s stops %s before anything is written, ending with the restore guidance, never suggesting --write',
    (probe, mode) => {
      const text = probes[probe as keyof typeof probes];
      const root = mkdtempSync(join(tmpdir(), 'frozen-edit-'));
      const target = join(root, matchesPath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
      const result = runCapturedProcess({
        command: process.execPath,
        args: [
          '--import',
          fileURLToPath(import.meta.resolve('tsx')),
          resolve('scripts/catalog-attribution-227-matches.ts'),
          mode,
        ],
        cwd: root,
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(guidance);
      expect(result.stderr).not.toContain('run --write');
      expect(readFileSync(target, 'utf8')).toBe(text);
    },
    120_000,
  );
});

describe('catalog:attribution-227-matches --check', () => {
  it('fails when the committed matches differ from a regeneration', () => {
    const fresh = generate(committedAttribution227BookOverrides);
    const freshRun = {
      document: fresh,
      inputs: fresh.binding.inputs,
      text: serializeAttribution227Matches(fresh),
      counts: 'fixture',
    };
    expect(
      attribution227MatchesCheckProblems({
        committedText: freshRun.text,
        fresh: freshRun,
      }),
    ).toEqual([]);
    // Committed before the override: Arcane Pool still on the name match.
    const before = generate([]);
    expect(
      attribution227MatchesCheckProblems({
        committedText: serializeAttribution227Matches(before),
        fresh: freshRun,
      }),
    ).toEqual([
      `${bonusFeats.externalKey}: its committed match differs from a fresh one.`,
      `${arcanePool.externalKey}: its committed match differs from a fresh one.`,
      'scripts/catalog/legal/attribution-227-matches.json differs from a fresh generation (fixture); run --write.',
    ]);
  });
});

/** Each override book the register resolves to no record, reviewed or not, as `<key>: <code>`. */
const unresolvedBooks = (
  overrides: readonly Attribution227BookOverride[],
  registry: Section15Registry,
) =>
  overrides.flatMap(({ externalKey, books }) =>
    books
      .filter((code) => !resolveNotice({ registry, code }))
      .map((code) => `${externalKey}: ${code}`),
  );

/**
 * The controls' own register: one reviewed record, one unreviewed record and
 * an alias, so they never depend on which notices the committed register
 * holds or has reviewed (fix r2: the owner will supply every missing notice).
 */
const notice = (
  reviewStatus: 'reviewed' | 'unreviewed',
  aliases: string[] = [],
) => ({
  title: 'Fixture book',
  notice: 'Fixture book. Copyright 2026, Fixture Publishing.',
  // A reviewed record names a reviewed source, as the register requires.
  checkedAgainst: reviewStatus === 'reviewed' ? 'prd' : 'unreviewed',
  checkedOn: '2026-11-26',
  aliases,
  reviewStatus,
  provenance: ['Fixture provenance.'],
});
/** Parsed with the register's own schema, so it is a register the gate could read (fix r3). */
const fixtureRegistry: Section15Registry =
  reviewedAdmissionSchema.shape.registry.parse({
    'FIXTURE-REVIEWED': notice('reviewed', ['FIXTURE-ALIAS']),
    'FIXTURE-UNREVIEWED': notice('unreviewed'),
  });

describe('the committed book overrides', () => {
  // Fix r1: the register is no input of the match or of its binding, so that
  // every override book resolves to a Section 15 Registry record is held
  // here, over the committed overrides and the committed register: a valid
  // notice edit (with the verification projection regenerated, as every
  // register edit requires) needs no regeneration of the match.
  it('name only books the committed register resolves to a record, reviewed or not', () => {
    expect(
      unresolvedBooks(committedAttribution227BookOverrides, section15Registry),
    ).toEqual([]);
  });

  it('are checked by a lookup that accepts a reviewed, an unreviewed or an aliased record and names a code with none', () => {
    expect(isReviewedNotice(fixtureRegistry['FIXTURE-REVIEWED'])).toBe(true);
    expect(isReviewedNotice(fixtureRegistry['FIXTURE-UNREVIEWED'])).toBe(false);
    expect(
      unresolvedBooks(
        [
          {
            ...arcanePoolOverride,
            books: [
              'FIXTURE-ALIAS',
              'FIXTURE-MISSING',
              'FIXTURE-REVIEWED',
              'FIXTURE-UNREVIEWED',
            ],
          },
        ],
        fixtureRegistry,
      ),
    ).toEqual([`${arcanePool.externalKey}: FIXTURE-MISSING`]);
  });

  // Their books are their confirmed assessments' while those still exist
  // (pbl-match-freeze; the assessments go with pbl-delete-attribution).
  it('copy the books of the confirmed assessments they name', () => {
    const assessments = new Map(
      (
        JSON.parse(
          readFileSync(
            'src/lib/catalog/data/attribution-assessments.json',
            'utf8',
          ),
        ) as {
          externalKey: string;
          status: string;
          reviewedOn: string;
          requiredNotices: string[];
        }[]
      ).map((item) => [item.externalKey, item]),
    );
    expect(
      committedAttribution227BookOverrides.map(
        ({ externalKey }) => externalKey,
      ),
    ).toEqual(['pf1/gzBR0qkMdu0KkLV0', 'pf1/mpe3JHJMINddqLWr']);
    for (const {
      externalKey,
      books,
      assessment,
    } of committedAttribution227BookOverrides) {
      const named = assessments.get(assessment.externalKey);
      expect(assessment.externalKey).toBe(externalKey);
      expect(named).toMatchObject({
        status: 'confirmed',
        reviewedOn: assessment.reviewedOn,
      });
      expect([...new Set(named?.requiredNotices)].sort()).toEqual(books);
    }
  });
});
