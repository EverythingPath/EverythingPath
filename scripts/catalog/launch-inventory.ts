import {
  canonicalLaunchInventory,
  parseLaunchInventory,
} from './launch-inventory-document.ts';
import { createAuditIndexes } from './launch-audit-shared.ts';
import { createHash } from 'node:crypto';
import { checkLaunchCheckpoints } from './launch-checkpoint-audit.ts';
import {
  checkLaunchNotices,
  requiredNoticeContext,
} from './launch-notice-audit.ts';
import {
  checkLaunchResources,
  missingResourceContext,
} from './launch-resource-audit.ts';
import { catalogKeySchema } from '../../src/lib/catalog/imported-entry-schema.ts';
import { launchAuthority as authority } from './launch-inventory-authority.ts';
import {
  partySupplementSchema,
  type LaunchBinding,
  type LaunchManifest,
  type LaunchOwner,
} from './launch-inventory-schema.ts';
import { pcgenPin, pins, prdPin } from './inventory.ts';
import identities from './everythingpath-identities.json';
import { allIncrementKeys } from './pcgen/schedules.ts';
import {
  launchObservationFields,
  type VerifiedLaunchRow,
} from './launch-verification.ts';
import { checkCompanionAudit } from './launch-companion-audit.ts';
import { magicalLineageProse } from './launch-prose-categories.ts';
import { checkCoreAudit } from './launch-core-audit.ts';
import { checkAdvancedAudit } from './launch-advanced-audit.ts';
import {
  findRaceAbilityTraitRule,
  raceAbilityTraitKey,
} from './racial-trait-rules.ts';

export function serializeLaunchInventory(value: unknown) {
  return `${JSON.stringify(canonicalLaunchInventory(value), null, 2)}\n`;
}

export function launchInventoryHash(value: unknown) {
  return createHash('sha256')
    .update(serializeLaunchInventory(value))
    .digest('hex');
}

export function launchScopeIdentity(value: unknown) {
  return genericIdentity(parseLaunchInventory(value));
}

let genericIdentityCache: { inputHash: string; identity: string } | undefined;
const genericFieldCache = new Map<
  string,
  { inputHash: string; bytes: Buffer }
>();

function genericIdentity(manifest: LaunchManifest) {
  const { party: _party, ...generic } = manifest;
  const fieldHashes: [string, string][] = [];
  const fields = Object.entries(generic).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const canonicalFields = fields.map(([field, value]) => {
    // Fresh byte fingerprints detect every submitted mutation. Only private,
    // derived canonical values are reused; validation and indexes run anew.
    const inputHash = createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
    fieldHashes.push([field, inputHash]);
    const previous = genericFieldCache.get(field);
    if (previous?.inputHash === inputHash) return previous.bytes;
    const canonical = canonicalLaunchInventory(value, field);
    const bytes = Buffer.from(
      JSON.stringify({ [field]: canonical }, null, 2).slice(2, -2),
    );
    genericFieldCache.set(field, { inputHash, bytes });
    return bytes;
  });
  const inputHash = createHash('sha256')
    .update(JSON.stringify(fieldHashes))
    .digest('hex');
  if (genericIdentityCache?.inputHash === inputHash)
    return genericIdentityCache.identity;
  const digest = createHash('sha256').update('{\n');
  canonicalFields.forEach((bytes, index) => {
    if (index > 0) digest.update(',\n');
    digest.update(bytes);
  });
  const identity = `sha256:${digest.update('\n}\n').digest('hex')}`;
  genericIdentityCache = { inputHash, identity };
  return identity;
}

export const campaignMvpRoots = Object.freeze(
  [
    ...authority.roots.map(({ key, name, kind }) => ({ key, name, kind })),
    {
      key: 'everythingpath/wizard-exploiter-wizard',
      name: 'Exploiter Wizard',
      kind: 'archetype',
    },
  ].map((root) => Object.freeze(root)),
);

type Finding = {
  code: string;
  key: string;
  reason: string;
  owner: LaunchOwner | null;
  paths: { keys: string[]; reasons: string[] }[];
};
type Edge = LaunchManifest['edges'][number];

function originalInventoryOwner(key: string): LaunchOwner | null {
  const batch = authority.batches.find(({ originalInventory }) =>
    originalInventory.includes(key),
  );
  return batch
    ? {
        issue: batch.issue,
        responsibility: batch.title,
        evidence: [
          `https://github.com/AndreasUnunger/EverythingPath/issues/${batch.issue}`,
          `sha256:${batch.bodySha256}`,
        ],
      }
    : null;
}

export function rootPaths(manifest: {
  roots: Pick<LaunchManifest['roots'][number], 'key'>[];
  rows: Pick<LaunchManifest['rows'][number], 'key' | 'kind'>[];
  edges: Pick<Edge, 'from' | 'to' | 'kind' | 'reason'>[];
  semanticContracts: Pick<
    LaunchManifest['semanticContracts'][number],
    'id' | 'from' | 'targets' | 'excludedContexts'
  >[];
  semanticContexts: LaunchManifest['semanticContexts'];
}) {
  const excluded = new Map<
    string,
    { nodes: Set<string>; pairs: Set<string> }
  >();
  for (const contract of manifest.semanticContracts)
    for (const context of contract.excludedContexts) {
      const block = excluded.get(context) ?? {
        nodes: new Set<string>(),
        pairs: new Set<string>(),
      };
      block.nodes.add(contract.id);
      for (const key of contract.targets)
        block.pairs.add(`${contract.from}\0${key}`);
      excluded.set(context, block);
    }
  const domainParents = new Set(
    manifest.semanticContracts.find(({ id }) => id === 'rule/core/shared/R01')
      ?.targets,
  );
  const rowKinds = new Map(manifest.rows.map(({ key, kind }) => [key, kind]));
  const outgoing = new Map<string, typeof manifest.edges>();
  for (const edge of manifest.edges) {
    if (edge.kind === 'citation') continue;
    const edges = outgoing.get(edge.from) ?? [];
    edges.push(edge);
    outgoing.set(edge.from, edges);
  }
  const paths = new Map<string, Finding['paths']>();
  for (const root of manifest.roots) {
    const contexts =
      manifest.semanticContexts.find(({ root: key }) => key === root.key)
        ?.contexts ?? [];
    const blocks = contexts.flatMap((context) => {
      const block = excluded.get(context);
      return block ? [block] : [];
    });
    const witness: Finding['paths'][number] = { keys: [root.key], reasons: [] };
    const witnesses = new Map([[root.key, witness]]);
    const queue = [root.key];
    for (const key of queue) {
      const path = witnesses.get(key);
      if (!path) continue;
      for (const edge of outgoing.get(key) ?? []) {
        if (
          blocks.some(
            ({ nodes, pairs }) =>
              nodes.has(edge.from) ||
              nodes.has(edge.to) ||
              pairs.has(`${edge.from}\0${edge.to}`),
          )
        )
          continue;
        if (
          contexts.includes('inquisitor-domain') &&
          domainParents.has(edge.from) &&
          rowKinds.get(edge.to) === 'spell'
        )
          continue;
        const next = {
          keys: [...path.keys, edge.to],
          reasons: [...path.reasons, edge.reason],
        };
        const incoming = paths.get(edge.to) ?? [];
        incoming.push(next);
        paths.set(edge.to, incoming);
        if (witnesses.has(edge.to)) continue;
        witnesses.set(edge.to, next);
        queue.push(edge.to);
      }
    }
  }
  return paths;
}

function checkBatches(
  manifest: LaunchManifest,
  fail: (code: string, key: string, reason: string) => void,
) {
  for (const original of authority.batches)
    if (!manifest.batches.some(({ issue }) => issue === original.issue))
      fail(
        'batch-inventory',
        `#${original.issue}`,
        'Every original batch, including its all-remainder partition, must survive.',
      );
  const wizard = manifest.ownerInventories.find(({ issue }) => issue === 702);
  if (
    !wizard?.requiredLocators.includes(
      'roleplaying_game/advanced_class_guide/acg_abilities_class.lst#Wizard Archetype ~ Exploiter Wizard',
    )
  )
    fail(
      'owner-inventory',
      '#702',
      'The original Wizard owner selector and its Exploiter subset are required.',
    );
  for (const inventory of manifest.ownerInventories)
    if (
      launchInventoryHash([
        ...inventory.requiredLocators,
        ...inventory.remainderLocators,
      ]) !==
      launchInventoryHash(inventory.sources.map(({ locator }) => locator))
    )
      fail(
        'owner-partition',
        `#${inventory.issue}`,
        'Required and remainder locators must preserve every original selector source binding.',
      );
  const rows = new Map(manifest.rows.map((row) => [row.key, row]));
  for (const batch of manifest.batches) {
    const original = authority.batches.find(
      ({ issue }) => issue === batch.issue,
    );
    if (
      !original ||
      launchInventoryHash(original.originalInventory) !==
        launchInventoryHash(batch.originalInventory) ||
      original.bodySha256 !== batch.bodySha256
    )
      fail(
        'batch-inventory',
        `#${batch.issue}`,
        'The original source inventory or frozen issue binding changed.',
      );
    const partition = [
      ...batch.requiredKeys,
      ...batch.optionalKeys,
      ...batch.remainderKeys,
    ];
    if (
      new Set(partition).size !== partition.length ||
      launchInventoryHash(partition) !==
        launchInventoryHash(batch.originalInventory)
    )
      fail(
        'batch-partition',
        `#${batch.issue}`,
        'Required, optional and remainder keys must partition the complete original inventory.',
      );
    for (const key of batch.requiredKeys)
      if (rows.get(key)?.requirement !== 'required')
        fail('batch-required', key, `#${batch.issue} requires this key.`);
    if (
      batch.title.includes('Curate pf1 classes,') &&
      batch.originalInventory.length > 3
    )
      fail(
        'class-cap',
        `#${batch.issue}`,
        'Original class batches remain capped at three definitions.',
      );
  }
  for (const partition of authority.classPartitions) {
    const batch = manifest.batches.find(
      ({ issue }) => issue === partition.issue,
    );
    if (
      !batch ||
      launchInventoryHash(batch.originalInventory) !==
        launchInventoryHash(partition.original_inventory)
    )
      fail(
        'class-partition',
        `#${partition.issue}`,
        'An original three-key class partition is missing.',
      );
  }
}

function checkCoverage(
  manifest: LaunchManifest,
  fail: (code: string, key: string, reason: string) => void,
) {
  for (let section = 1; section <= 19; section++)
    if (
      !manifest.coverage.some(({ contract }) => contract === `#251 §${section}`)
    )
      fail(
        'coverage',
        `#251 §${section}`,
        'Missing PRD implementation-section disposition.',
      );
  for (const contract of [
    '#251 acceptance appendix',
    ...Array.from({ length: 7 }, (_, i) => `#${731 + i}`),
  ])
    if (!manifest.coverage.some((row) => row.contract === contract))
      fail('coverage', contract, 'Missing acceptance/follow-up disposition.');
  for (const entry of authority.appendix.cases)
    if (
      !manifest.coverage.some(
        ({ contract }) => contract === `#251 appendix ${entry.id}`,
      )
    )
      fail(
        'coverage',
        entry.id,
        'Missing original acceptance-appendix case disposition.',
      );
}

function checkSources({
  manifest,
  bindings,
  fail,
}: {
  manifest: LaunchManifest;
  bindings?: readonly LaunchBinding[];
  fail: (code: string, key: string, reason: string) => void;
}) {
  const expectedPins = {
    pf1: pins.pf1.commit,
    'pf1-content': pins['pf1-content'].commit,
    pcgen: pcgenPin.commit,
    prd: prdPin.contentSha256,
    everythingpath: authority.baseline,
  };
  const observed = new Set(
    bindings?.map((binding) => launchInventoryHash(binding)),
  );
  for (const row of [...manifest.rows, ...manifest.checkpoints]) {
    const isCheckpoint = 'classKey' in row;
    const key = isCheckpoint ? `${row.classKey}:${row.level}` : row.key;
    const sources = isCheckpoint ? [row.source] : row.sources;
    for (const source of sources) {
      if (
        source.repository === 'pcgen' &&
        source.rawFileSha256 &&
        (source.effectiveSha256 !== null ||
          source.rawSha256 !== (source.rawLineSha256 ?? source.rawFileSha256))
      )
        fail(
          'source-effective',
          key,
          'Literal PCGen comparison evidence cannot claim a compiled effective identity.',
        );
      if (source.pin !== expectedPins[source.repository])
        fail('source-pin', key, `Unexpected ${source.repository} pin.`);
      if (source.locator.startsWith('/') || source.locator.includes('..'))
        fail(
          'source-locator',
          key,
          'Source locators must be relative and traversal-free.',
        );
      const original = authority.roots.find(
        (root) => root.key === key && root.repository === source.repository,
      );
      if (
        original &&
        (source.rawSha256 !== original.sha256 ||
          source.locator !== original.path)
      )
        fail('source-hash', key, 'Canonical root source binding is stale.');
      if (!bindings) continue;
      // Printed line references use observed whole-file bytes; the independent
      // checkpoint authority validates their exact locator and source domains.
      const observedFile =
        isCheckpoint &&
        observed.has(
          launchInventoryHash({
            ...source,
            locator: source.locator.split('#')[0] ?? '',
          }),
        );
      if (!observed.has(launchInventoryHash(source)) && !observedFile)
        fail(
          'source-hash',
          key,
          `Missing or stale observed source binding: ${source.repository}:${source.locator}.`,
        );
    }
  }
}

/**
 * Inventory accounting never authorizes admission, source clearance or
 * publication. `verification` is a current projection (`verifyLaunchRows`):
 * an observation it verifies overrides the frozen one, and a mechanism it
 * proves, or makes permitted prose by a PRD-named category's recorded
 * evidence (`launch-prose-categories.ts`), is no longer outstanding. Holds,
 * the other mechanism rules and the refusal of any other recorded prose stay.
 */
export function inspectLaunchInventory(
  value: unknown,
  options: {
    bindings?: readonly LaunchBinding[];
    verification?: readonly (Pick<
      VerifiedLaunchRow,
      'key' | 'verified' | 'mechanisms'
    > &
      Partial<Pick<VerifiedLaunchRow, 'prose'>>)[];
  } = {},
) {
  const manifest = parseLaunchInventory(value);
  const verified = new Map(
    (options.verification ?? []).map((row) => [
      row.key,
      {
        fields: new Set<string>(row.verified),
        mechanisms: new Set([
          ...row.mechanisms,
          ...(row.prose ?? []).map(({ mechanism }) => mechanism),
        ]),
      },
    ]),
  );
  const inventoryErrors: Finding[] = [];
  const launchFailures: Finding[] = [];
  const paths = rootPaths(manifest);
  const rows = new Map(manifest.rows.map((row) => [row.key, row]));
  const finding = (
    code: string,
    key: string,
    reason: string,
    owner: LaunchOwner | null = rows.get(key)?.inventoryOwner ??
      originalInventoryOwner(key),
  ): Finding => {
    const notice = requiredNoticeContext({ key });
    return {
      code,
      key,
      reason,
      owner:
        notice?.owner ??
        owner ??
        missingResourceContext({ key })?.owner ??
        null,
      paths: notice?.paths ??
        paths.get(key) ??
        missingResourceContext({ key })?.paths ?? [
          { keys: [key], reasons: [] },
        ],
    };
  };
  const fail = (code: string, key: string, reason: string) => {
    inventoryErrors.push(finding(code, key, reason));
  };
  if (manifest.authoritySha256 !== launchInventoryHash(authority))
    fail(
      'authority',
      manifest.scopeVersion,
      'The frozen root/ownership authority changed.',
    );
  if (
    launchInventoryHash(manifest.roots) !==
    launchInventoryHash(campaignMvpRoots)
  )
    fail(
      'roots',
      manifest.scopeVersion,
      'The exact 31 canonical roots are required.',
    );
  if (rows.size !== manifest.rows.length)
    fail('duplicate-key', manifest.scopeVersion, 'Duplicate row key.');
  const known = new Set(
    authority.batches.flatMap(({ originalInventory }) => originalInventory),
  );
  const allocated = new Set([
    ...identities.identities.map(({ externalKey }) => externalKey),
    ...allIncrementKeys(),
  ]);
  const inherited = authority.preservedBeforeReliance;
  for (const root of manifest.roots)
    if (!rows.has(root.key))
      fail('root-missing', root.key, 'A canonical root has no row.');
  for (const row of manifest.rows) {
    if (row.catalogKey && row.catalogKey !== row.key)
      fail('identity', row.key, 'Catalog and row identities disagree.');
    if (
      row.catalogKey &&
      !known.has(row.key) &&
      !row.key.startsWith('everythingpath/')
    )
      fail('unknown-key', row.key, 'Key has no original inventory.');
    if (
      row.catalogKey &&
      row.key.startsWith('everythingpath/') &&
      !allocated.has(row.key)
    )
      fail(
        'unallocated-identity',
        row.key,
        'Identity is neither ledger allocated nor a reviewed generated increment.',
      );
    if (
      !row.catalogKey &&
      !/^(?:rule|resource|notice|unallocated|local\/race-ability-scores)\//.test(
        row.key,
      )
    )
      fail(
        'malformed-key',
        row.key,
        'Noncatalog inventory identities must name their role.',
      );
    if (
      row.key.startsWith('local/race-ability-scores/') &&
      !campaignMvpRoots.some(
        (root) =>
          root.kind === 'race' &&
          findRaceAbilityTraitRule(root.key) &&
          raceAbilityTraitKey(root.key) === row.key,
      )
    )
      fail(
        'generated-identity',
        row.key,
        'Unknown local/generated race trait identity.',
      );
    if (row.requirement === 'required' && row.key.startsWith('unallocated/'))
      fail(
        'unallocated-identity',
        row.key,
        'Required output has no allocated catalog identity.',
      );
    if (
      row.requirement === 'required' &&
      !manifest.roots.some(({ key }) => key === row.key) &&
      !paths.has(row.key)
    )
      fail(
        'orphan',
        row.key,
        'Required row has no semantic path from a canonical root.',
      );
    if (
      row.catalogKey &&
      !row.key.startsWith('everythingpath/') &&
      !manifest.batches.some(
        (batch) =>
          batch.issue === row.inventoryOwner.issue &&
          batch.originalInventory.includes(row.key),
      )
    )
      fail('owner', row.key, 'Original owner does not contain this key.');
    for (const research of row.research)
      inventoryErrors.push(
        finding('research', row.key, research.question, research.owner),
      );
    if (row.requirement !== 'required') continue;
    if (inherited.keys.includes(row.key))
      launchFailures.push(
        finding(
          'before-reliance',
          row.key,
          inherited.requirement,
          inherited.owner,
        ),
      );
    for (const hold of row.holds)
      launchFailures.push(finding('hold', row.key, hold.reason, hold.owner));
    const projected = verified.get(row.key);
    for (const field of launchObservationFields)
      if (row[field].state !== 'verified' && !projected?.fields.has(field))
        launchFailures.push(
          finding(field, row.key, `${field} is ${row[field].state}.`),
        );
    for (const mechanism of row.mechanisms)
      if (
        mechanism.status === 'outstanding' &&
        !projected?.mechanisms.has(mechanism.name)
      )
        launchFailures.push(
          finding(
            'implementation',
            row.key,
            `${mechanism.name}: ${mechanism.contract}`,
            row.implementationOwner,
          ),
        );
    if (
      row.mechanisms.some(
        ({ disposition, status }) =>
          disposition === 'permitted prose' && status !== 'permitted',
      )
    )
      fail(
        'prose-disposition',
        row.key,
        'Permitted prose needs an explicit permitted contract.',
      );
    if (
      row.mechanisms.some(
        ({ name, disposition }) =>
          disposition === 'permitted prose' &&
          (row.key !== magicalLineageProse.key ||
            name !== magicalLineageProse.mechanism),
      )
    )
      fail(
        'prose-authority',
        row.key,
        "The inventory records no blanket prose exception: only Magical Lineage's metamagic is recorded prose. The PRD-named prose categories come only from the verification projection's recorded evidence; retain promised mechanics as outstanding.",
      );
  }
  for (const edge of manifest.edges) {
    if (edge.kind === 'citation') continue;
    if (inherited.keys.includes(edge.to))
      launchFailures.push(
        finding(
          'before-reliance',
          edge.to,
          inherited.requirement,
          inherited.owner,
        ),
      );
    if (!rows.has(edge.from)) fail('edge-source', edge.from, edge.reason);
    if (!rows.has(edge.to)) {
      const missing = finding(
        'dependency-missing',
        edge.to,
        edge.reason,
        originalInventoryOwner(edge.to) ?? rows.get(edge.from)?.inventoryOwner,
      );
      inventoryErrors.push(missing);
      launchFailures.push(missing);
    }
    if (
      rows.get(edge.from)?.requirement === 'required' &&
      rows.get(edge.to)?.requirement === 'optional'
    )
      fail(
        'required-dependency',
        edge.to,
        'A required semantic dependency cannot be demoted to optional.',
      );
  }
  for (const root of campaignMvpRoots.filter(({ kind }) => kind === 'class'))
    for (const name of [
      `${root.name} features and class options`,
      `${root.name} complete named printed definitions`,
    ])
      if (
        !manifest.pools.some(
          (pool) => pool.root === root.key && pool.name === name,
        )
      )
        fail(
          'pool-missing',
          root.key,
          `Missing required generic pool ${name}.`,
        );
  for (const root of campaignMvpRoots.filter(({ kind }) => kind === 'race'))
    if (
      !manifest.pools.some(
        (pool) =>
          pool.root === root.key &&
          pool.name === `${root.name} standard and alternate Racial Traits`,
      )
    )
      fail('pool-missing', root.key, 'Missing complete race trait inventory.');
  for (const root of campaignMvpRoots.filter(({ kind }) => kind === 'race'))
    if (
      findRaceAbilityTraitRule(root.key) &&
      !rows.has(raceAbilityTraitKey(root.key))
    )
      fail(
        'generated-trait-missing',
        root.key,
        'The existing reviewed local/generated standard ability trait is required.',
      );
  const requirementPairs = new Set(
    manifest.edges
      .filter(({ kind }) => kind !== 'citation')
      .map(({ from, to }) => `${from}\0${to}`),
  );
  for (const pool of manifest.pools) {
    const frozen = authority.poolCommitments.find(({ id }) => id === pool.id);
    if (
      frozen?.root !== pool.root ||
      frozen.membersSha256 !== pool.membersSha256 ||
      launchInventoryHash(frozen.members) !== launchInventoryHash(pool.members)
    )
      fail(
        'pool-authority',
        pool.root,
        `Pool ${pool.name} differs from the versioned source inventory; recomputing a local checksum cannot approve a sample or reduced pool.`,
      );
    if (pool.members.length === 0)
      fail(
        'empty-pool',
        pool.root,
        `Required pool ${pool.name} is empty; absence of parsed source members does not prove completeness.`,
      );
    if (pool.membersSha256 !== launchInventoryHash(pool.members))
      fail(
        'pool-binding',
        pool.root,
        `Option pool changed without source research: ${pool.id}.`,
      );
    for (const key of pool.members.filter((key) => !rows.has(key)))
      fail('pool-member', key, `Required option missing from ${pool.name}.`);
    for (const key of pool.members)
      if (
        pool.purpose === 'eligibility' &&
        !requirementPairs.has(`${pool.root}\0${key}`)
      )
        fail('pool-edge', key, `Missing semantic membership of ${pool.name}.`);
    for (const research of pool.research)
      inventoryErrors.push(
        finding('research', pool.root, research.question, research.owner),
      );
  }
  for (const frozen of authority.poolCommitments)
    if (!manifest.pools.some(({ id }) => id === frozen.id))
      fail(
        'pool-authority',
        frozen.root,
        `Frozen source pool ${frozen.id} is missing.`,
      );
  for (const research of manifest.research)
    inventoryErrors.push(
      finding(
        'research',
        manifest.scopeVersion,
        research.question,
        research.owner,
      ),
    );
  for (const research of authority.genericClosure.unresolved)
    if (
      !inventoryErrors.some(
        ({ key, reason }) =>
          key === research.key && reason === research.question,
      )
    )
      inventoryErrors.push(
        finding('research', research.key, research.question, research.owner),
      );
  const auditIndexes = createAuditIndexes({ manifest, rows });
  checkLaunchResources({ manifest, fail, indexes: auditIndexes });
  checkLaunchNotices({
    manifest,
    fail,
    indexes: auditIndexes,
    incomingPaths: paths,
  });
  checkLaunchCheckpoints({ manifest, fail });
  checkCompanionAudit(manifest, fail, auditIndexes);
  checkCoreAudit(manifest, fail, auditIndexes);
  checkAdvancedAudit(manifest, fail, auditIndexes);
  checkBatches(manifest, fail);
  checkCoverage(manifest, fail);
  checkSources({ manifest, bindings: options.bindings, fail });
  const genericComplete = inventoryErrors.length === 0;
  return {
    scopeVersion: manifest.scopeVersion,
    identity: genericIdentity(manifest),
    roots: manifest.roots,
    checkpoints: manifest.checkpoints,
    rowCount: rows.size,
    poolCount: manifest.pools.length,
    semanticContractCount: manifest.semanticContracts.length,
    sourceAccountingCount: manifest.sourceAccounting.length,
    genericComplete,
    launchQualified: genericComplete && launchFailures.length === 0,
    inventoryErrors,
    launchFailures,
    party: inspectPartySupplement(manifest.party, manifest),
    incoming: Object.fromEntries(paths),
  };
}

/** Party evidence is separate from the generic scope and cannot be inferred from it. */
export function inspectPartySupplement(
  value: unknown,
  manifest: LaunchManifest,
) {
  const supplement = partySupplementSchema.parse(value);
  if (supplement.status === 'pending')
    return {
      status: 'pending' as const,
      qualified: false,
      missing: supplement.requiredInputs,
    };
  const missing: string[] = [];
  const seen = new Set<string>();
  const characters = new Set(
    supplement.builds.map(({ character }) => character),
  );
  const required = new Set(
    manifest.rows
      .filter(({ requirement }) => requirement === 'required')
      .map(({ catalogKey }) => catalogKey),
  );
  for (const build of supplement.builds) {
    const id = `${build.character}:${build.at}`;
    if (seen.has(id)) missing.push(`Duplicate party checkpoint ${id}.`);
    seen.add(id);
    if (
      build.classes.reduce((sum, entry) => sum + entry.levels, 0) !==
      build.level
    )
      missing.push(`${id}: class levels do not total the recorded level.`);
    for (const key of [
      ...build.classes.map(({ key }) => key),
      ...build.bloodlines,
      ...build.choices.map(({ key }) => key),
      ...build.spells,
      ...build.feats,
      ...build.gear,
      ...build.companions,
    ])
      if (!catalogKeySchema.safeParse(key).success || !required.has(key))
        missing.push(
          `${id}: ${key} needs a separately researched party-supplement row and qualification.`,
        );
  }
  for (const character of characters)
    if (!seen.has(`${character}:current`) || !seen.has(`${character}:next`))
      missing.push(`${character}: both current and next builds are required.`);
  return {
    status: 'recorded' as const,
    qualified: false,
    missing: [
      ...missing,
      'Recorded party inputs still require public saved-sheet and two-session qualification.',
    ],
  };
}

export function renderLaunchInventoryReport(value: unknown) {
  const manifest = parseLaunchInventory(value);
  const report = inspectLaunchInventory(manifest);
  const held = new Map<string, Finding[]>();
  for (const failure of report.launchFailures) {
    const failures = held.get(failure.key) ?? [];
    failures.push(failure);
    held.set(failure.key, failures);
  }
  const lines = [
    '# Campaign MVP inventory',
    '',
    `Scope: ${report.scopeVersion}; identity: ${report.identity}.`,
    `Roots: ${report.roots.length}; class/level checkpoints: ${report.checkpoints.length}; rows: ${report.rowCount}; pools: ${report.poolCount}.`,
    `Source-bound semantic contracts: ${report.semanticContractCount}; individually accounted source memberships/definitions: ${report.sourceAccountingCount}. Retained source inventories and metadata surfaces are separate from eligibility pools.`,
    `Generic inventory: ${report.genericComplete ? 'complete' : 'INCOMPLETE'}. Launch qualification: ${report.launchQualified ? 'qualified' : 'FAILED'}. Party supplement: ${report.party.status}, unqualified.`,
    '',
    'Inventory status is not admission, release or go-live approval.',
    '',
    '## Companion eligibility partitions',
    '',
    ...manifest.companionPartitions.map(
      ({ name, entries }) =>
        `- ${name}: ${entries.filter(({ eligibility }) => eligibility === 'baseline').length} baseline; ${entries.filter(({ eligibility }) => eligibility === 'conditional').length} conditional; ${entries.filter(({ eligibility }) => eligibility === 'remainder').length} remainder. Exact source decisions, prerequisites and holds remain in the manifest.`,
    ),
    '',
    '## Inventory errors',
    '',
    ...report.inventoryErrors.map(
      (error) =>
        `- ${error.code}: ${error.key}; ${error.reason} Owner: ${error.owner ? `#${error.owner.issue}` : 'missing'}.`,
    ),
    '',
    '## Required launch failures',
    '',
    ...[...held].map(([key, failures]) => {
      const failure = failures[0];
      if (!failure) return '';
      const path = failure.paths[0];
      return `- ${key}: ${[...new Set(failures.map(({ code }) => code))].join(', ')}. Owner: ${failure.owner ? `#${failure.owner.issue}` : 'missing'}. ${path?.keys.join(' → ')}. All ${failure.paths.length} incoming path/reason witnesses and ${failures.length} failures are available through inspectLaunchInventory; source holds remain in the manifest row.`;
    }),
    '',
  ];
  return lines.join('\n');
}

export function renderLaunchInventoryOverview(value: unknown) {
  const report = inspectLaunchInventory(value);
  return [
    '# Campaign MVP inventory',
    '',
    `Scope: ${report.scopeVersion}; identity: ${report.identity}.`,
    `Roots: ${report.roots.length}; class/level checkpoints: ${report.checkpoints.length}; rows: ${report.rowCount}; pools: ${report.poolCount}.`,
    `Source-bound semantic contracts: ${report.semanticContractCount}; individually accounted source memberships/definitions: ${report.sourceAccountingCount}.`,
    `Generic inventory: ${report.genericComplete ? 'complete' : 'INCOMPLETE'}. Launch qualification: ${report.launchQualified ? 'qualified' : 'FAILED'}. Party supplement: ${report.party.status}, unqualified.`,
    '',
    `Inventory errors: ${report.inventoryErrors.length}; required launch failures: ${report.launchFailures.length}. Inventory status is not admission, release or go-live approval.`,
    '',
    'The [inventory handoff](campaign-mvp.md) explains the committed records and independent authorities.',
    'Generate the complete readable report with `pnpm -s catalog:launch-inventory --report`.',
    'Use `--diagnostics` for every diagnostic and incoming path, or `--expanded` for the complete decoded inventory JSON. Redirect these outputs to a file outside the checkout.',
    '',
  ].join('\n');
}
