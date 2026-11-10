import type { SourceRecord } from './records.ts';

type SelectionImportRule = {
  kind: 'feat';
  name: string;
  evidence: { book: string; pages: string };
  detail: { additionalTraits: true };
  grantsSlots: { kind: 'trait'; count: number }[];
};

// Named import rules are explicit authored interpretations, not inferred prose.
const selectionImportRules: readonly SelectionImportRule[] = [
  {
    kind: 'feat',
    name: 'Additional Traits',
    evidence: { book: "Pathfinder RPG Advanced Player's Guide", pages: '150' },
    detail: { additionalTraits: true },
    grantsSlots: [{ kind: 'trait', count: 2 }],
  },
];

export function selectionImportRule({
  kind,
  record,
}: {
  kind: string;
  record: SourceRecord;
}) {
  return selectionImportRules.find(
    (rule) => rule.kind === kind && rule.name === record.name,
  );
}

// Requirements also name regions and factions. Only source-evidenced deity
// names are structured; additional names require an explicit reviewed entry.
// trait-reqs-cd (route C): each later name is evidenced by the pinned
// religion trait that requires it (its Requirements line and tags name it).
export const reviewedDeityRequirements = [
  {
    name: 'Iomedae',
    evidence: {
      externalKey: 'pf1-content/01vYmsu0vnfOmlEN',
      source:
        'tests/fixtures/catalog/pf1-content/src/pf-traits/A_Shining_Beacon__Iomedae__01vYmsu0vnfOmlEN.yaml',
    },
  },
  {
    name: 'Lissala',
    evidence: {
      externalKey: 'pf1-content/EN1QL33d2CYjSz0Z',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Loreseeker__Lissala__EN1QL33d2CYjSz0Z.yaml',
    },
  },
  {
    name: 'Nethys',
    evidence: {
      externalKey: 'pf1-content/CO3T7oTPXx95wKzs',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Magic_is_Life__Nethys__CO3T7oTPXx95wKzs.yaml',
    },
  },
  {
    name: 'Erastil',
    evidence: {
      externalKey: 'pf1-content/tFdOy1B5QDTgUJua',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Patient_Optimist__Erastil__tFdOy1B5QDTgUJua.yaml',
    },
  },
  {
    name: 'Desna',
    evidence: {
      externalKey: 'pf1-content/BB80mzvH45ksk9br',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Starchild__Desna__BB80mzvH45ksk9br.yaml',
    },
  },
  {
    name: 'Cayden Cailean',
    evidence: {
      externalKey: 'pf1-content/vcnecnJ3ATYzXh1q',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Fortified_Drinker__Cayden_Cailean__vcnecnJ3ATYzXh1q.yaml',
    },
  },
  {
    name: 'Pharasma',
    evidence: {
      externalKey: 'pf1-content/Qh9i2PL78aowbAjc',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Undead_Slayer__Pharasma__Qh9i2PL78aowbAjc.yaml',
    },
  },
  {
    name: 'Irori',
    evidence: {
      externalKey: 'pf1-content/CbX5iMc8v5obzSO5',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Wisdom_in_the_Flesh__Irori__CbX5iMc8v5obzSO5.yaml',
    },
  },
  {
    name: 'Sarenrae',
    evidence: {
      externalKey: 'pf1-content/SpWDef764ioMpVjD',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Flame_of_the_Dawnflower__Sarenrae__SpWDef764ioMpVjD.yaml',
    },
  },
  {
    name: 'Asmodeus',
    evidence: {
      externalKey: 'pf1-content/JIi4vWjyAEA2KxVv',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Asmodean_Demon_Hunter__Asmodeus__JIi4vWjyAEA2KxVv.yaml',
    },
  },
  {
    name: 'Gozreh',
    evidence: {
      externalKey: 'pf1-content/YlVlD4U00eigrJMh',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Child_of_Nature__Gozreh__YlVlD4U00eigrJMh.yaml',
    },
  },
  {
    name: 'Calistria',
    evidence: {
      externalKey: 'pf1-content/az0Qb7bCgjuIojI1',
      source:
        'tests/fixtures/pinned/pf1-content/src/pf-traits/Calistrian_Courtesan__Calistria__az0Qb7bCgjuIojI1.yaml',
    },
  },
];
