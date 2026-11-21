import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importCatalog } from './import.ts';
import { pcgenDataPath, verifyInputs } from './operator.ts';

/** The repository this code runs from: the default root of a pinned import. */
const executingCheckout = fileURLToPath(new URL('../../', import.meta.url));

/** The checkouts a pinned import reads, with their verification at the pins. */
export type PinnedCatalogCheckouts = {
  system: string;
  content: string;
  /** A PCGen checkout at `pcgenPin`, whose chosen owners are emitted. */
  pcgen?: string;
  verification: Awaited<ReturnType<typeof verifyInputs>>;
};

/**
 * The checkouts verified at their pins, as `catalog:preview` verifies them;
 * an unverified one is refused.
 */
export async function verifiedPinnedCatalogCheckouts({
  system,
  content,
  pcgen,
}: {
  system: string;
  content: string;
  pcgen?: string;
}): Promise<PinnedCatalogCheckouts> {
  const verification = await verifyInputs({
    system,
    content,
    pcgen,
    allowUnverified: false,
  });
  if (verification.status !== 'verified')
    throw new Error('The pinned catalog import needs the pinned checkouts.');
  return {
    system,
    content,
    ...(pcgen !== undefined && { pcgen }),
    verification,
  };
}

/**
 * The full catalog import at the pinned checkouts, as `catalog:preview`
 * imports it, with the reviewed remaps and curation committed at `root` (by
 * default the executing checkout): the one import of `catalog:party-scope`
 * (`--write`, `--check` and `--status`, with PCGen) and of the #227 matcher
 * (`generateAttribution227Matches`, Foundry only, at its root). Verified
 * checkouts are imported as the whole corpus, so a record these inputs lack
 * is in no pinned file; only a test's stand-in tree is unverified.
 */
export async function importPinnedCatalog({
  checkouts: { system, content, pcgen, verification },
  root = executingCheckout,
}: {
  checkouts: PinnedCatalogCheckouts;
  root?: string;
}) {
  const read = async (name: string): Promise<unknown> =>
    JSON.parse(await readFile(join(root, 'scripts/catalog', name), 'utf8'));
  const artifact = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps: await read('reviewed-remaps.json'),
    curation: await read('reviewed-curation.json'),
    ...(pcgen !== undefined && { pcgen: { path: pcgenDataPath(pcgen) } }),
    wholeCorpus: verification.status === 'verified',
  });
  return {
    artifact,
    upstream:
      verification.status === 'verified' ? verification.repositories : [],
  };
}
