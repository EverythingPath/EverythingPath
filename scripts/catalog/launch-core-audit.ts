import { parseLaunchInventoryDocument } from './launch-inventory-document.ts';
import {
  auditMechanism,
  createAuditIndexes,
  createLaunchAuditRow,
  type AuditIndexes,
  receivingContext,
  verifyAuditSources,
} from './launch-audit-shared.ts';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { launchAuthority as authority } from './launch-inventory-authority.ts';
import {
  launchManifestSchema,
  type LaunchManifest,
  type LaunchRow,
} from './launch-inventory-schema.ts';
import { launchInventoryHash } from './launch-inventory.ts';
import { type LaunchSourcePaths } from './launch-inventory-sources.ts';

const data: unknown = parseLaunchInventoryDocument(
  JSON.parse(
    readFileSync(
      new URL('./scopes/campaign-mvp-v1.core.json', import.meta.url),
      'utf8',
    ),
  ),
);

export const coreAudit = z
  .strictObject({
    version: z.literal(1),
    contracts: launchManifestSchema.shape.semanticContracts,
    contexts: launchManifestSchema.shape.semanticContexts,
    edges: launchManifestSchema.shape.edges,
    citations: launchManifestSchema.shape.edges,
    requiredKeys: z.array(z.string()),
    pools: z.array(
      launchManifestSchema.shape.pools.element.omit({ membersSha256: true }),
    ),
    accounting: launchManifestSchema.shape.sourceAccounting,
    findings: z
      .array(
        z.strictObject({
          id: z.string().regex(/^C(?:0[1-9]|[12][0-9]|3[0-2])$/),
          status: z.enum([
            'incorporated at inventory boundary',
            'identity/output follow-on required',
          ]),
          contracts: z.array(z.string()).min(1),
        }),
      )
      .length(32),
  })
  .parse(data);

const auditHash = launchInventoryHash(coreAudit);
const accountingHash = launchInventoryHash(coreAudit.accounting);
const expectedContracts = coreAudit.contracts.map((contract) => ({
  contract,
  hash: launchInventoryHash(contract),
  mechanismHash: launchInventoryHash(auditMechanism({ contract })),
}));
const contextEdges = coreAudit.contracts
  .filter(
    (contract) =>
      contract.scope === 'required' && contract.from !== contract.root,
  )
  .map((contract) => receivingContext({ contract }));
const expectedEdges = [
  ...coreAudit.edges,
  ...coreAudit.citations,
  ...contextEdges,
].map((edge) => ({
  edge,
  hash: launchInventoryHash(edge),
}));
const expectedPools = coreAudit.pools.map((pool) => ({
  pool,
  hash: launchInventoryHash({
    ...pool,
    membersSha256: launchInventoryHash(pool.members),
  }),
}));

export function coreCoverage(): LaunchManifest['coverage'] {
  const contracts = new Map(
    coreAudit.contracts.map((contract) => [contract.id, contract]),
  );
  return coreAudit.findings.map((finding) => {
    const entries = finding.contracts.map((id) => {
      const contract = contracts.get(id);
      if (!contract)
        throw new Error(`Missing ${finding.id} source contract ${id}.`);
      return contract;
    });
    return {
      contract: `#768 core/shared ${finding.id}`,
      disposition: 'launch work',
      keys: finding.contracts,
      owners: [
        ...new Map(
          entries
            .flatMap((entry) => [
              entry.implementationOwner,
              entry.publicTestOwner,
            ])
            .map((owner) => [owner.issue, owner]),
        ).values(),
      ],
      mechanisms: [
        finding.status,
        'Inventory incorporation preserves downstream source integration, numeric mechanics, saved choices and public saved-sheet qualification as outstanding.',
      ],
      evidence: [
        ...new Set(
          entries.flatMap(({ sources }) =>
            sources.map(({ locator }) => locator),
          ),
        ),
      ],
    };
  });
}

export async function inventoryCore({
  paths,
  repoRoot,
  rows,
  pools,
  includeKey,
  addEdge,
}: {
  paths: LaunchSourcePaths;
  repoRoot: string;
  rows: Map<string, LaunchRow>;
  pools: LaunchManifest['pools'];
  includeKey: (key: string) => LaunchRow | undefined;
  addEdge: (edge: LaunchManifest['edges'][number]) => void;
}) {
  await verifyAuditSources({
    paths,
    repoRoot,
    sources: [
      ...coreAudit.contracts,
      ...coreAudit.accounting,
      ...coreAudit.pools,
    ].flatMap(({ sources }) => sources),
  });
  for (const contract of coreAudit.contracts) {
    for (const key of [contract.from, ...contract.targets]) includeKey(key);
    rows.set(contract.id, createLaunchAuditRow({ contract, family: 'core' }));
    if (contract.scope === 'required' && contract.from !== contract.root)
      addEdge(receivingContext({ contract }));
  }
  for (const edge of coreAudit.edges) addEdge(edge);
  for (const edge of coreAudit.citations) addEdge(edge);
  for (const pool of coreAudit.pools) {
    pools.push({ ...pool, membersSha256: launchInventoryHash(pool.members) });
    for (const key of pool.members)
      addEdge({
        from: pool.root,
        to: key,
        kind: 'option',
        reason: `Exact printed membership: ${pool.name}`,
        condition: pool.selector,
        evidence: pool.sources.map(({ locator }) => locator),
      });
  }
}

export function checkCoreAudit(
  manifest: LaunchManifest,
  fail: (code: string, key: string, reason: string) => void,
  indexes: AuditIndexes = createAuditIndexes({ manifest }),
) {
  if (
    !('coreAuditSha256' in authority) ||
    authority.coreAuditSha256 !== auditHash
  )
    fail(
      'core-authority',
      manifest.scopeVersion,
      'Core source contracts differ from the versioned authority.',
    );
  if (
    launchInventoryHash(manifest.semanticContexts) !==
    launchInventoryHash(coreAudit.contexts)
  )
    fail(
      'core-context',
      manifest.scopeVersion,
      'Receiving class/loan contexts must preserve actual source grant restrictions.',
    );
  const { rows, pools, contracts, edges } = indexes;
  for (const { key, issue, locator } of [
    {
      key: 'pf1-content/f3r6wtifa8bXlcJG',
      issue: 356,
      locator: 'src/pf-feats/Underfoot__APG__f3r6wtifa8bXlcJG.yaml',
    },
    {
      key: 'pf1/7ZiUSYUV1zRqgkrf',
      issue: 609,
      locator: 'packs/class-abilities/aura-of-repitition.7ZiUSYUV1zRqgkrf.yaml',
    },
  ]) {
    const row = rows.get(key);
    const source = coreAudit.contracts
      .flatMap(({ sources }) => sources)
      .find((source) => source.locator === locator);
    if (
      !source ||
      !row?.sources.some(
        (binding) =>
          launchInventoryHash(binding) === launchInventoryHash(source),
      )
    )
      fail(
        'core-source',
        key,
        'The exact existing playable output must retain its pinned native body binding.',
      );
    if (
      row?.inventoryOwner.issue !== issue ||
      row.publicTestOwner.issue !== issue
    )
      fail(
        'core-owner',
        key,
        'Existing playable output retains its original inventory and public body-test owner.',
      );
  }
  const coverage = indexes.coverage;
  for (const entry of coreCoverage())
    if (!coverage.has(launchInventoryHash(entry)))
      fail(
        'core-coverage',
        entry.contract,
        'Every core finding and its actual implementation/public-test owners must remain dispositioned.',
      );
  if (
    launchInventoryHash(
      manifest.sourceAccounting.filter(({ id }) => !id.startsWith('advanced/')),
    ) !== accountingHash
  )
    fail(
      'core-accounting',
      manifest.scopeVersion,
      'Exact native definitions, parameters, helpers and original remainders must remain individually accounted.',
    );
  for (const { pool, hash } of expectedPools)
    if (!pools.has(hash))
      fail(
        'core-pool',
        pool.root,
        `Exact eligibility, source bindings and remainder of ${pool.name} must survive.`,
      );
  for (const key of coreAudit.requiredKeys)
    if (rows.get(key)?.requirement !== 'required')
      fail(
        'core-required',
        key,
        'Missing exact source-backed core requirement and original ownership.',
      );
  for (const { contract, hash, mechanismHash } of expectedContracts) {
    if (!contracts.has(hash))
      fail(
        'core-contract',
        contract.id,
        `Missing or changed source-bound ${contract.channel} contract.`,
      );
    if (
      !rows
        .get(contract.id)
        ?.mechanisms.some(
          (entry) => launchInventoryHash(entry) === mechanismHash,
        )
    )
      fail(
        'core-mechanism',
        contract.id,
        `Missing downstream ${contract.name} implementation/test contract.`,
      );
    const row = rows.get(contract.id);
    if (contract.scope === 'required' && row?.requirement !== 'required')
      fail(
        'core-required',
        contract.id,
        'A required source-owned contract cannot be demoted to optional.',
      );
    if (
      contract.qualification === 'policy excluded' &&
      row?.requirement === 'required'
    )
      fail(
        'core-policy-conflict',
        contract.id,
        'This actual required incoming path conflicts with the existing excluded goods/service or general-template policy. Its source/output owner must resolve that bounded conflict before reliance.',
      );
    if (row?.catalogKey !== null)
      fail(
        'core-source-identity',
        contract.id,
        'A source requirement is distinct from a playable catalog identity.',
      );
    if (
      row?.implementationOwner.issue !== contract.implementationOwner.issue ||
      row.publicTestOwner.issue !== contract.publicTestOwner.issue
    )
      fail(
        'core-owner',
        contract.id,
        'Exact downstream implementation/public-test owners must survive.',
      );
    const bindings = new Set(row?.sources.map(launchInventoryHash));
    for (const source of contract.sources)
      if (!bindings.has(launchInventoryHash(source)))
        fail(
          'core-source',
          contract.id,
          `Missing literal source binding ${source.locator}.`,
        );
    if (
      contract.qualification === 'held discrepancy' &&
      !row?.holds.some(
        ({ reason, owner }) =>
          owner.issue === 736 &&
          reason === `Unresolved source discrepancy: ${contract.contract}`,
      )
    )
      fail(
        'core-source-hold',
        contract.id,
        'Source differences require an explicit hold before reliance.',
      );
    if (
      contract.identity.kind === 'source-owned' &&
      contract.identity.allocation === 'required'
    )
      fail(
        'core-playable-identity',
        contract.id,
        'Required playable identity and original playable batch owner remain unallocated; source-owned requirement does not certify either.',
      );
    if (
      contract.identity.kind === 'source-owned' &&
      contract.identity.allocation === 'output unresolved'
    )
      fail(
        'core-output-shape',
        contract.id,
        'Native definition lacks a resolved playable key or source-bound parent/parameter output and original output owner. Resolve its exact shape within the existing excluded goods/service policy; this does not authorize a new item for each native row.',
      );
  }
  for (const { edge, hash } of expectedEdges)
    if (!edges.has(hash))
      fail('core-semantic-edge', edge.to, `${edge.reason} (${edge.from}).`);
}
