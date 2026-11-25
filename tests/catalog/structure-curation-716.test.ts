// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseCuration } from '../../scripts/catalog/curation';
import { parseIdentityLedger } from '../../scripts/catalog/everythingpath-identities';
import { pcgenPin } from '../../scripts/catalog/inventory';
import type { PreviewEntry } from '../../scripts/catalog/map';
import {
  applyStructureCuration,
  hashStructureSource,
  type StructureReviewItem,
  type StructureSourcePart,
  type StructureSubject,
} from '../../scripts/catalog/structure-curation';
import { readPinned } from './pinned-sources';

// A checked record names its review receipt (#757); these cases don't check
// receipts, so they cite #716 P6's rules review.
const reviewer = {
  reviewedBy: 'reviewer',
  reviewedOn: '2026-10-17',
  receipt: 'reviewer-20261018-081620-1216172',
};
/** A record as written before its review: drafted, with no reviewer fields. */
const drafted = (record: object) => ({
  ...Object.fromEntries(
    Object.entries(record).filter(([key]) => !Object.hasOwn(reviewer, key)),
  ),
  status: 'drafted',
});
const noVariantDecisions = parseIdentityLedger({
  pcgenCommit: pcgenPin.commit,
  identities: [],
  variantDecisions: [],
  locatorRemaps: [],
  heldSources: [],
  retirements: [],
}).variantDecisions;

async function pinnedLines(file: string) {
  return (await readPinned('pcgen', `${pcgenPin.directory}/${file}`)).split(
    /\r?\n/,
  );
}
function readPart(
  file: string,
  lines: string[],
  line: number,
): StructureSourcePart {
  const text = lines[line - 1] ?? '';
  const key =
    /\tKEY:([^\t]+)/.exec(text)?.[1] ??
    /^CATEGORY=Archetype\|(.+)\.MOD\t/.exec(text)?.[1];
  if (!key) throw new Error(`No KEY on ${file}:${line}.`);
  return {
    source: { source: 'pcgen', locator: { file, line, key } },
    text,
  };
}
const descOf = ({ text }: StructureSourcePart) =>
  /\tDESC:([^\t]+)/.exec(text)?.[1] ?? '';

function entryOf(externalKey: string, name: string): PreviewEntry {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack: 'pcgen',
    name,
    detail: { kind: 'classFeature' },
    description: `<p>${name}</p>`,
    sources: [],
    modifiers: [],
    unsupported: [],
  };
}
/** A mapped entry for one PCGen record, with its source hash. */
function subjectOf(externalKey: string, part: StructureSourcePart) {
  const { file, key } =
    part.source.source === 'pcgen'
      ? part.source.locator
      : { file: '', key: '' };
  return {
    entry: entryOf(externalKey, key),
    sourceSha256: hashStructureSource([part]),
    locator: `pcgen:${file}#${key}`,
  } satisfies StructureSubject;
}
const refOf = ({ entry, sourceSha256 }: StructureSubject) => ({
  externalKey: entry.externalKey,
  sourceSha256,
});

// Archer, Advanced Player's Guide p.104, as PCGen 25523dbc records it: the
// archetype line, its one `.MOD` line, and the eight features its ABILITY
// grants own directly (plan §2, §6).
const apg = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const apgLines = await pinnedLines(apg);
const apgPart = (line: number) => readPart(apg, apgLines, line);
function archerSubjects() {
  const feature = (id: string, line: number) =>
    subjectOf(`everythingpath/fighter-archer-${id}`, apgPart(line));
  return {
    archer: {
      entry: entryOf('everythingpath/fighter-archer', 'Archer'),
      sourceSha256: hashStructureSource([apgPart(2102), apgPart(3667)]),
      locator: `pcgen:${apg}#Fighter Archetype ~ Archer`,
    },
    hawkeye: feature('hawkeye', 2118),
    trickShot: feature('trick-shot', 2119),
    expertArcher: feature('expert-archer', 2120),
    safeShot: feature('safe-shot', 2121),
    evasiveArcher: feature('evasive-archer', 2122),
    volley: feature('volley', 2123),
    rangedDefense: feature('ranged-defense', 2124),
    weaponMastery: feature('weapon-mastery', 2125),
  };
}
const archerFeatureLines = {
  hawkeye: 2118,
  trickShot: 2119,
  expertArcher: 2120,
  safeShot: 2121,
  evasiveArcher: 2122,
  volley: 2123,
  rangedDefense: 2124,
  weaponMastery: 2125,
};
const fixed = archerSubjects();

// PCGen grants Archer's Weapon Mastery at Fighter 1, and its TYPE names no
// Fighter feature, so the mapper can't match what it alters. The book has it
// restrict the fighter's Weapon Mastery choice to a bow
// (docs/catalog-import/archetypes.md, "Archer application").
const weaponMasteryType =
  'TYPE:ClassFeatures.FighterClassFeatures.SpecialQuality.Extraordinary';
const weaponMasteryItem: StructureReviewItem = {
  ...refOf(fixed.weaponMastery),
  kind: 'unmatchedReplacement',
  id: weaponMasteryType,
  fields: ['situationalNotes'],
  text: 'Fighter Archer ~ Weapon Mastery names no replaced Fighter feature.',
};
const weaponMasteryNote = { text: descOf(apgPart(2125)) };
const weaponMasteryRecord = {
  ...refOf(fixed.weaponMastery),
  fields: { situationalNotes: [weaponMasteryNote] },
  resolves: [
    { kind: 'unmatchedReplacement', id: weaponMasteryType },
    {
      kind: 'ownedFeature',
      id: `pcgen:${apg}#Fighter Archer ~ Weapon Mastery`,
    },
  ],
  status: 'checked' as const,
  rationale:
    'APG p.104: "An archer must choose a type of bow." It alters the fighter\'s Weapon Mastery; kept as a note.',
  ...reviewer,
};

function gate({
  subjects = Object.values(fixed),
  items = [],
  ownedFeatures = [],
  structures,
  variantDecisions = noVariantDecisions,
}: {
  subjects?: StructureSubject[];
  items?: StructureReviewItem[];
  ownedFeatures?: Parameters<typeof applyStructureCuration>[0]['ownedFeatures'];
  structures: unknown[];
  variantDecisions?: typeof noVariantDecisions;
}) {
  return applyStructureCuration({
    subjects,
    items,
    ownedFeatures,
    data: parseCuration({ records: [], structures }),
    variantDecisions,
  });
}

describe('structure records (#716 P2, plan §6)', () => {
  it('hashes upstream records by upstream key and raw text, not line number', () => {
    const weaponMastery = apgPart(2125);
    // sha256 of `[["pcgen:<file>#Fighter Archer ~ Weapon Mastery","<line>"]]`,
    // computed outside the importer.
    expect(fixed.weaponMastery.sourceSha256).toBe(
      '5a7a9c9928e610b43fa5e568fc2a9a31b93943456e186ebcd89691a03c61cc65',
    );
    expect(
      hashStructureSource([
        {
          ...weaponMastery,
          source: {
            source: 'pcgen',
            locator: {
              file: apg,
              line: 1,
              key: 'Fighter Archer ~ Weapon Mastery',
            },
          },
        },
      ]),
    ).toBe(fixed.weaponMastery.sourceSha256);
  });

  it('a checked record replaces its bound fields and records overlay provenance', () => {
    const subjects = archerSubjects();
    const report = gate({
      subjects: [subjects.weaponMastery],
      items: [weaponMasteryItem],
      structures: [weaponMasteryRecord],
    });

    const { entry } = subjects.weaponMastery;
    expect(entry.situationalNotes).toEqual([
      { text: 'An archer must choose a type of bow.' },
    ]);
    expect(entry.provenance).toEqual({
      situationalNotes: {
        source: 'overlay',
        locator: {
          externalKey: entry.externalKey,
          kind: 'structure',
          target: 'situationalNotes',
        },
      },
    });
    expect(report.passed).toBe(true);
    expect(report.held).toEqual([]);
  });

  it('a drafted record applies nothing and leaves its item in hand review', () => {
    const subjects = archerSubjects();
    const report = gate({
      subjects: [subjects.weaponMastery],
      items: [weaponMasteryItem],
      structures: [
        drafted(weaponMasteryRecord),
      ],
    });

    expect(subjects.weaponMastery.entry.situationalNotes).toBeUndefined();
    expect(subjects.weaponMastery.entry.provenance).toBeUndefined();
    expect(report.passed).toBe(false);
    expect(report.held).toEqual([fixed.weaponMastery.entry.externalKey]);
    expect(report.handReview).toEqual([weaponMasteryItem]);
    expect(report.summary).toMatchObject({
      drafted: 1,
      checked: 0,
      handReview: 1,
    });
  });

  it('a changed source hash makes a checked record stale; it applies nothing', () => {
    // Reviewed against Archer's own line before its `.MOD` line was merged
    // in: the merged entity hashes differently.
    const reviewedAgainst = hashStructureSource([apgPart(2102)]);
    const item: StructureReviewItem = {
      ...refOf(fixed.archer),
      kind: 'unmatchedReplacement',
      id: 'TYPE:FighterBravery',
      fields: ['description'],
      text: 'Bravery increases are held only in a PCGen formula (plan §4).',
    };
    const record = {
      externalKey: fixed.archer.entry.externalKey,
      sourceSha256: reviewedAgainst,
      fields: { description: `<p>${descOf(apgPart(2102))}</p>` },
      resolves: [{ kind: 'unmatchedReplacement', id: 'TYPE:FighterBravery' }],
      status: 'checked' as const,
      rationale: 'Reviewed against the archetype line alone.',
      ...reviewer,
    };
    const elsewhere = {
      ...record,
      externalKey: 'everythingpath/fighter-crossbowman',
    };
    const report = gate({
      subjects: [archerSubjects().archer],
      items: [item],
      structures: [record, elsewhere],
    });

    expect(reviewedAgainst).not.toBe(fixed.archer.sourceSha256);
    expect(report.stale).toEqual([record]);
    expect(report.unused).toEqual([elsewhere]);
    expect(report.applied).toEqual([]);
    expect(report.held).toEqual([fixed.archer.entry.externalKey]);
  });

  it('an item naming fields needs its settling record to bind them', () => {
    const report = gate({
      subjects: [archerSubjects().weaponMastery],
      items: [{ ...weaponMasteryItem, fields: ['situationalNotes', 'name'] }],
      structures: [weaponMasteryRecord],
    });

    expect(report.handReview).toHaveLength(1);
    expect(report.passed).toBe(false);
  });
});

describe('settling review items (#716 P2, plan §6)', () => {
  // The mappers that raise these kinds land in P3–P6; Archer's Weapon
  // Mastery stands in as the subject of each.
  const kinds = [
    'unmatchedReplacement',
    'uncheckedCasting',
    'variant',
    'conflict',
    'productIdentity',
    'option',
    'unsupportedKind',
  ] as const;
  const otherKind = (kind: (typeof kinds)[number]) =>
    kind === 'conflict' ? 'variant' : 'conflict';
  const record = (resolves: { kind: string; id: string }[]) => ({
    ...refOf(fixed.weaponMastery),
    fields: { situationalNotes: [weaponMasteryNote] },
    resolves,
    status: 'checked' as const,
    rationale: 'Checked against APG p.104.',
    ...reviewer,
  });

  it.each(kinds)('a %s item is settled only by a record naming it', (kind) => {
    const item: StructureReviewItem = {
      ...refOf(fixed.weaponMastery),
      kind,
      id: weaponMasteryType,
      text: `A ${kind} item.`,
    };
    const subjects = [archerSubjects().weaponMastery];
    for (const unrelated of [
      [],
      [{ kind: otherKind(kind), id: weaponMasteryType }],
      [{ kind, id: 'TYPE:FighterWeaponMastery' }],
    ])
      expect(
        gate({ subjects, items: [item], structures: [record(unrelated)] })
          .handReview,
        JSON.stringify(unrelated),
      ).toEqual([item]);
    const settled = gate({
      subjects,
      items: [item],
      structures: [record([{ kind, id: weaponMasteryType }])],
    });
    expect(settled.handReview).toEqual([]);
    expect(settled.passed).toBe(true);
  });

  it('a noMechanics disposition settles only the owned features it names', () => {
    const safeShot = archerSubjects().safeShot;
    const owned = {
      ...refOf(safeShot),
      owner: `pcgen:${apg}#Fighter Archetype ~ Archer`,
      locator: safeShot.locator,
    };
    const item: StructureReviewItem = {
      ...refOf(safeShot),
      kind: 'unsupportedKind',
      id: 'TYPE:FighterWeaponTraining2',
      text: 'An unsupported kind on Safe Shot.',
    };
    const report = gate({
      subjects: [safeShot],
      items: [item],
      ownedFeatures: [owned],
      structures: [
        {
          ...refOf(safeShot),
          fields: {},
          noMechanics: true,
          resolves: [{ kind: 'ownedFeature', id: safeShot.locator }],
          status: 'checked',
          rationale:
            'Not provoking attacks of opportunity with a bow is not calculated on the sheet.',
          ...reviewer,
        },
      ],
    });

    expect(report.unreviewedFeatures).toEqual([]);
    expect(report.handReview).toEqual([item]);
    expect(() =>
      parseCuration({
        records: [],
        structures: [
          {
            ...refOf(safeShot),
            fields: {},
            noMechanics: true,
            resolves: [{ kind: 'unsupportedKind', id: item.id }],
            status: 'checked',
            rationale: 'Nothing to structure.',
            ...reviewer,
          },
        ],
      }),
    ).toThrow(/names the owned features it settles/);
  });
});

describe('owned-feature gate (#716 P2, plan §6)', () => {
  const featureNames = Object.keys(
    archerFeatureLines,
  ) as (keyof typeof archerFeatureLines)[];
  const owned = featureNames.map((name) => ({
    ...refOf(fixed[name]),
    owner: fixed.archer.locator,
    locator: fixed[name].locator,
  }));
  const settles = (name: keyof typeof archerFeatureLines) => [
    { kind: 'ownedFeature', id: fixed[name].locator },
  ];
  // Readable notes from each feature's own PCGen DESC (APG p.104); the
  // numbers wait for the Fighter schedule slice (plan §4, P5).
  const noted = (name: keyof typeof archerFeatureLines) => ({
    ...refOf(fixed[name]),
    fields: {
      situationalNotes: [{ text: descOf(apgPart(archerFeatureLines[name])) }],
    },
    resolves: settles(name),
    status: 'checked' as const,
    rationale:
      'Checked against the APG p.104 text PCGen carries; numbers left as text.',
    ...reviewer,
  });
  const safeShot = {
    ...refOf(fixed.safeShot),
    fields: {},
    noMechanics: true,
    resolves: settles('safeShot'),
    status: 'checked' as const,
    rationale:
      'Not provoking attacks of opportunity with a bow is not calculated on the sheet.',
    ...reviewer,
  };

  it('holds every owned feature no checked record names', () => {
    const report = gate({
      items: [weaponMasteryItem],
      ownedFeatures: owned,
      structures: [
        weaponMasteryRecord,
        safeShot,
        drafted(noted('volley')),
        // Checked, but it doesn't name Hawkeye as settled.
        { ...noted('hawkeye'), resolves: [] },
      ],
    });

    expect(report.passed).toBe(false);
    expect(report.handReview).toEqual([]);
    expect(report.held).toEqual([
      'everythingpath/fighter-archer-evasive-archer',
      'everythingpath/fighter-archer-expert-archer',
      'everythingpath/fighter-archer-hawkeye',
      'everythingpath/fighter-archer-ranged-defense',
      'everythingpath/fighter-archer-trick-shot',
      'everythingpath/fighter-archer-volley',
    ]);
    expect(report.summary).toMatchObject({
      ownedFeatures: 8,
      unreviewedFeatures: 6,
      checked: 3,
      drafted: 1,
      noMechanics: 1,
    });
  });

  it("passes once each of Archer's eight owned features is settled", () => {
    const subjects = archerSubjects();
    const report = gate({
      subjects: Object.values(subjects),
      items: [weaponMasteryItem],
      ownedFeatures: owned,
      structures: [
        weaponMasteryRecord,
        safeShot,
        noted('hawkeye'),
        noted('trickShot'),
        noted('expertArcher'),
        noted('evasiveArcher'),
        noted('volley'),
        noted('rangedDefense'),
      ],
    });

    expect(report.passed).toBe(true);
    expect(report.applied).toHaveLength(7);
    expect(subjects.volley.entry.situationalNotes).toEqual([
      {
        text: 'At 17th level, as a full-round action, an archer can make a single bow attack at his highest base attack bonus against any number of creatures in a 15-foot radius burst, making separate attack and damage rolls for each creature. This ability replaces weapon training 4.',
      },
    ]);
  });
});

// Plan §1's two-book prestige variants: ISWG's and AG's Hellknight each own
// their own pack's `~ HK` features, so the variants stay two records under
// one key until a reviewed variant decision (plan §5).
const iswg = 'campaign_setting/inner_sea_world_guide/iswg_abilities_class.lst';
const ag = 'roleplaying_game/adventurers_guide/ag_abilities_class.lst';
const [iswgLines, agLines] = await Promise.all([
  pinnedLines(iswg),
  pinnedLines(ag),
]);
const iswgPart = (line: number) => readPart(iswg, iswgLines, line);
const agPart = (line: number) => readPart(ag, agLines, line);
// Lawbringer: ISWG p.279, AG p.91 (each line's SOURCEPAGE).
const lawbringers = () => ({
  iswg: subjectOf('everythingpath/hellknight-lawbringer', iswgPart(61)),
  ag: subjectOf('everythingpath/hellknight-lawbringer', agPart(199)),
});
const sourcesRecord = (
  subject: StructureSubject,
  book: string,
  pages: string,
) => ({
  ...refOf(subject),
  fields: { sources: [{ book, pages }] },
  resolves: [{ kind: 'ownedFeature', id: subject.locator }],
  status: 'checked' as const,
  rationale: `${book} p.${pages}, the line's SOURCEPAGE.`,
  ...reviewer,
});

// A checked reprint decision over ISWG's and AG's Lawbringer, taking ISWG's
// mechanics, bound to the hash of each record it reviewed (P6). `reviewedAt`
// replaces a record's bound text, as if the decision had reviewed another
// version of it.
function lawbringerDecision(reviewedAt: { iswg?: string; ag?: string } = {}) {
  const parts = [iswgPart(61), agPart(199)];
  const [iswgText, agText] = [reviewedAt.iswg, reviewedAt.ag];
  const bound = parts.map((part, index) => ({
    source: part.source,
    sourceSha256: hashStructureSource([
      { ...part, text: [iswgText, agText][index] ?? part.text },
    ]),
  }));
  const sources = parts.map(({ source }) => source);
  return parseIdentityLedger({
    pcgenCommit: pcgenPin.commit,
    identities: [
      {
        externalKey: 'everythingpath/hellknight-lawbringer',
        kind: 'prestigeClassFeature',
        sources,
      },
    ],
    variantDecisions: [
      {
        decision: 'same-identity',
        externalKey: 'everythingpath/hellknight-lawbringer',
        sources: bound,
        mechanicsFrom: sources[0],
        review: {
          status: 'checked',
          rationale: 'Both lines carry the same DESC; a reprint.',
          evidence: `${iswg}:61, ${ag}:199`,
          ...reviewer,
        },
      },
    ],
    locatorRemaps: [],
    heldSources: [],
    retirements: [],
  }).variantDecisions;
}

describe('source variants (#716 P2, plan §5)', () => {
  it('counts a same-key variant in another book as its own feature', () => {
    const discipline = [
      subjectOf('everythingpath/hellknight-discipline', iswgPart(75)),
      subjectOf('everythingpath/hellknight-discipline', agPart(204)),
    ];
    const owned = discipline.map((subject) => ({
      ...refOf(subject),
      owner: 'everythingpath/hellknight',
      locator: subject.locator,
    }));
    const [iswgDiscipline, agDiscipline] = discipline;
    if (!iswgDiscipline || !agDiscipline) throw new Error('Two variants.');
    const report = gate({
      subjects: discipline,
      ownedFeatures: owned,
      structures: [
        {
          ...refOf(iswgDiscipline),
          fields: {},
          noMechanics: true,
          resolves: [{ kind: 'ownedFeature', id: iswgDiscipline.locator }],
          status: 'checked',
          rationale: 'An internal PCGen variable holder (TYPE:Internal).',
          ...reviewer,
        },
      ],
    });

    expect(iswgDiscipline.sourceSha256).not.toBe(agDiscipline.sourceSha256);
    expect(report.summary).toMatchObject({
      ownedFeatures: 2,
      unreviewedFeatures: 1,
    });
    expect(report.unreviewedFeatures).toEqual([owned[1]]);
  });

  it('applies each variant record to its own entry', () => {
    const variants = lawbringers();
    const report = gate({
      subjects: [variants.iswg, variants.ag],
      structures: [
        sourcesRecord(variants.iswg, 'Inner Sea World Guide', '279'),
        {
          ...refOf(variants.ag),
          fields: { description: `<p>${descOf(agPart(199))}</p>` },
          status: 'checked',
          rationale: "AG p.91, the line's DESC.",
          ...reviewer,
        },
      ],
    });

    expect(report.passed).toBe(true);
    expect(variants.iswg.entry.sources).toEqual([
      { book: 'Inner Sea World Guide', pages: '279' },
    ]);
    expect(variants.iswg.entry.description).toBe('<p>Lawbringer ~ HK</p>');
    expect(variants.ag.entry.sources).toEqual([]);
    expect(variants.ag.entry.description).toBe(
      '<p>Your attacks are treated as lawful for overcoming damage reduction.</p>',
    );
  });

  it('holds variants that compete for a field without a variant decision', () => {
    const variants = lawbringers();
    const report = gate({
      subjects: [variants.iswg, variants.ag],
      structures: [
        sourcesRecord(variants.iswg, 'Inner Sea World Guide', '279'),
        sourcesRecord(variants.ag, "Adventurer's Guide", '91'),
      ],
    });

    expect(report.passed).toBe(false);
    expect(report.conflicts).toEqual([
      { externalKey: 'everythingpath/hellknight-lawbringer', field: 'sources' },
    ]);
    expect(report.applied).toEqual([]);
    expect(variants.iswg.entry.sources).toEqual([]);
    expect(variants.ag.entry.sources).toEqual([]);
  });

  it('applies the variant a checked same-identity decision takes mechanics from', () => {
    const variants = lawbringers();
    const agRecord = sourcesRecord(variants.ag, "Adventurer's Guide", '91');
    const report = gate({
      subjects: [variants.iswg, variants.ag],
      structures: [
        sourcesRecord(variants.iswg, 'Inner Sea World Guide', '279'),
        agRecord,
      ],
      variantDecisions: lawbringerDecision(),
    });

    expect(report.passed).toBe(true);
    expect(report.superseded).toEqual([agRecord]);
    expect(variants.iswg.entry.sources).toEqual([
      { book: 'Inner Sea World Guide', pages: '279' },
    ]);
    expect(variants.ag.entry.sources).toEqual([]);
  });
  // P6: a decision binds every reviewed record's hash, so a change to either
  // record, the one it doesn't take mechanics from included, reopens it.
  it.each([
    [
      'the selected record (ISWG)',
      { iswg: 'Lawbringer ~ HK, an earlier text' },
    ],
    [
      'the record it supersedes (AG)',
      { ag: 'Lawbringer ~ HK, an earlier text' },
    ],
  ])(
    'holds both variants when the decision reviewed another version of %s',
    (_, reviewedAt) => {
      const variants = lawbringers();
      const report = gate({
        subjects: [variants.iswg, variants.ag],
        structures: [
          sourcesRecord(variants.iswg, 'Inner Sea World Guide', '279'),
          sourcesRecord(variants.ag, "Adventurer's Guide", '91'),
        ],
        variantDecisions: lawbringerDecision(reviewedAt),
      });

      expect(report.passed).toBe(false);
      expect(report.conflicts).toEqual([
        {
          externalKey: 'everythingpath/hellknight-lawbringer',
          field: 'sources',
        },
      ]);
      expect(report.superseded).toEqual([]);
      expect(variants.iswg.entry.sources).toEqual([]);
    },
  );

  it('holds a third variant the decision did not review, and supersedes nothing', () => {
    const variants = lawbringers();
    // SYNTHETIC, in test memory only: PCGen has just two `Lawbringer ~ HK`
    // records, so a third book's copy is AG's real row under a made-up file.
    const third = subjectOf('everythingpath/hellknight-lawbringer', {
      ...agPart(199),
      source: {
        source: 'pcgen',
        locator: {
          file: 'synthetic/third_book_abilities_class.lst',
          line: 199,
          key: 'Lawbringer ~ HK',
        },
      },
    });
    const report = gate({
      subjects: [variants.iswg, variants.ag, third],
      structures: [
        sourcesRecord(variants.iswg, 'Inner Sea World Guide', '279'),
        sourcesRecord(variants.ag, "Adventurer's Guide", '91'),
        sourcesRecord(third, 'Third Book', '1'),
      ],
      variantDecisions: lawbringerDecision(),
    });

    expect(report.passed).toBe(false);
    expect(report.conflicts).toEqual([
      { externalKey: 'everythingpath/hellknight-lawbringer', field: 'sources' },
    ]);
    expect(report.superseded).toEqual([]);
    expect(report.applied).toEqual([]);
    for (const subject of [variants.iswg, variants.ag, third])
      expect(subject.entry.sources).toEqual([]);
  });
});

describe('structure record validation (#716 P2)', () => {
  const structures =
    (...records: unknown[]) =>
    () =>
      parseCuration({ records: [], structures: records });

  it('holds a record whose field or value does not fit its entry', () => {
    for (const fields of [
      { name: null },
      { sources: 0 },
      // `page` is not a source field: the schema would drop it silently.
      { sources: [{ book: "Advanced Player's Guide", page: '104' }] },
      // Classes have feature schedules; class features don't.
      { 'detail.featuresByLevel': [] },
    ]) {
      const subjects = archerSubjects();
      const report = gate({
        subjects: [subjects.weaponMastery],
        structures: [{ ...weaponMasteryRecord, fields }],
      });
      expect(report.passed, JSON.stringify(fields)).toBe(false);
      expect(report.invalid).toHaveLength(1);
      expect(report.applied).toEqual([]);
      expect(subjects.weaponMastery.entry.sources).toEqual([]);
    }
  });

  it('rejects overlapping field sets, double settlement and a noMechanics disposition beside fields', () => {
    expect(
      structures(weaponMasteryRecord, {
        ...weaponMasteryRecord,
        fields: { situationalNotes: [], description: '<p>x</p>' },
        resolves: [],
      }),
    ).toThrow(/Two structure records bind situationalNotes/);
    expect(
      structures(weaponMasteryRecord, {
        ...weaponMasteryRecord,
        fields: { description: '<p>x</p>' },
      }),
    ).toThrow(/Two structure records settle/);
    expect(
      structures(weaponMasteryRecord, {
        ...weaponMasteryRecord,
        fields: {},
        noMechanics: true,
        resolves: [{ kind: 'ownedFeature', id: 'x' }],
      }),
    ).toThrow(/noMechanics structure record must be the only one/);
    expect(structures({ ...weaponMasteryRecord, noMechanics: true })).toThrow(
      /fields or is a noMechanics disposition/,
    );
    expect(structures({ ...weaponMasteryRecord, fields: {} })).toThrow(
      /fields or is a noMechanics disposition/,
    );
  });

  it('rejects identity, bookkeeping and unknown fields', () => {
    for (const field of [
      'externalKey',
      'upstreamKey',
      'detail',
      'detail.kind',
      'provenance',
      'unsupported',
      'replaces',
      'detail.parentFeatre',
      'detail.parent.feature',
    ])
      expect(
        structures({ ...weaponMasteryRecord, fields: { [field]: 'x' } }),
        field,
      ).toThrow(/Not a field a structure record can replace/);
    // A checked record names its reviewer.
    expect(
      structures({ ...weaponMasteryRecord, reviewedBy: undefined }),
    ).toThrow(/"path": \[\s*"structures",\s*0,\s*"reviewedBy"\s*\]/);
  });

  it('leaves an overlay without structure records as it was', () => {
    expect(parseCuration({ records: [] })).toEqual({
      records: [],
      situations: [],
    });
  });
});
