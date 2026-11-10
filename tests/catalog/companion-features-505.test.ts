// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
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
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheet } from '../../src/lib/character-sheet';
import { representativeFamiliarProgression } from '../../src/lib/catalog/representative-familiars';
import {
  assessedCandidates,
  review,
  preview,
  linkedKeys,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/companion-features-505/data';
import {
  familiarAtMasterLevel,
  familiarSheet,
  previewResource,
} from '../fixtures/companion-features-505/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
// The committed rows are the full-corpus preview's own output, checked by the
// imported entry schema, whose optional detail fields are wider than the
// importer's type; the binding code reads them as imported, as
// cross-batch-bindings.ts does.
function asPreviewEntries(rows: typeof preview.entries) {
  return rows as unknown as PreviewEntry[];
}
const resources = asPreviewEntries(preview.entries);
const closureEntries = asPreviewEntries(preview.closure);
function candidate(name: string) {
  const row = assessedCandidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
const UNCHAINED_HOLD = 'companion-features-505-notice-PZO1131-complete-chain';
const admittedNames = [
  'Alertness',
  'Improved Evasion',
  'Share Spells',
  'Empathic Link',
  'Deliver Touch Spells',
  'Speak with Master',
  'Speak with Animals of Its Kind',
  'Spell Resistance',
];
const heldNames = ['Familiar', 'Scry on Familiar'];

it('admits the eight CRB familiar abilities and holds the Familiar and Scry on Familiar on the pending Unchained notice', () => {
  expect(review.counts).toEqual({
    total: 11,
    admitted: 8,
    held: 2,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 1,
    excludedFolders: 1,
    recordLevel35Holds: 0,
  });
  const folder = review.candidates.find(
    (row) => row.disposition === 'excluded',
  );
  expect(folder).toMatchObject({
    externalKey: 'pf1/NY5BdmnNcdiNt1PL',
    name: 'Familiar Features',
    kind: 'folder',
  });
  expect(
    reviewedAdmission.assessments.map((row) => row.externalKey),
  ).not.toContain('pf1/NY5BdmnNcdiNt1PL');
  for (const name of admittedNames)
    expect(candidate(name), name).toMatchObject({
      disposition: 'admitted',
      assessmentStatus: 'confirmed',
      requiredNotices: ['PZO1110'],
      holdIds: [],
      noticeHoldIds: [],
      citedSources: [{ book: 'PZO1110', pages: '83' }],
    });
  // Unchained action costs anywhere in the bound closure require PZO1131:
  // Scry on Familiar's own Use action, and the Familiar through it.
  for (const name of heldNames)
    expect(candidate(name), name).toMatchObject({
      disposition: 'held',
      assessmentStatus: 'confirmed',
      requiredNotices: ['PZO1110', 'PZO1131'],
      holdIds: [],
      noticeHoldIds: [UNCHAINED_HOLD],
    });
  const scry = candidate('Scry on Familiar').sourceFields as {
    actions: { activation: { unchained?: unknown } }[];
  };
  expect(scry.actions[0]?.activation.unchained).toEqual({ type: 'hour' });
  const byKey = new Map(
    [...resources, ...closureEntries].map((row) => [row.externalKey, row]),
  );
  for (const row of assessedCandidates) {
    const seen = new Set<string>();
    const stack = [row.externalKey];
    while (stack.length) {
      const key = stack.pop()!;
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = byKey.get(key);
      if (entry) stack.push(...collectReferences(entry));
    }
    const closure = JSON.stringify([...seen].map((key) => byKey.get(key)));
    expect(closure.includes('"unchained"'), row.name).toBe(
      heldNames.includes(row.name),
    );
  }
  const held = new Map(heldNotices.map((row) => [row.id, row]));
  expect(held.get(UNCHAINED_HOLD)).toEqual({
    id: UNCHAINED_HOLD,
    notices: [
      'PZO1131',
      'pf1-content/notice/6f81aca96be61467bd8a9bb23af4573934cd649d8e46fa10010f26fb105429f7',
    ],
    evidence: ['scripts/catalog/legal/companion-features-505.json'],
  });
  expect(
    review.noticeRequirements.map((row) => [
      row.book,
      row.holdId,
      row.candidates.length,
    ]),
  ).toEqual([
    ['PZO1110', null, 10],
    ['PZO1131', UNCHAINED_HOLD, 2],
  ]);
  // Inherited rules: the granted CRB Alertness feat and the CRB scrying spell.
  expect(
    candidate('Alertness').inheritedRuleSourceEvidence.map((row) => [
      row.name,
      row.sources,
    ]),
  ).toEqual([['Alertness', [{ id: 'PZO1110', pages: '114, 117' }]]]);
  expect(
    candidate('Scry on Familiar').inheritedRuleSourceEvidence.map((row) => [
      row.name,
      row.sources,
    ]),
  ).toEqual([['Scrying', [{ id: 'PZO1110', pages: '337' }]]]);
});

it('pins all eleven complete records, checked bindings and literal Core Rulebook PCGen rows in the shared store', async () => {
  expect(review.candidates).toHaveLength(11);
  expect(preview.entries).toHaveLength(10);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
  }
  for (const row of assessedCandidates) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    const [record] = row.mechanicsReview.curationRecords;
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      diagnostics: [],
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: '2026-10-20',
    });
    for (const reviewed of row.mechanicsReview.curationRecords)
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed.kind &&
            current.target === reviewed.target &&
            current.textSha256 === reviewed.textSha256,
        ),
      ).toEqual(reviewed);
    // The comparison is the ability's (or the Familiar's) Core Rulebook row.
    expect(row.comparison.book, row.name).toBe('PZO1110');
    expect(row.comparison.completeDirectComparison, row.name).toBe(
      row.name !== 'Familiar',
    );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  expect([...files.keys()]).toEqual([
    'data/pathfinder/paizo/roleplaying_game/core_essentials/ce_abilities_familiar_cr.lst',
    'data/pathfinder/paizo/roleplaying_game/core_essentials/ce_companionmods_familiar_cr.lst',
    'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_abilities_class.lst',
    'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst',
    'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst',
  ]);
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of assessedCandidates) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      const lines = (
        await readFile(`tests/fixtures/pinned/pcgen/${comparison.path}`, 'utf8')
      ).split(/\r?\n/);
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text } = comparison.publicationAnchor;
      expect(text).toBe('SOURCELONG:Core Rulebook');
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
  }
  // Every ability body equals its PCGen Core Rulebook DESC (apostrophes
  // aside), except Share Spells' "wizard" for "master".
  for (const row of assessedCandidates) {
    if (row.name === 'Familiar') continue;
    const desc = row.comparison.literalRow
      .split('\t')
      .find((cell) => cell.startsWith('DESC:'))
      ?.slice(5);
    const note = row.mechanicsReview.descriptionText
      .replace(/<[^>]+>/g, '')
      .replace(/@UUID\[[^\]]+\]\{([^}]*)\}/g, '$1')
      .replaceAll('’', "'")
      .replaceAll('&quot;', '"');
    expect(note, row.name).toBe(
      row.name === 'Share Spells'
        ? desc
            ?.replace('The wizard', 'The master')
            .replace('A wizard', 'The master')
        : desc,
    );
  }
  // The Familiar's first four paragraphs equal the CRB Arcane Bond: Familiar DESC.
  const familiar = candidate('Familiar');
  const paragraphs = familiar.comparison.literalRow
    .split('\t')
    .find((cell) => cell.startsWith('DESC:'))
    ?.slice(5)
    .split('&nl;');
  expect(paragraphs).toHaveLength(4);
  for (const paragraph of paragraphs ?? [])
    expect(
      familiar.mechanicsReview.descriptionText.replaceAll('’', "'"),
    ).toContain(`<p>${paragraph}</p>`);
});

it('validates the Familiar schedule and table through master level 20 against the public familiar calculation', () => {
  const familiar = previewResource('Familiar');
  const review = candidate('Familiar').mechanicsReview.companionReview;
  const source = candidate('Familiar').sourceFields as {
    links: { classAssociations: { level: number; uuid: string }[] };
    changes: { formula: string; target: string }[];
  };
  // The pinned classAssociations are the reviewed schedule.
  const fromLinks = source.links.classAssociations.map(({ level, uuid }) => [
    level,
    `pf1/${uuid.split('.').at(-1)}`,
  ]);
  expect(
    (review.schedule ?? []).flatMap(({ masterLevel, abilities }) =>
      abilities.map((key) => [masterLevel, key]),
    ),
  ).toEqual(fromLinks);
  for (const row of assessedCandidates)
    if (row.name !== 'Familiar')
      expect(
        fromLinks.find(([, key]) => key === row.externalKey)?.[0],
        row.name,
      ).toBe(row.mechanicsReview.companionReview.masterLevel);
  // The description's table rows.
  const rows = [
    ...familiar.description.matchAll(
      /<tr><td>(\d+)\w+–(\d+)\w+<\/td><td>\+(\d+)<\/td><td>(\d+)<\/td>/g,
    ),
  ].map(([, from, to, armor, int]) => ({
    masterLevels: [Number(from), Number(to)],
    naturalArmor: Number(armor),
    intelligence: Number(int),
  }));
  expect(rows).toHaveLength(10);
  expect(review.table).toEqual(rows);
  expect(source.changes.map((row) => [row.target, row.formula])).toEqual([
    ['int', '5 + ceil(@classes.familiar.level / 2)'],
    ['nac', 'ceil(@classes.familiar.level / 2)'],
  ]);
  // Both imported changes stay unmapped on the resource: the familiar
  // calculation supplies them on the companion.
  expect(
    familiar.unsupported
      .filter((row) => row.field === 'changes')
      .map((row) => (row.value as { target: string }).target),
  ).toEqual(['int', 'nac']);
  const names = new Map(
    preview.entries.map((row) => [row.externalKey, row.name.toLowerCase()]),
  );
  for (let level = 1; level <= 20; level++) {
    const row = rows.find(({ masterLevels }) => masterLevels.includes(level));
    const result = calculateCharacterSheet(
      familiarSheet(),
      familiarAtMasterLevel(level),
    );
    const progression = result.familiar?.progression;
    expect(progression, `level ${level}`).toMatchObject({
      level,
      naturalArmor: row?.naturalArmor,
      intelligence: row?.intelligence,
      spellResistance: level >= 11 ? level + 5 : null,
    });
    // ceil(level / 2), as the imported formulas compute.
    expect(progression?.naturalArmor).toBe(Math.ceil(level / 2));
    expect(progression?.intelligence).toBe(5 + Math.ceil(level / 2));
    expect(
      representativeFamiliarProgression.find(
        (entry) => entry.level === row?.masterLevels[0],
      ),
    ).toEqual({
      level: row?.masterLevels[0],
      naturalArmor: row?.naturalArmor,
      intelligence: row?.intelligence,
    });
    expect(result.abilities.intelligence.score).toBe(row?.intelligence);
    expect(result.breakdowns['ac.natural'].total).toBe(row?.naturalArmor);
    // The calculation names exactly the abilities the Familiar record grants.
    expect(
      progression?.specialAbilities.map((name) => name.toLowerCase()).sort(),
      `level ${level}`,
    ).toEqual(
      fromLinks
        .filter(([at]) => Number(at) <= level)
        .map(([, key]) => names.get(String(key)))
        .sort(),
    );
  }
});

it('shows the reviewed Notes on a familiar sheet without changing any statistic', () => {
  const familiarSide = [
    'Improved Evasion',
    'Share Spells',
    'Deliver Touch Spells',
    'Speak with Master',
    'Speak with Animals of Its Kind',
    'Spell Resistance',
  ];
  for (const row of preview.entries)
    expect(row.modifiers, row.name).toEqual([]);
  const plain = calculateCharacterSheet(
    familiarSheet(),
    familiarAtMasterLevel(11),
  );
  const reviewed = calculateCharacterSheet(
    familiarSheet(familiarSide),
    familiarAtMasterLevel(11),
  );
  const totals = (result: typeof plain) =>
    Object.fromEntries(
      Object.entries(result.breakdowns).map(([key, row]) => [key, row.total]),
    );
  expect(totals(reviewed)).toEqual(totals(plain));
  expect(reviewed.familiar?.progression?.spellResistance).toBe(16);
  expect(
    reviewed.breakdowns['save.ref'].notes?.map((note) => note.text),
  ).toEqual([
    'Improved evasion: against an attack that allows a Reflex save for half damage, the familiar takes no damage on a successful save and half damage on a failed save.',
  ]);
  expect(reviewed.entryNotes.map((note) => note.text)).toEqual(
    familiarSide
      .filter((name) => name !== 'Improved Evasion')
      .map((name) => previewResource(name).situationalNotes?.[0]?.text),
  );
  // The imported Improved Evasion note stated only evasion's success case.
  expect(
    candidate('Improved Evasion').mechanicsReview.curationRecords[1],
  ).toMatchObject({
    kind: 'note',
    target: 'ref',
    text: 'Evasion: Reflex halves becomes Reflex negates',
    status: 'checked',
  });
  // Notes keep the rules readable: links become their names, and the Foundry
  // usage instruction is not a rule.
  for (const row of preview.entries) {
    const text = (row.situationalNotes ?? [])
      .map((note) => note.text)
      .join('\n');
    expect(text, row.name).not.toMatch(/@UUID|<a |Usage:/);
  }
  expect(previewResource('Familiar').situationalNotes?.[0]?.text).toContain(
    '13th–14th | +7 | 12 | Scry on familiar',
  );
  expect(previewResource('Alertness').situationalNotes?.[0]?.text).toBe(
    "While a familiar is within arm's reach, the master gains the Alertness feat.",
  );
});

it('reextracts the resources from a clean shared fixture tree and enforces current bindings and the notice hold', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: [
        ...review.candidates.map((row) => row.externalKey),
        ...linkedKeys,
      ],
    });
    expect([...linkedKeys].sort()).toEqual([
      'pf1/Q1cY8r0Pvb66pMG0',
      'pf1/g66w32kdup1f43bp',
    ]);
    expect(artifact.catalog.entries.map((row) => row.name).sort()).toEqual([
      'Alertness',
      'Scrying',
    ]);
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 1,
      checked: 1,
    });
    for (const row of artifact.catalog.resources ?? []) {
      const saved = preview.entries.find(
        (entry) => entry.externalKey === row.externalKey,
      );
      expect({
        detail: row.detail,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        detail: saved?.detail,
        modifiers: saved?.modifiers,
        situationalNotes: saved?.situationalNotes,
        sources: saved?.sources,
      });
    }
    expect(artifact.catalog.resources).toHaveLength(10);
    // Gate the full-corpus snapshot: the batch's resources and their closure
    // (the Alertness feat and the scrying spell) as the whole corpus has them.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: closureEntries,
        resources,
      },
    };
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    const ours = new Set(assessedCandidates.map((row) => row.externalKey));
    const own = <T extends { externalKey: string }>(rows: T[]) =>
      rows.filter((row) => ours.has(row.externalKey));
    expect(
      own(gate.admitted)
        .map((row) => row.name)
        .sort(),
    ).toEqual([...admittedNames].sort());
    expect(
      own(gate.held)
        .map((row) => [row.name, row.reason])
        .sort(),
    ).toEqual(
      heldNames.map((name) => [
        name,
        expect.stringMatching(/^Notice holds: PZO1131 \(/),
      ]),
    );
    expect(own(gate.dependentOmissions)).toEqual([]);
    expect(own(gate.failures)).toEqual([]);
    for (const row of assessedCandidates) {
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
          entry: resources.find(
            (entry) => entry.externalKey === row.externalKey,
          )!,
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // A changed admitted body invalidates its binding and is no longer admitted.
    const evasion = candidate('Improved Evasion').externalKey;
    const edited = assessCatalogAdmission({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          resources: resources.map((row) =>
            row.externalKey === evasion
              ? { ...row, situationalNotes: [] }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(own(edited.admitted).map((row) => row.name)).not.toContain(
      'Improved Evasion',
    );
    // #516 whole-content wave 3 admits Scrying, so with the committed
    // clearances Scry on Familiar admits too: the seven unedited CRB
    // abilities and Scry on Familiar.
    expect(own(edited.admitted)).toHaveLength(8);
    expect(own(edited.admitted).map((row) => row.name)).toContain(
      'Scry on Familiar',
    );
  } finally {
    await tree.dispose();
  }
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/companion-features-505.json',
    ),
  ).toEqual([]);
});
