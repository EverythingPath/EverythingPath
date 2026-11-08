// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { listCurationFormulaIssues } from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  collectReferences,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { calculateCharacterSheet } from '../../src/lib/character-sheet';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  review,
  assessedAbilities,
  excludedFolders,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/pf-special-qualities-501/data';
import {
  abilityDefinition,
  abilitySheet,
} from '../fixtures/pf-special-qualities-501/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const HOLD = 'pf-special-qualities-501';
function candidate(name: string) {
  const row = assessedAbilities.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function entry(name: string) {
  const row = preview.entries.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing entry ${name}`);
  return row;
}
const key = (name: string) => candidate(name).externalKey;
const detailOf = (name: string) => {
  const { detail } = entry(name);
  if (detail.kind !== 'itemAbility') throw new Error(name);
  return detail;
};
const normalize = (text: string) =>
  text
    .replace(/<\/?(?:em|strong|i|b)>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

// The pinned tag "Universal Armor & Shield Qualities" (#764) imports as
// armorOrShield; Brawling is an armor quality tagged Melee Qualities and
// Defiant (Armor) covers shields under an Armor Qualities tag.
const UNIVERSAL_TAG = [
  'Energy Resistance, Greater',
  'Energy Resistance, Improved',
  'Fitting',
  'Fortification (light)',
  'Jarring',
  'Poison-Resistant',
  'Spell Resistance (19)',
  'Undead Controlling',
];

it('imports the pinned Universal Armor & Shield Qualities as armor-or-shield abilities (#764)', async () => {
  const keys = UNIVERSAL_TAG.map(key);
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: keys,
    });
    const imported = new Map(
      artifact.catalog.entries.map((row) => [row.name, row.detail]),
    );
    for (const name of UNIVERSAL_TAG) {
      expect(candidate(name).sourceFields.tags, name).toEqual([
        'Universal Armor & Shield Qualities',
      ]);
      expect(imported.get(name), name).toMatchObject({
        kind: 'itemAbility',
        appliesTo: 'armorOrShield',
      });
    }
  } finally {
    await tree.dispose();
  }
});

// #764: a curated foeEnhancement reaches the stored detail. The pinned Bane
// (CRB p. 469): "+2 better than its actual bonus" against the foe.
it('maps a curated designated-foe enhancement onto the imported Item Ability', async () => {
  const bane = 'pf1-content/src/pf-special-qualities/Bane_aaAmYJA3sBANIVeZ.yaml';
  const tree = await materializePinnedTree([bane]);
  try {
    const bounded = { ...tree, remaps, candidateKeys: ['pf1-content/aaAmYJA3sBANIVeZ'] };
    const uncurated = await importCatalog({
      ...bounded,
      curation: { situations: reviewedCuration.situations, records: [] },
    });
    const [input] = uncurated.curation.missing;
    if (!input) throw new Error('Bane has no Item Ability curation input');
    const artifact = await importCatalog({
      ...bounded,
      curation: {
        situations: reviewedCuration.situations,
        records: [
          {
            ...input,
            status: 'drafted',
            outputs: [
              {
                kind: 'itemAbility',
                bonusEquivalent: 1,
                choice: 'creatureType',
                foeEnhancement: 2,
              },
            ],
            rationale: 'Test overlay of the pinned Bane body.',
            diagnostics: [],
            seedBindings: [],
          },
        ],
      },
    });
    expect(artifact.catalog.entries[0]?.detail).toMatchObject({
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      choice: 'creatureType',
      foeEnhancement: 2,
    });
  } finally {
    await tree.dispose();
  }
});

// #764: Huntsman's "weapon's enhancement bonus" is an Item Ability formula;
// the same formula on another kind of entry is unsupported.
it('admits the item-enhancement formula on Item Ability records only', () => {
  const [record] = candidate('Huntsman').mechanicsReview.curationRecords;
  const huntsman = reviewedCuration.records.find(
    (row) => row.externalKey === record?.externalKey && row.kind === 'itemAbility',
  );
  if (!huntsman) throw new Error('Missing Huntsman record');
  expect(huntsman.outputs).toContainEqual(
    expect.objectContaining({ value: { formula: '@item.enhancement' } }),
  );
  expect(listCurationFormulaIssues({ record: huntsman })).toEqual([]);
  expect(
    listCurationFormulaIssues({ record: { ...huntsman, kind: 'note' } }),
  ).toEqual([expect.objectContaining({ field: 'curation.formula' })]);
});

it('excludes the two folders and holds all 98 Item Abilities on named whole-content and appliesTo holds', () => {
  expect(review.candidates).toHaveLength(100);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 98,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 2,
    excludedFolders: 2,
    recordLevel35Holds: 0,
  });
  expect(excludedFolders.map((row) => row.name).sort()).toEqual([
    'Ranged Weapons',
    'Weapons',
  ]);
  for (const row of assessedAbilities) {
    expect([row.disposition, row.assessmentStatus], row.name).toEqual([
      'held',
      'unresolved',
    ]);
    expect(row.holdIds[0], row.name).toBe(
      `${HOLD}-whole-content-${row.externalKey.split('/')[1]}`,
    );
    expect(row.rationale.startsWith(row.holdIds[0]!), row.name).toBe(true);
    // No permitted source states a complete body: PCGen EQMOD rows only
    // summarize, and the pinned PRD capture has no magic item pages.
    expect(
      [row.comparison, ...row.additionalComparisonLeads].every(
        (comparison) => !comparison?.completeDirectComparison,
      ),
      row.name,
    ).toBe(true);
  }
  const appliesTo = assessedAbilities
    .filter((row) => row.holdIds.some((id) => id.includes('-applies-to-')))
    .map((row) => row.name)
    .sort();
  expect(appliesTo).toEqual(['Brawling', 'Defiant (Armor)']);
  for (const name of UNIVERSAL_TAG) {
    expect(detailOf(name).appliesTo, name).toBe('armorOrShield');
    expect(candidate(name).sourceFields.tags, name).toEqual([
      'Universal Armor & Shield Qualities',
    ]);
  }
  expect(detailOf('Brawling').appliesTo).toBe('melee');
  expect(detailOf('Defiant (Armor)').appliesTo).toBe('armor');
});

it('derives each bonus equivalent from the price line and maps the structured mechanics', () => {
  const tiers: Record<string, number> = {
    'Spell Resistance (19)': 5,
    'Fortification (light)': 1,
  };
  for (const row of assessedAbilities) {
    const price = row.mechanicsReview.itemAbilityReview.priceLine ?? '';
    const plus = /^\+(\d) bonus$/.exec(price);
    const expected = tiers[row.name] ?? (plus ? Number(plus[1]) : 0);
    if (!(row.name in tiers) && !plus) expect(price, row.name).toMatch(/gp/);
    expect(detailOf(row.name).bonusEquivalent, row.name).toBe(expected);
    expect(row.mechanicsReview.itemAbilityReview.bonusEquivalent).toBe(
      expected,
    );
  }
  expect(detailOf('Corrosive Burst').damageDice).toEqual([
    { on: 'hit', dice: '1d6', damageType: 'acid' },
    { on: 'crit', dice: '1d10', damageType: 'acid' },
  ]);
  // Huntsman's die is structured under its local Situation (#764); the other
  // situational dice stay Notes until their records are curated with them.
  expect(
    preview.entries
      .filter(
        (row) => row.detail.kind === 'itemAbility' && row.detail.damageDice,
      )
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Corrosive Burst', 'Huntsman', 'Sapping']);
  expect(detailOf('Huntsman').damageDice).toEqual([
    {
      on: 'hit',
      dice: '1d6',
      damageType: 'untyped',
      situation: {
        local:
          'against a creature the wielder has tracked with Survival in the past day',
      },
    },
  ]);
  expect(detailOf('Sapping').damageDice).toEqual([
    { on: 'hit', dice: '2d6', damageType: 'nonlethal' },
  ]);
  for (const name of ['Smashing', 'Neutralizing', 'Valiant', 'Blood-Hunting'])
    expect(
      entry(name).situationalNotes?.filter((note) => note.target === 'damage'),
      name,
    ).toHaveLength(1);
  expect(
    Object.fromEntries(
      assessedAbilities
        .filter((row) => detailOf(row.name).weaponDamageTypes)
        .map((row) => [row.name, detailOf(row.name).weaponDamageTypes]),
    ),
  ).toEqual({
    Underwater: ['bludgeoning', 'slashing'],
    Smashing: ['bludgeoning'],
    Flamboyant: ['piercing'],
    Bloodsong: ['piercing', 'slashing'],
    Vorpal: ['slashing'],
  });
  expect(entry('Speed').sourceKey).toBe('haste');
  // Bashing's sourceKey names its hand-written shield-bash rule (#764).
  expect(entry('Bashing').sourceKey).toBe('bashing');
  expect(
    preview.entries
      .filter((row) => row.sourceKey)
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Bashing', 'Speed']);
  expect(detailOf('Defiant (Armor)').choice).toBe('creatureType');
  expect(
    preview.entries
      .filter(
        (row) => row.detail.kind === 'itemAbility' && row.detail.doublesThreat,
      )
      .map((row) => row.name),
  ).toEqual([]);
});

it('curates Modifiers only where a sheet statistic and Situation fit the body exactly', () => {
  const modifiers = Object.fromEntries(
    preview.entries
      .filter((row) => row.modifiers.length)
      .map((row) => [
        row.name,
        row.modifiers.map(({ target, bonusType, value, condition }) => [
          target,
          bonusType,
          value,
          condition?.weapon ??
            (typeof condition?.situation === 'object' &&
            'local' in condition.situation
              ? 'local'
              : (condition?.situation ?? null)),
        ]),
      ]),
  );
  expect(modifiers).toEqual({
    Adhesive: [['cmb', 'enhancement', 2, 'local']],
    'Arrow Catching': [['ac', 'deflection', 1, 'local']],
    Bashing: [
      ['attack', 'enhancement', 1, '$self'],
      ['damage', 'enhancement', 1, '$self'],
    ],
    Brawling: [
      ['attack', 'untyped', 2, 'local'],
      ['damage', 'untyped', 2, 'local'],
      ['cmb', 'untyped', 2, 'local'],
    ],
    Corsair: [['skill.acr', 'competence', 5, null]],
    Delving: [['saves', 'untyped', 4, 'local']],
    Fervent: [
      ['skill.blf', 'insight', 4, 'local'],
      ['skill.dis', 'insight', 4, 'local'],
      ['skill.slt', 'insight', 4, 'local'],
    ],
    'Greater Aquadynamic': [['skill.swm', 'competence', 15, null]],
    // "the weapon's enhancement bonus on Survival checks made to track any
    // creature the weapon has damaged in the past day" (#764).
    Huntsman: [
      ['skill.sur', 'enhancement', { formula: '@item.enhancement' }, 'local'],
    ],
    Malevolent: [
      ['skill.blf', 'competence', 2, 'local'],
      ['skill.int', 'competence', 2, 'local'],
    ],
    'Mind Buttressing': [['save.will', 'resistance', 2, null]],
    Neutralizing: [['saves', 'competence', 2, 'local']],
    'Poison-Resistant': [['saves', 'resistance', 3, 'poison']],
    Repositioning: [['cmb', 'enhancement', 2, 'reposition']],
    Runeforged: [
      ['saves', 'morale', 2, 'local'],
      ['skill.dip', 'untyped', -2, null],
      ['attack', 'untyped', -5, 'local'],
      ['save.will', 'untyped', -5, 'local'],
      ['skills', 'untyped', -5, 'local'],
      ['init', 'insight', 2, 'local'],
      ['ac', 'dodge', 1, 'local'],
    ],
    'Shadow, Greater': [['skill.ste', 'competence', 15, null]],
    'Slick, Greater': [['skill.esc', 'competence', 15, null]],
    'Slick, Improved': [['skill.esc', 'competence', 10, null]],
    'Sniping (greater)': [['skill.ste', 'competence', 15, 'local']],
    Sticky: [['cmb', 'untyped', 2, 'local']],
    Valiant: [
      ['cmb', 'untyped', 2, 'local'],
      ['cmd', 'untyped', 4, 'local'],
    ],
  });
  // The shared Situations match the body's condition exactly.
  for (const [name, situation] of [
    ['Poison-Resistant', 'poison'],
    ['Repositioning', 'reposition'],
  ] as const)
    expect(
      reviewedCuration.situations.find((row) => row.key === situation),
      name,
    ).toBeDefined();
});

it('checks one itemAbility record per ability, whose Notes are the body’s own sentences', () => {
  for (const row of assessedAbilities) {
    const records = row.mechanicsReview.curationRecords;
    expect(
      records.map((record) => [record.kind, record.target]),
      row.name,
    ).toEqual([['itemAbility', 'description']]);
    const [record] = records;
    expect(record?.status).toBe('checked');
    expect(record?.diagnostics).toEqual([]);
    expect(record?.reviewedBy).toBe('Opus (AI curator) for the owner');
    expect(record?.text).toBe(row.mechanicsReview.descriptionText);
    expect(
      reviewedCuration.records.filter(
        (current) => current.externalKey === row.externalKey,
      ),
      row.name,
    ).toEqual([record]);
    const body = normalize(row.mechanicsReview.descriptionText);
    for (const output of record?.outputs ?? [])
      if (output.kind === 'note')
        expect(body, `${row.name}: ${output.text}`).toContain(
          output.text.replace(/\s+/g, ' '),
        );
    const notes = entry(row.name).situationalNotes ?? [];
    expect(notes.map((note) => note.text)).toEqual(
      (record?.outputs ?? []).flatMap((output) =>
        output.kind === 'note' ? [output.text] : [],
      ),
    );
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' ')).not.toContain(text);
  }
  // Only Corrosive Burst keeps the helper seed it uses.
  expect(
    assessedAbilities
      .filter(
        (row) => row.mechanicsReview.curationRecords[0]?.seedBindings.length,
      )
      .map((row) => row.name),
  ).toEqual(['Corrosive Burst']);
});

it('records the cited, compared, inherited and base-record notices and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) => `${HOLD}-notice-${book}-complete-chain`;
  for (const row of assessedAbilities) {
    expect(row.requiredNotices[0], row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const comparison of [row.comparison, ...row.additionalComparisonLeads])
      if (comparison)
        expect(row.requiredNotices, row.name).toContain(comparison.book);
    for (const notice of row.inheritedRuleNotices)
      expect(row.requiredNotices, row.name).toContain(notice.book);
    for (const source of row.inheritedRuleSourceEvidence)
      expect(
        source.sources.some((book) => row.requiredNotices.includes(book.id)),
        row.name,
      ).toBe(true);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
    // No body links a catalog entry, and no record has an action: no
    // closure dependency and no Unchained action cost (PZO1131).
    expect(row.closureDependencies, row.name).toEqual([]);
    expect(row.requiredNotices, row.name).not.toContain('PZO1131');
    expect(
      collectReferences(entry(row.name) as unknown as PreviewEntry),
      row.name,
    ).toEqual([]);
  }
  // Books a body inherits beyond its own and the Core Rulebook.
  const inherited = Object.fromEntries(
    assessedAbilities
      .map((row): [string, string[]] => [
        row.name,
        [
          ...new Set(
            row.inheritedRuleNotices
              .map((notice) => notice.book)
              .filter(
                (book) =>
                  book !== 'PZO1110' &&
                  !row.citedSources.some((cited) => cited.book === book),
              ),
          ),
        ],
      ])
      .filter(([, books]) => books.length),
  );
  expect(inherited).toEqual({
    Adhesive: ['PZO1115'],
    'Blood-Hunting': ['PZO1123'],
    Bloodsong: ['PZO1123'],
    Corsair: ['PZO1118', 'PZO1129'],
    'Dread Wing': ['PZO1112'],
    'Dry Load': ['PZO1118'],
    Flying: ['PZO1123'],
    'Ki Intensifying': ['PZO1115'],
    Planestriking: ['PZO1123'],
    Repositioning: ['PZO1115'],
    Runeforged: ['PZO1123'],
    Rusting: ['PZO1112'],
    Sticky: ['PZO1115'],
    Valiant: ['PZO1115'],
  });
  // Rejected PCGen rows (another item's or another ability's) add no book.
  expect(candidate('Brawling').requiredNotices).not.toContain('PZO1129');
  expect(candidate('Jarring').requiredNotices).toEqual(['PZO1110', 'PZO1129']);
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      continue;
    }
    expect(held.get(row.holdId ?? ''), row.book).toEqual([
      row.book,
      ...row.registryKeys.filter((key) => key !== row.book),
    ]);
    for (const key of row.candidates)
      expect(candidate(key).noticeHoldIds).toContain(row.holdId);
  }
});

it('pins all 100 keys, the complete bodies, base records and literal PCGen evidence in the shared store', async () => {
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(preview.entries).toHaveLength(98);
  expect(preview.closure).toEqual([]);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    if (row.kind === 'folder') {
      expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
      continue;
    }
    expect([raw._key, raw.type]).toEqual([`!items!${raw._id}`, 'feat']);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(raw.system).toEqual(row.sourceFields);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    expect(entry(row.externalKey).sources).toEqual(row.citedSources);
    for (const source of row.inheritedRuleSourceEvidence)
      expect(sha(await readPinned(source.repo, source.path))).toBe(
        source.sha256,
      );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of assessedAbilities)
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      if (!comparison) continue;
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      const lines = (
        await readFile(`tests/fixtures/pinned/pcgen/${comparison.path}`, 'utf8')
      ).split(/\r?\n/);
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
  // The Core Rulebook rows state the tiers' numbers only as summaries.
  expect(candidate('Shadow, Greater').comparison?.literalRow).toMatch(
    /^Shadow \(Greater\)\t.*BONUS:SKILL\|STEALTH\|15\|TYPE=COMPETENCE/,
  );
  expect(candidate('Arrow Catching').comparison?.literalRow).toContain(
    'SPROP:attracts ranged weapons to it; grants +1 deflection bonus vs ranged weapons',
  );
});

it('reextracts the abilities from a clean shared fixture tree, holds all 98 and reproduces every binding', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: review.candidates.map((row) => row.externalKey),
    });
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 98,
      drafted: 0,
      checked: 98,
      missing: 0,
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedAbilities.map((row) => row.externalKey).sort());
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.externalKey);
      expect(
        {
          detail: row.detail,
          modifiers: row.modifiers,
          situationalNotes: row.situationalNotes,
          sourceKey: row.sourceKey,
          sources: row.sources,
          unsupported: row.unsupported,
        },
        row.name,
      ).toEqual({
        detail: saved.detail,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sourceKey: saved.sourceKey,
        sources: saved.sources,
        unsupported: saved.unsupported,
      });
    }
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: preview.entries as unknown as typeof artifact.catalog.entries,
      },
    };
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted).toEqual([]);
    expect(gate.failures).toEqual([]);
    expect(
      gate.held.map((row) => [row.externalKey, row.reason]).sort(),
    ).toEqual(
      assessedAbilities.map((row) => [row.externalKey, row.rationale]).sort(),
    );
    for (const row of assessedAbilities) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: row.assessmentStatus,
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: authoritative.catalog.entries.find(
            (candidate) => candidate.externalKey === row.externalKey,
          )!,
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // Confirming Greater Shadow would still hold it on its notices
    // (PZO1123); a changed reviewed Modifier invalidates its binding.
    const shadow = key('Shadow, Greater');
    const confirmed = reviewedAdmission.assessments.map((row) =>
      row.externalKey === shadow
        ? { ...row, status: 'confirmed' as const }
        : row,
    );
    expect(
      assessWithUnclearedHolds({
        artifact: authoritative,
        ...reviewedAdmission,
        assessments: confirmed,
      }).held.find((row) => row.externalKey === shadow)?.reason,
    ).toMatch(/PZO1123/);
    const changed = {
      ...authoritative,
      catalog: {
        ...authoritative.catalog,
        entries: authoritative.catalog.entries.map((row) =>
          row.externalKey === shadow ? { ...row, modifiers: [] } : row,
        ),
      },
    };
    expect(
      assessCatalogAdmission({
        artifact: changed,
        ...reviewedAdmission,
        assessments: confirmed,
      }).held.find((row) => row.externalKey === shadow)?.reason,
    ).toContain('no longer matches current content');
  } finally {
    await tree.dispose();
  }
});

it('calculates the reviewed outputs through the resolver on armor, a shield and a sword', () => {
  const sheet = abilitySheet({
    items: [
      {
        id: 'sword',
        definition: 'longsword',
        state: {
          enhancement: 1,
          abilities: [
            { catalogEntryId: key('Corrosive Burst') },
            { catalogEntryId: key('Speed') },
          ],
        },
      },
      {
        id: 'shield',
        definition: 'heavy-shield',
        state: {
          enhancement: 1,
          abilities: [
            { catalogEntryId: key('Arrow Catching') },
            { catalogEntryId: key('Bashing') },
          ],
        },
      },
      {
        id: 'plate',
        definition: 'full-plate',
        state: {
          enhancement: 1,
          abilities: [
            { catalogEntryId: key('Shadow, Greater') },
            { catalogEntryId: key('Mind Buttressing') },
          ],
        },
      },
    ],
    abilities: [
      'Corrosive Burst',
      'Speed',
      'Arrow Catching',
      'Bashing',
      'Shadow, Greater',
      'Mind Buttressing',
    ].map(key),
    routines: [
      {
        id: 'routine',
        weapon: 'sword',
        offHand: { kind: 'weapon', weaponEntryId: 'shield', mode: 'melee' },
      },
    ],
  });
  const calculated = calculateCharacterSheet(sheet);
  // Stealth: Dex +1, Greater Shadow +15 competence, armor check penalty
  // -6 (full plate -5 as masterwork, heavy steel shield -1).
  expect(calculated.breakdowns['skill.ste'].total).toBe(1 + 15 - 6);
  expect(calculated.breakdowns['skill.ste'].applied).toContainEqual(
    expect.objectContaining({
      bonusType: 'competence',
      value: 15,
      entryName: 'Shadow, Greater',
    }),
  );
  // Will: Mind Buttressing's +2 resistance.
  expect(calculated.derivedStatistics.will.total).toBe(2);
  // Arrow Catching's +1 deflection applies only against ranged weapons.
  expect(calculated.derivedStatistics.ac.total).toBe(10 + 10 + 3 + 1);
  expect(calculated.breakdowns['ac.other'].conditional).toEqual([
    expect.objectContaining({
      bonusType: 'deflection',
      value: 1,
      condition: { situation: { local: 'against ranged weapons' } },
    }),
  ]);
  const [routine] = calculated.attackRoutines;
  const main = routine?.full.filter((line) => line.hand === 'main') ?? [];
  // Corrosive Burst: 1d6 acid on a hit and 1d10 acid on a critical hit.
  expect(
    main[0]?.extraDamage.map(({ dice, on, damageType }) => ({
      dice,
      on,
      damageType,
    })),
  ).toEqual([
    { dice: '1d6', on: 'hit', damageType: 'acid' },
    { dice: '1d10', on: 'crit', damageType: 'acid' },
  ]);
  // Speed (#764): "one extra attack with it" at the full base attack bonus:
  // BAB 11's three iterative attacks and one more at the first's bonus.
  expect(main).toHaveLength(4);
  expect(main[1]?.extraAttack).toEqual({
    kind: 'haste',
    sheetEntryId: 'sword',
    name: 'Speed',
  });
  expect(main[1]?.attackBonus.total).toBe(main[0]?.attackBonus.total);
  // Bashing (#764): the bash "acts as a +1 weapon" and deals damage "as if it
  // were a weapon of two size categories larger (... a Medium heavy shield
  // deals 1d8)": 11 + 3 - 10 + 1, Strength 1 + 1, 1d8.
  const bash = routine?.full.find((line) => line.hand === 'off');
  expect([
    bash?.attackBonus.total,
    bash?.damageBonus.total,
    bash?.damageDice,
  ]).toEqual([5, 2, '1d8']);
  for (const name of ['Speed', 'Bashing', 'Huntsman'])
    expect(
      candidate(name).mechanicsReview.outstandingCalculations,
      name,
    ).toEqual([]);
});

it('places the Universal Armor & Shield Qualities on armor or a shield', () => {
  for (const name of UNIVERSAL_TAG)
    expect(abilityDefinition(key(name)).detail, name).toMatchObject({
      appliesTo: 'armorOrShield',
    });
});

it("re-binds #367's Fortified (Shadow Lodge), whose closure holds Fortification (light)", () => {
  const fortified = 'pf1-content/2V8vm122Y4d4WzCZ';
  const read = (path: string): unknown =>
    JSON.parse(readFileSync(path, 'utf8'));
  const traits367 = read('scripts/catalog/legal/traits-367.json') as {
    candidates: {
      externalKey: string;
      currentBinding: { noticeFingerprints: Record<string, string> };
    }[];
  };
  const traits367Preview = read('tests/fixtures/traits-367/preview.json') as {
    closure: { externalKey: string }[];
  };
  const row = traits367.candidates.find(
    (candidate) => candidate.externalKey === fortified,
  );
  const assessment = reviewedAdmission.assessments.find(
    (a) => a.externalKey === fortified,
  );
  // Notice fingerprints follow the current Registry (the notice-hold
  // clearance's PRD records re-bound them on 2026-10-30).
  expect(assessment).toMatchObject(
    row ? bindSnapshotToCurrentNotices(row.currentBinding) : {},
  );
  expect(
    traits367Preview.closure.find(
      (copy) => copy.externalKey === key('Fortification (light)'),
    ),
  ).toEqual(entry('Fortification (light)'));
});

it("keeps the batch's own rows as its inventory records them", () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/pf-special-qualities-501.json',
    ),
  ).toEqual([]);
});
