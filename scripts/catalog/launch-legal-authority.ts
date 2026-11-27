import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { parseLaunchInventoryDocument } from './launch-inventory-document.ts';
import {
  launchBindingSchema,
  type LaunchManifest,
} from './launch-inventory-schema.ts';
import { launchInventoryHash } from './launch-inventory.ts';

/**
 * The launch scope's legal authority (`catalog:launch-legal-authority`): the
 * one fact the authority document binds from a fresh pinned build, its
 * Section 15 Registry resource binding. A reviewed Registry change (an alias,
 * a notice) moves it; every other authority field is authored and kept as it
 * is.
 */
export const launchLegalAuthorityFile =
  'scripts/catalog/scopes/campaign-mvp-v1.authority.json';
export const registryResourceKey = 'resource/section15-registry';
export const launchLegalAuthorityWrite =
  'pnpm -s catalog:launch-legal-authority --write';

const legalFieldsSchema = z.looseObject({
  resourceBindings: z.array(
    z.strictObject({ key: z.string(), source: launchBindingSchema }),
  ),
});

/**
 * `authority`, the document as stored expanded from its shared records,
 * rebound to a fresh pinned build: `inventory` is the build, whose Registry
 * row carries the Registry's whole-file binding. Key order is kept, so an
 * unchanged authority reproduces its own bytes.
 */
export function rebindLaunchLegalAuthority({
  authority,
  inventory,
}: {
  authority: unknown;
  inventory: LaunchManifest;
}): unknown {
  const document = z.record(z.string(), z.unknown()).parse(authority);
  const { resourceBindings } = legalFieldsSchema.parse(document);
  const stored = z.array(z.unknown()).parse(document.resourceBindings);
  const [source, ...others] =
    inventory.rows.find(({ key }) => key === registryResourceKey)?.sources ??
    [];
  if (!source || others.length)
    throw new Error(`The build has no single ${registryResourceKey} source.`);
  if (resourceBindings.filter(isRegistry).length !== 1)
    throw new Error(
      `${launchLegalAuthorityFile} has no single ${registryResourceKey} binding.`,
    );
  return {
    ...document,
    resourceBindings: resourceBindings.map((binding, index) =>
      isRegistry(binding) ? { key: binding.key, source } : stored[index],
    ),
  };
}

function isRegistry({ key }: { key: string }) {
  return key === registryResourceKey;
}

/** What in the `committed` authority a fresh build reproduces differently. */
export function staleLaunchLegalAuthority({
  committed,
  reproduced,
}: {
  committed: unknown;
  reproduced: unknown;
}) {
  const registry = (authority: unknown) =>
    launchInventoryHash(
      legalFieldsSchema.parse(authority).resourceBindings.find(isRegistry),
    );
  return registry(committed) === registry(reproduced)
    ? []
    : [
        `${launchLegalAuthorityFile}: the ${registryResourceKey} binding is not the Registry's`,
      ];
}

/** Only the pinned-input builder supplies `inventory`; never a submitted document. */
async function compareLaunchLegalAuthority({
  inventory,
  repoRoot,
}: {
  inventory: LaunchManifest;
  repoRoot: string;
}) {
  const committed = parseLaunchInventoryDocument(
    JSON.parse(
      await readFile(join(repoRoot, launchLegalAuthorityFile), 'utf8'),
    ),
  );
  const reproduced = rebindLaunchLegalAuthority({
    authority: committed,
    inventory,
  });
  return {
    reproduced,
    stale: staleLaunchLegalAuthority({ committed, reproduced }),
  };
}

/** Read-only: throws, naming the stale binding, unless the build reproduces the committed authority. */
export async function checkLaunchLegalAuthority(options: {
  inventory: LaunchManifest;
  repoRoot: string;
}) {
  const { stale } = await compareLaunchLegalAuthority(options);
  if (stale.length)
    throw new Error(
      `The launch legal authority is stale (${stale.join('; ')}): run ${launchLegalAuthorityWrite}, then pnpm -s catalog:launch-inventory --write.`,
    );
}

/**
 * Writes the reproduced authority when it is stale, expanded as
 * `catalog:launch-inventory --write` reads it and then re-compacts it into the
 * shared records; an up-to-date authority is left byte for byte. Returns what
 * was stale.
 */
export async function writeLaunchLegalAuthority(options: {
  inventory: LaunchManifest;
  repoRoot: string;
}) {
  const { reproduced, stale } = await compareLaunchLegalAuthority(options);
  if (stale.length)
    await writeFile(
      join(options.repoRoot, launchLegalAuthorityFile),
      JSON.stringify(reproduced),
    );
  return stale;
}
