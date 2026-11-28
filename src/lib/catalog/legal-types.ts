import { z } from 'zod';

export type { Section15Registry } from './admission-schema.ts';

const text = z.string().trim().min(1);
const legalNoticeSchema = z.object({
  id: text,
  title: text,
  text: z.string().min(1),
  provenance: z.array(text).min(1),
});

export const legalResourcesSchema = z.object({
  ogl: legalNoticeSchema,
  upstreamNotices: z.array(legalNoticeSchema),
  projectNotice: legalNoticeSchema.nullable(),
  section8: legalNoticeSchema,
  paizo: legalNoticeSchema,
  permanentNoticeSuperset: z.array(legalNoticeSchema),
});

export type LegalNotice = z.infer<typeof legalNoticeSchema>;
export type LegalResources = z.infer<typeof legalResourcesSchema>;
