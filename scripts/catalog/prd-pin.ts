import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prdPin } from './inventory.ts';
import { completeManifestSchema } from './prd-manifest.ts';

const digest = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * The capture's two hashes, as the Foundry pins hash their inputs
 * (`loadCatalogInputs`, `import.ts`): the manifest's own sha256, and
 * `contentSha256` over the manifest's bytes and then each listed file's path,
 * a NUL, its bytes and a NUL, in manifest order.
 */
export async function hashPrdCapture(root: string) {
  const manifestBytes = await readFile(join(root, 'manifest.json'));
  const manifest = completeManifestSchema.parse(
    JSON.parse(manifestBytes.toString()),
  );
  const content = createHash('sha256').update(manifestBytes);
  for (const { file } of [...manifest.pages, ...manifest.checklist])
    content
      .update(file)
      .update('\0')
      .update(await readFile(join(root, file)))
      .update('\0');
  return {
    manifestSha256: digest(manifestBytes),
    contentSha256: content.digest('hex'),
  };
}

/**
 * Checks a PRD capture against `prdPin`: the manifest must be the pinned one,
 * and every file it lists (or only `files`, for the store's excerpts) must be
 * present with the bytes and sha256 it records. Checking the whole capture
 * also checks `contentSha256`. A missing or changed file throws.
 */
export async function verifyPrdCapture(
  root: string,
  { files }: { files?: readonly string[] } = {},
) {
  const manifestBytes = await readFile(join(root, 'manifest.json'));
  if (digest(manifestBytes) !== prdPin.manifestSha256)
    throw new Error(`The PRD manifest changed: ${root}/manifest.json`);
  const manifest = completeManifestSchema.parse(
    JSON.parse(manifestBytes.toString()),
  );
  const listed = [...manifest.pages, ...manifest.checklist];
  const entries = files
    ? files.map((file) => {
        const entry = listed.find((item) => item.file === file);
        if (!entry) throw new Error(`The PRD manifest doesn't list ${file}.`);
        return entry;
      })
    : listed;
  for (const entry of entries) {
    let bytes: Buffer;
    try {
      bytes = await readFile(join(root, entry.file));
    } catch {
      throw new Error(`The PRD capture lacks ${entry.file}.`);
    }
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256)
      throw new Error(`The PRD capture's ${entry.file} changed.`);
  }
  if (files) return { files: entries.length, contentSha256: null };
  const { contentSha256 } = await hashPrdCapture(root);
  if (contentSha256 !== prdPin.contentSha256)
    throw new Error(`The PRD capture's content hash changed: ${root}`);
  return { files: entries.length, contentSha256 };
}
