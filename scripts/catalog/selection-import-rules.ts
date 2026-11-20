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
