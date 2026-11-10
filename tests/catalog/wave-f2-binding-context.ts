import type { AdmissionSource } from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import preview from '../fixtures/class-abilities-644/binding-preview.json';

/**
 * #628 wave F2: the ten shape Spells Wild Shape functions as, as the
 * full-corpus preview imports them (#644's binding preview holds them as the
 * parent's closure). Their batches' bounded fixtures predate later changes to
 * the bodies they link (Beast Shape II, Elemental Body I and III, Plant Shape
 * II), so a wave F2 row binds against these entries, as the gate does.
 */
const closure = preview.closure as unknown as PreviewEntry[];
const entries = new Map(closure.map((entry) => [entry.externalKey, entry]));

/** A wave F2 Spell's full-corpus entry and closure; any other root is returned unchanged. */
export function withWaveF2BindingContext({
  entry,
  artifact,
}: {
  entry: PreviewEntry;
  artifact: AdmissionSource;
}): { entry: PreviewEntry; artifact: AdmissionSource } {
  const full = entries.get(entry.externalKey);
  if (!full) return { entry, artifact };
  return {
    entry: full,
    artifact: {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: closure,
        resources: [],
        remaps: [],
      },
    },
  };
}
