import { readFileSync } from 'node:fs';
import type { AdmissionSource } from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';

/**
 * A class-list Spell wave's binding context (wave CL1 fix round 1): the
 * wave's re-assessed Spells and every entry their gate closures reach, as the
 * full-corpus preview imports them. A wave row binds against these entries, as
 * the gate does (wave F2's binding-context precedent).
 *
 * Each entry is read from the first listed committed preview that holds it,
 * exactly equal to the full-corpus import; a wave stores only keys.
 */
export type WaveBindingContext = {
  /** The wave's re-assessed keys, in the reviewed order. */
  keys: readonly string[];
  /** The closure entries, sorted by key: the wave's keys and their context. */
  closure: readonly PreviewEntry[];
  /** A wave Spell's full-corpus entry and its closure as the artifact. */
  bindingContext: (externalKey: string) => {
    entry: PreviewEntry;
    artifact: AdmissionSource;
  };
};

function previewEntries(name: string): PreviewEntry[] {
  const preview = JSON.parse(
    readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'),
  ) as { entries: PreviewEntry[] };
  return preview.entries;
}

export function waveBindingContext({
  wave,
  sources,
  keys,
  contextKeys,
}: {
  wave: string;
  /** Committed previews under tests/fixtures, in lookup order. */
  sources: readonly string[];
  keys: readonly string[];
  /** Closure entries that are not themselves wave keys. */
  contextKeys: readonly string[];
}): WaveBindingContext {
  const wanted = new Set([...keys, ...contextKeys]);
  const found = new Map<string, PreviewEntry>();
  for (const name of sources)
    for (const entry of previewEntries(name))
      if (wanted.has(entry.externalKey) && !found.has(entry.externalKey))
        found.set(entry.externalKey, entry);
  const missing = [...wanted].filter((key) => !found.has(key));
  if (missing.length)
    throw new Error(`Wave ${wave} context missing ${missing.join(', ')}`);
  const closure = [...found.values()].sort((a, b) =>
    a.externalKey < b.externalKey ? -1 : 1,
  );
  const entries = new Map(closure.map((entry) => [entry.externalKey, entry]));
  return {
    keys,
    closure,
    bindingContext(externalKey) {
      const entry = entries.get(externalKey);
      if (!entry || !keys.includes(externalKey))
        throw new Error(`${externalKey} is not a wave ${wave} key`);
      return {
        entry,
        artifact: {
          catalog: { entries: closure, resources: [], remaps: [] },
          comparison: { records: [], packs: [] },
        },
      };
    },
  };
}
