// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { formatCatalogData } from '../../scripts/catalog/data-files';
import { launchAuthoritySchema } from '../../scripts/catalog/launch-inventory-authority';
import {
  parseLaunchInventory,
  parseLaunchInventoryDocument,
} from '../../scripts/catalog/launch-inventory-document';
import { sourceHash } from '../../scripts/catalog/launch-inventory-sources';
import {
  checkLaunchLegalAuthority,
  launchLegalAuthorityFile,
  rebindLaunchLegalAuthority,
  registryResourceKey,
  staleLaunchLegalAuthority,
  writeLaunchLegalAuthority,
} from '../../scripts/catalog/launch-legal-authority';

const read = (path: string) =>
  readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const committed: unknown = parseLaunchInventoryDocument(
  JSON.parse(await read(launchLegalAuthorityFile)),
);
const inventory = parseLaunchInventory(
  JSON.parse(await read('scripts/catalog/scopes/campaign-mvp-v1.json')),
);
const registryText = await read('src/lib/catalog/data/section15-registry.json');

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

/** A fresh pinned build over Registry `bytes`: its whole-file Registry source moves. */
function buildOver(bytes: string) {
  const sha256 = sourceHash(bytes);
  return {
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
  };
}

const staleBinding =
  "scripts/catalog/scopes/campaign-mvp-v1.authority.json: the resource/section15-registry binding is not the Registry's";

it('reproduces the committed authority, byte for byte, over the committed Registry', () => {
  const reproduced = rebindLaunchLegalAuthority({
    authority: committed,
    inventory: buildOver(registryText),
  });
  expect(staleLaunchLegalAuthority({ committed, reproduced })).toEqual([]);
  expect(JSON.stringify(reproduced)).toBe(JSON.stringify(committed));
});

it('fails the check when the Registry gains an alias without regeneration, naming the binding, and passes once written', () => {
  const before = rebindLaunchLegalAuthority({
    authority: committed,
    inventory: buildOver(registryWithout('PZO9491')),
  });
  const reproduced = rebindLaunchLegalAuthority({
    authority: before,
    inventory: buildOver(registryText),
  });
  expect(staleLaunchLegalAuthority({ committed: before, reproduced })).toEqual([
    staleBinding,
  ]);
  expect(
    staleLaunchLegalAuthority({ committed: reproduced, reproduced }),
  ).toEqual([]);
  expect(reproduced).toEqual(committed);
});

// What catalog:launch-legal-authority --check and catalog:launch-inventory
// --check run (scripts/catalog-launch-legal-authority.ts,
// scripts/catalog-launch-inventory.ts): over a checkout whose authority binds
// the Registry before an alias, the check throws naming the binding; --write
// rebinds it, and the check then passes.
it('refuses a stale Registry binding in a checkout, naming it, and passes after --write', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launch-legal-authority-'));
  try {
    await mkdir(join(root, 'scripts/catalog/scopes'), { recursive: true });
    const path = join(root, launchLegalAuthorityFile);
    const stale = rebindLaunchLegalAuthority({
      authority: committed,
      inventory: buildOver(registryWithout('PZO9491')),
    });
    await writeFile(path, JSON.stringify(stale));
    const fresh = buildOver(registryText);
    await expect(
      checkLaunchLegalAuthority({ inventory: fresh, repoRoot: root }),
    ).rejects.toThrow(
      `The launch legal authority is stale (${staleBinding}): run pnpm -s catalog:launch-legal-authority --write, then pnpm -s catalog:launch-inventory --write.`,
    );
    expect(
      await writeLaunchLegalAuthority({ inventory: fresh, repoRoot: root }),
    ).toEqual([staleBinding]);
    await expect(
      checkLaunchLegalAuthority({ inventory: fresh, repoRoot: root }),
    ).resolves.toBeUndefined();
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(committed);
    // An up-to-date authority is left as it is.
    const bytes = await readFile(path, 'utf8');
    expect(
      await writeLaunchLegalAuthority({ inventory: fresh, repoRoot: root }),
    ).toEqual([]);
    expect(await readFile(path, 'utf8')).toBe(bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('refuses an authority that still carries noticeAuthoritySha256, and no other unknown field', () => {
  expect(launchAuthoritySchema.safeParse(committed).success).toBe(true);
  const legacy = {
    ...(committed as Record<string, unknown>),
    noticeAuthoritySha256: 'a'.repeat(64),
  };
  const result = launchAuthoritySchema.safeParse(legacy);
  expect(result.success).toBe(false);
  expect(result.error?.issues).toEqual([
    expect.objectContaining({
      code: 'unrecognized_keys',
      keys: ['noticeAuthoritySha256'],
    }),
  ]);
});
