// @vitest-environment node
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import review from '../../scripts/catalog/legal/spells-522.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { importCatalog } from '../../scripts/catalog/import';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  appliedRemapSchema,
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../src/lib/catalog/imported-entry-schema';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-522/provenance.json';
import preview from '../fixtures/spells-522/preview.json';
import bindingPreview from '../fixtures/spells-522/binding-preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-522/sheet';

const keys = review.candidates.map((row) => row.externalKey);
const fixtureRoot = resolve('tests/fixtures/spells-522');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  candidateKeys: keys,
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

it('pins all 100 exact ticket identities, raw bytes, individual descriptions and content-bound holds', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '8f4f3ca33ea2b1c600c32cfb8c7bf1e75bdd44b805622a36cda5f5b42a774b5d',
  );
  expect(provenance.orderedTicketKeysSha256).toBe(
    '8f4f3ca33ea2b1c600c32cfb8c7bf1e75bdd44b805622a36cda5f5b42a774b5d',
  );
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.candidateKeys).toEqual(keys);
  expect(await readdir(join(inputs.systemPath, 'packs/spells'))).toHaveLength(
    100 +
      provenance.dependencies.filter((row) =>
        row.path.startsWith('packs/spells/'),
      ).length,
  );
  const assessments = reviewedAdmission.assessments.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(assessments).toHaveLength(100);
  for (const source of [...provenance.rawSources, ...provenance.dependencies]) {
    expect(
      sha256(await readFile(join(inputs.systemPath, source.path), 'utf8')),
      source.path,
    ).toBe(source.sha256);
  }
  for (const candidate of review.candidates) {
    const text = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(text));
    expect(`pf1/${raw._id}`).toBe(candidate.externalKey);
    expect(raw.type).toBe('spell');
    expect(sha256(text)).toBe(candidate.source.sha256);
    expect(sha256(sourceDescription(raw))).toBe(candidate.descriptionSha256);
    expect(candidate.disposition).toBe('held');
    expect(candidate.noticeRequirementsComplete).toBe(false);
    expect(candidate.holdIds).toHaveLength(
      candidate.externalKey === 'pf1/7y0xvorQBvCtjoYn' ? 2 : 1,
    );
    expect(candidate.mechanicsReview.descriptionReview).toBe(
      'complete-full-description-and-all-actions',
    );
    for (const [field, value] of Object.entries(
      candidate.mechanicsReview.metadata,
    ))
      expect(value, `${candidate.name}: ${field}`).toEqual(
        raw.system[field] ?? null,
      );
    const record = curation.records.find(
      (row) =>
        row.externalKey === candidate.externalKey && row.kind === 'description',
    );
    expect(record, candidate.name).toMatchObject({
      status: 'checked',
      textSha256: candidate.descriptionSha256,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
    });
    expect(record?.outputs).toHaveLength(
      candidate.mechanicsReview.descriptionRecord.outputCount,
    );
    expect(record?.outputs.every((row) => row.kind === 'note')).toBe(true);
    const assessment = assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: candidate.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
    });
    expect(assessment?.evidenceFingerprints).toHaveProperty(
      candidate.evidenceId,
    );
    expect(reviewedAdmission.evidence[candidate.evidenceId]?.content).toContain(
      candidate.source.sha256,
    );
    expect(reviewedAdmission.evidence[candidate.evidenceId]?.content).toContain(
      candidate.source.location,
    );
  }
});

it('replays the public fixture import and keeps incomplete running mechanics independent from attribution', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(artifact.comparison.summary).toMatchObject({
    upstreamRecords: 100,
    admitted: 100,
    excluded: 0,
    unassigned: 0,
  });
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    missing: 0,
    descriptions: { candidates: 100, checked: 100, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  const outstanding = review.candidates.filter(
    (row) => row.mechanicsReview.outstanding.length > 0,
  );
  expect(
    artifact.curation.unresolvedDescriptions
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(outstanding.map((row) => row.externalKey).sort());
  for (const row of artifact.curation.unresolvedDescriptions) {
    const candidate = outstanding.find(
      (candidate) => candidate.externalKey === row.externalKey,
    );
    expect(
      row.diagnostics
        .filter((row) => row.kind === 'unresolved')
        .map((row) => row.text)
        .sort(),
    ).toEqual([...(candidate?.mechanicsReview.outstanding ?? [])].sort());
  }
  for (const entry of artifact.catalog.entries) {
    expect(entry.detail.kind).toBe('spell');
    expect(entry.modifiers).toEqual([]);
    const source = provenance.rawSources.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!source) throw new Error('Missing raw source');
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, source.path), 'utf8')),
    );
    const sources = z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().optional(),
          pages: z.union([z.string(), z.number()]),
        }),
      )
      .parse(raw.system.sources);
    expect(entry.sources).toEqual(
      sources.map((row) => ({
        book: row.id ?? row.name,
        pages: String(row.pages),
      })),
    );
  }
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(gate.passed).toBe(false);
  expect(gate.admitted).toEqual([]);
  expect(gate.held).toHaveLength(77);
  expect(gate.failures).toHaveLength(23);
  for (const failure of gate.failures)
    expect(failure.reason).toMatch(/^Broken structure or reference:/);
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures, ...gate.dependentOmissions].map(
          (row) => row.externalKey,
        ),
      ),
    ].sort(),
  ).toEqual([...keys].sort());
});

it('replays every full-context binding and rejects a changed inherited Spell', async () => {
  const spellSchema = importedCatalogEntrySchema.extend({
    detail: importedSpellDetailSchema,
  });
  const artifact = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.entries.map((row) => row.externalKey),
  });
  expect(artifact.catalog.entries).toEqual(
    z.array(spellSchema).parse(bindingPreview.entries),
  );
  expect(artifact.catalog.resources).toEqual(
    z.array(spellSchema).parse(bindingPreview.resources),
  );
  expect(artifact.catalog.remaps).toEqual(
    z.array(appliedRemapSchema).parse(bindingPreview.remaps),
  );
  expect(bindingPreview.rootKeys).toEqual(keys);
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(
    gate.held.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(100);
  expect(gate.admitted.filter((row) => keys.includes(row.externalKey))).toEqual(
    [],
  );
  expect(gate.failures.filter((row) => keys.includes(row.externalKey))).toEqual(
    [],
  );
  for (const key of keys) {
    const entry = artifact.catalog.entries.find(
      (row) => row.externalKey === key,
    );
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === key,
    );
    if (!entry || !assessment) throw new Error(`Missing bound Spell ${key}`);
    expect(assessment, entry.name).toMatchObject(
      buildAssessmentBinding({
        entry,
        artifact,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    );
  }
  const changed = structuredClone(artifact);
  const protection = changed.catalog.entries.find(
    (row) => row.name === 'Protection from Good',
  );
  const parent = changed.catalog.entries.find(
    (row) => row.name === 'Protection from Evil',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === protection?.externalKey,
  );
  if (!protection || !parent || !assessment)
    throw new Error('Missing inherited protection context');
  parent.description += ' Changed inherited deflection rule.';
  expect(
    buildAssessmentBinding({
      entry: protection,
      artifact: changed,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }).contentFingerprint,
  ).not.toBe(assessment.contentFingerprint);
});

it('enforces each individually recorded notice-chain hold', () => {
  for (const requirement of review.noticeRequirements) {
    if (!requirement.holdId) continue;
    const enforced = heldNotices.find((row) => row.id === requirement.holdId);
    expect(enforced, requirement.book).toBeDefined();
    expect(enforced?.notices).toEqual(
      expect.arrayContaining([requirement.book, ...requirement.registryKeys]),
    );
    expect(enforced?.evidence).toContain(
      'scripts/catalog/legal/spells-522.json',
    );
  }
});

it.each([
  [
    "Fox's Cunning",
    'wizard',
    2,
    'PZO1110',
    '286',
    '+4 enhancement bonus to Intelligence',
  ],
  [
    'Fly',
    'wizard',
    3,
    'PZO1110',
    '284',
    'bonus on Fly skill checks equal to 1/2 your caster level',
  ],
  [
    'Stunning Barrier',
    'oracle',
    1,
    'PZO1129',
    '194',
    '+1 deflection bonus to AC',
  ],
  ['Remove Paralysis', 'oracle', 2, 'PZO1110', '332', '+4 resistance bonus'],
] as const)(
  '%s preserves real class levels and numbers without inventing its running Effect',
  (name, classTag, level, book, pages, wording) => {
    const spell = spellFixture(name);
    expect(spell.detail.levels[classTag]).toBe(level);
    expect(spell.sources).toContainEqual({ book, pages });
    expect(spell.description).toContain(wording);
    expect(spell.modifiers).toEqual([]);
    expect(
      review.candidates.find((row) => row.name === name)?.mechanicsReview
        .outstanding.length,
    ).toBeGreaterThan(0);
    const projections = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const projection of [projections.current, projections.permanent]) {
      expect(projection.abilities.intelligence.score).toBe(10);
      expect(projection.spellEffects).toEqual([]);
      expect(
        projection.spellCollections.spellsWithoutSpellcasting,
      ).toContainEqual(
        expect.objectContaining({
          entryId: 'spell-row',
          catalogEntryId: spell.externalKey,
          ruleIdentity: spell.externalKey,
          name,
          school: spell.detail.school,
          description: spell.description,
          classEntryId: null,
          spellLevel: level,
          explicitLevel: level,
        }),
      );
    }
  },
);

it.each([
  [
    "Fox's Cunning",
    '35baabb0e5b51dd59e371308d177cd49b78f442aebf8d7ee083ccfd7ff0b5945',
  ],
  ['Fly', 'aa136891d0948e2d37e1ca116f240cef433ef81ba320f1fe14573db9789b38e3'],
] as const)(
  '%s retains independently checked pinned source bytes',
  async (name, expected) => {
    const row = review.candidates.find((row) => row.name === name);
    if (!row) throw new Error(`Missing ${name}`);
    expect(
      sha256(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    ).toBe(expected);
  },
);

it('invalidates a checked actual Intelligence bonus description on numeric drift', async () => {
  const work = resolve('.scratch/spells-522/test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const row = review.candidates.find((row) => row.name === "Fox's Cunning");
  if (!row) throw new Error('Missing Fox’s Cunning');
  const sourcePath = join(root, 'pf1', row.source.path);
  const raw = await readFile(sourcePath, 'utf8');
  expect(raw).toContain('+4 enhancement');
  await writeFile(sourcePath, raw.replace('+4 enhancement', '+5 enhancement'));
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: row.externalKey,
      kind: 'description',
    }),
  );
  expect(
    artifact.curation.applied.some(
      (record) => record.externalKey === row.externalKey,
    ),
  ).toBe(false);
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});

it.each([
  ['Implant Urge', 'mindAffecting', /goal/i],
  ['Dream Voyage', 'fear', /vehicle/i],
  ['Overwhelming Poison', 'poison', /single poison dose.*save DC/i],
  ['Ooze Form III', 'mindAffecting', /\+8/i],
  ['Fey Form III', 'poison', /\+8/i],
  ['Thorn Body', 'grapple', /2d6/i],
] as const)(
  '%s reuses shared %s while retaining its narrower rule',
  (name, situation, wording) => {
    expect(curation.situations.some((row) => row.key === situation)).toBe(true);
    const notes = spellFixture(name).situationalNotes?.filter(
      (note) => note.situation === situation,
    );
    expect(notes?.length).toBeGreaterThan(0);
    expect(notes?.map((note) => note.text).join(' ')).toMatch(wording);
  },
);

it('holds Shield Speech, Greater for its record-level 3.5 tag under the owner policy', async () => {
  const row = review.candidates.find(
    (row) => row.name === 'Shield Speech, Greater',
  );
  if (!row) throw new Error('Missing Shield Speech, Greater');
  const raw = upstreamRecord.parse(
    parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
  );
  expect(raw.system.tags).toContain('3.5');
  expect(row.disposition).toBe('held');
  expect(row.mechanicsReview.discrepancies.join(' ')).toMatch(/3\.5.*policy/i);
  const holdId = 'spells-522-record-3.5-tag-7y0xvorQBvCtjoYn';
  expect(row).toHaveProperty('tagPolicyHold', {
    id: holdId,
    tag: '3.5',
    reason: expect.stringContaining(
      "owner's policy (2026-10-08) holds record-level 3.5 tags and never excludes them",
    ),
    ownerPolicyIssues: [521, 522],
  });
  expect(row.holdIds).toEqual([
    'spells-522-whole-content-7y0xvorQBvCtjoYn',
    holdId,
  ]);
  expect(row.missingEvidence).toContain('record-level 3.5 tag');
  expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
    `Specific tag-policy hold ${holdId}.`,
  );
  expect(
    reviewedAdmission.assessments.find(
      (assessment) => assessment.externalKey === row.externalKey,
    )?.status,
  ).toBe('unresolved');
});

it('preserves the specific Bestiary notices without importing the mislabeled mythic UMR entry', () => {
  const fey = review.candidates.find((row) => row.name === 'Fey Form III');
  const threefold = review.candidates.find(
    (row) => row.name === 'Threefold Face',
  );
  const ceustodaemon = review.candidates.find(
    (row) => row.name === 'Summon Ceustodaemon',
  );
  expect(fey?.requiredNotices).toEqual(
    expect.arrayContaining(['PZO1112', 'PZO1116']),
  );
  expect(threefold?.requiredNotices).toContain('PZO1112');
  expect(ceustodaemon?.requiredNotices).toContain('PZO1116');
  expect(fey?.requiredNotices).not.toContain('PZO1127');
  expect(threefold?.requiredNotices).not.toContain('PZO1127');
  expect(fey?.mechanicsReview.outstanding.join(' ')).toMatch(
    /blood rage|Blood Rage/,
  );
  expect(fey?.mechanicsReview.outstanding.join(' ')).toMatch(/\+2/);
  expect(fey?.mechanicsReview.discrepancies.join(' ')).toMatch(
    /Amazing Initiative/,
  );
});

it('keeps Scouring Winds inherited windstorm Fly penalty outstanding with its exact CRB evidence', () => {
  const candidate = review.candidates.find(
    (row) => row.name === 'Scouring Winds',
  );
  const inherited = candidate?.mechanicsReview.inheritedRuleEvidence?.find(
    (row) => row.name === 'Fly: High Wind Speeds / Wind Effects on Flight',
  );
  if (!candidate || !inherited || !('sources' in inherited))
    throw new Error('Missing windstorm rule evidence');
  expect(candidate.requiredNotices).toContain('PZO1110');
  expect(candidate.mechanicsReview.outstanding).toEqual([
    'Inherited windstorm applies a -8 penalty on Fly checks to creatures affected by the winds; this supported skill Modifier needs a wind-scoped Spell Effect. Flight checks and checked/blown-away size procedures remain manual.',
  ]);
  expect(inherited.sources).toEqual([{ id: 'PZO1110', pages: '96' }]);
  expect(inherited.path).toBe(
    'packs/rules/skills.x175kVqUfLGPt8tC.yaml#iH69GIwm8BjecrPN',
  );
  expect(inherited.sourceLocation).toBe(
    'https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/rules/skills.x175kVqUfLGPt8tC.yaml#L1159',
  );
  expect(inherited.evidence).toContain(
    '<tr><td>Windstorm</td><td>51–74 mph</td><td>Medium</td><td>Small</td><td>–8</td></tr>',
  );
  expect(sha256(inherited.evidence)).toBe(
    '7194b578cef89df2a6de6929690f60bebb61f2edf9b232fc07cfe142f8a36d16',
  );
  expect(inherited.evidenceSha256).toBe(sha256(inherited.evidence));
  const spell = spellFixture('Scouring Winds');
  expect(spell.detail.levels.wizard).toBe(7);
  expect(spell.description).toContain('Table 13-10: Wind Effects');
  expect(spell.modifiers).toEqual([]);
  const projections = calculateCharacterSheetProjections(
    recordedSpellSheet('Scouring Winds', 'wizard'),
  );
  for (const projection of [projections.current, projections.permanent])
    expect(projection.spellEffects).toEqual([]);
});

it('reports source-backed descriptor and action-note importer gaps without losing raw evidence', () => {
  const roots = review.candidates.filter(
    (row) =>
      row.mechanicsReview.metadata.descriptors &&
      row.mechanicsReview.metadata.descriptors.length > 0,
  );
  expect(roots).toHaveLength(39);
  // #738 imports the descriptors the review recorded as lost.
  for (const row of roots)
    expect(spellFixture(row.name).detail.descriptors).toEqual(
      row.mechanicsReview.metadata.descriptors,
    );
  const barrier = review.candidates.find((row) => row.name === 'Blast Barrier');
  const coin = review.candidates.find((row) => row.name === 'Coin Shot');
  expect(barrier?.mechanicsReview.metadata.actions).toContainEqual(
    expect.objectContaining({
      notes: {
        effect: [
          '[[/d 2d6[slashing] + (min(floor(@cl / 3),6))d6[sonic] #Explosion Damage]]',
        ],
      },
    }),
  );
  const noteStrings = [barrier, coin].flatMap(
    (row) =>
      row?.mechanicsReview.metadata.actions.flatMap((action) => {
        if (!('notes' in action) || !action.notes) return [];
        const notes = z
          .object({
            effect: z.array(z.string()).optional(),
            footer: z.array(z.string()).optional(),
          })
          .parse(action.notes);
        return [...(notes.effect ?? []), ...(notes.footer ?? [])];
      }) ?? [],
  );
  expect(noteStrings).toHaveLength(4);
  expect(noteStrings.join(' ')).toMatch(/discharge|damage/i);
  expect(review.metadataImportGaps).toContainEqual(
    expect.objectContaining({
      field: 'detail.descriptors',
      candidateCount: 39,
    }),
  );
  expect(review.metadataImportGaps).toContainEqual(
    expect.objectContaining({
      field: 'actions[].notes.effect/footer',
      candidateCount: 2,
      stringCount: 4,
    }),
  );
});
