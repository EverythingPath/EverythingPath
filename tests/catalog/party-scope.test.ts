// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  parsePartyBuilds,
  type PartyBuilds,
} from '../../scripts/catalog/party/party-builds';
import {
  buildPartyScope,
  decodePartyScope,
  partyScopeBytes,
  partyCatalogEntry,
  partyScopeDrift,
  type PartyCatalogEntry,
} from '../../scripts/catalog/party/party-scope';
import { qualifyPartyScope } from '../../scripts/catalog/party/party-qualification';

/** A catalog entry whose detail references `refs` and whose description links `links`. */
const entry = (
  externalKey: string,
  kind: string,
  { refs = [], links = [] }: { refs?: string[]; links?: string[] } = {},
): PartyCatalogEntry => ({
  externalKey,
  name: externalKey.slice(4),
  description: links
    .map((key) => `<p><a href="catalog:${key}">${key}</a></p>`)
    .join(''),
  detail: { kind, features: refs.map((key) => ({ externalKey: key })) },
});

const catalog = {
  upstream: [
    { repository: 'pf1', commit: 'a'.repeat(40) },
    { repository: 'pf1-content', commit: 'b'.repeat(40) },
  ],
  entries: [
    entry('pf1/witch', 'class', { refs: ['pf1/hex'] }),
    entry('pf1/hex', 'classFeature', {
      refs: ['pf1/major-hex'],
      links: ['pf1/subdomain'],
    }),
    entry('pf1/major-hex', 'classFeature'),
    entry('pf1/subdomain', 'classFeature', { refs: ['pf1/shared'] }),
    entry('pf1/shared', 'spell'),
    entry('pf1/fighter', 'class', { refs: ['pf1/shared', 'pf1/gone'] }),
    entry('pf1/unused', 'feat'),
  ],
};

const character = (id: string, className: string, key: string) => ({
  id,
  kind: 'character',
  race: { kind: 'open', note: 'The sheet writes no race.' },
  levels: {
    kind: 'written',
    build: {
      now: [{ class: className, level: 3 }],
      next: { kind: 'known', classes: [{ class: className, level: 4 }] },
    },
  },
  keys: { classes: [{ kind: 'matched', key, name: className }] },
});
const party = (...characters: unknown[]): PartyBuilds =>
  parsePartyBuilds({
    schemaVersion: 1,
    scopeVersion: 'campaign-party-v1',
    note: 'Fixture.',
    characters,
  });
const twoCharacters = party(
  character('1', 'Witch', 'pf1/witch'),
  character('2', 'Fighter', 'pf1/fighter'),
);
const scopeOf = (builds: PartyBuilds, entries = catalog.entries) =>
  buildPartyScope({
    builds,
    buildsBytes: JSON.stringify(builds),
    catalog: { ...catalog, entries },
  });

describe('the party scope', () => {
  it('closes over a root’s references and description links, as the gate does', () => {
    const scope = scopeOf(party(character('1', 'Witch', 'pf1/witch')));
    expect(scope.roots).toEqual([
      { key: 'pf1/witch', group: 'classes', characters: ['1'] },
    ]);
    expect(scope.rows.map(({ key, kind }) => [key, kind])).toEqual([
      ['pf1/hex', 'classFeature'],
      ['pf1/major-hex', 'classFeature'],
      ['pf1/shared', 'spell'],
      ['pf1/subdomain', 'classFeature'],
      ['pf1/witch', 'class'],
    ]);
    expect(scope.edges).toEqual([
      { from: 'pf1/hex', to: 'pf1/major-hex', link: 'reference' },
      { from: 'pf1/hex', to: 'pf1/subdomain', link: 'description' },
      { from: 'pf1/subdomain', to: 'pf1/shared', link: 'reference' },
      { from: 'pf1/witch', to: 'pf1/hex', link: 'reference' },
    ]);
  });

  it('records which characters need each row; removing a key drops only its own closure', () => {
    const both = scopeOf(twoCharacters);
    const needs = (scope: typeof both) =>
      Object.fromEntries(
        scope.rows.map(({ key, characters }) => [key, characters]),
      );
    expect(needs(both)).toEqual({
      'pf1/fighter': ['2'],
      'pf1/hex': ['1'],
      'pf1/major-hex': ['1'],
      'pf1/shared': ['1', '2'],
      'pf1/subdomain': ['1'],
      'pf1/witch': ['1'],
    });
    const witchless = scopeOf(party(character('2', 'Fighter', 'pf1/fighter')));
    expect(needs(witchless)).toEqual({
      'pf1/fighter': ['2'],
      'pf1/shared': ['2'],
    });
  });

  it('refuses a key the catalog lacks or whose kind its group doesn’t allow', () => {
    expect(() =>
      scopeOf(party(character('1', 'Witch', 'pf1/missing'))),
    ).toThrow('1 classes: pf1/missing is not in the catalog');
    expect(() => scopeOf(party(character('1', 'Witch', 'pf1/hex')))).toThrow(
      '1 classes: pf1/hex (hex) is a classFeature',
    );
  });

  it('writes identical bytes on every run, whatever the catalog’s order', () => {
    const once = partyScopeBytes(scopeOf(twoCharacters));
    expect(partyScopeBytes(scopeOf(twoCharacters))).toBe(once);
    expect(
      partyScopeBytes(scopeOf(twoCharacters, [...catalog.entries].reverse())),
    ).toBe(once);
    expect(decodePartyScope(JSON.parse(once))).toEqual(scopeOf(twoCharacters));
  });

  describe('the candidate adapter’s references', () => {
    /** An entry as the import writes it, so the adapter reads its body. */
    const imported = (
      externalKey: string,
      detail: { kind: string } & Record<string, unknown>,
    ): PartyCatalogEntry => ({
      externalKey,
      upstreamKey: externalKey,
      pack: 'fixture',
      name: externalKey.slice(4),
      description: '',
      detail,
      sources: [],
      modifiers: [],
      unsupported: [],
    });
    const arcanist = entry('pf1/arcanist', 'class', {
      refs: ['pf1/exploit', 'pf1/rage'],
    });
    const exploit = imported('pf1/exploit', {
      kind: 'classFeature',
      picksByLevel: [
        {
          kind: 'pool',
          classLevel: 1,
          list: 'Arcanist Exploits',
          count: 1,
          members: ['pf1/acidjet', 'pf1/potentmagic'],
        },
      ],
    });
    const rage = imported('pf1/rage', {
      kind: 'classFeature',
      duplicateUpgrade: 'pf1/greaterrage',
    });
    const keenSenses = imported('pf1/keensenses', {
      kind: 'racialTrait',
      bonusSkillRanksPerLevel: 0,
      raceKeys: ['pf1/elf'],
    });
    const adapterCatalog = [
      arcanist,
      exploit,
      rage,
      keenSenses,
      entry('pf1/acidjet', 'classFeature'),
      entry('pf1/potentmagic', 'classFeature'),
      entry('pf1/greaterrage', 'classFeature'),
      entry('pf1/elf', 'race'),
    ];
    const arcanistParty = party({
      ...character('1', 'Arcanist', 'pf1/arcanist'),
      keys: {
        classes: [{ kind: 'matched', key: 'pf1/arcanist', name: 'Arcanist' }],
        racialTraits: [
          { kind: 'matched', key: 'pf1/keensenses', name: 'Keen Senses' },
        ],
      },
    });
    const adapterScope = scopeOf(arcanistParty, adapterCatalog);

    it.each([
      ['a pool member', 'pf1/exploit', 'pf1/acidjet'],
      ['another pool member', 'pf1/exploit', 'pf1/potentmagic'],
      ['a duplicate upgrade', 'pf1/rage', 'pf1/greaterrage'],
      ['a racial trait’s race', 'pf1/keensenses', 'pf1/elf'],
    ])(
      'pulls in %s outside the roots, as a reference edge',
      (_, from, to) => {
        expect(adapterScope.edges).toContainEqual({
          from,
          to,
          link: 'reference',
        });
        expect(adapterScope.rows).toContainEqual(
          expect.objectContaining({ key: to, characters: ['1'] }),
        );
      },
    );

    it('follows them only in a body the adapter reads', () => {
      const unread = { ...exploit, sources: undefined };
      expect(
        scopeOf(
          arcanistParty,
          adapterCatalog.map((item) => (item === exploit ? unread : item)),
        ).rows.map(({ key }) => key),
      ).not.toContain('pf1/acidjet');
    });

    it('reports a pool member the gate doesn’t admit as any needed row', () => {
      const keys = adapterScope.rows.map(({ key }) => key);
      const report = qualifyPartyScope({
        scope: adapterScope,
        builds: arcanistParty,
        exceptions: [],
        build: {
          stage: 'built',
          gate: {
            classes: new Map(
              keys.map((key) => [
                key,
                key === 'pf1/acidjet'
                  ? { gate: 'held' as const, reason: 'Held for review.' }
                  : { gate: 'admitted' as const, reason: 'Admitted.' },
              ]),
            ),
            missingNotices: new Map(),
            imported: new Set(keys),
            remapped: new Map(),
          },
        },
      });
      expect(
        report.rows.find(
          (row) => row.subject === 'row' && row.key === 'pf1/acidjet',
        ),
      ).toMatchObject({ outcome: 'failed', cause: 'held', characters: ['1'] });
      expect(report.qualification.characters).toEqual([
        expect.objectContaining({
          id: '1',
          served: false,
          failing: expect.arrayContaining([
            { key: 'pf1/acidjet', name: 'acidjet', cause: 'held' },
          ]),
        }),
      ]);
    });
  });

  describe('a preview entry', () => {
    const written = {
      ...entry('pf1/witch', 'class', { refs: ['pf1/hex'] }),
      upstreamKey: 'pf1.classes/witch',
      sources: [{ book: 'APG' }],
    };
    it('is kept whole, as the preview wrote it, for the labels', () => {
      expect(partyCatalogEntry.parse(written)).toBe(written);
    });

    it.each([
      ['without detail.kind', { ...written, detail: { features: [] } }],
      ['without a description', { ...written, description: undefined }],
      [
        'with grantsSlots feats that are no keys',
        { ...written, grantsSlots: [{ feats: [1] }] },
      ],
    ])('is refused with its key %s', (_, value) => {
      expect(() => partyCatalogEntry.parse(value)).toThrow(
        'Catalog entry pf1/witch lacks what the party scope reads',
      );
    });
  });

  describe('--check', () => {
    const committed = partyScopeBytes(scopeOf(twoCharacters));
    it('passes on the bytes it writes', () => {
      expect(
        partyScopeDrift({ committed, regenerated: scopeOf(twoCharacters) }),
      ).toEqual([]);
    });

    it('fails when the builds file changes', () => {
      const changed = scopeOf(party(character('2', 'Fighter', 'pf1/fighter')));
      expect(partyScopeDrift({ committed, regenerated: changed })).toEqual([
        'the builds file changed',
      ]);
    });

    it('fails when the catalog changes', () => {
      const entries = catalog.entries.map((item) =>
        item.externalKey === 'pf1/subdomain'
          ? entry('pf1/subdomain', 'classFeature')
          : item,
      );
      expect(
        partyScopeDrift({
          committed,
          regenerated: scopeOf(twoCharacters, entries),
        }),
      ).toEqual(['the catalog changed']);
    });

    it('fails when the scope file is edited or missing', () => {
      const regenerated = scopeOf(twoCharacters);
      expect(
        partyScopeDrift({
          committed: committed.replace('"spell"', '"feat"'),
          regenerated,
        }),
      ).toEqual([
        expect.stringMatching(
          /^the scope file is unreadable: Changed party scope record/,
        ),
      ]);
      expect(
        partyScopeDrift({ committed: `${committed}\n`, regenerated }),
      ).toEqual(['the scope file differs from what the generator writes']);
      expect(partyScopeDrift({ committed: undefined, regenerated })).toEqual([
        'the scope file is missing',
      ]);
    });
  });
});
