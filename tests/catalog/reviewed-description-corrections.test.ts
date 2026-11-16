// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { collectDescriptionInputs } from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import { mapEntry, upstreamRecord } from '../../scripts/catalog/map';
import { raceAbilityTraitKey } from '../../scripts/catalog/racial-trait-rules';
import type { Repository } from '../../scripts/catalog/inventory';
import { sourceBody, type LoadedRecord } from '../../scripts/catalog/records';
import {
  applyReviewedDescriptionCorrections,
  constructGrammar,
  parseDescriptionCorrections,
  reviewedDescriptionCorrections,
  type ReviewedDescriptionCorrection,
} from '../../scripts/catalog/reviewed-description-corrections';

// The pinned Foundry PF1 v11.11 store (tests/fixtures/pinned/README.md).
const pinnedRoot = resolve('tests/fixtures/pinned');
const elfKey = 'pf1/NgIhxRI0axrf3fcO';
const halfElfKey = 'pf1/cCepRrfH5SalFfT4';
const gnomeKey = 'pf1/efwHEwjvL9Z94MJI';
const elfSha256 =
  'a2118d10fa5fc67619278f610dc1b3e90ffe7683bc54fb2457d235493105242d';
const halfElfSha256 =
  '34da0fc58ac849cc393e8553a838acd8cb7da5c4bf2a49aa348e28e6ae525053';
const gnomeSha256 =
  '3b2139d7e3341d80ad97e567cfc778f3149b00073dfbfa22a6599a0e4dc14ab9';
const sha256 = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');
/** Every character a span or its replacement may not contain. */
const markupCharacters = [
  '<',
  '>',
  '&',
  '@',
  '[',
  ']',
  '{',
  '}',
  '"',
  "'",
  '\\',
  '\n',
  '\r',
];
const isMarkup = (character: string) => markupCharacters.includes(character);

const testRow = {
  evidence: 'Test-only row.',
  reviewedBy: 'Test',
  reviewedOn: '2026-11-01',
};
/** A test-only row: the Elf male base weight, a plain-text `<td>` value. */
const elfRow: ReviewedDescriptionCorrection = {
  ...testRow,
  externalKey: elfKey,
  descriptionSha256: elfSha256,
  from: '110 lbs.',
  to: '100 lbs.',
};
/**
 * The Step B spans (research/race-body-correction.md, owner decision
 * 2026-11-01) under the plain-text rule, as test-only rows: each corrects the
 * plain text inside one cell of the male height-and-weight row. The production
 * table holds the same spans (`the production table`).
 */
const stepBRows: ReviewedDescriptionCorrection[] = [
  elfRow,
  {
    ...elfRow,
    from: '(116 – 158 lbs.)',
    to: '(106 – 148 lbs.)',
  },
  {
    ...testRow,
    externalKey: halfElfKey,
    descriptionSha256: halfElfSha256,
    from: '100 lbs.',
    to: '110 lbs.',
  },
  {
    ...testRow,
    externalKey: halfElfKey,
    descriptionSha256: halfElfSha256,
    from: '(110 – 180 lbs.)',
    to: '(120 – 190 lbs.)',
  },
];
/** A test-only row on a race whose description re-home applies (Gnome Magic). */
const gnomeRow: ReviewedDescriptionCorrection = {
  ...testRow,
  externalKey: gnomeKey,
  descriptionSha256: gnomeSha256,
  from: '35 lbs.',
  to: '36 lbs.',
};

/** The pinned record of an upstream key, found by its `<_id>.yaml` suffix. */
async function pinnedRecord(
  externalKey: string,
  root = pinnedRoot,
): Promise<LoadedRecord> {
  const [repo, id] = externalKey.split('/') as [Repository, string];
  const files = await readdir(join(root, repo), { recursive: true });
  const path = files.find(
    (file) => file.endsWith(`.${id}.yaml`) || file.endsWith(`_${id}.yaml`),
  );
  if (!path) throw new Error(`No pinned record for ${externalKey}`);
  return loadPinned(repo, path, root);
}
async function loadPinned(
  repo: Repository,
  path: string,
  root = pinnedRoot,
): Promise<LoadedRecord> {
  const pack = path.split('/')[1];
  if (!pack) throw new Error(`No pack in ${path}`);
  return {
    repo,
    pack,
    path,
    record: upstreamRecord.parse(
      parse(await readFile(join(root, repo, path), 'utf8')),
    ),
  };
}

function mapRace(
  source: LoadedRecord,
  descriptionCorrections?: readonly ReviewedDescriptionCorrection[],
) {
  return mapEntry({
    source,
    kind: 'race',
    resolveKey: (value) => value,
    lookup: new Map(),
    spellClassTags: new Set(),
    ...(descriptionCorrections ? { descriptionCorrections } : {}),
  });
}

let elf: LoadedRecord;
let elfBody: string;
beforeAll(async () => {
  elf = await pinnedRecord(elfKey);
  elfBody = sourceBody({ source: elf });
});

describe('the reviewed description corrections table', () => {
  it('accepts well-formed plain-text rows', () => {
    expect(parseDescriptionCorrections(stepBRows)).toEqual(stepBRows);
  });

  it.each([
    'externalKey',
    'descriptionSha256',
    'from',
    'to',
    'evidence',
    'reviewedBy',
    'reviewedOn',
  ] as const)('refuses a row whose %s is empty', (field) => {
    expect(() =>
      parseDescriptionCorrections([{ ...elfRow, [field]: '' }]),
    ).toThrow();
    expect(() =>
      parseDescriptionCorrections([{ ...elfRow, [field]: '   ' }]),
    ).toThrow();
  });

  it.each([
    ['externalKey', 'NgIhxRI0axrf3fcO'],
    ['externalKey', 'pf1/NgIhxRI0axrf3fcO/extra'],
    ['descriptionSha256', elfSha256.toUpperCase()],
    ['descriptionSha256', elfSha256.slice(1)],
    ['reviewedOn', '2026-13-01'],
    ['reviewedOn', '1 November 2026'],
  ] as const)('refuses a malformed %s (%s)', (field, value) => {
    expect(() =>
      parseDescriptionCorrections([{ ...elfRow, [field]: value }]),
    ).toThrow();
  });

  it('refuses a row with a missing or extra field', () => {
    const { evidence: _evidence, ...missing } = elfRow;
    expect(() => parseDescriptionCorrections([missing])).toThrow();
    expect(() =>
      parseDescriptionCorrections([{ ...elfRow, note: 'extra' }]),
    ).toThrow();
  });

  it('refuses a row whose replacement equals its span', () => {
    expect(() =>
      parseDescriptionCorrections([{ ...elfRow, to: elfRow.from }]),
    ).toThrow(/same/);
  });

  it.each(
    markupCharacters.map((character) => [JSON.stringify(character), character]),
  )('refuses a span or replacement containing %s', (_label, character) => {
    for (const field of ['from', 'to'] as const)
      expect(() =>
        parseDescriptionCorrections([
          { ...elfRow, [field]: `1${character}0 lbs.` },
        ]),
      ).toThrow(/plain text/);
  });

  it('refuses two rows with the same record and span', () => {
    expect(() =>
      parseDescriptionCorrections([elfRow, { ...elfRow, to: '101 lbs.' }]),
    ).toThrow(/twice/);
  });

  it('allows the same span on two different records', () => {
    expect(
      parseDescriptionCorrections([
        elfRow,
        { ...elfRow, externalKey: halfElfKey },
      ]),
    ).toHaveLength(2);
  });

  it('refuses two rows of one record whose spans can overlap', () => {
    // One span inside the other.
    expect(() =>
      parseDescriptionCorrections([
        elfRow,
        { ...elfRow, from: '110', to: '100' },
      ]),
    ).toThrow(/overlap/);
    // The end of one span is the start of the other.
    expect(() =>
      parseDescriptionCorrections([
        { ...elfRow, from: 'A elf', to: 'An elf' },
        { ...elfRow, from: 'elf rows', to: 'elf lines' },
      ]),
    ).toThrow(/overlap/);
    // Disjoint spans of one record are fine.
    expect(
      parseDescriptionCorrections([
        elfRow,
        { ...elfRow, from: '90 lbs.', to: '91 lbs.' },
      ]),
    ).toHaveLength(2);
  });
});

describe('applying reviewed description corrections', () => {
  const apply = (rows: readonly ReviewedDescriptionCorrection[]) =>
    applyReviewedDescriptionCorrections({
      upstreamKey: elfKey,
      body: elfBody,
      rows,
    });

  it('replaces the reviewed span of the pinned Elf body and nothing else', () => {
    expect(sha256(elfBody)).toBe(elfSha256);
    const { body, issues } = apply([elfRow]);
    expect(issues).toEqual([]);
    const at = elfBody.indexOf(elfRow.from);
    expect(at).toBeGreaterThan(0);
    expect(body.slice(0, at)).toBe(elfBody.slice(0, at));
    expect(body.slice(at, at + elfRow.to.length)).toBe(elfRow.to);
    expect(body.slice(at + elfRow.to.length)).toBe(
      elfBody.slice(at + elfRow.from.length),
    );
  });

  it('applies the Step B spans: the plain-text values inside the weight cells', async () => {
    for (const key of [elfKey, halfElfKey]) {
      const source = await pinnedRecord(key);
      const raw = sourceBody({ source });
      const rows = stepBRows.filter((row) => row.externalKey === key);
      const { body, issues } = applyReviewedDescriptionCorrections({
        upstreamKey: key,
        body: raw,
        rows: parseDescriptionCorrections(rows),
      });
      expect(issues).toEqual([]);
      expect(body).toBe(
        rows.reduce((text, row) => text.replace(row.from, row.to), raw),
      );
    }
  });

  it('applies rows of one record together, against the original text', () => {
    const female = { ...elfRow, from: '90 lbs.', to: '91 lbs.' };
    const { body, issues } = apply([female, elfRow]);
    expect(issues).toEqual([]);
    expect(body).toBe(
      elfBody.replace(elfRow.from, elfRow.to).replace(female.from, female.to),
    );
  });

  it('ignores rows of other records', () => {
    expect(apply([{ ...elfRow, externalKey: halfElfKey }])).toEqual({
      body: elfBody,
      issues: [],
    });
  });

  it.each([
    [
      'the description changed since review',
      { descriptionSha256: '0'.repeat(64) },
      /changed since review/,
    ],
    ['the span is missing', { from: '999 lbs.', to: '998 lbs.' }, /missing/],
    [
      'the span is repeated',
      { from: 'Elves receive a +2', to: 'Elves get a +2' },
      /more than once/,
    ],
  ])(
    'leaves the body unchanged with one issue when %s',
    (_label, change, reason) => {
      const row = { ...elfRow, ...change };
      const { body, issues } = apply([row]);
      expect(body).toBe(elfBody);
      expect(issues).toEqual([
        {
          field: 'description.correction',
          reason: expect.stringMatching(reason),
          value: { from: row.from, evidence: row.evidence },
        },
      ]);
    },
  );

  it('refuses unparsed rows whose spans overlap in the body', () => {
    const inner = { ...elfRow, from: '110 lbs', to: '100 lbs' };
    const { body, issues } = apply([elfRow, inner]);
    expect(body).toBe(elfBody);
    expect(issues.map((issue) => issue.reason)).toEqual([
      expect.stringMatching(/overlap/),
      expect.stringMatching(/overlap/),
    ]);
  });

  it('applies none of a record’s rows when one is refused', () => {
    const missing = { ...elfRow, from: '999 lbs.', to: '998 lbs.' };
    const { body, issues } = apply([missing, elfRow]);
    expect(body).toBe(elfBody);
    expect(issues).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/missing/) }),
      expect.objectContaining({
        reason: expect.stringMatching(/another correction/),
        value: { from: elfRow.from, evidence: elfRow.evidence },
      }),
    ]);
  });
});

type ParsedNode = DefaultTreeAdapterMap['node'];
/**
 * Spans of a body that touch markup: a window around every markup
 * character, and each plain run inside a text node that holds markup
 * characters or inside a tag or comment's source, when that run occurs once.
 */
function markupSpans(body: string) {
  const spans = new Set<string>();
  for (const [index, character] of [...body].entries())
    if (isMarkup(character))
      spans.add([...body].slice(Math.max(0, index - 2), index + 3).join(''));
  const plainRuns = (start: number, end: number) => {
    for (const run of body.slice(start, end).split(/[\s<>&@[\]{}"'\\]+/))
      if (run.length >= 2 && body.indexOf(run) === body.lastIndexOf(run))
        spans.add(run);
  };
  const visit = (node: ParsedNode) => {
    const location =
      'sourceCodeLocation' in node ? node.sourceCodeLocation : undefined;
    if (node.nodeName === '#text' && location) {
      const raw = body.slice(location.startOffset, location.endOffset);
      if ([...raw].some(isMarkup))
        plainRuns(location.startOffset, location.endOffset);
    } else if (node.nodeName === '#comment' && location)
      plainRuns(location.startOffset, location.endOffset);
    else if ('tagName' in node) {
      const element = node.sourceCodeLocation;
      for (const tag of [element?.startTag, element?.endTag])
        if (tag) plainRuns(tag.startOffset, tag.endOffset);
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
    if ('content' in node) visit(node.content);
  };
  visit(parseFragment(body, { sourceCodeLocationInfo: true }));
  return [...spans];
}

/**
 * The body with every plain run inside a construct that the module's own
 * grammar finds in a text node (a target, an option, a label or a roll)
 * wrapped in `open` and `close`: empty comments make each run a plain text
 * node of its own, and a kept tag like `<b>` also makes it a plain text run
 * of the sanitized output. Also returns the runs that occur once.
 */
function hideConstructRuns(body: string, open: string, close: string) {
  const runs = new Map<number, number>();
  const visit = (node: ParsedNode) => {
    const location =
      'sourceCodeLocation' in node ? node.sourceCodeLocation : undefined;
    if (node.nodeName === '#text' && location && 'value' in node) {
      const raw = body.slice(location.startOffset, location.endOffset);
      if (raw !== node.value) return;
      const constructs = constructGrammar.flatMap(({ pattern }) =>
        [...raw.matchAll(pattern)].map((match) => ({
          start: match.index,
          end: match.index + match[0].length,
        })),
      );
      for (const match of raw.matchAll(/[^\s<>&@[\]{}"'\\]+/g)) {
        const end = match.index + match[0].length;
        if (
          constructs.some(
            (construct) =>
              construct.start <= match.index && end <= construct.end,
          )
        )
          runs.set(
            location.startOffset + match.index,
            location.startOffset + end,
          );
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  visit(parseFragment(body, { sourceCodeLocationInfo: true }));
  const ordered = [...runs].sort(([left], [right]) => left - right);
  let hidden = body;
  for (const [start, end] of [...ordered].reverse())
    hidden = `${hidden.slice(0, start)}${open}${hidden.slice(start, end)}${close}${hidden.slice(end)}`;
  const texts = ordered
    .map(([start, end]) => body.slice(start, end))
    .filter((text) => hidden.indexOf(text) === hidden.lastIndexOf(text));
  return { hidden, runs: [...new Set(texts)] };
}

describe('a correction can only replace plain text', () => {
  /** Applies one unparsed row, bound to the body's hash. */
  const applyTo = (body: string, rows: { from: string; to: string }[]) =>
    applyReviewedDescriptionCorrections({
      upstreamKey: elfKey,
      body,
      rows: rows.map((row) => ({
        ...elfRow,
        ...row,
        descriptionSha256: sha256(body),
      })),
    });
  const refusal = /not plain text|plain text node|sanitized/;

  it('applies plain text outside every construct, across comments and blocks', () => {
    for (const body of [
      '<p>Weight [[2d8*3]] lbs.</p><p>110 lbs.</p>',
      '<p>Weight <!---->110 lbs.<!----> total</p>',
      '<p>@UUID[Compendium.pf1.feats.Item.abc]{Skill Focus} and <b>110 lbs.</b></p>',
    ])
      expect(applyTo(body, [{ from: '110 lbs.', to: '100 lbs.' }])).toEqual({
        body: body.replace('110 lbs.', '100 lbs.'),
        issues: [],
      });
  });

  it('refuses every reproduction and every span touching markup in the pinned bodies', async () => {
    // Fix round 1 and 2 reproductions (race-body-a-review-r1, -r2).
    const longbow = 'PqJih70EG2A1XNGf';
    expect(elfBody.split(longbow)).toHaveLength(2);
    const roll = '<p>Weight +[[2d8*3]] lbs. (116 – 158 lbs.)</p>';
    const encodedLink = {
      from: 'Elves are proficient with',
      to: 'Elves are proficient with &#64;UUID[Compendium.pf1.races.efwHEwjvL9Z94MJI]{Gnome} and',
    };
    const reproductions: [string, { from: string; to: string }[]][] = [
      // r2 Standards: a quoted `>` in an attribute; the href edit.
      [
        '<p><a title="x > y" href="https://old.example/">longbows</a></p>',
        [{ from: 'old.example', to: 'new.example' }],
      ],
      // r2 Spec 1: the same with paizo.com.
      [
        '<p><a title="1 > 0" href="https://paizo.com/">Pathfinder</a></p>',
        [{ from: 'paizo.com', to: 'example.com' }],
      ],
      // r2 Spec 1: inside a multiline inline roll.
      ['<p>Weight +[[2d8\n*3]] lbs.</p>', [{ from: '*3', to: '*5' }]],
      // r2 Spec 2: an entity-encoded UUID that would add a catalog link.
      [elfBody, [encodedLink]],
      // r1: the pinned Elf longbow link's target, from inside its UUID.
      [elfBody, [{ from: longbow, to: 'zWRlna42PMJVX6un' }]],
      [elfBody, [{ from: longbow, to: 'Ata6ajiY9wuAnBLB' }]],
      // r1: spans that start or end inside a link.
      [elfBody, [{ from: '{longbows} (including', to: '{longbows} (incl.' }]],
      [
        elfBody,
        [{ from: 'Elves are proficient with @UUID', to: 'Elves use @UUID' }],
      ],
      // r1: inside an HTML attribute.
      [
        '<p><a href="catalog:pf1/PqJih70EG2A1XNGf">longbows</a> 110 lbs.</p>',
        [{ from: longbow, to: 'zWRlna42PMJVX6un' }],
      ],
      [
        '<p><a href="catalog:pf1/PqJih70EG2A1XNGf">longbows</a> 110 lbs.</p>',
        [{ from: '"catalog:pf1/', to: '"catalog:pf2/' }],
      ],
      // r1: inside an inline roll.
      [roll, [{ from: '2d8*3', to: '2d8*5' }]],
      [roll, [{ from: '*3]] lbs. (116', to: '*5]] lbs. (106' }]],
      // r1: a token assembled across a span boundary, alone or by two rows.
      ['<p>Weight [110 lbs.</p>', [{ from: '110', to: '[1d6]] 100' }]],
      ['<p>Weight [110 lbs.</p>', [{ from: 'Weight ', to: 'Weight [' }]],
      [
        '<p>ab</p>',
        [
          { from: 'a', to: 'x[' },
          { from: 'b', to: '[1]]' },
        ],
      ],
      // A link assembled from plain letters next to it.
      [
        '<p>@UUXD[Compendium.pf1.races.efwHEwjvL9Z94MJI]{Gnome}</p>',
        [{ from: 'X', to: 'I' }],
      ],
      // r3 Standards: comments, stripped elements or tags separate a roll's
      // delimiters from a plain formula node; alone and as combined rows.
      ['<p>[[<!--a-->2d8*3<!--b-->]]</p>', [{ from: '2d8*3', to: '2d8*5' }]],
      ['<p>[[<wbr>2d8*3<wbr>]]</p>', [{ from: '2d8*3', to: '2d8*5' }]],
      ['<p>[[<b>2d8*3</b>]]</p>', [{ from: '2d8*3', to: '2d8*5' }]],
      ['<p>[[<span>2d8*3</span>]]</p>', [{ from: '2d8*3', to: '2d8*5' }]],
      ['<p>[<!---->1d6<!---->]</p>', [{ from: '1d6', to: '1d8' }]],
      [
        '<p>[[<!---->2d8<!---->*<!---->3<!---->]] lbs.</p>',
        [
          { from: '2d8', to: '3d8' },
          { from: '3', to: '5' },
        ],
      ],
      [
        // A valid row beside a refused one is withheld.
        '<p>Weight [[<!---->2d8*3<!---->]] and <b>110 lbs.</b></p>',
        [
          { from: '2d8*3', to: '2d8*5' },
          { from: '110 lbs.', to: '100 lbs.' },
        ],
      ],
      // The same for links: target, label and name.
      [
        '<p>@UUID[Compendium.pf1.feats.Item.<!---->abc<!---->]{Skill Focus}</p>',
        [{ from: 'abc', to: 'xyz' }],
      ],
      [
        '<p>@UUID[Compendium.pf1.feats.Item.abc]{<!---->Skill Focus<!---->}</p>',
        [{ from: 'Skill Focus', to: 'Weapon Focus' }],
      ],
      [
        '<p>@UUID[Compendium.pf1.feats.Item.abc]{<wbr>Skill Focus<wbr>}</p>',
        [{ from: 'Skill Focus', to: 'Weapon Focus' }],
      ],
      [
        '<p>@<span>UUXD</span>[Compendium.pf1.feats.Item.abc]{Skill Focus}</p>',
        [{ from: 'UUXD', to: 'UUID' }],
      ],
      [
        '<p>@Compendium[pf1.feats.<b>abc</b>]</p>',
        [{ from: 'abc', to: 'xyz' }],
      ],
      // r4 Spec: an unlike `]` inside a label (condition, roll and UUID
      // labels), entity-encoded too, and combined rows.
      [
        '<p>@Condition[stunned]{]<!---->Stun<!---->}</p>',
        [{ from: 'Stun', to: 'Daze' }],
      ],
      [
        '<p>[[1d6]]{]<!---->Damage<!---->}</p>',
        [{ from: 'Damage', to: 'Healing' }],
      ],
      [
        '<p>@UUID[Compendium.pf1.feats.Item.abc]{]<!---->Skill Focus<!---->}</p>',
        [{ from: 'Skill Focus', to: 'Weapon Focus' }],
      ],
      [
        '<p>@UUID[Compendium.pf1.feats.Item.abc]{]<wbr>Skill Focus<wbr>}</p>',
        [{ from: 'Skill Focus', to: 'Weapon Focus' }],
      ],
      [
        '<p>@Condition[stunned]{&#93;<!---->Stun<!---->}</p>',
        [{ from: 'Stun', to: 'Daze' }],
      ],
      [
        '<p>@Condition[stunned]{]<!---->Stun<!---->}</p><p>110 lbs.</p>',
        [
          { from: 'Stun', to: 'Daze' },
          { from: '110 lbs.', to: '100 lbs.' },
        ],
      ],
      // r4 Standards: an unlike `}` inside a parameter list; the @Save DC.
      [
        '<p>@Save[ref;note=};dc=<!---->23<!---->]</p>',
        [{ from: '23', to: '25' }],
      ],
      [
        '<p>@Skill[acr]{] <!---->Balance<!---->}</p>',
        [{ from: 'Balance', to: 'Jump' }],
      ],
      [
        '<p>@Skill[acr]{] <!---->Balance<!----> and <!---->Tumble<!---->}</p>',
        [
          { from: 'Balance', to: 'Jump' },
          { from: 'Tumble', to: 'Climb' },
        ],
      ],
      // @Save/@Check-style parameters split by kept or stripped tags.
      ['<p>@Save[fort;dc=<b>15</b>]</p>', [{ from: '15', to: '17' }]],
      [
        '<p>@Save[will;dc=<span>16</span>]{Will save}</p>',
        [{ from: '16', to: '18' }],
      ],
      ['<p>@Check[ref;dc=<b>18</b>]{Reflex}</p>', [{ from: '18', to: '20' }]],
      [
        '<p>@Check[type=<!---->acrobatics<!---->|dc=19]</p>',
        [{ from: 'acrobatics', to: 'climb' }],
      ],
      ['<p>@Ability[str;dc=<wbr>12<wbr>]</p>', [{ from: '12', to: '14' }]],
      [
        '<p>@Damage[<b>2d6</b>;type=fire]{Burn}</p>',
        [{ from: '2d6', to: '3d6' }],
      ],
      ['<p>@Weight[<b>10</b>]</p>', [{ from: '10', to: '12' }]],
      ['<p>@Distance[<i>30</i>]</p>', [{ from: '30', to: '40' }]],
      [
        '<p>@Use[Longsword#<b>Attack</b>]</p>',
        [{ from: 'Attack', to: 'Strike' }],
      ],
      ['<p>@Apply[<b>Haste</b>;level=5]</p>', [{ from: 'Haste', to: 'Slow' }]],
      ['<p>@Browse[<b>spells</b>]</p>', [{ from: 'spells', to: 'feats' }]],
      ['<p>@Source[<b>PZO1110</b>]</p>', [{ from: 'PZO1110', to: 'PZO1111' }]],
      ['<p>[[/r <b>1d20</b>]]{Roll}</p>', [{ from: '1d20', to: '1d12' }]],
      [
        '<p>&amp;<!---->Reference<!---->[blinded]</p>',
        [{ from: 'Reference', to: 'Referenced' }],
      ],
      // Fix round 1's accepted whole-token span (Step B's earlier shape).
      [
        elfBody,
        [
          {
            from: '<td>110 lbs.</td><td><p>+(2d8×3 lbs.)<br />(116 – 158 lbs.)</p></td>',
            to: '<td>100 lbs.</td><td><p>+(2d8×3 lbs.)<br />(106 – 148 lbs.)</p></td>',
          },
        ],
      ],
    ];
    for (const [body, rows] of reproductions) {
      const result = applyTo(body, rows);
      expect(result.body, JSON.stringify(rows)).toBe(body);
      expect(result.issues).toHaveLength(rows.length);
      // Each row is refused, or withheld beside a refused row.
      for (const issue of result.issues)
        expect(issue.reason, JSON.stringify(rows)).toMatch(
          new RegExp(`${refusal.source}|another correction`),
        );
      expect(
        result.issues.some((issue) => refusal.test(issue.reason)),
        JSON.stringify(rows),
      ).toBe(true);
    }
    // Through the importer: an unsafe label row beside a valid weight row.
    const labelled = `${elfBody}<p>@Condition[stunned]{]<!---->Stun<!---->}</p>`;
    const labelledElf = {
      ...elf,
      record: {
        ...elf.record,
        system: { ...elf.record.system, description: { value: labelled } },
      },
    };
    const bound = { ...elfRow, descriptionSha256: sha256(labelled) };
    const combined = mapRace(labelledElf, [
      { ...bound, from: 'Stun', to: 'Daze' },
      bound,
    ]);
    expect(combined.description).toBe(mapRace(labelledElf, []).description);
    expect(
      combined.unsupported.filter(
        (issue) => issue.field === 'description.correction',
      ),
    ).toHaveLength(2);
    // Through the importer: the encoded UUID adds no link.
    const encoded = mapRace(elf, [{ ...elfRow, ...encodedLink }]);
    expect(encoded.description).toBe(mapRace(elf, []).description);
    expect(
      encoded.unsupported.filter(
        (issue) => issue.field === 'description.correction',
      ),
    ).toHaveLength(1);

    // The sweep: every pinned pf1 and pf1-content record with a description,
    // races and racial traits included.
    const sources: Promise<LoadedRecord | undefined>[] = [];
    for (const [repo, folder] of [
      ['pf1', 'packs'],
      ['pf1-content', 'src'],
    ] as const)
      for (const file of await readdir(join(pinnedRoot, repo, folder), {
        recursive: true,
      }))
        if (file.endsWith('.yaml'))
          sources.push(
            loadPinned(repo, `${folder}/${file}`).catch(() => undefined),
          );
    let bodies = 0;
    let spans = 0;
    let races = 0;
    let hiddenBodies = 0;
    // Each split variant's runs and refusal reasons, counted on their own: a
    // run must occur once in its own hidden body, so the variants can keep
    // different runs. A run like `-` (STR/DEX Bonus, `[[ … ) - 1 ]]`) occurs
    // in every `<!---->` but in no `<b>`, so only the `<b>` variant keeps it.
    const commentSplit = { runs: 0, reasons: new Map<string, number>() };
    const tagSplit = { runs: 0, reasons: new Map<string, number>() };
    for (const source of await Promise.all(sources)) {
      if (!source) continue;
      const body = sourceBody({ source });
      const rows = markupSpans(body).map((from) => ({ from, to: `${from}x` }));
      if (!rows.length) continue;
      bodies += 1;
      spans += rows.length;
      if (/^(packs\/races|src\/pf-racial-traits)\//.test(source.path))
        races += 1;
      const result = applyTo(body, rows);
      expect(result.body, source.path).toBe(body);
      expect(result.issues, source.path).toHaveLength(rows.length);
      const reasons = new Set(result.issues.map((issue) => issue.reason));
      for (const reason of reasons)
        expect(reason, source.path).toMatch(refusal);
      // The same body with every run inside a grammar construct split into
      // its own plain text node, by comments and by a kept `<b>`: only the
      // sanitized-result checks can refuse these. The comment variant leaves
      // the delimiters in the run, so check (2) holds; the `<b>` variant
      // gives each run a plain text run, so only the grammar (1) can.
      for (const [open, close, split] of [
        ['<!---->', '<!---->', commentSplit],
        ['<b>', '</b>', tagSplit],
      ] as const) {
        const { hidden, runs } = hideConstructRuns(body, open, close);
        if (!runs.length) continue;
        if (open === '<b>') hiddenBodies += 1;
        split.runs += runs.length;
        const hiddenResult = applyTo(
          hidden,
          runs.map((from) => ({ from, to: `${from}x` })),
        );
        expect(hiddenResult.body, source.path).toBe(hidden);
        expect(hiddenResult.issues, source.path).toHaveLength(runs.length);
        for (const { reason } of hiddenResult.issues) {
          expect(reason, source.path).toMatch(/sanitized/);
          split.reasons.set(reason, (split.reasons.get(reason) ?? 0) + 1);
        }
      }
    }
    // Every comment-split run is refused by its text run (2), and every
    // tag-split run by the grammar (1). At c0055514: 7,166 comment-split and
    // 7,167 tag-split runs in 1,514 bodies.
    expect([...commentSplit.reasons]).toEqual([
      [expect.stringMatching(/text run/), commentSplit.runs],
    ]);
    expect([...tagSplit.reasons]).toEqual([
      [expect.stringMatching(/enricher, link or inline roll/), tagSplit.runs],
    ]);
    expect(hiddenBodies).toBeGreaterThanOrEqual(1300);
    expect(commentSplit.runs).toBeGreaterThanOrEqual(5900);
    expect(tagSplit.runs).toBeGreaterThanOrEqual(5900);
    // At 62ed9179: 7,328 bodies with markup (1,432 race and racial-trait)
    // and 266,343 spans.
    expect(races).toBeGreaterThanOrEqual(1400);
    expect(bodies).toBeGreaterThanOrEqual(7000);
    expect(spans).toBeGreaterThanOrEqual(250_000);
  }, 120_000);
});

describe('the importer applies reviewed description corrections', () => {
  it('imports the sanitized corrected body as the entry description', () => {
    const raw = mapRace(elf, []);
    const corrected = mapRace(elf, [elfRow]);
    // The same record with the corrected body as its raw text, mapped alone.
    const rewritten = mapRace(
      {
        ...elf,
        record: {
          ...elf.record,
          system: {
            ...elf.record.system,
            description: {
              value: applyReviewedDescriptionCorrections({
                upstreamKey: elfKey,
                body: elfBody,
                rows: [elfRow],
              }).body,
            },
          },
        },
      },
      [],
    );
    expect(corrected.description).toBe(rewritten.description);
    expect(corrected.description).toBe(
      raw.description.replace(elfRow.from, elfRow.to),
    );
    expect(corrected.unsupported).toEqual(raw.unsupported);
    // Only the description moves.
    expect({ ...corrected, description: raw.description }).toEqual(raw);
  });

  it('imports the raw body with exactly one issue when the row is stale', () => {
    const raw = mapRace(elf, []);
    const stale = mapRace(elf, [
      { ...elfRow, descriptionSha256: '0'.repeat(64) },
    ]);
    expect(stale.description).toBe(raw.description);
    const isCorrection = (issue: { field: string }) =>
      issue.field === 'description.correction';
    expect(stale.unsupported.filter(isCorrection)).toHaveLength(1);
    expect(stale.unsupported.filter((issue) => !isCorrection(issue))).toEqual(
      raw.unsupported,
    );
  });
});

describe('derived texts keep reading the raw record', () => {
  // The #719 fixture: the CRB races with their standard traits, including the
  // Gnome Magic description re-home (racial-trait-rules.ts).
  const fixtureRoot = resolve('tests/fixtures/racial-traits-719');
  const inputs = {
    systemPath: join(fixtureRoot, 'pf1'),
    contentPath: join(fixtureRoot, 'pf1-content'),
    remaps: [],
    curation,
  };
  type Artifact = Awaited<ReturnType<typeof importCatalog>>;
  let raw: Artifact;
  let corrected: Artifact;
  const entry = (from: Artifact, key: string) => {
    const found = from.catalog.entries.find((row) => row.externalKey === key);
    if (!found) throw new Error(`Missing fixture entry ${key}`);
    return found;
  };

  /** A fresh import with the production table replaced by these rows. */
  async function importWith(rows: readonly ReviewedDescriptionCorrection[]) {
    vi.resetModules();
    vi.doMock(
      '../../scripts/catalog/reviewed-description-corrections',
      async (original) => ({
        ...(await original<object>()),
        reviewedDescriptionCorrections: rows,
      }),
    );
    const fresh = await import('../../scripts/catalog/import');
    return fresh.importCatalog(inputs);
  }

  beforeAll(async () => {
    raw = await importWith([]);
    // Two test-only rows instead of the production table.
    corrected = await importWith([elfRow, gnomeRow]);
  }, 120_000);
  afterAll(() => {
    vi.doUnmock('../../scripts/catalog/reviewed-description-corrections');
  });

  it('binds the race description record to the raw hash', () => {
    expect(
      collectDescriptionInputs({
        source: elf,
        externalKey: elfKey,
        kind: 'race',
        explicitlyReviewed: true,
      }),
    ).toEqual([expect.objectContaining({ textSha256: elfSha256 })]);
  });

  it('corrects only the two race descriptions', () => {
    expect(entry(corrected, elfKey).description).toBe(
      entry(raw, elfKey).description.replace(elfRow.from, elfRow.to),
    );
    expect(entry(corrected, gnomeKey).description).toBe(
      entry(raw, gnomeKey).description.replace(gnomeRow.from, gnomeRow.to),
    );
    // Everything else in the artifact, the curation applied to both races and
    // the Racial Trait report included, is unchanged.
    const restored = structuredClone(corrected);
    for (const key of [elfKey, gnomeKey])
      entry(restored, key).description = entry(raw, key).description;
    expect(restored).toEqual(raw);
  });

  it('keeps the Elf ability trait line on the raw body', () => {
    const key = raceAbilityTraitKey(elfKey);
    expect(entry(corrected, key).description).toBe(entry(raw, key).description);
  });

  it('still applies the corrected race’s description re-home', () => {
    const rehome = (from: Artifact) =>
      from.catalog.racialTraits?.descriptionRehomes.filter(
        (rule) => rule.race === gnomeKey,
      );
    expect(rehome(raw)).toEqual([
      expect.objectContaining({ status: 'applied' }),
    ]);
    expect(rehome(corrected)).toEqual(rehome(raw));
  });
});

describe('the production table', () => {
  it('parses and applies every row cleanly to its pinned record', async () => {
    expect(parseDescriptionCorrections(reviewedDescriptionCorrections)).toEqual(
      reviewedDescriptionCorrections,
    );
    for (const row of reviewedDescriptionCorrections) {
      const source = await pinnedRecord(row.externalKey);
      expect(
        applyReviewedDescriptionCorrections({
          upstreamKey: row.externalKey,
          body: sourceBody({ source }),
          rows: [row],
        }).issues,
      ).toEqual([]);
    }
  });

  it('holds the four Step B rows: Elf and Half-Elf male base weight, citing PCGen and the owner decision', () => {
    const spans = (rows: readonly ReviewedDescriptionCorrection[]) =>
      rows.map(({ externalKey, descriptionSha256, from, to }) => ({
        externalKey,
        descriptionSha256,
        from,
        to,
      }));
    expect(spans(reviewedDescriptionCorrections)).toEqual(spans(stepBRows));
    for (const row of reviewedDescriptionCorrections) {
      expect(row.evidence).toContain(
        row.externalKey === elfKey
          ? 'core_essentials/races/elf/elf_biosettings.lst:10'
          : 'core_essentials/races/half_elf/halfelf_biosettings.lst:12',
      );
      expect(row.evidence).toContain('Owner decision 2026-11-01');
      expect(row.evidence).not.toMatch(/supplement|ageHeightWeight/i);
    }
  });

  it.each([
    ['Elf', elfKey, 'elf/elf_biosettings.lst', 10],
    ['Half-Elf', halfElfKey, 'half_elf/halfelf_biosettings.lst', 12],
  ])(
    'corrects the pinned %s male weight to PCGen: its base weight, and the range base + 2…16 × multiplier',
    async (_name, key, file, line) => {
      const biosettings = await readFile(
        join(
          pinnedRoot,
          'pcgen/data/pathfinder/paizo/roleplaying_game/core_essentials/races',
          file,
        ),
        'utf8',
      );
      const male = /Male\[([^\]]*)\]/.exec(
        biosettings.split('\n')[line - 1] ?? '',
      )?.[1];
      const cells = new Map(
        (male ?? '').split('|').map((cell) => {
          const [name = '', value = ''] = cell.split(':');
          return [name, value] as const;
        }),
      );
      const base = Number(cells.get('BASEWT'));
      const [count, sides] = (cells.get('HTDIEROLL') ?? '')
        .split('d')
        .map(Number);
      const multiplier = Number(
        /HTDIEROLL\*(\d+)/.exec(cells.get('TOTALWT') ?? '')?.[1],
      );
      expect([base, count, sides, multiplier]).toEqual(
        key === elfKey ? [100, 2, 8, 3] : [110, 2, 8, 5],
      );
      const low = base + (count ?? 0) * multiplier;
      const high = base + (count ?? 0) * (sides ?? 0) * multiplier;
      // The pinned male row, and the row as imported.
      const maleRow = (body: string) =>
        /<tr><td>Male<\/td><td>[^<]+<\/td><td><p>\+2d8 in\.<br \/>\([^)]+\)<\/p><\/td><td>([^<]+)<\/td><td><p>\+\(2d8×(\d+) lbs\.\)<br \/>(\([^)]+\))<\/p><\/td><\/tr>/
          .exec(body.replaceAll('\n', ' '))
          ?.slice(1);
      const source = await pinnedRecord(key);
      const raw = sourceBody({ source });
      const rows = reviewedDescriptionCorrections.filter(
        (row) => row.externalKey === key,
      );
      expect(maleRow(raw)).toEqual([
        rows[0]?.from,
        String(multiplier),
        rows[1]?.from,
      ]);
      const { body, issues } = applyReviewedDescriptionCorrections({
        upstreamKey: key,
        body: raw,
        rows,
      });
      expect(issues).toEqual([]);
      expect(maleRow(body)).toEqual([
        `${base} lbs.`,
        String(multiplier),
        `(${low} – ${high} lbs.)`,
      ]);
    },
  );

  it.each([
    ['Elf', elfKey],
    ['Half-Elf', halfElfKey],
  ])(
    'imports the pinned %s with the corrected male weight and nothing else changed',
    async (_name, key) => {
      const source = await pinnedRecord(key);
      const raw = mapRace(source, []);
      const imported = mapRace(source);
      expect(imported.description).toBe(
        stepBRows
          .filter((row) => row.externalKey === key)
          .reduce(
            (text, row) => text.replace(row.from, row.to),
            raw.description,
          ),
      );
      expect(imported.description).not.toBe(raw.description);
      expect({ ...imported, description: raw.description }).toEqual(raw);
    },
  );
});

describe('the copied enricher grammar', () => {
  /** Every regular expression literal in a source text, as written. */
  const literal = String.raw`\/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\[\n])+\/[a-z]*`;

  it('equals the pinned PF1 v11.11 text enrichers and inline roll, pattern for pattern', async () => {
    const pinned = (path: string) =>
      readFile(join(pinnedRoot, 'pf1', path), 'utf8');
    // module/chat/text-enrichers.mjs: each enricher is
    // `new PF1TextEnricher("<id>", /<pattern>/<flags>, …)`.
    const enrichers = [
      ...(await pinned('module/chat/text-enrichers.mjs')).matchAll(
        new RegExp(
          String.raw`new PF1TextEnricher\(\s*"(\w+)",\s*(${literal})`,
          'g',
        ),
      ),
    ].map(([, id, pattern]) => [`pf1:${id}`, pattern]);
    expect(enrichers).toHaveLength(14);
    // module/utils/lib.mjs:630, the inline roll replaced in enriched HTML.
    const rolls = [
      ...(await pinned('module/utils/lib.mjs')).matchAll(
        new RegExp(String.raw`const rgx = (${literal});`, 'g'),
      ),
    ].map(([, pattern]) => ['pf1:inline-roll', pattern]);
    expect(rolls).toHaveLength(1);
    const copied = constructGrammar
      .filter(({ id }) => id.startsWith('pf1:'))
      .map(({ id, pattern }) => [id, String(pattern)]);
    expect(copied).toEqual([...enrichers, ...rolls]);
  });
});
