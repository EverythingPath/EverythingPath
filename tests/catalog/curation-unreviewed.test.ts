// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { hashText } from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import { createCatalogRelease } from '../../scripts/catalog/release';
import type { ReleaseRow } from '../../src/lib/catalog/release-schema';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { materializePinnedTree } from './pinned-sources';

/**
 * pbl-unreviewed-reason: a curation record applied without a review labels
 * its entry unverified with `curation record not reviewed`, and a schedule
 * increment or ability score trait takes the reason from its attribution
 * owner, as it takes the other curation gaps. The pinned CRB Fighter
 * (pp. 55-57) with its features and the CRB dwarf (p. 21) import through the
 * real importer; a context note added to Armor Training and to the dwarf is the
 * fixture input a note record binds.
 */
const armorTraining = 'pf1/5JFfSqLMCpbRmERa';
const dwarf = 'pf1/nEltI9y37rKJTeWo';
const packFiles = [
  'classes/fighter.WLqBCT5DqmGAx8Wd.yaml',
  'class-abilities/bonus-feats-fgt.CV8BsY3ciUb9TA1Y.yaml',
  'class-abilities/bravery.h0Brxw6khcjlEf1T.yaml',
  'class-abilities/armor-training.5JFfSqLMCpbRmERa.yaml',
  'class-abilities/weapon-training.RzEzudurxQFirFoF.yaml',
  'class-abilities/armor-training-heavy-armor.iqeyCQIIVnNt0p3h.yaml',
  'class-abilities/armor-mastery.NwTe1Q2utlsmOAqK.yaml',
  'class-abilities/weapon-mastery.McXAM1BoPHZLO1n4.yaml',
  'races/dwarf.nEltI9y37rKJTeWo.yaml',
];

/**
 * The fixture notes: the first of each entry gets a record, Armor Training's
 * second none, and its third a diagnosed draft when a build asks for it.
 */
const notes = {
  armorTraining: {
    target: 'ac',
    text: 'Fixture note: Armor Training while wearing armor.',
  },
  armorTrainingUnrecorded: {
    target: 'ac',
    text: 'Fixture note: Armor Training with no record.',
  },
  armorTrainingDiagnosed: {
    target: 'ac',
    text: 'Fixture note: Armor Training with a diagnosed draft.',
  },
  dwarf: { target: 'skill.per', text: 'Fixture note: dwarven senses.' },
} as const;

let tree: Awaited<ReturnType<typeof materializePinnedTree>>;
beforeAll(async () => {
  tree = await materializePinnedTree(
    packFiles.map((file) => `pf1/packs/${file}`),
  );
  const addNotes = async (file: string, added: object[]) => {
    const path = join(tree.systemPath, 'packs', file);
    const record = parse(await readFile(path, 'utf8'));
    record.system.contextNotes = [
      ...(record.system.contextNotes ?? []),
      ...added,
    ];
    await writeFile(path, stringify(record));
  };
  await addNotes('class-abilities/armor-training.5JFfSqLMCpbRmERa.yaml', [
    notes.armorTraining,
    notes.armorTrainingUnrecorded,
    notes.armorTrainingDiagnosed,
  ]);
  await addNotes('races/dwarf.nEltI9y37rKJTeWo.yaml', [notes.dwarf]);
}, 60_000);
afterAll(() => tree?.dispose());

type Review =
  | { kind: 'drafted' }
  | { kind: 'drafted with a diagnostic' }
  | { kind: 'checked' };
function noteRecord(
  externalKey: string,
  note: { target: string; text: string },
  review: Review,
) {
  return {
    externalKey,
    kind: 'note',
    target: note.target,
    text: note.text,
    textSha256: hashText(note.text),
    outputs: [{ kind: 'note', target: note.target, text: note.text }],
    rationale: 'Fixture record (pbl-unreviewed-reason).',
    seedBindings: [],
    ...(review.kind === 'checked'
      ? {
          status: 'checked',
          diagnostics: [],
          reviewedBy: 'Fixture reviewer',
          reviewedOn: '2026-11-27',
        }
      : {
          status: 'drafted',
          diagnostics:
            review.kind === 'drafted'
              ? []
              : [{ kind: 'review', text: 'Fixture: review the note.' }],
        }),
  };
}

async function build(review: Review, { diagnosed = false } = {}) {
  const artifact = await importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps: [],
    curation: {
      ...reviewedCuration,
      records: [
        ...reviewedCuration.records,
        noteRecord(armorTraining, notes.armorTraining, review),
        noteRecord(dwarf, notes.dwarf, review),
        ...(diagnosed
          ? [
              noteRecord(armorTraining, notes.armorTrainingDiagnosed, {
                kind: 'drafted with a diagnostic',
              }),
            ]
          : []),
      ],
    },
    wholeCorpus: false,
  });
  const gate = assessCatalogAdmission({
    artifact,
    assessments: [],
    evidence: {},
    registry: reviewedAdmission.registry,
  });
  const release = await createCatalogRelease({
    artifact,
    attribution: reviewedAdmission,
    legalResources,
    inputValues: {
      remaps: [],
      curation: [],
      localData: [],
      parsers: 'fixture-parser',
      sanitizers: 'fixture-sanitizer',
      ruleResources: [],
    },
    compatibility: { schema: 's', calculation: 'c' },
    releaseNumber: 1,
  });
  const rows: ReleaseRow[] = release.batches.flat();
  const labelOf = (key: string) =>
    (
      rows.find((row) => row.kind === 'definition' && row.key === key)
        ?.payload as { verification?: unknown } | undefined
    )?.verification;
  const gapsOf = (key: string) =>
    gate.admitted.find((row) => row.externalKey === key)?.unverified;
  return { artifact, gate, rows, labelOf, gapsOf };
}

describe('an applied drafted note record (clause a)', () => {
  let built: Awaited<ReturnType<typeof build>>;
  beforeAll(async () => {
    built = await build({ kind: 'drafted' });
  }, 120_000);

  it('applies the record and lists its entry as unreviewed in the curation report', () => {
    const { artifact } = built;
    expect(artifact.curation.unreviewed).toEqual([
      'pf1/5JFfSqLMCpbRmERa',
      'pf1/nEltI9y37rKJTeWo',
    ]);
    expect(
      artifact.catalog.entries.find((entry) => entry.externalKey === dwarf)
        ?.situationalNotes,
    ).toContainEqual({
      target: 'skill.per',
      text: 'Fixture note: dwarven senses.',
    });
  });

  it('admits the entry with the gap, holding and failing nothing for it', () => {
    const { gate, gapsOf } = built;
    expect(gate.passed).toBe(true);
    expect(gate.failures).toEqual([]);
    // Weapon Training and its increments are held for their notice (#227),
    // whatever the curation.
    expect(gate.held.map(({ externalKey }) => externalKey).sort()).toEqual([
      'everythingpath/fighter-weapon-training-13',
      'everythingpath/fighter-weapon-training-17',
      'everythingpath/fighter-weapon-training-9',
      'pf1/RzEzudurxQFirFoF',
    ]);
    expect(gapsOf('pf1/nEltI9y37rKJTeWo')).toEqual([
      'curation record not reviewed',
    ]);
  });

  it('labels the released definition unverified with the reason, after the existing reasons in their order', () => {
    const { labelOf, rows } = built;
    expect(labelOf('pf1/nEltI9y37rKJTeWo')).toEqual({
      state: 'unverified',
      reasons: ['no verification projection', 'curation record not reviewed'],
    });
    // Armor Training also misses a record for its second note.
    expect(labelOf('pf1/5JFfSqLMCpbRmERa')).toEqual({
      state: 'unverified',
      reasons: [
        'no verification projection',
        'no curation record',
        'curation record not reviewed',
      ],
    });
    expect(
      rows
        .filter((row) => row.key.startsWith('curation:unreviewed:'))
        .map(({ key, payload }) => [key, payload]),
    ).toEqual([
      ['curation:unreviewed:0', 'pf1/5JFfSqLMCpbRmERa'],
      ['curation:unreviewed:1', 'pf1/nEltI9y37rKJTeWo'],
    ]);
  });

  it('gives the reason to the schedule increments and the ability score trait whose owner has the record, and to no other entry (clause b)', () => {
    const { gapsOf, labelOf, gate } = built;
    for (const key of [
      'everythingpath/fighter-armor-training-7',
      'everythingpath/fighter-armor-training-11',
      'everythingpath/fighter-armor-training-15',
    ]) {
      expect(gapsOf(key), key).toEqual([
        'no curation record',
        'curation record not reviewed',
      ]);
      expect(labelOf(key), key).toEqual({
        state: 'unverified',
        reasons: [
          'no verification projection',
          'no curation record',
          'curation record not reviewed',
        ],
      });
    }
    expect(gapsOf('local/race-ability-scores/pf1/nEltI9y37rKJTeWo')).toEqual([
      'curation record not reviewed',
    ]);
    expect(labelOf('local/race-ability-scores/pf1/nEltI9y37rKJTeWo')).toEqual({
      state: 'unverified',
      reasons: ['no verification projection', 'curation record not reviewed'],
    });
    // Bravery's increment: its owner has no such record.
    expect(
      gate.admitted.some(
        ({ externalKey }) => externalKey === 'everythingpath/fighter-bravery-6',
      ),
    ).toBe(true);
    expect(gapsOf('everythingpath/fighter-bravery-6')).toBeUndefined();
    expect(labelOf('everythingpath/fighter-bravery-6')).toEqual({
      state: 'unverified',
      reasons: ['no verification projection'],
    });
    expect(
      gate.admitted
        .filter(({ unverified }) =>
          unverified?.includes('curation record not reviewed'),
        )
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([
      'everythingpath/fighter-armor-training-11',
      'everythingpath/fighter-armor-training-15',
      'everythingpath/fighter-armor-training-7',
      'local/race-ability-scores/pf1/nEltI9y37rKJTeWo',
      'pf1/5JFfSqLMCpbRmERa',
      'pf1/nEltI9y37rKJTeWo',
    ]);
  });
});

describe('a record that gives no such gap (clause c)', () => {
  it('a checked record: applied, reviewed, no entry unreviewed', async () => {
    const { artifact, gate, gapsOf, labelOf } = await build({
      kind: 'checked',
    });
    expect(artifact.curation.unreviewed).toEqual([]);
    expect(
      gate.admitted.filter(({ unverified }) =>
        unverified?.includes('curation record not reviewed'),
      ),
    ).toEqual([]);
    expect(gapsOf('pf1/nEltI9y37rKJTeWo')).toBeUndefined();
    expect(gapsOf('pf1/5JFfSqLMCpbRmERa')).toEqual(['no curation record']);
    expect(labelOf('pf1/nEltI9y37rKJTeWo')).toEqual({
      state: 'unverified',
      reasons: ['no verification projection'],
    });
  }, 120_000);

  it('a drafted record with a diagnostic: not applied, so its entry reads unresolved curation mechanics, never unreviewed', async () => {
    const { artifact, gapsOf, labelOf } = await build({
      kind: 'drafted with a diagnostic',
    });
    expect(artifact.curation.unreviewed).toEqual([]);
    expect(
      artifact.catalog.entries.find((entry) => entry.externalKey === dwarf)
        ?.situationalNotes ?? [],
    ).not.toContainEqual({
      target: 'skill.per',
      text: 'Fixture note: dwarven senses.',
    });
    expect(gapsOf('pf1/nEltI9y37rKJTeWo')).toEqual([
      'unresolved curation mechanics',
    ]);
    expect(gapsOf('local/race-ability-scores/pf1/nEltI9y37rKJTeWo')).toEqual([
      'unresolved curation mechanics',
    ]);
    expect(labelOf('pf1/nEltI9y37rKJTeWo')).toEqual({
      state: 'unverified',
      reasons: ['no verification projection', 'unresolved curation mechanics'],
    });
  }, 120_000);
});

describe('gaps that coexist on one definition', () => {
  it('gives them in their order: no curation record, unresolved curation mechanics, curation record not reviewed', async () => {
    // Armor Training: one note with no record, one with a diagnosed draft and
    // one with an applied draft; its increments take all three.
    const { gate, gapsOf, labelOf } = await build(
      { kind: 'drafted' },
      { diagnosed: true },
    );
    expect(gate.passed).toBe(true);
    for (const key of [
      'pf1/5JFfSqLMCpbRmERa',
      'everythingpath/fighter-armor-training-7',
    ]) {
      expect(gapsOf(key), key).toEqual([
        'no curation record',
        'unresolved curation mechanics',
        'curation record not reviewed',
      ]);
      expect(labelOf(key), key).toEqual({
        state: 'unverified',
        reasons: [
          'no verification projection',
          'no curation record',
          'unresolved curation mechanics',
          'curation record not reviewed',
        ],
      });
    }
  }, 120_000);
});

describe('an unreviewed key that names no candidate (must refuse)', () => {
  it('fails the gate with a failure naming the key, as a missing record or unresolved mechanics naming no candidate do', async () => {
    const { artifact } = await build({ kind: 'drafted' });
    const gate = assessCatalogAdmission({
      artifact: {
        ...artifact,
        curation: {
          ...artifact.curation,
          unreviewed: [...artifact.curation.unreviewed, 'pf1/NotACandidate'],
        },
      },
      assessments: [],
      evidence: {},
      registry: reviewedAdmission.registry,
    });
    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual([
      {
        externalKey: 'pf1/NotACandidate',
        reason:
          'Curation record not reviewed: applied to pf1/NotACandidate, which is not a candidate.',
      },
    ]);
    // The candidates the list names are still labelled.
    expect(
      gate.admitted.find(
        ({ externalKey }) => externalKey === 'pf1/nEltI9y37rKJTeWo',
      )?.unverified,
    ).toEqual(['curation record not reviewed']);
  }, 120_000);
});
