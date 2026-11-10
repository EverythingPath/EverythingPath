import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { z } from 'zod';
import {
  computeFingerprint,
  type buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import type { AttributionAssessment } from '../../src/lib/catalog/admission-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { createNoticeIndex } from '../../src/lib/catalog/resolve-notice';
import recordedEvidenceBaselines from './recorded-evidence-baselines.json';

/**
 * Preservation checks for an earlier curation batch (#749). A batch's tests
 * check what the batch owns: its own description records, Attribution
 * Assessments, evidence entries and holds, as its inventory
 * (`scripts/catalog/legal/<batch>.json`) recorded them. They no longer freeze
 * shared canonical files byte for byte, other batches' rows or fixtures, or
 * infrastructure. Notice fingerprints must match the current Registry, so a
 * reviewed notice correction that re-binds assessments keeps these checks
 * passing; content, mapping and evidence fingerprints stay as recorded.
 */

export type SharedCatalogData = Pick<
  typeof reviewedAdmission,
  'assessments' | 'evidence' | 'registry'
> & {
  records: typeof reviewedCuration.records;
  heldNotices: typeof heldNotices;
};
type AssessmentBinding = ReturnType<typeof buildAssessmentBinding>;
type Registry = SharedCatalogData['registry'];

const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
const noticeFingerprintsSchema = z.record(z.string(), fingerprintSchema);
const singleEvidenceSnapshotSchema = z.object({
  contentFingerprint: fingerprintSchema,
  mappingFingerprint: fingerprintSchema,
  evidenceFingerprint: fingerprintSchema,
  noticeFingerprints: noticeFingerprintsSchema,
});
const evidenceMapSnapshotSchema = z.object({
  contentFingerprint: fingerprintSchema,
  mappingFingerprint: fingerprintSchema,
  evidenceFingerprints: noticeFingerprintsSchema,
  noticeFingerprints: noticeFingerprintsSchema,
});
/** A binding snapshot as a batch inventory records it: #528-#536 or #348+. */
export type RecordedBindingSnapshot =
  | z.infer<typeof singleEvidenceSnapshotSchema>
  | z.infer<typeof evidenceMapSnapshotSchema>;

const assessedFields = {
  externalKey: z.string(),
  name: z.string(),
  // #547: a supported entry whose closure dependency isn't available yet is
  // dependently omitted (PRD Decision 17); its rows are checked like any other.
  disposition: z.enum(['held', 'admitted', 'dependently-omitted']),
  assessmentStatus: z.enum([
    'confirmed',
    'reviewed-coverage',
    'unresolved',
  ]) satisfies z.ZodType<AttributionAssessment['status']>,
  descriptionSha256: fingerprintSchema,
  source: z.object({ sha256: fingerprintSchema }),
  requiredNotices: z.array(z.string()),
  evidenceId: z.string(),
  holdIds: z.array(z.string()),
  noticeHoldIds: z.array(z.string()),
};
const assessedCandidateSchema = z.object(assessedFields);
const excludedCandidateSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  disposition: z.literal('excluded'),
});
const rawCandidateSchema = z.union([
  excludedCandidateSchema,
  assessedCandidateSchema.extend({
    currentBinding: evidenceMapSnapshotSchema,
  }),
  // A present current snapshot is authoritative, including validation errors.
  // Never discard a malformed supplemental hash by parsing a legacy shape.
  assessedCandidateSchema.extend({
    currentBinding: z.undefined(),
    binding: singleEvidenceSnapshotSchema,
  }),
  assessedCandidateSchema.extend({
    currentBinding: z.undefined(),
    binding: z.undefined(),
  }),
]);
const rawInventorySchema = z.object({
  candidates: z.array(rawCandidateSchema),
  noticeRequirements: z.array(
    z.object({
      book: z.string(),
      registryKeys: z.array(z.string()),
      holdId: z.string().nullable(),
    }),
  ),
});
const baselinesSchema = z.record(
  z.string(),
  z.object({
    derivedFrom: z.string(),
    evidence: z.record(z.string(), fingerprintSchema),
  }),
);

/**
 * The independent record of a batch's own evidence: its binding snapshot, or
 * for batches that recorded none (#343, #345-#347), the evidence hash the next
 * batch's historical manifest committed (`recorded-evidence-baselines.json`,
 * SHA-256 of the entry's JSON).
 */
type RecordedEvidence =
  | {
      kind: 'snapshot';
      contentFingerprint: string;
      mappingFingerprint: string;
      evidenceFingerprints: Record<string, string>;
    }
  | { kind: 'manifest'; derivedFrom: string; evidenceSha256: string };
type AssessedCandidate = z.infer<typeof assessedCandidateSchema> & {
  kind: 'assessed';
  recorded: RecordedEvidence;
};
type ExcludedCandidate = z.infer<typeof excludedCandidateSchema> & {
  kind: 'excluded';
};
type OwnedCandidate = AssessedCandidate | ExcludedCandidate;
export type BatchInventory = {
  candidates: OwnedCandidate[];
  noticeRequirements: z.infer<typeof rawInventorySchema>['noticeRequirements'];
};
type InventoryHold = { label: string; id: string; notices: string[] };

export function readBatchInventory(inventoryPath: string): BatchInventory {
  const raw = rawInventorySchema.parse(
    JSON.parse(readFileSync(inventoryPath, 'utf8')),
  );
  const baseline = baselinesSchema.parse(recordedEvidenceBaselines)[
    basename(inventoryPath, '.json')
  ];
  const candidates = raw.candidates.map((row): OwnedCandidate => {
    if (row.disposition === 'excluded') return { ...row, kind: 'excluded' };
    const recorded = readRecordedEvidence({ row, baseline });
    return { ...row, kind: 'assessed', recorded };
  });
  return { candidates, noticeRequirements: raw.noticeRequirements };
}

function readRecordedEvidence({
  row,
  baseline,
}: {
  row: Exclude<z.infer<typeof rawCandidateSchema>, { disposition: 'excluded' }>;
  baseline: z.infer<typeof baselinesSchema>[string] | undefined;
}): RecordedEvidence {
  if (row.currentBinding !== undefined) {
    const evidenceFingerprint =
      row.currentBinding.evidenceFingerprints[row.evidenceId];
    if (!evidenceFingerprint)
      throw new Error(`${row.name}: snapshot lacks ${row.evidenceId}`);
    return {
      ...row.currentBinding,
      evidenceFingerprints: row.currentBinding.evidenceFingerprints,
      kind: 'snapshot',
    };
  }
  if ('binding' in row && row.binding !== undefined)
    return {
      ...row.binding,
      evidenceFingerprints: {
        [row.evidenceId]: row.binding.evidenceFingerprint,
      },
      kind: 'snapshot',
    };
  const evidenceSha256 = baseline?.evidence[row.evidenceId];
  if (!baseline || !evidenceSha256)
    throw new Error(`${row.name}: no recorded evidence for ${row.evidenceId}`);
  return {
    kind: 'manifest',
    derivedFrom: baseline.derivedFrom,
    evidenceSha256,
  };
}

/** The committed shared catalog data, as the application and gate load it. */
export const sharedCatalogData: SharedCatalogData = {
  records: reviewedCuration.records,
  assessments: reviewedAdmission.assessments,
  evidence: reviewedAdmission.evidence,
  registry: reviewedAdmission.registry,
  heldNotices,
};

/** Problems with a batch's own rows in the committed shared catalog data. */
export function findCommittedBatchOwnershipProblems(inventoryPath: string) {
  return findBatchOwnershipProblems({
    inventoryPath,
    inventory: readBatchInventory(inventoryPath),
    data: sharedCatalogData,
  });
}

/**
 * The notice fingerprints an assessment requiring these notices binds to the
 * given Registry, by the admission gate's rule: each code's resolved notice,
 * or null when the code resolves to none.
 */
export function bindNoticeFingerprints({
  requiredNotices,
  registry = reviewedAdmission.registry,
}: {
  requiredNotices: readonly string[];
  registry?: Registry;
}): Record<string, string> {
  return fingerprintNotices({
    requiredNotices,
    index: createNoticeIndex({ registry }),
  });
}

function fingerprintNotices({
  requiredNotices,
  index,
}: {
  requiredNotices: readonly string[];
  index: ReturnType<typeof createNoticeIndex>;
}): Record<string, string> {
  return Object.fromEntries(
    requiredNotices.map((code) => [
      code,
      computeFingerprint(index.get(code) ?? null),
    ]),
  );
}

/** Rows of `rows` by key, in order, so a duplicate stays countable. */
function groupByKey<T>(rows: readonly T[], keyOf: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * The shared data a batch's checks look up per candidate, indexed once per
 * check: assessments and description records by key, and the Registry's
 * notices. The data is not changed while one check runs.
 */
function indexSharedCatalogData(data: SharedCatalogData) {
  return {
    assessments: groupByKey(data.assessments, (row) => row.externalKey),
    // An Item Ability has no prose-pass input: its required `itemAbility`
    // record binds the same raw description and is its description record
    // (#501; `collectDescriptionInputs` skips itemAbility entries).
    descriptions: groupByKey(
      data.records.filter(
        (record) =>
          record.kind === 'description' ||
          (record.kind === 'itemAbility' && record.target === 'description'),
      ),
      (record) => record.externalKey,
    ),
    notices: createNoticeIndex({ registry: data.registry }),
  };
}
type SharedCatalogIndex = ReturnType<typeof indexSharedCatalogData>;

const hashText = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const hasSameItems = ({
  actual,
  expected,
}: {
  actual: readonly string[];
  expected: readonly string[];
}) =>
  actual.length === expected.length &&
  actual.every((item, index) => item === expected[index]);
const describeCandidate = (row: { name: string; externalKey: string }) =>
  `${row.name} (${row.externalKey})`;

/**
 * Every way the shared catalog data departs from what the batch recorded for
 * its own entries. An empty list means the batch's own rows are intact.
 */
export function findBatchOwnershipProblems({
  inventoryPath,
  inventory,
  data,
}: {
  inventoryPath: string;
  inventory: BatchInventory;
  data: SharedCatalogData;
}): string[] {
  const holdIds = new Set(data.heldNotices.map((row) => row.id));
  const index = indexSharedCatalogData(data);
  const candidateProblems = inventory.candidates.flatMap((candidate) => {
    const assessments = index.assessments.get(candidate.externalKey) ?? [];
    if (candidate.kind === 'excluded')
      return assessments.length > 0
        ? [`${describeCandidate(candidate)}: excluded but has an assessment`]
        : [];
    const [assessment] = assessments;
    if (assessments.length !== 1 || !assessment)
      return [
        ...findDescriptionProblems({ candidate, index }),
        `${describeCandidate(candidate)}: ${assessments.length} assessments`,
      ];
    return [
      ...findDescriptionProblems({ candidate, index }),
      ...findAssessmentProblems({ candidate, assessment, index, holdIds }),
      ...findEvidenceProblems({ candidate, assessment, data }),
    ];
  });
  return [
    ...candidateProblems,
    ...findHoldProblems({ inventoryPath, inventory, data }),
  ];
}

function findDescriptionProblems({
  candidate,
  index,
}: {
  candidate: AssessedCandidate;
  index: SharedCatalogIndex;
}): string[] {
  const descriptions = index.descriptions.get(candidate.externalKey) ?? [];
  const [record] = descriptions;
  if (descriptions.length !== 1 || !record)
    return [
      `${describeCandidate(candidate)}: ${descriptions.length} description records`,
    ];
  const isRecorded =
    record.status === 'checked' &&
    record.textSha256 === candidate.descriptionSha256 &&
    hashText(record.text) === candidate.descriptionSha256;
  return isRecorded
    ? []
    : [
        `${describeCandidate(candidate)}: description record differs from the recorded one`,
      ];
}

function findAssessmentProblems({
  candidate,
  assessment,
  index,
  holdIds,
}: {
  candidate: AssessedCandidate;
  assessment: AttributionAssessment;
  index: SharedCatalogIndex;
  holdIds: ReadonlySet<string>;
}): string[] {
  const label = describeCandidate(candidate);
  const problems: string[] = [];
  if (assessment.status !== candidate.assessmentStatus)
    problems.push(
      `${label}: assessment is ${assessment.status}, recorded ${candidate.assessmentStatus}`,
    );
  if (
    !hasSameItems({
      actual: assessment.requiredNotices,
      expected: candidate.requiredNotices,
    })
  )
    problems.push(`${label}: required notices differ from the recorded ones`);
  const currentNotices = fingerprintNotices({
    requiredNotices: assessment.requiredNotices,
    index: index.notices,
  });
  if (
    computeFingerprint(assessment.noticeFingerprints) !==
    computeFingerprint(currentNotices)
  )
    problems.push(`${label}: notice bindings are not current`);
  const { recorded } = candidate;
  if (
    recorded.kind === 'snapshot' &&
    (assessment.contentFingerprint !== recorded.contentFingerprint ||
      assessment.mappingFingerprint !== recorded.mappingFingerprint)
  )
    problems.push(`${label}: content binding differs from the recorded one`);
  for (const id of candidate.holdIds)
    if (!holdIds.has(id) && !assessment.rationale.includes(id))
      problems.push(`${label}: hold ${id} is gone from the assessment`);
  return problems;
}

function findEvidenceProblems({
  candidate,
  assessment,
  data,
}: {
  candidate: AssessedCandidate;
  assessment: AttributionAssessment;
  data: SharedCatalogData;
}): string[] {
  const label = describeCandidate(candidate);
  const { evidenceId, recorded } = candidate;
  const entry = data.evidence[evidenceId];
  const problems: string[] = [];
  if (
    !hasSameItems({
      actual: Object.keys(assessment.evidenceFingerprints).sort(),
      expected:
        recorded.kind === 'snapshot'
          ? Object.keys(recorded.evidenceFingerprints).sort()
          : [evidenceId],
    })
  )
    problems.push(`${label}: assessment no longer cites ${evidenceId}`);
  const evidenceIds =
    recorded.kind === 'snapshot'
      ? Object.keys(recorded.evidenceFingerprints)
      : [evidenceId];
  for (const id of evidenceIds) {
    const payload = data.evidence[id];
    if (!payload) {
      problems.push(`${label}: evidence ${id} is missing`);
      continue;
    }
    const fingerprint = computeFingerprint(payload);
    const isRecorded =
      recorded.kind === 'snapshot'
        ? fingerprint === recorded.evidenceFingerprints[id]
        : hashText(JSON.stringify(payload)) === recorded.evidenceSha256;
    if (!isRecorded || fingerprint !== assessment.evidenceFingerprints[id])
      problems.push(`${label}: evidence ${id} differs from the recorded one`);
  }
  if (entry && !entry.content.includes(candidate.source.sha256))
    problems.push(
      `${label}: evidence ${evidenceId} lost its source fingerprint`,
    );
  return problems;
}

function findHoldProblems({
  inventoryPath,
  inventory,
  data,
}: {
  inventoryPath: string;
  inventory: BatchInventory;
  data: SharedCatalogData;
}): string[] {
  const holds = new Map(data.heldNotices.map((row) => [row.id, row]));
  const expected: InventoryHold[] = [
    ...inventory.candidates.flatMap((candidate) =>
      candidate.kind === 'assessed'
        ? candidate.noticeHoldIds.map((id) => ({
            label: describeCandidate(candidate),
            id,
            notices: [],
          }))
        : [],
    ),
    ...inventory.noticeRequirements.flatMap((requirement) =>
      requirement.holdId
        ? [
            {
              label: requirement.book,
              id: requirement.holdId,
              notices: [requirement.book, ...requirement.registryKeys],
            },
          ]
        : [],
    ),
  ];
  return expected.flatMap(({ label, id, notices }) => {
    const hold = holds.get(id);
    if (!hold) return [`${label}: hold ${id} is missing`];
    return [
      ...(hold.evidence.includes(inventoryPath)
        ? []
        : [`${label}: hold ${id} no longer cites ${inventoryPath}`]),
      ...notices
        .filter((notice) => !hold.notices.includes(notice))
        .map((notice) => `${label}: hold ${id} no longer holds ${notice}`),
    ];
  });
}

function normaliseSnapshot({
  snapshot,
  evidenceId,
}: {
  snapshot: RecordedBindingSnapshot;
  evidenceId: string;
}) {
  const evidenceFingerprints =
    'evidenceFingerprints' in snapshot
      ? snapshot.evidenceFingerprints
      : { [evidenceId]: snapshot.evidenceFingerprint };
  return {
    contentFingerprint: snapshot.contentFingerprint,
    mappingFingerprint: snapshot.mappingFingerprint,
    evidenceFingerprints,
    noticeCodes: Object.keys(snapshot.noticeFingerprints).sort(),
  };
}

/**
 * A recorded binding snapshot against the binding computed from current data.
 * Content, mapping and evidence fingerprints must match the snapshot; notice
 * fingerprints follow the current Registry, so only their codes must match.
 */
export function findRecordedBindingProblems({
  recorded,
  current,
  evidenceId,
}: {
  recorded: RecordedBindingSnapshot;
  current: AssessmentBinding;
  evidenceId: string;
}): string[] {
  const snapshot = normaliseSnapshot({ snapshot: recorded, evidenceId });
  const problems: string[] = [];
  if (
    snapshot.contentFingerprint !== current.contentFingerprint ||
    snapshot.mappingFingerprint !== current.mappingFingerprint ||
    computeFingerprint(snapshot.evidenceFingerprints) !==
      computeFingerprint(current.evidenceFingerprints)
  )
    problems.push('content, mapping or evidence binding differs');
  if (
    !hasSameItems({
      actual: Object.keys(current.noticeFingerprints).sort(),
      expected: snapshot.noticeCodes,
    })
  )
    problems.push('notice codes differ');
  return problems;
}

/**
 * A recorded binding snapshot with its notice fingerprints bound to the
 * current Registry, for comparing with a live assessment.
 */
export function bindSnapshotToCurrentNotices<
  T extends Pick<AssessmentBinding, 'noticeFingerprints'>,
>(snapshot: T): T {
  return {
    ...snapshot,
    noticeFingerprints: bindNoticeFingerprints({
      requiredNotices: Object.keys(snapshot.noticeFingerprints),
    }),
  };
}

/**
 * A Registry notice a batch's review cited. The review's text hash is
 * historical evidence: the cited key must still be in the Registry, and a
 * hash-keyed notice's key must still name the text the review hashed. The
 * notice's current text and review state are checked through the batch's
 * current assessment bindings and the admission gate, so a reviewed in-place
 * correction passes once those are re-bound.
 */
export function findCitedNoticeProblems({
  key,
  textSha256,
  registry = reviewedAdmission.registry,
}: {
  key: string;
  textSha256: string;
  registry?: Registry;
}): string[] {
  const keyHash = /^pf1-content\/notice\/([a-f0-9]{64})$/.exec(key)?.[1];
  return [
    ...(keyHash !== undefined && keyHash !== textSha256
      ? [`${key}: recorded text hash ${textSha256} is not its key`]
      : []),
    ...(Object.hasOwn(registry, key)
      ? []
      : [`${key}: no longer in the Registry`]),
  ];
}
