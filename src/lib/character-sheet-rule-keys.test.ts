import { expect, test } from 'vitest';
import { matchingRuleKey, ruleKeyMatches } from './character-sheet-rule-keys';

// #741: the seeded rule identities, the #716 identity of the same id, and the
// Foundry class or feature reviewed as the same one.
test.each([
  ['ranger', 'pf1/w3wjj6s3N69BsMc3'],
  ['druid', 'pf1/7eZQP0MzeO2svmVF'],
  ['hunter', 'pf1/Immo2BuSe5WGdRW9'],
  ['summoner', 'pf1/BrnHPJ2EVSQSyNQ8'],
  ['monk', 'pf1/W8dxwZ1CZiwLKsqr'],
  ['unchained-monk', 'pf1/5mQIOIw4hDhlREPo'],
  ['monk-flurry', 'pf1/JKJoHy5NveXGaZqv'],
  ['unchained-monk-flurry', 'pf1/TaBxJdJQp5SFDPyn'],
])('the %s rule key matches Foundry’s %s', (ruleKey, foundryKey) => {
  expect(ruleKeyMatches(foundryKey, ruleKey)).toBe(true);
  expect(ruleKeyMatches(ruleKey, ruleKey)).toBe(true);
});

test.each([
  'ranger-beast-master',
  'druid-pack-lord',
  'hunter-packmaster',
  'summoner-broodmaster',
  'summoner-master-summoner',
  'summoner-synthesist',
  'monk-zen-archer',
  'summoner-synthesist-greater-shielded-meld',
])('the %s rule key matches its #716 identity', (ruleKey) => {
  expect(ruleKeyMatches(`everythingpath/${ruleKey}`, ruleKey)).toBe(true);
});

test('a rule key matches no other class, feature or catalog', () => {
  // The Unchained rogue is no ranger, and a Foundry key is not a seed's.
  expect(ruleKeyMatches('pf1/5tsZI6zk29yX1ckA', 'ranger')).toBe(false);
  expect(ruleKeyMatches('pf1/w3wjj6s3N69BsMc3', 'druid')).toBe(false);
  expect(ruleKeyMatches('ranger', 'pf1/w3wjj6s3N69BsMc3')).toBe(false);
  expect(
    ruleKeyMatches('pf1-content/ranger-beast-master', 'ranger-beast-master'),
  ).toBe(false);
  expect(ruleKeyMatches(null, 'ranger')).toBe(false);
  expect(
    matchingRuleKey('pf1/TaBxJdJQp5SFDPyn', [
      'monk-flurry',
      'unchained-monk-flurry',
    ]),
  ).toBe('unchained-monk-flurry');
});
