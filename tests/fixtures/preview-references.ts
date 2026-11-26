import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { computeFingerprint } from '../../scripts/catalog/admission';

const previewSchema = z.object({
  entries: z.array(importedCatalogEntrySchema),
  closure: z.array(importedCatalogEntrySchema),
});
const referencedPreviewSchema = previewSchema.extend({
  closureRefs: z
    .array(
      z.strictObject({
        fixture: z.string().regex(/^racial-traits-\d+$/),
        externalKey: z.string().min(1),
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .default([]),
});

/** Reuse existing independently frozen bodies instead of copying closures. */
export function resolvePreviewReferences({
  raw,
  fixtureRoot = fileURLToPath(new URL('.', import.meta.url)),
}: {
  raw: unknown;
  fixtureRoot?: string;
}) {
  const preview = referencedPreviewSchema.parse(raw);
  const seen = new Set(
    [...preview.entries, ...preview.closure].map((entry) => entry.externalKey),
  );
  const loaded = new Map<string, z.infer<typeof previewSchema>>();
  const referenced = preview.closureRefs.map((reference) => {
    let source = loaded.get(reference.fixture);
    if (!source) {
      source = previewSchema.parse(
        JSON.parse(
          readFileSync(
            join(fixtureRoot, reference.fixture, 'preview.json'),
            'utf8',
          ),
        ),
      );
      loaded.set(reference.fixture, source);
    }
    const matches = [...source.entries, ...source.closure].filter(
      (entry) => entry.externalKey === reference.externalKey,
    );
    const entry = matches[0];
    if (
      !entry ||
      matches.length !== 1 ||
      computeFingerprint(entry) !== reference.fingerprint ||
      seen.has(entry.externalKey)
    )
      throw new Error(
        `Missing, mismatched or duplicate preview reference: ${reference.fixture} / ${reference.externalKey}`,
      );
    seen.add(entry.externalKey);
    return entry;
  });
  return {
    entries: preview.entries,
    closure: [...preview.closure, ...referenced],
  };
}
