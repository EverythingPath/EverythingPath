// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { committedAttribution227 } from '../../scripts/catalog/legal/attribution-227';
import { committedAttribution227Matches } from '../../scripts/catalog/legal/attribution-227-matches';
import { committedSection15Confirmations } from '../../scripts/catalog/legal/section15-confirmations';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { pcgenNoticeBooks } from '../../scripts/catalog/pcgen-books';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { readPinned } from './pinned-sources';

// notice-ownline-1 (#328's number, the lowest owning issue of its rows):
// ten books outside the #716 crosswalk whose pinned PCGen OGL.txt carries
// their own Section 15 line (owner decision of 2026-10-31) join the PCGen
// notice books, Bestiary 6 with its automatic code and nine Adventure Path
// volumes with reviewed ones, each matched through an own-line alias. The
// record step checked their confirmations on a captured review (RECORD_RUN),
// which made their pcgen: records reviewed. The fixture is every row of the
// full-corpus --pcgen preview held only on one of these books before the
// batch, the 13 class features a Bestiary 6 line now reaches, and their
// reference closure (tests/fixtures/notice-ownline-328).
const RECORD_RUN =
  't3-review-6ba04bb6164d511d5e55eee49e376e09797001a9dfb6b75687eaa3cc02a033b2';
const AP = 'adventure_path';
const BOOKS = {
  PZO1137: {
    ogl: 'roleplaying_game/bestiary_6/OGL.txt',
    line: 76,
    title: 'Bestiary 6',
    titleFrom: 'book',
    opening: 'Pathfinder Roleplaying Game Bestiary 6 Copyright 2017, Paizo',
    admits: 46,
  },
  PZO90115: {
    ogl: `${AP}/ironfang_invasion/ap115/OGL.txt`,
    line: 57,
    title: 'Pathfinder Adventure Path #115: Trail of the Hunted',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder Adventure Path #115: Trail of the Hunted',
    admits: 13,
  },
  PZO9061: {
    ogl: `${AP}/shattered_star/ap61/OGL.txt`,
    line: 57,
    title: 'Pathfinder Adventure Path #61: Shards of Sin',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder Adventure Path #61: Shards of Sin Copyright',
    admits: 15,
  },
  PZO9055: {
    ogl: `${AP}/skull_and_shackles/ap55/OGL.txt`,
    line: 42,
    title: 'Pathfinder Adventure Path #55: The Wormwood Mutiny',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder Adventure Path #55: The Wormwood Mutiny Copyright',
    admits: 8,
  },
  PZO90117: {
    ogl: `${AP}/ironfang_invasion/ap117/OGL.txt`,
    line: 51,
    title: 'Pathfinder Adventure Path #117: Assault on Longshadow',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder Adventure Path #117: Assault on Longshadow ©',
    admits: 3,
  },
  PZO9008: {
    ogl: `${AP}/curse_of_the_crimson_throne/ap8/OGL.txt`,
    line: 39,
    title: 'Pathfinder 8: Seven Days to the Grave',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder 8: Seven Days to the Grave. Copyright',
    admits: 1,
  },
  PZO9009: {
    ogl: `${AP}/curse_of_the_crimson_throne/ap9/OGL.txt`,
    line: 45,
    title: 'Pathfinder 9: Escape from Old Korvosa',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder 9: Escape from Old Korvosa. Copyright 2008,',
    admits: 1,
  },
  PZO9010: {
    ogl: `${AP}/curse_of_the_crimson_throne/ap10/OGL.txt`,
    line: 39,
    title: 'Pathfinder 10: A History of Ashes',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder 10: A History of Ashes. Copyright 2008,',
    admits: 2,
  },
  PZO9016: {
    ogl: `${AP}/second_darkness/ap16/OGL.txt`,
    line: 39,
    title: 'Pathfinder 16: Endless Night',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder 16: Endless Night. Copyright 2008, Paizo Publishing,',
    admits: 1,
  },
  PZO9017: {
    ogl: `${AP}/second_darkness/ap17/OGL.txt`,
    line: 39,
    title: 'Pathfinder 17: A Memory of Darkness',
    titleFrom: 'own-line-alias',
    opening: 'Pathfinder 17: A Memory of Darkness. Copyright 2008,',
    admits: 1,
  },
} as const;
type Code = keyof typeof BOOKS;
const CODES = Object.keys(BOOKS) as Code[];

/**
 * Domains, subdomains and domain powers matched as admitted before this
 * batch, which Bestiary 6's reprints (b6_abilities_class.lst, "Updated
 * Version") give a PZO1137 line:
 * held on it while its confirmation is drafted, admitted again now it is checked.
 */
const BESTIARY_6_DOMAIN_POWERS = [
  'pf1-content/NwLUXUYORmEscErp',
  'pf1-content/cUS8Xjl7zVLX9zWF',
  'pf1/1BuSzuaMzcrxfwmn',
  'pf1/DrBBxD60RS1ldNvf',
  'pf1/JVavHI8hzZpladva',
  'pf1/KZ4dIav1Qcto78xO',
  'pf1/QJi75fvhCPwa2e5U',
  'pf1/SdVTnEgSeSG85b5O',
  'pf1/jYOMxBxMHT6MXajA',
  'pf1/kpad9nBQ6qr4uOCe',
  'pf1/rBrwiirykAPnPfkQ',
  'pf1/rIRjSUk4RBDH0whA',
  'pf1/xK4Vdp171RVcOSIB',
];
/**
 * Munavri's racial traits, held on PZO1137 and on PZO9284 and PZO9289 before
 * the batch. notice-alias-1, which landed first, aliased those two books to
 * their reviewed lines, so the traits are held on PZO1137 alone while it is
 * drafted and admitted once it is checked.
 */
const MUNAVRI_TRAITS = [
  'pf1-content/D8AVfhkKN6J30OJx',
  'pf1-content/GyJ1zrZi3yP17xN6',
  'pf1-content/PpI7Dg0KK2Bwxqr5',
  'pf1-content/bVVtVOY7So7gOXv8',
  'pf1-content/pzi5Wf9eBphxIKM5',
  'pf1-content/u2AvxtrlGvkCzmI4',
  'pf1-content/znm32ETypTz8Ui4D',
];
/**
 * Munavri and its ability-score row, held only on PZO1137: the promotion
 * review found them dependent omissions on the traits, which notice-alias-1
 * since admits, so they are admitted with the batch.
 */
const MUNAVRI = [
  'local/race-ability-scores/pf1/jhh6z3NZlImHjZ8H',
  'pf1/jhh6z3NZlImHjZ8H',
];
/**
 * Rows held only on a batch book that are omitted once it is checked: each
 * depends on a row held on a book outside the batch (Change Shape's on
 * PZO9439), on a failing row (Yaddithian's, `CORPUS_FAILURES`) or on such a
 * row.
 */
const DEPENDENT_OMISSIONS = [
  'local/race-ability-scores/pf1/sXIQ3MFLInN9SF7m',
  'pf1-content/S2fAbQom6ogn4gh9',
  'pf1-content/nzckjsqsXTEX8o8E',
  'pf1/sXIQ3MFLInN9SF7m',
];

/**
 * One of the full corpus's failures before and after the batch, in the
 * closure through Yaddithian: its Defensive Abilities trait keeps an unresolved
 * link.
 */
const CORPUS_FAILURES = ['pf1-content/cSe1S79oR6gJI9bF'];

const fixture = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    resources: z.array(importedCatalogEntrySchema),
  })
  .parse(
    JSON.parse(
      readFileSync('tests/fixtures/notice-ownline-328/entries.json', 'utf8'),
    ),
  ) as unknown as { entries: PreviewEntry[]; resources: PreviewEntry[] };

/** A release artifact over the fixture, every upstream record in scope. */
function artifactOf({ entries, resources }: typeof fixture) {
  const rows = [...entries, ...resources];
  const upstream = [...new Set(rows.map((entry) => entry.upstreamKey))];
  return {
    curation: { missing: [], unresolvedMechanics: [] },
    catalog: { entries, resources, remaps: [] },
    comparison: {
      coverageComplete: true,
      summary: {
        upstreamRecords: upstream.length,
        admitted: upstream.length,
        excluded: 0,
        unassigned: 0,
        byKind: {},
      },
      packs: [],
      records: upstream.map((upstreamKey) => ({
        repo: 'pf1',
        pack: 'fixture',
        path: `${upstreamKey}.yaml`,
        externalKey: upstreamKey,
        name: upstreamKey,
        status: 'admitted' as const,
        reason: 'In scope',
      })),
    },
  };
}
/**
 * The release gate under the #227 rule over the fixture: committed (the
 * confirmations checked), or with the batch's confirmations drafted in memory
 * and their pcgen: records unreviewed, as before the record step.
 */
function gate({ drafted }: { drafted: boolean }) {
  const registry = { ...reviewedAdmission.registry };
  const confirmations = committedSection15Confirmations.map((item) =>
    drafted && item.code in BOOKS
      ? { ...item, review: { status: 'drafted' as const } }
      : item,
  );
  if (drafted)
    for (const code of CODES)
      registry[`pcgen:${code}`] = {
        ...registry[`pcgen:${code}`]!,
        reviewStatus: 'unreviewed',
      };
  return assessCatalogAdmission({
    artifact: artifactOf(fixture),
    ...reviewedAdmission,
    registry,
    attributionPath: {
      kind: 'declared-book',
      rule: committedAttribution227,
      matches: committedAttribution227Matches,
    },
    section15: { confirmations },
  });
}
const missingOf = (reason: string) =>
  [...reason.matchAll(/lacks reviewed notices: ([^.]*)\./g)].flatMap(
    ([, codes]) => codes!.split(', '),
  );
const keysOf = (rows: readonly { externalKey: string }[]) =>
  rows.map(({ externalKey }) => externalKey).sort();

describe('notice-ownline-1: ten books on their own Section 15 line', () => {
  it('are PCGen notice books, each tied to its folder through one .pcc', () => {
    const rows = pcgenNoticeBooks.books.filter(({ code }) => code.id in BOOKS);
    expect(rows.map(({ code }) => code.id).sort()).toEqual([...CODES].sort());
    for (const { code, packs, title } of rows) {
      const book = BOOKS[code.id as Code];
      const folder = book.ogl.replace(/\/OGL\.txt$/, '');
      expect(packs, code.id).toEqual([{ folder, pcc: title.file }]);
      // Bestiary 6's code matches by name; the volumes' are reviewed, drafted
      // as PZO9067's is: the record step checks the confirmation.
      expect(code.match, code.id).toBe(
        code.id === 'PZO1137' ? 'automatic' : 'reviewed',
      );
      if (code.match === 'reviewed')
        expect(code.review.status, code.id).toBe('drafted');
    }
    // Tied without the space-named Bestiary 6 for Players .pcc.
    expect(rows.find(({ code }) => code.id === 'PZO1137')?.title.file).toBe(
      'roleplaying_game/bestiary_6/_bestiary_6.pcc',
    );
  });

  it('match each book on its own line in the pinned OGL.txt, checked by the record step, with a reviewed pcgen: record', async () => {
    for (const code of CODES) {
      const book = BOOKS[code];
      const confirmation = committedSection15Confirmations.find(
        (item) => item.code === code,
      );
      expect(confirmation, code).toMatchObject({
        status: 'matched',
        ownLine: {
          line: book.line,
          title: book.title,
          titleFrom: book.titleFrom,
        },
        pcgen: { path: book.ogl },
        review: { status: 'checked', receipt: RECORD_RUN },
      });
      const text = await readPinned(
        'pcgen',
        `data/pathfinder/paizo/${book.ogl}`,
      );
      expect(createHash('sha256').update(text).digest('hex'), code).toBe(
        confirmation?.status === 'matched' ? confirmation.pcgen.sha256 : '',
      );
      // The line's first eight words; the rest of the notice is not copied here.
      const words = text
        .replace(/^﻿/, '')
        .split('\n')
        [book.line - 1]!.split(' ');
      expect(words.slice(0, 8).join(' '), code).toBe(book.opening);
      expect(reviewedAdmission.registry[`pcgen:${code}`], code).toMatchObject({
        checkedAgainst: 'pcgen',
        reviewStatus: 'reviewed',
      });
    }
  });

  it('held every fixture row on a batch book while the confirmations were drafted (in memory)', () => {
    const now = gate({ drafted: true });
    expect(keysOf(now.failures)).toEqual(CORPUS_FAILURES);
    const batchHeld = now.held.filter(({ reason }) =>
      missingOf(reason).some((code) => code in BOOKS),
    );
    // 97 held only on a batch book, Munavri's seven traits, 13 class
    // features on PZO1137, and the closure's rows held on outside books as
    // well.
    const onlyBatch = batchHeld.filter(({ reason }) =>
      missingOf(reason).every((code) => code in BOOKS),
    );
    expect(onlyBatch).toHaveLength(
      97 + MUNAVRI_TRAITS.length + BESTIARY_6_DOMAIN_POWERS.length,
    );
    for (const key of [...BESTIARY_6_DOMAIN_POWERS, ...MUNAVRI_TRAITS])
      expect(
        missingOf(now.held.find((row) => row.externalKey === key)!.reason),
        key,
      ).toEqual(['PZO1137']);
    expect(
      now.admitted.filter(({ requiredNotices }) =>
        requiredNotices.some((notice) =>
          CODES.some((code) => notice === code || notice === `pcgen:${code}`),
        ),
      ),
    ).toEqual([]);
  });

  it('admit the rows held only on these notices as committed, the confirmations checked, and no row on another book', () => {
    const drafted = gate({ drafted: true });
    const checked = gate({ drafted: false });
    expect(keysOf(checked.failures)).toEqual(CORPUS_FAILURES);
    const before = new Set(keysOf(drafted.admitted));
    const gained = checked.admitted.filter(
      ({ externalKey }) => !before.has(externalKey),
    );
    // Admitted before stays admitted.
    expect(keysOf(checked.admitted)).toEqual(
      expect.arrayContaining([...before]),
    );
    const heldBefore = new Map(
      drafted.held.map((row) => [row.externalKey, missingOf(row.reason)]),
    );
    const perBook = new Map<string, number>();
    for (const row of gained) {
      // Each was held only on batch notices, and now requires their pcgen: record.
      const missing = heldBefore.get(row.externalKey) ?? [];
      expect(missing.length, row.externalKey).toBeGreaterThan(0);
      expect(
        missing.every((code) => code in BOOKS),
        row.externalKey,
      ).toBe(true);
      expect(row.missingNotices, row.externalKey).toEqual([]);
      for (const code of missing)
        expect(row.requiredNotices, row.externalKey).toContain(`pcgen:${code}`);
      if (
        [...BESTIARY_6_DOMAIN_POWERS, ...MUNAVRI_TRAITS, ...MUNAVRI].includes(
          row.externalKey,
        )
      )
        continue;
      const [code] = missing;
      perBook.set(code!, (perBook.get(code!) ?? 0) + 1);
    }
    expect(Object.fromEntries(perBook)).toEqual(
      Object.fromEntries(CODES.map((code) => [code, BOOKS[code].admits])),
    );
    expect(gained).toHaveLength(
      91 +
        MUNAVRI.length +
        MUNAVRI_TRAITS.length +
        BESTIARY_6_DOMAIN_POWERS.length,
    );
    // The 13 class features held on PZO1137 while drafted are admitted again,
    // and Munavri with its traits.
    expect(keysOf(checked.admitted)).toEqual(
      expect.arrayContaining([
        ...BESTIARY_6_DOMAIN_POWERS,
        ...MUNAVRI_TRAITS,
        ...MUNAVRI,
      ]),
    );
    expect(keysOf(checked.dependentOmissions)).toEqual(
      expect.arrayContaining(DEPENDENT_OMISSIONS),
    );
    // A row also lacking a book outside the batch stays held on that book alone.
    for (const row of checked.held) {
      const missing = missingOf(row.reason);
      expect(
        missing.filter((code) => code in BOOKS),
        row.externalKey,
      ).toEqual([]);
      if (heldBefore.get(row.externalKey)?.some((code) => code in BOOKS))
        expect(missing.length, row.externalKey).toBeGreaterThan(0);
    }
  });
});
