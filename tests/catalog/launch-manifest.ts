import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema';

function deepFreeze(value: unknown) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value))
    return;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
}

/** A fresh copy of a validated manifest's plain JSON objects and arrays. */
function copyValidated(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copyValidated);
  if (value === null || typeof value !== 'object') return value;
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value))
    copy[key] = copyValidated(item);
  return copy;
}

/**
 * Decodes and validates a committed inventory document once and returns a
 * factory for independent manifests. The validated value is frozen and each
 * manifest is a fresh copy of it, so one case's edits never reach another and
 * editing the frozen value throws. The public parser's result is plain JSON,
 * so a copy equals reparsing it at a quarter of the cost; each case's
 * inspection still validates the edited manifest through the public parser.
 */
export function launchManifestCopies(document: unknown): () => LaunchManifest {
  const validated = parseLaunchInventory(document);
  deepFreeze(validated);
  return () => copyValidated(validated) as LaunchManifest;
}
