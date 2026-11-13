import { parse } from 'yaml';
import { z } from 'zod';
import {
  upstreamRecord,
  type LoadedRecord,
  type SourceRecord,
} from '../../scripts/catalog/records';
import { review } from '../fixtures/pf-companions-508/data';
import { readPinned } from './pinned-sources';

export async function readCompanionSource(key: string): Promise<LoadedRecord> {
  const row = review.candidates.find((row) => row.externalKey === key);
  if (!row) throw new Error(`Missing pinned companion ${key}`);
  return {
    repo: row.source.repo,
    pack: 'pf-companions',
    path: row.source.path,
    record: upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    ),
  };
}

/** Read the real pinned field directly, independently of the importer policy. */
export function pinnedCompanionBody(record: SourceRecord): string {
  const field = z.object({ value: z.string() });
  const details = z
    .object({ notes: field.optional(), biography: field.optional() })
    .parse(record.system.details);
  const body = details.notes?.value ?? details.biography?.value;
  if (body === undefined)
    throw new Error(`Missing pinned body for ${record.name}`);
  return body;
}
