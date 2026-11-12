import { boundReleaseRegistryRows } from '../../src/lib/catalog/release-registry.ts';
import { z } from 'zod';
import type { importCatalog } from './import.ts';
import {
  assessCatalogAdmission,
  computeFingerprint,
  entryCurationGaps,
  type AttributionPath,
} from './admission.ts';
import {
  retainedExceptionSchema,
  retainedUseSchema,
  type reviewedAdmissionSchema,
} from '../../src/lib/catalog/admission-schema.ts';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data.ts';
import {
  labelDefinitions,
  type ReleaseVerification,
} from './release-verification.ts';
import {
  legalResourcesSchema,
  type LegalResources,
} from '../../src/lib/catalog/legal-types.ts';

import {
  MAX_RELEASE_BATCH_ROWS,
  MAX_RELEASE_BATCH_BYTES,
  canonicalReleaseJson,
  parseReleaseJson,
  releaseByteCount,
  releaseFingerprint,
  validateCatalogReleaseArtifact,
  releaseInputCategories,
  type CatalogReleaseArtifact,
  type CatalogReleaseManifest,
  type ReleaseRow,
  type ReleaseInputCategory,
  isObject,
} from '../../src/lib/catalog/release-schema.ts';

export async function buildCatalogRelease({
  releaseNumber,
  compatibility,
  inputs,
  rows,
  baseRelease = null,
}: {
  releaseNumber: number;
  baseRelease?: CatalogReleaseManifest['baseRelease'];
  compatibility: CatalogReleaseManifest['compatibility'];
  inputs: Record<ReleaseInputCategory, unknown>;
  rows: ReleaseRow[];
}): Promise<CatalogReleaseArtifact> {
  const inputHashes = Object.fromEntries(
    await Promise.all(
      releaseInputCategories.map(async (category) => {
        if (!(category in inputs))
          throw new Error(`Missing release input: ${category}.`);
        return [category, await releaseFingerprint(inputs[category])] as const;
      }),
    ),
  );
  const ordered = (await boundReleaseRegistryRows(rows)).sort((a, b) =>
    `${a.kind}:${a.key}` < `${b.kind}:${b.key}`
      ? -1
      : `${a.kind}:${a.key}` > `${b.kind}:${b.key}`
        ? 1
        : 0,
  );
  const batches: ReleaseRow[][] = [];
  let batch: ReleaseRow[] = [];
  // A batch serializes as `[row,row,…]`, so its byte count grows by each row's
  // own count plus one comma; re-encoding the whole batch per row was quadratic.
  const emptyBatchBytes = releaseByteCount([]);
  let batchBytes = emptyBatchBytes;
  for (const row of ordered) {
    const rowBytes = releaseByteCount(row);
    if (
      batch.length &&
      (batch.length === MAX_RELEASE_BATCH_ROWS ||
        batchBytes + 1 + rowBytes > MAX_RELEASE_BATCH_BYTES)
    ) {
      batches.push(batch);
      batch = [];
      batchBytes = emptyBatchBytes;
    }
    batchBytes += (batch.length ? 1 : 0) + rowBytes;
    batch.push(row);
    if (batchBytes > MAX_RELEASE_BATCH_BYTES)
      throw new Error(`Release row ${row.key} exceeds byte limit.`);
  }
  if (batch.length) batches.push(batch);
  const descriptors = await Promise.all(
    batches.map(async (rows) => ({
      fingerprint: await releaseFingerprint(rows),
      rowCount: rows.length,
      byteCount: releaseByteCount(rows),
    })),
  );
  const body = {
    formatVersion: 1,
    releaseNumber,
    baseRelease,
    compatibility,
    inputs: inputHashes,
    inputFingerprint: await releaseFingerprint({
      inputs: inputHashes,
      compatibility,
      baseRelease,
    }),
    outputFingerprint: await releaseFingerprint(descriptors),
    batches: descriptors,
  };
  return validateCatalogReleaseArtifact({
    manifest: { ...body, artifactFingerprint: await releaseFingerprint(body) },
    batches,
  });
}

export function serializeCatalogRelease(
  artifact: CatalogReleaseArtifact,
): string {
  return canonicalReleaseJson(artifact) + '\n';
}

type ImportArtifact = Awaited<ReturnType<typeof importCatalog>>;
type ReviewedAdmission = ReturnType<typeof reviewedAdmissionSchema.parse>;

function jsonPayload(value: unknown): ReleaseRow['payload'] {
  const parsed: unknown = JSON.parse(canonicalReleaseJson(value));
  return parseReleaseJson(parsed);
}
type CreateCatalogReleaseOptions = {
  artifact: ImportArtifact;
  attribution: Omit<ReviewedAdmission, 'retainedUses' | 'retainedExceptions'> &
    Partial<Pick<ReviewedAdmission, 'retainedUses' | 'retainedExceptions'>>;
  legalResources: LegalResources;
  previous?: CatalogReleaseArtifact;
  releaseNumber: number;
  compatibility: CatalogReleaseManifest['compatibility'];
  inputValues: Record<
    | 'remaps'
    | 'curation'
    | 'localData'
    | 'parsers'
    | 'sanitizers'
    | 'ruleResources',
    unknown
  > & { upstreamVerification?: unknown };
  authoredResources?: { key: string; payload: unknown }[];
  /**
   * #770: a versioned release scope as plain data from `release-scope.ts`,
   * which this file never imports (`release-inputs.ts` fingerprints it). The
   * binding joins the `localData` input; the report becomes `content:scope`
   * rows. Unscoped releases are unchanged.
   */
  scope?: { binding: unknown; summary: unknown; chunks: unknown[] };
  /**
   * The gate's attribution path (`assessCatalogAdmission`): the #227 rule by
   * default; a legal batch's tests release on the assessment path alone.
   */
  attributionPath?: AttributionPath;
  /**
   * #227 slice 4: what each definition's label is read from, the committed
   * verification projection as `readCommittedReleaseVerification` reads it.
   * Without one every definition is unverified.
   */
  verification?: ReleaseVerification;
};

/**
 * #770: the admission gate a release of these inputs applies, without
 * building it, so a scoped build can account for a refused release too.
 */
export async function assessCatalogReleaseGates({
  artifact,
  attribution,
  previous,
  attributionPath,
}: Pick<
  CreateCatalogReleaseOptions,
  'artifact' | 'attribution' | 'previous' | 'attributionPath'
>) {
  const prior = previous
    ? await validateCatalogReleaseArtifact(previous)
    : undefined;
  return assessReleaseAdmission({
    artifact,
    attribution,
    prior,
    attributionPath,
  }).gate;
}

export async function createCatalogRelease({
  artifact,
  attribution,
  legalResources,
  previous,
  releaseNumber,
  compatibility,
  inputValues,
  authoredResources = [],
  scope,
  attributionPath,
  verification = { kind: 'absent' },
}: CreateCatalogReleaseOptions): Promise<CatalogReleaseArtifact> {
  const prior = previous
    ? await validateCatalogReleaseArtifact(previous)
    : undefined;
  if (prior && releaseNumber <= prior.manifest.releaseNumber)
    throw new Error('Release number must increase beyond the comparison base.');
  const { gate, admission, revokedEvidence, revocations } =
    assessReleaseAdmission({
      artifact,
      attribution,
      prior,
      attributionPath,
    });
  // The gate decides curation: a missing record or unresolved mechanics label
  // the candidate's definition unverified and fail only when they name no
  // candidate. So `artifact.curation.passed` alone doesn't refuse the release.
  if (!gate.passed || !artifact.comparison.coverageComplete)
    throw new Error(
      `Catalog Release gates failed: ${canonicalReleaseJson({ failures: gate.failures, curation: artifact.curation, coverageComplete: artifact.comparison.coverageComplete })}`,
    );
  const priorBodies = new Map(
    collectPreviousBodies(prior).map((row) => [row.key, row]),
  );
  const {
    legalPage,
    priorNotices,
    rows: legalRows,
  } = buildLegalRows({
    attribution: admission,
    legalResources,
    gate,
    prior,
  });
  const { rows, admitted, definitions, resources } = collectCatalogRows({
    artifact,
    gate,
    authoredResources,
    priorBodies,
    verification,
  });
  rows.push(
    ...(await buildContentReports({
      artifact,
      definitions,
      resources,
      authoredResources,
      priorBodies,
      inputVerification: inputValues.upstreamVerification ?? null,
    })),
  );
  if (scope) {
    appendReleaseRow(rows, 'report', 'content:scope', scope.summary);
    for (const [index, chunk] of scope.chunks.entries())
      appendReleaseRow(rows, 'report', `content:scope:${index}`, chunk);
  }
  rows.push(
    ...buildHoldsReport(gate, legalPage, { revokedEvidence, revocations }),
  );
  rows.push(
    ...buildRetirementReport({
      gate,
      attribution: admission,
      admitted,
      authoredResources,
      priorBodies,
      relabel: (retired) =>
        relabelRetainedDefinitions({ artifact, verification, retired }),
    }),
  );
  rows.push(...buildCurationReport(artifact.curation, gate), ...legalRows);
  return buildCatalogRelease({
    releaseNumber,
    compatibility,
    rows,
    baseRelease: prior
      ? {
          releaseNumber: prior.manifest.releaseNumber,
          artifactFingerprint: prior.manifest.artifactFingerprint,
        }
      : null,
    inputs: {
      ...inputValues,
      upstream: {
        content: artifact.catalog.inputs,
        verification: inputValues.upstreamVerification ?? null,
      },
      attribution,
      legal: {
        resources: legalResources,
        priorNotices: priorNotices ?? [],
        requiredNotices: gate.requiredNotices,
      },
      ruleResources: { input: inputValues.ruleResources, authoredResources },
      localData: {
        content: inputValues.localData,
        priorArtifact: prior?.manifest.artifactFingerprint ?? null,
        scope: scope?.binding,
      },
    },
  });
}

type ReleaseAdmission = ReturnType<typeof assessCatalogAdmission>;
type ReleaseAttribution = CreateCatalogReleaseOptions['attribution'];

/**
 * #411: every release, rollback included, rechecks attribution against what
 * earlier releases learned. Evidence once revoked stays revoked (a re-review
 * records new evidence), and a retained exception stays reported while its
 * content is still not admitted, even when the inputs are an older release's.
 * The base's revocation ledger (`readPriorLedger`) holds each key it names
 * whatever the inputs supply; the release carries the next one
 * (`nextRevocationLedger`).
 */
function assessReleaseAdmission({
  artifact,
  attribution,
  prior,
  attributionPath,
}: {
  artifact: ImportArtifact;
  attribution: ReleaseAttribution;
  prior: CatalogReleaseArtifact | undefined;
  attributionPath: AttributionPath | undefined;
}) {
  const priorRows = prior?.batches.flat() ?? [];
  const { admission, revokedEvidence } = withRevokedEvidence(
    attribution,
    priorRows,
  );
  const priorRevocations = readPriorLedger(priorRows, revokedEvidence);
  const assess = (input: typeof admission) =>
    assessCatalogAdmission({
      artifact,
      ...input,
      priorRevocations,
      attributionPath,
    });
  const firstGate = assess(admission);
  const carried = carriedRetainedExceptions(attribution, priorRows, firstGate);
  const carriedAdmission = carried.length
    ? {
        ...admission,
        retainedUses: [
          ...(attribution.retainedUses ?? []),
          ...carried.map(({ use }) => use),
        ],
        retainedExceptions: [
          ...(attribution.retainedExceptions ?? []),
          ...carried.map(({ exception }) => exception),
        ],
      }
    : admission;
  const gate = carried.length ? assess(carriedAdmission) : firstGate;
  return {
    gate,
    admission: carriedAdmission,
    revokedEvidence,
    revocations: nextRevocationLedger({
      artifact,
      assessments: admission.assessments,
      gate,
      prior: priorRevocations,
      revokedEvidence,
    }),
  };
}

type RevocationLedger = ReadonlyMap<string, readonly string[]>;

/**
 * #411: the release's revocation ledger, each key with the revoked evidence
 * that holds it. It takes the base's whole and adds every key whose
 * assessment names revoked evidence, whether or not the key is a candidate
 * and whatever its row (held, retained, omitted, failed or absent). It drops
 * a key only on a checked admission: the gate admitted it on a confirmed
 * assessment, its own or its attribution owner's, that names only evidence
 * not revoked. A key in the base's ledger can't be admitted another way, as
 * every fallback holds it (`priorRevocations`), so that admission was a
 * current re-review (#241).
 */
function nextRevocationLedger({
  artifact,
  assessments,
  gate,
  prior,
  revokedEvidence,
}: {
  artifact: ImportArtifact;
  assessments: ReleaseAttribution['assessments'];
  gate: ReleaseAdmission;
  prior: RevocationLedger;
  revokedEvidence: string[];
}): RevocationLedger {
  const revoked = new Set(revokedEvidence);
  const ledger = new Map(
    [...prior].map(([key, ids]) => [key, new Set(ids)] as const),
  );
  for (const assessment of assessments) {
    const ids = Object.keys(assessment.evidenceFingerprints).filter((id) =>
      revoked.has(id),
    );
    if (!ids.length) continue;
    ledger.set(
      assessment.externalKey,
      new Set([...(ledger.get(assessment.externalKey) ?? []), ...ids]),
    );
  }
  const assessmentsByKey = new Map(
    assessments.map((assessment) => [assessment.externalKey, assessment]),
  );
  const ownerOf = new Map(
    artifact.catalog.entries.map((entry) => [
      entry.externalKey,
      entry.attributionFrom,
    ]),
  );
  for (const { externalKey } of gate.admitted)
    if (
      isCheckedReview(
        assessmentsByKey.get(ownerOf.get(externalKey) ?? externalKey),
        revoked,
      )
    )
      ledger.delete(externalKey);
  return new Map(
    [...ledger]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, ids]) => [key, [...ids].sort()]),
  );
}

/** A confirmed assessment naming evidence, none of it revoked. */
function isCheckedReview(
  assessment: ReleaseAttribution['assessments'][number] | undefined,
  revoked: ReadonlySet<string>,
) {
  const evidenceIds = Object.keys(assessment?.evidenceFingerprints ?? {});
  return (
    assessment?.status === 'confirmed' &&
    evidenceIds.length > 0 &&
    evidenceIds.every((id) => !revoked.has(id))
  );
}

/** The attribution with every evidence record any release revoked marked revoked. */
function withRevokedEvidence(
  attribution: ReleaseAttribution,
  priorRows: ReleaseRow[],
) {
  const revoked = new Set([
    ...readPriorRevokedEvidence(priorRows),
    ...Object.entries(attribution.evidence).flatMap(([id, item]) =>
      item.revoked ? [id] : [],
    ),
  ]);
  const evidence = Object.fromEntries(
    Object.entries(attribution.evidence).map(([id, item]) => [
      id,
      revoked.has(id) ? { ...item, revoked: true } : item,
    ]),
  );
  return {
    admission: { ...attribution, evidence },
    revokedEvidence: [...revoked].sort(),
  };
}

/** The base's retained exceptions the inputs don't redeclare and the gate didn't admit. */
function carriedRetainedExceptions(
  attribution: ReleaseAttribution,
  priorRows: ReleaseRow[],
  gate: ReleaseAdmission,
) {
  const admitted = new Set(gate.admitted.map((row) => row.externalKey));
  const declared = new Set(
    (attribution.retainedUses ?? []).map((use) => use.useId),
  );
  return readPriorRetainedExceptions(priorRows).filter(
    ({ use }) => !declared.has(use.useId) && !admitted.has(use.externalKey),
  );
}

// Releases before #411 carry no list.
const revokedEvidenceSchema = z.object({
  revokedEvidence: z.array(z.string()).default([]),
});

function readPriorRevokedEvidence(rows: ReleaseRow[]) {
  const holds = rows.find(
    (row) => row.kind === 'report' && row.key === 'holds',
  )?.payload;
  return revokedEvidenceSchema.parse(holds ?? {}).revokedEvidence;
}

// Releases before the ledger carry none: `readPriorLedger` seeds it once.
const revocationLedgerSchema = z.object({
  revocations: z
    .array(
      z.object({
        externalKey: z.string().min(1),
        evidence: z.array(z.string().min(1)).nonempty(),
      }),
    )
    .optional(),
});

/**
 * #411: the base release's revocation ledger (its `holds` report's
 * `revocations`). A base from before the ledger seeds it once from its
 * `holds:<key>` rows: each held row's revoked evidence, retained exceptions
 * aside.
 */
function readPriorLedger(
  rows: ReleaseRow[],
  revokedEvidence: string[],
): RevocationLedger {
  const holds = rows.find(
    (row) => row.kind === 'report' && row.key === 'holds',
  )?.payload;
  const { revocations } = revocationLedgerSchema.parse(holds ?? {});
  if (revocations)
    return new Map(
      revocations.map(({ externalKey, evidence }) => [externalKey, evidence]),
    );
  return seedLedgerFromHeldRows(rows, revokedEvidence);
}

const heldRowEvidenceSchema = z.object({
  externalKey: z.string(),
  evidence: z.array(z.string()).default([]),
});

function seedLedgerFromHeldRows(rows: ReleaseRow[], revokedEvidence: string[]) {
  const revoked = new Set(revokedEvidence);
  const revocations = new Map<string, string[]>();
  for (const row of rows) {
    if (
      row.kind !== 'report' ||
      !row.key.startsWith('holds:') ||
      row.key.startsWith('holds:retained:')
    )
      continue;
    const { externalKey, evidence } = heldRowEvidenceSchema.parse(row.payload);
    const ids = evidence.filter((id) => revoked.has(id));
    if (ids.length) revocations.set(externalKey, ids);
  }
  return revocations;
}

const retainedUseListSchema = retainedUseSchema.array();

function readPriorRetainedExceptions(rows: ReleaseRow[]) {
  const retirement = rows.find(
    (row) => row.kind === 'report' && row.key === 'retirement',
  )?.payload;
  const uses = retainedUseListSchema.parse(
    isObject(retirement) ? (retirement.retainedUses ?? []) : [],
  );
  return uses.flatMap((use) => {
    const reported = rows.find(
      (row) =>
        row.kind === 'report' && row.key === `holds:retained:${use.useId}`,
    )?.payload;
    const exception = retainedExceptionSchema.safeParse(reported);
    return exception.success ? [{ use, exception: exception.data }] : [];
  });
}
type PreviousBodies = Map<string, ReleaseRow>;
type AuthoredResources = NonNullable<
  CreateCatalogReleaseOptions['authoredResources']
>;

function appendReleaseRow(
  rows: ReleaseRow[],
  kind: ReleaseRow['kind'],
  key: string,
  payload: unknown,
) {
  rows.push({ kind, key, payload: jsonPayload(payload) });
}

/**
 * A released definition's fingerprint as retained uses bind it: its body
 * without its label (#227 slice 4), so it equals the imported entry's
 * (`computeFingerprint`, which the gate compares) and a relabelled body is
 * still the same retained definition.
 */
function definitionFingerprint(payload: ReleaseRow['payload']) {
  if (!isObject(payload)) return computeFingerprint(payload);
  const { verification: _label, ...body } = payload;
  return computeFingerprint(body);
}

/**
 * Each retained definition's last usable body with the label this release
 * gives it (#227 slice 4). A label is recomputed for every definition of the
 * release being built, retained or admitted, from the verification current at
 * this build, so a stale or absent projection never leaves a previous
 * `verified` standing. The body stays the one retained: only its label
 * changes, and `definitionFingerprint` ignores the label, so a relabelled
 * body is still the same retained definition. The projection hashes the
 * imported entry, so a body equal to this import's entry is labelled as that
 * entry; any other body is labelled as itself, and so never matches the
 * entry the projection verified.
 */
function relabelRetainedDefinitions({
  artifact,
  verification,
  retired,
}: {
  artifact: ImportArtifact;
  verification: ReleaseVerification;
  retired: readonly ReleaseRow[];
}) {
  const entries = artifact.catalog.entries;
  const imported = new Map(entries.map((entry) => [entry.externalKey, entry]));
  const bodies = new Map<string, Record<string, unknown>>();
  const subjects: { externalKey: string }[] = [];
  for (const row of retired) {
    if (row.kind !== 'definition' || !isObject(row.payload)) continue;
    const { verification: _label, ...body } = row.payload;
    const entry = imported.get(row.key);
    bodies.set(row.key, body);
    subjects.push(
      entry && computeFingerprint(entry) === computeFingerprint(body)
        ? entry
        : { ...body, externalKey: row.key },
    );
  }
  const labels = labelDefinitions({
    entries: subjects,
    remaps: artifact.catalog.remaps.filter(({ applied }) => applied),
    verification,
    curationGaps: entryCurationGaps(artifact, entries),
  });
  return new Map(
    [...bodies].map(([key, body]) => [
      key,
      { ...body, verification: labels.get(key) },
    ]),
  );
}

function describeChange(previous: unknown, current: unknown) {
  if (previous === undefined) return 'added';
  return computeFingerprint(previous) === computeFingerprint(current)
    ? 'unchanged'
    : 'changed';
}

function collectCatalogRows({
  artifact,
  gate,
  authoredResources,
  priorBodies,
  verification,
}: {
  artifact: ImportArtifact;
  gate: ReleaseAdmission;
  authoredResources: AuthoredResources;
  priorBodies: PreviousBodies;
  verification: ReleaseVerification;
}) {
  const rows: ReleaseRow[] = [];
  const admitted = new Set(gate.admitted.map((row) => row.externalKey));
  const imported = artifact.catalog.entries.filter((entry) =>
    admitted.has(entry.externalKey),
  );
  const labels = labelDefinitions({
    entries: imported,
    remaps: artifact.catalog.remaps.filter(({ applied }) => applied),
    verification,
    curationGaps: new Map(
      gate.admitted.map((row) => [row.externalKey, row.unverified ?? []]),
    ),
  });
  // #227 slice 4: each definition carries its label.
  const definitions = imported.map((entry) => ({
    ...entry,
    verification: labels.get(entry.externalKey),
  }));
  const resources = artifact.catalog.resources.filter((entry) =>
    admitted.has(entry.externalKey),
  );
  for (const entry of definitions)
    appendReleaseRow(rows, 'definition', entry.externalKey, entry);
  for (const resource of resources)
    appendReleaseRow(rows, 'resource', resource.externalKey, resource);
  for (const resource of authoredResources)
    appendReleaseRow(rows, 'resource', resource.key, resource.payload);
  for (const remap of artifact.catalog.remaps)
    if (remap.applied) appendReleaseRow(rows, 'remap', remap.from, remap);
  for (const current of rows.filter(
    (row) => row.kind === 'definition' || row.kind === 'resource',
  )) {
    const previousBody = priorBodies.get(current.key);
    if (
      previousBody &&
      canonicalReleaseJson(catalogKind(previousBody)) !==
        canonicalReleaseJson(catalogKind(current))
    )
      throw new Error(
        `Catalog identity ${current.key} changed kind; use a new stable identity.`,
      );
  }
  return { rows, admitted, definitions, resources };
}

async function buildContentReports({
  artifact,
  definitions,
  resources,
  authoredResources,
  priorBodies,
  inputVerification,
}: {
  artifact: ImportArtifact;
  definitions: ImportArtifact['catalog']['entries'];
  resources: ImportArtifact['catalog']['resources'];
  authoredResources: AuthoredResources;
  priorBodies: PreviousBodies;
  inputVerification: unknown;
}) {
  const rows: ReleaseRow[] = [];
  for (const [category, candidates] of [
    ['content', definitions],
    ['resources', resources],
  ] as const) {
    appendReleaseRow(rows, 'report', category, {
      gatePassed: true,
      admitted:
        candidates.length +
        (category === 'resources' ? authoredResources.length : 0),
      coverageComplete: true,
      inputVerification,
      comparison: artifact.comparison.summary,
      unsupported: artifact.unsupported.summary,
    });
    for (const entry of candidates) {
      const old = priorBodies.get(entry.externalKey);
      appendReleaseRow(rows, 'report', `${category}:${entry.externalKey}`, {
        externalKey: entry.externalKey,
        state: describeChange(old?.payload, entry),
        fingerprint: await releaseFingerprint(entry),
      });
    }
  }
  for (const resource of authoredResources)
    appendReleaseRow(rows, 'report', `resources:${resource.key}`, {
      externalKey: resource.key,
      state: describeChange(
        priorBodies.get(resource.key)?.payload,
        resource.payload,
      ),
      fingerprint: await releaseFingerprint(resource.payload),
    });
  for (const [index, record] of artifact.comparison.records.entries())
    appendReleaseRow(rows, 'report', `content:inventory:${index}`, record);
  for (const [index, pack] of artifact.comparison.packs.entries())
    appendReleaseRow(rows, 'report', `content:pack:${index}`, pack);
  for (const [index, entry] of artifact.unsupported.entries.entries())
    appendReleaseRow(rows, 'report', `content:unsupported:${index}`, entry);
  return rows;
}

function buildHoldsReport(
  gate: ReleaseAdmission,
  legalPage: ReturnType<typeof buildLegalPageData>,
  {
    revokedEvidence,
    revocations,
  }: { revokedEvidence: string[]; revocations: RevocationLedger },
) {
  const rows: ReleaseRow[] = [];
  appendReleaseRow(rows, 'report', 'holds', {
    gatePassed: true,
    revokedEvidence,
    revocations: [...revocations].map(([externalKey, evidence]) => ({
      externalKey,
      evidence,
    })),
    held: gate.held.length,
    dependentOmissions: gate.dependentOmissions.length,
    retainedExceptions: gate.retainedExceptions.length,
    retainedRequiredNotices: [
      ...new Set(
        gate.retainedExceptions.flatMap(
          (exception) => exception.requiredNotices,
        ),
      ),
    ].sort(),
    failures: gate.failures,
    outstandingNotices: legalPage.outstandingNotices,
  });
  for (const row of [...gate.held, ...gate.dependentOmissions])
    appendReleaseRow(rows, 'report', `holds:${row.externalKey}`, row);
  for (const row of gate.retainedExceptions)
    appendReleaseRow(rows, 'report', `holds:retained:${row.useId}`, row);
  return rows;
}

function buildRetirementReport({
  gate,
  attribution,
  admitted,
  authoredResources,
  priorBodies,
  relabel,
}: {
  gate: ReleaseAdmission;
  attribution: CreateCatalogReleaseOptions['attribution'];
  admitted: Set<string>;
  authoredResources: AuthoredResources;
  priorBodies: PreviousBodies;
  /** Each retained definition's body with this release's label. */
  relabel: (retired: readonly ReleaseRow[]) => Map<string, unknown>;
}) {
  const rows: ReleaseRow[] = [];
  const currentKeys = new Set([
    ...admitted,
    ...authoredResources.map((resource) => resource.key),
  ]);
  const retired = [...priorBodies.values()].filter(
    (row) => !currentKeys.has(row.key),
  );
  const relabelled = relabel(retired);
  appendReleaseRow(rows, 'report', 'retirement', {
    gatePassed: true,
    count: retired.length,
    retainedUses: attribution.retainedUses ?? [],
  });
  for (const row of retired)
    appendReleaseRow(rows, 'report', `retirement:${row.key}`, {
      externalKey: row.key,
      kind: row.kind,
      state: gate.held.some((held) => held.externalKey === row.key)
        ? 'held'
        : 'retired',
      lastUsableDefinition: relabelled.get(row.key) ?? row.payload,
      definitionFingerprint: definitionFingerprint(row.payload),
    });
  for (const use of attribution.retainedUses ?? []) {
    const body = priorBodies.get(use.externalKey);
    if (
      !body ||
      definitionFingerprint(body.payload) !== use.definitionFingerprint
    )
      throw new Error(
        `Missing last usable retained definition: ${use.externalKey}.`,
      );
  }
  return rows;
}

/**
 * The release's curation report. `passed` is the release's curation gate,
 * which the admission gate decides: a missing record or unresolved mechanics
 * label the candidate's definition unverified (listed under
 * `curation:missing` and `curation:unresolvedMechanics`), and one that names
 * no candidate fails the gate. The import's own `passed` is false while any
 * record is missing or unresolved.
 */
function buildCurationReport(
  curation: ImportArtifact['curation'],
  gate: ReleaseAdmission,
) {
  const rows: ReleaseRow[] = [];
  const { summary, passed: _importPassed, ...curationRows } = curation;
  const { passed } = gate;
  appendReleaseRow(rows, 'report', 'curation', {
    gatePassed: passed,
    summary,
    passed,
  });
  for (const [category, records] of Object.entries(curationRows))
    for (const [index, record] of records.entries())
      appendReleaseRow(rows, 'report', `curation:${category}:${index}`, record);
  return rows;
}

function buildLegalRows({
  attribution,
  legalResources,
  gate,
  prior,
}: {
  attribution: CreateCatalogReleaseOptions['attribution'];
  legalResources: LegalResources;
  gate: ReleaseAdmission;
  prior: CatalogReleaseArtifact | undefined;
}) {
  const priorNotices = prior?.batches
    .flat()
    .find(
      (row) => row.kind === 'legal' && row.key === 'permanentNoticeSuperset',
    )?.payload;
  const legalPage = buildLegalPageData({
    registry: attribution.registry,
    resources: legalResources,
    requiredNotices: gate.requiredNotices,
    permanentNoticeSuperset: priorNotices
      ? [
          ...parsePriorNotices(priorNotices),
          ...legalResources.permanentNoticeSuperset,
        ]
      : legalResources.permanentNoticeSuperset,
  });
  if (
    legalPage.outstandingNotices.some(
      (notice) =>
        !gate.retainedExceptions.some((exception) =>
          exception.requiredNotices.includes(notice.code),
        ),
    ) ||
    legalPage.outstandingResources.length
  )
    throw new Error('Catalog Release legal gate failed.');
  const rows: ReleaseRow[] = [];
  appendReleaseRow(rows, 'legal', 'requiredNotices', gate.requiredNotices);
  appendReleaseRow(
    rows,
    'legal',
    'permanentNoticeSuperset',
    legalPage.permanentNoticeSuperset,
  );
  appendReleaseRow(rows, 'legal', 'registry', attribution.registry);
  appendReleaseRow(rows, 'legal', 'resources', legalResources);
  return { rows, legalPage, priorNotices };
}

function parsePriorNotices(value: ReleaseRow['payload']) {
  return legalResourcesSchema.shape.permanentNoticeSuperset.parse(value);
}

function collectPreviousBodies(
  prior: CatalogReleaseArtifact | undefined,
): ReleaseRow[] {
  const bodies = new Map<string, ReleaseRow>();
  for (const row of prior?.batches.flat() ?? []) {
    if (row.kind === 'definition' || row.kind === 'resource')
      bodies.set(row.key, row);
    if (row.kind !== 'report' || !row.key.startsWith('retirement:')) continue;
    const payload = row.payload;
    if (
      !isObject(payload) ||
      typeof payload.externalKey !== 'string' ||
      !('lastUsableDefinition' in payload)
    )
      continue;
    if (!bodies.has(payload.externalKey))
      bodies.set(payload.externalKey, {
        kind: payload.kind === 'resource' ? 'resource' : 'definition',
        key: payload.externalKey,
        payload: parseReleaseJson(payload.lastUsableDefinition),
      });
  }
  return [...bodies.values()];
}

function catalogKind(row: ReleaseRow) {
  const payload = row.payload;
  if (!isObject(payload))
    return { category: row.kind, kind: null, detailKind: null };
  const detail = payload.detail;
  return {
    category: row.kind,
    kind: typeof payload.kind === 'string' ? payload.kind : null,
    detailKind:
      isObject(detail) && typeof detail.kind === 'string' ? detail.kind : null,
  };
}
