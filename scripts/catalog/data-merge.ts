import { z } from 'zod';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema.ts';
import { parseCuration } from './curation.ts';
import {
  checkCatalogDataInvariants,
  describeCatalogIdentity,
  isEntry,
  joinCatalogData,
  serializeCatalogData,
  splitCatalogData,
  writeCatalogData,
  type CatalogCollections,
  type CatalogDataFile,
} from './data-files.ts';

const text = z.string().trim().min(1);
const validators: Record<CatalogDataFile, (value: unknown) => unknown> = {
  curation: parseCuration,
  assessments: (value) =>
    reviewedAdmissionSchema.shape.assessments.parse(value),
  evidence: (value) => reviewedAdmissionSchema.shape.evidence.parse(value),
  registry: (value) => reviewedAdmissionSchema.shape.registry.parse(value),
  heldNotices: (value) =>
    z
      .array(
        z.strictObject({
          id: text,
          notices: z.array(text).min(1),
          evidence: z.array(text).min(1),
        }),
      )
      .parse(value),
};

type Side = 'ours' | 'theirs';

function registryCollisions(collections: CatalogCollections) {
  const named = new Map<string, Set<string>>();
  for (const [code, notice] of collections.get('registry') ?? []) {
    const aliases = isEntry(notice) ? notice.aliases : undefined;
    for (const identifier of new Set([
      code,
      ...(Array.isArray(aliases) ? aliases.map(String) : []),
    ]))
      named.set(identifier, new Set([...(named.get(identifier) ?? []), code]));
  }
  return new Map(
    [...named]
      .filter(([, codes]) => codes.size > 1)
      .map(([id, codes]) => [id, [...codes].sort().join(' and ')]),
  );
}

function mergeEntries({
  describe,
  base,
  ours,
  theirs,
  same,
  differingFields,
}: {
  describe: (identity: string) => string;
  base: Map<string, unknown>;
  ours: Map<string, unknown>;
  theirs: Map<string, unknown>;
  same: (left: unknown, right: unknown) => boolean;
  differingFields: (left: unknown, right: unknown) => string[];
}) {
  const merged = new Map<string, unknown>();
  const conflicts: string[] = [];
  const identities = [
    ...new Set([...base.keys(), ...ours.keys(), ...theirs.keys()]),
  ].sort();
  for (const identity of identities) {
    const original = base.get(identity);
    const sides = { ours: ours.get(identity), theirs: theirs.get(identity) };
    if (sides.ours !== undefined && sides.theirs !== undefined) {
      if (same(sides.ours, sides.theirs) || same(original, sides.theirs))
        merged.set(identity, sides.ours);
      else if (same(original, sides.ours)) merged.set(identity, sides.theirs);
      else
        conflicts.push(
          `${describe(identity)}: ours and theirs differ in ${differingFields(sides.ours, sides.theirs).join(', ')}.`,
        );
      continue;
    }
    const kept: Side | undefined =
      sides.ours !== undefined
        ? 'ours'
        : sides.theirs !== undefined
          ? 'theirs'
          : undefined;
    if (!kept) continue;
    const entry = sides[kept];
    if (original === undefined) merged.set(identity, entry);
    else if (!same(original, entry))
      conflicts.push(
        `${describe(identity)}: deleted by ${kept === 'ours' ? 'theirs' : 'ours'} but changed by ${kept}.`,
      );
  }
  return { merged, conflicts };
}

/**
 * Three-way merges one shared catalog data file by entry identity. Entries
 * added on either side are kept, a change or deletion made on one side wins,
 * and an identity both sides changed differently is reported, never chosen.
 * The result is validated and written in canonical form. Evidence merges as
 * its decoded entries, from either the encoded or the earlier plain form, and
 * is written encoded with only the blobs the merged entries use.
 */
export function mergeCatalogData({
  file,
  base,
  ours,
  theirs,
}: {
  file: CatalogDataFile;
  base?: unknown;
  ours: unknown;
  theirs: unknown;
}): { text?: string; conflicts: string[] } {
  const split = (side: string, value: unknown) => {
    try {
      return splitCatalogData(file, value);
    } catch (error) {
      throw new Error(
        `${side}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  let sides: Record<'base' | Side, CatalogCollections>;
  try {
    sides = {
      base:
        base === undefined
          ? new Map<string, Map<string, unknown>>()
          : split('base', base),
      ours: split('ours', ours),
      theirs: split('theirs', theirs),
    };
  } catch (error) {
    return { conflicts: [error instanceof Error ? error.message : ''] };
  }
  const serialize = (value: unknown) =>
    value === undefined ? undefined : serializeCatalogData(file, value);
  const same = (left: unknown, right: unknown) =>
    left !== undefined && serialize(left) === serialize(right);
  const differingFields = (left: unknown, right: unknown) => {
    const fields = (value: unknown) => (isEntry(value) ? value : {});
    return [
      ...new Set([...Object.keys(fields(left)), ...Object.keys(fields(right))]),
    ]
      .filter((key) => !same(fields(left)[key], fields(right)[key]))
      .sort();
  };
  const merged: CatalogCollections = new Map();
  const conflicts: string[] = [];
  for (const collection of sides.ours.keys()) {
    const result = mergeEntries({
      describe: (identity) =>
        describeCatalogIdentity({ file, collection, identity }),
      base: sides.base.get(collection) ?? new Map<string, unknown>(),
      ours: sides.ours.get(collection) ?? new Map<string, unknown>(),
      theirs: sides.theirs.get(collection) ?? new Map<string, unknown>(),
      same,
      differingFields,
    });
    merged.set(collection, result.merged);
    conflicts.push(...result.conflicts);
  }
  if (conflicts.length) return { conflicts };
  conflicts.push(...checkCatalogDataInvariants(file, merged));
  if (file === 'registry') {
    const existing = new Set([
      ...registryCollisions(sides.ours).keys(),
      ...registryCollisions(sides.theirs).keys(),
    ]);
    for (const [identifier, codes] of registryCollisions(merged))
      if (!existing.has(identifier))
        conflicts.push(
          `Registry identifier ${identifier} is named by both ${codes}.`,
        );
  }
  if (conflicts.length) return { conflicts };
  const value = joinCatalogData(file, merged);
  try {
    validators[file](value);
  } catch (error) {
    return {
      conflicts: [
        `Merged ${file} is invalid: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  return { text: writeCatalogData(file, value), conflicts };
}
