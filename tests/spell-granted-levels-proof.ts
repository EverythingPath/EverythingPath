/**
 * The spell granted-levels family's public fixture
 * (`convex/characterSheetGrantedSpells.integration.test.ts`, bound by bytes in
 * the family's registry entry beside the test): imported-shaped Spells and
 * class features. A slot-style domain grants one Spell at each level 1 to 9
 * (the 1st-level one also on the cleric list), and a schedule-style sorcerer
 * bloodline grants one at each level N from sorcerer 2N + 1 (CRB pp. 38, 72;
 * PRD #251 D10). An Inquisitor's Domain, whose chosen domain gives its powers
 * only (APG p. 38), carries `optionGrantsSpells: false`. The coverage tie
 * (`tests/catalog/launch-granted-levels.test.ts`) checks that every route and
 * level the family's scope certifies is one these bodies grant.
 */
export const domainKey = 'pf1/grantedProofDomain';
export const inquisitorDomainKey = 'pf1/grantedProofInquisitorDomain';
export const bloodlineKey = 'pf1/grantedProofBloodline';
export const spellLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const domainSpell = (level: number) =>
  `pf1/grantedProofDomainSpell${level}`;
export const bloodlineSpell = (level: number) =>
  `pf1/grantedProofBloodlineSpell${level}`;

type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
};
function body({ externalKey, name, pack, detail }: Body) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack,
    name,
    detail,
    description: `${name}.`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers: [],
    unsupported: [],
  };
}
export const spell = ({
  externalKey,
  name,
  levels,
  grantedLevels = {},
}: {
  externalKey: string;
  name: string;
  levels: Record<string, number>;
  grantedLevels?: Record<string, Record<string, number>>;
}) =>
  body({
    externalKey,
    name,
    pack: 'spells',
    detail: {
      kind: 'spell',
      levels,
      grantedLevels,
      school: 'evo',
      subschools: [],
      descriptors: [],
    },
  });
export const feature = (
  externalKey: string,
  name: string,
  spellcasting: Record<string, unknown>,
) =>
  body({
    externalKey,
    name,
    pack: 'class-abilities',
    detail: { kind: 'classFeature', spellcasting },
  });

export const domainSpells = spellLevels.map((level) =>
  spell({
    externalKey: domainSpell(level),
    name: `Proof Domain Spell ${level}`,
    // Only the 1st-level Spell is on the cleric list, so the others fill
    // only the domain slot.
    levels: level === 1 ? { cleric: 1, wizard: 1 } : { wizard: level },
    grantedLevels: { domain: { Proof: level } },
  }),
);
export const bloodlineSpells = spellLevels.map((level) =>
  spell({
    externalKey: bloodlineSpell(level),
    name: `Proof Bloodline Spell ${level}`,
    levels: { wizard: level },
    grantedLevels: { bloodline: { Proof: level } },
  }),
);
export const domainSpellcasting = (spellKey: (level: number) => string) => ({
  optionKind: 'domain',
  extraSlot: 'domain',
  grantedSpells: {
    style: 'slot',
    spells: spellLevels.map((spellLevel) => ({
      spellLevel,
      spellKey: spellKey(spellLevel),
    })),
  },
});
export const domain = feature(
  domainKey,
  'Proof Domain',
  domainSpellcasting(domainSpell),
);
export const bloodline = feature(bloodlineKey, 'Proof Bloodline', {
  optionKind: 'bloodline',
  grantedSpells: {
    style: 'schedule',
    schedule: spellLevels.map((spellLevel) => ({
      spellLevel,
      classLevel: 2 * spellLevel + 1,
    })),
    spells: spellLevels.map((spellLevel) => ({
      spellLevel,
      spellKey: bloodlineSpell(spellLevel),
    })),
  },
});
// The Inquisitor's 1st-level Domain prompt: the flag withholds the chosen
// domain's Spells and slot. Removing the flag is this proof's RED.
const inquisitorChooser = feature(
  inquisitorDomainKey,
  'Proof Inquisitor Domain',
  { chooses: 'domain', optionGrantsSpells: false },
);
const inquisitorDetail: Record<string, unknown> = {
  ...inquisitorChooser.detail,
  picksByLevel: [{ classLevel: 1, list: 'Domain', count: 1 }],
};
export const inquisitorDomain = {
  ...inquisitorChooser,
  detail: inquisitorDetail,
};
export const bodies = [
  ...domainSpells,
  ...bloodlineSpells,
  domain,
  bloodline,
  inquisitorDomain,
];
