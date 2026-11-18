import { z } from 'zod';
import { getFantasyDateParts } from '~/helpers/ARDateConverter';

// Campaign name contract: 2–50 characters, counted without surrounding
// spaces so a blank name reads as missing rather than as too short.
export const campaignNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .min(2, 'Name must be at least 2 characters.')
  .max(50, 'Name must be 50 characters or fewer.');

export const createCampaignSchema = z.object({
  name: campaignNameSchema,
  description: z.string(),
});
export type CreateCampaignInput = z.input<typeof createCampaignSchema>;
export type CreateCampaignValues = z.output<typeof createCampaignSchema>;

// The in-game date is stored as a date-only `YYYY-MM-DD` string (the
// picker's representation); the empty string means no date is recorded.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseInGameDate(value: string): Date | null {
  if (!DATE_ONLY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject overflowing days such as 2026-02-31 instead of rolling them over.
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/** "12 Pharast 4717", or null when no date is recorded or it is unreadable. */
export function formatInGameDate(value: string | undefined): string | null {
  const date = value ? parseInGameDate(value) : null;
  if (!date) return null;
  const parts = getFantasyDateParts(date);
  return `${parts.day} ${parts.month.name} ${parts.year}`;
}

export const campaignHeaderSchema = z.object({
  description: z.string(),
  inGameDate: z
    .string()
    .refine(
      (value) => value === '' || parseInGameDate(value) !== null,
      'Choose a valid in-game date.',
    ),
});
export type CampaignHeaderValues = z.infer<typeof campaignHeaderSchema>;
export type CampaignHeaderField = keyof CampaignHeaderValues;
export const campaignHeaderFields: CampaignHeaderField[] = [
  'description',
  'inGameDate',
];

/** The saved header values of a campaign document, with '' for no date. */
export function savedHeaderValues(campaign: {
  description: string;
  inGameDate?: string;
}): CampaignHeaderValues {
  return {
    description: campaign.description,
    inGameDate: campaign.inGameDate ?? '',
  };
}
