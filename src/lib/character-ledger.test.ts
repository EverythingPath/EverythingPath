import { expect, test } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import { characterLedgerDetails } from './character-ledger';

test('prepared full ledger details show permanent values and expose sheet editing without a presentation label', () => {
  const details = characterLedgerDetails(
    {
      _id: 'hessa',
      campaignId: 'ironfang',
      sheetMode: 'full',
      level: 5,
      strength: 18,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 8,
      charisma: 16,
    },
    { campaignId: 'ironfang' as Id<'campaign'>, organizationId: 'org' },
  );
  expect(details).toEqual({
    level: 5,
    scores: {
      strength: 18,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 8,
      charisma: 16,
    },
    statisticsReadOnly: true,
    canBuildOut: false,
    sheetHref:
      '/characters/hessa?from=%2Fcampaigns%2Fironfang%2Fofficers&organizationId=org',
  });
});
