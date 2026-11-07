/**
 * Isolated legal fixture for #769; this does not admit the held trait.
 * Benefit: pinned pf1-content Magical_Lineage_kDx6ZGhbIteoi7lG.yaml.
 * APG comparison: PCGen apg_abilities.lst:48. Arithmetic stays manual.
 */
export const magicalLineage = {
  name: 'Magical Lineage',
  ruleIdentity: 'pf1-content/kDx6ZGhbIteoi7lG',
  description:
    "Benefits: Pick one spell when you choose this trait. When you apply metamagic feats to this spell, treat its actual level as 1 lower for determining the spell's final adjusted level.",
  stacksWithItself: false,
  sources: [],
  modifiers: [],
  detail: { kind: 'trait' as const, traitType: 'magic' },
};
