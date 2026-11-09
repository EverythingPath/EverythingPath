import { z } from 'zod';
import { pins, type Repository } from './inventory.ts';
import journalTargets from './rules-journal-targets.json';
import { readObject, readText } from './values.ts';

export const upstreamRecord = z.object({
  _id: z.string().regex(/^[A-Za-z0-9]+$/),
  _key: z.string(),
  name: z.string(),
  type: z.string().default(''),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  folder: z.string().nullable().optional(),
  system: z.record(z.string(), z.unknown()).default({}),
});
export type SourceRecord = z.infer<typeof upstreamRecord>;
export type LoadedRecord = {
  repo: Repository;
  pack: string;
  path: string;
  record: SourceRecord;
};
export function toExternalKey({
  repo,
  record,
}: {
  repo: Repository;
  record: Pick<SourceRecord, '_id'>;
}): string {
  return `${repo}/${record._id}`;
}
export type Unsupported = { field: string; reason: string; value?: unknown };
function descriptionText({
  description,
  biography,
}: {
  description: unknown;
  biography: unknown;
}): string {
  const fields = readObject(description);
  return (
    readText({ value: fields.value }) ||
    readText({ value: fields.unidentified }) ||
    readText({ value: readObject(biography).value }) ||
    readText({ value: biography })
  );
}
export function sourceDescription(record: SourceRecord): string {
  return descriptionText({
    description: record.system.description,
    biography: readObject(record.system.details).biography,
  });
}
export function sourceBody({ source }: { source: LoadedRecord }): string {
  const { repo, pack, record } = source;
  const details = readObject(record.system.details);
  const body = descriptionText({
    description: record.system.description,
    biography: details.biography,
  });
  if (repo !== 'pf1-content' || pack !== 'pf-companions') return body;
  // Companion actors store their stat blocks in notes. Retain that text
  // after the existing body, without importing unrelated actor bookkeeping.
  const notes = details.notes;
  const text =
    readText({ value: readObject(notes).value }) || readText({ value: notes });
  if (!text.trim() || text.trim() === body.trim()) return body;
  return body.trim() ? `${body}\n${text}` : text;
}
const targets = z
  .object({
    pins: z.object({
      pf1: z.literal(pins.pf1.commit),
      'pf1-content': z.literal(pins['pf1-content'].commit),
    }),
    journals: z.array(
      z.object({
        repo: z.enum(['pf1', 'pf1-content']),
        path: z.string(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        id: z.string(),
        pages: z.array(z.string()),
      }),
    ),
  })
  .parse(journalTargets);
const journalPages = new Map(
  targets.journals.map((journal) => [
    `${journal.repo}/${journal.id}`,
    new Set(journal.pages),
  ]),
);

/**
 * #738: rules journals are excluded from catalog definitions. Their complete
 * pinned target index lets bounded imports verify journals and pages without
 * importing rules bodies. See catalog-journal-targets.ts for source hashes.
 * Fragments are retained only as text; no fragment navigation is promised.
 */
export function isRulesJournalLink(uuid: string): boolean {
  const match =
    /^Compendium\.(pf1\.(?:pf1e-rules|rules)|pf-content\.pf-rules)\.(?:JournalEntry\.)?([A-Za-z0-9]+)(?:\.JournalEntryPage\.([A-Za-z0-9]+))?(?:#[^\s\]]*)?$/.exec(
      uuid,
    );
  if (!match) return false;
  const repo = match[1]?.startsWith('pf1.') ? 'pf1' : 'pf1-content';
  const pages = journalPages.get(`${repo}/${match[2]}`);
  return pages !== undefined && (match[3] === undefined || pages.has(match[3]));
}
export function uuidKey(uuid: string): string | undefined {
  const match =
    /^Compendium\.(pf1|pf-content|pf1-content)\.[^.]+\.(?:Item\.|Actor\.)?([A-Za-z0-9]+)$/.exec(
      uuid,
    );
  return match
    ? toExternalKey({
        repo: match[1] === 'pf1' ? 'pf1' : 'pf1-content',
        record: { _id: match[2] ?? '' },
      })
    : undefined;
}
