import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  importedCatalogEntrySchema,
  type ImportedClassFeatureSpellcasting,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema.ts';
import { preparedItemWeapon } from '../../src/lib/catalog/imported-item.ts';
import {
  importedArchetypeKeys,
  preparedArchetypeDetail,
} from '../../src/lib/catalog/imported-archetype.ts';
import {
  classListCollectionPath,
  launchMechanismProofSchema,
  proofNamesMechanism,
  provenModifierMechanisms,
  type GrantedLevelsRoute,
  type LaunchMechanismProof,
  type NamedMechanismProof,
} from './launch-mechanism-proofs.ts';
import {
  reviewedGrantedSpells,
  type GrantedSpellRecord,
} from './granted-spells.ts';
import {
  launchProseCaseSchema,
  launchProseCategoryIds,
  isArchetypeProficiencyProse,
  proseMechanisms,
  type LaunchProseCase,
  type LaunchProseCategory,
} from './launch-prose-categories.ts';
import type { LaunchManifest, LaunchRow } from './launch-inventory-schema.ts';

/**
 * The launch verification projection (content-verification design, Q2 and
 * Q5). The inventory stays frozen requirements; this module reads one current
 * build and says which of a row's observations it verifies. It never admits
 * content: only the existing gate does, and only its `admitted` result counts.
 * Held, failed, retained, omitted or unassessed rows, stale bindings and
 * inventory holds verify nothing. `release-scope.ts` and `mvp:status` share
 * `verifyLaunchRows`.
 */
export const launchObservationFields = [
  'admission',
  'structure',
  'contentEvidence',
  'noticeEvidence',
] as const;
export type LaunchObservationField = (typeof launchObservationFields)[number];

/** A row the projection verifies at least one observation or mechanism of. */
export type VerifiedLaunchRow = {
  key: string;
  verified: LaunchObservationField[];
  /** Outstanding mechanisms a current proof registry entry proves. */
  mechanisms: string[];
  /**
   * Outstanding mechanisms a reviewed prose case makes permitted prose
   * (`launch-prose-categories.ts`), none of them proven. Only a case category
   * appears here; D7 is issue-only.
   */
  prose: { mechanism: string; category: LaunchProseCategory }[];
  /** Gate evidence IDs, the scoped entry's or resource source's SHA-256. */
  evidence: string[];
};

type GateRow = { externalKey: string; reason: string };
/** The gate result fields the projection reads (`assessCatalogAdmission`). */
export type LaunchGate = {
  admitted: readonly (GateRow & {
    missingNotices?: readonly string[];
    evidence?: readonly string[];
  })[];
  held: readonly GateRow[];
  dependentOmissions: readonly GateRow[];
  retainedExceptions: readonly GateRow[];
  failures: readonly GateRow[];
};
export type GateClass =
  | 'admitted'
  | 'held'
  | 'failed'
  | 'retained'
  | 'dependent-omitted';

/** Each assessed key's gate class; a failure overrides every other class. */
export function classifyGate(gate: LaunchGate) {
  const classes = new Map<string, { gate: GateClass; reason: string }>();
  const set = (key: string, gateClass: GateClass, reason: string) =>
    classes.set(key, { gate: gateClass, reason });
  for (const row of gate.admitted) set(row.externalKey, 'admitted', row.reason);
  for (const row of gate.dependentOmissions)
    set(row.externalKey, 'dependent-omitted', row.reason);
  for (const row of gate.retainedExceptions)
    set(row.externalKey, 'retained', row.reason);
  for (const row of gate.held) set(row.externalKey, 'held', row.reason);
  for (const { externalKey, reason } of gate.failures) {
    const known = classes.get(externalKey);
    set(
      externalKey,
      'failed',
      known?.gate === 'failed' ? `${known.reason} ${reason}` : reason,
    );
  }
  return classes;
}

/** The release rows a `resource/` requirement is satisfied by. */
export function resourceReleaseKey(key: string) {
  const name = key.slice('resource/'.length);
  if (name.startsWith('builtin:')) return { kind: 'resource', key: name };
  if (name === 'section15-registry') return { kind: 'legal', key: 'registry' };
  if (name === 'legal-resources') return { kind: 'legal', key: 'resources' };
  return undefined;
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * The resource outputs of a scoped build: each `resource/<name>` row the
 * build emits, with the SHA-256 of the source bytes it read. An authored
 * resource is a `builtin:` key; the legal registry and resources are emitted
 * by every build, but only bytes the build actually read are bound.
 */
export function scopeBuildResources({
  authored,
  registry,
  legalResources,
}: {
  authored: readonly { key: string; source: string }[];
  registry?: string;
  legalResources?: string;
}) {
  const resources = new Map<string, string>();
  for (const { key, source } of authored)
    resources.set(`resource/${key}`, sha256(source));
  if (registry !== undefined)
    resources.set('resource/section15-registry', sha256(registry));
  if (legalResources !== undefined)
    resources.set('resource/legal-resources', sha256(legalResources));
  return resources;
}

/** Each authored resource a build emits, with the rule resource it reads. */
const authoredResourceNames = {
  'builtin:casting-tables': 'castingTables',
  'builtin:representative-class-catalog': 'representativeClassCatalog',
  'builtin:representative-selection-catalog': 'representativeSelectionCatalog',
  'builtin:representative-archetype-catalog': 'representativeArchetypeCatalog',
  'builtin:representative-spellcasting-catalog':
    'representativeSpellcastingCatalog',
  'builtin:representative-race-catalog': 'representativeRaceCatalog',
} as const;

/**
 * The source texts of the authored resources a build emits, from its rule
 * resources (`readAuthoredRuleResources`), for `scopeBuildResources`.
 */
export function authoredResourceSources(
  ruleResources: Record<
    (typeof authoredResourceNames)[keyof typeof authoredResourceNames],
    { source: string }
  >,
) {
  return Object.entries(authoredResourceNames).map(([key, name]) => ({
    key,
    source: ruleResources[name].source,
  }));
}

/** What one scoped build produced (`catalog:release build --scope`). */
export type LaunchScopeBuild = {
  /** The scoped import's catalog entries. */
  entries: readonly unknown[];
  /** Applied remaps: a manifest key to its release key. */
  remaps: ReadonlyMap<string, string>;
  /** `scopeBuildResources`. */
  resources: ReadonlyMap<string, string>;
};

export type LaunchVerificationInput = {
  admission: LaunchGate;
  scopeBuild: LaunchScopeBuild;
  unsupported: {
    entries: readonly {
      externalKey: string;
      issues: readonly { field: string; reason?: string }[];
    }[];
  };
  /** The proof registry, read only through `currentMechanismProofs`. */
  proofs: MechanismProofEvidence;
  /** The reviewed prose cases (`launchProseCases`). */
  proseCases: readonly LaunchProseCase[];
  calculationIdentity: string;
  /** Why the evidence is stale; any reason verifies nothing. */
  stale: readonly string[];
  /** The granted-spell map's records; the committed map by default. */
  grantedSpells?: readonly GrantedSpellRecord[];
};

type VerifiableRow = Pick<
  LaunchRow,
  | 'key'
  | 'kind'
  | 'catalogKey'
  | 'requirement'
  | 'holds'
  | 'mechanisms'
  | 'sources'
  | 'noticeEvidence'
>;
type VerifiableManifest = {
  rows: readonly VerifiableRow[];
  edges: readonly Pick<
    LaunchManifest['edges'][number],
    'from' | 'to' | 'kind'
  >[];
};

/** Why an entry would not survive the release validator and adapter prepare. */
export function structureProblem(
  value: unknown,
  entries: ReadonlyMap<string, unknown>,
) {
  const parsed = importedCatalogEntrySchema.safeParse(value);
  if (!parsed.success) return 'The entry fails the release entry schema.';
  const { detail } = parsed.data;
  try {
    if (detail.kind === 'item' && detail.weapon)
      preparedItemWeapon({ weapon: detail.weapon });
    if (detail.kind === 'classFeature') classFeatureReferences(detail, entries);
    if (detail.kind === 'archetype') {
      for (const key of importedArchetypeKeys(detail)) reference(key, entries);
      preparedArchetypeDetail(detail, (key) => reference(key, entries));
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

type ImportedDetail = z.infer<typeof importedCatalogEntrySchema>['detail'];

/**
 * A class feature's upgrade is in the same build, and (granted-levels S1)
 * each of its Granted Spells is a Spell of the same build.
 */
function classFeatureReferences(
  detail: Extract<ImportedDetail, { kind: 'classFeature' }>,
  entries: ReadonlyMap<string, unknown>,
) {
  if (detail.duplicateUpgrade) reference(detail.duplicateUpgrade, entries);
  const facts = detail.spellcasting;
  const spells =
    facts && 'grantedSpells' in facts ? facts.grantedSpells.spells : [];
  for (const { spellKey } of spells) {
    const parsed = importedCatalogEntrySchema.safeParse(entries.get(spellKey));
    if (!parsed.success || parsed.data.detail.kind !== 'spell')
      throw new Error(`Granted Spell ${spellKey} is not in the scoped build.`);
  }
}

/** A referenced key's prepared reference, from the same scoped build. */
function reference(key: string, entries: ReadonlyMap<string, unknown>) {
  const parsed = importedCatalogEntrySchema.safeParse(entries.get(key));
  if (!parsed.success)
    throw new Error(`Reference ${key} is not in the scoped build.`);
  const { detail } = parsed.data;
  return {
    id: key,
    ruleIdentity: key,
    ...(detail.kind === 'classFeature' && detail.parentFeature
      ? { parentFeature: detail.parentFeature }
      : {}),
    ...(detail.kind === 'classFeature' && detail.part
      ? { part: detail.part }
      : {}),
  };
}

const incrementMechanism = 'Reviewed schedule increment';

function disqualifies(proof: LaunchMechanismProof, field: string) {
  return proof.disqualifying.some(
    (name) => name === '*' || field === name || field.startsWith(`${name}.`),
  );
}

/** A detail field holds at least one value: a non-empty array, object or text. */
function holdsValue(value: unknown) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * The scoped entry, with this release key, records what the named family's
 * scope requires.
 */
function inScope(
  context: Context,
  proof: NamedMechanismProof,
  { key, entry }: { key: string; entry: unknown },
) {
  const { scope } = proof;
  if (!scope) return true;
  const parsed = importedCatalogEntrySchema.safeParse(entry);
  if (!parsed.success || parsed.data.detail.kind !== scope.detailKind)
    return false;
  const { detail } = parsed.data;
  const fields: Record<string, unknown> = detail;
  if (
    !scope.nonEmpty.every((field) => holdsValue(fields[field])) ||
    scope.empty.some((field) => holdsValue(fields[field]))
  )
    return false;
  return listsInScope(context, scope, { key, detail });
}

/**
 * A spell family's lists: every class list passes `collections`; a
 * class-list family needs at least one, and a granted-levels family needs
 * its granted pairs proven (`grantedLevelsProven`) instead.
 */
function listsInScope(
  context: Context,
  { collections, grantedLevels }: NonNullable<NamedMechanismProof['scope']>,
  { key, detail }: { key: string; detail: ImportedDetail },
) {
  const lists = detail.kind === 'spell' ? Object.entries(detail.levels) : [];
  const listed = classListsProven(collections, lists);
  if (grantedLevels)
    return (
      detail.kind === 'spell' &&
      listed &&
      grantedLevelsProven(context, grantedLevels, {
        key,
        pairs: detail.grantedLevels,
      })
    );
  return !collections || (lists.length > 0 && listed);
}

/**
 * Every class on the Spell's lists holds it by a path at a level the family
 * proves for that path; without `collections`, any lists do.
 */
function classListsProven(
  collections: NonNullable<NamedMechanismProof['scope']>['collections'],
  lists: readonly [string, number][],
) {
  return (
    !collections ||
    lists.every(([classTag, level]) => {
      const path = classListCollectionPath(classTag);
      return collections.some(
        (proven) => proven.path === path && proven.levels.includes(level),
      );
    })
  );
}

/**
 * Every (kind, name, level) pair a Spell's `grantedLevels` names is granted
 * by the feature of the checked record for that pair, at that level, by a
 * proven route; and the records granting the Spell are exactly those pairs'
 * (the pairs equal the records' inverse). A Spell without pairs is outside.
 */
function grantedLevelsProven(
  context: Context,
  routes: readonly GrantedLevelsRoute[],
  {
    key,
    pairs,
  }: { key: string; pairs: Record<string, Record<string, number>> },
) {
  const named = Object.entries(pairs).flatMap(([kind, names]) =>
    Object.entries(names).map(([name, level]) => ({ kind, name, level })),
  );
  const grants = (record: GrantedSpellRecord) =>
    record.spells.filter(
      ({ spellKey }) => context.releaseKey(spellKey) === key,
    );
  const granting = context.grantedSpells.filter(
    (record) => grants(record).length > 0,
  );
  return (
    named.length > 0 &&
    granting.length === named.length &&
    named.every(({ kind, name, level }) => {
      const record = granting.find(
        ({ grantedLevels }) =>
          grantedLevels.kind === kind && grantedLevels.name === name,
      );
      return (
        record !== undefined &&
        grants(record).every(({ spellLevel }) => spellLevel === level) &&
        featureGrants(context, routes, { record, key, level })
      );
    })
  );
}

/**
 * The record's feature is a required row the gate admits, and its scoped
 * entry grants the Spell at the level by one of the routes.
 */
function featureGrants(
  context: Context,
  routes: readonly GrantedLevelsRoute[],
  {
    record,
    key,
    level,
  }: { record: GrantedSpellRecord; key: string; level: number },
) {
  const row = context.catalogRows.get(record.featureKey);
  if (row?.requirement !== 'required' || !gateAdmitted(context, row))
    return false;
  const parsed = importedCatalogEntrySchema.safeParse(
    context.entries.get(context.releaseKey(row.key)),
  );
  if (!parsed.success || parsed.data.detail.kind !== 'classFeature')
    return false;
  const facts = parsed.data.detail.spellcasting;
  if (
    !facts ||
    !('grantedSpells' in facts) ||
    !facts.grantedSpells.spells.some(
      ({ spellKey, spellLevel }) => spellKey === key && spellLevel === level,
    )
  )
    return false;
  return routes.some((route) => routeMatches(route, facts, level));
}

type GrantingFacts = Extract<
  ImportedClassFeatureSpellcasting,
  { grantedSpells: unknown }
>;

/**
 * The feature's facts follow the route at the level. The facts' variant fixes
 * the style and extra slot (`importedClassFeatureSpellcastingSchema`); a
 * bloodline's schedule must also hold a row at the level, with every row at
 * class level 2N + 1.
 */
function routeMatches(
  route: GrantedLevelsRoute,
  facts: GrantingFacts,
  level: number,
) {
  if (route.optionKind !== facts.optionKind || !route.levels.includes(level))
    return false;
  if (facts.optionKind === 'domain') return true;
  const { schedule } = facts.grantedSpells;
  return (
    schedule.some((step) => step.spellLevel === level) &&
    schedule.every((step) => step.classLevel === 2 * step.spellLevel + 1)
  );
}

type Context = ReturnType<typeof projectionContext>;

/** The build's evidence, indexed once per projection. */
function projectionContext(
  manifest: VerifiableManifest,
  input: LaunchVerificationInput,
) {
  const entries = new Map<string, unknown>();
  for (const entry of input.scopeBuild.entries) {
    const parsed = importedCatalogEntrySchema
      .pick({ externalKey: true })
      .safeParse(entry);
    if (parsed.success) entries.set(parsed.data.externalKey, entry);
  }
  const outgoing = new Map<string, VerifiableManifest['edges'][number][]>();
  for (const edge of manifest.edges)
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  return {
    input,
    classes: classifyGate(input.admission),
    admitted: new Map(
      input.admission.admitted.map((row) => [row.externalKey, row]),
    ),
    entries,
    rows: new Map(manifest.rows.map((row) => [row.key, row])),
    catalogRows: new Map(
      manifest.rows.flatMap((row) =>
        row.catalogKey ? [[row.catalogKey, row] as const] : [],
      ),
    ),
    grantedSpells: (input.grantedSpells ?? reviewedGrantedSpells).filter(
      ({ status }) => status === 'checked',
    ),
    outgoing,
    unsupported: new Map(
      input.unsupported.entries.map(({ externalKey, issues }) => [
        externalKey,
        issues,
      ]),
    ),
    proofs: currentMechanismProofs(input.proofs).filter(
      ({ calculationIdentity }) =>
        calculationIdentity === input.calculationIdentity,
    ),
    releaseKey: (key: string) => input.scopeBuild.remaps.get(key) ?? key,
  };
}

function resourceVerified(context: Context, key: string) {
  const row = context.rows.get(key);
  const emitted = context.input.scopeBuild.resources.get(key);
  return (
    row?.kind === 'resource' &&
    resourceReleaseKey(key) !== undefined &&
    emitted !== undefined &&
    row.sources.length === 1 &&
    row.sources[0]?.rawSha256 === emitted
  );
}

function noticeVerified(context: Context, key: string) {
  const row = context.rows.get(key);
  return (
    key.startsWith('notice/') &&
    row?.noticeEvidence.state === 'verified' &&
    row.holds.length === 0
  );
}

/** The gate admitted the row, and an increment's parent too. */
function gateAdmitted(context: Context, row: VerifiableRow) {
  const admitted = (key: string) =>
    context.classes.get(context.releaseKey(key))?.gate === 'admitted';
  if (!admitted(row.key)) return false;
  if (!row.mechanisms.some(({ name }) => name === incrementMechanism))
    return true;
  const parents = (context.outgoing.get(row.key) ?? []).filter(
    ({ kind }) => kind === 'requirement',
  );
  return parents.length === 1 && parents.every(({ to }) => admitted(to));
}

/**
 * The outstanding mechanisms a current registry entry proves for the row: the
 * entry names the row's kind, no `unsupported` issue it names applies (except
 * one a prose category records), and either it names the mechanism and the
 * row's scoped entry is in its scope, or it is the plain-Modifiers family and
 * proves every one of the row's Modifiers (`provenModifierMechanisms`).
 */
function provenMechanisms(
  context: Context,
  row: VerifiableRow,
  { key, entry }: { key: string; entry: unknown },
) {
  const issues = (context.unsupported.get(key) ?? []).filter(
    (issue) => !isArchetypeProficiencyProse(row, issue),
  );
  const outstanding = row.mechanisms
    .filter(
      ({ disposition, status }) =>
        status === 'outstanding' && disposition !== 'permitted prose',
    )
    .map(({ name }) => name);
  const proven = context.proofs
    .filter(
      (proof) =>
        proof.kinds.includes(row.kind) &&
        !issues.some(({ field }) => disqualifies(proof, field)),
    )
    .flatMap((proof) =>
      'mechanism' in proof
        ? outstanding.filter(
            (name) =>
              name === proof.mechanism &&
              inScope(context, proof, { key, entry }),
          )
        : provenModifierMechanisms(proof, {
            key: row.key,
            kind: row.kind,
            names: outstanding,
            entry,
          }),
    );
  return [...new Set(outstanding.filter((name) => proven.includes(name)))];
}

/** The scoped build emits a valid entry, and every resource the row names. */
function structured(context: Context, row: VerifiableRow, entry: unknown) {
  return (
    entry !== undefined &&
    structureProblem(entry, context.entries) === undefined &&
    (context.outgoing.get(row.key) ?? [])
      .filter(({ kind }) => kind === 'resource')
      .every(({ to }) => resourceVerified(context, to))
  );
}

/** The row names a notice, and every notice it names is verified. */
function noticed(context: Context, row: VerifiableRow, key: string) {
  const notices = (context.outgoing.get(row.key) ?? []).filter(
    ({ kind }) => kind === 'notice',
  );
  return (
    notices.length > 0 &&
    notices.every(({ to }) => noticeVerified(context, to)) &&
    (context.admitted.get(key)?.missingNotices ?? []).length === 0
  );
}

function verifyCatalogRow(
  context: Context,
  row: VerifiableRow,
): VerifiedLaunchRow | undefined {
  if (!gateAdmitted(context, row)) return undefined;
  const key = context.releaseKey(row.key);
  const entry = context.entries.get(key);
  const fields: LaunchObservationField[] = ['admission'];
  const hasStructure = structured(context, row, entry);
  if (hasStructure) fields.push('structure');
  if (row.holds.length === 0) fields.push('contentEvidence');
  if (noticed(context, row, key)) fields.push('noticeEvidence');
  const mechanisms = provenMechanisms(context, row, { key, entry });
  return {
    key: row.key,
    verified: fields,
    mechanisms,
    prose: proseMechanisms(row, {
      entry,
      issues: context.unsupported.get(key) ?? [],
      cases: context.input.proseCases,
    }).filter(({ mechanism }) => !mechanisms.includes(mechanism)),
    evidence: [
      ...(context.admitted.get(key)?.evidence ?? []),
      ...(hasStructure
        ? [`entry:sha256:${sha256(JSON.stringify(entry))}`]
        : []),
    ],
  };
}

/**
 * Each row whose observations or mechanisms this build verifies, in key
 * order. Catalog rows: `admission` needs the gate's `admitted` class (an
 * increment's parent's too); `structure` also needs the scoped build to emit
 * an entry that survives `structureProblem`, with every resource the row
 * names verified; `contentEvidence` also needs no inventory hold;
 * `noticeEvidence` also needs at least one notice and every `notice/` row the
 * row names verified with no hold. An admitted row's outstanding mechanism is
 * proven by a current registry entry in whose scope the scoped entry falls,
 * or else made permitted prose by a category's recorded evidence
 * (`proseMechanisms`). A resource row is verified when the scoped build emits
 * it from bytes equal to the row's bound source. Notice, `rule/` and audit
 * rows have no gate result and are never verified here.
 */
export function verifyLaunchRows(
  manifest: VerifiableManifest,
  input: LaunchVerificationInput,
): VerifiedLaunchRow[] {
  if (input.stale.length) return [];
  const context = projectionContext(manifest, input);
  const verified: VerifiedLaunchRow[] = [];
  for (const row of [...manifest.rows].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  )) {
    if (row.kind === 'resource') {
      if (resourceVerified(context, row.key))
        verified.push({
          key: row.key,
          verified: [...launchObservationFields],
          mechanisms: [],
          prose: [],
          evidence: [
            `source:sha256:${input.scopeBuild.resources.get(row.key)}`,
          ],
        });
      continue;
    }
    if (!row.catalogKey || /^(?:notice|rule)\//.test(row.key)) continue;
    const projected = verifyCatalogRow(context, row);
    if (projected) verified.push(projected);
  }
  return verified;
}

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const identity = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const verificationRowSchema = z.strictObject({
  key: z.string().min(1),
  verified: z.array(z.enum(launchObservationFields)),
  mechanisms: z.array(z.string().min(1)),
  prose: z.array(
    z.strictObject({
      mechanism: z.string().min(1),
      category: z.enum(launchProseCategoryIds),
    }),
  ),
  evidence: z.array(z.string().min(1)),
});
/** `launchVerificationPackages`: the package resolution the build ran on. */
const packagesSchema = z.strictObject({
  parsers: z.strictObject({
    dependencyVersions: z.record(z.string().min(1), z.string().min(1)),
    resolutionSha256: sha,
  }),
  imports: z.record(
    z.string().min(1),
    z.strictObject({ version: z.string().min(1), lockSha256: sha }),
  ),
});
export type LaunchVerificationPackages = z.infer<typeof packagesSchema>;
export const launchVerificationSchema = z.strictObject({
  version: z.literal(1),
  scopeVersion: z.string().min(1),
  binding: z.strictObject({
    launchScopeIdentity: identity,
    calculationIdentity: identity,
    proofsSha256: sha,
    gate: z.strictObject({
      extractionFingerprint: sha,
      reviewedInputsFingerprint: sha,
      legalResourcesFingerprint: sha,
      upstream: z.array(
        z.strictObject({ repository: z.string(), commit: z.string() }),
      ),
    }),
    /** Every file the gate, import and projection can read, with its bytes' SHA-256. */
    inputs: z.record(z.string().min(1), sha),
    packages: packagesSchema,
  }),
  rows: z.array(verificationRowSchema),
});
export type LaunchVerification = z.infer<typeof launchVerificationSchema>;

export function parseLaunchVerification(value: unknown) {
  return launchVerificationSchema.parse(value);
}

export function serializeLaunchVerification(document: LaunchVerification) {
  const parsed = launchVerificationSchema.parse(document);
  const inputs = Object.fromEntries(
    Object.entries(parsed.binding.inputs).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
  );
  return `${JSON.stringify({ ...parsed, binding: { ...parsed.binding, inputs } }, null, 2)}\n`;
}

/** A proof registry and the checkout its test files are read from. */
export type MechanismProofEvidence = {
  registry: readonly unknown[];
  /** A repository file's bytes' SHA-256, or undefined when it is missing. */
  sha256Of: (path: string) => string | undefined;
};

/**
 * The registry entries that count as evidence: each parses (so names at
 * least one test) and every test file it names exists with its recorded
 * bytes. Everything else, including an entry without tests, proves nothing.
 */
export function currentMechanismProofs({
  registry,
  sha256Of,
}: MechanismProofEvidence): LaunchMechanismProof[] {
  return registry.flatMap((entry) => {
    const parsed = launchMechanismProofSchema.safeParse(entry);
    return parsed.success &&
      parsed.data.tests.every(
        ({ path, sha256: hash }) => sha256Of(path) === hash,
      )
      ? [parsed.data]
      : [];
  });
}

/** A repository file's bytes' SHA-256, or undefined when it is missing. */
export function repositoryFileSha256(root: string, path: string) {
  try {
    return sha256(readFileSync(join(root, path)));
  } catch {
    return undefined;
  }
}

/** The registry's identity, bound into the projection's header. */
export function mechanismProofsSha256(proofs: readonly LaunchMechanismProof[]) {
  return sha256(JSON.stringify(proofs));
}

type StalenessCurrent = {
  scopeVersion: string;
  launchScopeIdentity: string;
  calculationIdentity: string;
  proofsSha256: string;
  proofs: MechanismProofEvidence;
  /** The reviewed prose cases (`launchProseCases`). */
  proseCases: readonly unknown[];
  /** A file's bytes' SHA-256, or undefined when it is missing. */
  sha256Of: (path: string) => Promise<string | undefined>;
  /** `launchVerificationPackages` for the bound package names. */
  packages: (imports: readonly string[]) => Promise<LaunchVerificationPackages>;
};

async function changedInputs(
  { binding }: LaunchVerification,
  current: StalenessCurrent,
) {
  const changed: string[] = [];
  for (const [path, hash] of Object.entries(binding.inputs))
    if ((await current.sha256Of(path)) !== hash) changed.push(path);
  return changed.length
    ? [
        `${changed.length} bound input${changed.length === 1 ? '' : 's'} changed (${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ', …' : ''})`,
      ]
    : [];
}

async function changedPackages(
  { binding }: LaunchVerification,
  current: StalenessCurrent,
) {
  const bound = binding.packages;
  const packages = await current
    .packages(Object.keys(bound.imports))
    .catch((error: unknown) =>
      error instanceof Error ? error : new Error(String(error)),
    );
  if (packages instanceof Error)
    return [`the package resolution cannot be read (${packages.message})`];
  const same = (a: unknown, b: unknown) =>
    canonicalReleaseJson(a ?? null) === canonicalReleaseJson(b ?? null);
  const names = new Set([
    ...Object.keys(bound.imports),
    ...Object.keys(packages.imports),
  ]);
  const differing = [
    ...(same(packages.parsers, bound.parsers) ? [] : ['parsers']),
    ...[...names]
      .sort()
      .filter((name) => !same(bound.imports[name], packages.imports[name])),
  ];
  return differing.length
    ? [`the package resolution changed (${differing.join(', ')})`]
    : [];
}

/**
 * Rows naming a mechanism no current registry entry proves: no entry names
 * it, or, for a plain Modifier, its change is no proven pair.
 */
function unprovenMechanisms(
  document: LaunchVerification,
  current: StalenessCurrent,
) {
  const proofs = currentMechanismProofs(current.proofs);
  const unproven = document.rows.filter(({ key, mechanisms }) =>
    mechanisms.some(
      (name) => !proofs.some((proof) => proofNamesMechanism(proof, key, name)),
    ),
  );
  return unproven.length
    ? [
        `${unproven.length} row${unproven.length === 1 ? ' names' : 's name'} a mechanism no current registry entry proves`,
      ]
    : [];
}

/**
 * Rows naming prose no current reviewed case records. Every category a
 * projection can name is a case category (`launchProseCategoryIds`), so each
 * prose entry is checked; the build's other evidence (an unparsed
 * prerequisite's clauses) is bound by its inputs.
 */
function unrecordedProse(
  document: LaunchVerification,
  current: StalenessCurrent,
) {
  const cases = current.proseCases.flatMap((value) => {
    const parsed = launchProseCaseSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
  const unrecorded = document.rows.filter(({ key, prose }) =>
    prose.some(
      ({ mechanism, category }) =>
        !cases.some(
          (reviewed) =>
            reviewed.key === key &&
            reviewed.mechanism === mechanism &&
            reviewed.category === category,
        ),
    ),
  );
  return unrecorded.length
    ? [
        `${unrecorded.length} row${unrecorded.length === 1 ? ' names' : 's name'} prose no reviewed case records`,
      ]
    : [];
}

/**
 * Why a committed projection no longer describes the current checkout: a
 * changed scope identity, calculation identity, proof registry, bound input
 * file or package resolution, a row naming a mechanism no current registry
 * entry proves, or one naming reviewed-case prose no current case records.
 * Each check is cheap; none rebuilds anything. An empty list means current.
 */
export async function launchVerificationStaleness(
  document: LaunchVerification,
  current: StalenessCurrent,
) {
  const reasons: string[] = [];
  const { binding } = document;
  if (document.scopeVersion !== current.scopeVersion)
    reasons.push(
      `scope ${document.scopeVersion} is not ${current.scopeVersion}`,
    );
  if (binding.launchScopeIdentity !== current.launchScopeIdentity)
    reasons.push('the launch inventory identity changed');
  if (binding.calculationIdentity !== current.calculationIdentity)
    reasons.push('the calculation identity changed');
  if (binding.proofsSha256 !== current.proofsSha256)
    reasons.push('the mechanism proof registry changed');
  return [
    ...reasons,
    ...(await changedInputs(document, current)),
    ...(await changedPackages(document, current)),
    ...unprovenMechanisms(document, current),
    ...unrecordedProse(document, current),
  ];
}
