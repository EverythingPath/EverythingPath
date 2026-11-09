// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/feats-360/data';
import { reviewedFeatSheet } from '../fixtures/feats-360/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'feat') throw new Error('Expected feat');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string, sheetEntryId = entry(name).externalKey) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
function situation(
  name: string,
  index = 0,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Expected local Situation');
  return { ...scope, sheetEntryId };
}
// An unrelated entry's bonus of the given type, for stacking checks.
function other(
  row: ReturnType<typeof modifiers>[number],
  value: number,
  source = 'other-entry',
) {
  return {
    ...row,
    sheetEntryId: source,
    catalogEntryId: source,
    source,
    entryName: source,
    value,
    condition: undefined,
  };
}

const noRow = [
  'Virulent Venom',
  'Cecaelia Focus Tattoo',
  'Stone Magic',
  "Nature's Wrath",
  'Primal Kineticist',
  'Asura Spellrend',
  'Aphotic Explorer',
  'Graceful Flier',
  'Awesome Throw',
  'Deconstruct Spell',
  'Demonic Momentum',
  'Diabolic Style',
  'Hellknight Obsession',
];

it('applies Sure and Fleet racial bonuses unconditionally without stacking copies', () => {
  const rows = modifiers('Sure and Fleet');
  expect(rows.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['skill.acr', 'racial', 2],
    ['skill.clm', 'racial', 2],
  ]);
  const base = resolveSheet(rows);
  expect([base['skill.acr'].total, base['skill.clm'].total]).toEqual([2, 2]);
  // The resolver stacks racial bonuses from different entries; a second copy
  // of this Rule Identity still adds nothing.
  expect(resolveSheet([...rows, other(rows[0]!, 4)])['skill.acr'].total).toBe(
    6,
  );
  const copy = rows.map((row) => ({
    ...row,
    sheetEntryId: 'copy',
    catalogEntryId: 'copy',
  }));
  expect(resolveSheet([...rows, ...copy])['skill.clm'].total).toBe(2);
  const sheet = calculateCharacterSheetProjections(
    reviewedFeatSheet('Sure and Fleet'),
  ).current.breakdowns;
  expect([sheet['skill.acr'].total, sheet['skill.clm'].total]).toEqual([2, 2]);
});

it('uses the shared poison and identifyMagicItems Situations and keeps one save bonus per Jungle Survivalist', () => {
  const jungle = modifiers('Jungle Survivalist');
  expect(jungle[0]?.condition?.situation).toBe('poison');
  expect(resolveSheet(jungle)['save.fort'].total).toBe(0);
  const poison = resolveSheet(jungle, { situations: ['poison'] });
  expect([
    poison['save.fort'].total,
    poison['save.ref'].total,
    poison['save.will'].total,
    poison['skill.acr'].total,
  ]).toEqual([2, 2, 2, 0]);
  // Disease and poison together still give one +2 from this entry.
  expect(
    resolveSheet(jungle, {
      situations: ['poison', situation('Jungle Survivalist', 1)],
    })['save.fort'].total,
  ).toBe(2);
  const trees = resolveSheet(jungle, {
    situations: [situation('Jungle Survivalist', 3)],
  });
  expect([trees['skill.acr'].total, trees['skill.clm'].total]).toEqual([2, 2]);
  expect(
    resolveSheet(jungle, {
      situations: [situation('Jungle Survivalist', 5, 'another-holder')],
    })['skill.per'].total,
  ).toBe(0);
  const cursed = modifiers('Cursed Item Detection');
  expect(cursed[0]?.condition?.situation).toBe('identifyMagicItems');
  expect(resolveSheet(cursed)['skill.spl'].total).toBe(0);
  expect(
    resolveSheet(cursed, { situations: ['identifyMagicItems'] })['skill.spl']
      .total,
  ).toBe(2);
  expect(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Cursed Item Detection'),
    ).current.breakdowns['skill.spl'].total,
  ).toBe(0);
});

it("adds Wings of Air as Airy Step's +2 increment with Airy Step's own label", () => {
  const wings = modifiers('Wings of Air');
  expect(wings.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['saves', 'untyped', 2],
  ]);
  const label = situation('Wings of Air').local;
  const airy = reviewedCuration.records.find(
    (row) => row.externalKey === 'pf1-content/VKUgfTRd170uSQyL',
  );
  expect(
    airy?.outputs.flatMap((output) =>
      output.kind === 'modifier' ? [output.condition?.situation] : [],
    ),
  ).toEqual([{ local: label }, { local: label }, { local: label }]);
  // Airy Step's untyped +2 from its own entry stacks to the restated +4.
  const both = resolveSheet([...wings, { ...other(wings[0]!, 2, 'airy') }], {
    situations: [situation('Wings of Air')],
  });
  expect(both['save.ref'].total).toBe(4);
});

it('keeps exclusive and holder-scoped alternatives to the strongest applicable bonus', () => {
  const foe = modifiers('Foeslayer');
  expect(foe.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['ac', 'dodge', 1],
    ['ac', 'dodge', 2],
  ]);
  expect(
    resolveSheet(foe, { situations: [situation('Foeslayer')] })['ac.other']
      .total,
  ).toBe(1);
  expect(
    resolveSheet(foe, {
      situations: [situation('Foeslayer'), situation('Foeslayer', 1)],
    })['ac.other'].total,
  ).toBe(2);
  const champion = modifiers('Champion of Righteousness');
  const either = resolveSheet(champion, {
    situations: [situation('Champion of Righteousness')],
  });
  expect([either['damage.melee'].total, either['damage.ranged'].total]).toEqual(
    [2, 2],
  );
  expect(
    resolveSheet(champion, {
      situations: [
        situation('Champion of Righteousness'),
        situation('Champion of Righteousness', 1),
      ],
    })['damage.melee'].total,
  ).toBe(4);
  const wild = modifiers('Mage of the Wild');
  expect(wild.map((row) => row.target)).toEqual([
    'concentration',
    'skill.kar',
    'skill.spl',
  ]);
  const terrain = resolveSheet(wild, {
    situations: [situation('Mage of the Wild')],
  });
  expect([
    terrain.concentration.total,
    terrain['skill.kar'].total,
    terrain['skill.spl'].total,
    terrain.casterLevel.total,
  ]).toEqual([2, 2, 2, 0]);
  const mountain = modifiers('Indomitable Mountain Style');
  // Another morale bonus does not stack with the +4.
  expect(
    resolveSheet([...mountain, other(mountain[0]!, 2)], {
      situations: [situation('Indomitable Mountain Style')],
    }).cmd.total,
  ).toBe(4);
  const horde = resolveSheet(modifiers('Ferocious Horde'), {
    situations: [situation('Ferocious Horde')],
  });
  expect([horde['attack.melee'].total, horde['attack.ranged'].total]).toEqual([
    2, 2,
  ]);
  const wrath = resolveSheet(modifiers("Nature's Wrath"), {
    situations: [situation("Nature's Wrath"), situation("Nature's Wrath", 1)],
  });
  expect([wrath['save.will'].total, wrath['attack.melee'].total]).toEqual([
    -1, 1,
  ]);
  const cleaver = modifiers('Goblin Cleaver');
  expect(
    resolveSheet(cleaver, { situations: [situation('Goblin Cleaver')] })[
      'attack.melee'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet(cleaver, { situations: [situation('Goblin Cleaver')] })[
      'attack.ranged'
    ].total,
  ).toBe(0);
  expect(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Champion of Righteousness'),
    ).current.breakdowns['damage.melee'].total,
  ).toBe(0);
});

it('keeps choice, dice, resource, speed and recipient bodies off holder totals', () => {
  for (const name of [
    'Cecaelia Focus Tattoo',
    'Hellknight Obsession',
    'Divination Guide',
    'Blood Vengeance',
    'Guided Star',
    'Focused Shot',
    'Aquatic Ancestry',
    'Graceful Flier',
    'Aphotic Explorer',
    'Extra Stamina',
    'Spirited Charge (Mythic)',
    'Riving Strike',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(entry(name).situationalNotes?.[0]?.text, name).toBeTruthy();
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.length +
        candidate(name).mechanicsReview.proseOnlyRules.length,
      name,
    ).toBeGreaterThan(0);
  }
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(29);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(18);
  expect(
    preview.entries.flatMap((row) =>
      row.modifiers.filter((modifier) => modifier.target === 'casterLevel'),
    ),
  ).toEqual([]);
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  for (const name of [
    'Disheartening Display',
    'Charge of the Righteous',
    'Nightmare Striker',
    'Ambush Awareness',
    'Shaitan Style',
    'Twin Thunders Master',
    'Landing Roll',
    'Goblin Cleaver',
    'Unblinking Flame Fist',
    'Focused Shot',
    'Dastardly Finish',
    'Hammer the Gap',
    'Riving Strike',
  ]) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(candidate(name).inheritedRuleComparisonEvidence, name).toHaveLength(
      1,
    );
  }
  expect(candidate('Charge of the Righteous').requiredNotices).toEqual([
    'PZO9267',
    'PZO9463',
    'PZO1131',
    'PZO1110',
  ]);
  expect(candidate('Unblinking Flame Fist').requiredNotices).toEqual([
    'PZO1138',
    'PZO9463',
    'PZO1131',
    'PZO1110',
  ]);
  expect(candidate('Ambush Awareness').requiredNotices).toEqual([
    'PZO1140',
    'PZO9459',
    'PZO9467',
    'PZO1131',
    'PZO1110',
  ]);
  for (const name of [
    'Heroic Defiance (Mythic)',
    'Shot on the Run (Mythic)',
    'Spirited Charge (Mythic)',
  ])
    expect(candidate(name).requiredNotices, name).toEqual([
      'PZO1126',
      'PZO1110',
    ]);
  for (const name of ['Foeslayer', 'Planar Traveler'])
    expect(candidate(name).requiredNotices, name).toContain('PZO1125');
  for (const [name, book] of [
    ['Ace Trip', 'PZO9452'],
    ['Shaitan Style', 'PZO1115'],
    ['Superintendent', 'PZO1125'],
    ['Conservatory-Trained', 'PZO1134'],
    ['Oblivating Stare', 'PZO1132'],
    ['Introspecitve Performance', 'PZO1129'],
    ['Distracting Explosion', 'PZO1115'],
    ['Banishing Critical', 'PZO1117'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  for (const [name, root, rejected] of [
    ["Falcon's Cry", 'PZO1138', 'PZO9279'],
    ['Charge of the Righteous', 'PZO9267', 'PZO9416'],
    ['Extra Stamina', 'PZO1131', 'PZO9473'],
    ['Ambush Awareness', 'PZO1140', 'PZO9459'],
    ['Blood Vengeance', 'PZO1121', 'PZO9413'],
    ['Unblinking Flame Fist', 'PZO1138', 'PZO9268'],
    ['Foeslayer', 'PZO9433', 'PZO1125'],
    ['Banishing Critical', 'PZO9458', 'PZO9424'],
    ['Divination Guide', 'PZO9267', 'PZO9416'],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(candidate(name).rejectedRootComparisonEvidence, name).toEqual([
      expect.objectContaining({ book: rejected, appliesToRootBody: false }),
    ]);
  }
  // A rejected version's book is required only when the body cites it.
  for (const [name, book] of [
    ["Falcon's Cry", 'PZO9279'],
    ['Charge of the Righteous', 'PZO9416'],
    ['Extra Stamina', 'PZO9473'],
    ['Blood Vengeance', 'PZO9413'],
    ['Unblinking Flame Fist', 'PZO9268'],
    ['Banishing Critical', 'PZO9424'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  expect(candidate('Introspecitve Performance').comparison?.literalRow).toMatch(
    /^Introspective Performance\t/,
  );
  expect(candidate('Oblivating Stare').comparison?.literalRow).toMatch(
    /^Obliviating Stare\t/,
  );
  for (const name of ['Distracting Explosion', 'Grenade Expert'])
    expect(candidate(name).comparison?.book, name).toBe('PZO90115');
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  expect(review.candidates.filter((row) => !row.comparison)).toHaveLength(
    noRow.length,
  );
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys,
    ]);
    for (const key of requirement.candidates)
      expect(
        review.candidates.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
  for (const row of review.candidates)
    expect(row.holdIds, row.name).toEqual([
      `feats-360-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Flexible Foe')).toEqual(['bab', 'unchecked', 'classFeature']);
  expect(kinds('Share Feature')).toEqual(['unchecked', 'unchecked']);
  expect(kinds('Twin Thunders Master')).toContain('unchecked');
  for (const [name, gap] of [
    ['Ace Trip', 'page reference'],
    ['Flexible Foe', 'twice'],
    ['Share Feature', 'taken by the animal companion itself'],
    ['Twin Thunders Master', 'loses its alternative'],
    ['Cursed Item Detection', 'split at "or"'],
    ['Awesome Throw', 'split at "or"'],
    ['Expanded Studies', 'hunter level requirement is lost'],
    ['Inured to Draconic Majesty', 'loses the dragon restriction'],
    ['Ambush Awareness', 'pinned Alertness feat exists'],
    ['Nightmare Striker', 'pinned Stunning Fist feat exists'],
    ['Grenade Expert', 'pinned Throw Anything feat exists'],
    ['Guided Star', 'worshiper of Desna'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-360',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  for (const name of [
    'Extra Elemental Assault',
    'Extra Stamina',
    'Lucky',
    'Flexible Foe',
  ])
    expect(
      candidate(name).mechanicsReview.prerequisiteReview.repeatability,
      name,
    ).toContain('Special');
});

it('pins all 100 complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toMatchObject({
    admitted: 0,
    held: 100,
    dependentlyOmitted: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(preview.entries).toHaveLength(100);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    const [record, ...rest] = row.mechanicsReview.curationRecords;
    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      diagnostics: [],
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: '2026-10-13',
    });
    expect(
      reviewedCuration.records.find(
        (current) =>
          current.externalKey === row.externalKey &&
          current.kind === record?.kind &&
          current.target === record.target &&
          current.textSha256 === record.textSha256,
      ),
    ).toEqual(record);
    expect(entry(row.name).sources).toEqual([]);
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of review.candidates) {
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
  }
  // The Sure and Fleet body equals its Advanced Race Guide row's benefit.
  expect(candidate('Sure and Fleet').comparison?.literalRow).toContain(
    'BENEFIT:You gain a +2 racial bonus on Acrobatics and Climb checks.',
  );
  expect(candidate('Sure and Fleet').mechanicsReview.descriptionText).toContain(
    '<strong>Benefits</strong>: You gain a +2 racial bonus on Acrobatics and Climb checks.',
  );
});

it('reextracts source-bound mechanics from a clean shared fixture tree and enforces current content and notice holds', async () => {
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
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 0,
      checked: 0,
      descriptions: { candidates: 100, checked: 100 },
    });
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
      expect({
        description: row.description,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        description: saved.description,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The reduced tree cannot reproduce every whole-corpus prerequisite
    // identity; gate the full-source snapshot after reproducing its mechanics.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: preview.entries.map((row) => {
          if (row.detail.kind !== 'feat') throw new Error('Expected feat');
          return { ...row, detail: row.detail };
        }),
      },
    };
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted).toEqual([]);
    expect(gate.held).toHaveLength(100);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of gate.held)
      expect(row.reason, row.name).toMatch(/^feats-360-whole-content-/);
    for (const row of review.candidates) {
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
          entry: entry(row.name),
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // Confirming a held body with non-CRB notices still holds it on them.
    const confirm = (name: string) => {
      const key = candidate(name).externalKey;
      const result = assessWithUnclearedHolds({
        artifact: authoritative,
        ...reviewedAdmission,
        assessments: reviewedAdmission.assessments.map((row) =>
          row.externalKey === key
            ? { ...row, status: 'confirmed' as const }
            : row,
        ),
      });
      return { key, result };
    };
    const fleet = confirm('Sure and Fleet');
    expect(
      fleet.result.held.find((row) => row.externalKey === fleet.key)?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
    expect(fleet.result.admitted).toEqual([]);
    // A no-row body that needs only the reviewed CRB notice is kept out only
    // by its unresolved whole-content assessment.
    expect(candidate('Virulent Venom').requiredNotices).toEqual(['PZO1110']);
    const venom = confirm('Virulent Venom');
    expect(venom.result.admitted.map((row) => row.externalKey)).toEqual([
      venom.key,
    ]);
    // A changed body invalidates its binding instead of reusing it.
    const edited = assessCatalogAdmission({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === venom.key
              ? { ...row, description: `${row.description}<p>Edited.</p>` }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === venom.key
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(edited.admitted).toEqual([]);
  } finally {
    await tree.dispose();
  }
});
