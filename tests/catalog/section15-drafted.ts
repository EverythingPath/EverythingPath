import {
  committedSection15Confirmations,
  type Section15Confirmation,
} from '../../scripts/catalog/legal/section15-confirmations';
import {
  readSection15State,
  renderSection15Files,
} from '../../scripts/catalog/legal/section15-match';
import type { Section15Registry } from '../../src/lib/catalog/admission-schema';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';

/**
 * #716 P10a: confirmations and a Registry as the implementer wrote them, in
 * memory: every confirmation drafted and every `pcgen:<code>` block
 * unreviewed on its confirmation's date (`pcgenRegistryRecord`). The
 * committed ones by default; the record step may since have checked some, so
 * tests that need drafted records start from these, never from the committed
 * review state.
 */
export function draftedSection15({
  confirmations: source = committedSection15Confirmations,
  registry: sourceRegistry = section15Registry,
}: {
  confirmations?: readonly Section15Confirmation[];
  registry?: Section15Registry;
} = {}): {
  confirmations: Section15Confirmation[];
  registry: Section15Registry;
} {
  const confirmations = source.map(
    (confirmation): Section15Confirmation => ({
      ...structuredClone(confirmation),
      review: { status: 'drafted' },
    }),
  );
  const measuredOn = new Map(
    confirmations.map(({ code, measuredOn }) => [`pcgen:${code}`, measuredOn]),
  );
  const registry: Section15Registry = Object.fromEntries(
    Object.entries(structuredClone(sourceRegistry)).map(([key, notice]) => {
      const date = measuredOn.get(key);
      return [
        key,
        date === undefined
          ? notice
          : { ...notice, reviewStatus: 'unreviewed', checkedOn: date },
      ];
    }),
  );
  return { confirmations, registry };
}

/**
 * The committed Section 15 state with every confirmation's waivers caught up
 * with the chain holds committed now (`--adopt-waivers`, in memory only):
 * the state as if no later batch had added a chain hold since the
 * confirmations were written. A scenario built on it proves the same thing
 * whatever chain holds later curation batches register on a matched book.
 * `files` is what the matcher writes for that state.
 */
export async function settledSection15({
  measuredOn = '2026-10-19',
}: { measuredOn?: string } = {}) {
  const state = await readSection15State({ root: process.cwd() });
  const rendered = await renderSection15Files({
    state,
    measuredOn,
    adoptWaivers: true,
  });
  return {
    state: {
      ...state,
      previous: rendered.confirmations,
      registry: rendered.registry,
    },
    files: rendered.files,
  };
}
