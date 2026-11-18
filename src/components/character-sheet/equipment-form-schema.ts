import { z } from 'zod';

/** The longest material or foe the sheet keeps, as the writer enforces. */
export const maxItemPartText = 64;

export const equipmentFormSchema = z.object({
  masterwork: z.boolean(),
  enhancement: z.string().superRefine((value, context) => {
    if (!value.trim())
      context.addIssue({ code: 'custom', message: 'Enhancement is required' });
    else if (
      !/^\d+$/.test(value.trim()) ||
      !Number.isSafeInteger(Number(value))
    )
      context.addIssue({
        code: 'custom',
        message: 'Enhancement must be a whole number of 0 or more',
      });
  }),
  material: z
    .string()
    .refine((value) => value.trim().length <= maxItemPartText, {
      message: `Name the material in ${maxItemPartText} characters or fewer`,
    }),
});

/**
 * One item part's recorded gear state as its editors read it (#306, #408):
 * masterwork, enhancement and material. Each field saves on its own through
 * `useAttackWeaponEndForm`, in the routine panel and the Gear panel alike.
 */
export type EquipmentValues = {
  masterwork?: boolean;
  enhancement?: number;
  material?: string | null;
};
