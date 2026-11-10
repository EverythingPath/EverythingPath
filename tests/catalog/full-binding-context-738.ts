import { z } from 'zod';
import type { AdmissionSource } from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import {
  appliedRemapSchema,
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../src/lib/catalog/imported-entry-schema';
import context from '../fixtures/spell-bindings-738/full-context.json';

const spellEntrySchema = importedCatalogEntrySchema.extend({
  detail: importedSpellDetailSchema,
});

/** Verified full-preview closures, supplementing the historical bounded imports. */
export const fullBindingContext738 = z
  .object({
    rootKeys: z.array(z.string()),
    entries: z.array(spellEntrySchema),
    resources: z.array(spellEntrySchema),
    remaps: z.array(appliedRemapSchema),
  })
  .parse(context);

const roots = new Set(fullBindingContext738.rootKeys);
const entries = new Map(
  [...fullBindingContext738.entries, ...fullBindingContext738.resources].map(
    (entry) => [entry.externalKey, entry],
  ),
);

/** #738 rebinds these roots against full context; bounded extraction still replays separately. */
export function withFullBindingContext738({
  entry,
  artifact,
}: {
  entry: PreviewEntry;
  artifact: AdmissionSource;
}): { entry: PreviewEntry; artifact: AdmissionSource } {
  if (!roots.has(entry.externalKey)) return { entry, artifact };
  const full = entries.get(entry.externalKey);
  if (!full) throw new Error(`Missing full binding context for ${entry.name}`);
  return {
    entry: full,
    artifact: {
      ...artifact,
      catalog: { ...artifact.catalog, ...fullBindingContext738 },
    },
  };
}
