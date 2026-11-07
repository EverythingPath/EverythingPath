import { createHash } from 'node:crypto';
import { resolveAssessmentRationale } from '../../src/lib/catalog/diagnostic-conclusions';
import type { importCatalog } from './import.ts';
import type { PreviewEntry } from './map.ts';
import {
  type AttributionAssessment,
  type AttributionEvidence,
  type RetainedUse,
  type RetainedException,
  type Section15Registry,
} from '../../src/lib/catalog/admission-schema.ts';
import {
  createNoticeIndex,
  resolveNotice,
} from '../../src/lib/catalog/resolve-notice.ts';
import heldNotices from './legal/held-notices.json';
import {
  committedNoticeClearances,
  heldNoticeInForce,
  knownNoticeHoldReason,
  knownNoticeHoldsInForce,
} from './legal/notice-clearances.ts';
import {
  createSection15Lookup,
  is716Candidate,
  type Section15Confirmation,
  type Section15Lookup,
} from './legal/section15-confirmations.ts';

type ImportedArtifact = Awaited<ReturnType<typeof importCatalog>>;
export type AdmissionArtifact = Omit<
  ImportedArtifact,
  'comparison' | 'catalog'
> & {
  catalog: ImportedArtifact['catalog'] & {
    localResources?: { path: string; sha256: string }[];
  };
  comparison: Omit<ImportedArtifact['comparison'], 'records' | 'packs'> & {
    records: (Omit<
      ImportedArtifact['comparison']['records'][number],
      'repo'
    > & { repo: string })[];
    packs: (Omit<ImportedArtifact['comparison']['packs'][number], 'repo'> & {
      repo: string;
    })[];
  };
};
export type AdmissionSource = {
  catalog: Pick<AdmissionArtifact['catalog'], 'entries'> &
    Partial<
      Pick<
        AdmissionArtifact['catalog'],
        'resources' | 'remaps' | 'localResources'
      >
    >;
  comparison: Pick<AdmissionArtifact['comparison'], 'records' | 'packs'>;
  curation?: Pick<
    AdmissionArtifact['curation'],
    'missing' | 'unresolvedMechanics'
  >;
};
export type AdmissionRow = {
  externalKey: string;
  name: string;
  reason: string;
  requiredNotices: string[];
  missingNotices: string[];
  evidence: string[];
};

export function computeFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  return value;
}

type BindingInput = {
  entry: PreviewEntry;
  requiredNotices: string[];
  evidenceIds: string[];
};
type BindingContext = {
  artifact: AdmissionSource;
  evidence: AttributionEvidence;
  registry: Section15Registry;
};

export function buildAssessmentBinding({
  entry,
  requiredNotices,
  evidenceIds,
  ...context
}: BindingInput & BindingContext) {
  return createAssessmentBinder(context)({
    entry,
    requiredNotices,
    evidenceIds,
  });
}

/**
 * `buildAssessmentBinding` for many entries of one unchanged context: the
 * catalog indexes and the Registry's notice fingerprints are built once, and
 * each entry's content and mapping fingerprints once per key, as admission
 * binds every candidate. Bind the context's own entries; after the artifact,
 * evidence or Registry changes, or to bind a changed entry, make a new binder.
 */
export function createAssessmentBinder(context: BindingContext) {
  return createBindingBuilder({ ...context, ...buildCatalogIndexes(context) });
}

function buildCatalogIndexes({
  artifact,
  registry,
}: Pick<BindingContext, 'artifact' | 'registry'>) {
  const entries = [
    ...artifact.catalog.entries,
    ...(artifact.catalog.resources ?? []),
  ];
  const entriesByKey = new Map(
    entries.map((entry) => [entry.externalKey, entry]),
  );
  const dependencies = new Map(
    entries.map((entry) => [entry.externalKey, collectReferences(entry)]),
  );
  const notices = createNoticeIndex({ registry });
  return { entries, entriesByKey, dependencies, notices };
}

function createBindingBuilder({
  artifact,
  evidence,
  entriesByKey,
  dependencies,
  notices,
}: BindingContext & ReturnType<typeof buildCatalogIndexes>) {
  const contentFingerprints = new Map<string, string>();
  const mappingFingerprints = new Map<string, string>();
  const evidenceFingerprints = new Map<string, string>();
  const noticeFingerprints = new Map(
    [...notices].map(([code, notice]) => [
      code,
      computeFingerprint(notice ?? null),
    ]),
  );
  const missingFingerprint = computeFingerprint(null);
  return ({ entry, requiredNotices, evidenceIds }: BindingInput) => {
    let contentFingerprint = contentFingerprints.get(entry.externalKey);
    if (contentFingerprint === undefined) {
      contentFingerprint = computeFingerprint(
        collectContentClosure({ entry, entriesByKey, dependencies }),
      );
      contentFingerprints.set(entry.externalKey, contentFingerprint);
    }
    let mappingFingerprint = mappingFingerprints.get(entry.externalKey);
    if (mappingFingerprint === undefined) {
      mappingFingerprint = computeFingerprint({
        upstreamKey: entry.upstreamKey,
        externalKey: entry.externalKey,
        remaps: artifact.catalog.remaps ?? [],
      });
      mappingFingerprints.set(entry.externalKey, mappingFingerprint);
    }
    return {
      contentFingerprint,
      mappingFingerprint,
      evidenceFingerprints: Object.fromEntries(
        evidenceIds.map((id) => [id, evidenceFingerprint(id)]),
      ),
      noticeFingerprints: Object.fromEntries(
        requiredNotices.map((code) => [
          code,
          noticeFingerprints.get(code) ?? missingFingerprint,
        ]),
      ),
    };
  };
  function evidenceFingerprint(id: string) {
    let fingerprint = evidenceFingerprints.get(id);
    if (fingerprint === undefined) {
      // Match Object.entries' own enumerable keys without reading other evidence.
      fingerprint = computeFingerprint(
        Object.prototype.propertyIsEnumerable.call(evidence, id)
          ? (evidence[id] ?? null)
          : null,
      );
      evidenceFingerprints.set(id, fingerprint);
    }
    return fingerprint;
  }
}

type AdmissionInput = BindingContext & {
  assessments: AttributionAssessment[];
  retainedUses?: RetainedUse[];
  retainedExceptions?: RetainedException[];
  /**
   * #716 P10a: the Section 15 confirmations (the committed ones by default)
   * and how to read a PCGen file's hash now (the pinned store by default).
   */
  section15?: {
    confirmations?: readonly Section15Confirmation[];
    currentSha256?: (path: string) => string | undefined;
  };
  /**
   * The `held-notices.json` holds that no longer hold: the owner's committed
   * clearance (`legal/notice-clearances.json`) by default.
   */
  clearedHoldIds?: Iterable<string>;
  /**
   * The importer's source groups (`legal/known-notice-holds.json`) that no
   * longer hold: the committed clearance by default.
   */
  clearedImporterHolds?: Iterable<string>;
};
/** A candidate as notice eligibility sees it (plan §7 "Candidate eligibility"). */
type NoticeCandidate = { externalKey: string; upstreamKey?: string };
/**
 * How a candidate's required notices are read. For a #716 candidate, a #716
 * book's code becomes the notices its records require (`requirementsOf`), and
 * each of those is held by every hold on the book, minus the book's waivers.
 * Every other candidate reads the code of a book whose PCGen block it may use
 * (#716 decision 5, extended to every candidate by the owner on 2026-10-30)
 * the same way, without waivers, and keeps its other codes; its assessment
 * stays bound to its own codes (`boundNotices`).
 */
function createNoticeRequirements({
  section15,
  noticeHoldsFor,
}: {
  section15: Section15Lookup;
  noticeHoldsFor: (code: string) => string[];
}) {
  return (candidate: NoticeCandidate, codes: Iterable<string>) => {
    const unique = [...new Set(codes)].sort();
    const isFrom716 = is716Candidate(candidate);
    const readsAsBook = (code: string) =>
      isFrom716 || section15.isEligible(code);
    const bookOf = new Map<string, Set<string>>();
    for (const code of unique)
      for (const requirement of readsAsBook(code)
        ? section15.requirementsOf(code)
        : [code])
        bookOf.set(
          requirement,
          new Set([...(bookOf.get(requirement) ?? []), code]),
        );
    const requiredNotices = [...bookOf.keys()].sort();
    return {
      requiredNotices,
      boundNotices: isFrom716 ? requiredNotices : unique,
      holdsFor: (requirement: string) => {
        const holds = new Set(noticeHoldsFor(requirement));
        const waived = new Set<string>();
        for (const book of bookOf.get(requirement) ?? []) {
          if (!readsAsBook(book) || !section15.confirmationOf(book)) continue;
          for (const key of section15.holdKeysOf(book))
            for (const id of noticeHoldsFor(key)) holds.add(id);
          if (isFrom716)
            for (const id of section15.waivedHoldIdsOf(book)) waived.add(id);
        }
        return [...holds].filter((id) => !waived.has(id)).sort();
      },
    };
  };
}
type AdmissionFailure = { externalKey: string; reason: string };
type Classification =
  | { kind: 'admitted' | 'held'; row: AdmissionRow }
  | { kind: 'retained'; externalKey: string }
  | { kind: 'failed'; failure: AdmissionFailure };

export function assessCatalogAdmission({
  artifact,
  assessments,
  registry,
  evidence,
  retainedUses = [],
  retainedExceptions: declaredExceptions = [],
  section15: section15Input = {},
  clearedHoldIds = committedNoticeClearances.cleared.heldNotices,
  clearedImporterHolds = committedNoticeClearances.cleared.knownNoticeHolds,
}: AdmissionInput) {
  const indexes = buildCatalogIndexes({ artifact, registry });
  const { entries, entriesByKey, dependencies, notices } = indexes;
  const assessmentsByKey = new Map<string, AttributionAssessment>();
  const duplicateAssessments: AttributionAssessment[] = [];
  for (const assessment of assessments) {
    if (assessmentsByKey.has(assessment.externalKey))
      duplicateAssessments.push(assessment);
    else assessmentsByKey.set(assessment.externalKey, assessment);
  }
  const inventoriedKeys = new Set(
    artifact.comparison.records
      .filter((record) => record.status === 'admitted')
      .map((record) => record.externalKey),
  );
  const noticeHoldsFor = createNoticeHoldLookup({
    registry,
    index: notices,
    inForce: heldNoticeInForce(clearedHoldIds),
  });
  const section15 = createSection15Lookup({ ...section15Input, registry });
  // #716 P10a: a `pcgen:` or supplemental notice counts only for a matched,
  // checked and current book; every other notice keeps today's rule.
  const hasReviewedNotice = (code: string) => section15.countsAsReviewed(code);
  const noticeRequirements = createNoticeRequirements({
    section15,
    noticeHoldsFor,
  });
  const buildBinding = createBindingBuilder({
    artifact,
    registry,
    evidence,
    ...indexes,
  });
  const exceptionBodies = new Set(
    declaredExceptions.map((exception) =>
      JSON.stringify([
        exception.useId,
        exception.externalKey,
        exception.definitionFingerprint,
      ]),
    ),
  );
  const retainedBodies = new Set(
    retainedUses
      .filter((use) =>
        exceptionBodies.has(
          JSON.stringify([
            use.useId,
            use.externalKey,
            use.definitionFingerprint,
          ]),
        ),
      )
      .map((use) => `${use.externalKey}:${use.definitionFingerprint}`),
  );
  const admitted: AdmissionRow[] = [];
  const held: AdmissionRow[] = [];
  const failures = collectInventoryFailures({
    artifact,
    entries,
    duplicateAssessments,
  });
  const retainedCandidateKeys = new Set<string>();
  const seen = new Set<string>();
  // The importer's mark doesn't name its source group, so it lifts only while
  // every group is cleared; a group still in force keeps every mark holding.
  const importerHoldsCleared =
    knownNoticeHoldsInForce(clearedImporterHolds).length === 0;
  for (const entry of entries) {
    const result = classifyCandidate({
      entry,
      assessmentsByKey,
      dependencies,
      entriesByKey,
      inventoriedKeys,
      retainedBodies,
      seen,
      hasReviewedNotice,
      noticeRequirements,
      buildBinding,
      evidence,
      importerHoldsCleared,
    });
    switch (result.kind) {
      case 'admitted':
        admitted.push(result.row);
        break;
      case 'held':
        held.push(result.row);
        break;
      case 'retained':
        retainedCandidateKeys.add(result.externalKey);
        break;
      case 'failed':
        failures.push(result.failure);
        break;
    }
  }
  for (let index = admitted.length - 1; index >= 0; index--) {
    const row = admitted[index];
    if (!row) continue;
    const missingNotices = row.requiredNotices.filter(
      (code) => !hasReviewedNotice(code),
    );
    if (!missingNotices.length) continue;
    failures.push({
      externalKey: row.externalKey,
      reason: `Admitted candidate is missing reviewed required notices: ${missingNotices.join(', ')}.`,
    });
    admitted.splice(index, 1);
  }
  inheritOwnerFailures({ entries, entriesByKey, admitted, held, failures });
  const dependentOmissions = omitUnavailableDependents({
    admitted,
    held,
    failures,
    retainedCandidateKeys,
    dependencies,
  });
  const { retainedExceptions, failures: retainedFailures } =
    reconcileRetainedUses({
      retainedUses,
      declaredExceptions,
      hasReviewedNotice,
    });
  failures.push(...retainedFailures);
  const requiredNotices = [
    ...new Set(
      [...admitted, ...retainedExceptions].flatMap(
        (row) => row.requiredNotices,
      ),
    ),
  ].sort();
  return {
    passed: failures.length === 0,
    admitted,
    held,
    dependentOmissions,
    retainedExceptions,
    requiredNotices,
    failures,
  };
}

/**
 * A required book code as the gate reads it for a candidate that isn't from
 * #716, apart from any candidate (notice-hold clearance, owner decisions of
 * 2026-10-30): the notices it reads as, whether every one counts as reviewed
 * (`reviewed`), each at least has a Registry record (`unreviewed`) or one has
 * none (`missing`), and the holds still in force on them.
 */
export function createNoticeReadiness({
  registry,
  clearedHoldIds = committedNoticeClearances.cleared.heldNotices,
  section15: section15Input = {},
}: Pick<AdmissionInput, 'registry' | 'clearedHoldIds' | 'section15'>) {
  const index = createNoticeIndex({ registry });
  const section15 = createSection15Lookup({ ...section15Input, registry });
  const noticeRequirements = createNoticeRequirements({
    section15,
    noticeHoldsFor: createNoticeHoldLookup({
      registry,
      index,
      inForce: heldNoticeInForce(clearedHoldIds),
    }),
  });
  return (code: string) => {
    const { requiredNotices, holdsFor } = noticeRequirements(
      { externalKey: `notice/${code}` },
      [code],
    );
    const identity = requiredNotices.every((notice) =>
      section15.countsAsReviewed(notice),
    )
      ? ('reviewed' as const)
      : requiredNotices.every((notice) => index.get(notice))
        ? ('unreviewed' as const)
        : ('missing' as const);
    return {
      notices: requiredNotices,
      identity,
      holds: [...new Set(requiredNotices.flatMap(holdsFor))].sort(),
    };
  };
}

/**
 * The holds in `legal/held-notices.json` that hold a required notice, matched
 * by its code or by any identifier of the Registry notice a held code names.
 * A cleared hold holds nothing; it stays in the file as evidence.
 */
function createNoticeHoldLookup({
  registry,
  index,
  inForce,
}: {
  registry: Section15Registry;
  index: ReturnType<typeof createNoticeIndex>;
  inForce: (id: string) => boolean;
}) {
  const heldBy = new Map<string, Set<string>>();
  const hold = (code: string, id: string) =>
    heldBy.set(code, new Set([...(heldBy.get(code) ?? []), id]));
  for (const { id, notices } of heldNotices) {
    if (!inForce(id)) continue;
    for (const code of notices) {
      hold(code, id);
      const notice = resolveNotice({ registry, code, index });
      if (!notice) continue;
      for (const [identifier, indexed] of index)
        if (indexed === notice) hold(identifier, id);
    }
  }
  return (code: string) => [...(heldBy.get(code) ?? [])].sort();
}

/** The keys an entry's content references: the edges of its content closure. */
export function collectReferences(entry: PreviewEntry): string[] {
  const result = new Set<string>();
  function visit(value: unknown) {
    if (typeof value === 'string') {
      for (const match of value.matchAll(/href="catalog:([^"<>]+)"/g))
        if (match[1]) result.add(match[1]);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (
          (key === 'externalKey' ||
            key === 'spellKey' ||
            key === 'baseItemKey') &&
          typeof item === 'string'
        )
          result.add(item);
        // #719: a race's standard Racial Traits and an alternate's replaced
        // traits are imported references.
        else if (
          (key === 'racialTraits' || key === 'replaces') &&
          Array.isArray(item)
        )
          for (const reference of item)
            if (typeof reference === 'string') result.add(reference);
            else visit(reference);
        else visit(item);
      }
    }
  }
  visit(entry.detail);
  visit(entry.description);
  // A slot restricted to named feats references them.
  // #721: an entry is available only with the entry it takes attribution from.
  if (entry.attributionFrom) result.add(entry.attributionFrom);
  for (const slot of entry.grantsSlots ?? [])
    for (const feat of slot.feats ?? []) result.add(feat);
  return [...result].sort();
}

function collectContentClosure({
  entry,
  entriesByKey,
  dependencies,
}: {
  entry: PreviewEntry;
  entriesByKey: Map<string, PreviewEntry>;
  dependencies: Map<string, string[]>;
}) {
  const closure = new Map<string, PreviewEntry | null>();
  function visit(current: PreviewEntry) {
    if (closure.has(current.externalKey)) return;
    closure.set(current.externalKey, current);
    for (const key of dependencies.get(current.externalKey) ?? []) {
      const linked = entriesByKey.get(key);
      if (linked) visit(linked);
      else closure.set(key, null);
    }
  }
  visit(entry);
  return Object.fromEntries(
    [...closure].sort(([a], [b]) => a.localeCompare(b)),
  );
}

function collectInventoryFailures({
  artifact,
  entries,
  duplicateAssessments,
}: {
  artifact: AdmissionSource;
  entries: PreviewEntry[];
  duplicateAssessments: AttributionAssessment[];
}) {
  const failures: AdmissionFailure[] = [];
  for (const input of artifact.curation?.missing ?? [])
    failures.push({
      externalKey: input.externalKey,
      reason: `Missing curation record: ${input.kind} ${input.target} (${input.textSha256}).`,
    });
  for (const record of artifact.curation?.unresolvedMechanics ?? [])
    failures.push({
      externalKey: record.externalKey,
      reason: `Unresolved curation mechanics: ${record.diagnostics.map((diagnostic) => diagnostic.text).join(' ')}`,
    });
  const upstreamKeys = new Set(entries.map((entry) => entry.upstreamKey));
  for (const record of artifact.comparison.records) {
    if (
      record.status === 'unassigned' ||
      (record.status === 'admitted' && !upstreamKeys.has(record.externalKey))
    )
      failures.push({
        externalKey: record.externalKey,
        reason: 'Unaccounted import inventory record.',
      });
  }
  for (const pack of artifact.comparison.packs)
    if (!pack.present || !pack.declared)
      failures.push({
        externalKey: `${pack.repo}/${pack.pack}`,
        reason: 'Broken inventory: missing or undeclared pack.',
      });
  for (const assessment of duplicateAssessments)
    failures.push({
      externalKey: assessment.externalKey,
      reason: 'Duplicate Attribution Assessment.',
    });
  return failures;
}

function describeAcceptedReviewGap({
  assessment,
  binding,
  evidence,
}: {
  assessment: AttributionAssessment;
  binding: ReturnType<ReturnType<typeof createBindingBuilder>>;
  evidence: AttributionEvidence;
}) {
  const reasons: string[] = [];
  if (assessment.mappingFingerprint !== binding.mappingFingerprint)
    reasons.push(
      'Accepted assessment no longer matches current identity mapping — re-review required.',
    );
  if (assessment.contentFingerprint !== binding.contentFingerprint)
    reasons.push(
      'Accepted assessment no longer matches current content — re-review required.',
    );
  const evidenceIds = Object.keys(assessment.evidenceFingerprints);
  const evidenceProblems = evidenceIds.flatMap((id) => {
    if (!evidence[id]?.content.trim()) return [`${id} (missing)`];
    if (evidence[id]?.revoked === true) return [`${id} (revoked)`];
    if (
      assessment.evidenceFingerprints[id] !== binding.evidenceFingerprints[id]
    )
      return [`${id} (changed)`];
    return [];
  });
  if (!evidenceIds.length)
    reasons.push(
      'Accepted assessment has no attribution evidence — re-review required.',
    );
  else if (evidenceProblems.length)
    reasons.push(
      `Attribution evidence requires re-review: ${evidenceProblems.join(', ')}.`,
    );
  return reasons.join(' ');
}

function classifyCandidate({
  entry,
  assessmentsByKey,
  dependencies,
  entriesByKey,
  inventoriedKeys,
  retainedBodies,
  seen,
  hasReviewedNotice,
  noticeRequirements,
  buildBinding,
  evidence,
  importerHoldsCleared,
}: {
  entry: PreviewEntry;
  assessmentsByKey: Map<string, AttributionAssessment>;
  dependencies: Map<string, string[]>;
  entriesByKey: Map<string, PreviewEntry>;
  inventoriedKeys: Set<string>;
  retainedBodies: Set<string>;
  seen: Set<string>;
  hasReviewedNotice: (code: string) => boolean;
  noticeRequirements: ReturnType<typeof createNoticeRequirements>;
  buildBinding: ReturnType<typeof createBindingBuilder>;
  evidence: AttributionEvidence;
  importerHoldsCleared: boolean;
}): Classification {
  // #721: an entry with `attributionFrom` (a race's reviewed ability score
  // trait) takes that entry's Attribution Assessment, holds, notices and
  // binding, so it is admitted exactly when its race is.
  const owner = entry.attributionFrom
    ? entriesByKey.get(entry.attributionFrom)
    : undefined;
  const assessed = owner ?? entry;
  const assessment = assessmentsByKey.get(assessed.externalKey);
  const fail = (reason: string): Classification => ({
    kind: 'failed',
    failure: { externalKey: entry.externalKey, reason },
  });
  if (seen.has(entry.externalKey)) {
    return fail('Duplicate candidate identity.');
  }
  seen.add(entry.externalKey);
  if (entry.attributionFrom && !isAttributionOwner(entry, owner))
    return fail(
      entry.detail.kind === 'classFeature'
        ? 'Invalid attribution owner: not the reviewed schedule feature this increment is a row of.'
        : 'Invalid attribution owner: not the race that grants this reviewed ability score trait.',
    );
  // S3: a casting ability code outside the importer's table never converts.
  const unknownCasting = entry.unsupported.find(
    ({ field }) => field === 'casting.ability',
  );
  if (unknownCasting)
    return fail(
      `Unknown casting ability code: ${String(unknownCasting.value)}.`,
    );
  const brokenReferences = (dependencies.get(entry.externalKey) ?? []).filter(
    (key) => !entriesByKey.has(key),
  );
  if (
    brokenReferences.length ||
    entry.unsupported.some((item) =>
      ['links.classAssociations', 'description.link', 'spellKey'].includes(
        item.field,
      ),
    )
  ) {
    return fail(
      `Broken structure or reference: ${brokenReferences.join(', ') || 'unresolved imported reference'}.`,
    );
  }
  if (!inventoriedKeys.has(entry.upstreamKey)) {
    return fail('Unaccounted candidate: absent from import inventory.');
  }
  if (
    retainedBodies.size &&
    retainedBodies.has(`${entry.externalKey}:${computeFingerprint(entry)}`)
  ) {
    return { kind: 'retained', externalKey: entry.externalKey };
  }
  const explicitHold = assessed.unsupported.find(
    (item) =>
      item.field === 'attribution' &&
      !(importerHoldsCleared && item.reason === knownNoticeHoldReason),
  );
  if (explicitHold || !assessment) {
    const { requiredNotices } = noticeRequirements(assessed, [
      ...assessed.sources.map((source) => source.book),
      ...(assessment?.requiredNotices ?? []),
    ]);
    return {
      kind: 'held',
      row: {
        externalKey: entry.externalKey,
        name: entry.name,
        reason: explicitHold?.reason ?? 'missing Attribution Assessment',
        requiredNotices,
        missingNotices: requiredNotices.filter(
          (code) => !hasReviewedNotice(code),
        ),
        evidence: assessment
          ? Object.keys(assessment.evidenceFingerprints)
          : [],
      },
    };
  }
  const { requiredNotices, boundNotices, holdsFor } = noticeRequirements(
    assessed,
    [
      ...assessment.requiredNotices,
      ...assessed.sources.map((source) => source.book),
    ],
  );
  const missingNotices = requiredNotices.filter(
    (code) => !hasReviewedNotice(code),
  );
  const row = {
    externalKey: entry.externalKey,
    name: entry.name,
    reason: resolveAssessmentRationale({ assessment, evidence }),
    requiredNotices,
    missingNotices,
    evidence: Object.keys(assessment.evidenceFingerprints),
  };
  const hold = (reason: string): Classification => ({
    kind: 'held',
    row: { ...row, reason },
  });
  if (assessment.status === 'unresolved') {
    return { kind: 'held', row };
  }
  const binding = buildBinding({
    entry: assessed,
    requiredNotices: boundNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  const reviewGap = describeAcceptedReviewGap({
    assessment,
    binding,
    evidence,
  });
  if (reviewGap) return hold(reviewGap);
  if (missingNotices.length) {
    return hold(
      `Missing or unreviewed required notices: ${missingNotices.join(', ')}.`,
    );
  }
  if (!requiredNotices.length) {
    return hold(
      'Missing source notice attribution: no sources or required notices identified — re-review required.',
    );
  }
  const noticeProblems = boundNotices.flatMap((code) => {
    if (!assessment.noticeFingerprints[code]) return [`${code} (missing)`];
    if (
      assessment.noticeFingerprints[code] !== binding.noticeFingerprints[code]
    )
      return [`${code} (changed)`];
    return [];
  });
  if (noticeProblems.length) {
    return hold(
      `Notice bindings require re-review: ${noticeProblems.join(', ')}.`,
    );
  }
  const heldRequirements = requiredNotices.flatMap((code) => {
    const holds = holdsFor(code);
    return holds.length ? [`${code} (${holds.join(', ')})`] : [];
  });
  if (heldRequirements.length) {
    return hold(`Notice holds: ${heldRequirements.join('; ')}.`);
  }
  return { kind: 'admitted', row };
}

/**
 * #721: only a race's own reviewed ability score trait takes the race's
 * Attribution Assessment, and (S3) only a reviewed schedule's increment
 * takes its parent feature's.
 */
function isAttributionOwner(entry: PreviewEntry, owner?: PreviewEntry) {
  if (entry.detail.kind === 'classFeature')
    return (
      owner?.detail.kind === 'classFeature' &&
      entry.pack === 'everythingpath-schedules' &&
      entry.detail.parentFeature === owner.externalKey &&
      entry.upstreamKey === owner.upstreamKey
    );
  return (
    owner?.detail.kind === 'race' &&
    entry.externalKey === `local/race-ability-scores/${owner.externalKey}` &&
    (owner.detail.racialTraits ?? []).includes(entry.externalKey)
  );
}

/**
 * S3: a reviewed schedule's increment takes its parent's failures too, as it
 * takes its assessment, holds and notices: it fails exactly when its parent
 * does, for each of the parent's reasons, and leaves the admitted or held
 * list when the parent did. Its own integrity failures stay.
 */
function inheritOwnerFailures({
  entries,
  entriesByKey,
  admitted,
  held,
  failures,
}: {
  entries: PreviewEntry[];
  entriesByKey: Map<string, PreviewEntry>;
  admitted: AdmissionRow[];
  held: AdmissionRow[];
  failures: AdmissionFailure[];
}) {
  const reasonsOf = new Map<string, string[]>();
  for (const { externalKey, reason } of failures)
    reasonsOf.set(externalKey, [...(reasonsOf.get(externalKey) ?? []), reason]);
  const classified = new Set(
    [...admitted, ...held].map(({ externalKey }) => externalKey),
  );
  const unclassified = new Set<string>();
  for (const entry of entries) {
    if (!entry.attributionFrom || entry.detail.kind !== 'classFeature')
      continue;
    const owner = entriesByKey.get(entry.attributionFrom);
    if (!owner || !isAttributionOwner(entry, owner)) continue;
    const inherited = reasonsOf.get(owner.externalKey) ?? [];
    if (!inherited.length) continue;
    const own = reasonsOf.get(entry.externalKey) ?? [];
    for (const reason of inherited)
      if (!own.includes(reason))
        failures.push({ externalKey: entry.externalKey, reason });
    if (!classified.has(owner.externalKey)) unclassified.add(entry.externalKey);
  }
  for (const rows of [admitted, held])
    for (let index = rows.length - 1; index >= 0; index--)
      if (unclassified.has(rows[index]?.externalKey ?? ''))
        rows.splice(index, 1);
}

function omitUnavailableDependents({
  admitted,
  held,
  failures,
  retainedCandidateKeys,
  dependencies,
}: {
  admitted: AdmissionRow[];
  held: AdmissionRow[];
  failures: AdmissionFailure[];
  retainedCandidateKeys: Set<string>;
  dependencies: Map<string, string[]>;
}) {
  const dependentOmissions: AdmissionRow[] = [];
  const unavailable = new Set([
    ...retainedCandidateKeys,
    ...[...held, ...failures].map((row) => row.externalKey),
  ]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = admitted.length - 1; index >= 0; index--) {
      const row = admitted[index];
      if (!row) continue;
      const unavailableDependencies = (
        dependencies.get(row.externalKey) ?? []
      ).filter((key) => unavailable.has(key));
      if (!unavailableDependencies.length) continue;
      admitted.splice(index, 1);
      dependentOmissions.push({
        ...row,
        reason: `Dependent omission: ${unavailableDependencies.sort().join(', ')}.`,
      });
      unavailable.add(row.externalKey);
      changed = true;
    }
  }
  return dependentOmissions;
}

function reconcileRetainedUses({
  retainedUses,
  declaredExceptions,
  hasReviewedNotice,
}: {
  retainedUses: RetainedUse[];
  declaredExceptions: RetainedException[];
  hasReviewedNotice: (code: string) => boolean;
}) {
  const failures: AdmissionFailure[] = [];
  const retainedExceptions: (AdmissionRow & {
    useId: string;
    characterId: string;
    definitionFingerprint: string;
  })[] = [];
  const exceptionsByUse = new Map<string, RetainedException[]>();
  for (const exception of declaredExceptions) {
    const existing = exceptionsByUse.get(exception.useId) ?? [];
    existing.push(exception);
    exceptionsByUse.set(exception.useId, existing);
  }
  const useIds = new Set(retainedUses.map((use) => use.useId));
  for (const use of retainedUses) {
    const matching = exceptionsByUse.get(use.useId) ?? [];
    const exception = matching[0];
    if (
      matching.length !== 1 ||
      exception?.externalKey !== use.externalKey ||
      exception.definitionFingerprint !== use.definitionFingerprint ||
      use.requiredNotices.some(
        (code) => !exception.requiredNotices.includes(code),
      ) ||
      use.admittedRelease < 1 ||
      !exception.reason.trim()
    ) {
      failures.push({
        externalKey: use.externalKey,
        reason:
          'Unreported, duplicate or invalid retained exception; preserve the last usable definition and its notice obligations.',
      });
      continue;
    }
    retainedExceptions.push({
      externalKey: use.externalKey,
      name: use.name,
      useId: use.useId,
      characterId: use.characterId,
      definitionFingerprint: use.definitionFingerprint,
      reason: exception.reason,
      requiredNotices: exception.requiredNotices,
      missingNotices: exception.requiredNotices.filter(
        (code) => !hasReviewedNotice(code),
      ),
      evidence: [],
    });
  }
  for (const exception of declaredExceptions)
    if (!useIds.has(exception.useId))
      failures.push({
        externalKey: exception.externalKey,
        reason: 'Retained exception has no previously admitted existing use.',
      });
  return { retainedExceptions, failures };
}
