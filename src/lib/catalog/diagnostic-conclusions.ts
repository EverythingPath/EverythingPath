import { z } from 'zod';
import type {
  AttributionAssessment,
  AttributionEvidence,
} from './admission-schema';

export const diagnosticConclusionRefSchema = z.strictObject({
  evidenceId: z.string().min(1),
  externalKey: z.string().min(1),
});
export const diagnosticConclusionSchema = z.strictObject({
  externalKey: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(1),
  suffix: z.string(),
});

/** References always bind both the evidence identity and its subject. */
export function resolveDiagnosticConclusion({
  reference,
  evidence,
}: {
  reference: z.infer<typeof diagnosticConclusionRefSchema>;
  evidence: AttributionEvidence;
}) {
  const ref = diagnosticConclusionRefSchema.parse(reference);
  const conclusion = evidence[ref.evidenceId]?.conclusion;
  if (conclusion?.externalKey !== ref.externalKey)
    throw new Error(
      `Missing or mismatched diagnostic conclusion: ${ref.evidenceId} / ${ref.externalKey}`,
    );
  return conclusion.paragraphs;
}

export function resolveAssessmentRationale({
  assessment,
  evidence,
}: {
  assessment: AttributionAssessment;
  evidence: AttributionEvidence;
}) {
  return assessment.conclusionRef
    ? `${assessment.rationale} ${resolveDiagnosticConclusion({ reference: assessment.conclusionRef, evidence }).join(' ')}`
    : assessment.rationale;
}

export function resolveAttributionEvidenceContent({
  evidenceId,
  evidence,
}: {
  evidenceId: string;
  evidence: AttributionEvidence;
}) {
  const entry = evidence[evidenceId];
  if (!entry) throw new Error(`Missing attribution evidence: ${evidenceId}`);
  return entry.conclusion
    ? `${entry.content} ${entry.conclusion.paragraphs.join(' ')}${entry.conclusion.suffix}`
    : entry.content;
}
