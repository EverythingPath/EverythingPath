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

/**
 * A feat whose text says its owner counts as a race they choose, keyed by the
 * pinned upstream feat key. The importer gives it `countsAsRaces: { oneOf }`
 * of every imported race record whose creature type is `creatureType`,
 * except the race `except` names, by stable key, so a race the import adds
 * joins the options at the next import. Its description must still hold
 * both reviewed sentences, the choice the options come from and the effect;
 * otherwise the feat imports without the fact and reports why.
 */
export type RaceEquivalenceChoiceRule = {
  upstreamKey: string;
  name: string;
  evidence: { book: string; pages: string };
  /** The sentences the rule reads: the choice, then the effect. */
  sentences: readonly [choice: string, effect: string];
  creatureType: string;
  except: string;
};

export const reviewedRaceEquivalenceChoices: readonly RaceEquivalenceChoiceRule[] =
  [
    {
      upstreamKey: 'pf1-content/1LULpgVNjQWqUGUk',
      name: 'Racial Heritage',
      evidence: { book: 'PZO1115', pages: '168' },
      // The Human race is the feat's own (its prerequisite), so it is not
      // another.
      sentences: [
        'Choose another humanoid race.',
        'You count as both human and that race for any effects related to race.',
      ],
      creatureType: 'humanoid',
      except: 'pf1/e6IaBxKgMxy1yKlr',
    },
  ];

// Requirements also name regions and factions. Only source-evidenced deity
// names are structured; additional names require an explicit reviewed entry.
export const reviewedDeityRequirements = [
  {
    name: 'Iomedae',
    evidence: {
      externalKey: 'pf1-content/01vYmsu0vnfOmlEN',
      source:
        'tests/fixtures/catalog/pf1-content/src/pf-traits/A_Shining_Beacon__Iomedae__01vYmsu0vnfOmlEN.yaml',
    },
  },
];
