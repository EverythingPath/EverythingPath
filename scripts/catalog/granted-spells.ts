import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  catalogKeySchema,
  type ImportedClassFeatureSpellcasting,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import type { PreviewEntry } from './map.ts';
import { sourceDescription, type SourceRecord } from './records.ts';
import {
  hashReviewPayload,
  readReviewState,
  reviewStateShapes,
  type CheckedReview,
  type ReviewedRecord,
} from './review-receipts.ts';
import reviewedGrantedSpellsData from './reviewed-granted-spells.json';

/**
 * Granted-levels S1 (research/granted-levels-design.md §1): the reviewed map
 * of the class features that grant Spells, a domain or a sorcerer bloodline.
 * Foundry's class features carry no casting facts, and a Spell's
 * `grantedLevels` names its feature only by a (kind, name) pair, so a record
 * holds what the feature's body lists: its Spells by level and spell key, the
 * style, the schedule, the option kind and the extra slot. Each record is
 * bound to the SHA-256 of that body (`sourceDescription`), and the pair it
 * supplies is the one the Spells' `grantedLevels` name, so the launch scope
 * can match the two (`launch-verification.ts`). A record is written
 * `drafted`; only a checked one reaches the importer.
 *
 * An option-owner record marks a prompt-owning feature whose own text grants
 * its chosen options' powers only, such as the Inquisitor's Domain (APG
 * p. 38): the feature gains `chooses` and `optionGrantsSpells: false`, which
 * withholds the options' Granted Spells and extra slot (PRD #251 D10).
 */
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const commonShape = {
  /** The granting class feature. */
  featureKey: catalogKeySchema,
  /** The SHA-256 of the feature's body, which lists its Spells by level. */
  bodySha256: sha256Schema,
  /** One Spell per level, by spell key. */
  spells: z
    .array(
      z.strictObject({
        spellLevel: z.number().int().min(1).max(9),
        spellKey: catalogKeySchema,
      }),
    )
    .min(1)
    .refine(
      (spells) =>
        new Set(spells.map(({ spellLevel }) => spellLevel)).size ===
        spells.length,
      'A granted-spell record grants two Spells at one level.',
    ),
};
/** The pair the Spells' `grantedLevels` name, such as (domain, Chaos). */
const pairOf = <Kind extends string>(kind: Kind) =>
  z.strictObject({ kind: z.literal(kind), name: z.string().min(1) });
/**
 * The two routes. A domain grants slot-style, at every spell level the
 * Spellcasting casts, with the domain slot. A sorcerer bloodline grants
 * schedule-style: spell level N at sorcerer 2N + 1.
 */
const routeShapes = {
  domain: {
    grantedLevels: pairOf('domain'),
    optionKind: z.literal('domain'),
    style: z.literal('slot'),
    extraSlot: z.literal('domain'),
  },
  bloodline: {
    grantedLevels: pairOf('bloodline'),
    optionKind: z.literal('bloodline'),
    style: z.literal('schedule'),
    schedule: z.literal('sorcerer'),
  },
};
const recordSchema = z.union([
  z.strictObject({
    ...commonShape,
    ...routeShapes.domain,
    ...reviewStateShapes.drafted,
  }),
  z.strictObject({
    ...commonShape,
    ...routeShapes.domain,
    ...reviewStateShapes.checked,
  }),
  z.strictObject({
    ...commonShape,
    ...routeShapes.bloodline,
    ...reviewStateShapes.drafted,
  }),
  z.strictObject({
    ...commonShape,
    ...routeShapes.bloodline,
    ...reviewStateShapes.checked,
  }),
]);
export type GrantedSpellRecord = z.infer<typeof recordSchema>;

const ownerShape = {
  /** The prompt-owning class feature. */
  featureKey: catalogKeySchema,
  /** The SHA-256 of the feature's body, which grants powers only. */
  bodySha256: sha256Schema,
  chooses: z.literal('domain'),
  optionGrantsSpells: z.literal(false),
};
const ownerSchema = z.union([
  z.strictObject({ ...ownerShape, ...reviewStateShapes.drafted }),
  z.strictObject({ ...ownerShape, ...reviewStateShapes.checked }),
]);
export type OptionOwnerRecord = z.infer<typeof ownerSchema>;

/** The map file's schema (`reviewed-granted-spells.json`). */
export const grantedSpellMapSchema = z.strictObject({
  version: z.literal(1),
  features: z.array(recordSchema),
  optionOwners: z.array(ownerSchema),
});
/** The map's path, from the repository root. */
export const grantedSpellMapPath =
  'scripts/catalog/reviewed-granted-spells.json';

/**
 * The map, refused whole when a record is malformed or follows neither
 * route, or shares its feature with another record or its (kind, name) pair
 * with another granting record.
 */
export function parseGrantedSpellMap(value: unknown) {
  const map = grantedSpellMapSchema.parse(value);
  const seen = new Set<string>();
  const claim = (key: string) => {
    if (seen.has(key))
      throw new Error(`Two granted-spell records share ${key}.`);
    seen.add(key);
  };
  for (const record of map.features) {
    claim(record.featureKey);
    claim(
      JSON.stringify([record.grantedLevels.kind, record.grantedLevels.name]),
    );
  }
  for (const owner of map.optionOwners) claim(owner.featureKey);
  return { features: map.features, optionOwners: map.optionOwners };
}

/**
 * Lists the map's records as a review receipt covers them (#757): by feature
 * and body hash, so another body is another record, with their payload (what
 * a record grants, or an option owner withholds). `check` marks the record
 * itself checked, so the record step writes the map it read.
 */
export function listGrantedSpellReviews(map: {
  features: GrantedSpellRecord[];
  optionOwners: OptionOwnerRecord[];
}): ReviewedRecord[] {
  return [...map.features, ...map.optionOwners].map((record) => {
    const payload: Record<string, unknown> = { ...record };
    for (const field of [
      'featureKey',
      'bodySha256',
      'status',
      'reviewedBy',
      'reviewedOn',
      'receipt',
    ])
      delete payload[field];
    return {
      id: `granted-spells ${record.featureKey} sha256:${record.bodySha256}`,
      sources: [
        { subject: record.featureKey, sourceSha256: record.bodySha256 },
      ],
      payloadSha256: hashReviewPayload(payload),
      review: readReviewState(record),
      check: (review: CheckedReview) => Object.assign(record, review),
    };
  });
}

/** The committed map (`reviewed-granted-spells.json`). */
const reviewedMap = parseGrantedSpellMap(reviewedGrantedSpellsData);
export const reviewedGrantedSpells = reviewedMap.features;
export const reviewedOptionOwners = reviewedMap.optionOwners;

function bodySha256(record: SourceRecord) {
  return createHash('sha256').update(sourceDescription(record)).digest('hex');
}

const field = 'spellcasting';

function refuse(entry: PreviewEntry, reason: string, value: unknown) {
  return {
    ...entry,
    unsupported: [...entry.unsupported, { field, reason, value }],
  };
}
const staleBody = 'The granted-spell record was reviewed against another body.';

/** The feature's facts, or an issue, from a checked granting record. */
function withGrantingRecord({
  entry,
  record,
  resolveKey,
}: {
  entry: PreviewEntry;
  record: GrantedSpellRecord;
  resolveKey: (key: string) => string | undefined;
}): PreviewEntry {
  const spells = record.spells.flatMap(({ spellLevel, spellKey }) => {
    const resolved = resolveKey(spellKey);
    return resolved ? [{ spellLevel, spellKey: resolved }] : [];
  });
  if (spells.length !== record.spells.length)
    return refuse(
      entry,
      'Missing or out-of-scope Granted Spell.',
      record.spells
        .filter(({ spellKey }) => !resolveKey(spellKey))
        .map(({ spellKey }) => spellKey),
    );
  return withFacts(
    entry,
    record.style === 'slot'
      ? {
          optionKind: record.optionKind,
          extraSlot: record.extraSlot,
          grantedSpells: { style: record.style, spells },
        }
      : {
          optionKind: record.optionKind,
          grantedSpells: {
            style: record.style,
            schedule: record.spells.map(({ spellLevel }) => ({
              spellLevel,
              classLevel: 2 * spellLevel + 1,
            })),
            spells,
          },
        },
  );
}

function withFacts(
  entry: PreviewEntry,
  spellcasting: ImportedClassFeatureSpellcasting,
): PreviewEntry {
  return entry.detail.kind === 'classFeature'
    ? { ...entry, detail: { ...entry.detail, spellcasting } }
    : entry;
}

/**
 * A class feature with a checked map record gains its casting facts: a
 * granting record's, with each Spell named by its release key, or an option
 * owner's `chooses` and `optionGrantsSpells: false`. A record bound to
 * another body, or naming a Spell the import doesn't hold, gives no facts
 * and an `unsupported` issue instead, so the feature never grants part of
 * its list. Every other entry is returned unchanged.
 */
export function withGrantedSpells({
  entry,
  record: source,
  resolveKey,
  records = reviewedGrantedSpells,
  owners = reviewedOptionOwners,
}: {
  entry: PreviewEntry;
  record: SourceRecord;
  resolveKey: (key: string) => string | undefined;
  records?: readonly GrantedSpellRecord[];
  owners?: readonly OptionOwnerRecord[];
}): PreviewEntry {
  if (entry.detail.kind !== 'classFeature') return entry;
  const checked = <T extends { featureKey: string; status: string }>(
    rows: readonly T[],
  ) =>
    rows.find(
      (row) => row.featureKey === entry.externalKey && row.status === 'checked',
    );
  const owner = checked(owners);
  if (owner)
    return owner.bodySha256 === bodySha256(source)
      ? withFacts(entry, {
          chooses: owner.chooses,
          optionGrantsSpells: owner.optionGrantsSpells,
        })
      : refuse(entry, staleBody, owner.bodySha256);
  const record = checked(records);
  if (!record) return entry;
  return record.bodySha256 === bodySha256(source)
    ? withGrantingRecord({ entry, record, resolveKey })
    : refuse(entry, staleBody, record.bodySha256);
}
