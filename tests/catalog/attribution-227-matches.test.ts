// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type * as NodeFs from 'node:fs';
import { legalRecordLabel } from '../../scripts/catalog/legal-records';
import { parse } from 'yaml';
import {
  assessCatalogAdmission,
  type AttributionPath,
} from '../../scripts/catalog/admission';
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
  attribution227MatchLookup,
  attribution227MatchSchema,
  attribution227MatchesFileSchema,
  committedAttribution227Matches,
  matchedBooks,
  matchesSha256,
  readAttribution227Matches,
  type Attribution227Match,
  type Attribution227Matches,
  type MatchedAttribution227,
  type ReviewedRecordLine,
} from '../../scripts/catalog/legal/attribution-227-matches';
import { committedAttribution227 } from '../../scripts/catalog/legal/attribution-227';
import {
  mapEntry,
  upstreamRecord,
  type PreviewEntry,
} from '../../scripts/catalog/map';
import type { AttributionAssessment } from '../../src/lib/catalog/admission-schema';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import {
  classGrantsOf,
  committedReviewedPcgenRecords,
  listReviewedPcgenRecordReviews,
  parseReviewedPcgenRecords,
  reviewedPcgenRecordIdentity,
  type ReviewedPcgenRecord,
} from '../../scripts/catalog/reviewed-pcgen-records';
import { readPinned } from './pinned-sources';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { launchVerificationInputs } from '../../scripts/catalog/launch-verification-build';
import { runLaunchVerification } from '../../scripts/catalog/launch-verification-command';
import { launchInventoryArguments } from '../../scripts/catalog/launch-inventory-arguments';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The in-memory missing-file probe: a path ending in one of these reads as
// absent through `node:fs`, as when the pinned store lacks it, for the reads
// this file drives synchronously (the gate's pinned-list read, the launch
// verification's input binding).
const absent = vi.hoisted(() => ({ paths: new Set<string>() }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  const readFileSync = ((path: unknown, ...rest: unknown[]) => {
    if ([...absent.paths].some((suffix) => String(path).endsWith(suffix)))
      throw Object.assign(
        new Error(`ENOENT: no such file or directory, open '${String(path)}'`),
        { code: 'ENOENT' },
      );
    return (actual.readFileSync as (...args: unknown[]) => unknown)(
      path,
      ...rest,
    );
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});
afterEach(() => absent.paths.clear());

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
  resolveKey = () => undefined,
}: {
  repo: 'pf1' | 'pf1-content';
  pack: string;
  path: string;
  kind: 'feat' | 'classFeature' | 'class';
  resolveKey?: (key: string) => string | undefined;
}): Promise<PreviewEntry> {
  return mapEntry({
    source: {
      repo,
      pack,
      path,
      record: upstreamRecord.parse(parse(await readPinned(repo, path))),
    },
    kind,
    resolveKey,
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
    // Its rows grant the features by their upstream keys.
    resolveKey: (key) => key,
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
// Advanced Player's Guide p. 38: the Cavalier's 17th-level Master Tactician.
// Foundry's class row grants the misspelled "Master Tacitician"; its
// correctly spelled twin, with the same body, no class row grants.
const masterTacitician = await classFeature(
  'master-tacitician.mrJ61WiA6PuZgPTJ.yaml',
);
const masterTactician = await classFeature(
  'master-tactician.mvyIXBt01WtR0lM1.yaml',
);
const classes = await Promise.all(
  [
    'bloodrager.E27lMw9YNOAjS009.yaml',
    'cavalier.u1ed3H9xtYQXTP5v.yaml',
    'cleric.SjFqQceVeVBzBwgn.yaml',
    'inquisitor.Fv3FbmXptuDRiL5y.yaml',
    'witch.RC4D4WFT5kRKkdqp.yaml',
    'oracle.5S0u8yFcP861wgd1.yaml',
    'samurai.yM8xfml1Xrccfwux.yaml',
    'sorcerer.AoWSbnuTSGIxmv61.yaml',
  ].map(classEntry),
);
const classBooks = classBooksOf(classes);
type ClassRows = Extract<
  PreviewEntry['detail'],
  { kind: 'class' }
>['featuresByLevel'];
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
        new Set([legalRecordLabel('feats-343.json')]),
      ),
    );
    expect(stored.get(varisianTattoo.externalKey)).toEqual({
      notices: ['PZO1110', 'PZO9226', 'PZO9446'],
      batch: legalRecordLabel('feats-343.json'),
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
            batch: legalRecordLabel('feats-343.json'),
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
function documentOf(
  entries: PreviewEntry[],
  reviewedRecords: readonly ReviewedPcgenRecord[] = [],
  {
    pcgenIndex = index,
    stored = noStored,
    classEntries = classes,
  }: {
    pcgenIndex?: PcgenNameIndex;
    stored?: StoredBooks;
    classEntries?: readonly PreviewEntry[];
  } = {},
): Attribution227Matches {
  return buildAttribution227Matches({
    entries: [...entries, ...classEntries],
    index: pcgenIndex,
    stored,
    reviewedRecords,
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
  {
    registry = section15Registry,
    reviewedRecords = committedReviewedPcgenRecords,
  }: {
    registry?: typeof section15Registry;
    reviewedRecords?: readonly ReviewedPcgenRecord[];
  } = {},
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
      reviewedRecords,
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
      registry: {
        ...section15Registry,
        'pcgen:PZO9483': { ...elemental, reviewStatus: 'unreviewed' },
      },
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
        batch: legalRecordLabel('feats-343.json'),
        comparison: {
          file: 'player_companion/harrow_handbook/hh_feats.lst',
          line: 16,
        },
      },
    ],
    classes: [],
  };
}

const apgClass =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const ucClass = 'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
/** A line of the pinned Advanced Player's Guide class abilities list. */
const apgLine = (line: number) => {
  const text = pcgenFiles
    .find(({ path }) => path === apgClass)
    ?.text.split(/\r\n|\r|\n/)[line - 1];
  if (text === undefined) throw new Error(`No APG line ${line}.`);
  return text;
};
type ReviewState =
  | { status: 'drafted' }
  | {
      status: 'checked';
      reviewedBy: string;
      reviewedOn: string;
      receipt: string;
    };
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
/** The SHA-256 of the pinned Master Tacitician's imported description. */
const tacitianBody = sha256(masterTacitician.description);
/** Master Tacitician's reviewed PCGen record, in a given review state. */
const tacticianRecord = (
  review: ReviewState = { status: 'drafted' },
  pcgen = { file: apgClass, key: 'Cavalier ~ Master Tactician' },
): ReviewedPcgenRecord => ({
  externalKey: masterTacitician.externalKey,
  upstreamName: 'Master Tacitician',
  descriptionSha256: tacitianBody,
  pcgen,
  evidence: 'Fixture.',
  ...review,
});
const checkedReview = {
  status: 'checked',
  reviewedBy: 'Fixture reviewer',
  reviewedOn: '2026-11-18',
  receipt: `t3-review-${'a'.repeat(64)}`,
} as const;
const matchOf = (document: Attribution227Matches, key: string) =>
  document.matches.find((item) => item.externalKey === key);
/** The refusal a list of reviewed records gets, naming each problem. */
const refusal = (...problems: string[]) =>
  `Reviewed PCGen records (reviewed-pcgen-records.json) refused:\n${problems.map((problem) => `- ${problem}`).join('\n')}`;

describe('a reviewed PCGen record (root decision 2026-11-18, item 1)', () => {
  it('matches a checked record on its one PCGen record alone, naming the rule: the Cavalier’s Master Tactician, not the other classes’ of that name', () => {
    const document = documentOf(
      [masterTacitician, masterTactician],
      [tacticianRecord(checkedReview)],
    );
    expect(matchOf(document, masterTacitician.externalKey)).toEqual({
      externalKey: 'pf1/mrJ61WiA6PuZgPTJ',
      name: 'Master Tacitician',
      kind: 'classFeature',
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen-fallback',
          rule: 'reviewed-record',
          book: 'PZO1115',
          file: apgClass,
          line: 206,
          key: 'Cavalier ~ Master Tactician',
          lineSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          record: {
            id: `pcgen-record pf1/mrJ61WiA6PuZgPTJ sha256:${tacitianBody}`,
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          },
        },
      ],
      classes: [
        {
          externalKey: 'pf1/u1ed3H9xtYQXTP5v',
          name: 'Cavalier',
          books: ['PZO1115'],
        },
      ],
    });
    // Its correctly spelled twin keeps its own exact-name match, UC's
    // Divine Strategist line with it: the record changes no other match.
    expect(matchOf(document, masterTactician.externalKey)).toEqual(
      matchOf(documentOf([masterTactician]), masterTactician.externalKey),
    );
  });

  it('applies nothing while drafted: the record stays held on its class association', () => {
    expect(
      matchOf(
        documentOf([masterTacitician], [tacticianRecord()]),
        masterTacitician.externalKey,
      ),
    ).toEqual(
      matchOf(documentOf([masterTacitician]), masterTacitician.externalKey),
    );
    expect(
      matchOf(documentOf([masterTacitician]), masterTacitician.externalKey),
    ).toMatchObject({ status: 'held', hold: { kind: 'association-only' } });
  });

  it('cannot match a second record: another key with the same name is untouched', () => {
    const second = { ...masterTacitician, externalKey: 'pf1/secondRecord' };
    const document = documentOf(
      [masterTacitician, second],
      [tacticianRecord(checkedReview)],
    );
    expect(matchOf(document, masterTacitician.externalKey)).toMatchObject({
      status: 'matched',
    });
    expect(matchOf(document, second.externalKey)).toMatchObject({
      status: 'held',
      hold: { kind: 'association-only' },
    });
  });

  it('refuses a PCGen key its file does not hold, and another class’s key, drafted or checked, naming each', () => {
    for (const review of [{ status: 'drafted' } as const, checkedReview]) {
      // The Cavalier's KEY is in APG's list, not UC's.
      expect(() =>
        documentOf(
          [masterTacitician],
          [
            tacticianRecord(review, {
              file: ucClass,
              key: 'Cavalier ~ Master Tactician',
            }),
          ],
        ),
      ).toThrow(
        refusal(
          `pf1/mrJ61WiA6PuZgPTJ: ${ucClass} has no line keyed "Cavalier ~ Master Tactician".`,
        ),
      );
      // UC's Master Tactician is the Divine Strategist Cleric's, not the
      // Cavalier's this record is associated with.
      expect(() =>
        documentOf(
          [masterTacitician],
          [
            tacticianRecord(review, {
              file: ucClass,
              key: 'Divine Strategist ~ Master Tactician',
            }),
          ],
        ),
      ).toThrow(
        refusal(
          'pf1/mrJ61WiA6PuZgPTJ: its PCGen key "Divine Strategist ~ Master Tactician" is not a feature of a class whose row grants it (Cavalier).',
        ),
      );
    }
  });

  it('refuses a record no class row grants: a class association is not a grant', () => {
    const withGrants = (
      name: string,
      grants: (rows: ClassRows) => ClassRows,
    ): PreviewEntry[] =>
      classes.map((entry) =>
        entry.name === name && entry.detail.kind === 'class'
          ? {
              ...entry,
              detail: {
                ...entry.detail,
                featuresByLevel: grants(entry.detail.featuresByLevel),
              },
            }
          : entry,
      );
    const cavalier = classes.find(({ name }) => name === 'Cavalier');
    if (cavalier?.detail.kind !== 'class') throw new Error('No Cavalier.');
    // The pinned Cavalier grants it at 17th level.
    expect(cavalier.detail.featuresByLevel).toContainEqual({
      classLevel: 17,
      externalKey: masterTacitician.externalKey,
    });
    const notGranted = refusal(
      'pf1/mrJ61WiA6PuZgPTJ: no class row grants it (its class associations, Cavalier, are not grants).',
    );
    // The reviewers' probe: the Cavalier's grant list empty.
    expect(() =>
      documentOf([masterTacitician], [tacticianRecord(checkedReview)], {
        classEntries: withGrants('Cavalier', () => []),
      }),
    ).toThrow(notGranted);
    // Upstream moves the 17th-level row to the correctly spelled twin and
    // keeps the old record.
    expect(() =>
      documentOf([masterTacitician], [tacticianRecord(checkedReview)], {
        classEntries: withGrants('Cavalier', (rows) =>
          rows.map((row) =>
            row.externalKey === masterTacitician.externalKey
              ? { ...row, externalKey: masterTactician.externalKey }
              : row,
          ),
        ),
      }),
    ).toThrow(notGranted);
    // The reviewers' other probe: a feature associated with the Cavalier that
    // no Cavalier row grants, read as the Cavalier's Mount (APG:194).
    const stalwartMount = {
      ...masterTacitician,
      externalKey: 'pf1/stalwartMountFixture',
      name: 'Stalwart Mount',
    };
    expect(() =>
      documentOf(
        [stalwartMount],
        [
          {
            ...tacticianRecord(checkedReview, {
              file: apgClass,
              key: 'Cavalier ~ Mount',
            }),
            externalKey: stalwartMount.externalKey,
            upstreamName: stalwartMount.name,
          },
        ],
      ),
    ).toThrow(
      refusal(
        'pf1/stalwartMountFixture: no class row grants it (its class associations, Cavalier, are not grants).',
      ),
    );
    // Another class's row grants it: the Cavalier's key is not that class's.
    expect(() =>
      documentOf([masterTacitician], [tacticianRecord(checkedReview)], {
        classEntries: withGrants('Samurai', (rows) => [
          ...rows,
          { classLevel: 17, externalKey: masterTacitician.externalKey },
        ]).map((entry) =>
          entry.name === 'Cavalier' && entry.detail.kind === 'class'
            ? { ...entry, detail: { ...entry.detail, featuresByLevel: [] } }
            : entry,
        ),
      }),
    ).toThrow(
      refusal(
        'pf1/mrJ61WiA6PuZgPTJ: its PCGen key "Cavalier ~ Master Tactician" is not a feature of a class whose row grants it (Samurai).',
      ),
    );
  });

  it('refuses a PCGen line its own TYPE does not give the granting class’s features', () => {
    const apgText = pcgenFiles.find(({ path }) => path === apgClass)?.text;
    const apgPcc = pcgenFiles.find(({ path }) =>
      path.endsWith('advanced_players_guide.pcc'),
    );
    if (!apgText || !apgPcc) throw new Error('No APG list.');
    const lines = apgText.split(/\r\n|\r|\n/);
    lines[205] = (lines[205] ?? '').replace(
      'TYPE:CavalierClassFeatures.',
      'TYPE:SamuraiClassFeatures.',
    );
    expect(lines[205]).toContain('TYPE:SamuraiClassFeatures.');
    const retyped = buildPcgenNameIndex({
      files: [apgPcc, { path: apgClass, text: lines.join('\n') }],
    });
    expect(() =>
      documentOf([masterTacitician], [tacticianRecord(checkedReview)], {
        pcgenIndex: retyped,
      }),
    ).toThrow(
      refusal(
        `pf1/mrJ61WiA6PuZgPTJ: ${apgClass}:206 keyed "Cavalier ~ Master Tactician" is not typed CavalierClassFeatures.`,
      ),
    );
  });

  it('reads the key and the upstream name exactly: no trailing tag dropped, no case, spacing or word-order reading', () => {
    // Each would find APG's line if the record were read as a name.
    for (const key of [
      'Cavalier ~ Master Tactician (UC)',
      'Cavalier ~ Master Tactician (Ex)',
      'cavalier ~ master tactician',
      'Cavalier ~ Master  Tactician',
      'Master Tactician ~ Cavalier',
      // The line's column-1 name: a line with a KEY is keyed by its KEY.
      'Master Tactician',
    ])
      expect(() =>
        documentOf(
          [masterTacitician],
          [tacticianRecord(checkedReview, { file: apgClass, key })],
        ),
      ).toThrow(
        refusal(
          `pf1/mrJ61WiA6PuZgPTJ: ${apgClass} has no line keyed "${key}".`,
        ),
      );
    // A Foundry name with a trailing tag is not its upstream name without it.
    expect(() =>
      documentOf(
        [masterTacitician],
        [
          {
            ...tacticianRecord(checkedReview),
            upstreamName: 'Master Tacitician (Ex)',
          },
        ],
      ),
    ).toThrow(
      refusal(
        'pf1/mrJ61WiA6PuZgPTJ: the record is named "Master Tacitician", not "Master Tacitician (Ex)".',
      ),
    );
  });

  it('refuses a PCGen key its file holds more than once', () => {
    const apgText = pcgenFiles.find(({ path }) => path === apgClass)?.text;
    const apgPcc = pcgenFiles.find(({ path }) =>
      path.endsWith('advanced_players_guide.pcc'),
    );
    if (!apgText || !apgPcc) throw new Error('No APG list.');
    const line206 = apgText.split(/\r\n|\r|\n/)[205] ?? '';
    const twice = buildPcgenNameIndex({
      files: [apgPcc, { path: apgClass, text: `${apgText}\n${line206}\n` }],
    });
    expect(() =>
      documentOf([masterTacitician], [tacticianRecord(checkedReview)], {
        pcgenIndex: twice,
      }),
    ).toThrow(
      refusal(
        `pf1/mrJ61WiA6PuZgPTJ: ${apgClass} has 2 lines keyed "Cavalier ~ Master Tactician" (206, ${apgText.split(/\r\n|\r|\n/).length + 1}); a reviewed PCGen record names one.`,
      ),
    );
  });

  it('refuses a PCGen key its file holds twice in any category: a KEY names one PCGen record before its family is read', () => {
    const apgText = pcgenFiles.find(({ path }) => path === apgClass)?.text;
    const apgPcc = pcgenFiles.find(({ path }) =>
      path.endsWith('advanced_players_guide.pcc'),
    );
    if (!apgText || !apgPcc) throw new Error('No APG list.');
    const line206 = apgText.split(/\r\n|\r|\n/)[205] ?? '';
    expect(line206).toContain('CATEGORY:Special Ability');
    const appended = apgText.split(/\r\n|\r|\n/).length + 1;
    // The reviewers' probes, FEAT and Internal, and a copy with no category.
    for (const copy of [
      line206.replace('CATEGORY:Special Ability', 'CATEGORY:FEAT'),
      line206.replace('CATEGORY:Special Ability', 'CATEGORY:Internal'),
      line206.replace(/\tCATEGORY:Special Ability/, ''),
    ]) {
      expect(copy).not.toBe(line206);
      const twice = buildPcgenNameIndex({
        files: [apgPcc, { path: apgClass, text: `${apgText}\n${copy}\n` }],
      });
      expect(() =>
        documentOf([masterTacitician], [tacticianRecord(checkedReview)], {
          pcgenIndex: twice,
        }),
      ).toThrow(
        refusal(
          `pf1/mrJ61WiA6PuZgPTJ: ${apgClass} has 2 lines keyed "Cavalier ~ Master Tactician" (206, ${appended}); a reviewed PCGen record names one.`,
        ),
      );
    }
  });

  it('refuses a PCGen key whose one line is of another family', () => {
    const apgText = pcgenFiles.find(({ path }) => path === apgClass)?.text;
    const apgPcc = pcgenFiles.find(({ path }) =>
      path.endsWith('advanced_players_guide.pcc'),
    );
    if (!apgText || !apgPcc) throw new Error('No APG list.');
    const lines = apgText.split(/\r\n|\r|\n/);
    lines[205] = (lines[205] ?? '').replace(
      'CATEGORY:Special Ability',
      'CATEGORY:Internal',
    );
    const moved = buildPcgenNameIndex({
      files: [apgPcc, { path: apgClass, text: lines.join('\n') }],
    });
    expect(() =>
      documentOf([masterTacitician], [tacticianRecord(checkedReview)], {
        pcgenIndex: moved,
      }),
    ).toThrow(
      refusal(
        `pf1/mrJ61WiA6PuZgPTJ: ${apgClass}:206 keyed "Cavalier ~ Master Tactician" is not a class-ability line.`,
      ),
    );
  });

  it('refuses a record whose Foundry record already matches by an ordinary rule or a stored assessment, and never changes a matched entry’s book', () => {
    /** A reviewed record for this entry, naming APG's Cavalier line. */
    const aimedAt = (entry: PreviewEntry): ReviewedPcgenRecord => ({
      ...tacticianRecord(checkedReview),
      externalKey: entry.externalKey,
      upstreamName: entry.name,
      descriptionSha256: sha256(entry.description),
    });
    const stale = (detail: string) =>
      `${detail}; a reviewed PCGen record applies only to a record with no match, so this one is stale.`;
    for (const review of [{ status: 'drafted' } as const, checkedReview]) {
      const cases: [PreviewEntry, string][] = [
        // An exact name: upstream fixed the spelling of its twin.
        [
          masterTactician,
          `pf1/mvyIXBt01WtR0lM1: its own name matches PCGen (exact: ${apgClass}:206, ${ucClass}:574)`,
        ],
        // Each landed fallback (root decision of 2026-11-13, item 1).
        [
          abyssalBloodline,
          `${abyssalBloodline.externalKey}: its own name matches PCGen (word-order: ${acg}:591)`,
        ],
        [
          hubrisSubdomain,
          `${hubrisSubdomain.externalKey}: its own name matches PCGen (without-parenthetical: ${[14, 15, 19, 20].map((line) => `${hubrisList}:${line}`).join(', ')})`,
        ],
      ];
      for (const [entry, detail] of cases) {
        expect(() =>
          documentOf([entry], [{ ...aimedAt(entry), ...review }]),
        ).toThrow(refusal(stale(detail)));
      }
    }
    // A stored assessment names its books: the record cannot add one.
    const stored: StoredBooks = new Map([
      [
        masterTacitician.externalKey,
        {
          notices: ['PZO1118'],
          batch: 'fixture-batch',
          comparison: { file: ucClass, line: 574 },
        },
      ],
    ]);
    expect(() =>
      documentOf([masterTacitician], [tacticianRecord(checkedReview)], {
        stored,
      }),
    ).toThrow(
      refusal(
        stale(
          'pf1/mrJ61WiA6PuZgPTJ: its stored assessment names its books (fixture-batch)',
        ),
      ),
    );
    // And the match itself never lets a reviewed line replace or join a
    // matched entry's lines: each fallback's book is unchanged.
    const apgLine = {
      book: 'PZO1115',
      file: apgClass,
      line: 206,
      key: 'Cavalier ~ Master Tactician',
      lineSha256: 'a'.repeat(64),
      record: { id: 'fixture', sha256: 'a'.repeat(64) },
    };
    for (const entry of [abyssalBloodline, hubrisSubdomain, masterTactician])
      expect(
        matchRecord(entry, {
          index,
          classBooks,
          stored: noStored,
          reviewedLine: apgLine,
        }),
      ).toEqual(match(entry));
    expect(
      matchRecord(masterTacitician, {
        index,
        classBooks,
        stored,
        reviewedLine: apgLine,
      }),
    ).toEqual(match(masterTacitician, stored));
  });

  it('refuses a record whose upstream name no longer matches, drafted or checked, naming it', () => {
    // Foundry fixed the spelling, or renamed it to something else.
    const fixed = { ...masterTacitician, name: 'Master Tactician' };
    const renamed = { ...masterTacitician, name: 'Master Tacticien' };
    for (const review of [{ status: 'drafted' } as const, checkedReview]) {
      expect(() => documentOf([renamed], [tacticianRecord(review)])).toThrow(
        refusal(
          'pf1/mrJ61WiA6PuZgPTJ: the record is named "Master Tacticien", not "Master Tacitician".',
        ),
      );
      expect(() => documentOf([fixed], [tacticianRecord(review)])).toThrow(
        'pf1/mrJ61WiA6PuZgPTJ: the record is named "Master Tactician", not "Master Tacitician".',
      );
    }
  });

  it('refuses a record whose Foundry body changed under the same name, drafted or checked, naming both hashes', () => {
    const revised = {
      ...masterTacitician,
      description: `${masterTacitician.description}<p>Errata.</p>`,
    };
    for (const review of [{ status: 'drafted' } as const, checkedReview])
      expect(() => documentOf([revised], [tacticianRecord(review)])).toThrow(
        refusal(
          `pf1/mrJ61WiA6PuZgPTJ: its description is sha256:${sha256(revised.description)}, not the reviewed sha256:${tacitianBody}; the record is stale until it is reviewed again.`,
        ),
      );
  });

  it('refuses a record no match reads: a key the import lacks or one that declares a book', () => {
    expect(() =>
      documentOf([masterTactician], [tacticianRecord(checkedReview)]),
    ).toThrow(
      refusal(
        'pf1/mrJ61WiA6PuZgPTJ: no record that declares no book has this key.',
      ),
    );
    const declared = { ...masterTacitician, sources: [{ book: 'PZO1115' }] };
    expect(() =>
      documentOf([declared], [tacticianRecord(checkedReview)]),
    ).toThrow(
      refusal(
        'pf1/mrJ61WiA6PuZgPTJ: no record that declares no book has this key.',
      ),
    );
  });

  it('admits the checked record on the Advanced Player’s Guide alone, naming its reviewed record', () => {
    const records = [masterTacitician];
    const checked = [tacticianRecord(checkedReview)];
    // The gate reads the Cavalier's grant row too.
    const cavalier = classes.filter(({ name }) => name === 'Cavalier');
    const row = rowOf(
      gate([...records, ...cavalier], documentOf(records, checked), {
        reviewedRecords: checked,
      }).admitted,
      masterTacitician.externalKey,
    );
    expect(row?.reason).toBe(
      `Admitted under #227: scripted match PZO1115 via ${apgClass}:206 (its reviewed PCGen record); PZO1115 via class Cavalier (pf1/u1ed3H9xtYQXTP5v).`,
    );
    expect(row?.requiredNotices).toEqual(['PZO1115']);
    expect(gate(records).admitted).toEqual([]);
  });

  it('holds a generated reviewed-record match the gate finds stale: the record back to drafted, gone, or its Foundry body changed, naming why and holding it on its class association', () => {
    const checked = [tacticianRecord(checkedReview)];
    // The matches file as generated while the record was checked.
    const generated = documentOf([masterTacitician], checked);
    const heldOn = (
      entry: PreviewEntry,
      reviewedRecords: readonly ReviewedPcgenRecord[],
    ) => {
      const result = gate([entry], generated, { reviewedRecords });
      expect(rowOf(result.admitted, entry.externalKey)).toBeUndefined();
      return rowOf(result.held, entry.externalKey)?.reason;
    };
    const held = (problem: string) =>
      `Held under #227: its reviewed PCGen record (reviewed-pcgen-records.json) is stale: ${problem}; without it, no PCGen match or stored assessment; only its class association names a book: Cavalier (PZO1115).`;
    expect(heldOn(masterTacitician, [tacticianRecord()])).toBe(
      held('pf1/mrJ61WiA6PuZgPTJ is drafted'),
    );
    expect(heldOn(masterTacitician, [])).toBe(
      held('no reviewed PCGen record names pf1/mrJ61WiA6PuZgPTJ'),
    );
    // The reviewer's probe: Foundry's body changed by one character.
    const revised = {
      ...masterTacitician,
      description: masterTacitician.description.replace('17th', '18th'),
    };
    expect(revised.description).not.toBe(masterTacitician.description);
    expect(heldOn(revised, checked)).toBe(
      held(
        `pf1/mrJ61WiA6PuZgPTJ's description is sha256:${sha256(revised.description)}, not the reviewed sha256:${tacitianBody}`,
      ),
    );
    // Another input of the same shape: the record now names another list.
    expect(
      heldOn(masterTacitician, [
        tacticianRecord(checkedReview, {
          file: ucClass,
          key: 'Cavalier ~ Master Tactician',
        }),
      ]),
    ).toBe(
      held(
        `the match reads ${apgClass}:206, but pf1/mrJ61WiA6PuZgPTJ's record names ${ucClass}`,
      ),
    );
    // Upstream drops the Cavalier's 17th-level row: the file as generated
    // still names the line, and the gate reads the class's rows itself.
    const cavalier = classes.find(({ name }) => name === 'Cavalier');
    if (cavalier?.detail.kind !== 'class') throw new Error('No Cavalier.');
    const withoutRow: PreviewEntry = {
      ...cavalier,
      detail: {
        ...cavalier.detail,
        featuresByLevel: cavalier.detail.featuresByLevel.filter(
          (row) => row.externalKey !== masterTacitician.externalKey,
        ),
      },
    };
    const heldWith = (classEntry: PreviewEntry) =>
      rowOf(
        gate([masterTacitician, classEntry], generated, {
          reviewedRecords: checked,
        }).held,
        masterTacitician.externalKey,
      )?.reason;
    expect(heldWith(withoutRow)).toBe(
      held(
        'no class row grants pf1/mrJ61WiA6PuZgPTJ as a feature of the class its PCGen key "Cavalier ~ Master Tactician" names (granted by: none)',
      ),
    );
    // Another input of the same shape: another class's row grants it instead.
    const samurai = classes.find(({ name }) => name === 'Samurai');
    if (samurai?.detail.kind !== 'class') throw new Error('No Samurai.');
    expect(
      rowOf(
        gate(
          [
            masterTacitician,
            withoutRow,
            {
              ...samurai,
              detail: {
                ...samurai.detail,
                featuresByLevel: [
                  { classLevel: 17, externalKey: masterTacitician.externalKey },
                ],
              },
            },
          ],
          generated,
          { reviewedRecords: checked },
        ).held,
        masterTacitician.externalKey,
      )?.reason,
    ).toBe(
      held(
        'no class row grants pf1/mrJ61WiA6PuZgPTJ as a feature of the class its PCGen key "Cavalier ~ Master Tactician" names (granted by: Samurai)',
      ),
    );
    // PCGen moved under the file: a line the gate cannot read may have
    // changed, so the file's PCGen binding must be the pin.
    const atPcgen = (
      pcgen: Partial<Attribution227Matches['binding']['pcgen']>,
    ) =>
      rowOf(
        gate(
          [masterTacitician, cavalier],
          {
            ...generated,
            binding: {
              ...generated.binding,
              pcgen: { ...generated.binding.pcgen, ...pcgen },
            },
          },
          { reviewedRecords: checked },
        ).held,
        masterTacitician.externalKey,
      )?.reason;
    expect(atPcgen({ commit: 'b'.repeat(40) })).toBe(
      held(
        `the matches file was read at PCGen ${'b'.repeat(40)} data/pathfinder/paizo, not the pinned ${pcgenPin.commit} ${pcgenPin.directory}`,
      ),
    );
    // Another input of the same shape: another data directory.
    expect(atPcgen({ directory: 'data/pathfinder/other' })).toBe(
      held(
        `the matches file was read at PCGen ${pcgenPin.commit} data/pathfinder/other, not the pinned ${pcgenPin.commit} ${pcgenPin.directory}`,
      ),
    );
    // Current, with the Cavalier's row, it admits as generated.
    expect(
      rowOf(
        gate([masterTacitician, cavalier], generated, {
          reviewedRecords: checked,
        }).admitted,
        masterTacitician.externalKey,
      ),
    ).toBeDefined();
  });

  it('refuses two records that claim one PCGen record or one Foundry record, when the list loads and wherever a list is read', () => {
    const list = (records: unknown[]) => ({ version: 1, records });
    const copied: ReviewedPcgenRecord = {
      ...tacticianRecord(checkedReview),
      externalKey: 'pf1/copiedLocator',
    };
    const sameTarget = `Two reviewed PCGen records claim ${apgClass}#Cavalier ~ Master Tactician: pf1/mrJ61WiA6PuZgPTJ, pf1/copiedLocator.`;
    // The reviewer's probe: a second checked record with the same file and KEY.
    expect(() =>
      parseReviewedPcgenRecords(list([tacticianRecord(checkedReview), copied])),
    ).toThrow(sameTarget);
    // Drafted, too: a copied locator refuses before any review.
    expect(() =>
      parseReviewedPcgenRecords(
        list([
          tacticianRecord(),
          { ...tacticianRecord(), externalKey: copied.externalKey },
        ]),
      ),
    ).toThrow(sameTarget);
    // A list given in memory is read the same way, by the matcher and the gate.
    const copiedEntry = {
      ...masterTacitician,
      externalKey: copied.externalKey,
    };
    expect(() =>
      documentOf(
        [masterTacitician, copiedEntry],
        [tacticianRecord(checkedReview), copied],
      ),
    ).toThrow(sameTarget);
    const generated = documentOf(
      [masterTacitician],
      [tacticianRecord(checkedReview)],
    );
    expect(() =>
      gate([masterTacitician], generated, {
        reviewedRecords: [tacticianRecord(checkedReview), copied],
      }),
    ).toThrow(sameTarget);
    // Another input of the same shape: one Foundry record claimed twice, on
    // two different PCGen records.
    expect(() =>
      documentOf(
        [masterTacitician],
        [
          tacticianRecord(checkedReview),
          tacticianRecord(checkedReview, {
            file: ucClass,
            key: 'Divine Strategist ~ Master Tactician',
          }),
        ],
      ),
    ).toThrow('Two reviewed PCGen records share pf1/mrJ61WiA6PuZgPTJ.');
  });

  it('refuses two records for one key and a review state without its fields', () => {
    const list = (records: unknown[]) => ({ version: 1, records });
    expect(() =>
      parseReviewedPcgenRecords(list([tacticianRecord(), tacticianRecord()])),
    ).toThrow('Two reviewed PCGen records share pf1/mrJ61WiA6PuZgPTJ.');
    const { status: _status, ...fields } = tacticianRecord();
    // @ts-expect-error A checked record names its reviewer, date and receipt.
    const unreceipted: ReviewedPcgenRecord = { ...fields, status: 'checked' };
    expect(() => parseReviewedPcgenRecords(list([unreceipted]))).toThrow(
      /"reviewedBy"/,
    );
    const draftedWithReceipt: ReviewedPcgenRecord = {
      ...fields,
      status: 'drafted',
      // @ts-expect-error A drafted record names no receipt.
      receipt: checkedReview.receipt,
    };
    expect(() => parseReviewedPcgenRecords(list([draftedWithReceipt]))).toThrow(
      'Unrecognized key: \\"receipt\\"',
    );
  });

  it('lists each record for the record step by its key and description hash, with its upstream name, PCGen record and evidence as payload', () => {
    const [record] = listReviewedPcgenRecordReviews({
      records: [tacticianRecord()],
    });
    expect(record).toMatchObject({
      id: `pcgen-record pf1/mrJ61WiA6PuZgPTJ sha256:${tacitianBody}`,
      sources: [
        { subject: 'pf1/mrJ61WiA6PuZgPTJ', sourceSha256: tacitianBody },
      ],
      review: { status: 'drafted' },
    });
    const payloadOf = (
      changed: Partial<
        Pick<ReviewedPcgenRecord, 'evidence' | 'pcgen' | 'upstreamName'>
      >,
    ) =>
      listReviewedPcgenRecordReviews({
        records: [{ ...tacticianRecord(), ...changed }],
      })[0]?.payloadSha256;
    expect(payloadOf({ evidence: 'Other evidence.' })).not.toBe(
      record?.payloadSha256,
    );
    expect(payloadOf({ upstreamName: 'Master Tacticien' })).not.toBe(
      record?.payloadSha256,
    );
    expect(
      payloadOf({
        pcgen: { file: ucClass, key: 'Divine Strategist ~ Master Tactician' },
      }),
    ).not.toBe(record?.payloadSha256);
  });
});

// Fix r3: a saved reviewed-record match carries the identity of the whole
// reviewed record that produced it (its ID, the hash of every field, the
// exact PCGen file and KEY with the matched line's own hash), and the gate
// applies it only while the checked record is that record. Every field of
// the record and of the saved match, changed alone, holds the row.
describe('a saved reviewed-record match is bound to the whole reviewed record (fix r3)', () => {
  const checked = tacticianRecord(checkedReview);
  const cavalier = classes.filter(({ name }) => name === 'Cavalier');
  // The matches file as generated while the record was checked.
  const generated = documentOf([masterTacitician], [checked]);
  const key = masterTacitician.externalKey;
  const rowsAt = (
    document: Attribution227Matches,
    reviewedRecords: readonly ReviewedPcgenRecord[],
  ) => {
    const result = gate([masterTacitician, ...cavalier], document, {
      reviewedRecords,
    });
    return {
      admitted: rowOf(result.admitted, key),
      held: rowOf(result.held, key)?.reason,
    };
  };
  const heldOnClass = (problem: string) =>
    `Held under #227: its reviewed PCGen record (reviewed-pcgen-records.json) is stale: ${problem}; without it, no PCGen match or stored assessment; only its class association names a book: Cavalier (PZO1115).`;
  const wholeRecord = new RegExp(
    `^Held under #227: its reviewed PCGen record \\(reviewed-pcgen-records\\.json\\) is stale: ${key}'s record is sha256:[a-f0-9]{64}, not the sha256:[a-f0-9]{64} the match was generated from; without it, no PCGen match or stored assessment; only its class association names a book: Cavalier \\(PZO1115\\)\\.$`,
  );

  it('binds the saved match to the record’s ID, the hash of the whole record and the exact PCGen record its line is', () => {
    const line206 = pcgenFiles
      .find(({ path }) => path === apgClass)
      ?.text.split(/\r\n|\r|\n/)[205];
    if (line206 === undefined) throw new Error('No APG line 206.');
    expect(matchOf(generated, key)).toMatchObject({
      evidence: [
        {
          kind: 'pcgen-fallback',
          rule: 'reviewed-record',
          book: 'PZO1115',
          file: apgClass,
          line: 206,
          key: 'Cavalier ~ Master Tactician',
          lineSha256: sha256(line206),
          record: {
            id: `pcgen-record ${key} sha256:${tacitianBody}`,
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          },
        },
      ],
    });
    // As generated, it admits.
    expect(rowsAt(generated, [checked]).admitted).toBeDefined();
  });

  it('takes an overriding scripted match only with its binding, so a caller cannot drop the pin', () => {
    const withBinding: AttributionPath = {
      kind: 'declared-book',
      rule: { ...committedAttribution227, exceptions: [] },
      matches: generated,
    };
    const withoutBinding: AttributionPath = {
      kind: 'declared-book',
      rule: { ...committedAttribution227, exceptions: [] },
      // @ts-expect-error The gate checks a reviewed-record match against the file's binding.
      matches: { matches: generated.matches },
    };
    expect(withBinding.kind).toBe(withoutBinding.kind);
  });

  it('holds the saved match when the checked record’s KEY becomes one its file lacks (the reviewers’ probe, Cavalier ~ Master Tactican)', () => {
    const typo = tacticianRecord(checkedReview, {
      file: apgClass,
      key: 'Cavalier ~ Master Tactican',
    });
    // A generation refuses it.
    expect(() => documentOf([masterTacitician], [typo])).toThrow(
      `${apgClass} has no line keyed "Cavalier ~ Master Tactican".`,
    );
    // The file as generated before the edit no longer admits.
    expect(rowsAt(generated, [typo])).toEqual({
      admitted: undefined,
      held: heldOnClass(
        `the match reads ${apgClass}:206 keyed "Cavalier ~ Master Tactician", but ${key}'s record names "Cavalier ~ Master Tactican"`,
      ),
    });
  });

  it('holds the saved match when the checked record’s KEY becomes another record of the same file (the reviewers’ probe, Cavalier ~ Greater Tactician)', () => {
    const greater = tacticianRecord(checkedReview, {
      file: apgClass,
      key: 'Cavalier ~ Greater Tactician',
    });
    // A generation selects line 202.
    expect(
      matchOf(documentOf([masterTacitician], [greater]), key),
    ).toMatchObject({ evidence: [{ file: apgClass, line: 202 }] });
    // The file as generated before the edit, on line 206, no longer admits.
    expect(rowsAt(generated, [greater])).toEqual({
      admitted: undefined,
      held: heldOnClass(
        `the match reads ${apgClass}:206 keyed "Cavalier ~ Master Tactician", but ${key}'s record names "Cavalier ~ Greater Tactician"`,
      ),
    });
  });

  // Each field of the reviewed record, changed alone after the generation.
  it.each<{
    field: string;
    change: (record: ReviewedPcgenRecord) => ReviewedPcgenRecord;
    held: string | RegExp;
  }>([
    {
      field: 'externalKey',
      change: (record) => ({ ...record, externalKey: 'pf1/anotherRecord' }),
      held: heldOnClass(`no reviewed PCGen record names ${key}`),
    },
    {
      field: 'upstreamName',
      change: (record) => ({ ...record, upstreamName: 'Master Tacticien' }),
      held: heldOnClass(
        `${key}'s record is reviewed for "Master Tacticien", not "Master Tacitician"`,
      ),
    },
    {
      field: 'descriptionSha256',
      change: (record) => ({ ...record, descriptionSha256: 'b'.repeat(64) }),
      held: heldOnClass(
        `${key}'s description is sha256:${tacitianBody}, not the reviewed sha256:${'b'.repeat(64)}`,
      ),
    },
    {
      field: 'pcgen.file',
      change: (record) => ({
        ...record,
        pcgen: { ...record.pcgen, file: ucClass },
      }),
      held: heldOnClass(
        `the match reads ${apgClass}:206, but ${key}'s record names ${ucClass}`,
      ),
    },
    {
      field: 'pcgen.key',
      change: (record) => ({
        ...record,
        pcgen: { ...record.pcgen, key: 'Cavalier ~ Tactician' },
      }),
      held: heldOnClass(
        `the match reads ${apgClass}:206 keyed "Cavalier ~ Master Tactician", but ${key}'s record names "Cavalier ~ Tactician"`,
      ),
    },
    {
      field: 'evidence',
      change: (record) => ({ ...record, evidence: 'Other evidence.' }),
      held: wholeRecord,
    },
    {
      field: 'status',
      change: (record) => ({ ...record, status: 'drafted' }) as never,
      held: heldOnClass(`${key} is drafted`),
    },
    {
      field: 'reviewedBy',
      change: (record) => ({ ...record, reviewedBy: 'Another reviewer' }),
      held: wholeRecord,
    },
    {
      field: 'reviewedOn',
      change: (record) => ({ ...record, reviewedOn: '2026-11-19' }),
      held: wholeRecord,
    },
    {
      field: 'receipt',
      change: (record) => ({
        ...record,
        receipt: `t3-review-${'c'.repeat(64)}`,
      }),
      held: wholeRecord,
    },
  ])(
    'holds the saved match when the record’s $field alone changes, naming the stale record',
    ({ change, held }) => {
      const rows = rowsAt(generated, [change(checked)]);
      expect(rows.admitted).toBeUndefined();
      if (typeof held === 'string') expect(rows.held).toBe(held);
      else expect(rows.held).toMatch(held);
    },
  );

  /** The generated file with one field of its reviewed match changed alone. */
  const editedMatch = (
    change: (match: MatchedAttribution227) => MatchedAttribution227,
  ): Attribution227Matches => ({
    ...generated,
    matches: generated.matches.map((item) =>
      item.externalKey === key && item.status === 'matched'
        ? change(item)
        : item,
    ),
  });
  const reviewedLine = (
    change: (line: ReviewedRecordLine) => Record<string, unknown>,
  ) =>
    editedMatch((match) => {
      const [line] = match.evidence;
      if (line?.kind !== 'pcgen-fallback' || line.rule !== 'reviewed-record')
        throw new Error('No reviewed line.');
      return {
        ...match,
        evidence: [change(line)],
      } as unknown as MatchedAttribution227;
    });
  const drifted = heldOnClass(
    'the matches file drifted from its binding.matchesSha256 (edited by hand?)',
  );
  const recordId = `pcgen-record ${key} sha256:${tacitianBody}`;
  const regenerate =
    "regenerate the matches (pnpm -s catalog:attribution-227-matches --write), the record step's next step";
  // Each field of the saved match, changed alone in the generated file.
  it.each<{
    field: string;
    document: () => Attribution227Matches;
    held: string | RegExp;
  }>([
    {
      field: 'externalKey',
      document: () =>
        editedMatch((match) => ({ ...match, externalKey: 'pf1/zMovedAway' })),
      held: `Held under #227: its reviewed PCGen record (reviewed-pcgen-records.json) is stale: ${recordId} is checked, but the matches file lists no match for ${key}; ${regenerate}; without it, no PCGen match or stored assessment names a book.`,
    },
    {
      field: 'name',
      document: () =>
        editedMatch((match) => ({ ...match, name: 'Master Tactician' })),
      held: heldOnClass(
        `the match was generated for classFeature "Master Tactician", not classFeature "Master Tacitician"`,
      ),
    },
    {
      field: 'kind',
      document: () => editedMatch((match) => ({ ...match, kind: 'feat' })),
      held: heldOnClass(
        `the match was generated for feat "Master Tacitician", not classFeature "Master Tacitician"`,
      ),
    },
    {
      field: 'evidence (a second item)',
      document: () =>
        editedMatch((match) => ({
          ...match,
          evidence: [
            ...match.evidence,
            { kind: 'pcgen', book: 'PZO1118', file: ucClass, line: 574 },
          ],
        })),
      held: heldOnClass(
        `its match reads more than its reviewed line (pcgen-fallback, pcgen)`,
      ),
    },
    {
      field: 'evidence rule',
      document: () =>
        reviewedLine(({ book, file, line }) => ({
          kind: 'pcgen-fallback',
          rule: 'word-order',
          book,
          file,
          line,
        })),
      held: heldOnClass(
        `${recordId} is checked, but its match reads no reviewed line (pcgen-fallback word-order); ${regenerate}`,
      ),
    },
    {
      field: 'evidence book',
      document: () => reviewedLine((line) => ({ ...line, book: 'PZO1129' })),
      held: heldOnClass(
        `the match reads ${apgClass}:206 as PZO1129's, but the crosswalk gives that list PZO1115`,
      ),
    },
    {
      field: 'evidence file',
      document: () => reviewedLine((line) => ({ ...line, file: ucClass })),
      held: heldOnClass(
        `the match reads ${ucClass}:206, but ${key}'s record names ${apgClass}`,
      ),
    },
    {
      field: 'evidence line',
      document: () => reviewedLine((line) => ({ ...line, line: 202 })),
      held: heldOnClass(
        `the match reads ${apgClass}:202, whose line in the pinned PCGen store is sha256:${sha256(apgLine(202))}, not the sha256:${sha256(apgLine(206))} it was generated from`,
      ),
    },
    {
      field: 'evidence key',
      document: () =>
        reviewedLine((line) => ({
          ...line,
          key: 'Cavalier ~ Greater Tactician',
        })),
      held: heldOnClass(
        `the match reads ${apgClass}:206 keyed "Cavalier ~ Greater Tactician", but ${key}'s record names "Cavalier ~ Master Tactician"`,
      ),
    },
    {
      field: 'evidence lineSha256',
      document: () =>
        reviewedLine((line) => ({ ...line, lineSha256: 'd'.repeat(64) })),
      held: heldOnClass(
        `the match reads ${apgClass}:206, whose line in the pinned PCGen store is sha256:${sha256(apgLine(206))}, not the sha256:${'d'.repeat(64)} it was generated from`,
      ),
    },
    {
      field: 'evidence record.id',
      document: () =>
        reviewedLine((line) => ({
          ...line,
          record: {
            ...line.record,
            id: `pcgen-record ${key} sha256:${'e'.repeat(64)}`,
          },
        })),
      held: heldOnClass(
        `the match was generated from pcgen-record ${key} sha256:${'e'.repeat(64)}, not pcgen-record ${key} sha256:${tacitianBody}`,
      ),
    },
    {
      field: 'evidence record.sha256',
      document: () =>
        reviewedLine((line) => ({
          ...line,
          record: { ...line.record, sha256: 'f'.repeat(64) },
        })),
      held: new RegExp(
        `^Held under #227: its reviewed PCGen record \\(reviewed-pcgen-records\\.json\\) is stale: ${key}'s record is sha256:[a-f0-9]{64}, not the sha256:${'f'.repeat(64)} the match was generated from; `,
      ),
    },
    {
      field: 'classes',
      document: () => editedMatch((match) => ({ ...match, classes: [] })),
      held: `Held under #227: its reviewed PCGen record (reviewed-pcgen-records.json) is stale: the matches file drifted from its binding.matchesSha256 (edited by hand?); without it, no PCGen match or stored assessment names a book.`,
    },
    {
      field: 'binding.matchesSha256',
      document: () => ({
        ...generated,
        binding: { ...generated.binding, matchesSha256: '0'.repeat(64) },
      }),
      held: drifted,
    },
  ])(
    'holds the saved match when its $field alone changes, naming the stale record',
    ({ document, held }) => {
      const rows = rowsAt(document(), [checked]);
      expect(rows.admitted).toBeUndefined();
      if (typeof held === 'string') expect(rows.held).toBe(held);
      else expect(rows.held).toMatch(held);
    },
  );
});

describe('a saved reviewed line is checked against the pinned PCGen store (fix r4)', () => {
  const checked = tacticianRecord(checkedReview);
  const cavalier = classes.filter(({ name }) => name === 'Cavalier');
  const generated = documentOf([masterTacitician], [checked]);
  const key = masterTacitician.externalKey;
  /**
   * The generated file with its reviewed line edited and its
   * `binding.matchesSha256` refreshed, as a mistaken repair leaves it.
   */
  const repaired = (
    change: (line: ReviewedRecordLine) => ReviewedRecordLine,
  ): Attribution227Matches => {
    const matches = generated.matches.map((item) => {
      if (item.externalKey !== key || item.status !== 'matched') return item;
      const [line] = item.evidence;
      if (line?.kind !== 'pcgen-fallback' || line.rule !== 'reviewed-record')
        throw new Error('No reviewed line.');
      return { ...item, evidence: [change(line)] } as MatchedAttribution227;
    });
    return {
      ...generated,
      matches,
      binding: { ...generated.binding, matchesSha256: matchesSha256(matches) },
    };
  };
  const heldOnClass = (problem: string) =>
    `Held under #227: its reviewed PCGen record (reviewed-pcgen-records.json) is stale: ${problem}; without it, no PCGen match or stored assessment; only its class association names a book: Cavalier (PZO1115).`;
  const rowsAt = (document: Attribution227Matches) => {
    const result = gate([masterTacitician, ...cavalier], document, {
      reviewedRecords: [checked],
    });
    return {
      admitted: rowOf(result.admitted, key),
      held: rowOf(result.held, key)?.reason,
    };
  };
  const edits = [
    {
      edit: 'the line number moved to 202 (the reviewer’s probe)',
      document: () => repaired((line) => ({ ...line, line: 202 })),
      problem: `the match reads ${apgClass}:202, whose line in the pinned PCGen store is sha256:${sha256(apgLine(202))}, not the sha256:${sha256(apgLine(206))} it was generated from`,
    },
    {
      edit: 'the book changed',
      document: () => repaired((line) => ({ ...line, book: 'PZO1129' })),
      problem: `the match reads ${apgClass}:206 as PZO1129's, but the crosswalk gives that list PZO1115`,
    },
    {
      edit: 'lineSha256 changed with the line number left alone',
      document: () =>
        repaired((line) => ({ ...line, lineSha256: 'd'.repeat(64) })),
      problem: `the match reads ${apgClass}:206, whose line in the pinned PCGen store is sha256:${sha256(apgLine(206))}, not the sha256:${'d'.repeat(64)} it was generated from`,
    },
    {
      edit: 'the line number and lineSha256 both moved to 202',
      document: () =>
        repaired((line) => ({
          ...line,
          line: 202,
          lineSha256: sha256(apgLine(202)),
        })),
      problem: `the match reads ${apgClass}:202, whose line in the pinned PCGen store is keyed "Cavalier ~ Greater Tactician", not "Cavalier ~ Master Tactician"`,
    },
  ];

  it('admits the generated file, whose reviewed line is the pinned line', () => {
    expect(rowsAt(generated).admitted).toBeDefined();
  });

  it.each(edits)(
    'holds the saved match when $edit and binding.matchesSha256 is refreshed, naming the pinned line',
    ({ document, problem }) => {
      expect(rowsAt(document())).toEqual({
        admitted: undefined,
        held: heldOnClass(problem),
      });
    },
  );

  it.each(edits)(
    'the matcher’s --check refuses the file when $edit, naming the row, though its binding.matchesSha256 is current',
    ({ document }) => {
      const edited = document();
      expect(
        attribution227MatchesDrift({
          document: edited,
          inputs: edited.binding.inputs,
          stored: noStored,
        }),
      ).toEqual([]);
      expect(matchesDifferences(edited.matches, generated.matches)).toEqual([
        `${key}: its committed match differs from a fresh one.`,
      ]);
    },
  );

  it('holds a reviewed-record match whose line its pinned list does not have, saying so', () => {
    const lookup = attribution227MatchLookup(generated, {
      reviewedRecords: [checked],
      grants: classGrantsOf([masterTacitician, ...cavalier]),
      readPinnedList: () => apgLine(1),
    });
    expect(lookup(masterTacitician)).toMatchObject({
      status: 'stale-reviewed-record',
      problem: `the match reads ${apgClass}:206, but the pinned PCGen store's list (tests/fixtures/pinned/pcgen/${pcgenPin.directory}/${apgClass}) has no line 206`,
    });
  });
});

describe('a checked reviewed record without its reviewed line is diagnosed (fix r4)', () => {
  const checked = tacticianRecord(checkedReview);
  const cavalier = classes.filter(({ name }) => name === 'Cavalier');
  const key = masterTacitician.externalKey;
  const id = `pcgen-record ${key} sha256:${tacitianBody}`;
  // The matches file as generated while the record was drafted: held on its
  // class association, as the record step finds it.
  const prePromotion = documentOf([masterTacitician], [tacticianRecord()]);
  const generated = documentOf([masterTacitician], [checked]);
  const heldRow = matchOf(prePromotion, key);
  const regenerate =
    "regenerate the matches (pnpm -s catalog:attribution-227-matches --write), the record step's next step";
  const heldOnClass = (problem: string) =>
    `Held under #227: its reviewed PCGen record (reviewed-pcgen-records.json) is stale: ${problem}; without it, no PCGen match or stored assessment; only its class association names a book: Cavalier (PZO1115).`;
  const heldReason = (document: Attribution227Matches) => {
    const result = gate([masterTacitician, ...cavalier], document, {
      reviewedRecords: [checked],
    });
    expect(rowOf(result.admitted, key)).toBeUndefined();
    return rowOf(result.held, key)?.reason;
  };
  /** The checked file with the pre-promotion held row copied back. */
  const copiedBack = (refreshed: boolean): Attribution227Matches => {
    const matches = generated.matches.map((item) =>
      item.externalKey === key && heldRow ? heldRow : item,
    );
    return {
      ...generated,
      matches,
      binding: refreshed
        ? { ...generated.binding, matchesSha256: matchesSha256(matches) }
        : generated.binding,
    };
  };

  it('holds the pre-promotion file’s association-only row, naming the record and the regeneration', () => {
    expect(heldRow).toMatchObject({
      status: 'held',
      hold: { kind: 'association-only' },
    });
    expect(heldReason(prePromotion)).toBe(
      heldOnClass(
        `${id} is checked, but the matches file holds ${key} association-only, without its reviewed line; ${regenerate}`,
      ),
    );
  });

  it.each([
    { binding: 'refreshed', refreshed: true },
    { binding: 'left drifted', refreshed: false },
  ])(
    'holds a held row copied back over the checked match, its binding.matchesSha256 $binding, with the same diagnosis',
    ({ refreshed }) => {
      expect(heldReason(copiedBack(refreshed))).toBe(
        heldOnClass(
          `${id} is checked, but the matches file holds ${key} association-only, without its reviewed line; ${regenerate}`,
        ),
      );
    },
  );

  it('holds a checked record the file lists no match for, naming the record and the regeneration', () => {
    const without = {
      ...generated,
      matches: generated.matches.filter((item) => item.externalKey !== key),
    };
    expect(heldReason(without)).toBe(
      `Held under #227: its reviewed PCGen record (reviewed-pcgen-records.json) is stale: ${id} is checked, but the matches file lists no match for ${key}; ${regenerate}; without it, no PCGen match or stored assessment names a book.`,
    );
  });

  it('holds a checked record whose match reads an ordinary line, naming the record and the regeneration', () => {
    const ordinary = {
      ...generated,
      matches: generated.matches.map((item) =>
        item.externalKey === key && item.status === 'matched'
          ? {
              ...item,
              evidence: [
                {
                  kind: 'pcgen' as const,
                  book: 'PZO1115',
                  file: apgClass,
                  line: 206,
                },
              ] as const,
            }
          : item,
      ),
    };
    expect(heldReason(ordinary)).toBe(
      heldOnClass(
        `${id} is checked, but its match reads no reviewed line (pcgen); ${regenerate}`,
      ),
    );
  });
});

describe('the committed reviewed PCGen records', () => {
  it('hold Master Tacitician’s record on the Cavalier’s APG key, drafted until the record step checks it, and it applies to its pinned record', () => {
    expect(
      committedReviewedPcgenRecords.map(
        ({ externalKey, upstreamName, pcgen }) =>
          `${externalKey} ${upstreamName} -> ${pcgen.file}#${pcgen.key}`,
      ),
    ).toEqual([
      `pf1/mrJ61WiA6PuZgPTJ Master Tacitician -> ${apgClass}#Cavalier ~ Master Tactician`,
    ]);
    const [record] = committedReviewedPcgenRecords;
    if (!record) throw new Error('No reviewed PCGen record.');
    // Bound to the pinned record's body.
    expect(record.descriptionSha256).toBe(tacitianBody);
    // Drafted it changes nothing; checked (as committed since
    // tactician-promote), it matches APG's line alone.
    expect(
      matchOf(
        documentOf([masterTacitician], committedReviewedPcgenRecords),
        masterTacitician.externalKey,
      ),
    ).toMatchObject(
      record.status === 'checked'
        ? { status: 'matched' }
        : { status: 'held', hold: { kind: 'association-only' } },
    );
    expect(
      matchOf(
        documentOf([masterTacitician], [{ ...record, ...checkedReview }]),
        masterTacitician.externalKey,
      ),
    ).toMatchObject({
      status: 'matched',
      evidence: [
        {
          kind: 'pcgen-fallback',
          rule: 'reviewed-record',
          book: 'PZO1115',
          file: apgClass,
          line: 206,
        },
      ],
    });
  });

  it('binds the reviewed PCGen records as a matcher input', async () => {
    expect(await readMatcherInputHashes('.')).toHaveProperty([
      'scripts/catalog/reviewed-pcgen-records.json',
    ]);
    expect(committedAttribution227Matches.binding.inputs).toHaveProperty([
      'scripts/catalog/reviewed-pcgen-records.json',
    ]);
  });

  it('binds the modules whose encodings the matcher shares with the gate: a list line’s object and a file’s book', async () => {
    const shared = [
      'scripts/catalog/pcgen-books.ts',
      'scripts/catalog/reviewed-pcgen-records.ts',
    ];
    expect(Object.keys(await readMatcherInputHashes('.'))).toEqual(
      expect.arrayContaining(shared),
    );
    expect(Object.keys(committedAttribution227Matches.binding.inputs)).toEqual(
      expect.arrayContaining(shared),
    );
  });
});

// Root, 2026-11-20: a reviewed-record match is never admitted while the gate
// cannot read its pinned line. Where the gate reads a list the pinned store
// lacks (`requirePinnedPcgenLists`), it stops with an error naming the list
// and the record; what other readers print in that state is not specified,
// and the `reviewed-line-unverified-*.test.ts` files test the property on the
// readers they name, each beside a control with the list present.
describe('a pinned PCGen list missing from the store stops the gate’s read with its error', () => {
  const checked = tacticianRecord(checkedReview);
  const drafted = tacticianRecord();
  const cavalier = classes.filter(({ name }) => name === 'Cavalier');
  const key = masterTacitician.externalKey;
  const apgPath = `tests/fixtures/pinned/pcgen/${pcgenPin.directory}/${apgClass}`;
  /** Generated with the record checked: the file has its reviewed-record line. */
  const withLine = documentOf([masterTacitician], [checked]);
  /** Generated with the record drafted: no reviewed-record line. */
  const withoutLine = documentOf([masterTacitician], [drafted]);
  const missing = `The pinned PCGen list ${apgPath} is missing from the pinned store, and the matches file's reviewed-record line for ${key} (${reviewedPcgenRecordIdentity(checked).id}) is read there: restore the pinned store (git checkout -- tests/fixtures/pinned) and run the command again.`;
  const loseList = () => absent.paths.add(apgPath);
  const rowsAt = (
    document: Attribution227Matches,
    record: ReviewedPcgenRecord,
  ) => {
    const result = gate([masterTacitician, ...cavalier], document, {
      reviewedRecords: [record],
    });
    return {
      admitted: result.admitted.map(({ externalKey, reason }) => [
        externalKey,
        reason,
      ]),
      held: result.held.map(({ externalKey, reason }) => [externalKey, reason]),
    };
  };

  it('has the reviewed-record line in the file generated with the record checked, and none drafted', () => {
    expect(JSON.stringify(withLine.matches)).toContain('"reviewed-record"');
    expect(JSON.stringify(withoutLine.matches)).not.toContain(
      '"reviewed-record"',
    );
  });

  // Preview, release, launch verification and conditions all assess
  // admission through `assessCatalogAdmission`'s default reader.
  describe('the gate', () => {
    it('admits the row on its reviewed line with the list present', () => {
      expect(rowsAt(withLine, checked).admitted.map(([row]) => row)).toContain(
        key,
      );
    });

    it('stops with the error when a reviewed-record line reads the missing list', () => {
      loseList();
      expect(() => rowsAt(withLine, checked)).toThrow(missing);
    });

    it('stops with it too when the record went back to drafted and the file still has the line', () => {
      loseList();
      expect(() => rowsAt(withLine, drafted)).toThrow(missing);
    });

    it('changes nothing with the record drafted and no reviewed-record line', () => {
      const present = rowsAt(withoutLine, drafted);
      loseList();
      expect(rowsAt(withoutLine, drafted)).toEqual(present);
    });
  });

  describe('the launch verification’s binding', () => {
    it('binds the list a reviewed-record line reads, at its bytes', async () => {
      const { inputs } = await launchVerificationInputs('.', withLine);
      expect(inputs[apgPath]).toBe(sha256(readFileSync(apgPath, 'utf8')));
    });

    it('stops with the error when that list is missing', async () => {
      loseList();
      await expect(launchVerificationInputs('.', withLine)).rejects.toThrow(
        missing,
      );
    });

    it('neither binds nor needs the list without a reviewed-record line', async () => {
      const present = await launchVerificationInputs('.', withoutLine);
      expect(present.inputs).not.toHaveProperty(apgPath);
      loseList();
      expect((await launchVerificationInputs('.', withoutLine)).inputs).toEqual(
        present.inputs,
      );
    });

    it('still refuses another missing input as before', async () => {
      absent.paths.add('scripts/catalog/reviewed-remaps.json');
      await expect(launchVerificationInputs('.', withoutLine)).rejects.toThrow(
        'Missing bound verification input scripts/catalog/reviewed-remaps.json.',
      );
    });
  });

  // `catalog:launch-inventory`'s arguments (parsed first, reading no file;
  // the script then reads the pinned lists, which
  // `reviewed-line-unverified-commands.test.ts` drives) and its verify mode
  // (`runLaunchVerification`).
  describe('catalog:launch-inventory', () => {
    const modes = [
      ['--verify'],
      ['--verify', '--check'],
      ['--verify', '--write'],
      ['--check'],
      ['--write'],
      ['--report'],
      [],
    ].map((flags) => ({ flags, mode: flags.join(' ') || 'no flag' }));

    it.each(modes)(
      'parses its arguments ($mode) without reading the pinned store: the same with the list missing',
      ({ flags }) => {
        const parse = () => launchInventoryArguments(flags);
        for (const missing of [false, true]) {
          if (missing) loseList();
          if (flags.length === 1 && flags[0] === '--verify')
            expect(parse).toThrow('--verify needs --write or --check.');
          else expect(parse()).toEqual(new Set(flags));
        }
      },
    );

    it.each([true, false])(
      'the verify mode (write: %s) ends in the error, writes nothing and prints nothing',
      async (write) => {
        const directory = mkdtempSync(join(tmpdir(), 'launch-verification-'));
        const projection = join(directory, 'campaign-mvp-v1.verification.json');
        writeFileSync(projection, 'committed\n');
        let printed = '';
        loseList();
        await expect(
          runLaunchVerification({
            write,
            // The build binds its inputs first (`buildLaunchVerification`).
            build: async () => {
              await launchVerificationInputs('.', withLine);
              throw new Error('The build went on past its binding.');
            },
            projection,
            print: (text) => {
              printed += text;
            },
          }),
        ).rejects.toThrow(missing);
        expect(readFileSync(projection, 'utf8')).toBe('committed\n');
        expect(printed).toBe('');
      },
    );
  });
});
