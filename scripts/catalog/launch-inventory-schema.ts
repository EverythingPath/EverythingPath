import { z } from 'zod';
import { catalogKeySchema } from '../../src/lib/catalog/imported-entry-schema.ts';
import type { PcgenPrerequisite } from './pcgen/pre.ts';

const text = z.string().trim().min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const prerequisite: z.ZodType<PcgenPrerequisite> = z.lazy(() =>
  z.strictObject({
    kind: text,
    isNegated: z.boolean(),
    count: z.number().int().nullable(),
    items: z.array(z.union([z.string().min(1), prerequisite])),
  }),
);
const owner = z.strictObject({
  issue: z.number().int().positive(),
  responsibility: text,
  evidence: z.array(text).min(1),
});
export const launchBindingSchema = z.strictObject({
  repository: z.enum(['pf1', 'pf1-content', 'pcgen', 'prd', 'everythingpath']),
  pin: text,
  locator: text,
  rawSha256: sha256,
  effectiveSha256: sha256.nullable(),
  rawFileSha256: sha256.optional(),
  rawLineSha256: sha256.optional(),
});
// Source requirements and selector values are not playable catalog identities.
const semanticIdentity = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('catalog'), key: catalogKeySchema }),
  z.strictObject({ kind: z.literal('selector'), parameter: text }),
  z.strictObject({
    kind: z.literal('source-choice'),
    parent: catalogKeySchema,
    locator: text,
    nativeDefinition: text,
  }),
  z.strictObject({
    kind: z.literal('source-owned'),
    allocation: z.enum(['not needed', 'required', 'output unresolved']),
    playableOwner: z.number().int().positive().nullable(),
  }),
]);
export const semanticContractSchema = z.strictObject({
  id: text,
  root: catalogKeySchema,
  from: text,
  name: text,
  scope: z.enum(['required', 'retained']).default('required'),
  kind: z.enum([
    'requirement',
    'selection',
    'grant',
    'replacement',
    'prerequisite',
    'list',
    'advancement',
    'equipment',
    'interface',
    'accounting',
  ]),
  identity: semanticIdentity,
  conditionalEffect: z
    .strictObject({
      kind: z.enum(['temporary feat', 'spell-like ability', 'monk ability']),
      kiCost: z.number().int().nonnegative().nullable(),
      activation: z.enum(['free', 'immediate', 'standard', 'source ability']),
      duration: z.enum(['until next turn', 'spell duration', 'source ability']),
      permanent: z.literal(false),
      casterLevel: z.enum(['monk level', 'not applicable']),
      concentrationAbility: z.enum(['wisdom', 'not applicable']),
      dc: text,
    })
    .optional(),
  targets: z.array(text),
  borrowedPowerKeys: z.array(catalogKeySchema).default([]),
  sources: z.array(launchBindingSchema).min(1),
  channel: text,
  contract: text,
  disposition: z.enum(['calculated', 'recorded choice']).default('calculated'),
  conditions: z.array(text),
  parameters: z.array(z.strictObject({ name: text, values: z.array(text) })),
  acquisitionLevels: z.array(z.number().int().min(1).max(20)),
  castingContexts: z.array(text),
  excludedContexts: z.array(text),
  prerequisitePolicy: z.enum([
    'ordinary',
    'waived in channel',
    'not applicable',
  ]),
  nativeRequirements: z.array(text),
  minimumClassLevel: z.number().int().min(1).max(20).nullable().default(null),
  spellAccess: z
    .strictObject({
      destination: z.enum([
        'class list',
        'known',
        'book',
        'domain',
        'borrowed book',
        'casting exception',
      ]),
      permanent: z.boolean(),
      exchangeable: z.boolean(),
      consumesKnownAllowance: z.boolean(),
      levelSource: z.enum(['source class', 'borrowed class', 'selected spell']),
      count: z.number().int().positive().nullable(),
      slotAdjustment: z.number().int(),
      alternatives: z
        .array(
          z.strictObject({
            count: z.number().int().positive(),
            minimumBelowHighest: z.number().int().nonnegative(),
          }),
        )
        .default([]),
      perLevel: z
        .array(
          z.strictObject({
            level: z.number().int().min(0).max(9),
            count: z.number().int().positive(),
          }),
        )
        .default([]),
      requiresAbsentFromReceivingList: z.boolean().default(false),
      erasesBorrowedEntry: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  replacement: z
    .strictObject({
      allSpecified: z.boolean(),
      preserveParentSlots: z.boolean(),
      entries: z.array(text),
    })
    .nullable()
    .default(null),
  loan: z
    .strictObject({
      firstLevelOnly: z.literal(true),
      sourceLevel: z.literal(1),
      grantsArcana: z.literal(false),
      grantsSpells: z.literal(false),
      grantsFeats: z.literal(false),
      grantsSlots: z.literal(false),
      existingProgressionBranch: z.boolean(),
    })
    .nullable()
    .default(null),
  prerequisites: z.array(prerequisite).default([]),
  qualification: z
    .enum([
      'source contract',
      'product policy',
      'held discrepancy',
      'unresolved output',
      'policy excluded',
    ])
    .default('source contract'),
  implementationOwner: owner,
  publicTestOwner: owner,
});
const observation = z.strictObject({
  state: z.enum(['held', 'unreviewed', 'verified']),
  evidence: z.array(text).min(1),
});
export const launchRowSchema = z.strictObject({
  key: text,
  catalogKey: catalogKeySchema.nullable(),
  kind: text,
  name: text,
  requirement: z.enum(['required', 'optional']),
  sources: z.array(launchBindingSchema).min(1),
  inventoryOwner: owner,
  implementationOwner: owner,
  publicTestOwner: owner,
  mechanisms: z
    .array(
      z.strictObject({
        name: text,
        disposition: z.enum([
          'calculated',
          'recorded choice',
          'permitted prose',
        ]),
        contract: text,
        status: z.enum(['outstanding', 'reused', 'permitted']),
        evidence: z.array(text).min(1),
      }),
    )
    .min(1),
  admission: observation,
  structure: observation,
  contentEvidence: observation,
  noticeEvidence: observation,
  holds: z.array(z.strictObject({ owner, reason: text })),
  research: z.array(z.strictObject({ owner, question: text })),
});
const edge = z.strictObject({
  from: text,
  to: text,
  kind: z.enum([
    'requirement',
    'option',
    'grant',
    'prerequisite',
    'resource',
    'notice',
    'citation',
  ]),
  reason: text,
  condition: text.nullable(),
  evidence: z.array(text).min(1),
});
const pool = z.strictObject({
  id: text,
  root: catalogKeySchema,
  name: text,
  selector: text,
  purpose: z
    .enum(['eligibility', 'retained inventory', 'metadata'])
    .default('retained inventory'),
  sources: z.array(launchBindingSchema).min(1),
  members: z.array(text),
  membersSha256: sha256,
  remainder: z.array(z.strictObject({ locator: text, reason: text })),
  research: z.array(z.strictObject({ owner, question: text })),
});
const checkpoint = z.strictObject({
  classKey: catalogKeySchema,
  className: text,
  level: z.number().int().min(1).max(20),
  source: launchBindingSchema,
  printed: z.array(text),
  columns: z.record(text, z.string()),
  sourceColumns: z.record(text, z.string()),
  scheduledKeys: z.array(catalogKeySchema),
  scheduleStatus: z.enum(['reviewed schedule', 'outstanding schedule']),
  owner,
});
export const companionPartitionSchema = z.strictObject({
  id: text,
  root: catalogKeySchema,
  name: text,
  sources: z.array(launchBindingSchema).min(1),
  entries: z
    .array(
      z.strictObject({
        key: catalogKeySchema,
        name: text,
        eligibility: z.enum(['baseline', 'conditional', 'remainder']),
        reason: text,
        condition: text.nullable(),
        sources: z.array(launchBindingSchema).min(1),
      }),
    )
    .min(1),
});
export const partySupplementSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('pending'),
    requiredInputs: z.array(text).min(1),
    owner: text,
  }),
  z.strictObject({
    status: z.literal('recorded'),
    owner: text,
    builds: z
      .array(
        z.strictObject({
          character: text,
          at: z.enum(['current', 'next']),
          level: z.number().int().min(1).max(20),
          classes: z
            .array(
              z.strictObject({
                key: catalogKeySchema,
                levels: z.number().int().min(1).max(20),
              }),
            )
            .min(1),
          bloodlines: z.array(catalogKeySchema),
          choices: z.array(
            z.strictObject({ slot: text, key: catalogKeySchema }),
          ),
          spells: z.array(catalogKeySchema),
          feats: z.array(catalogKeySchema),
          gear: z.array(catalogKeySchema),
          companions: z.array(catalogKeySchema),
          evidence: z.array(text).min(1),
        }),
      )
      .min(2),
  }),
]);
export const launchManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  scopeVersion: z.literal('campaign-mvp-v1'),
  authoritySha256: sha256,
  roots: z.array(
    z.strictObject({ key: catalogKeySchema, name: text, kind: text }),
  ),
  rows: z.array(launchRowSchema),
  edges: z.array(edge),
  pools: z.array(pool),
  companionPartitions: z.array(companionPartitionSchema),
  semanticContracts: z.array(semanticContractSchema).default([]),
  semanticContexts: z
    .array(
      z.strictObject({
        root: catalogKeySchema,
        contexts: z.array(text).min(1),
      }),
    )
    .default([]),
  sourceAccounting: z
    .array(
      z.strictObject({
        id: text,
        family: text,
        name: text,
        root: catalogKeySchema,
        keys: z.array(text),
        sources: z.array(launchBindingSchema).min(1),
        eligibility: z.enum([
          'baseline',
          'conditional',
          'remainder',
          'helper',
          'unresolved',
          'metadata',
        ]),
        reason: text,
        owner,
      }),
    )
    .default([]),
  checkpoints: z.array(checkpoint),
  batches: z.array(
    z.strictObject({
      issue: z.number().int().positive(),
      title: text,
      bodySha256: sha256,
      originalInventory: z.array(catalogKeySchema).min(1).max(100),
      requiredKeys: z.array(catalogKeySchema),
      optionalKeys: z.array(catalogKeySchema),
      remainderKeys: z.array(catalogKeySchema),
    }),
  ),
  ownerInventories: z.array(
    z.strictObject({
      issue: z.number().int().positive(),
      selector: text,
      requiredLocators: z.array(text),
      remainderLocators: z.array(text),
      sources: z.array(launchBindingSchema).min(1),
    }),
  ),
  coverage: z.array(
    z.strictObject({
      contract: text,
      disposition: z.enum(['reused', 'launch work', 'preserved remainder']),
      owners: z.array(owner).min(1),
      keys: z.array(text),
      mechanisms: z.array(text).min(1),
      evidence: z.array(text).min(1),
    }),
  ),
  research: z.array(z.strictObject({ owner, question: text })),
  party: partySupplementSchema,
});

export type LaunchManifest = z.infer<typeof launchManifestSchema>;
export type LaunchRow = z.infer<typeof launchRowSchema>;
export type LaunchBinding = z.infer<typeof launchBindingSchema>;
export type LaunchOwner = LaunchRow['inventoryOwner'];
