import { parse } from 'yaml';
import {
  upstreamRecord,
  type LoadedRecord,
} from '../../scripts/catalog/records';
import { readPinned } from './pinned-sources';

/** A pinned Foundry class record, as the importer loads it. */
export async function loadPinnedClass(file: string): Promise<LoadedRecord> {
  return {
    repo: 'pf1',
    pack: 'classes',
    path: file,
    record: upstreamRecord.parse(parse(await readPinned('pf1', file))),
  };
}
