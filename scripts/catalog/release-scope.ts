import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { assessCatalogAdmission } from './admission.ts';
import type { importCatalog } from './import.ts';
import {
  inspectLaunchInventory,
  launchScopeIdentity,
} from './launch-inventory.ts';
import { parseLaunchInventory } from './launch-inventory-document.ts';
import type { LaunchManifest } from './launch-inventory-schema.ts';
import { launchMechanismProofs } from './launch-mechanism-proofs.ts';
import { launchProseCases } from './launch-prose-categories.ts';
import {
  classifyGate,
  repositoryFileSha256,
  resourceReleaseKey,
  scopeBuildResources,
  verifyLaunchRows,
  type GateClass,
} from './launch-verification.ts';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities.ts';
import {
  canonicalReleaseJson,
  isObject,
  releaseByteCount,
  type CatalogReleaseArtifact,
} from '../../src/lib/catalog/release-schema.ts';

/**
 * #770 slice A: a versioned release scope. Only `release-operator.ts` imports
 * this module; `release.ts` receives plain data, so the launch inventory never
 * enters the importer fingerprint (`release-inputs.ts`). The inventory is an
 * input to a release, never an approved release set: the existing admission,
 * curation, coverage and legal gates still decide what a release contains.
 */
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const scopeDocuments = {
  'campaign-mvp-v1': new URL('./scopes/campaign-mvp-v1.json', import.meta.url),
} as const;
type ReleaseScopeVersion = keyof typeof scopeDocuments;

function isReleaseScopeVersion(value: string): value is ReleaseScopeVersion {
  return Object.hasOwn(scopeDocuments, value);
}

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

type ScopeDocument = {
  manifest: unknown;
  documentSha256: string;
  recordsSha256: string | null;
};

async function readScopeDocument(path: string | URL): Promise<ScopeDocument> {
  const text = await readFile(path, 'utf8');
  const manifest: unknown = JSON.parse(text);
  return {
    manifest,
    documentSha256: sha256(text),
    recordsSha256:
      isObject(manifest) && typeof manifest.recordsSha256 === 'string'
        ? manifest.recordsSha256
        : null,
  };
}

const committedIdentities = new Map<string, string>();
// Inspecting even a small manifest takes seconds, so repeated builds in one
// process share a resolved scope. Nothing mutates one.
const resolvedScopes = new Map<string, ReleaseScope>();

function committedIdentity(document: ScopeDocument) {
  const known = committedIdentities.get(document.documentSha256);
  if (known) return known;
  const identity = launchScopeIdentity(document.manifest);
  committedIdentities.set(document.documentSha256, identity);
  return identity;
}

/**
 * Reads a scope's committed manifest, or a supplied copy of it, which is then
 * compared with the committed one: any difference is drift. No scope is ever
 * inferred.
 */
export async function readReleaseScope({
  version,
  manifestPath,
}: {
  version: string;
  manifestPath?: string;
}) {
  if (!isReleaseScopeVersion(version))
    throw new Error(
      `Unknown release scope ${version}; known scopes: ${Object.keys(scopeDocuments).join(', ')}.`,
    );
  const committed = await readScopeDocument(scopeDocuments[version]);
  const supplied =
    manifestPath === undefined
      ? undefined
      : await readScopeDocument(manifestPath);
  const cacheKey = [
    version,
    committed.documentSha256,
    supplied?.documentSha256 ?? '',
  ].join('\0');
  const known = resolvedScopes.get(cacheKey);
  if (known) return known;
  const scope = supplied
    ? resolveReleaseScope({
        version,
        document: supplied,
        committedIdentity: committedIdentity(committed),
      })
    : resolveReleaseScope({ version, document: committed });
  resolvedScopes.set(cacheKey, scope);
  return scope;
}

type ScopeFinding = {
  code: string;
  key: string;
  reason: string;
  path: string[];
};

/** A required row's closure path from a root: the shortest, then the first in key order. */
function shortestPath(witnesses: { keys: string[] }[]) {
  let best: string[] | undefined;
  for (const { keys } of witnesses)
    if (
      !best ||
      keys.length < best.length ||
      (keys.length === best.length && keys.join('\0') < best.join('\0'))
    )
      best = keys;
  return best;
}

const upstreamKey = /^(?:pf1|pf1-content)\/[A-Za-z0-9]+$/;

type ManifestRow = LaunchManifest['rows'][number];
type Inspection = ReturnType<typeof inspectLaunchInventory>;

/**
 * The closure of a scope's roots over non-citation edges (cycles are safe:
 * each key is visited once), the import set and every refusal of the manifest
 * itself. `committedIdentity` is omitted only when `document` is the committed
 * manifest.
 */
export function resolveReleaseScope({
  version,
  document,
  committedIdentity,
}: {
  version: ReleaseScopeVersion;
  document: ScopeDocument;
  committedIdentity?: string;
}) {
  // The manifest schema accepts only this scope version.
  const manifest = parseLaunchInventory(document.manifest);
  const inspection = inspectLaunchInventory(manifest);
  const rows = new Map(manifest.rows.map((row) => [row.key, row]));
  const paths = closurePaths(manifest, inspection);
  const closure = [...paths.keys()].sort();
  return {
    version,
    binding: {
      version,
      launchScopeIdentity: inspection.identity,
      documentSha256: document.documentSha256,
      recordsSha256: document.recordsSha256,
      roots: manifest.roots.map(({ key }) => key).sort(),
      closureFingerprint: sha256(
        canonicalReleaseJson(
          closure.map((key) => [key, rows.get(key)?.requirement ?? null]),
        ),
      ),
    },
    manifest,
    closure,
    paths,
    importKeys: collectImportKeys({ manifest, rows, closure }),
    findings: validateScope({
      version,
      manifest,
      inspection,
      rows,
      paths,
      committedIdentity,
    }),
    blockers: groupLaunchFailures(inspection),
  };
}

export type ReleaseScope = ReturnType<typeof resolveReleaseScope>;

/** Each root and every row it reaches, with its shortest path from a root. */
function closurePaths(manifest: LaunchManifest, inspection: Inspection) {
  const paths = new Map<string, string[]>(
    manifest.roots.map(({ key }) => [key, [key]]),
  );
  for (const [key, witnesses] of Object.entries(inspection.incoming)) {
    const path = shortestPath(witnesses);
    if (path && !paths.has(key)) paths.set(key, path);
  }
  return paths;
}

/** Refusals of the manifest itself: drift, an incomplete inventory and a broken closure. */
function validateScope({
  version,
  manifest,
  inspection,
  rows,
  paths,
  committedIdentity,
}: {
  version: ReleaseScopeVersion;
  manifest: LaunchManifest;
  inspection: Inspection;
  rows: Map<string, ManifestRow>;
  paths: Map<string, string[]>;
  committedIdentity: string | undefined;
}) {
  const findings: ScopeFinding[] = [];
  const refuse = (code: string, key: string, reason: string) =>
    findings.push({ code, key, reason, path: paths.get(key) ?? [] });
  if (
    committedIdentity !== undefined &&
    inspection.identity !== committedIdentity
  )
    refuse(
      'drift',
      version,
      `The supplied manifest's identity ${inspection.identity} differs from the committed ${version} identity ${committedIdentity}.`,
    );
  if (!inspection.genericComplete)
    refuse(
      'inventory-incomplete',
      version,
      `The generic inventory is incomplete: ${inspection.inventoryErrors.length} errors (${[...new Set(inspection.inventoryErrors.map(({ code }) => code))].sort().join(', ')}).`,
    );
  const seen = new Set<string>();
  for (const { key } of manifest.rows) {
    if (seen.has(key))
      refuse('duplicate-key', key, 'Duplicate manifest row key.');
    seen.add(key);
  }
  const demoted = new Set<string>();
  for (const key of [...paths.keys()].sort()) {
    const row = rows.get(key);
    if (!row)
      refuse(
        'dependency-missing',
        key,
        'A required semantic dependency has no manifest row.',
      );
    else if (row.requirement !== 'required') demoted.add(key);
  }
  for (const edge of manifest.edges)
    if (
      edge.kind !== 'citation' &&
      rows.get(edge.from)?.requirement === 'required' &&
      rows.get(edge.to)?.requirement === 'optional'
    )
      demoted.add(edge.to);
  for (const key of [...demoted].sort())
    refuse(
      'demotion',
      key,
      'A required semantic dependency cannot be demoted to optional.',
    );
  for (const row of manifest.rows)
    if (row.requirement === 'required' && !paths.has(row.key))
      refuse(
        'orphan',
        row.key,
        'Required row has no semantic path from a canonical root.',
      );
  return findings;
}

/** A launch failure that keeps a required row from launch, with its owner. */
type Blocker = { code: string; reason: string; owner: number | null };

/** Each row's distinct launch failures, in the inspection's order. */
function groupLaunchFailures(inspection: Inspection) {
  const blockers = new Map<string, Blocker[]>();
  for (const { key, code, reason, owner } of inspection.launchFailures) {
    const known = blockers.get(key) ?? [];
    if (!known.some((item) => item.code === code && item.reason === reason))
      known.push({ code, reason, owner: owner?.issue ?? null });
    blockers.set(key, known);
  }
  return blockers;
}

/**
 * The closure's upstream rows plus, to a fixpoint, the manifest rows their
 * descriptions cite: admission treats a `catalog:` citation as a dependency,
 * so a cited row that isn't imported fails its citer. EverythingPath,
 * `local/`, requirement, notice and resource rows have no upstream record.
 */
function collectImportKeys({
  manifest,
  rows,
  closure,
}: {
  manifest: LaunchManifest;
  rows: Map<string, ManifestRow>;
  closure: string[];
}) {
  const citations = new Map<string, string[]>();
  for (const { from, to, kind } of manifest.edges)
    if (kind === 'citation')
      citations.set(from, [...(citations.get(from) ?? []), to]);
  const keys = new Set(
    closure.filter((key) => upstreamKey.test(key) && rows.has(key)),
  );
  const queue = [...keys];
  for (const key of queue)
    for (const target of citations.get(key) ?? [])
      if (upstreamKey.test(target) && rows.has(target) && !keys.has(target)) {
        keys.add(target);
        queue.push(target);
      }
  return [...keys].sort();
}

type ImportArtifact = Awaited<ReturnType<typeof importCatalog>>;
type ScopeGate = Pick<
  ReturnType<typeof assessCatalogAdmission>,
  | 'admitted'
  | 'held'
  | 'dependentOmissions'
  | 'retainedExceptions'
  | 'failures'
  | 'requiredNotices'
>;
type HeldCause =
  | 'held'
  | 'failed'
  | 'no-candidate'
  | 'retained'
  | 'requirement';

/** Outcome fields of a required row that isn't included. */
type Blocked = {
  key: string;
  requirement: 'required';
  reason: string;
  owner: number;
  path: string[];
  blockers: Blocker[];
  /** Set when a remap renamed the row's release identity. */
  releaseKey?: string;
};
type ScopeRowOutcome =
  | { key: string; requirement: 'optional'; outcome: 'outside-mvp' }
  | {
      key: string;
      requirement: 'required';
      outcome: 'included';
      satisfiedBy: 'requirement';
    }
  | {
      key: string;
      requirement: 'required';
      outcome: 'included';
      satisfiedBy: 'definition';
      gate: 'admitted';
      releaseKey?: string;
    }
  | (Blocked & {
      outcome: 'held';
      cause: HeldCause;
      /** The gate's class, when the gate assessed this row's candidate. */
      gate?: GateClass;
    })
  | (Blocked & { outcome: 'dependent-omitted'; gate: 'dependent-omitted' });
type HeldOutcome = Extract<ScopeRowOutcome, { outcome: 'held' }>;

function previousBinding(previous: CatalogReleaseArtifact | undefined) {
  const payload = previous?.batches
    .flat()
    .find(
      (row) => row.kind === 'report' && row.key === 'content:scope',
    )?.payload;
  const binding = isObject(payload) ? payload.binding : undefined;
  return isObject(binding) ? binding : undefined;
}

/** What the release inputs produced for the scope's rows. */
type Candidates = {
  classes: ReturnType<typeof classifyGate>;
  imported: Set<string>;
  remapped: Map<string, string>;
  resources: Set<string>;
  notices: Set<string>;
};
/**
 * How far the build got: built; refused after its gates were assessed (an
 * existing gate, the release number or the artifact path refused it); or
 * refused before any gate, when the release inputs could not be read.
 */
type ReleaseState =
  | { stage: 'built'; candidates: Candidates }
  | { stage: 'refused'; reason: string; candidates: Candidates }
  | { stage: 'inputs-refused'; reason: string };

/**
 * Classifies every manifest row as exactly one of included, held (with its
 * cause, reason and owner), dependent-omitted or outside-MVP, and qualifies
 * the scope. `refusal` is set when the release was not built: then nothing is
 * included. A row's blockers come from the inventory with this build's own
 * verification projection (`verifyLaunchRows`, shared with `mvp:status`): an
 * observation it verifies no longer blocks. `resourceSources` are the source
 * texts the build read for its authored resources, legal registry and legal
 * resources; a resource without one stays unverified.
 */
export function accountReleaseScope({
  scope,
  artifact,
  gate,
  authoredResources,
  resourceSources = { authored: [] },
  previous,
  refusal,
}: {
  scope: ReleaseScope;
  artifact: Pick<ImportArtifact, 'catalog'> &
    Partial<Pick<ImportArtifact, 'unsupported'>>;
  gate: ScopeGate;
  authoredResources: string[];
  resourceSources?: Parameters<typeof scopeBuildResources>[0];
  previous?: CatalogReleaseArtifact;
  refusal?: string;
}) {
  const verification = verifyLaunchRows(scope.manifest, {
    admission: gate,
    scopeBuild: {
      entries: artifact.catalog.entries,
      remaps: new Map(
        artifact.catalog.remaps
          .filter(({ applied }) => applied)
          .map(({ from, to }) => [from, to]),
      ),
      resources: scopeBuildResources({
        ...resourceSources,
        authored: resourceSources.authored.filter(({ key }) =>
          authoredResources.includes(key),
        ),
      }),
    },
    unsupported: artifact.unsupported ?? { entries: [] },
    proofs: {
      registry: launchMechanismProofs,
      sha256Of: (path) => repositoryFileSha256(projectRoot, path),
    },
    proseCases: launchProseCases,
    calculationIdentity: currentCalculationIdentity,
    stale: [],
  });
  const blockers = verification.length
    ? groupLaunchFailures(
        inspectLaunchInventory(scope.manifest, { verification }),
      )
    : scope.blockers;
  const candidates: Candidates = {
    classes: classifyGate(gate),
    imported: new Set(
      [...artifact.catalog.entries, ...artifact.catalog.resources].map(
        ({ externalKey }) => externalKey,
      ),
    ),
    remapped: new Map(
      artifact.catalog.remaps
        .filter(({ applied }) => applied)
        .map(({ from, to }) => [from, to]),
    ),
    resources: new Set(authoredResources),
    notices: new Set(gate.requiredNotices),
  };
  return qualifyScope({
    scope: { ...scope, blockers },
    previous,
    state:
      refusal === undefined
        ? { stage: 'built', candidates }
        : { stage: 'refused', reason: refusal, candidates },
  });
}

/**
 * The scope's accounting when its release inputs (selection, import or gate
 * assessment) were refused: every required row is held, with that cause.
 */
export function accountRefusedScopeInputs({
  scope,
  reason,
}: {
  scope: ReleaseScope;
  reason: string;
}) {
  return qualifyScope({ scope, state: { stage: 'inputs-refused', reason } });
}

function qualifyScope({
  scope,
  previous,
  state,
}: {
  scope: ReleaseScope;
  previous?: CatalogReleaseArtifact;
  state: ReleaseState;
}) {
  const releaseKeys = new Map<string, string[]>();
  const rows = [...scope.manifest.rows]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((row) => classifyRow({ row, scope, state, releaseKeys }));
  const findings = [
    ...scope.findings,
    ...previousDrift(scope, previous),
    ...duplicateReleaseKeys(releaseKeys),
  ];
  const counts = countOutcomes(rows);
  return {
    binding: scope.binding,
    qualification: {
      status:
        findings.length === 0 && counts.included === counts.required
          ? ('QUALIFIED' as const)
          : ('FAILED' as const),
      findings,
      counts,
    },
    rows,
  };
}

export type ReleaseScopeReport = ReturnType<typeof qualifyScope>;

function previousDrift(
  scope: ReleaseScope,
  previous: CatalogReleaseArtifact | undefined,
): ScopeFinding[] {
  const prior = previousBinding(previous);
  if (
    prior?.version !== scope.binding.version ||
    prior.launchScopeIdentity === scope.binding.launchScopeIdentity
  )
    return [];
  return [
    {
      code: 'previous-drift',
      key: scope.version,
      reason: `The comparison base binds ${scope.version} as ${typeof prior.launchScopeIdentity === 'string' ? prior.launchScopeIdentity : 'another identity'}, not ${scope.binding.launchScopeIdentity}; a changed scope needs a new scope version.`,
      path: [],
    },
  ];
}

function duplicateReleaseKeys(releaseKeys: Map<string, string[]>) {
  return [...releaseKeys]
    .filter(([, keys]) => keys.length > 1)
    .map(
      ([releaseKey, keys]): ScopeFinding => ({
        code: 'duplicate-key',
        key: releaseKey,
        reason: `Manifest rows ${keys.join(', ')} resolve to one release key.`,
        path: [],
      }),
    );
}

/** A refusal's headline: its gate failure detail rides in each row's own reason. */
function headline(reason: string) {
  return reason.split(': ', 1)[0] ?? reason;
}

/** One manifest row's outcome. */
function classifyRow({
  row,
  scope,
  state,
  releaseKeys,
}: {
  row: ManifestRow;
  scope: ReleaseScope;
  state: ReleaseState;
  releaseKeys: Map<string, string[]>;
}): ScopeRowOutcome {
  if (row.requirement === 'optional')
    return { key: row.key, requirement: 'optional', outcome: 'outside-mvp' };
  const blocked = blockedRow(row, scope);
  const held = (cause: HeldCause, reason: string): HeldOutcome => ({
    ...blocked,
    outcome: 'held',
    cause,
    reason,
  });
  if (/^(?:rule|notice|resource)\//.test(row.key))
    return classifyRequirement({ row, blocked, held, state });
  if (state.stage === 'inputs-refused')
    return held('failed', headline(state.reason));
  return classifyDefinition({ row, blocked, held, state, releaseKeys });
}

/**
 * A requirement row is satisfied, never released: its own holds and
 * observations decide, with the release output it names. A notice or a
 * released resource needs the built release; so does a satisfied rule.
 */
function classifyRequirement({
  row,
  blocked,
  held,
  state,
}: {
  row: ManifestRow;
  blocked: ReturnType<typeof blockedRow>;
  held: (cause: HeldCause, reason: string) => HeldOutcome;
  state: ReleaseState;
}): ScopeRowOutcome {
  const isResource = row.key.startsWith('resource/');
  if (isResource && !resourceReleaseKey(row.key))
    return held(
      'no-candidate',
      'The release path has no output for this resource.',
    );
  if ((isResource || row.key.startsWith('notice/')) && state.stage !== 'built')
    return held('failed', headline(state.reason));
  const missing =
    state.stage === 'built'
      ? missingRequirementOutput(row.key, state.candidates)
      : undefined;
  if (missing) return held('no-candidate', missing);
  if (blocked.blockers.length) return requirementHeld(blocked);
  if (state.stage !== 'built') return held('failed', headline(state.reason));
  return {
    key: row.key,
    requirement: 'required',
    outcome: 'included',
    satisfiedBy: 'requirement',
  };
}

function blockedRow(row: ManifestRow, scope: ReleaseScope) {
  return {
    key: row.key,
    requirement: 'required' as const,
    owner: row.holds[0]?.owner.issue ?? row.implementationOwner.issue,
    path: scope.paths.get(row.key) ?? [row.key],
    blockers: scope.blockers.get(row.key) ?? [],
  };
}

/** A requirement held by its own launch failures: its first hold, else outstanding mechanism. */
function requirementHeld(blocked: ReturnType<typeof blockedRow>): HeldOutcome {
  const primary =
    blocked.blockers.find(({ code }) => code === 'hold') ??
    blocked.blockers.find(({ code }) => code === 'implementation') ??
    blocked.blockers[0];
  return {
    ...blocked,
    outcome: 'held',
    cause: 'requirement',
    reason: primary?.reason ?? 'The requirement has launch failures.',
    owner: primary?.owner ?? blocked.owner,
  };
}

function missingRequirementOutput(key: string, candidates: Candidates) {
  if (key.startsWith('rule/')) return undefined;
  if (key.startsWith('notice/'))
    return candidates.notices.has(key.slice('notice/'.length))
      ? undefined
      : 'No included definition requires this notice.';
  const output = resourceReleaseKey(key);
  return output &&
    (output.kind === 'legal' || candidates.resources.has(output.key))
    ? undefined
    : 'The release path has no output for this resource.';
}

/** A catalog definition: the gate's class for its (possibly remapped) release key. */
function classifyDefinition({
  row,
  blocked,
  held,
  state,
  releaseKeys,
}: {
  row: ManifestRow;
  blocked: ReturnType<typeof blockedRow>;
  held: (cause: HeldCause, reason: string) => HeldOutcome;
  state: Exclude<ReleaseState, { stage: 'inputs-refused' }>;
  releaseKeys: Map<string, string[]>;
}): ScopeRowOutcome {
  const { classes, imported, remapped } = state.candidates;
  const releaseKey = remapped.get(row.key) ?? row.key;
  releaseKeys.set(releaseKey, [
    ...(releaseKeys.get(releaseKey) ?? []),
    row.key,
  ]);
  const renamed = releaseKey === row.key ? {} : { releaseKey };
  const assessed = classes.get(releaseKey);
  if (!assessed)
    return {
      ...held(
        'no-candidate',
        imported.has(releaseKey)
          ? 'The gate did not assess this candidate.'
          : 'The release inputs produce no candidate for this row.',
      ),
      ...renamed,
    };
  const gated = { gate: assessed.gate, ...renamed };
  switch (assessed.gate) {
    case 'failed':
    case 'held':
    case 'retained':
      return { ...held(assessed.gate, assessed.reason), ...gated };
    case 'dependent-omitted':
      return {
        ...blocked,
        outcome: 'dependent-omitted',
        reason: assessed.reason,
        gate: 'dependent-omitted',
        ...renamed,
      };
    case 'admitted':
      if (state.stage === 'refused')
        return { ...held('failed', headline(state.reason)), ...gated };
      if (blocked.blockers.length)
        return { ...requirementHeld(blocked), ...gated };
      return {
        key: row.key,
        requirement: 'required',
        outcome: 'included',
        satisfiedBy: 'definition',
        gate: 'admitted',
        ...renamed,
      };
    default: {
      const exhaustive: never = assessed.gate;
      return exhaustive;
    }
  }
}

function countOutcomes(rows: ScopeRowOutcome[]) {
  const heldByCause: Record<HeldCause, number> = {
    held: 0,
    failed: 0,
    'no-candidate': 0,
    retained: 0,
    requirement: 0,
  };
  const counts = {
    rows: rows.length,
    required: 0,
    optional: 0,
    included: 0,
    held: 0,
    heldByCause,
    dependentOmitted: 0,
    outsideMvp: 0,
  };
  for (const row of rows) {
    counts[row.requirement]++;
    switch (row.outcome) {
      case 'included':
        counts.included++;
        break;
      case 'held':
        counts.held++;
        heldByCause[row.cause]++;
        break;
      case 'dependent-omitted':
        counts.dependentOmitted++;
        break;
      case 'outside-mvp':
        counts.outsideMvp++;
        break;
      default: {
        const exhaustive: never = row;
        return exhaustive;
      }
    }
  }
  return counts;
}

/** Each `content:scope:<n>` row stays well inside one release batch. */
const MAX_SCOPE_CHUNK_BYTES = 200_000;

/** The scope binding and report as `createCatalogRelease` takes them. */
export function releaseScopeContent(report: ReleaseScopeReport) {
  const chunks: ScopeRowOutcome[][] = [];
  let chunk: ScopeRowOutcome[] = [];
  let bytes = 0;
  for (const row of report.rows) {
    const size = releaseByteCount(row) + 1;
    if (chunk.length && bytes + size > MAX_SCOPE_CHUNK_BYTES) {
      chunks.push(chunk);
      chunk = [];
      bytes = 0;
    }
    chunk.push(row);
    bytes += size;
  }
  if (chunk.length) chunks.push(chunk);
  return {
    binding: report.binding,
    summary: { binding: report.binding, qualification: report.qualification },
    chunks,
  };
}

/** The qualification's blocking rows, for the operator's error. */
export function describeScopeFailure(report: ReleaseScopeReport, limit = 5) {
  const blocking = report.rows.filter(
    (row): row is Extract<ScopeRowOutcome, Blocked> =>
      row.outcome === 'held' || row.outcome === 'dependent-omitted',
  );
  return [
    ...report.qualification.findings
      .slice(0, limit)
      .map(({ code, key, reason }) => `${code} ${key}: ${reason}`),
    ...blocking
      .slice(0, limit)
      .map(
        (row) =>
          `${row.key} ${row.outcome}${row.outcome === 'held' ? ` (${row.cause})` : ''} via ${row.path.join(' → ')}`,
      ),
    `${report.qualification.findings.length} scope findings and ${blocking.length} required rows not included.`,
  ].join('\n');
}
