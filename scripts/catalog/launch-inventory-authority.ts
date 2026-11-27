import { parseLaunchInventoryDocument } from './launch-inventory-document.ts';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { launchBindingSchema } from './launch-inventory-schema.ts';

const text = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const owner = z.strictObject({
  issue: z.number().int().positive(),
  responsibility: text,
  evidence: z.array(text).min(1),
});
const data: unknown = parseLaunchInventoryDocument(
  JSON.parse(
    readFileSync(
      new URL('./scopes/campaign-mvp-v1.authority.json', import.meta.url),
      'utf8',
    ),
  ),
);

// Validate unknown data without asking the compiler to infer the full inventory.
export const launchAuthority = z
  .object({
    scopeVersion: z.literal('campaign-mvp-v1'),
    baseline: z.string().regex(/^[a-f0-9]{40}$/),
    roots: z.array(
      z.strictObject({
        key: text,
        name: text,
        kind: z.enum(['class', 'race', 'trait']),
        repository: z.enum(['pf1', 'pf1-content']),
        path: text,
        sha256: hash,
      }),
    ),
    batches: z.array(
      z.strictObject({
        issue: z.number().int().positive(),
        title: text,
        bodySha256: hash,
        originalInventory: z.array(text).min(1).max(100),
      }),
    ),
    classPartitions: z.array(
      z
        .object({
          issue: z.number().int().positive(),
          original_inventory: z.array(text),
          mvp_keys: z.array(text),
          remaining_keys: z.array(text),
        })
        .passthrough(),
    ),
    appendix: z
      .object({
        bodySha256: hash,
        cases: z.array(z.strictObject({ id: text, group: text, text })),
      })
      .passthrough(),
    genericClosure: z.strictObject({
      status: text,
      unresolved: z.array(z.strictObject({ key: text, owner, question: text })),
    }),
    poolCommitments: z.array(
      z.strictObject({
        id: text,
        root: text,
        members: z.array(text),
        membersSha256: hash,
      }),
    ),
    preservedBeforeReliance: z.strictObject({
      keys: z.array(text),
      owner,
      requirement: text,
    }),
    companionAuditSha256: hash,
    coreAuditSha256: hash,
    advancedAuditSha256: hash,
    checkpointAuthoritySha256: hash,
    noticeAuthoritySha256: hash,
    resourceBindings: z
      .array(z.strictObject({ key: text, source: launchBindingSchema }))
      .length(9),
  })
  .passthrough()
  .parse(data);
