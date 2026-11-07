// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { importCatalog } from '../../scripts/catalog/import';
import {
  computeFingerprint,
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  spells,
  preview,
  bindingPreview,
  provenance,
  snapshot,
} from '../fixtures/spells-532/data';
import { spellFixture, recordedSpellSheet } from '../fixtures/spells-532/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
} from './batch-ownership';
const root = resolve('tests/fixtures/spells-532');
const keys = spells.map((r) => r.externalKey);
const hash = (s: string | Buffer) =>
  createHash('sha256').update(s).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  curation: reviewedCuration,
};
let bounded: Awaited<ReturnType<typeof importCatalog>>,
  complete: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  bounded = await importCatalog({ ...inputs, candidateKeys: keys });
  complete = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.entries.map((r) => r.externalKey),
  });
});
it('owns exactly the 100 ordered #532 keys and preserves literal source identity/type/tag boundaries', async () => {
  expect(review.ticket).toBe(532);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(hash(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(review.summary).toEqual({
    rawCandidates: 100,
    spellDefinitions: 100,
    held: 100,
    admitted: 0,
    excluded: 0,
    dependentOmissions: 0,
    unsupportedProseOnly: 0,
    recordLevel35Holds: 0,
  });
  for (const row of spells) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw._key).toBe('!items!' + row.externalKey.split('/')[1]);
    expect(raw.type).toBe('spell');
    expect(raw.system.tags ?? []).not.toContain('3.5');
    expect(sourceDescription(raw)).toBe(row.fullContentReview.descriptionText);
    expect(hash(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(raw.system.sources).toEqual(row.citedSources);
    expect(raw.system.learnedAt).toEqual(row.learnedAt);
    expect(raw.system.actions).toEqual(row.mechanicsReview.metadata.actions);
    expect(row.fullContentReview.completeRawSystem).toEqual(raw.system);
    expect(row.evidenceId).toBe('spells-532-' + raw._id);
    expect(row.holdIds).toContain('spells-532-whole-content-' + raw._id);
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toMatch(
      /^#532 Sol \(AI curator\) for the owner, 2026-10-11\./,
    );
    const entry = bounded.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (entry?.detail.kind !== 'spell') throw new Error(row.name);
    expect(entry.detail.levels).toEqual(
      z
        .object({ class: z.record(z.string(), z.number()) })
        .parse(raw.system.learnedAt).class,
    );
    expect(entry.modifiers).toEqual([]);
  }
});
it('keeps a named blog origin, an unavailable creature body and a literal spelling mismatch as separate holds/evidence boundaries', () => {
  const jolt = spells.find((r) => r.name === 'Jolt');
  expect(jolt?.citedSources).toEqual([
    {
      date: '2011-05-24',
      name: 'Paizo Blog - Ultimate Cantrips',
      pages: '',
      url: 'https://paizo.com/community/blog/v5748dyo5lc7e&page=2?Ultimate-Cantrips',
    },
  ]);
  expect(jolt?.holdIds).toContain('spells-532-Jolt-blog-origin');
  const monkeys = spells.find((r) => r.name === 'Mad Monkeys');
  expect(monkeys?.requiredNotices).toContain('PZO1116');
  expect(monkeys?.mechanicsReview.missingSupportingBodies).toContainEqual(
    expect.objectContaining({
      name: 'Monkey Swarm',
      bodyRole: 'missing-body',
      fixturePath: null,
    }),
  );
  const shadow = spells.find((r) => r.name === 'Shadow Transmutation');
  expect(shadow?.mechanicsReview.missingSupportingBodies).toContainEqual(
    expect.objectContaining({
      name: 'longarmACG',
      completeGoverningBody: false,
    }),
  );
  expect(
    shadow?.mechanicsReview.governingSpellBodies.some(
      (r) => r.name === 'Long Arm',
    ),
  ).toBe(false);
  expect(
    shadow?.mechanicsReview.auditOnlySpellBodies.find(
      (r) => r.name === 'Long Arm',
    ),
  ).toMatchObject({
    bodyRole: 'complete-audit-only-body',
    application: 'audit-only',
    noteCount: 0,
  });
});
it('distinguishes complete direct governing bodies from scoped excerpts in Notes and keeps all incidental context audit-only', async () => {
  for (const row of spells) {
    const record = reviewedCuration.records.find(
      (r) => r.externalKey === row.externalKey && r.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: row.fullContentReview.descriptionText,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: row.mechanicsReview.protectedHistoricalContext
        ? '2026-10-10'
        : '2026-10-11',
    });
    expect(record?.outputs).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.reviewedOptionalOutputs,
    );
    expect(record?.diagnostics.map((d) => d.text)).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.outstanding,
    );
    expect(record?.outputs.every((r) => r.kind === 'note')).toBe(true);
    expect(
      record?.outputs
        .filter((r) => r.kind === 'note')
        .map((r) => r.text)
        .join('\n'),
    ).not.toMatch(/notice hold|spells-532-|whole-content|Review required:/i);
    const outputs = row.mechanicsReview.reviewedOptionalOutputs;
    expect(outputs.slice(0, row.mechanicsReview.ownNoteCount)).toHaveLength(
      row.mechanicsReview.ownNoteCount,
    );
    let offset = row.mechanicsReview.ownNoteCount;
    for (const base of row.mechanicsReview.governingSpellBodies) {
      const raw = upstreamRecord.parse(
        parse(await readFile(join(root, base.fixturePath), 'utf8')),
      );
      expect(raw.type).toBe('spell');
      expect(raw.name).toBe(base.name);
      expect('pf1/' + raw._id).toBe(base.externalKey);
      expect(sourceDescription(raw)).toBe(base.descriptionText);
      expect(hash(sourceDescription(raw))).toBe(base.descriptionSha256);
      expect(base.relationship.kind).toBe('direct-governing-spell');
      expect(base.relationship.reason).toBe(base.limits);
      expect(
        row.fullContentReview.descriptionText.slice(
          base.rootEvidenceStart,
          base.rootEvidenceEnd,
        ),
      ).toBe(base.rootEvidence);
      expect(base.completeGoverningBody).toBe(row.name !== 'Aura Sight');
      expect(base.bodyRole).toBe(
        row.name === 'Aura Sight'
          ? 'partial-governing-excerpt'
          : 'complete-governing-body',
      );
      const notes = outputs.slice(offset, offset + base.noteCount);
      offset += base.noteCount;
      expect(notes).toHaveLength(base.noteCount);
      for (const note of notes) {
        if (note.kind !== 'note') throw new Error(base.name);
        expect(note.text.startsWith(base.prefix)).toBe(true);
        expect(note.text.length).toBeLessThanOrEqual(4096);
      }
      expect(
        notes
          .map((n) =>
            n.kind === 'note' ? n.text.slice(base.prefix.length) : '',
          )
          .join(' ')
          .replace(/\s+/g, ' '),
      ).toBe(base.noteText.replace(/\s+/g, ' '));
    }
    expect(offset).toBe(outputs.length);
    for (const base of row.mechanicsReview.auditOnlySpellBodies) {
      expect(base.application).toBe('audit-only');
      expect(base.noteCount).toBe(0);
      expect(base.completeGoverningBody).toBe(false);
      expect(hash(await readFile(join(root, base.fixturePath)))).toBe(
        base.source.sha256,
      );
    }
  }
  expect(
    spells
      .find((r) => r.name === 'Incendiary Cloud')
      ?.mechanicsReview.governingSpellBodies.map((r) => r.name),
  ).toEqual(['Fog Cloud']);
  expect(
    spells.find((r) => r.name === 'Aura Sight')?.mechanicsReview
      .governingSpellBodies[0]?.noteText,
  ).not.toContain('3rd Round');
});
it('independently checks whole PCGen positive DisplayFullSpell branches and their textual comparisons', async () => {
  let count = 0,
    matches = 0;
  const normalized = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  for (const row of spells) {
    const comparison = row.fullContentReview.directComparison;
    if (!comparison) continue;
    const bytes = await readFile(join(root, comparison.source)),
      lines = bytes.toString().split('\n');
    expect(hash(bytes)).toBe(comparison.fileSha256);
    expect(lines[comparison.line - 1]).toBe(comparison.text);
    expect(hash(comparison.text)).toBe(comparison.lineSha256);
    const full = comparison.fullDescription;
    if (!full) throw new Error(row.name);
    expect(lines[full.line - 1]).toBe(full.text);
    expect(hash(full.text)).toBe(full.lineSha256);
    expect(full.text).toContain('|PRERULE:1,DisplayFullSpell');
    expect(full.text).not.toContain('|!PRERULE:1,DisplayFullSpell');
    const body = full.text.split('DESC:')[1]?.split('|PRERULE:')[0];
    if (!body) throw new Error(row.name);
    const equal =
      normalized(row.mechanicsReview.manualRule) === normalized(body);
    expect(full.normalizedEqual, row.name).toBe(equal);
    count++;
    if (equal) matches++;
  }
  expect(count).toBe(22);
  expect(matches).toBe(17);
});
it('enforces declared inherited notices, exact known identities, and separate literal body/action/save minima', async () => {
  const sources = new Map<
    string,
    { bytes: Buffer; raw: z.infer<typeof upstreamRecord> }
  >();
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.registryKeys).toEqual(['CRB']);
      expect(row.holdId).toBeNull();
    } else
      expect(heldNotices.find((h) => h.id === row.holdId)).toEqual({
        id: row.holdId,
        notices: [...new Set([row.book, ...row.registryKeys])],
        evidence: ['scripts/catalog/legal/spells-532.json'],
      });
    for (const key of row.registryKeys)
      expect(
        key === row.book ||
          reviewedAdmission.registry[key]?.aliases?.includes(row.book),
      ).toBe(true);
  }
  for (const row of spells) {
    for (const hit of row.noticeMinimumAudit.coreBodyTerms) {
      expect(
        row.fullContentReview.descriptionText.slice(hit.start, hit.end),
      ).toBe(hit.term);
      expect(row.requiredNotices).toContain('PZO1110');
    }
    for (const dep of row.inheritedNoticeReview) {
      expect(row.requiredNotices).toContain(dep.book);
      expect(hash(dep.evidence)).toBe(dep.evidenceSha256);
      const provenanceRow = [
        ...provenance.rawSources,
        ...provenance.dependencies,
      ].find((r) => r.externalKey === dep.externalKey);
      if (!provenanceRow) throw new Error(dep.externalKey);
      let source = sources.get(dep.externalKey);
      if (!source) {
        const bytes = await readFile(
          join(inputs.systemPath, provenanceRow.path),
        );
        source = { bytes, raw: upstreamRecord.parse(parse(bytes.toString())) };
        sources.set(dep.externalKey, source);
      }
      const { bytes, raw } = source;
      expect(hash(bytes)).toBe(dep.sourceFileSha256);
      expect(hash(sourceDescription(raw))).toBe(dep.sourceDescriptionSha256);
      if (dep.role === 'action-metadata-minimum')
        expect(JSON.parse(dep.evidence)).toEqual(
          z
            .array(
              z.object({
                activation: z.object({ unchained: z.unknown().optional() }),
              }),
            )
            .parse(raw.system.actions)
            .flatMap((a) =>
              a.activation.unchained === undefined
                ? []
                : [a.activation.unchained],
            ),
        );
      else if (dep.role === 'core-save-metadata-minimum')
        expect(JSON.parse(dep.evidence)).toEqual(
          z
            .array(
              z.object({
                _id: z.string().optional(),
                save: z.record(z.string(), z.unknown()).optional(),
              }),
            )
            .parse(raw.system.actions)
            .filter((a) =>
              ['will', 'fort', 'ref'].includes(String(a.save?.type)),
            )
            .map((a) => ({ actionId: a._id, save: a.save })),
        );
      else expect(sourceDescription(raw)).toContain(dep.evidence);
    }
  }
});
it('replays exact selected/context scopes and checks current content/evidence/notice bindings', () => {
  const sort = (r: { externalKey: string }[]) =>
    [...r].sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  expect(computeFingerprint(sort(bounded.catalog.entries))).toBe(
    computeFingerprint(sort(preview.entries)),
  );
  expect(computeFingerprint(sort(complete.catalog.entries))).toBe(
    computeFingerprint(sort(bindingPreview.entries)),
  );
  expect(computeFingerprint(complete.catalog.resources)).toBe(
    computeFingerprint(bindingPreview.resources),
  );
  expect(bounded.curation.passed).toBe(true);
  expect(bounded.curation.summary.required).toBe(0);
  expect(bounded.curation.summary.descriptions.checked).toBe(100);
  const gate = assessCatalogAdmission({
    artifact: complete,
    ...reviewedAdmission,
  });
  // Linked context Spells #536 whole-content wave 1 and #544 whole-content
  // wave 2 (Silent Image, Interposing Hand, Detect Thoughts) and #516
  // whole-content wave 3 (Summon Nature's Ally I) admitted; none of this
  // batch's. The waves 1-2 correction holds Wish (pf1/nnj51dwfkwd15ngj) at
  // the gate on PZO9443.
  expect(gate.admitted.map((r) => r.externalKey).sort()).toEqual([
    'pf1/0jwi6xovzukorxok',
    'pf1/kq916lznxo0ig68v',
    'pf1/nokru6mxk9p3r513',
    'pf1/nq4txj4d0dtzscu2',
    'pf1/nqfoy30smshc3c6w',
    'pf1/o4ywdvsm1oty8blq',
    'pf1/o6vh3lrmi1hsdzmm',
    'pf1/o87h8gjxevcbztgd',
    'pf1/ojwg1ki98tq8xyh9',
    'pf1/wu4y1ilg6iq28cr6',
    'pf1/xllxylvvqr82o2d5',
  ]);
  expect(
    gate.held.filter((r) => keys.includes(r.externalKey)).length +
      gate.failures.filter((r) => keys.includes(r.externalKey)).length,
  ).toBe(100);
  for (const row of spells) {
    const entry = complete.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (!entry) throw new Error(row.name);
    const binding = buildAssessmentBinding({
      entry,
      artifact: complete,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(
      findRecordedBindingProblems({
        recorded: row.binding,
        current: binding,
        evidenceId: row.evidenceId,
      }),
      row.name,
    ).toEqual([]);
    expect(
      reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      ),
    ).toMatchObject({
      ...binding,
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
    });
  }
});
it.each([
  ['Blood Armor', 'maximum enhancement bonus of +5'],
  ['Rigor Mortis', 'DC 25 Heal'],
  ['Rags to Riches', '+1 insight bonus'],
  ["Identifier's Eye", '+5 enhancement bonus'],
  ['Dazzling Blade', 'maximum bonus of +5 at 12th level'],
  ['Mind Over Matter', 'Strength Intelligence'],
  ['Ethereal Envelope', 'maximum DC of 30'],
  ['Enlarge Person', '+2 size bonus to Strength'],
  ['Cushioning Bands', '120 points at 10th level'],
  ['Second Wind', '2d8'],
])(
  'retains literal %s values and never applies a recorded Spell as a running effect',
  (name, fragment) => {
    const row = spells.find((r) => r.name === name);
    if (!row) throw new Error(name);
    expect(row.mechanicsReview.manualRule.replace(/\s+/g, ' ')).toContain(
      fragment,
    );
    const spell = spellFixture(name);
    const castingClass = Object.keys(spell.detail.levels)[0];
    if (!castingClass) throw new Error(name);
    const view = calculateCharacterSheetProjections(
      recordedSpellSheet(name, castingClass),
    );
    for (const calculated of [view.current, view.permanent]) {
      expect(calculated.abilities.strength.score).toBe(10);
      expect(calculated.abilities.constitution.score).toBe(10);
      expect(calculated.spellEffects).toEqual([]);
    }
  },
);
it('retains exact body/action contradictions and uses existing Situations at their actual scope', () => {
  expect(
    spells
      .find((r) => r.name === 'Sunburst')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('25d6');
  expect(
    spells
      .find((r) => r.name === 'Flash Flood')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('10d6');
  expect(
    spells
      .find((r) => r.name === 'Shard of Chaos')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('1d6 rounds');
  expect(
    spells
      .find((r) => r.name === 'Second Wind')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('immediate action');
  for (const [name, situation] of [
    ["Identifier's Eye", 'identifyMagicItems'],
    ['Vermin Shape II', 'mindAffecting'],
    ['Blessing of the Watch', 'fear'],
  ])
    expect(
      spells
        .find((r) => r.name === name)
        ?.mechanicsReview.reviewedOptionalOutputs.some(
          (r) => r.kind === 'note' && r.situation === situation,
        ),
    ).toBe(true);
  for (const row of spells)
    for (const note of row.mechanicsReview.reviewedOptionalOutputs)
      if (note.kind === 'note')
        expect(note.text.length).toBeLessThanOrEqual(4096);
});
it('protects all historical context roots before adding optional outputs, retaining independent gaps', () => {
  const protection = z
    .object({
      sources: z.array(
        z.object({
          path: z.string(),
          sha256: z.string(),
          keys: z.array(z.string()),
        }),
      ),
      seedKeys: z.array(z.string()),
      closureKeys: z.array(z.string()),
      protectedRoots: z.array(z.string()),
      definitions: z.record(z.string(), z.string()),
    })
    .parse(snapshot('protected-context.json'));
  expect(protection.sources).toHaveLength(304);
  expect(protection.seedKeys).toHaveLength(4344);
  expect(protection.closureKeys).toHaveLength(5557);
  expect(Object.keys(protection.definitions)).toHaveLength(5505);
  expect(protection.protectedRoots).toHaveLength(25);
  // The sources are other batches' inventories and fixtures; those files are
  // theirs to change (#749).
  expect(
    spells
      .filter((r) => protection.closureKeys.includes(r.externalKey))
      .map((r) => r.externalKey)
      .sort(),
  ).toEqual(protection.protectedRoots);
  for (const key of protection.protectedRoots) {
    const record = reviewedCuration.records.find(
      (r) => r.externalKey === key && r.kind === 'description',
    );
    expect(record).toMatchObject({ outputs: [], diagnostics: [] });
    const row = spells.find((r) => r.externalKey === key);
    expect(row?.fullContentReview.descriptionText).toBe(record?.text);
  }
  for (const entry of complete.catalog.entries) {
    const original = protection.definitions[entry.externalKey];
    if (original)
      expect(computeFingerprint(entry), entry.externalKey).toBe(original);
  }
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-532.json',
    ),
  ).toEqual([]);
});
it('reconstructs the source fixture with portable TMPDIR scratch and pins all original source bytes', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'spells-532-fixture-'));
  try {
    for (const repo of ['pf1', 'pf1-content']) {
      const manifest = provenance.manifests.find((r) => r.repo === repo);
      if (!manifest) throw new Error(repo);
      const packs = z
        .object({ packs: z.array(z.object({ name: z.string() })) })
        .parse(
          JSON.parse(await readFile(join(root, repo, manifest.path), 'utf8')),
        ).packs;
      for (const pack of packs)
        await mkdir(
          join(scratch, repo, repo === 'pf1' ? 'packs' : 'src', pack.name),
          { recursive: true },
        );
    }
    for (const row of [
      ...provenance.rawSources,
      ...provenance.dependencies,
      ...provenance.classContext,
      ...provenance.manifests,
    ]) {
      const repo = 'repo' in row ? row.repo : 'pf1';
      const bytes = await readFile(join(root, repo, row.path));
      expect(hash(bytes)).toBe(row.sha256);
      const target = join(scratch, repo, row.path);
      await mkdir(join(target, '..'), { recursive: true });
      await copyFile(join(root, repo, row.path), target);
    }
    for (const path of provenance.emptyDirectories) {
      await mkdir(join(scratch, path, '..'), { recursive: true });
      await copyFile(join(root, path), join(scratch, path));
    }
    const replay = await importCatalog({
      ...inputs,
      systemPath: join(scratch, 'pf1'),
      contentPath: join(scratch, 'pf1-content'),
      candidateKeys: bindingPreview.entries.map((r) => r.externalKey),
    });
    expect(computeFingerprint(replay.catalog.entries)).toBe(
      computeFingerprint(complete.catalog.entries),
    );
    expect(computeFingerprint(replay.catalog.resources)).toBe(
      computeFingerprint(complete.catalog.resources),
    );
    expect(
      assessCatalogAdmission({ artifact: replay, ...reviewedAdmission }),
    ).toEqual(
      assessCatalogAdmission({ artifact: complete, ...reviewedAdmission }),
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

it('keeps Aura Power prose and its strength table together, with an honest partial scope', () => {
  const aura = spells.find((row) => row.name === 'Aura Sight');
  const base = aura?.mechanicsReview.governingSpellBodies[0];
  if (!base) throw new Error('Missing Detect Evil excerpt');
  expect(base.descriptionText).toContain('<i>Aura Power</i>');
  expect(base.descriptionText).toContain('Duration of Lingering Aura');
  expect(base.noteText).toContain(
    "An evil aura's power depends on the type of evil creature or object",
  );
  expect(base.noteText).toContain(
    'If an aura falls into more than one strength category, the spell indicates the stronger of the two.',
  );
  expect(base.noteText).toContain('Cleric or paladin of an aligned deity');
  expect(base.noteText).toContain(
    '5th or lower 6th-10th 11th-15th 16th-20th 21st or higher',
  );
  expect(base.noteText).toContain(
    'The class description will indicate whether this applies.',
  );
  expect(base.noteText).not.toMatch(/Lingering Aura|1d6 rounds|3rd Round/);
  expect(base).toMatchObject({
    bodyRole: 'partial-governing-excerpt',
    completeGoverningBody: false,
    application: 'scoped-partial-direct-base',
  });
  expect(base.limits).toContain(
    'Aura Power definition and strength table only',
  );
  expect(base.relationship.reason).toBe(base.limits);
});

it('retains independent condition, CMB and missing-creature gaps for Mad Monkeys', () => {
  const row = spells.find((spell) => spell.name === 'Mad Monkeys');
  if (!row) throw new Error('Missing Mad Monkeys');
  expect(row.mechanicsReview.manualRule).toContain(
    'deafened for 1 minute as well as nauseated',
  );
  expect(row.mechanicsReview.manualRule).toContain(
    'your caster level plus your casting ability score bonus',
  );
  expect(row.mechanicsReview.manualRule).toContain('CMB + 10');
  const gaps = row.mechanicsReview.outstanding;
  expect(gaps).toHaveLength(3);
  expect(gaps[0]).toMatch(/deafened.*nauseated/);
  expect(gaps[1]).toContain('caster level + casting ability score bonus');
  expect(gaps[2]).toContain('Monkey Swarm statistics (Bestiary 2 p.212)');
  expect(row.mechanicsReview.descriptionRecord.unresolved).toEqual(gaps);
  expect(
    reviewedCuration.records
      .find((record) => record.externalKey === row.externalKey)
      ?.diagnostics.map((diagnostic) => diagnostic.text),
  ).toEqual(gaps);
});

it('keeps cloud and sunlight gaps independently of the frozen protected engine output', () => {
  for (const [name, sourceFragments, gapFragments] of [
    [
      'Incendiary Cloud',
      [
        '6d6 points of fire damage',
        'Reflex saves each round',
        '60 feet each round',
      ],
      ['6d6 fire', 'Reflex half', '10 feet away per round', '60 feet'],
    ],
    [
      'Sunburst',
      [
        'are blinded',
        'takes double damage',
        'destruction of any undead',
        'dispels any darkness',
        'maximum 25d6',
      ],
      [
        'Blindness',
        'double damage',
        'Destruction',
        'Dispelling darkness',
        '25d6',
      ],
    ],
  ] as const) {
    const row = spells.find((spell) => spell.name === name);
    if (!row) throw new Error(name);
    for (const fragment of sourceFragments)
      expect(row.mechanicsReview.manualRule).toContain(fragment);
    for (const fragment of gapFragments)
      expect(row.mechanicsReview.outstanding.join(' ')).toContain(fragment);
    expect(row.mechanicsReview.descriptionRecord).toMatchObject({
      outputCount: 0,
      unresolved: [],
    });
    expect(
      reviewedCuration.records.find(
        (record) => record.externalKey === row.externalKey,
      ),
    ).toMatchObject({ outputs: [], diagnostics: [] });
    const original = z
      .object({ definitions: z.record(z.string(), z.string()) })
      .parse(snapshot('protected-context.json'));
    expect(
      computeFingerprint(
        complete.catalog.entries.find(
          (entry) => entry.externalKey === row.externalKey,
        ),
      ),
    ).toBe(original.definitions[row.externalKey]);
  }
  for (const row of spells)
    expect(row.mechanicsReview.outstanding.length, row.name).toBeGreaterThan(0);
});

it('preserves Identifier’s Eye literal sentence and labels only the identification clause', () => {
  const row = spells.find((spell) => spell.name === "Identifier's Eye");
  if (!row) throw new Error('Missing Identifier’s Eye');
  const own = row.mechanicsReview.reviewedOptionalOutputs.slice(
    0,
    row.mechanicsReview.ownNoteCount,
  );
  if (own[0]?.kind !== 'note') throw new Error('Missing literal own Note');
  expect(own[0]).toEqual({
    kind: 'note',
    text: row.mechanicsReview.manualRule,
  });
  expect(own[0]?.text).toContain(
    'detect magic and also gains a +5 enhancement bonus',
  );
  expect(own[0]?.text).toContain(
    'magic items. Further, the target can attempt such checks untrained',
  );
  expect(own[1]).toEqual({
    kind: 'note',
    text: 'also gains a +5 enhancement bonus on Spellcraft checks to identify the properties and command words of magic items.',
    situation: 'identifyMagicItems',
  });
});

it('makes every Shadow Transmutation alternative exclusive and substitutes the subject for Stone Fist’s caster', () => {
  const row = spells.find((spell) => spell.name === 'Shadow Transmutation');
  if (!row) throw new Error('Missing Shadow Transmutation');
  for (const base of row.mechanicsReview.governingSpellBodies) {
    expect(base.prefix).toContain(
      'choose one alternative, never simultaneous grants',
    );
    expect(base.prefix).toContain('the root subject receives the chosen form');
  }
  const stone = row.mechanicsReview.governingSpellBodies.find(
    (base) => base.name === 'Stone Fist',
  );
  expect(stone?.noteText).toContain(
    'This spell transforms your hands into living stone.',
  );
  expect(stone?.prefix).toContain(
    'substitute the root subject for the original caster in every "you" and "your" reference',
  );
  expect(stone?.prefix).toContain(
    'hands, unarmed strikes, being Small and rock-to-mud termination/damage',
  );
  expect(stone?.noteText).toContain('1d4 if you are Small');
  expect(stone?.noteText).toContain(
    'Should you be the target of transmute rock to mud',
  );
  expect(stone?.noteText).toContain('you take 4d6 points of damage');
});

it('reconciles reviewed, applied and unapplied Notes from actual records and resolver outputs', () => {
  const reviewed = spells.flatMap(
    (row) => row.mechanicsReview.reviewedOptionalOutputs,
  );
  const applied = bounded.catalog.entries.flatMap(
    (entry) => entry.situationalNotes ?? [],
  );
  const protectedNotes = spells
    .filter((row) => row.mechanicsReview.protectedHistoricalContext)
    .flatMap((row) => row.mechanicsReview.reviewedOptionalOutputs);
  expect(reviewed.length).toBe(applied.length + protectedNotes.length);
  expect(review.mechanicsSummary.reviewedNotes).toBe(reviewed.length);
  expect(review.mechanicsSummary.descriptionNotes).toBe(applied.length);
  expect(review.mechanicsSummary.unappliedNotes).toBe(protectedNotes.length);
  expect(protectedNotes).toHaveLength(38);
});

it('preserves real absent optional properties through JSON and schema transport without substituting null', () => {
  const jolt = bounded.catalog.entries.find((entry) => entry.name === 'Jolt');
  if (!jolt) throw new Error('Missing Jolt');
  const transported: unknown = JSON.parse(JSON.stringify(jolt));
  const schema = z.object({
    prerequisiteText: z.string().optional(),
    unsupported: z.array(
      z.object({ field: z.string(), value: z.unknown().optional() }),
    ),
  });
  const roundtrip = schema.parse(transported);
  expect(Object.hasOwn(jolt, 'prerequisiteText')).toBe(false);
  expect(Object.hasOwn(roundtrip, 'prerequisiteText')).toBe(false);
  expect(roundtrip.prerequisiteText).toBeUndefined();
  const issue = jolt.unsupported.find(
    (row) => row.field === 'curation.mechanics',
  );
  const readback = roundtrip.unsupported.find(
    (row) => row.field === 'curation.mechanics',
  );
  expect(Object.hasOwn(issue ?? {}, 'value')).toBe(false);
  expect(Object.hasOwn(readback ?? {}, 'value')).toBe(false);
  expect(readback?.value).toBeUndefined();
});
