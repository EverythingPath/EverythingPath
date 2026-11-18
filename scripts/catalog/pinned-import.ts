import { readFile } from 'node:fs/promises';
import { importCatalog } from './import.ts';
import { pcgenDataPath, verifyInputs } from './operator.ts';

/**
 * The full catalog import at the pinned checkouts, as `catalog:preview`
 * imports it, with the committed reviewed remaps and curation: the party
 * scope's (with PCGen) and the #227 matcher's (Foundry only). The checkouts
 * are verified first, and an unverified one is refused.
 */
export async function importPinnedCatalog({
  system,
  content,
  pcgen,
}: {
  system: string;
  content: string;
  /** A PCGen checkout at `pcgenPin`, whose chosen owners are emitted. */
  pcgen?: string;
}) {
  const verified = await verifyInputs({
    system,
    content,
    pcgen,
    allowUnverified: false,
  });
  if (verified.status !== 'verified')
    throw new Error('The pinned catalog import needs the pinned checkouts.');
  const read = async (name: string): Promise<unknown> =>
    JSON.parse(await readFile(new URL(`./${name}`, import.meta.url), 'utf8'));
  const artifact = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps: await read('reviewed-remaps.json'),
    curation: await read('reviewed-curation.json'),
    ...(pcgen && { pcgen: { path: pcgenDataPath(pcgen) } }),
    // Verified above: a record these inputs lack is in no pinned file.
    wholeCorpus: true,
  });
  return { artifact, upstream: verified.repositories };
}
