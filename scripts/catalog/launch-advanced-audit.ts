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
      new URL('./scopes/campaign-mvp-v1.advanced.json', import.meta.url),
      'utf8',
    ),
  ),
);

export const advancedAudit = z
  .strictObject({
    version: z.literal(1),
    contracts: launchManifestSchema.shape.semanticContracts,
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
          id: z.string().regex(/^[ACIOWBLMUEXS][1-4]$/),
          status: z.enum([
            'incorporated at inventory boundary',
            'identity/output follow-on required',
          ]),
          contracts: z.array(z.string()).min(1),
        }),
      )
      .length(33),
  })
  .parse(data);

const auditHash = launchInventoryHash(advancedAudit);
const accountingHash = launchInventoryHash(advancedAudit.accounting);
const expectedContracts = advancedAudit.contracts.map((contract) => ({
  contract,
  hash: launchInventoryHash(contract),
  mechanismHash: launchInventoryHash(auditMechanism({ contract })),
}));
const contextEdges = advancedAudit.contracts
  .filter(
    (contract) =>
      contract.scope === 'required' && contract.from !== contract.root,
  )
  .map((contract) => receivingContext({ contract }));
const expectedEdges = [
  ...advancedAudit.edges,
  ...advancedAudit.citations,
  ...contextEdges,
].map((edge) => ({
  edge,
  hash: launchInventoryHash(edge),
}));
const expectedPools = advancedAudit.pools.map((pool) => ({
  pool,
  hash: launchInventoryHash({
    ...pool,
    membersSha256: launchInventoryHash(pool.members),
  }),
}));

export function advancedCoverage(): LaunchManifest['coverage'] {
  const contracts = new Map(
    advancedAudit.contracts.map((contract) => [contract.id, contract]),
  );
  return advancedAudit.findings.map((finding) => {
    const entries = finding.contracts.map((id) => {
      const contract = contracts.get(id);
      if (!contract)
        throw new Error(`Missing ${finding.id} source contract ${id}.`);
      return contract;
    });
    return {
      contract: `#768 advanced/shared ${finding.id}`,
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

export async function inventoryAdvanced({
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
      ...advancedAudit.contracts,
      ...advancedAudit.accounting,
      ...advancedAudit.pools,
    ].flatMap(({ sources }) => sources),
  });
  for (const contract of advancedAudit.contracts) {
    for (const key of [contract.from, ...contract.targets]) includeKey(key);
    rows.set(
      contract.id,
      createLaunchAuditRow({ contract, family: 'advanced' }),
    );
    if (contract.scope === 'required' && contract.from !== contract.root)
      addEdge(receivingContext({ contract }));
  }
  for (const edge of advancedAudit.edges) addEdge(edge);
  for (const edge of advancedAudit.citations) addEdge(edge);
  for (const pool of advancedAudit.pools) {
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

export function checkAdvancedAudit(
  manifest: LaunchManifest,
  fail: (code: string, key: string, reason: string) => void,
  indexes: AuditIndexes = createAuditIndexes({ manifest }),
) {
  if (
    !('advancedAuditSha256' in authority) ||
    authority.advancedAuditSha256 !== auditHash
  )
    fail(
      'advanced-authority',
      manifest.scopeVersion,
      'Advanced source contracts differ from the versioned authority.',
    );
  const { rows, pools, contracts, edges } = indexes;
  const coverage = indexes.coverage;
  for (const entry of advancedCoverage())
    if (!coverage.has(launchInventoryHash(entry)))
      fail(
        'advanced-coverage',
        entry.contract,
        'Every advanced finding and its actual implementation/public-test owners must remain dispositioned.',
      );
  if (
    launchInventoryHash(
      manifest.sourceAccounting.filter(({ id }) => id.startsWith('advanced/')),
    ) !== accountingHash
  )
    fail(
      'advanced-accounting',
      manifest.scopeVersion,
      'Exact native definitions, parameters, helpers and original remainders must remain individually accounted.',
    );
  for (const { pool, hash } of expectedPools)
    if (!pools.has(hash))
      fail(
        'advanced-pool',
        pool.root,
        `Exact eligibility, source bindings and remainder of ${pool.name} must survive.`,
      );
  for (const key of advancedAudit.requiredKeys)
    if (rows.get(key)?.requirement !== 'required')
      fail(
        'advanced-required',
        key,
        'Missing exact source-backed advanced requirement and original ownership.',
      );
  for (const { contract, hash, mechanismHash } of expectedContracts) {
    if (!contracts.has(hash))
      fail(
        'advanced-contract',
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
        'advanced-mechanism',
        contract.id,
        `Missing downstream ${contract.name} implementation/test contract.`,
      );
    const row = rows.get(contract.id);
    if (contract.scope === 'required' && row?.requirement !== 'required')
      fail(
        'advanced-required',
        contract.id,
        'A required source-owned contract cannot be demoted to optional.',
      );
    if (
      contract.qualification === 'policy excluded' &&
      row?.requirement === 'required'
    )
      fail(
        'advanced-policy-conflict',
        contract.id,
        'This actual required incoming path conflicts with the existing excluded goods/service or general-template policy. Its source/output owner must resolve that bounded conflict before reliance.',
      );
    if (row?.catalogKey !== null)
      fail(
        'advanced-source-identity',
        contract.id,
        'A source requirement is distinct from a playable catalog identity.',
      );
    if (
      row?.implementationOwner.issue !== contract.implementationOwner.issue ||
      row.publicTestOwner.issue !== contract.publicTestOwner.issue
    )
      fail(
        'advanced-owner',
        contract.id,
        'Exact downstream implementation/public-test owners must survive.',
      );
    const bindings = new Set(row?.sources.map(launchInventoryHash));
    for (const source of contract.sources)
      if (!bindings.has(launchInventoryHash(source)))
        fail(
          'advanced-source',
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
        'advanced-source-hold',
        contract.id,
        'Source differences require an explicit hold before reliance.',
      );
    if (
      contract.identity.kind === 'source-owned' &&
      contract.identity.allocation === 'required'
    )
      fail(
        'advanced-playable-identity',
        contract.id,
        'Required playable identity and original playable batch owner remain unallocated; source-owned requirement does not certify either.',
      );
    if (
      contract.identity.kind === 'source-owned' &&
      contract.identity.allocation === 'output unresolved'
    )
      fail(
        'advanced-output-shape',
        contract.id,
        'Native definition lacks a resolved playable key or source-bound parent/parameter output and original output owner. Resolve its exact shape within the existing excluded goods/service policy; this does not authorize a new item for each native row.',
      );
  }
  for (const { edge, hash } of expectedEdges)
    if (!edges.has(hash))
      fail('advanced-semantic-edge', edge.to, `${edge.reason} (${edge.from}).`);
}
