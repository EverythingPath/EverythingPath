// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import {
  fighter,
  fighterFeatures as features,
  importPinnedFighter,
} from './pinned-fighter';

/**
 * S3: a schedule increment takes its parent's Attribution Assessment
 * (`attributionFrom`, #721), so the gate admits, holds or fails it exactly
 * with its parent. The pinned Fighter (`pinned-fighter.ts`) imports with the
 * committed curation; the real Section 15 Registry decides notices. Assertions compare
 * each increment with its parent, never with a notice outcome, so they hold
 * whatever the Registry's records say.
 */
const assessedKeys = [fighter, ...Object.values(features)];

type Artifact = Awaited<ReturnType<typeof importPinnedFighter>>;
type Gate = ReturnType<typeof assessCatalogAdmission>;
let artifact: Artifact;
let registry: ReturnType<typeof reviewedAdmissionSchema.shape.registry.parse>;
beforeAll(async () => {
  artifact = await importPinnedFighter();
  registry = reviewedAdmissionSchema.shape.registry.parse(
    JSON.parse(
      await readFile(
        new URL(
          '../../src/lib/catalog/data/section15-registry.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );
}, 60_000);

const evidence = {
  s3: {
    content:
      'Test-only whole-content comparison (S3 schedule admission); not a reviewed assessment.',
  },
};

/** Test-only confirmed assessments of the Fighter's eight keys, bound to the import. */
function standInAssessments(from: Artifact = artifact) {
  return assessedKeys.map((externalKey) => {
    const entry = entryOf(externalKey, from);
    const requiredNotices = [
      ...new Set(entry.sources.map(({ book }) => book)),
    ].sort();
    return {
      externalKey,
      status: 'confirmed' as const,
      ...buildAssessmentBinding({
        entry,
        artifact: from,
        evidence,
        registry,
        requiredNotices,
        evidenceIds: ['s3'],
      }),
      requiredNotices,
      rationale: 'Test-only confirmation (S3).',
      reviewedBy: 'Test fixture',
      reviewedOn: '2026-10-30',
    };
  });
}

function entryOf(key: string, from: Artifact = artifact) {
  const found = from.catalog.entries.find((row) => row.externalKey === key);
  if (!found) throw new Error(`Missing entry ${key}`);
  return found;
}
function increments(from: Artifact = artifact) {
  return from.catalog.entries.filter(
    (entry) => entry.pack === 'everythingpath-schedules',
  );
}
function parentOf(entry: PreviewEntry) {
  if (entry.detail.kind !== 'classFeature' || !entry.detail.parentFeature)
    throw new Error(`${entry.externalKey} has no parent.`);
  return entry.detail.parentFeature;
}
function withEntries(
  edit: (entry: PreviewEntry) => PreviewEntry,
  from: Artifact = artifact,
): Artifact {
  return {
    ...from,
    catalog: { ...from.catalog, entries: from.catalog.entries.map(edit) },
  };
}

/** Each key's gate outcome: its list and reason (an admitted row has none). */
function outcomes(gate: Gate) {
  const result = new Map<string, { outcome: string; reason?: string }>();
  for (const row of gate.admitted)
    result.set(row.externalKey, { outcome: 'admitted' });
  for (const row of gate.held)
    result.set(row.externalKey, { outcome: 'held', reason: row.reason });
  for (const row of gate.dependentOmissions)
    result.set(row.externalKey, {
      outcome: 'dependent-omitted',
      reason: row.reason,
    });
  for (const row of gate.failures)
    result.set(row.externalKey, { outcome: 'failed', reason: row.reason });
  return result;
}

/** A key's failure reasons, in the gate's order. */
const failuresOf = (gate: Gate, key: string) =>
  gate.failures
    .filter(({ externalKey }) => externalKey === key)
    .map(({ reason }) => reason);

/**
 * Every increment's outcome and reason equal its parent's: admitted, held
 * (missing assessment, explicit or notice hold) or failed, with every one
 * of the parent's failure reasons.
 */
function expectIncrementsFollowParents(gate: Gate, from: Artifact = artifact) {
  const byKey = outcomes(gate);
  const rows = increments(from);
  expect(rows).toHaveLength(20);
  for (const increment of rows) {
    const parent = parentOf(increment);
    expect(byKey.get(increment.externalKey), increment.externalKey).toEqual(
      byKey.get(parent),
    );
    expect(
      failuresOf(gate, increment.externalKey),
      increment.externalKey,
    ).toEqual(failuresOf(gate, parent));
  }
}

/** Increment failures that are not their parent's. */
const ownIncrementFailures = (gate: Gate, from: Artifact = artifact) =>
  increments(from).flatMap((increment) => {
    const parent = failuresOf(gate, parentOf(increment));
    return failuresOf(gate, increment.externalKey).filter(
      (reason) => !parent.includes(reason),
    );
  });

/** The artifact with one parent's body edited. */
const withParent = (key: string, edit: (entry: PreviewEntry) => PreviewEntry) =>
  withEntries((entry) => (entry.externalKey === key ? edit(entry) : entry));

describe('schedule increments at the admission gate', () => {
  it('imports the Fighter with its 27 rows and 20 increments, each taking its parent’s attribution', () => {
    const detail = entryOf(fighter).detail;
    expect(detail.kind === 'class' && detail.featuresByLevel).toHaveLength(27);
    expect(
      increments().map((entry) => [
        entry.externalKey,
        entry.attributionFrom,
        entry.upstreamKey,
      ]),
    ).toEqual(
      increments().map((entry) => [
        entry.externalKey,
        parentOf(entry),
        parentOf(entry),
      ]),
    );
  });

  it('holds each increment with its parent while no assessment exists', () => {
    const gate = assessCatalogAdmission({
      artifact,
      registry,
      evidence,
      assessments: [],
    });
    expect(ownIncrementFailures(gate)).toEqual([]);
    expectIncrementsFollowParents(gate);
    const held = new Map(gate.held.map((row) => [row.externalKey, row]));
    for (const increment of increments()) {
      const parentRow = held.get(parentOf(increment));
      if (!parentRow) throw new Error(`${parentOf(increment)} is not held.`);
      const { externalKey: _key, name: _name, ...parent } = parentRow;
      expect(parent.reason).toBe('missing Attribution Assessment');
      // Its whole row is the parent's: notices and evidence included.
      expect(held.get(increment.externalKey)).toEqual({
        externalKey: increment.externalKey,
        name: increment.name,
        ...parent,
      });
    }
  });

  it('with the eight Fighter keys assessed, admits the Fighter with all 27 rows, each increment with its parent', () => {
    // #596 run A curates every Fighter feature, so stand-in assessments of
    // the eight keys admit the whole class.
    const gate = assessCatalogAdmission({
      artifact,
      registry,
      evidence,
      assessments: standInAssessments(),
    });
    expect(ownIncrementFailures(gate)).toEqual([]);
    expectIncrementsFollowParents(gate);
    const byKey = outcomes(gate);
    const detail = entryOf(fighter).detail;
    const rows =
      detail.kind === 'class'
        ? detail.featuresByLevel.map(({ externalKey }) => externalKey)
        : [];
    expect(rows).toHaveLength(27);
    for (const key of [fighter, ...rows])
      expect(byKey.get(key), key).toEqual({ outcome: 'admitted' });
  });

  it('holds an increment with its parent’s explicit hold', () => {
    const reason = 'Test hold on Armor Training (S3).';
    const held = withEntries((entry) =>
      entry.externalKey === features.armorTraining
        ? {
            ...entry,
            unsupported: [
              ...entry.unsupported,
              { field: 'attribution', reason },
            ],
          }
        : entry,
    );
    const gate = assessCatalogAdmission({
      artifact: held,
      registry,
      evidence,
      assessments: standInAssessments(held),
    });
    expectIncrementsFollowParents(gate, held);
    const byKey = outcomes(gate);
    for (const level of [7, 11, 15])
      expect(
        byKey.get(`everythingpath/fighter-armor-training-${level}`),
      ).toEqual({ outcome: 'held', reason });
    // The Fighter's omission names exactly its held rows: Armor Training and
    // the three increments held with it.
    expect(byKey.get(fighter)).toEqual({
      outcome: 'dependent-omitted',
      reason: `Dependent omission: ${[
        features.armorTraining,
        ...[7, 11, 15].map(
          (level) => `everythingpath/fighter-armor-training-${level}`,
        ),
      ]
        .sort()
        .join(', ')}.`,
    });
  });

  it('fails each increment with its parent’s own failure and reason: a broken reference or a missing curation record', () => {
    const armorTrainingIncrements = [7, 11, 15].map(
      (level) => `everythingpath/fighter-armor-training-${level}`,
    );
    // A broken description link on the parent alone (its increments' bodies
    // are intact), and a curation record the parent alone misses.
    const broken = withParent(features.armorTraining, (entry) => ({
      ...entry,
      unsupported: [
        ...entry.unsupported,
        { field: 'description.link', reason: 'Test broken link (S3).' },
      ],
    }));
    const uncurated: Artifact = {
      ...artifact,
      curation: {
        ...artifact.curation,
        missing: [
          ...artifact.curation.missing,
          {
            externalKey: features.armorTraining,
            kind: 'note',
            target: 'ac',
            text: 'Test note (S3).',
            textSha256: 'f'.repeat(64),
          },
        ],
      },
    };
    for (const [label, from, reason] of [
      [
        'broken reference',
        broken,
        'Broken structure or reference: unresolved imported reference.',
      ],
      [
        'missing curation record',
        uncurated,
        `Missing curation record: note ac (${'f'.repeat(64)}).`,
      ],
    ] as const)
      for (const assessed of [false, true]) {
        const gate = assessCatalogAdmission({
          artifact: from,
          registry,
          evidence,
          assessments: assessed ? standInAssessments(from) : [],
        });
        expectIncrementsFollowParents(gate, from);
        for (const key of [features.armorTraining, ...armorTrainingIncrements])
          expect(failuresOf(gate, key), `${label} ${key}`).toEqual([reason]);
        // The other increments are untouched.
        expect(ownIncrementFailures(gate, from), label).toEqual([]);
        expect(
          failuresOf(gate, 'everythingpath/fighter-bravery-6'),
          label,
        ).toEqual([]);
      }
  });

  it('fails an increment with its parent when the parent is absent from the import inventory', () => {
    const unaccounted: Artifact = {
      ...artifact,
      comparison: {
        ...artifact.comparison,
        records: artifact.comparison.records.filter(
          (record) => record.externalKey !== features.bravery,
        ),
      },
    };
    const gate = assessCatalogAdmission({
      artifact: unaccounted,
      registry,
      evidence,
      assessments: standInAssessments(unaccounted),
    });
    const reason = 'Unaccounted candidate: absent from import inventory.';
    for (const key of [
      features.bravery,
      ...[6, 10, 14, 18].map(
        (level) => `everythingpath/fighter-bravery-${level}`,
      ),
    ])
      expect(gate.failures, key).toContainEqual({ externalKey: key, reason });
  });

  it('refuses an attribution owner that is not the increment’s own parent feature', () => {
    const increment = 'everythingpath/fighter-bravery-6';
    const edited = (edit: (entry: PreviewEntry) => PreviewEntry) =>
      withEntries((entry) =>
        entry.externalKey === increment ? edit(entry) : entry,
      );
    for (const [label, candidate] of [
      // Another Fighter feature, not the row's parent.
      [
        'non-parent',
        edited((entry) => ({ ...entry, attributionFrom: features.bonusFeats })),
      ],
      // The parent, but under another upstream key (the class's).
      ['upstream key', edited((entry) => ({ ...entry, upstreamKey: fighter }))],
      // The parent, from a pack other than the reviewed schedules'.
      ['pack', edited((entry) => ({ ...entry, pack: 'class-abilities' }))],
      // No such entry.
      [
        'missing owner',
        edited((entry) => ({ ...entry, attributionFrom: 'pf1/noSuchFeature' })),
      ],
    ] as const) {
      const gate = assessCatalogAdmission({
        artifact: candidate,
        registry,
        evidence,
        assessments: standInAssessments(candidate),
      });
      expect(
        gate.failures.find(({ externalKey }) => externalKey === increment),
        label,
      ).toEqual({
        externalKey: increment,
        reason: expect.stringMatching(/^Invalid attribution owner: /),
      });
      expect(
        [...gate.admitted, ...gate.held].some(
          ({ externalKey }) => externalKey === increment,
        ),
        label,
      ).toBe(false);
    }
  });
});
