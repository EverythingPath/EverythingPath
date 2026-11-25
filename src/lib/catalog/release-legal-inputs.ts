import { z } from 'zod';
import { reviewedAdmissionSchema } from './admission-schema';
import { legalResourcesSchema } from './legal-types';

export const releaseLegalInputsSchema = z.object({
  registry: reviewedAdmissionSchema.shape.registry,
  resources: legalResourcesSchema,
  requiredNotices: z.array(z.string().trim().min(1)),
  permanentNoticeSuperset: legalResourcesSchema.shape.permanentNoticeSuperset,
});
