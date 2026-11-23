import { z } from 'zod';

export const availableLimbsSchema = z.string().superRefine((raw, ctx) => {
  if (!raw.trim())
    ctx.addIssue({
      code: 'custom',
      message: 'Available limbs is required',
    });
  else if (!/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(Number(raw)))
    ctx.addIssue({
      code: 'custom',
      message: 'Available limbs must be a whole number of 0 or more',
    });
});
