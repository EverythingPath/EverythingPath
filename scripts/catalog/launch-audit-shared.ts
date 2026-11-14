import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  LaunchBinding,
  LaunchManifest,
} from './launch-inventory-schema.ts';
import { launchAuthority as authority } from './launch-inventory-authority.ts';
import {
  sourceHash,
  type LaunchSourcePaths,
} from './launch-inventory-sources.ts';
import { launchInventoryHash } from './launch-inventory.ts';

type Contract = LaunchManifest['semanticContracts'][number];

export {
  auditMechanism,
  createLaunchAuditRow,
} from './launch-inventory-document.ts';

export function receivingContext({
  contract,
}: {
  contract: Contract;
}): LaunchManifest['edges'][number] {
  return {
    from: contract.root,
    to: contract.from,
    kind: 'requirement',
    reason: `Source-bound receiving context: ${contract.channel}`,
    condition: `Apply the exact source conditions in ${contract.id}; this context does not waive prerequisites or grant an entire borrowed progression.`,
    evidence: contract.sources.map(({ locator }) => locator),
  };
}

/** Literal comparisons retain whole-file and LF/CRLF-stripped line domains; no compiled MOD identity is inferred. */
export async function verifyAuditSources({
  paths,
  repoRoot,
  sources,
}: {
  paths: LaunchSourcePaths;
  repoRoot: string;
  sources: readonly LaunchBinding[];
}) {
  const files = new Map<string, { hash: string; lines: string[] }>();
  const seen = new Set<string>();
  for (const source of sources) {
    const signature = launchInventoryHash(source);
    if (seen.has(signature)) continue;
    seen.add(signature);
    if (
      source.repository === 'everythingpath' &&
      (source.locator !== 'docs/character-sheet/companions.md' ||
        source.pin !== authority.baseline)
    )
      throw new Error(`Unrecognized product policy source ${source.locator}.`);
    const locator = source.locator.split('#')[0] ?? '';
    const [relative = '', line] = locator.split(':');
    if (
      !relative ||
      relative.startsWith('/') ||
      relative.split('/').includes('..')
    )
      throw new Error(`Unsafe audit source ${source.locator}.`);
    const path = join(
      source.repository === 'everythingpath'
        ? repoRoot
        : paths[source.repository],
      relative,
    );
    let file = files.get(path);
    if (!file) {
      const bytes = await readFile(path);
      file = {
        hash: sourceHash(bytes),
        lines: bytes.toString('utf8').split(/\r?\n/),
      };
      files.set(path, file);
    }
    if (!source.rawFileSha256) {
      if (
        file.hash !== source.rawSha256 ||
        file.hash !== source.effectiveSha256 ||
        source.rawLineSha256
      )
        throw new Error(`Stale whole-file audit source ${source.locator}.`);
      continue;
    }
    const literal = file.lines[Number(line) - 1];
    if (
      source.repository !== 'pcgen' ||
      file.hash !== source.rawFileSha256 ||
      source.effectiveSha256 !== null ||
      (source.rawLineSha256
        ? literal === undefined ||
          sourceHash(literal) !== source.rawLineSha256 ||
          source.rawSha256 !== source.rawLineSha256
        : source.rawSha256 !== file.hash)
    )
      throw new Error(`Stale literal audit source ${source.locator}.`);
  }
}

/** Per-inspection indexes: submitted mutations are always rehashed on the next call. */
export function createAuditIndexes({
  manifest,
  rows = new Map(manifest.rows.map((row) => [row.key, row])),
}: {
  manifest: LaunchManifest;
  rows?: Map<string, LaunchManifest['rows'][number]>;
}) {
  const edges = manifest.edges.map((edge) => ({
    edge,
    hash: launchInventoryHash(edge),
  }));
  return {
    rows,
    pools: new Set(manifest.pools.map(launchInventoryHash)),
    contracts: new Set(manifest.semanticContracts.map(launchInventoryHash)),
    coverage: new Set(manifest.coverage.map(launchInventoryHash)),
    edges: new Set(edges.map(({ hash }) => hash)),
    mechanicalEdges: edges
      .filter(
        ({ edge }) => !['citation', 'notice', 'resource'].includes(edge.kind),
      )
      .map(({ hash }) => hash),
  };
}

export type AuditIndexes = ReturnType<typeof createAuditIndexes>;
