/**
 * #741/#716: the rule tables key on the seeded rule identities, such as
 * `ranger`, `ranger-beast-master` or `monk-flurry`. An imported entry's rule
 * identity is its catalog key: `everythingpath/<id>` for a #716 identity
 * (`scripts/catalog/everythingpath-identities.json`), `pf1/<id>` for a
 * Foundry record. A rule key therefore matches its own identity, the #716
 * identity with the same id, and the Foundry records reviewed as the same
 * class or feature (the precedent is `character-sheet-archetype-helpers.ts`).
 */
const foundryAliases: Readonly<Record<string, readonly string[]>> = {
  // Foundry v11.11 packs/classes/<name>.<id>.yaml.
  ranger: ['pf1/w3wjj6s3N69BsMc3'],
  druid: ['pf1/7eZQP0MzeO2svmVF'],
  hunter: ['pf1/Immo2BuSe5WGdRW9'],
  summoner: ['pf1/BrnHPJ2EVSQSyNQ8'],
  monk: ['pf1/W8dxwZ1CZiwLKsqr'],
  'unchained-monk': ['pf1/5mQIOIw4hDhlREPo'],
  // packs/class-abilities/flurry-of-blows.JKJoHy5NveXGaZqv.yaml (CRB p. 57)
  // and flurry-of-blows-uc.TaBxJdJQp5SFDPyn.yaml (PU p. 14), the features
  // the two monk classes link at 1st level.
  'monk-flurry': ['pf1/JKJoHy5NveXGaZqv'],
  'unchained-monk-flurry': ['pf1/TaBxJdJQp5SFDPyn'],
};

/** Whether a rule identity is the one a rule table names by this key. */
export function ruleKeyMatches(
  identity: string | null | undefined,
  ruleKey: string,
) {
  if (identity === null || identity === undefined) return false;
  return (
    identity === ruleKey ||
    identity === `everythingpath/${ruleKey}` ||
    (foundryAliases[ruleKey]?.includes(identity) ?? false)
  );
}

/** The first of some rule keys an identity matches. */
export function matchingRuleKey<Key extends string>(
  identity: string | null | undefined,
  ruleKeys: readonly Key[],
): Key | undefined {
  return ruleKeys.find((ruleKey) => ruleKeyMatches(identity, ruleKey));
}
