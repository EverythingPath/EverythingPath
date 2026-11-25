import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { pins, type Repository } from '../../scripts/catalog/inventory.ts';
import { pinnedPath, readPinned } from '../../tests/catalog/pinned-sources.ts';
import { releaseQualification } from '../fixtures/release';

/**
 * The bounded upstream input of the qualification release (#753): both full
 * pinned manifests, every pack folder they declare (so inventory coverage is
 * complete) and the one admitted feat's file, byte-identical to the pin and
 * checked against its legal inventory digest. Built under `root`, which the
 * run keeps inside its own temporary directory, never /tmp.
 */
export async function materializeReleaseSources(root: string) {
  const roots: Record<Repository, string> = {
    pf1: join(root, 'pf1'),
    'pf1-content': join(root, 'pf1-content'),
  };
  for (const repo of Object.keys(roots) as Repository[]) {
    const { manifest, directory } = pins[repo];
    const text = await readPinned(repo, manifest);
    await mkdir(dirname(join(roots[repo], manifest)), { recursive: true });
    await writeFile(join(roots[repo], manifest), text);
    const { packs } = z
      .object({ packs: z.array(z.object({ name: z.string() })) })
      .parse(JSON.parse(text));
    for (const { name } of packs)
      await mkdir(join(roots[repo], directory, name), { recursive: true });
  }
  const { repo, path, sha256 } = releaseQualification.feat.source;
  const bytes = await readFile(pinnedPath(repo, path));
  if (createHash('sha256').update(bytes).digest('hex') !== sha256)
    throw new Error('Pinned release feat does not match its legal digest');
  const target = join(roots[repo], path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return { systemPath: roots.pf1, contentPath: roots['pf1-content'] };
}

/**
 * The documented `catalog:release build` arguments for the qualification
 * release. The bounded tree is not a git checkout, so its upstream
 * verification is recorded as unverified; the file digest above stands in.
 */
export function releaseBuildArguments({
  systemPath,
  contentPath,
  artifactPath,
  schema,
  calculation,
}: {
  systemPath: string;
  contentPath: string;
  artifactPath: string;
  schema: string;
  calculation: string;
}) {
  return [
    'build',
    '--number',
    String(releaseQualification.releaseNumber),
    '--schema',
    schema,
    '--calculation',
    calculation,
    '--system',
    systemPath,
    '--content',
    contentPath,
    '--artifact',
    artifactPath,
    '--allow-unverified-checkouts',
  ];
}
