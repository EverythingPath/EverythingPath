import { z } from 'zod';

export const numberPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

export function numberField(label: string, isOptional = false) {
  return z.string().superRefine((raw, context) => {
    const value = raw.trim();
    if (!value) {
      if (!isOptional)
        context.addIssue({ code: 'custom', message: `${label} is required` });
      return;
    }
    if (!numberPattern.test(value) || !Number.isFinite(Number(value)))
      context.addIssue({
        code: 'custom',
        message: `${label} must be a number`,
      });
  });
}

export function nonnegativeIntegerField(
  label: string,
  {
    optional = false,
    numberMessage,
    requiredMessage,
  }: {
    optional?: boolean;
    numberMessage?: string;
    requiredMessage?: string;
  } = {},
) {
  const wholeNumberMessage = `${label} must be a whole number of 0 or more`;
  return z.string().superRefine((raw, context) => {
    const value = raw.trim();
    if (!value) {
      if (!optional)
        context.addIssue({
          code: 'custom',
          message: requiredMessage ?? `${label} is required`,
        });
      return;
    }
    if (!numberPattern.test(value) || !Number.isFinite(Number(value)))
      context.addIssue({
        code: 'custom',
        message: numberMessage ?? `${label} must be a number`,
      });
    else if (!Number.isInteger(Number(value)) || Number(value) < 0)
      context.addIssue({ code: 'custom', message: wholeNumberMessage });
  });
}
