// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { formatCatalogData } from '../../scripts/catalog/data-files';
import {
  parseLaunchInventory,
  parseLaunchInventoryDocument,
} from '../../scripts/catalog/launch-inventory-document';
import { sourceHash } from '../../scripts/catalog/launch-inventory-sources';
import {
  launchLegalAuthorityFiles,
  rebindLaunchLegalAuthority,
  registryResourceKey,
  staleLaunchLegalAuthority,
} from '../../scripts/catalog/launch-legal-authority';
import { noticeAuthoritySchema } from '../../scripts/catalog/launch-notice-authority';

const read = (path: string) =>
  readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const stored = async (path: string): Promise<unknown> =>
  parseLaunchInventoryDocument(JSON.parse(await read(path)));
const committed = {
  authority: await stored(launchLegalAuthorityFiles.authority),
  notices: await stored(launchLegalAuthorityFiles.notices),
};
const inventory = parseLaunchInventory(
  JSON.parse(await read('scripts/catalog/scopes/campaign-mvp-v1.json')),
);
const notices = noticeAuthoritySchema.parse(committed.notices);
const registryPath = 'src/lib/catalog/data/section15-registry.json';
const registryText = await read(registryPath);

/** The Registry before `code` was aliased to its reviewed line. */
function registryWithout(code: string) {
  const registry = JSON.parse(registryText) as Record<
    string,
    { aliases: string[] }
  >;
  const record = Object.values(registry).find(({ aliases }) =>
    aliases.includes(code),
  );
  if (!record) throw new Error(`No Registry record has the alias ${code}.`);
  record.aliases = record.aliases.filter((alias) => alias !== code);
  return formatCatalogData('registry', registry);
}

/**
 * What a fresh pinned build over Registry `bytes` changes: the inventory's
 * whole-file Registry source and the notice authority's Registry input.
 */
function buildOver(bytes: string) {
  const sha256 = sourceHash(bytes);
  return {
    inventory: {
      ...inventory,
      rows: inventory.rows.map((row) =>
        row.key === registryResourceKey
          ? {
              ...row,
              sources: row.sources.map((source) => ({
                ...source,
                rawSha256: sha256,
                effectiveSha256: sha256,
              })),
            }
          : row,
      ),
    },
    notices: {
      ...notices,
      inputs: notices.inputs.map((input) =>
        input.locator === registryPath ? { ...input, sha256 } : input,
      ),
    },
  };
}

const staleNotices = `${launchLegalAuthorityFiles.notices}: differs from its pinned governing/legal inputs or the actual generic scope`;
const staleHash = `${launchLegalAuthorityFiles.authority}: noticeAuthoritySha256 is not the notice authority's`;
const staleBinding = `${launchLegalAuthorityFiles.authority}: the ${registryResourceKey} binding is not the Registry's`;

it('reproduces the committed legal authority, byte for byte, over the committed Registry', () => {
  const reproduced = rebindLaunchLegalAuthority({
    authority: committed.authority,
    ...buildOver(registryText),
  });
  expect(staleLaunchLegalAuthority({ committed, reproduced })).toEqual([]);
  expect(JSON.stringify(reproduced.authority)).toBe(
    JSON.stringify(committed.authority),
  );
});

it('fails the check when the Registry gains an alias without regeneration, and passes once written', () => {
  const before = rebindLaunchLegalAuthority({
    authority: committed.authority,
    ...buildOver(registryWithout('PZO9491')),
  });
  const reproduced = rebindLaunchLegalAuthority({
    authority: before.authority,
    ...buildOver(registryText),
  });
  expect(staleLaunchLegalAuthority({ committed: before, reproduced })).toEqual(
    [staleNotices, staleHash, staleBinding],
  );
  expect(
    staleLaunchLegalAuthority({ committed: reproduced, reproduced }),
  ).toEqual([]);
  expect(reproduced).toEqual(committed);
});

it('fails the check when a rebase regenerated the notice authority but left the Registry binding stale', () => {
  const stale = rebindLaunchLegalAuthority({
    authority: committed.authority,
    inventory: buildOver(registryWithout('PZO9491')).inventory,
    notices,
  });
  expect(
    staleLaunchLegalAuthority({
      committed: stale,
      reproduced: rebindLaunchLegalAuthority({
        authority: stale.authority,
        ...buildOver(registryText),
      }),
    }),
  ).toEqual([staleBinding]);
});
