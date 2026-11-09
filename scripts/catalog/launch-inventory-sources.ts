import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { pins, packPolicy } from './inventory.ts';
import { upstreamRecord, toExternalKey, type LoadedRecord } from './records.ts';
import { readObject, readStrings, readArray } from './values.ts';
import type { LaunchBinding } from './launch-inventory-schema.ts';

export const sourceHash = (text: string | Buffer) =>
  createHash('sha256').update(text).digest('hex');
export type LaunchSourcePaths = {
  pf1: string;
  'pf1-content': string;
  pcgen: string;
  prd: string;
};
export type LaunchSourceRecord = LoadedRecord & {
  binding: LaunchBinding;
  text: string;
};

/** Read-only inventory; it neither maps candidates nor changes curation/admission. */
export async function readLaunchSourceRecords(paths: LaunchSourcePaths) {
  const records: LaunchSourceRecord[] = [];
  for (const repo of ['pf1', 'pf1-content'] as const) {
    const root = paths[repo];
    const directory = pins[repo].directory;
    const packs = (
      await readdir(join(root, directory), { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
      .sort();
    for (const pack of packs) {
      if (
        packPolicy({ repo, pack }).kind !== 'map' &&
        ![
          'monster-templates',
          'template-abilities',
          'pf-universal-monster-rules',
        ].includes(pack)
      )
        continue;
      const files = (
        await readdir(join(root, directory, pack), { recursive: true })
      )
        .filter((file) => /\.ya?ml$/.test(file))
        .sort();
      for (const file of files) {
        const path = `${directory}/${pack}/${file}`;
        const text = await readFile(join(root, path), 'utf8');
        const record = upstreamRecord.parse(parse(text));
        records.push({
          repo,
          pack,
          path,
          record,
          text,
          binding: {
            repository: repo,
            pin: pins[repo].commit,
            locator: path,
            rawSha256: sourceHash(text),
            effectiveSha256: sourceHash(text),
          },
        });
      }
    }
  }
  return records;
}

export const classAssociations = (record: LaunchSourceRecord) =>
  readStrings(readObject(record.record.system.associations).classes);
export const sourceBooks = (record: LaunchSourceRecord) =>
  readArray(record.record.system.sources).flatMap((source) => {
    const id = readObject(source).id;
    return typeof id === 'string' ? [id] : [];
  });
export const sourceTags = (record: LaunchSourceRecord) =>
  readStrings(record.record.system.tags);
export const sourceKey = (record: LaunchSourceRecord) => toExternalKey(record);
export const normalizeSourceName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s*\((?:ex|su|sp|\d+ ep|\d+ cp)\)/g, '')
    .replace(/[^a-z0-9]/g, '');

const candidateSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  disposition: z.string().optional(),
  assessmentStatus: z.string().optional(),
  requiredNotices: z.array(z.string()).optional(),
  holdIds: z.array(z.string()).optional(),
  noticeHoldIds: z.array(z.string()).optional(),
  evidenceId: z.string().optional(),
  missingEvidence: z.unknown().optional(),
});
export type LaunchLegalCandidate = z.infer<typeof candidateSchema> & {
  path: string;
};

export async function readLaunchLegalInventories(root: string) {
  const candidates = new Map<string, LaunchLegalCandidate>();
  for (const file of (
    await readdir(join(root, 'scripts/catalog/legal'))
  ).sort()) {
    if (!file.endsWith('.json')) continue;
    const path = `scripts/catalog/legal/${file}`;
    const data = readObject(
      JSON.parse(await readFile(join(root, path), 'utf8')),
    );
    for (const value of readArray(data.candidates)) {
      const result = candidateSchema.safeParse(value);
      if (result.success)
        candidates.set(result.data.externalKey, { ...result.data, path });
    }
  }
  return candidates;
}

export function sourceKind(source: LaunchSourceRecord) {
  const policy = packPolicy({ repo: source.repo, pack: source.pack });
  if (policy.kind !== 'map') return 'governingBody';
  if (policy.family === 'buff') return 'spellEffect';
  if (policy.family === 'naturalAttacks') return 'item';
  return policy.family;
}

export function sourceLinks(source: LaunchSourceRecord) {
  const prerequisites = sourcePrerequisites(source);
  return [...source.text.matchAll(/@UUID\[([^\]]+)\](?:\{([^}]*)\})?/g)].map(
    (match) => ({
      uuid: match[1] ?? '',
      label: match[2] ?? '',
      prerequisite: prerequisites.some((paragraph) =>
        paragraph.includes(`@UUID[${match[1]}]`),
      ),
    }),
  );
}

export function sourcePrerequisites(source: LaunchSourceRecord) {
  const html = readObject(source.record.system.description).value;
  if (typeof html !== 'string') return [];
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(
      (match) =>
        match[1]
          ?.replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim() ?? '',
    )
    .filter((paragraph) => /^Prerequisites?\s*:/i.test(paragraph));
}

export function sourceSpellClasses(source: LaunchSourceRecord) {
  return Object.entries(
    readObject(readObject(source.record.system.learnedAt).class),
  ).flatMap(([name, level]) =>
    typeof level === 'number' ? [{ name, level }] : [],
  );
}
