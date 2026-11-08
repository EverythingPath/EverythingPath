// Reviewed corrections to an imported record's description text. The Curation
// Overlay only appends outputs and the description record binds the whole raw
// body, so neither can change what an entry's description says. Each row names
// one pinned record by its raw description hash, one exact span of that body
// and the text it imports as instead, with its evidence. A row whose hash or
// span no longer matches applies nothing and is reported.
//
// A correction replaces plain text only, by an allow-list rather than a list
// of markup syntaxes: the span and its replacement contain no markup
// character, and the span lies inside one text node of the parsed body (the
// sanitizer's parser) that contains none either. So no tag, attribute, entity,
// link or inline roll can change, appear or vanish.
//
// Applying then checks what users see: the real sanitizer's output. Each span
// occurs once there, outside every tag. Its text run holds no `[ ] { } @`, and
// it intersects no construct that the real enricher, link and roll grammar
// (`constructGrammar`) finds. The sanitized correction differs from the
// sanitized original by exactly those substitutions, with identical
// constructs. HTML boundaries (comments, stripped or kept elements) that split
// a roll or link around a plain node therefore can't hide one.
//
// Only the entry's own `description` changes. Every derived text keeps reading
// the raw record: the description curation record, the description re-homes,
// the race ability-trait line and the inventory hashes.

import { createHash } from 'node:crypto';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { z } from 'zod';
import type { Unsupported } from './records.ts';
import { sanitizeDescription } from './sanitize.ts';

/** Any character that is, or can start, markup in a description. */
const markupCharacter = /[<>&@[\]{}"'\\\n\r]/;
const isPlain = (value: string) => !markupCharacter.test(value);

const text = z.string().refine((value) => value.trim() !== '', 'Empty');
const plainText = text.refine(
  isPlain,
  'Must be plain text: no < > & @ [ ] { } " \' \\ or line break.',
);
const correctionSchema = z
  .object({
    /** The upstream key, `<repo>/<_id>`. */
    externalKey: z.string().regex(/^[a-z0-9-]+\/[A-Za-z0-9]+$/),
    /** SHA-256 hex of the UTF-8 raw description body (`sourceBody`). */
    descriptionSha256: z.string().regex(/^[a-f0-9]{64}$/),
    /** An exact plain-text span of the raw body; it must occur exactly once. */
    from: plainText,
    to: plainText,
    evidence: text,
    reviewedBy: text,
    reviewedOn: z.iso.date(),
  })
  .strict()
  .refine((row) => row.from !== row.to, 'The replacement is the same text.');

export type ReviewedDescriptionCorrection = z.infer<typeof correctionSchema>;

/** Whether an occurrence of one span can overlap an occurrence of the other. */
function canOverlap(left: string, right: string) {
  if (left.includes(right) || right.includes(left)) return true;
  const sharesEdge = (first: string, second: string) => {
    for (let size = 1; size < Math.min(first.length, second.length); size++)
      if (first.endsWith(second.slice(0, size))) return true;
    return false;
  };
  return sharesEdge(left, right) || sharesEdge(right, left);
}

export function parseDescriptionCorrections(
  rows: readonly unknown[],
): ReviewedDescriptionCorrection[] {
  const parsed = z.array(correctionSchema).parse(rows);
  for (const [index, row] of parsed.entries()) {
    const label = `${row.externalKey} "${row.from}"`;
    for (const other of parsed.slice(index + 1)) {
      if (other.externalKey !== row.externalKey) continue;
      if (other.from === row.from)
        throw new Error(`Description correction ${label} is listed twice.`);
      if (canOverlap(row.from, other.from))
        throw new Error(
          `Description corrections ${label} and "${other.from}" can overlap.`,
        );
    }
  }
  return parsed;
}

const elfWeight = {
  externalKey: 'pf1/NgIhxRI0axrf3fcO',
  descriptionSha256:
    'a2118d10fa5fc67619278f610dc1b3e90ffe7683bc54fb2457d235493105242d',
  evidence:
    'Elf male base weight: PCGen core_essentials/races/elf/elf_biosettings.lst:10 (pcgen 25523dbc) gives Male BASEWT:100, HTDIEROLL:2d8, TOTALWT:BASEWT+(HTDIEROLL*3), so 100 lbs. and 100 + 2…16 × 3 = (106 – 148 lbs.); Foundry reads 110 lbs. (116 – 158 lbs.). Owner decision 2026-11-01, "Correct to PCGen" (#328 S4-B).',
  reviewedBy: 'Sol (AI curator) for the owner',
  reviewedOn: '2026-11-01',
};
const halfElfWeight = {
  externalKey: 'pf1/cCepRrfH5SalFfT4',
  descriptionSha256:
    '34da0fc58ac849cc393e8553a838acd8cb7da5c4bf2a49aa348e28e6ae525053',
  evidence:
    'Half-Elf male base weight: PCGen core_essentials/races/half_elf/halfelf_biosettings.lst:12 (pcgen 25523dbc) gives Male BASEWT:110, HTDIEROLL:2d8, TOTALWT:(BASEWT+(HTDIEROLL*5)), so 110 lbs. and 110 + 2…16 × 5 = (120 – 190 lbs.); Foundry reads 100 lbs. (110 – 180 lbs.). Owner decision 2026-11-01, "Correct to PCGen" (#328 S4-B).',
  reviewedBy: 'Sol (AI curator) for the owner',
  reviewedOn: '2026-11-01',
};

export const reviewedDescriptionCorrections: readonly ReviewedDescriptionCorrection[] =
  parseDescriptionCorrections([
    { ...elfWeight, from: '110 lbs.', to: '100 lbs.' },
    { ...elfWeight, from: '(116 – 158 lbs.)', to: '(106 – 148 lbs.)' },
    { ...halfElfWeight, from: '100 lbs.', to: '110 lbs.' },
    { ...halfElfWeight, from: '(110 – 180 lbs.)', to: '(120 – 190 lbs.)' },
  ]);

const sha256 = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

type ParsedNode = DefaultTreeAdapterMap['node'];
/**
 * The source ranges of the body's plain text nodes, as the sanitizer's parser
 * reads it: nodes whose raw source is their exact value and holds no markup
 * character. Template contents are never plain.
 */
function plainTextNodes(body: string) {
  const ranges: { start: number; end: number }[] = [];
  const visit = (node: ParsedNode) => {
    if (node.nodeName === '#text' && 'value' in node) {
      const location = node.sourceCodeLocation;
      if (!location) return;
      const raw = body.slice(location.startOffset, location.endOffset);
      if (raw === node.value && isPlain(raw))
        ranges.push({ start: location.startOffset, end: location.endOffset });
    } else if ('childNodes' in node && node.nodeName !== 'template')
      node.childNodes.forEach(visit);
  };
  visit(parseFragment(body, { sourceCodeLocationInfo: true }));
  return ranges;
}

/** Why a row does not apply to this body, if it does not. */
function refusalReason(
  row: ReviewedDescriptionCorrection,
  body: string,
  bodySha256: string,
  plainNodes: () => readonly { start: number; end: number }[],
) {
  if (bodySha256 !== row.descriptionSha256)
    return 'The description changed since review.';
  if (!isPlain(row.from) || !isPlain(row.to))
    return 'The corrected span or its replacement is not plain text.';
  const at = body.indexOf(row.from);
  if (at < 0) return 'The corrected span is missing from the description.';
  if (body.includes(row.from, at + 1))
    return 'The corrected span occurs more than once in the description.';
  const end = at + row.from.length;
  if (!plainNodes().some((node) => node.start <= at && end <= node.end))
    return 'The corrected span is not inside one plain text node of the description.';
  return undefined;
}

const issueOf = (
  row: ReviewedDescriptionCorrection,
  reason: string,
): Unsupported => ({
  field: 'description.correction',
  reason,
  value: { from: row.from, evidence: row.evidence },
});

/**
 * The record's raw body with each row's span replaced, against the original
 * text. When any row of the record is refused, none of them applies: each
 * refused row reports its reason, and each other row reports that it was not
 * applied.
 */
export function applyReviewedDescriptionCorrections({
  upstreamKey,
  body,
  rows,
}: {
  upstreamKey: string;
  body: string;
  rows: readonly ReviewedDescriptionCorrection[];
}): { body: string; issues: Unsupported[] } {
  const own = rows.filter((row) => row.externalKey === upstreamKey);
  if (!own.length) return { body, issues: [] };
  const bodySha256 = sha256(body);
  let nodes: readonly { start: number; end: number }[] | undefined;
  const plainNodes = () => (nodes ??= plainTextNodes(body));
  const refuse = (
    reasons: readonly (string | undefined)[],
    fallback = 'Not applied: another correction of this record was refused.',
  ) => ({
    body,
    issues: own.map((row, index) => issueOf(row, reasons[index] ?? fallback)),
  });
  const reasons = own.map((row) =>
    refusalReason(row, body, bodySha256, plainNodes),
  );
  if (reasons.some(Boolean)) return refuse(reasons);
  const corrected = splice(
    body,
    own.map((row) => ({ at: body.indexOf(row.from), row })),
  );
  // Parsed rows never overlap; rows passed in unparsed might.
  if (corrected === undefined)
    return refuse([], 'The corrected spans of this record overlap.');
  const sanitizedReasons = sanitizedRefusals(body, corrected, own);
  if (sanitizedReasons.some(Boolean)) return refuse(sanitizedReasons);
  return { body: corrected, issues: [] };
}

type Span = { at: number; row: ReviewedDescriptionCorrection };
/** The text with each span replaced; undefined when two spans overlap. */
function splice(text: string, spans: readonly Span[]) {
  let corrected = '';
  let cursor = 0;
  for (const { at, row } of [...spans].sort(
    (left, right) => left.at - right.at,
  )) {
    if (at < cursor) return undefined;
    corrected += text.slice(cursor, at) + row.to;
    cursor = at + row.from.length;
  }
  return corrected + text.slice(cursor);
}

/**
 * The description as the importer's sanitizer renders it, which is what users
 * see. Every reference resolves here, so links render as links.
 */
const sanitized = (html: string) =>
  sanitizeDescription({ html, link: (uuid) => ({ key: uuid, name: uuid }) });

const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
};
/**
 * The sanitized HTML's visible text: tags dropped and the sanitizer's four
 * entities decoded, with each character's offset in the HTML.
 */
function visibleText(html: string) {
  let text = '';
  const offsets: number[] = [];
  for (let index = 0; index < html.length; ) {
    if (html[index] === '<') {
      const close = html.indexOf('>', index);
      index = close < 0 ? html.length : close + 1;
      continue;
    }
    const entity = /^&(?:amp|lt|gt|quot);/.exec(html.slice(index, index + 6));
    text += entity ? entities[entity[0]] : html[index];
    offsets.push(index);
    index += entity ? entity[0].length : 1;
  }
  return { text, offsets };
}

/**
 * The enricher, link and inline-roll grammar, copied verbatim from the code
 * that reads descriptions, never hand-written:
 * - every PF1 v11.11 text enricher (pinned 418761d2,
 *   `module/chat/text-enrichers.mjs:773-1243`): apply, toggle, save, ability,
 *   skill, use, action, health (Heal and Damage), browse, weight, distance,
 *   condition, draw and source;
 * - the PF1 and Foundry inline roll, `[[…]]`, `[[/r …]]` with `]]]` and an
 *   optional `{label}` (`module/utils/lib.mjs:630`);
 * - the importer's own link and roll patterns: catalog links
 *   (`sanitize.ts`), `@UUID` links (`racial-traits.ts:129`,
 *   `launch-inventory-sources.ts:135`) and rolls (`curation.ts:641`,
 *   `racial-traits.ts:417`);
 * - Foundry's document links and embeds, `@<Type>[target]{label}`, with the
 *   type name left open so every document type is covered.
 * Exported so the corpus test finds constructs with the same grammar, and so
 * a test compares the PF1 patterns with the pinned PF1 source.
 */
export const constructGrammar: readonly { id: string; pattern: RegExp }[] = [
  {
    id: 'pf1:apply',
    pattern:
      /@Apply\[(?<ident>.*?)(?:;(?<options>.*?))?\](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:toggle',
    pattern:
      /@Toggle\[(?<ident>.*?)(?:;(?<options>.*?))?\](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:save',
    pattern: /@Save\[(?<save>\w+)(;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:ability',
    pattern:
      /@Ability\[(?<ability>\w+)(;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:skill',
    pattern: /@Skill\[(?<skill>\w+)(;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:use',
    pattern:
      /@Use\[(?<item>.*?)(?:#(?<action>.*?))?(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:action',
    pattern:
      /@Action\[(?<action>.*?)(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:health',
    pattern:
      /@(?<command>Heal|Damage)\[(?<formula>.*?)(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:browse',
    pattern:
      /@Browse\[(?<category>\w+)(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:weight',
    pattern: /@Weight\[(?<formula>.+?)(?:;(?<options>.*?))?\]/g,
  },
  {
    id: 'pf1:distance',
    pattern: /@Distance\[(?<formula>.+?)(?:;(?<options>.*?))?\]/g,
  },
  {
    id: 'pf1:condition',
    pattern:
      /@Condition\[(?<condition>\w+)(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
  },
  {
    id: 'pf1:draw',
    pattern: /@Draw\[(?<ident>.*?)\](?:\{(?<label>.*?)\})?/g,
  },
  {
    id: 'pf1:source',
    pattern: /@Source\[(?<ident>\w+)(?:;(?<options>.*?))?]/g,
  },
  {
    id: 'pf1:inline-roll',
    pattern: /\[\[(\/[a-zA-Z]+\s)?(.*?)(]{2,3})(?:{([^}]+)})?/gi,
  },
  {
    id: 'importer:catalog-link',
    pattern: /@(?:UUID|Compendium)\[[^\]]+\](?:\{[^}]*\})?/g,
  },
  { id: 'importer:uuid-link', pattern: /@UUID\[([^\]]+)\](?:\{([^}]*)\})?/g },
  { id: 'importer:roll', pattern: /\[\[(.*?)\]\]/gs },
  { id: 'importer:trait-roll', pattern: /\[\[([^\]]+)\]\]/g },
  {
    id: 'foundry:document-link',
    pattern: /@(\w+)\[([^\]]*)\](?:\{([^}]*)\})?/g,
  },
];

/** Every construct the grammar finds in a text, in order. */
function constructsOf(text: string) {
  return constructGrammar
    .flatMap(({ id, pattern }) =>
      [...text.matchAll(pattern)].map((match) => ({
        id,
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      })),
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

/**
 * The sanitized description's constructs, in both its HTML and its visible
 * text (where a construct split by kept tags still reads as one).
 */
function sanitizedConstructs(html: string) {
  return {
    html: constructsOf(html),
    visible: constructsOf(visibleText(html).text),
  };
}
const constructList = (html: string) => {
  const { html: inHtml, visible } = sanitizedConstructs(html);
  return JSON.stringify([
    inHtml.map(({ id, text }) => [id, text]),
    visible.map(({ id, text }) => [id, text]),
  ]);
};
const intersects = (
  constructs: readonly { start: number; end: number }[],
  start: number,
  end: number,
) =>
  constructs.some(
    (construct) => start < construct.end && end > construct.start,
  );

/**
 * Why each row fails on the sanitized result, if any does.
 * - The span occurs exactly once in the sanitized original, outside every tag.
 * - The text run around it, between the nearest tags, holds none of
 *   `[ ] { } @`.
 * - It intersects no construct of the grammar, in the HTML or the visible
 *   text.
 * - The sanitized correction equals the sanitized original with exactly those
 *   substitutions, and its constructs (kind, text and order) are identical.
 */
function sanitizedRefusals(
  body: string,
  corrected: string,
  rows: readonly ReviewedDescriptionCorrection[],
): (string | undefined)[] {
  const original = sanitized(body);
  const { offsets } = visibleText(original);
  const textIndex = new Map(offsets.map((offset, index) => [offset, index]));
  const constructs = sanitizedConstructs(original);
  const spans: Span[] = [];
  const reasons = rows.map((row) => {
    const at = original.indexOf(row.from);
    const end = at + row.from.length;
    if (at < 0 || original.includes(row.from, at + 1))
      return 'The corrected span does not occur exactly once in the sanitized description.';
    const start = textIndex.get(at);
    if (
      start === undefined ||
      textIndex.get(end - 1) !== start + row.from.length - 1
    )
      return 'The corrected span is inside a tag of the sanitized description.';
    const runStart = original.lastIndexOf('>', at) + 1;
    const runEnd = original.indexOf('<', end);
    if (
      /[[\]{}@]/.test(original.slice(runStart, runEnd < 0 ? undefined : runEnd))
    )
      return 'The text run around the corrected span in the sanitized description holds [ ] { } or @.';
    if (
      intersects(constructs.html, at, end) ||
      intersects(constructs.visible, start, start + row.from.length)
    )
      return 'The corrected span is inside an enricher, link or inline roll of the sanitized description.';
    spans.push({ at, row });
    return undefined;
  });
  if (reasons.some(Boolean)) return reasons;
  const expected = splice(original, spans);
  const result = sanitized(corrected);
  if (expected === undefined || result !== expected)
    return rows.map(
      () => 'The sanitized description changes beyond the corrected spans.',
    );
  if (constructList(result) !== constructList(original))
    return rows.map(
      () =>
        'The enrichers, links or inline rolls of the sanitized description change.',
    );
  return reasons;
}
