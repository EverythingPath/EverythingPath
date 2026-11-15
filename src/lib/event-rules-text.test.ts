import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { EVENT_TYPES } from './militia-domain';
import { militiaEventTable } from './militia-event-table';
import { EVENT_RULES_TEXT } from './event-rules-text';

// The catalogue is the rules corpus's `## Event:` sections, verbatim: each
// bullet in order, with its `Twice:` bullet held apart.
function corpusEvents() {
  return read('militia-rules.md')
    .split(/^## /m)
    .filter((section) => section.startsWith('Event: '))
    .map((section) => {
      const [heading, ...body] = section.trim().split('\n');
      const name = heading!
        .slice('Event: '.length)
        .replace(/ \(Persistent-capable\)$/, '');
      const bullets = body
        .filter((line) => line.startsWith('- '))
        .map((line) => line.slice(2));
      const twice = bullets.find((line) => line.startsWith('Twice: '));
      return {
        name,
        text: bullets.filter((line) => line !== twice),
        twice: twice ? twice.slice('Twice: '.length) : null,
      };
    });
}

const read = (file: string) =>
  readFileSync(join(process.cwd(), 'docs/ai/ironfang-militia', file), 'utf8');
// The two sentences militia-rules.md omits, taken from militia-verbatim.md
// and appended to the named part of their entry.
const VERBATIM_ADDITIONS: {
  type: 'roll_twice' | 'cache_discovered';
  part: 'text' | 'twice';
  sentence: string;
}[] = [
  {
    type: 'roll_twice',
    part: 'text',
    sentence:
      'If the same event is rolled twice and it has a Twice subsection, only the bonuses and penalties mentioned in the Twice subsection are resolved for the second roll.',
  },
  {
    type: 'cache_discovered',
    part: 'twice',
    sentence:
      'If the militia hasn’t hidden or can’t retrieve any caches, this has no effect.',
  },
];

test('[EVT-rules.verbatim] the added sentences appear word for word in the verbatim corpus', () => {
  // The verbatim text wraps lines mid-sentence; compare with spaces collapsed.
  const verbatim = read('militia-verbatim.md').replace(/\s+/g, ' ');
  for (const { sentence } of VERBATIM_ADDITIONS)
    expect(verbatim).toContain(sentence);
});

test('[EVT-rules.catalogue] every engine event type has rules text taken verbatim from the corpus', () => {
  const corpus = corpusEvents();
  const byName = new Map(
    militiaEventTable.map((entry) => [entry.name.toLowerCase(), entry]),
  );
  // Table names may differ from the corpus headings in capitalization.
  const names = (values: string[]) =>
    values.map((value) => value.toLowerCase()).sort();
  expect(names(corpus.map((entry) => entry.name))).toEqual(
    names(militiaEventTable.map((entry) => entry.name)),
  );
  for (const entry of corpus) {
    const type = byName.get(entry.name.toLowerCase())!.eventType;
    const additions = VERBATIM_ADDITIONS.filter((item) => item.type === type);
    const added = (part: 'text' | 'twice') =>
      additions
        .filter((item) => item.part === part)
        .map((item) => item.sentence);
    expect(EVENT_RULES_TEXT[type], entry.name).toEqual({
      text: [...entry.text, ...added('text')],
      twice:
        entry.twice === null
          ? null
          : [entry.twice, ...added('twice')].join(' '),
    });
  }
  expect(Object.keys(EVENT_RULES_TEXT).sort()).toEqual([...EVENT_TYPES].sort());
});
