// @vitest-environment node
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

// #780 re-parsed caster-level clauses. Each batch inventory copy of a parse
// that moved keeps its earlier value in the candidate's
// `prerequisiteParse780` supplement (docs/catalog-import/curation.md,
// "Caster-level re-parse (#780)"). The supplement stores each fact once
// (docs/agents/generated-artifacts.md): every earlier value once, with the
// fields that held it, and one shared explanation by reference. The seven
// admitted item-creation feats also carry their admission review, which
// points at facts the candidate already stores.
const explanation = 'docs/catalog-import/curation.md#caster-level-re-parse-780';
const clausesField = 'mechanicsReview.mappedFacts.prerequisites';
const sourceSentenceField = 'mechanicsReview.sourceFacts.prerequisiteText';
const admitted = new Map([
  ['pf1/nNVFVFRBCT4O2ab9', 3],
  ['pf1/4hNO4OAWYF5vXphH', 5],
  ['pf1/lIlQnrRkC3YJ1V6t', 11],
  ['pf1/V6du9lXESc2spA7B', 5],
  ['pf1/tD76K8QGco9scT0r', 3],
  ['pf1/HVu9JzllWoLzKKqH', 7],
  ['pf1/tlRu8SYjzA7WCHN7', 1],
]);
const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

type Candidate = Record<string, unknown> & { externalKey: string };
type Supplement = {
  issue: number;
  reviewState: string;
  explanation: string;
  before: { fields: string[]; value: unknown }[];
  admissionReview?: {
    clausesField: string;
    sourceSentence?: string;
    sourceSentenceField?: string;
  };
};

function at(candidate: unknown, dotted: string): unknown {
  let value = candidate;
  for (const part of dotted.split('.')) {
    if (typeof value !== 'object' || value === null || !(part in value))
      return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

async function supplements() {
  const directory = 'scripts/catalog/legal';
  const found: { file: string; candidate: Candidate; supplement: Supplement }[] =
    [];
  for (const file of (await readdir(directory)).sort()) {
    if (!file.endsWith('.json')) continue;
    const text = await readFile(`${directory}/${file}`, 'utf8');
    if (!text.includes('prerequisiteParse780')) continue;
    const value = JSON.parse(text) as { candidates?: Candidate[] };
    for (const candidate of value.candidates ?? [])
      if ('prerequisiteParse780' in candidate)
        found.push({
          file,
          candidate,
          supplement: candidate.prerequisiteParse780 as Supplement,
        });
  }
  return found;
}

describe('the #780 prerequisite-parse supplements', () => {
  it('store each earlier value once, reference one shared explanation and hold only moved copies', async () => {
    const all = await supplements();
    expect(all).toHaveLength(75);
    const curation = await readFile('docs/catalog-import/curation.md', 'utf8');
    expect(curation).toContain('### Caster-level re-parse (#780)');
    for (const { file, candidate, supplement } of all) {
      const label = `${file} ${candidate.externalKey}`;
      expect(Object.keys(supplement).sort(), label).toEqual(
        [
          'issue',
          'reviewState',
          'explanation',
          'before',
          ...(supplement.admissionReview ? ['admissionReview'] : []),
        ].sort(),
      );
      expect(supplement, label).toMatchObject({
        issue: 780,
        reviewState: 'drafted',
        explanation,
      });
      const values = supplement.before.map(({ value }) => JSON.stringify(value));
      expect(new Set(values).size, `${label}: a value stored twice`).toBe(
        values.length,
      );
      const fields = supplement.before.flatMap((group) => group.fields);
      expect(new Set(fields).size, `${label}: a field listed twice`).toBe(
        fields.length,
      );
      // Every listed field exists and moved: its current value differs.
      for (const group of supplement.before)
        for (const field of group.fields) {
          const current = at(candidate, field);
          expect(current, `${label} ${field}`).toBeDefined();
          expect(current, `${label} ${field}`).not.toEqual(group.value);
        }
    }
  }, 120_000);

  it('keep the admission review of exactly the seven admitted item-creation feats, pointing at stored facts', async () => {
    const reviewed = (await supplements()).filter(
      ({ supplement }) => supplement.admissionReview,
    );
    expect(reviewed.map(({ candidate }) => candidate.externalKey).sort()).toEqual(
      [...admitted.keys()].sort(),
    );
    for (const { candidate, supplement } of reviewed) {
      const review = supplement.admissionReview!;
      const level = admitted.get(candidate.externalKey)!;
      expect(review.clausesField).toBe(clausesField);
      // The earlier clause is stored in `before`; the current one in place.
      const earlier = supplement.before.find(({ fields }) =>
        fields.includes(clausesField),
      )?.value;
      expect(earlier).toEqual([
        { unchecked: `Caster level ${ordinal(level)}`, kind: 'unchecked' },
      ]);
      expect(at(candidate, clausesField)).toEqual([
        { casterLevel: level, kind: 'casterLevel' },
      ]);
      // The source sentence once: a pointer where the candidate stores it.
      const stored = at(candidate, sourceSentenceField);
      expect(review).toEqual(
        stored === undefined
          ? {
              clausesField,
              sourceSentence: `Prerequisites: Caster level ${ordinal(level)}.`,
            }
          : { clausesField, sourceSentenceField },
      );
      if (stored !== undefined)
        expect(stored).toBe(`Caster level ${ordinal(level)}.`);
    }
  }, 120_000);
});
