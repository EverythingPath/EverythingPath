import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { constants, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { HarnessFailure } from './diagnostics';
import { listSourceFiles } from './source-files';
import { isTopLevelSpec } from './source-evidence';

export async function copyBuildWorkspace(
  sourceRoot: string,
  workspace: string,
) {
  for (const file of listSourceFiles(sourceRoot)) {
    if (
      file.split('/').some((part) => part.startsWith('.')) ||
      file.startsWith('agent/') ||
      file.startsWith('node_modules/')
    )
      continue;
    const destination = join(workspace, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(sourceRoot, file), destination);
  }
  await cp(join(sourceRoot, 'node_modules'), join(workspace, 'node_modules'), {
    recursive: true,
    verbatimSymlinks: true,
    mode: constants.COPYFILE_FICLONE,
  });
}

export async function checkGeneratedBindings(
  sourceRoot: string,
  workspace: string,
) {
  const sourceDirectory = join(sourceRoot, 'convex/_generated');
  const generatedDirectory = join(workspace, 'convex/_generated');
  const bindings = (files: string[]) =>
    files.filter((file) => /\.(?:ts|js)$/.test(file)).sort();
  const source = bindings(await readdir(sourceDirectory));
  const generated = bindings(await readdir(generatedDirectory));
  const refuse = (file: string) => {
    throw new HarnessFailure({ kind: 'generated-drift', file });
  };
  if (source.join('\n') !== generated.join('\n')) refuse('file list');
  for (const file of source)
    if (
      !(await readFile(join(sourceDirectory, file))).equals(
        await readFile(join(generatedDirectory, file)),
      )
    )
      refuse(file);
}

async function hashSpecs(root: string) {
  const names = (await readdir(join(root, 'e2e')))
    .filter((name) => isTopLevelSpec(`e2e/${name}`))
    .sort();
  const hash = createHash('sha256');
  for (const name of names)
    hash.update(`${name}\0`).update(await readFile(join(root, 'e2e', name)));
  return hash.digest('hex');
}

/**
 * Makes a reused workspace's top-level specs exactly the checkout's (#754):
 * a spec no longer in the source (deleted or renamed) is removed, and every
 * source spec is copied. Nothing else changes, because the reuse fingerprint
 * matched everything else.
 */
export async function refreshSpecFiles(sourceRoot: string, workspace: string) {
  // The index keeps tracked files deleted from the working tree.
  const sourceSpecs = listSourceFiles(sourceRoot).filter(
    (file) => isTopLevelSpec(file) && existsSync(join(sourceRoot, file)),
  );
  for (const name of await readdir(join(workspace, 'e2e'))) {
    const file = `e2e/${name}`;
    if (isTopLevelSpec(file) && !sourceSpecs.includes(file))
      await rm(join(workspace, file), { force: true });
  }
  for (const file of sourceSpecs)
    await copyFile(join(sourceRoot, file), join(workspace, file));
  if ((await hashSpecs(sourceRoot)) !== (await hashSpecs(workspace)))
    throw new HarnessFailure({ kind: 'source-changed' });
}
