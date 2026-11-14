import { readFileSync } from 'node:fs';
import { z } from 'zod';

const repairSchema = z.object({
  disposition: z.enum(['bounded', 'advisory']),
  normalizedAtomsSha256: z.string().regex(/^[a-f0-9]{64}$/),
  facts: z.array(z.number().int().nonnegative()),
  calculations: z.array(z.number().int().nonnegative()).optional(),
});
const auditSchema = z.object({
  status: z.literal('drafted'),
  issue: z.literal(739),
  facts: z.array(z.string()),
  batches: z.record(z.string(), z.record(z.string(), repairSchema)),
});
let audit: z.infer<typeof auditSchema> | undefined;

export function readPrerequisiteRepair739({
  batch,
  externalKey,
}: {
  batch: string;
  externalKey: string;
}) {
  if (!audit) {
    const raw: unknown = JSON.parse(
      readFileSync('tests/fixtures/prerequisites-739/audits.json', 'utf8'),
    );
    audit = auditSchema.parse(raw);
  }
  const record = audit.batches[batch]?.[externalKey];
  if (!record) {
    if (Object.values(audit.batches).some((records) => externalKey in records))
      throw new Error(`Prerequisite audit owner differs for ${externalKey}`);
    return;
  }
  const fact = (id: number) => {
    const text = audit?.facts[id];
    if (text === undefined)
      throw new Error(`Missing prerequisite audit fact ${id}`);
    return text;
  };
  return {
    ...record,
    recordedFacts: record.facts.map(fact),
    ...(record.calculations
      ? { recordedParserCalculations: record.calculations.map(fact) }
      : {}),
  };
}

export function recordedPrerequisiteFacts({
  batch,
  candidate,
}: {
  batch: string;
  candidate: {
    externalKey: string;
    mechanicsReview: { prerequisiteReview: { outstandingFacts: string[] } };
  };
}) {
  return (
    readPrerequisiteRepair739({ batch, externalKey: candidate.externalKey })
      ?.recordedFacts ??
    candidate.mechanicsReview.prerequisiteReview.outstandingFacts
  );
}
