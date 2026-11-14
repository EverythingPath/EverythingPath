// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import {
  attribution227MatchesDrift,
  buildAttribution227Matches,
  buildPcgenNameIndex,
  classBooksOf,
  matchesDifferences,
  matchName,
  matchRecord,
  nameVariants,
  readMatcherInputHashes,
  readStoredInputs,
  serializeAttribution227Matches,
  storedBooksOf,
  type PcgenNameIndex,
  type StoredBooks,
  wordOrderName,
} from '../../scripts/catalog/attribution-227-matcher';
import {
  attribution227MatchSchema,
  attribution227MatchesFileSchema,
  committedAttribution227Matches,
  matchedBooks,
  matchesSha256,
  readAttribution227Matches,
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
  'player_companion/divine_anthology/_divine_anthology.pcc',
  'player_companion/divine_anthology/support/da_abilities_class_ui.lst',
  'roleplaying_game/ultimate_magic/_ultimate_magic.pcc',
  'roleplaying_game/ultimate_magic/um_feats.lst',
];
const pcgenFiles = await Promise.all(
  pcgenPaths.map(async (path) => ({
    path,
    text: await readPinned('pcgen', `data/pathfinder/paizo/${path}`),
  })),
);
const index = buildPcgenNameIndex({ files: pcgenFiles });

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
// Advanced Class Guide p. 34: PCGen names it "Abyssal Bloodline", KEY
// "Bloodrager Bloodline ~ Abyssal".
const abyssalBloodline = await classFeature(
  'abyssal-bloodrager-bloodline.7D0gtn4Sf2kW3fQy.yaml',
);
// Advanced Class Guide p. 36; Dragon Disciple's same-name line is Internal.
const draconicBloodline = await classFeature(
  'draconic-bloodrager-bloodline.7w1iptKBZoqiqxkf.yaml',
);
// Divine Anthology p. 7: PCGen names it "Hubris Subdomain (Glory)" and
// "(Nobility)".
const hubrisSubdomain = await classFeature(
  'hubris-subdomain.S3e7NaopczIYCfO8.yaml',
);
// ACG names "Mutagen Discovery" (the mutation warrior's); Ultimate Magic
// keys its alchemist discovery Mutagen `KEY:Discovery ~ Mutagen`.
const mutagenDiscovery = await classFeature(
  'mutagen-discovery.ufzQpQBCyoJ8M9DD.yaml',
);
// Ultimate Magic's witch hex Scar (`KEY:Witch Hex ~ Scar`); the
// Advanced Race Guide's "Hex Scar" is the scarred witch doctor's.
const scarHex = await classFeature('scar-hex.MyKlcMHNiCixXl6K.yaml');
/** An index of these pinned lists only. */
async function indexOf(paths: readonly string[]) {
  return buildPcgenNameIndex({
    files: await Promise.all(
      paths.map(async (path) => ({
        path,
        text: await readPinned('pcgen', `data/pathfinder/paizo/${path}`),
      })),
    ),
  });
}
// Held for the class-table rule (root decision 2026-11-13, item 2), not here.
const heldForItem2 = await Promise.all(
  [
    'wind-mystery.tPnQOky1T8jX38WU.yaml',
    'grand-hex.IMhG1JjaWP6p9ORe.yaml',
    'major-hex.aZ5eCIRrsvax5CZZ.yaml',
    'exchange-spell-low.XfN89DtlUrwHGNrp.yaml',
    'exchange-spell-medium.5lDEyC6WejFyTEho.yaml',
  ].map(classFeature),
);
// Ultimate Magic p. 154: PCGen lists it per school, "Spell Specialization
// (Abjuration)" and on.
const spellSpecialization = await feat(
  'Spell_Specialization_CO2Qmj0aj76zJsew.yaml',
);
const classes = await Promise.all(
  [
    'bloodrager.E27lMw9YNOAjS009.yaml',
    'cleric.SjFqQceVeVBzBwgn.yaml',
    'inquisitor.Fv3FbmXptuDRiL5y.yaml',
    'witch.RC4D4WFT5kRKkdqp.yaml',
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

  it('matches a multi-book match whose books all differ from the class book, with the class book (root decision 2026-11-12, item 3)', () => {
    const found = match(aquaticAdaptation);
    expect(found).toMatchObject({
      status: 'matched',
      evidence: [
        { kind: 'pcgen', book: 'PZO1115' },
        { kind: 'pcgen', book: 'PZO9483' },
      ],
      classes: [{ name: 'Sorcerer', books: ['PZO1110'] }],
    });
    expect(found?.status === 'matched' && matchedBooks(found)).toEqual([
      'PZO1110',
      'PZO1115',
      'PZO9483',
    ]);
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

const acg = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const hubrisList =
  'player_companion/divine_anthology/support/da_abilities_class_ui.lst';

describe('the scripted match when no name or KEY is the same (root decision 2026-11-13, item 1)', () => {
  it('matches the same words in another order, naming the rule, the line and the class book', () => {
    expect(match(abyssalBloodline)).toEqual({
      externalKey: abyssalBloodline.externalKey,
      name: 'Abyssal Bloodrager Bloodline',
      kind: 'classFeature',
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen-fallback',
          rule: 'word-order',
          book: 'PZO1129',
          file: acg,
          line: 591,
        },
      ],
      classes: [
        {
          externalKey: 'pf1/E27lMw9YNOAjS009',
          name: 'Bloodrager',
          books: ['PZO1129'],
        },
      ],
    });
  });

  it('matches every Bloodrager line of one object, not Dragon Disciple’s Internal line', () => {
    // Line 381, "Draconic Bloodrager Bloodline", is CATEGORY:Internal; 383
    // and 699 are both "Draconic Bloodline".
    const found = match(draconicBloodline);
    expect(found).toMatchObject({
      status: 'matched',
      evidence: [
        { kind: 'pcgen-fallback', rule: 'word-order', file: acg, line: 383 },
        { kind: 'pcgen-fallback', rule: 'word-order', file: acg, line: 699 },
      ],
    });
    expect(found?.status === 'matched' && matchedBooks(found)).toEqual([
      'PZO1129',
    ]);
  });

  it('matches a PCGen name without its trailing parenthetical, listing the class books with the matched book', () => {
    const found = match(hubrisSubdomain);
    expect(found).toMatchObject({
      status: 'matched',
      evidence: [14, 15, 19, 20].map((line) => ({
        kind: 'pcgen-fallback',
        rule: 'without-parenthetical',
        book: 'PZO9472',
        file: hubrisList,
        line,
      })),
      classes: [
        { name: 'Cleric', books: ['PZO1110'] },
        { name: 'Inquisitor', books: ['PZO1115'] },
      ],
    });
    expect(found?.status === 'matched' && matchedBooks(found)).toEqual([
      'PZO1110',
      'PZO1115',
      'PZO9472',
    ]);
  });

  it('lets an exact name win over a KEY with the same words in another order', async () => {
    const um = 'roleplaying_game/ultimate_magic/um_abilities_class.lst';
    const both = await indexOf([
      'roleplaying_game/advanced_class_guide/_advanced_class_guide.pcc',
      acg,
      'roleplaying_game/ultimate_magic/_ultimate_magic.pcc',
      um,
    ]);
    expect(
      both.wordOrder
        .get(wordOrderName('Mutagen (Discovery)'))
        ?.map(({ file, line }) => `${file}:${line}`),
    ).toEqual([`${um}:155`]);
    const matched = (index: PcgenNameIndex) =>
      matchRecord(mutagenDiscovery, { index, classBooks, stored: noStored });
    expect(matched(both)).toMatchObject({
      status: 'matched',
      evidence: [{ kind: 'pcgen', book: 'PZO1129', file: acg, line: 3074 }],
    });
    // Without ACG's exact line, the KEY's words find Ultimate Magic's.
    expect(
      matched(
        await indexOf([
          'roleplaying_game/ultimate_magic/_ultimate_magic.pcc',
          um,
        ]),
      ),
    ).toMatchObject({
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen-fallback',
          rule: 'word-order',
          book: 'PZO1117',
          file: um,
          line: 155,
        },
      ],
    });
  });

  it('does not read a PCGen name’s own words in another order', async () => {
    // ARG's "Hex Scar" is another object than the Scar hex.
    const arg = await indexOf([
      'roleplaying_game/advanced_race_guide/advanced_race_guide.pcc',
      'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
    ]);
    expect(
      arg.exact.get(matchName('Hex Scar'))?.map(({ line }) => line),
    ).toEqual([658]);
    expect(
      matchRecord(scarHex, { index: arg, classBooks, stored: noStored }),
    ).toMatchObject({ status: 'held', hold: { kind: 'association-only' } });
  });

  it('holds and lists a name whose KEY words in another order belong to two objects', () => {
    // No published class feature's do at the pin (every one checked), so the
    // second line is constructed: ACG's line 591, its KEY kept, under another
    // name.
    const [, ...rest] = acgLine(591).split('\t');
    const reordered = ['Bloodline Abyssal Bloodrager', ...rest].join('\t');
    const files = pcgenFiles.map((file) =>
      file.path === acg
        ? { ...file, text: `${file.text}\n${reordered}\n` }
        : file,
    );
    const lines = files.find((file) => file.path === acg)?.text.split('\n');
    const constructed = (lines?.lastIndexOf(reordered) ?? -1) + 1;
    expect(
      matchRecord(abyssalBloodline, {
        index: buildPcgenNameIndex({ files }),
        classBooks,
        stored: noStored,
      }),
    ).toEqual({
      externalKey: abyssalBloodline.externalKey,
      name: 'Abyssal Bloodrager Bloodline',
      kind: 'classFeature',
      status: 'held',
      hold: {
        kind: 'ambiguous-word-order',
        candidates: [
          { book: 'PZO1129', file: acg, line: 591 },
          { book: 'PZO1129', file: acg, line: constructed },
        ],
      },
    });
  });

  it('keeps the class-table features held', () => {
    for (const entry of heldForItem2)
      expect(match(entry)).toMatchObject({
        status: 'held',
        hold: { kind: 'association-only' },
      });
  });

  it('tries neither rule for a record that is not a class feature', () => {
    // "Spell Specialization (Abjuration)" and on are Ultimate Magic's feat
    // lines; the feat stays unmatched.
    expect(
      index.withoutParenthetical
        .get(matchName('Spell Specialization'))
        ?.some(({ family }) => family === 'feat'),
    ).toBe(true);
    expect(match(spellSpecialization)).toBeUndefined();
  });

  it('refuses a fallback without its rule and an ambiguous hold with one line', () => {
    const base = {
      externalKey: 'pf1/x',
      name: 'X',
      kind: 'classFeature',
    } as const;
    const line = { book: 'PZO1129', file: acg, line: 591 } as const;
    const noRule: Attribution227Match = {
      ...base,
      status: 'matched',
      // @ts-expect-error A fallback names the rule that found its line.
      evidence: [{ kind: 'pcgen-fallback', ...line }],
      classes: [],
    };
    const oneCandidate: Attribution227Match = {
      ...base,
      status: 'held',
      // @ts-expect-error An ambiguous hold lists at least two lines.
      hold: { kind: 'ambiguous-word-order', candidates: [line] },
    };
    expect(attribution227MatchSchema.safeParse(noRule).success).toBe(false);
    expect(attribution227MatchSchema.safeParse(oneCandidate).success).toBe(
      false,
    );
  });
});

/** A line of ACG's class abilities list, by its number. */
function acgLine(line: number) {
  const text = pcgenFiles.find((file) => file.path === acg)?.text;
  const found = text?.split(/\r\n|\r|\n/)[line - 1];
  if (found === undefined) throw new Error(`No ACG line ${line}.`);
  return found;
}

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

function gate(
  entries: PreviewEntry[],
  matches = documentOf(entries),
  registry = section15Registry,
) {
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
    registry,
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

  it('reads a book through its reviewed Registry alias', () => {
    // Ranged Tactics Toolbox (PZO9452) reads as its reviewed pf1-content line.
    expect(
      rowOf(gate([coveringFire]).admitted, coveringFire.externalKey),
    ).toMatchObject({
      reason:
        'Admitted under #227: scripted match PZO9452 via player_companion/ranged_tactics_toolbox/rtt_feats.lst:16.',
      requiredNotices: ['PZO9452'],
    });
  });

  it('admits a record whose matched books all differ from its class book when the class book and every matched book are reviewed, listing them all', () => {
    const row = rowOf(
      gate([aquaticAdaptation]).admitted,
      aquaticAdaptation.externalKey,
    );
    expect(row?.reason).toMatch(
      /^Admitted under #227: scripted match PZO1115 via .+; PZO9483 via .+; PZO1110 via class Sorcerer \(pf1\/AoWSbnuTSGIxmv61\)\.$/,
    );
    expect(row?.requiredNotices).toEqual([
      'PZO1110',
      'PZO1115',
      'pcgen:PZO9483',
    ]);
  });

  it('holds a record when one matched book has no reviewed notice', () => {
    const elemental = section15Registry['pcgen:PZO9483'];
    if (!elemental) throw new Error('No pcgen:PZO9483.');
    const result = gate([aquaticAdaptation], documentOf([aquaticAdaptation]), {
      ...section15Registry,
      'pcgen:PZO9483': { ...elemental, reviewStatus: 'unreviewed' },
    });
    expect(result.admitted).toEqual([]);
    expect(rowOf(result.held, aquaticAdaptation.externalKey)?.reason).toMatch(
      /^Held under #227: scripted match .+ lacks reviewed notices: .*PZO9483\.$/,
    );
  });

  it('holds a record with no match as before', () => {
    const result = gate([abolethDeceiver]);
    expect(rowOf(result.held, abolethDeceiver.externalKey)?.reason).toBe(
      'missing Attribution Assessment',
    );
  });

  it('holds an association-only record with no match, naming why', () => {
    const result = gate([hiveCurse]);
    expect(result.admitted).toEqual([]);
    expect(rowOf(result.held, hiveCurse.externalKey)?.reason).toBe(
      'Held under #227: scripted match held: no PCGen match or stored assessment; only its class association names a book: Oracle (PZO1115).',
    );
  });

  it('admits a fallback match on every reviewed book, naming its rule', () => {
    const row = rowOf(
      gate([abyssalBloodline]).admitted,
      abyssalBloodline.externalKey,
    );
    expect(row?.reason).toBe(
      `Admitted under #227: scripted match PZO1129 via ${acg}:591 (a KEY with the same words in another order); PZO1129 via class Bloodrager (pf1/E27lMw9YNOAjS009).`,
    );
    expect(row?.requiredNotices).toEqual(['PZO1129']);
    const hubris = rowOf(
      gate([hubrisSubdomain]).admitted,
      hubrisSubdomain.externalKey,
    );
    expect(hubris?.reason).toMatch(
      /^Admitted under #227: scripted match PZO9472 via player_companion\/divine_anthology\/support\/da_abilities_class_ui\.lst:14 \(the PCGen name without its trailing parenthetical\); .+; PZO1110 via class Cleric \(pf1\/SjFqQceVeVBzBwgn\); PZO1115 via class Inquisitor \(pf1\/Fv3FbmXptuDRiL5y\)\.$/,
    );
    expect(hubris?.requiredNotices).toEqual([
      'PZO1110',
      'PZO1115',
      'pcgen:PZO9472',
      // Divine Anthology's Section 15 line in pf1-content's notices.
      'pf1-content/notice/218463b20b59ff6214834061f17129d17cd43f5979d8381ecf9a9d7979b824da',
    ]);
  });

  it('holds an ambiguous match, listing its lines', () => {
    const lines = [
      { book: 'PZO1129', file: acg, line: 591 },
      { book: 'PZO1129', file: acg, line: 5000 },
    ] as const;
    const ambiguous: Attribution227Match = {
      externalKey: abyssalBloodline.externalKey,
      name: abyssalBloodline.name,
      kind: 'classFeature',
      status: 'held',
      hold: { kind: 'ambiguous-word-order', candidates: lines },
    };
    const document = documentOf([abyssalBloodline]);
    const result = gate([abyssalBloodline], {
      ...document,
      matches: [ambiguous],
    });
    expect(result.admitted).toEqual([]);
    expect(rowOf(result.held, abyssalBloodline.externalKey)?.reason).toBe(
      `Held under #227: scripted match held: the KEYs with its words in another order name several PCGen objects: PZO1129 via ${acg}:591; PZO1129 via ${acg}:5000.`,
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

  it('matches the party’s bloodlines and Hubris Subdomain over the whole pin, and keeps the class-table features and the Scar hex held', () => {
    const committed = (entry: PreviewEntry) =>
      committedAttribution227Matches.matches.find(
        (item) => item.externalKey === entry.externalKey,
      );
    const fallbackLines = (entry: PreviewEntry) => {
      const found = committed(entry);
      return found?.status === 'matched'
        ? found.evidence.map((item) =>
            item.kind === 'pcgen-fallback'
              ? `${item.rule} ${item.book} ${item.file}:${item.line}`
              : item.kind,
          )
        : found?.status;
    };
    expect(fallbackLines(abyssalBloodline)).toEqual([
      `word-order PZO1129 ${acg}:591`,
    ]);
    expect(fallbackLines(draconicBloodline)).toEqual([
      `word-order PZO1129 ${acg}:383`,
      `word-order PZO1129 ${acg}:699`,
    ]);
    expect(fallbackLines(hubrisSubdomain)).toEqual(
      [14, 15, 19, 20].map(
        (line) => `without-parenthetical PZO9472 ${hubrisList}:${line}`,
      ),
    );
    // The party batch (party-227-holds, #608) stored an assessment for four
    // of them; the committed file matches those on it alone.
    const stored = new Set([
      'pf1/IMhG1JjaWP6p9ORe',
      'pf1/aZ5eCIRrsvax5CZZ',
      'pf1/XfN89DtlUrwHGNrp',
      'pf1/5lDEyC6WejFyTEho',
    ]);
    for (const entry of [...heldForItem2, scarHex])
      if (stored.has(entry.externalKey))
        expect(fallbackLines(entry)).toEqual(['stored-assessment']);
      else
        expect(committed(entry)).toMatchObject({
          status: 'held',
          hold: { kind: 'association-only' },
        });
  });

  it('writes each match on one line', () => {
    const text = serializeAttribution227Matches(
      documentOf([elementalFocusFeat, varisianTattoo]),
    );
    const lines = text.split('\n');
    expect(
      lines.filter((line) => line.startsWith('    {"externalKey"')),
    ).toHaveLength(2);
    expect(readAttribution227Matches(JSON.parse(text))).toEqual(
      documentOf([elementalFocusFeat, varisianTattoo]),
    );
  });

  it('stores each list’s book and each class once, and reads back the same matches', () => {
    // Two Samurai features matched on the same lines: one class record and
    // one book per list in the file, a key and a line in each match.
    const document = documentOf([orderSamurai, varisianTattoo]);
    const [samurai] = document.matches.filter(
      (item) => item.externalKey === orderSamurai.externalKey,
    );
    if (samurai?.status !== 'matched') throw new Error('Expected a match.');
    const twice = {
      ...document,
      matches: [...document.matches, { ...samurai, externalKey: 'pf1/zzz' }],
    };
    const text = serializeAttribution227Matches(twice);
    const stored = attribution227MatchesFileSchema.parse(JSON.parse(text));
    expect(stored.classes).toEqual({
      'pf1/yM8xfml1Xrccfwux': { name: 'Samurai', books: ['PZO1118'] },
    });
    expect(stored.listBooks).toEqual({
      'campaign_setting/inner_sea_world_guide/iswg_feats.lst': 'PZO9226',
      'player_companion/harrow_handbook/hh_feats.lst': 'PZO9446',
      'roleplaying_game/advanced_players_guide/apg_abilities_class.lst':
        'PZO1115',
      'roleplaying_game/ultimate_combat/uc_abilities_class.lst': 'PZO1118',
    });
    expect(text.match(/"Samurai"/g)).toHaveLength(1);
    expect(stored.matches.at(-1)).toEqual({
      externalKey: 'pf1/zzz',
      name: 'Order (SAM)',
      kind: 'classFeature',
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen',
          file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
          line: 195,
        },
        {
          kind: 'pcgen',
          file: 'roleplaying_game/ultimate_combat/uc_abilities_class.lst',
          line: 189,
        },
      ],
      classes: ['pf1/yM8xfml1Xrccfwux'],
    });
    expect(readAttribution227Matches(JSON.parse(text))).toEqual(twice);
    // A held match's classes and lines are stored the same way.
    const held = documentOf([hiveCurse, aquaticAdaptation]);
    expect(
      readAttribution227Matches(
        JSON.parse(serializeAttribution227Matches(held)),
      ),
    ).toEqual(held);
  });

  it('stores a fallback’s rule and an ambiguous hold’s lines by reference, and reads them back', () => {
    const document = documentOf([abyssalBloodline, hubrisSubdomain]);
    const ambiguous: Attribution227Match = {
      externalKey: 'pf1/zzz',
      name: 'Abyssal Bloodrager Bloodline',
      kind: 'classFeature',
      status: 'held',
      hold: {
        kind: 'ambiguous-word-order',
        candidates: [
          { book: 'PZO1129', file: acg, line: 591 },
          { book: 'PZO1129', file: acg, line: 5000 },
        ],
      },
    };
    const both = { ...document, matches: [...document.matches, ambiguous] };
    const text = serializeAttribution227Matches(both);
    const stored = attribution227MatchesFileSchema.parse(JSON.parse(text));
    expect(stored.matches[0]).toMatchObject({
      evidence: [
        { kind: 'pcgen-fallback', rule: 'word-order', file: acg, line: 591 },
      ],
    });
    expect(stored.matches.at(-1)).toMatchObject({
      hold: {
        kind: 'ambiguous-word-order',
        candidates: [
          { file: acg, line: 591 },
          { file: acg, line: 5000 },
        ],
      },
    });
    expect(stored.listBooks[acg]).toBe('PZO1129');
    expect(readAttribution227Matches(JSON.parse(text))).toEqual(both);
  });

  it('refuses a stored file with a record inline, an unresolved key or an unused entry', () => {
    const stored = JSON.parse(
      serializeAttribution227Matches(documentOf([orderSamurai])),
    );
    const [first] = stored.matches;
    // A PCGen line names its list and line; the book is the list's.
    expect(
      attribution227MatchesFileSchema.safeParse({
        ...stored,
        matches: [
          {
            ...first,
            evidence: [{ ...first.evidence[0], book: 'PZO1115' }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(() => readAttribution227Matches({ ...stored, classes: {} })).toThrow(
      'No class pf1/yM8xfml1Xrccfwux in classes.',
    );
    expect(() =>
      readAttribution227Matches({ ...stored, listBooks: {} }),
    ).toThrow(
      'No book for PCGen list roleplaying_game/advanced_players_guide/apg_abilities_class.lst in listBooks.',
    );
    expect(() =>
      readAttribution227Matches({
        ...stored,
        listBooks: {
          ...stored.listBooks,
          'roleplaying_game/core_rulebook/cr_feats.lst': 'PZO1110',
        },
      }),
    ).toThrow('No match names roleplaying_game/core_rulebook/cr_feats.lst.');
  });

  it('compares committed and fresh matches record for record', () => {
    const fresh = documentOf([elementalFocusFeat, orderSamurai]).matches;
    expect(matchesDifferences(fresh, fresh)).toEqual([]);
    const [focus, samurai] = fresh;
    if (focus?.status !== 'matched' || !samurai)
      throw new Error('Expected two matches.');
    const changed = { ...focus, name: 'Elemental Focus, Revised' };
    expect(matchesDifferences([changed], fresh)).toEqual([
      `${focus.externalKey}: its committed match differs from a fresh one.`,
      `${samurai.externalKey}: only a fresh generation lists it.`,
    ]);
    expect(matchesDifferences(fresh, [samurai])).toEqual([
      `${focus.externalKey}: only the committed file lists it.`,
    ]);
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
