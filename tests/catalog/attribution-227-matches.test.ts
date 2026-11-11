// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import {
  attribution227MatchesDrift,
  buildAttribution227Matches,
  buildPcgenNameIndex,
  classBooksOf,
  matchRecord,
  nameVariants,
  readMatcherInputHashes,
  readStoredInputs,
  serializeAttribution227Matches,
  storedBooksOf,
  type StoredBooks,
} from '../../scripts/catalog/attribution-227-matcher';
import {
  attribution227MatchSchema,
  attribution227MatchesSchema,
  committedAttribution227Matches,
  matchedBooks,
  matchesSha256,
  type Attribution227Match,
  type Attribution227Matches,
} from '../../scripts/catalog/legal/attribution-227-matches';
import { committedAttribution227 } from '../../scripts/catalog/legal/attribution-227';
import {
  mapEntry,
  upstreamRecord,
  type PreviewEntry,
} from '../../scripts/catalog/map';
import type { AttributionAssessment } from '../../src/lib/catalog/admission-schema';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { readPinned } from './pinned-sources';

// The #227 scripted match (owner decision 2026-11-10, item 1; design
// `research/admission-227-design.md` §B, §F slice 3): a record that declares
// no book is matched by name or KEY against the pinned PCGen lists of its own
// object family, the book from the list's folder. Published Foundry records
// and PCGen files from the pinned store.

/** The pinned PCGen files the index reads: each book's `.pcc` and lists. */
const pcgenPaths = [
  'roleplaying_game/advanced_players_guide/advanced_players_guide.pcc',
  'roleplaying_game/advanced_players_guide/apg_feats.lst',
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
  'roleplaying_game/advanced_class_guide/_advanced_class_guide.pcc',
  'roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
  'roleplaying_game/ultimate_combat/_ultimate_combat.pcc',
  'roleplaying_game/ultimate_combat/uc_abilities_class.lst',
  'campaign_setting/inner_sea_world_guide/inner_sea_world_guide.pcc',
  'campaign_setting/inner_sea_world_guide/iswg_feats.lst',
  'player_companion/harrow_handbook/_harrow_handbook.pcc',
  'player_companion/harrow_handbook/hh_feats.lst',
  'player_companion/ranged_tactics_toolbox/_ranged_tactics_toolbox.pcc',
  'player_companion/ranged_tactics_toolbox/rtt_feats.lst',
  'player_companion/elemental_masters_handbook/_elemental_masters_handbook.pcc',
  'player_companion/elemental_masters_handbook/emh_abilities_class.lst',
];
const index = buildPcgenNameIndex({
  files: await Promise.all(
    pcgenPaths.map(async (path) => ({
      path,
      text: await readPinned('pcgen', `data/pathfinder/paizo/${path}`),
    })),
  ),
});

async function pinnedEntry({
  repo,
  pack,
  path,
  kind,
}: {
  repo: 'pf1' | 'pf1-content';
  pack: string;
  path: string;
  kind: 'feat' | 'classFeature' | 'class';
}): Promise<PreviewEntry> {
  return mapEntry({
    source: {
      repo,
      pack,
      path,
      record: upstreamRecord.parse(parse(await readPinned(repo, path))),
    },
    kind,
    resolveKey: () => undefined,
    lookup: new Map(),
    spellClassTags: new Set(),
  });
}
const feat = (path: string) =>
  pinnedEntry({
    repo: 'pf1-content',
    pack: 'pf-feats',
    path: `src/pf-feats/${path}`,
    kind: 'feat',
  });
const classFeature = (path: string) =>
  pinnedEntry({
    repo: 'pf1',
    pack: 'class-abilities',
    path: `packs/class-abilities/${path}`,
    kind: 'classFeature',
  });
const classEntry = (path: string) =>
  pinnedEntry({
    repo: 'pf1',
    pack: 'classes',
    path: `packs/classes/${path}`,
    kind: 'class',
  });

// Advanced Player's Guide p. 159; Advanced Class Guide has a kineticist
// class ability of the same name.
const elementalFocusFeat = await feat('Elemental_Focus_1frgqDSnQFiTq0MC.yaml');
// Inner Sea World Guide and Harrow Handbook both print it.
const varisianTattoo = await feat('Varisian_Tattoo_HZcLHUmCoWirryD0.yaml');
// Ranged Tactics Toolbox; Foundry tags its name with the book.
const coveringFire = await feat('Covering_Fire__RTT__prl9FDe7Xqs10Lyz.yaml');
// Aquatic Adventures, a book outside the crosswalk.
const abolethDeceiver = await feat('Aboleth_Deceiver_pgAusdRWvknUkIn9.yaml');
// The Samurai's order: Ultimate Combat, tagged "(SAM)".
const orderSamurai = await classFeature('order-sam.Uo3yrfkyguM5wkI2.yaml');
// An oracle curse PCGen lists under another name.
const hiveCurse = await classFeature('hive-curse.0XlsirEXbAF3AFSZ.yaml');
// A sorcerer bloodline power PCGen prints in APG and Elemental Master's
// Handbook, never the Core Rulebook.
const aquaticAdaptation = await classFeature(
  'aquatic-adaptation.8AJT0T9xGWRxxj5i.yaml',
);
const classes = await Promise.all(
  [
    'oracle.5S0u8yFcP861wgd1.yaml',
    'samurai.yM8xfml1Xrccfwux.yaml',
    'sorcerer.AoWSbnuTSGIxmv61.yaml',
  ].map(classEntry),
);
const classBooks = classBooksOf(classes);
const noStored: StoredBooks = new Map();
const match = (entry: PreviewEntry, stored = noStored) =>
  matchRecord(entry, { index, classBooks, stored });

describe('the scripted match (#227)', () => {
  it('reads records that declare no book', () => {
    for (const entry of [
      elementalFocusFeat,
      varisianTattoo,
      coveringFire,
      abolethDeceiver,
      orderSamurai,
      hiveCurse,
      aquaticAdaptation,
    ])
      expect(entry.sources).toEqual([]);
  });

  it('matches a unique name to its book, by the line that names it', () => {
    expect(match(elementalFocusFeat)).toEqual({
      externalKey: elementalFocusFeat.externalKey,
      name: 'Elemental Focus',
      kind: 'feat',
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen',
          book: 'PZO1115',
          file: 'roleplaying_game/advanced_players_guide/apg_feats.lst',
          line: 59,
        },
      ],
      classes: [],
    });
  });

  it('does not match a same-name object of another family', async () => {
    // ACG's "Elemental Focus" kineticist ability is a class ability: the
    // feat doesn't take PZO1129, and the class feature doesn't take APG's feat.
    const kineticistFocus = await classFeature(
      'elemental-focus.x9TM9MHoUl4cv9Ht.yaml',
    );
    const found = match(kineticistFocus);
    expect(found?.status).toBe('matched');
    const books =
      found?.status === 'matched'
        ? found.evidence.flatMap((item) =>
            item.kind === 'pcgen' ? [item.book] : [],
          )
        : [];
    expect(books).toEqual(['PZO1129']);
  });

  it('matches several books, one line each', () => {
    expect(match(varisianTattoo)).toMatchObject({
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen',
          book: 'PZO9226',
          file: 'campaign_setting/inner_sea_world_guide/iswg_feats.lst',
          line: 43,
        },
        {
          kind: 'pcgen',
          book: 'PZO9446',
          file: 'player_companion/harrow_handbook/hh_feats.lst',
          line: 16,
        },
      ],
    });
  });

  it('matches a tagged Foundry name to its untagged PCGen name', () => {
    expect(nameVariants('Covering Fire (RTT)')).toEqual([
      'Covering Fire (RTT)',
      'Covering Fire',
    ]);
    expect(nameVariants('Ki Visions (UC)')).toEqual([
      'Ki Visions (UC)',
      'Ki Visions',
    ]);
    // A disambiguation word is part of the name.
    expect(nameVariants('Gore (Attack)')).toEqual(['Gore (Attack)']);
    expect(match(coveringFire)).toMatchObject({
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen',
          book: 'PZO9452',
          file: 'player_companion/ranged_tactics_toolbox/rtt_feats.lst',
          line: 16,
        },
      ],
    });
  });

  it('matches nothing for a name no list of its family has', () => {
    expect(match(abolethDeceiver)).toBeUndefined();
  });

  it('adds a class feature’s class book', () => {
    expect(match(orderSamurai)).toEqual({
      externalKey: orderSamurai.externalKey,
      name: 'Order (SAM)',
      kind: 'classFeature',
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen',
          book: 'PZO1115',
          file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
          line: 195,
        },
        {
          kind: 'pcgen',
          book: 'PZO1118',
          file: 'roleplaying_game/ultimate_combat/uc_abilities_class.lst',
          line: 189,
        },
      ],
      classes: [
        {
          externalKey: 'pf1/yM8xfml1Xrccfwux',
          name: 'Samurai',
          books: ['PZO1118'],
        },
      ],
    });
  });

  it('holds a class feature its class association alone names a book for', () => {
    expect(match(hiveCurse)).toEqual({
      externalKey: hiveCurse.externalKey,
      name: 'Hive Curse',
      kind: 'classFeature',
      status: 'held',
      hold: {
        kind: 'association-only',
        classes: [
          {
            externalKey: 'pf1/5S0u8yFcP861wgd1',
            name: 'Oracle',
            books: ['PZO1115'],
          },
        ],
      },
    });
  });

  it('holds a multi-book match whose books all differ from the class book', () => {
    expect(match(aquaticAdaptation)).toMatchObject({
      status: 'held',
      hold: {
        kind: 'class-book-disagrees',
        evidence: [{ book: 'PZO1115' }, { book: 'PZO9483' }],
        classes: [{ name: 'Sorcerer', books: ['PZO1110'] }],
      },
    });
  });

  it('reuses a stored assessment’s books where its legal record names a PCGen line', async () => {
    const stored = storedBooksOf(
      await readStoredInputs(
        '.',
        new Set(['scripts/catalog/legal/feats-343.json']),
      ),
    );
    expect(stored.get(varisianTattoo.externalKey)).toEqual({
      notices: ['PZO1110', 'PZO9226', 'PZO9446'],
      batch: 'scripts/catalog/legal/feats-343.json',
      comparison: {
        file: 'player_companion/harrow_handbook/hh_feats.lst',
        line: 16,
      },
    });
    const found = match(varisianTattoo, stored);
    expect(found?.status === 'matched' && matchedBooks(found)).toEqual([
      'PZO1110',
      'PZO9226',
      'PZO9446',
    ]);
    // Without a named PCGen line, a stored assessment names nothing.
    expect(
      storedBooksOf({
        legalRecords: [
          {
            batch: 'scripts/catalog/legal/feats-343.json',
            externalKey: varisianTattoo.externalKey,
            comparison: { book: 'PZO9226' },
          },
        ],
        assessments: [
          {
            externalKey: varisianTattoo.externalKey,
            requiredNotices: ['PZO9226'],
          },
        ],
      }).size,
    ).toBe(0);
  }, 30_000);

  it('refuses a match without evidence and a held match without classes', () => {
    const base = { externalKey: 'pf1/x', name: 'X', kind: 'feat' } as const;
    const noEvidence: Attribution227Match = {
      ...base,
      status: 'matched',
      // @ts-expect-error A match names at least one piece of evidence.
      evidence: [],
      classes: [],
    };
    const noClasses: Attribution227Match = {
      ...base,
      status: 'held',
      // @ts-expect-error An association-only hold names its classes.
      hold: { kind: 'association-only', classes: [] },
    };
    expect(attribution227MatchSchema.safeParse(noEvidence).success).toBe(false);
    expect(attribution227MatchSchema.safeParse(noClasses).success).toBe(false);
  });
});

/** The matches document of these records, as the command builds it. */
function documentOf(entries: PreviewEntry[]): Attribution227Matches {
  return buildAttribution227Matches({
    entries: [...entries, ...classes],
    index,
    stored: noStored,
    inputs: {},
  });
}

/**
 * A record as if the entries it links were imported too: the fixture imports
 * none, and an unresolved link fails the record before the #227 path.
 */
const linksResolved = (entry: PreviewEntry): PreviewEntry => ({
  ...entry,
  unsupported: entry.unsupported.filter(
    ({ field }) =>
      !['links.classAssociations', 'description.link'].includes(field),
  ),
});

function gate(entries: PreviewEntry[], matches = documentOf(entries)) {
  const records = entries.map(linksResolved);
  return assessCatalogAdmission({
    artifact: {
      curation: { missing: [], unresolvedMechanics: [] },
      catalog: { entries: records, resources: [], remaps: [] },
      comparison: {
        packs: [],
        records: records.map(({ upstreamKey }) => ({
          repo: 'pf1',
          pack: 'feats',
          path: `${upstreamKey}.yaml`,
          externalKey: upstreamKey,
          name: upstreamKey,
          status: 'admitted' as const,
          reason: 'In scope',
        })),
      },
    },
    assessments: [] as AttributionAssessment[],
    registry: section15Registry,
    evidence: {},
    attributionPath: {
      kind: 'declared-book',
      rule: { ...committedAttribution227, exceptions: [] },
      matches,
    },
  });
}
const rowOf = (
  rows: { externalKey: string; reason: string; requiredNotices: string[] }[],
  key: string,
) => rows.find((row) => row.externalKey === key);

describe('the gate on the scripted match (#227)', () => {
  it('admits a record with no declared book when every matched book is reviewed, naming the basis', () => {
    const result = gate([elementalFocusFeat]);
    expect(
      rowOf(result.admitted, elementalFocusFeat.externalKey),
    ).toMatchObject({
      reason:
        'Admitted under #227: scripted match PZO1115 via roleplaying_game/advanced_players_guide/apg_feats.lst:59.',
      requiredNotices: ['PZO1115'],
    });
  });

  it('requires the class book’s notice too', () => {
    const row = rowOf(gate([orderSamurai]).admitted, orderSamurai.externalKey);
    expect(row?.reason).toBe(
      'Admitted under #227: scripted match PZO1115 via roleplaying_game/advanced_players_guide/apg_abilities_class.lst:195; PZO1118 via roleplaying_game/ultimate_combat/uc_abilities_class.lst:189; PZO1118 via class Samurai (pf1/yM8xfml1Xrccfwux).',
    );
    expect(row?.requiredNotices).toEqual(['PZO1115', 'PZO1118']);
  });

  it('holds a record when one matched book has no reviewed notice', () => {
    // Ranged Tactics Toolbox (PZO9452) has no reviewed Registry notice.
    const result = gate([coveringFire]);
    expect(result.admitted).toEqual([]);
    expect(rowOf(result.held, coveringFire.externalKey)).toMatchObject({
      reason:
        'Held under #227: scripted match PZO9452 via player_companion/ranged_tactics_toolbox/rtt_feats.lst:16 lacks reviewed notices: PZO9452.',
      requiredNotices: ['PZO9452'],
    });
  });

  it('holds a record with no match as before', () => {
    const result = gate([abolethDeceiver]);
    expect(rowOf(result.held, abolethDeceiver.externalKey)?.reason).toBe(
      'missing Attribution Assessment',
    );
  });

  it('holds a held match, naming why', () => {
    const result = gate([hiveCurse, aquaticAdaptation]);
    expect(result.admitted).toEqual([]);
    expect(rowOf(result.held, hiveCurse.externalKey)?.reason).toBe(
      'Held under #227: scripted match held: no PCGen match or stored assessment; only its class association names a book: Oracle (PZO1115).',
    );
    expect(rowOf(result.held, aquaticAdaptation.externalKey)?.reason).toMatch(
      /^Held under #227: scripted match held: PCGen names several books, none its class's: PZO1115 via .+; PZO9483 via .+; class Sorcerer \(PZO1110\)\.$/,
    );
  });

  it('holds a record whose name or kind changed since it was matched', () => {
    const renamed = { ...elementalFocusFeat, name: 'Elemental Focus, Revised' };
    const result = gate([renamed], documentOf([elementalFocusFeat]));
    expect(result.admitted).toEqual([]);
    expect(rowOf(result.held, renamed.externalKey)?.reason).toBe(
      'Held under #227: scripted match is stale: it names feat "Elemental Focus"; regenerate it with pnpm catalog:attribution-227-matches --write.',
    );
  });

  it('reads only records that declare no book', () => {
    const declared = {
      ...elementalFocusFeat,
      sources: [{ book: 'PZO1110' }],
    };
    expect(
      rowOf(
        gate([declared], documentOf([elementalFocusFeat])).admitted,
        declared.externalKey,
      )?.reason,
    ).toBe('Admitted under #227: declared book PZO1110.');
  });
});

describe('the committed scripted match', () => {
  it('is current with its pinned inputs', async () => {
    const batches = new Set(
      committedAttribution227Matches.matches.flatMap((item) =>
        item.status === 'matched'
          ? item.evidence.flatMap((evidence) =>
              evidence.kind === 'stored-assessment' ? [evidence.batch] : [],
            )
          : [],
      ),
    );
    expect(
      attribution227MatchesDrift({
        document: committedAttribution227Matches,
        inputs: await readMatcherInputHashes('.'),
        stored: storedBooksOf(await readStoredInputs('.', batches)),
      }),
    ).toEqual([]);
  }, 120_000);

  it('fails the check when a pinned input or the file drifts', async () => {
    const inputs = await readMatcherInputHashes('.');
    const document = documentOf([elementalFocusFeat, varisianTattoo]);
    const bound = { ...document, binding: { ...document.binding, inputs } };
    const check = (changed: Attribution227Matches, current = inputs) =>
      attribution227MatchesDrift({
        document: changed,
        inputs: current,
        stored: noStored,
      });
    expect(check(bound)).toEqual([]);
    // A pinned input changed: the crosswalk, or the matcher itself.
    expect(
      check(bound, {
        ...inputs,
        'scripts/catalog/pcgen-books.json': '0'.repeat(64),
      }),
    ).toEqual(['input scripts/catalog/pcgen-books.json changed.']);
    // The file edited by hand.
    const [first, ...rest] = bound.matches;
    if (first?.status !== 'matched') throw new Error('Expected a match.');
    expect(
      check({
        ...bound,
        matches: [
          {
            ...first,
            evidence: [
              {
                kind: 'pcgen',
                book: 'PZO1110',
                file: 'roleplaying_game/core_rulebook/cr_feats.lst',
                line: 1,
              },
            ],
          },
          ...rest,
        ],
      }),
    ).toEqual([
      'matches drifted from binding.matchesSha256 (edited by hand?).',
    ]);
    // A pin moved.
    expect(
      check({
        ...bound,
        binding: {
          ...bound.binding,
          pcgen: { ...bound.binding.pcgen, commit: '0'.repeat(40) },
        },
      }),
    ).toEqual(['PCGen pin changed.']);
    // A stored assessment no longer names the books it was matched on.
    const storedMatches = [varisianStoredMatch()];
    expect(
      check({
        ...bound,
        matches: storedMatches,
        binding: {
          ...bound.binding,
          matchesSha256: matchesSha256(storedMatches),
        },
      }),
    ).toEqual([
      `${varisianTattoo.externalKey}: its stored assessment or legal record no longer names these books and PCGen line.`,
    ]);
  });

  it('writes each match on one line', () => {
    const text = serializeAttribution227Matches(
      documentOf([elementalFocusFeat, varisianTattoo]),
    );
    const lines = text.split('\n');
    expect(
      lines.filter((line) => line.startsWith('    {"externalKey"')),
    ).toHaveLength(2);
    expect(attribution227MatchesSchema.parse(JSON.parse(text))).toEqual(
      documentOf([elementalFocusFeat, varisianTattoo]),
    );
  });
});

/** Varisian Tattoo's match with its stored assessment, as feats-343 records it. */
function varisianStoredMatch(): Attribution227Match {
  return {
    externalKey: varisianTattoo.externalKey,
    name: varisianTattoo.name,
    kind: 'feat',
    status: 'matched',
    evidence: [
      {
        kind: 'stored-assessment',
        notices: ['PZO1110', 'PZO9226', 'PZO9446'],
        batch: 'scripts/catalog/legal/feats-343.json',
        comparison: {
          file: 'player_companion/harrow_handbook/hh_feats.lst',
          line: 16,
        },
      },
    ],
    classes: [],
  };
}
