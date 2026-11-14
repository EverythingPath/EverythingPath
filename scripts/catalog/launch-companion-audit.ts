import { parseLaunchInventoryDocument } from './launch-inventory-document.ts';
import {
  createAuditIndexes,
  type AuditIndexes,
} from './launch-audit-shared.ts';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { launchAuthority as authority } from './launch-inventory-authority.ts';
import {
  companionPartitionSchema,
  launchBindingSchema,
  launchManifestSchema,
  type LaunchManifest,
  type LaunchRow,
  type LaunchBinding,
} from './launch-inventory-schema.ts';
import { launchInventoryHash } from './launch-inventory.ts';
import { launchOwner } from './launch-inventory-coverage.ts';
import {
  sourceHash,
  sourceKey,
  type LaunchSourcePaths,
  type LaunchSourceRecord,
} from './launch-inventory-sources.ts';

const data: unknown = parseLaunchInventoryDocument(
  JSON.parse(
    readFileSync(
      new URL('./scopes/campaign-mvp-v1.companions.json', import.meta.url),
      'utf8',
    ),
  ),
);

const contract = z.strictObject({
  key: z.string().min(1),
  name: z.string().min(1),
  contract: z.string().min(1),
  sources: z.array(launchBindingSchema).min(1),
  implementationIssue: z.number().int().positive(),
  publicTestIssue: z.number().int().positive(),
  supportingIssues: z.array(z.number().int().positive()).optional(),
  publicTest: z.string().min(1).optional(),
  disposition: z.enum(['calculated', 'recorded choice']),
});
const discrepancy = z.strictObject({
  key: z.string().min(1),
  reason: z.string().min(1),
  ownerIssue: z.number().int().positive(),
  sources: z.array(launchBindingSchema).min(1),
});

const recordedAudit = z
  .strictObject({
    version: z.literal(1),
    partitions: z.array(companionPartitionSchema),
    contracts: z.array(contract),
    mechanics: z.array(contract),
    discrepancies: z.array(discrepancy),
    edges: launchManifestSchema.shape.edges,
  })
  .parse(data);

// The frozen companion evidence contains whole-file PCGen observations, never
// compiled effective records. Preserve its bytes and expose that distinction.
function comparisonSources(sources: LaunchBinding[]) {
  return sources.map((source) =>
    source.repository === 'pcgen'
      ? { ...source, rawFileSha256: source.rawSha256, effectiveSha256: null }
      : source,
  );
}

export const companionAudit = {
  ...recordedAudit,
  partitions: recordedAudit.partitions.map((partition) => ({
    ...partition,
    sources: comparisonSources(partition.sources),
    entries: partition.entries.map((entry) => ({
      ...entry,
      sources: comparisonSources(entry.sources),
    })),
  })),
  contracts: recordedAudit.contracts.map((entry) => ({
    ...entry,
    sources: comparisonSources(entry.sources),
  })),
  mechanics: recordedAudit.mechanics.map((entry) => ({
    ...entry,
    sources: comparisonSources(entry.sources),
  })),
  discrepancies: recordedAudit.discrepancies.map((entry) => ({
    ...entry,
    sources: comparisonSources(entry.sources),
  })),
};

function mechanismOf(entry: z.infer<typeof contract>) {
  return {
    name: entry.name,
    contract: entry.contract,
    disposition: entry.disposition,
    status: 'outstanding' as const,
    evidence: entry.sources.map(
      ({ repository, locator, rawSha256 }) =>
        `${repository}:${locator} sha256:${rawSha256}`,
    ),
  };
}

export function companionCoverage(): LaunchManifest['coverage'] {
  return [...companionAudit.contracts, ...companionAudit.mechanics]
    .filter((entry) => entry.publicTest)
    .map((entry) => ({
      contract: `#768 companion ${entry.key}: ${entry.name}`,
      disposition: 'launch work',
      owners: [
        ...new Set([
          entry.implementationIssue,
          entry.publicTestIssue,
          ...(entry.supportingIssues ?? []),
        ]),
      ].map((issue) =>
        launchOwner(issue, entry.name, mechanismOf(entry).evidence),
      ),
      keys: [entry.key],
      mechanisms: [entry.contract, `Public qualification: ${entry.publicTest}`],
      evidence: mechanismOf(entry).evidence,
    }));
}

/** Exact eligibility is independent of raw links, embedded copies and admission. */
export async function inventoryCompanions({
  paths,
  records,
  rows,
  pools,
  includeSource,
  addEdge,
}: {
  paths: LaunchSourcePaths;
  records: LaunchSourceRecord[];
  rows: Map<string, LaunchRow>;
  pools: LaunchManifest['pools'];
  includeSource: (source: LaunchSourceRecord) => LaunchRow;
  addEdge: (edge: LaunchManifest['edges'][number]) => void;
}) {
  const bindings = [
    ...companionAudit.partitions.flatMap((partition) => [
      ...partition.sources,
      ...partition.entries.flatMap(({ sources }) => sources),
    ]),
    ...companionAudit.contracts.flatMap(({ sources }) => sources),
    ...companionAudit.mechanics.flatMap(({ sources }) => sources),
    ...companionAudit.discrepancies.flatMap(({ sources }) => sources),
  ];
  const bytes = new Map<string, string>();
  for (const source of bindings) {
    if (source.repository === 'everythingpath')
      throw new Error('Companion source audits require pinned rule bodies.');
    const path = join(
      paths[source.repository],
      source.locator.split('#')[0] ?? '',
    );
    const hash = bytes.get(path) ?? sourceHash(await readFile(path));
    bytes.set(path, hash);
    if (
      source.rawSha256 !== hash ||
      source.effectiveSha256 !== (source.repository === 'pcgen' ? null : hash)
    )
      throw new Error(`Stale companion source audit: ${source.locator}.`);
  }
  const raw = new Map(records.map((source) => [sourceKey(source), source]));
  for (const partition of companionAudit.partitions) {
    const members = partition.entries
      .filter(({ eligibility }) => eligibility !== 'remainder')
      .map(({ key, sources }) => {
        const source = raw.get(key);
        if (!source)
          throw new Error(`Missing companion inventory source ${key}.`);
        const row = includeSource(source);
        for (const binding of sources)
          if (
            !row.sources.some(
              (existing) =>
                launchInventoryHash(existing) === launchInventoryHash(binding),
            )
          )
            row.sources.push(binding);
        return key;
      })
      .sort();
    pools.push({
      id: `${partition.root}:${partition.name}`,
      root: partition.root,
      name: partition.name,
      selector: `Exact source-backed ${partition.id} eligibility; conditional members retain their feat, class, level, form and alignment restrictions.`,
      purpose: 'eligibility',
      sources: partition.sources,
      members,
      membersSha256: launchInventoryHash(members),
      remainder: partition.entries
        .filter(({ eligibility }) => eligibility === 'remainder')
        .map(({ key, reason }) => ({ locator: key, reason })),
      research: [],
    });
  }
  for (const entry of companionAudit.contracts) {
    const evidence = mechanismOf(entry).evidence;
    const owner = launchOwner(entry.implementationIssue, entry.name, evidence);
    const observation = { state: 'unreviewed' as const, evidence };
    rows.set(entry.key, {
      key: entry.key,
      catalogKey: null,
      kind: 'rule',
      name: entry.name,
      requirement: 'required',
      sources: entry.sources,
      inventoryOwner: launchOwner(
        768,
        'Source-only companion semantic inventory',
        evidence,
      ),
      implementationOwner: owner,
      publicTestOwner: launchOwner(
        entry.publicTestIssue,
        'Public companion saved-sheet qualification',
        evidence,
      ),
      mechanisms: [mechanismOf(entry)],
      admission: observation,
      structure: observation,
      contentEvidence: observation,
      noticeEvidence: observation,
      holds: [
        {
          owner,
          reason:
            'Source-only companion mechanics need implementation and public saved-sheet proof; inventory does not admit a catalog record.',
        },
      ],
      research: [],
    });
  }
  for (const entry of companionAudit.mechanics) {
    const source = raw.get(entry.key);
    const row =
      rows.get(entry.key) ?? (source ? includeSource(source) : undefined);
    if (!row)
      throw new Error(`Missing required companion mechanic ${entry.key}.`);
    for (const binding of entry.sources)
      if (
        !row.sources.some(
          (existing) =>
            launchInventoryHash(existing) === launchInventoryHash(binding),
        )
      )
        row.sources.push(binding);
    row.mechanisms.push(mechanismOf(entry));
    row.implementationOwner = launchOwner(
      entry.implementationIssue,
      entry.name,
      mechanismOf(entry).evidence,
    );
    row.publicTestOwner = launchOwner(
      entry.publicTestIssue,
      'Public companion saved-sheet qualification',
      mechanismOf(entry).evidence,
    );
  }
  for (const entry of companionAudit.discrepancies) {
    const row = rows.get(entry.key);
    if (!row) throw new Error(`Missing companion discrepancy ${entry.key}.`);
    row.holds.push({
      owner: launchOwner(
        entry.ownerIssue,
        'Pinned companion source discrepancy before reliance',
        entry.sources.map(({ locator }) => locator),
      ),
      reason: entry.reason,
    });
  }
  for (const edge of companionAudit.edges) {
    for (const key of [edge.from, edge.to]) {
      const source = raw.get(key);
      if (source && !rows.has(key)) includeSource(source);
    }
    addEdge(edge);
  }
}

export function checkCompanionAudit(
  manifest: LaunchManifest,
  fail: (code: string, key: string, reason: string) => void,
  indexes: AuditIndexes = createAuditIndexes({ manifest }),
) {
  if (authority.companionAuditSha256 !== launchInventoryHash(companionAudit))
    fail(
      'companion-authority',
      manifest.scopeVersion,
      'Companion audit differs from the versioned source authority.',
    );
  if (
    launchInventoryHash(manifest.companionPartitions) !==
    launchInventoryHash(companionAudit.partitions)
  )
    fail(
      'companion-partition',
      manifest.scopeVersion,
      'Exact companion eligibility and remainder decisions differ from the pinned source audit.',
    );
  const edges = indexes.edges;
  for (const edge of companionAudit.edges)
    if (!edges.has(launchInventoryHash(edge)))
      fail('companion-semantic-edge', edge.to, `${edge.reason} (${edge.from})`);
  const rows = indexes.rows;
  for (const partition of companionAudit.partitions) {
    const pool = manifest.pools.find(
      ({ id }) => id === `${partition.root}:${partition.name}`,
    );
    const remainder = partition.entries
      .filter(({ eligibility }) => eligibility === 'remainder')
      .map(({ key, reason }) => ({ locator: key, reason }));
    if (
      !pool ||
      launchInventoryHash(pool.remainder) !== launchInventoryHash(remainder)
    )
      fail(
        'companion-remainder',
        partition.root,
        `The complete original remainder of ${partition.name} is required.`,
      );
    for (const entry of partition.entries)
      if (
        !manifest.batches.some(({ originalInventory }) =>
          originalInventory.includes(entry.key),
        )
      )
        fail(
          'companion-owner-inventory',
          entry.key,
          'The original companion batch and its complete required/optional/remainder partition must survive.',
        );
  }
  for (const entry of [
    ...companionAudit.contracts,
    ...companionAudit.mechanics,
  ]) {
    const row = rows.get(entry.key);
    if (
      !row?.mechanisms.some(
        (mechanism) =>
          launchInventoryHash(mechanism) ===
          launchInventoryHash(mechanismOf(entry)),
      )
    )
      fail(
        'companion-mechanism',
        entry.key,
        `Missing source-backed mechanic: ${entry.name}.`,
      );
    if (
      row?.implementationOwner.issue !== entry.implementationIssue ||
      row?.publicTestOwner.issue !== entry.publicTestIssue
    )
      fail(
        'companion-owner',
        entry.key,
        'Required companion implementation and public-test ownership must survive.',
      );
    for (const binding of entry.sources)
      if (
        !row?.sources.some(
          (source) =>
            launchInventoryHash(source) === launchInventoryHash(binding),
        )
      )
        fail(
          'companion-source',
          entry.key,
          `Missing audited source binding ${binding.locator}.`,
        );
  }
  for (const entry of companionAudit.discrepancies)
    if (
      !rows
        .get(entry.key)
        ?.holds.some(
          ({ owner, reason }) =>
            owner.issue === entry.ownerIssue && reason === entry.reason,
        )
    )
      fail('companion-source-hold', entry.key, entry.reason);
  const coverage = indexes.coverage;
  for (const row of companionCoverage())
    if (!coverage.has(launchInventoryHash(row)))
      fail(
        'companion-coverage',
        row.keys[0] ?? manifest.scopeVersion,
        'Companion class-side contracts and all actual downstream owners must survive.',
      );
}
