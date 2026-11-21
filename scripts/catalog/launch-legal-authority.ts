import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { parseLaunchInventoryDocument } from './launch-inventory-document.ts';
import {
  launchBindingSchema,
  type LaunchManifest,
} from './launch-inventory-schema.ts';
import { launchInventoryHash } from './launch-inventory.ts';
import { buildLaunchNoticeAuthority } from './launch-notice-authority.ts';

/**
 * The launch scope's legal authority (`catalog:launch-legal-authority`): the
 * notice authority (`campaign-mvp-v1.notices.json`) and the two facts the
 * authority document binds from the same pinned build, its
 * `noticeAuthoritySha256` and its Section 15 Registry resource binding. A
 * reviewed Registry change (an alias, a notice) moves all three; every other
 * authority field is authored and kept as it is.
 */
export const launchLegalAuthorityFiles = {
  authority: 'scripts/catalog/scopes/campaign-mvp-v1.authority.json',
  notices: 'scripts/catalog/scopes/campaign-mvp-v1.notices.json',
} as const;
export const registryResourceKey = 'resource/section15-registry';
export const launchLegalAuthorityWrite =
  'pnpm -s catalog:launch-legal-authority --write';

const legalFieldsSchema = z.looseObject({
  noticeAuthoritySha256: z.string(),
  resourceBindings: z.array(
    z.strictObject({ key: z.string(), source: launchBindingSchema }),
  ),
});
type NoticeAuthority = Awaited<ReturnType<typeof buildLaunchNoticeAuthority>>;
/** The two documents as stored, expanded from their shared records. */
export type LaunchLegalAuthority = { authority: unknown; notices: unknown };

/**
 * `authority` rebound to a fresh pinned build: `notices` is the notice
 * authority that build reproduces and `inventory` the build, whose Registry
 * row carries the Registry's whole-file binding. Key order is kept, so an
 * unchanged authority reproduces its own bytes.
 */
export function rebindLaunchLegalAuthority({
  authority,
  inventory,
  notices,
}: {
  authority: unknown;
  inventory: LaunchManifest;
  notices: NoticeAuthority;
}): LaunchLegalAuthority {
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
      `${launchLegalAuthorityFiles.authority} has no single ${registryResourceKey} binding.`,
    );
  return {
    authority: {
      ...document,
      noticeAuthoritySha256: launchInventoryHash(notices),
      resourceBindings: resourceBindings.map((binding, index) =>
        isRegistry(binding) ? { key: binding.key, source } : stored[index],
      ),
    },
    notices,
  };
}

function isRegistry({ key }: { key: string }) {
  return key === registryResourceKey;
}

/** What in `committed` a fresh build reproduces differently, by file and fact. */
export function staleLaunchLegalAuthority({
  committed,
  reproduced,
}: {
  committed: LaunchLegalAuthority;
  reproduced: LaunchLegalAuthority;
}) {
  const { authority, notices } = launchLegalAuthorityFiles;
  const was = legalFieldsSchema.parse(committed.authority);
  const now = legalFieldsSchema.parse(reproduced.authority);
  const registry = (fields: typeof was) =>
    launchInventoryHash(fields.resourceBindings.find(isRegistry));
  return [
    ...(JSON.stringify(committed.notices) === JSON.stringify(reproduced.notices)
      ? []
      : [
          `${notices}: differs from its pinned governing/legal inputs or the actual generic scope`,
        ]),
    ...(was.noticeAuthoritySha256 === now.noticeAuthoritySha256
      ? []
      : [`${authority}: noticeAuthoritySha256 is not the notice authority's`]),
    ...(registry(was) === registry(now)
      ? []
      : [
          `${authority}: the ${registryResourceKey} binding is not the Registry's`,
        ]),
  ];
}

async function readStored(repoRoot: string, path: string): Promise<unknown> {
  return parseLaunchInventoryDocument(
    JSON.parse(await readFile(join(repoRoot, path), 'utf8')),
  );
}

/** Only the pinned-input builder supplies `inventory`; never a submitted document. */
async function compareLaunchLegalAuthority({
  inventory,
  repoRoot,
}: {
  inventory: LaunchManifest;
  repoRoot: string;
}) {
  const committed = {
    authority: await readStored(repoRoot, launchLegalAuthorityFiles.authority),
    notices: await readStored(repoRoot, launchLegalAuthorityFiles.notices),
  };
  const reproduced = rebindLaunchLegalAuthority({
    authority: committed.authority,
    inventory,
    notices: await buildLaunchNoticeAuthority({ inventory, repoRoot }),
  });
  return {
    committed,
    reproduced,
    stale: staleLaunchLegalAuthority({ committed, reproduced }),
  };
}

/** Read-only: throws, naming each stale fact, unless the build reproduces the committed authority. */
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
    for (const name of ['authority', 'notices'] as const)
      await writeFile(
        join(options.repoRoot, launchLegalAuthorityFiles[name]),
        JSON.stringify(reproduced[name]),
      );
  return stale;
}
