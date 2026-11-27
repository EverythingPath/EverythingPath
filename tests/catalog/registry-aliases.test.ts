// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createNoticeReadiness } from '../../scripts/catalog/admission';
import {
  findRegistryAliasProblems,
  foundryBooksOf,
} from '../../scripts/catalog/legal/registry-aliases';
import type { Section15Registry } from '../../src/lib/catalog/admission-schema';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { readPinned } from './pinned-sources';

// Reviewed Registry aliases (design `research/admission-227-design.md` §F
// slice 2; party-admission-a): a book's code read as the reviewed
// pf1-content line of the same book, title against Foundry's
// `module/registry/sources.mjs`. An alias is a reviewed identity, not new
// text: no notice is created or edited.
const books = foundryBooksOf(
  await readPinned('pf1', 'module/registry/sources.mjs'),
);
const readiness = createNoticeReadiness({ registry: section15Registry });

/** The party's five books and the pf1-content line each is aliased to. */
const aliased = {
  PZO9452: 'aafdbe0b21ceef57bb270d7b4670cae8fc188f2329df9fc1d8994ae7503f550b',
  PZO9413: 'fef36dc57305b34b623e4adc90c457fcec01e933970ca38c7c5d246c43fd34b8',
  PZO9443: 'aac1cfccc9d9db71b43da2f008cd446129cafadcf7ce176c063b20108cb22a07',
  PZO9268: 'd3f22054b8e2161cb24a8d821abc327098254b64196e00a1b24184541cb60d72',
  PZO9491: 'be3193ca396c387da0ad63e7a2d1ed9d2909fed5561cd9c42ab56914585bcf07',
} as const;
const line = (hash: string) => `pf1-content/notice/${hash}`;

/** The committed Registry with one record's aliases replaced. */
const withAliases = (key: string, aliases: string[]): Section15Registry => {
  const record = section15Registry[key];
  if (!record) throw new Error(`No Registry record ${key}.`);
  return { ...section15Registry, [key]: { ...record, aliases } };
};

describe('reviewed Registry aliases', () => {
  it.each(Object.entries(aliased))(
    'reads %s as a reviewed notice, its pf1-content line',
    (code, hash) => {
      expect(readiness(code)).toEqual({
        notices: [code],
        identity: 'reviewed',
        holds: [],
      });
      expect(section15Registry[line(hash)]?.aliases).toEqual([code]);
    },
  );

  it('names each aliased book exactly, in its product line, with its year', () => {
    expect(
      findRegistryAliasProblems({ registry: section15Registry, books }),
    ).toEqual([]);
  });

  it('fails an alias whose record is titled for another book', () => {
    // Weapon Master's Handbook is PZO9463; PZO9491 is Heroes from the Fringe.
    const handbook = line(
      'a90e4b7aa5c455282c276cbe251717b0e4a98d6c3d15e1481e0f7662f20682fe',
    );
    const registry = withAliases(handbook, ['PZO9491']);
    expect(findRegistryAliasProblems({ registry, books })).toEqual([
      `${handbook}: alias PZO9491 is Foundry's "Heroes from the Fringe" (companion), but the record is titled "Pathfinder Player Companion: Weapon Master’s Handbook".`,
      `${handbook}: alias PZO9491's notice is dated 2015, but Foundry dates the book 2018.`,
      `PZO9491 names several records: ${handbook}, ${line(aliased.PZO9491)}.`,
    ]);
  });

  it('fails a title that differs from Foundry’s name: Gods and Magic is not "Pathfinder Chronicles: Gods and Magic"', () => {
    const key = line(
      'eedc493e0987b2c4908ef340fbb1cf2cd506be7f849f058dad9a3c687880fa49',
    );
    expect(
      findRegistryAliasProblems({
        registry: withAliases(key, ['PZO9202']),
        books,
      }),
    ).toEqual([
      `${key}: alias PZO9202 is Foundry's "Pathfinder Chronicles: Gods and Magic" (setting), but the record is titled "Gods and Magic".`,
    ]);
  });

  it('fails an alias whose notice year is not the book’s, and a code Foundry lacks', () => {
    const key = line(aliased.PZO9452);
    const record = section15Registry[key]!;
    const reprint = {
      ...section15Registry,
      [key]: { ...record, notice: record.notice.replace('2014', '2015') },
    };
    expect(findRegistryAliasProblems({ registry: reprint, books })).toEqual([
      `${key}: alias PZO9452's notice is dated 2015, but Foundry dates the book 2014.`,
    ]);
    expect(
      findRegistryAliasProblems({
        registry: withAliases(key, ['PZO9452', 'PZO0000']),
        books,
      }),
    ).toEqual([`${key}: alias PZO0000 is not a Foundry book.`]);
  });
});
