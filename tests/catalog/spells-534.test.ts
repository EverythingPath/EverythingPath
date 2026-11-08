// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
} from '../fixtures/spells-534/data';
import { spellFixture, recordedSpellSheet } from '../fixtures/spells-534/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
} from './batch-ownership';
const root = resolve('tests/fixtures/spells-534');
const keys = spells.map((r) => r.externalKey);
const hash = (s: string | Buffer) =>
  createHash('sha256').update(s).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  curation: reviewedCuration,
};
let selected: Awaited<ReturnType<typeof importCatalog>>,
  context: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  selected = await importCatalog({ ...inputs, candidateKeys: keys });
  context = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.candidateKeys,
  });
});
it('reviews exactly the ordered100 Spell keys and keeps literal source identities intact', async () => {
  expect(review.ticket).toBe(534);
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
  const tagged: string[] = [];
  const domainOnly: string[] = [];
  for (const row of spells) {
    const bytes = await readFile(join(inputs.systemPath, row.source.path));
    const raw = upstreamRecord.parse(parse(bytes.toString()));
    expect(hash(bytes)).toBe(row.source.sha256);
    expect(raw._key).toBe('!items!' + row.externalKey.split('/')[1]);
    expect(raw.type).toBe('spell');
    expect(sourceDescription(raw)).toBe(row.fullContentReview.descriptionText);
    expect(hash(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(raw.system).toEqual(row.fullContentReview.completeRawSystem);
    expect(raw.system.sources).toEqual(row.citedSources);
    const entry = selected.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (entry?.detail.kind !== 'spell') throw new Error(row.name);
    expect(entry.detail.levels).toEqual(
      z
        .object({ class: z.record(z.string(), z.number()).optional() })
        .parse(raw.system.learnedAt).class ?? {},
    );
    if (
      !Object.hasOwn(
        z.record(z.string(), z.unknown()).parse(raw.system.learnedAt),
        'class',
      )
    ) {
      domainOnly.push(row.name);
      expect(entry.detail.levels).toEqual({});
    }
    expect(entry.modifiers).toEqual([]);
    expect(row.mechanicsReview.outstanding.length).toBeGreaterThan(0);
    if (
      z
        .array(z.string())
        .parse(raw.system.tags ?? [])
        .includes('3.5')
    ) {
      tagged.push(row.name);
      expect(row.holdIds).toContain(
        'spells-534-' + raw._id + '-record-level3.5tag',
      );
    }
  }
  expect(tagged).toEqual([]);
  expect(domainOnly).toEqual([]);
});
it('keeps complete root Notes separate from unexpanded governing rules and protected history', () => {
  for (const row of spells) {
    const record = reviewedCuration.records.find(
      (r) => r.externalKey === row.externalKey && r.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: row.fullContentReview.descriptionText,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-11',
    });
    expect(record?.outputs).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.reviewedOptionalOutputs,
    );
    expect(record?.diagnostics.map((r) => r.text)).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.outstanding,
    );
    const words = (text: string) => {
      const counts = new Map<string, number>();
      for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
        counts.set(word, (counts.get(word) ?? 0) + 1);
      return [...counts].sort(([a], [b]) => a.localeCompare(b));
    };
    expect(
      words(
        row.mechanicsReview.reviewedOptionalOutputs
          .map((note) => (note.kind === 'note' ? note.text : ''))
          .join(' '),
      ),
      row.name +
        ' complete literal root-rule coverage, including moved shared Situations',
    ).toEqual(words(row.mechanicsReview.manualRule));
    expect(row.mechanicsReview.governingSpellBodies).toEqual([]);
    for (const note of row.mechanicsReview.reviewedOptionalOutputs) {
      expect(note.kind).toBe('note');
      if (note.kind === 'note')
        expect(note.text.length).toBeLessThanOrEqual(4096);
    }
  }
});
it('enforces every inherited notice minimum and preserves current source-bound assessments', () => {
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.registryKeys).toEqual(['CRB']);
      expect(requirement.holdId).toBeNull();
    } else
      expect(
        heldNotices.find((r) => r.id === requirement.holdId),
      ).toMatchObject({
        notices: expect.arrayContaining([
          requirement.book,
          ...requirement.registryKeys,
        ]),
        evidence: ['scripts/catalog/legal/spells-534.json'],
      });
  }
  for (const row of spells) {
    for (const dep of row.inheritedNoticeReview) {
      expect(row.requiredNotices).toContain(dep.book);
      expect(hash(dep.evidence)).toBe(dep.evidenceSha256);
    }
    expect(row.requiredNotices).toContain('PZO1131');
    const entry = context.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (!entry) throw new Error(row.name);
    const binding = buildAssessmentBinding({
      entry,
      artifact: context,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(
      reviewedAdmission.assessments.find(
        (r) => r.externalKey === row.externalKey,
      ),
    ).toMatchObject({
      ...binding,
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
    });
    expect(
      findRecordedBindingProblems({
        recorded: row.binding,
        current: binding,
        evidenceId: row.evidenceId,
      }),
      row.name,
    ).toEqual([]);
  }
  const gate = assessCatalogAdmission({
    artifact: context,
    ...reviewedAdmission,
  });
  expect(gate.admitted.filter((r) => keys.includes(r.externalKey))).toEqual([]);
  expect(computeFingerprint(selected.catalog.entries)).toBe(
    computeFingerprint(preview.entries),
  );
  expect(computeFingerprint(context.catalog.entries)).toBe(
    computeFingerprint(bindingPreview.entries),
  );
  expect(selected.curation.passed).toBe(true);
  expect(selected.curation.summary.required).toBe(0);
  expect(selected.curation.summary.descriptions.checked).toBe(100);
});
it.each([
  ['Barkskin', 'maximum of +5 at 12th level'],
  ['Cultural Adaptation', '+2 circumstance bonus on Diplomacy'],
  ['Caustic Blood', 'maximum 15d6'],
  ['Mathematical Curse', 'Roll 3d8'],
  ['Certain Grip', '+4 competence bonus on Climb'],
  ['Resounding Clang', 'maximum of -4 at 16th level'],
  ['Monstrous Physique I', '+2 size bonus to your Dexterity'],
  ['Reflexive Barrier', 'beginning of your next turn'],
  ['Karmic Blessing', 'one skill of your choice'],
  ['Ray of Enfeeblement', 'highest penalty instead'],
])(
  'retains %s values without applying a recorded Spell as a running effect',
  (name, fragment) => {
    const row = spells.find((r) => r.name === name);
    expect(row?.mechanicsReview.manualRule).toContain(fragment);
    const spell = spellFixture(name),
      tag = Object.keys(spell.detail.levels)[0];
    if (!tag) throw new Error(name);
    const projections = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const result of [projections.current, projections.permanent]) {
      expect(result.abilities.strength.score).toBe(10);
      expect(result.abilities.constitution.score).toBe(10);
      expect(result.abilities.dexterity.score).toBe(10);
      expect(result.spellEffects).toEqual([]);
    }
  },
);
it('retains contradictory action metadata and scopes fear Notes to the actual recipient', () => {
  expect(
    spells
      .find((r) => r.name === 'Caustic Blood')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('without cap');
  expect(
    spells
      .find((r) => r.name === 'Expel Blood')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('excludes Small');
  expect(
    spells
      .find((r) => r.name === 'Dread Bolt')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('1d4rounds');
  for (const name of ['Mirror Mantis', 'Blessing of Luck and Resolve']) {
    const notes = spells.find((r) => r.name === name)?.mechanicsReview
      .reviewedOptionalOutputs;
    const note = notes?.find(
      (r) => r.kind === 'note' && r.situation === 'fear',
    );
    expect(note).toMatchObject({ kind: 'note', situation: 'fear' });
    if (note?.kind === 'note') expect(note.text).toContain('target');
  }
});
it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-534.json',
    ),
  ).toEqual([]);
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
  expect(count).toBe(18);
  expect(matches).toBe(16);
});
it('verifies exact governing relationships and rejects same-name rules with different owners or versions', async () => {
  const inventory = z
    .object({
      candidates: z.array(
        z.object({
          name: z.string(),
          fullContentReview: z.object({ descriptionText: z.string() }),
          mechanicsReview: z.object({
            unexpandedGoverningSpellBodies: z.array(
              z.object({
                externalKey: z.string(),
                name: z.string(),
                fixturePath: z.string(),
                descriptionText: z.string(),
                descriptionSha256: z.string(),
                rawBodyComplete: z.literal(true),
                completeGoverningBody: z.literal(false),
                application: z.literal('unexpanded-no-output'),
                noteCount: z.literal(0),
                rootEvidence: z.string(),
                rootEvidenceStart: z.number(),
                rootEvidenceEnd: z.number(),
                omittedGoverningClauses: z.string(),
              }),
            ),
            nonSpellSupportingBodies: z.array(
              z.object({
                externalKey: z.string(),
                fixturePath: z.string(),
                sha256: z.string(),
                completeRawRecord: z.record(z.string(), z.unknown()),
                ruleKind: z.string(),
                owningClassOrRace: z.string().nullable(),
                application: z.literal('unexpanded-no-output'),
                noteCount: z.literal(0),
                rootEvidence: z.string(),
                rootEvidenceStart: z.number(),
                rootEvidenceEnd: z.number(),
              }),
            ),
            rejectedSupportingBodies: z.array(
              z.object({
                role: z.string(),
                application: z.literal('audit-only'),
              }),
            ),
          }),
        }),
      ),
    })
    .parse(snapshot('../../../scripts/catalog/legal/spells-534.json'));
  for (const row of inventory.candidates) {
    const rootText = row.fullContentReview.descriptionText;
    for (const body of row.mechanicsReview.unexpandedGoverningSpellBodies) {
      const bytes = await readFile(join(root, body.fixturePath));
      expect(
        sourceDescription(upstreamRecord.parse(parse(bytes.toString()))),
      ).toBe(body.descriptionText);
      expect(hash(body.descriptionText)).toBe(body.descriptionSha256);
      expect(rootText.slice(body.rootEvidenceStart, body.rootEvidenceEnd)).toBe(
        body.rootEvidence,
      );
      expect(body.omittedGoverningClauses).toContain('recipient');
    }
    for (const body of row.mechanicsReview.nonSpellSupportingBodies) {
      const bytes = await readFile(join(root, body.fixturePath));
      expect(hash(bytes)).toBe(body.sha256);
      expect(parse(bytes.toString())).toEqual(body.completeRawRecord);
      const actual = z
        .object({
          type: z.literal('feat'),
          system: z.object({
            associations: z
              .object({ classes: z.array(z.string()).default([]) })
              .default({ classes: [] }),
            tags: z.array(z.string()).default([]),
          }),
        })
        .parse(body.completeRawRecord);
      if (body.ruleKind === 'class-feature')
        expect(actual.system.associations.classes).toContain(
          body.owningClassOrRace,
        );
      if (body.ruleKind === 'racial-trait')
        expect(actual.system.tags).toContain(body.owningClassOrRace);
      if (body.externalKey === 'pf1/2L7pvHVWFGzx03n7')
        expect(body.fixturePath).toContain('packs/monster-abilities/');

      expect(rootText.slice(body.rootEvidenceStart, body.rootEvidenceEnd)).toBe(
        body.rootEvidence,
      );
    }
  }
  expect(
    inventory.candidates.find((r) => r.name === 'Expel Blood')?.mechanicsReview
      .rejectedSupportingBodies,
  ).toContainEqual({ role: 'rejected-owner-kind', application: 'audit-only' });
  expect(
    inventory.candidates.find((r) => r.name === 'Returning Weapon')
      ?.mechanicsReview.rejectedSupportingBodies,
  ).toContainEqual({
    role: 'rejected-publication-version',
    application: 'audit-only',
  });
  expect(
    inventory.candidates.find((r) => r.name === 'Flexible Fury')
      ?.mechanicsReview.rejectedSupportingBodies,
  ).toContainEqual({
    role: 'rejected-class-version',
    application: 'audit-only',
  });
});
it('derives required notice minima only from roots or identified operative rule bodies', () => {
  const inventory = z
    .object({
      candidates: z.array(
        z.object({
          externalKey: z.string(),
          name: z.string(),
          requiredNotices: z.array(z.string()),
          inheritedNoticeReview: z.array(z.object({ externalKey: z.string() })),
          auditNoticeReview: z.array(z.object({ externalKey: z.string() })),
          mechanicsReview: z.object({
            unexpandedGoverningSpellBodies: z.array(
              z.object({ externalKey: z.string() }),
            ),
            nonSpellSupportingBodies: z.array(
              z.object({ externalKey: z.string() }),
            ),
          }),
        }),
      ),
    })
    .parse(snapshot('../../../scripts/catalog/legal/spells-534.json'));
  for (const row of inventory.candidates) {
    const applicable = new Set([
      row.externalKey,
      ...row.mechanicsReview.unexpandedGoverningSpellBodies.map(
        (r) => r.externalKey,
      ),
      ...row.mechanicsReview.nonSpellSupportingBodies.map((r) => r.externalKey),
    ]);
    for (const e of row.inheritedNoticeReview)
      expect(applicable.has(e.externalKey), row.name).toBe(true);
    for (const e of row.auditNoticeReview)
      expect(applicable.has(e.externalKey), row.name).toBe(false);
  }
  expect(
    inventory.candidates.find((r) => r.name === 'Expel Blood')?.requiredNotices,
  ).toContain('PZO1116');
  expect(
    inventory.candidates.find((r) => r.name === 'Flexible Fury')
      ?.requiredNotices,
  ).toContain('PZO1110');
});
