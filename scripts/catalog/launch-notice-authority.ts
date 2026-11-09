import { readdir, readFile } from 'node:fs/promises';
import { parseLaunchInventoryDocument } from './launch-inventory-document.ts';
import { join } from 'node:path';
import { z } from 'zod';
import {
  launchManifestSchema,
  launchRowSchema,
  semanticContractSchema,
  type LaunchManifest,
} from './launch-inventory-schema.ts';
import { sourceHash } from './launch-inventory-sources.ts';
import { launchInventoryHash } from './launch-inventory.ts';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const noticeAuthoritySchema = z.strictObject({
  version: z.literal(1),
  scopeVersion: z.literal('campaign-mvp-v1'),
  scopeSha256: hash,
  inputs: z
    .array(z.strictObject({ locator: z.string().min(1), sha256: hash }))
    .min(1),
  notices: z.array(launchRowSchema).min(1),
  edges: launchManifestSchema.shape.edges,
  coverage: z.array(
    launchManifestSchema.shape.coverage.element.pick({
      contract: true,
      keys: true,
    }),
  ),
  pathGraph: z.strictObject({
    roots: launchManifestSchema.shape.roots,
    rows: z.array(launchRowSchema.pick({ key: true, kind: true })),
    edges: z.array(
      launchManifestSchema.shape.edges.element.omit({ evidence: true }),
    ),
    semanticContracts: z.array(
      semanticContractSchema.pick({
        id: true,
        from: true,
        targets: true,
        excludedContexts: true,
      }),
    ),
    semanticContexts: launchManifestSchema.shape.semanticContexts,
  }),
});

function noticePathGraph(manifest: LaunchManifest) {
  return {
    roots: manifest.roots,
    rows: manifest.rows.map(({ key, kind }) => ({ key, kind })),
    edges: manifest.edges
      .filter(({ kind }) => kind !== 'citation' && kind !== 'resource')
      .map(({ evidence: _evidence, ...edge }) => edge),
    semanticContracts: manifest.semanticContracts.map(
      ({ id, from, targets, excludedContexts }) => ({
        id,
        from,
        targets,
        excludedContexts,
      }),
    ),
    semanticContexts: manifest.semanticContexts,
  };
}

/** Bind the actual source-backed scope, excluding notice rows/edges so their omission cannot erase expectations. */
export function launchNoticeScopeHash(
  manifest: LaunchManifest,
  mechanicalEdges?: readonly string[],
) {
  return launchInventoryHash({
    roots: manifest.roots,
    rows: manifest.rows
      .filter(({ kind }) => kind !== 'notice')
      .map(({ key, kind, requirement, sources }) => ({
        key,
        kind,
        requirement,
        sources,
      })),
    edges:
      mechanicalEdges ??
      manifest.edges
        .filter(
          ({ kind }) => !['citation', 'notice', 'resource'].includes(kind),
        )
        .map(launchInventoryHash),
    semanticContexts: manifest.semanticContexts,
    semanticContracts: manifest.semanticContracts.map(
      ({ id, from, targets, excludedContexts }) => ({
        id,
        from,
        targets,
        excludedContexts,
      }),
    ),
    pools: manifest.pools.map(({ id, root, members, purpose }) => ({
      id,
      root,
      members,
      purpose,
    })),
  });
}

function reproduceAuditBytes(bytes: Buffer) {
  const value = parseLaunchInventoryDocument(
    JSON.parse(bytes.toString('utf8')),
  );
  const json = JSON.stringify(value, null, 2).replace(
    /[\u007f-\uffff]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  return `${json}\n`;
}

async function readLaunchNoticeInputs({ repoRoot }: { repoRoot: string }) {
  const legal = (await readdir(join(repoRoot, 'scripts/catalog/legal')))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => `scripts/catalog/legal/${file}`);
  const locators = [
    ...legal,
    'src/lib/catalog/data/section15-registry.json',
    'src/lib/catalog/data/resources.json',
    'scripts/catalog/scopes/campaign-mvp-v1.companions.json',
    'scripts/catalog/scopes/campaign-mvp-v1.core.json',
    'scripts/catalog/scopes/campaign-mvp-v1.advanced.json',
    'scripts/catalog/launch-inventory-build.ts',
    'scripts/catalog/launch-inventory-sources.ts',
    'scripts/catalog/inventory.ts',
  ];
  const inputs: z.infer<typeof noticeAuthoritySchema>['inputs'] = [];
  for (const locator of locators) {
    const bytes = await readFile(join(repoRoot, locator));
    // These existing commitments describe the expanded audit bytes, independent
    // of shared storage. Other inputs remain literal file-byte commitments.
    const expanded = locator.startsWith('scripts/catalog/scopes/')
      ? reproduceAuditBytes(bytes)
      : bytes;
    inputs.push({ locator, sha256: sourceHash(expanded) });
  }
  return inputs;
}

/** Only the pinned-input builder supplies this inventory; never reproduce authority from a submitted document. */
export async function buildLaunchNoticeAuthority({
  inventory,
  repoRoot,
}: {
  inventory: LaunchManifest;
  repoRoot: string;
}) {
  return noticeAuthoritySchema.parse({
    version: 1,
    scopeVersion: inventory.scopeVersion,
    scopeSha256: launchNoticeScopeHash(inventory),
    inputs: await readLaunchNoticeInputs({ repoRoot }),
    notices: inventory.rows.filter(({ kind }) => kind === 'notice'),
    edges: inventory.edges.filter(({ kind }) => kind === 'notice'),
    coverage: inventory.coverage
      .map(({ contract, keys }) => ({
        contract,
        keys: keys.filter((key) => key.startsWith('notice/')),
      }))
      .filter(({ keys }) => keys.length > 0),
    pathGraph: noticePathGraph(inventory),
  });
}
