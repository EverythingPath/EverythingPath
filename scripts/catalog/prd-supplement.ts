import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { supplementManifestSchema } from './prd-manifest.ts';

/**
 * The PRD supplement (owner decision of 2026-10-31): the Advanced Race
 * Guide's age, height and weight page, captured once from Wayback by the PRD
 * capture's rules (`prd-capture.ts`) and kept beside the capture under its own
 * pin, as race age-table evidence only. The PRD capture and `prdPin` stay as
 * they are. The pinned store holds it whole
 * (`tests/fixtures/pinned/prd-supplement/`); the run's evidence keeps the
 * fetch. Nothing is fetched at build or test time.
 */
export const prdSupplementPin = {
  capture: 'prd-supplement-2026-10-31',
  manifestSha256:
    'ebd63b159fbb1e33202ca5a3adec194fab4d35cc6399d8a2e526727b443fdd4d',
  contentSha256:
    '86e17343fe5617215b31c0fb19fe5a391c4765a6da5ca7d6fdd2f3a58a921b66',
} as const;

const digest = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * The supplement's two hashes, as `hashPrdCapture` hashes the capture: the
 * manifest's own sha256, and `contentSha256` over the manifest's bytes and
 * then each page's path, a NUL, its bytes and a NUL, in manifest order.
 */
export async function hashPrdSupplement(root: string) {
  const manifestBytes = await readFile(join(root, 'manifest.json'));
  const manifest = supplementManifestSchema.parse(
    JSON.parse(manifestBytes.toString()),
  );
  const content = createHash('sha256').update(manifestBytes);
  for (const { file } of manifest.pages)
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
 * Checks a supplement against `prdSupplementPin`: the manifest must be the
 * pinned one, and every page it lists present with the bytes and sha256 it
 * records. A missing or changed file throws.
 */
export async function verifyPrdSupplement(root: string) {
  const manifestBytes = await readFile(join(root, 'manifest.json'));
  if (digest(manifestBytes) !== prdSupplementPin.manifestSha256)
    throw new Error(
      `The PRD supplement manifest changed: ${root}/manifest.json`,
    );
  const manifest = supplementManifestSchema.parse(
    JSON.parse(manifestBytes.toString()),
  );
  for (const page of manifest.pages) {
    let bytes: Buffer;
    try {
      bytes = await readFile(join(root, page.file));
    } catch {
      throw new Error(`The PRD supplement lacks ${page.file}.`);
    }
    if (bytes.length !== page.bytes || digest(bytes) !== page.sha256)
      throw new Error(`The PRD supplement's ${page.file} changed.`);
  }
  const { contentSha256 } = await hashPrdSupplement(root);
  if (contentSha256 !== prdSupplementPin.contentSha256)
    throw new Error(`The PRD supplement's content hash changed: ${root}`);
  return { files: manifest.pages.length, contentSha256 };
}
