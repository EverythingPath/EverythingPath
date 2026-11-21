import { describe, expect, it, vi } from 'vitest';
import Home from '~/app/page';
import {
  campaignPath,
  characterSheetPath,
  characterSpellsPath,
  decodeRouteSegment,
  normalizePhase,
  weekPath,
  parseHistorySelection,
  historyPath,
  parseCharacterSheetOrigin,
  resolveCharacterSheetBack,
  characterCreatePath,
  organizationSwitchPath,
  resolveNavigationLocation,
} from './campaign-routes';

vi.mock('next/navigation', () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT ${href}`);
  },
}));

it('recognizes independent sheet and creation routes without accepting them as Back origins', () => {
  expect(resolveNavigationLocation('/characters/hero?tab=gear')).toEqual({
    kind: 'character-sheet',
    characterId: 'hero',
  });
  expect(resolveNavigationLocation('/characters/new')).toEqual({
    kind: 'character-sheet',
    characterId: 'new',
  });
  expect(resolveNavigationLocation('/characters/hero/spells')).toEqual({
    kind: 'character-sheet',
    characterId: 'hero',
  });
  expect(resolveNavigationLocation('/characters/hero/unknown')).toBeUndefined();
  expect(resolveNavigationLocation('/characters/')).toBeUndefined();
  expect(
    parseCharacterSheetOrigin(new URLSearchParams('from=%2Fcharacters%2Fnew')),
  ).toBeUndefined();
});

it('opens a sheet’s Spells page with the sheet’s origin and one Spellcasting, and never accepts it as a Back origin', () => {
  const origin = {
    href: '/campaigns/alpha/characters',
    organization: { kind: 'organization', id: 'org' },
  } as const;
  expect(characterSpellsPath('hero/a', origin, 'wizard')).toBe(
    '/characters/hero%2Fa/spells?from=%2Fcampaigns%2Falpha%2Fcharacters&organizationId=org&spellcasting=wizard',
  );
  expect(
    characterSpellsPath('hero', {
      ...origin,
      organization: { kind: 'personal' },
    }),
  ).toBe(
    '/characters/hero/spells?from=%2Fcampaigns%2Falpha%2Fcharacters&organizationId=',
  );
  expect(characterSpellsPath('hero')).toBe('/characters/hero/spells');
  expect(
    parseCharacterSheetOrigin(
      new URLSearchParams('from=%2Fcharacters%2Fhero%2Fspells'),
    ),
  ).toBeUndefined();
  expect(
    organizationSwitchPath('/characters/hero/spells', 'from=%2Fcharacters'),
  ).toBe('/characters/hero/spells?from=%2Fcharacters');
});

describe('campaign navigation', () => {
  it('preserves officers origin and organization on an independent sheet', () => {
    const path = characterSheetPath('hero', {
      href: '/campaigns/first/officers',
      organization: { kind: 'organization', id: 'org/one' },
    });
    expect(path).toBe(
      '/characters/hero?from=%2Fcampaigns%2Ffirst%2Fofficers&organizationId=org%2Fone',
    );
    const origin = parseCharacterSheetOrigin(
      new URL(path, 'https://example.test').searchParams,
    );
    expect(resolveCharacterSheetBack(origin)).toEqual({
      href: '/campaigns/first/officers',
      label: 'Characters & officers',
    });
  });
  it('opens a private sheet without inventing a campaign and preserves campaign origins', () => {
    expect(characterSheetPath('hero/a?b#c%')).toBe(
      '/characters/hero%2Fa%3Fb%23c%25',
    );
    expect(
      characterSheetPath('hero', {
        href: '/campaigns/first/characters',
        organization: { kind: 'unrecorded' },
      }),
    ).toBe('/characters/hero?from=%2Fcampaigns%2Ffirst%2Fcharacters');
  });
  it('keeps all campaign sections scoped and encodes a campaign identifier once', () => {
    expect(campaignPath('table/a?b#c%')).toBe(
      '/campaigns/table%2Fa%3Fb%23c%25',
    );
    expect(campaignPath('first', 'week')).toBe('/campaigns/first/week');
    expect(campaignPath('first', 'history')).toBe('/campaigns/first/history');
    expect(campaignPath('first', 'militia')).toBe('/campaigns/first/militia');
    expect(campaignPath('first', 'characters')).toBe(
      '/campaigns/first/characters',
    );
    expect(campaignPath('first', 'setup')).toBe('/campaigns/first/setup');
  });
});

it('opens every supported Phase View locally and falls back to Upkeep', () => {
  for (const phase of [
    'upkeep',
    'activity',
    'event',
    'persistent',
    'summary',
  ]) {
    expect(normalizePhase(phase)).toBe(phase);
    expect(weekPath('first', phase)).toBe(
      `/campaigns/first/week?phase=${phase}`,
    );
  }
  for (const phase of [undefined, null, '', 'invalid', 'Activity']) {
    expect(normalizePhase(phase)).toBe('upkeep');
    expect(weekPath('first', phase)).toBe('/campaigns/first/week?phase=upkeep');
  }
});

it('keeps historical week, audit selection and paging in a reloadable campaign URL', () => {
  const path = historyPath('first', {
    week: 4,
    recordId: 'record/a?b#c',
    beforeSequence: 3,
  });
  expect(path).toBe(
    '/campaigns/first/history?week=4&recordId=record%2Fa%3Fb%23c&beforeSequence=3',
  );
  expect(
    parseHistorySelection(new URL(path, 'https://example.test').searchParams),
  ).toEqual({ week: 4, recordId: 'record/a?b#c', beforeSequence: 3 });
  expect(historyPath('first')).toBe('/campaigns/first/history');
  expect(parseHistorySelection(new URLSearchParams())).toEqual({});
});

it('discards malformed numeric history selectors without losing valid selection', () => {
  for (const value of [
    '',
    ' ',
    '-1',
    '1.5',
    'Infinity',
    'NaN',
    '1e3',
    '0x10',
    '9007199254740992',
    '2wrong',
  ]) {
    const params = new URLSearchParams({
      week: value,
      beforeSequence: value,
      recordId: 'selected',
    });
    expect(parseHistorySelection(params)).toEqual({ recordId: 'selected' });
  }
  expect(
    parseHistorySelection(
      new URLSearchParams('week=0&beforeSequence=0&recordId='),
    ),
  ).toEqual({ week: 0, beforeSequence: 0 });
  expect(
    parseHistorySelection(new URLSearchParams('week=4&beforeSequence=bad')),
  ).toEqual({ week: 4 });
});

it('keeps a malformed encoded id raw for the campaign gate', () => {
  expect(decodeRouteSegment('alpha%20beta')).toBe('alpha beta');
  expect(decodeRouteSegment('%E0%A4%A')).toBe('%E0%A4%A');
});

it("sends the app's entry to the campaign list", () => {
  expect(() => Home()).toThrow('REDIRECT /campaigns');
});

it('discards unrecognized and external sheet origins', () => {
  for (const from of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/characters/another',
    '/campaigns/one/unknown',
    '/campaigns/one/officers#fragment',
  ]) {
    expect(
      parseCharacterSheetOrigin(
        new URLSearchParams({ from, organizationId: 'org' }),
      ),
    ).toBeUndefined();
    expect(
      characterSheetPath('hero', {
        href: from,
        organization: { kind: 'unrecorded' },
      }),
    ).toBe('/characters/hero');
  }
  expect(resolveCharacterSheetBack()).toEqual({
    href: '/characters',
    label: 'Characters',
  });
});

it('preserves the personal account as an explicit Characters origin', () => {
  const path = characterSheetPath('hero', {
    href: '/characters',
    organization: { kind: 'personal' },
  });
  expect(path).toBe('/characters/hero?from=%2Fcharacters&organizationId=');
  expect(
    parseCharacterSheetOrigin(
      new URL(path, 'https://example.test').searchParams,
    ),
  ).toEqual({ href: '/characters', organization: { kind: 'personal' } });
});

it('keeps creation and manual organization changes in their independent Characters context', () => {
  expect(
    characterCreatePath(undefined, { kind: 'organization', id: 'source' }),
  ).toBe('/characters/new?from=%2Fcharacters&organizationId=source');
  expect(
    characterCreatePath('alpha', { kind: 'organization', id: 'org' }),
  ).toBe(
    '/characters/new?campaignId=alpha&from=%2Fcampaigns%2Falpha%2Fcharacters&organizationId=org',
  );
  expect(
    organizationSwitchPath(
      '/characters/hero',
      'from=%2Fcharacters&organizationId=source',
    ),
  ).toBe('/characters/hero?from=%2Fcharacters&organizationId=source');
  expect(organizationSwitchPath('/characters')).toBe('/characters');
  expect(organizationSwitchPath('/campaigns/alpha/officers')).toBe(
    '/campaigns',
  );
});
