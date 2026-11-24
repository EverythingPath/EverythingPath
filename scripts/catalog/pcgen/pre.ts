/**
 * PCGen PRExxx prerequisite tokens (#716 plan §2, §3) as an AST. The reader
 * only parses; the mappers translate (P4, P5).
 *
 * `PREMULT:1,[PREABILITY:1,CATEGORY=Archetype,X],[!PREABILITY:…]` becomes a
 * `PREMULT` node whose items are the two nested nodes. Items split at
 * top-level commas; a bracketed item that is itself a prerequisite nests.
 */
export type PcgenPrerequisite = {
  /** The tag, for example `PREABILITY`. */
  kind: string;
  /** A leading `!`. */
  isNegated: boolean;
  /**
   * The leading integer: the n of an n-of-k tag (`PREABILITY:3,…`), or the
   * value of a single-number tag (`PRETOTALAB:6`). Null when the first item
   * isn't an integer (`PREVAREQ:Fighter_CF_Bravery,0`, `PREALIGN:LG`).
   */
  count: number | null;
  items: (string | PcgenPrerequisite)[];
};

const prerequisiteToken = /^(!?)(PRE[A-Z]+):(.*)$/s;

/** Whether a tab-separated LST token (or a `|`-separated ABILITY part) is a PRExxx token. */
export function isPrerequisiteToken(token: string) {
  return /^!?PRE[A-Z]+:/.test(token);
}

function splitTopLevel(body: string, token: string) {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of body) {
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth < 0) break;
    if (char === ',' && depth === 0) {
      items.push(current);
      current = '';
    } else current += char;
  }
  if (depth !== 0)
    throw new Error(`PCGen prerequisite has unbalanced brackets: ${token}`);
  return [...items, current];
}

/** Parses one PRExxx token; throws on anything else or on unbalanced brackets. */
export function parsePrerequisite(token: string): PcgenPrerequisite {
  const match = prerequisiteToken.exec(token);
  if (!match) throw new Error(`Token is not a PCGen prerequisite: ${token}`);
  const [, bang = '', kind = '', body = ''] = match;
  const parts = body === '' ? [] : splitTopLevel(body, token);
  const [first] = parts;
  const count =
    first !== undefined && /^\d+$/.test(first) ? Number(first) : null;
  return {
    kind,
    isNegated: bang === '!',
    count,
    items: (count === null ? parts : parts.slice(1)).map((item) =>
      item.startsWith('[') &&
      item.endsWith(']') &&
      isPrerequisiteToken(item.slice(1, -1))
        ? parsePrerequisite(item.slice(1, -1))
        : item,
    ),
  };
}

/** The token a prerequisite was parsed from. */
export function formatPrerequisite(node: PcgenPrerequisite): string {
  const items = node.items.map((item) =>
    typeof item === 'string' ? item : `[${formatPrerequisite(item)}]`,
  );
  const parts = node.count === null ? items : [String(node.count), ...items];
  return `${node.isNegated ? '!' : ''}${node.kind}:${parts.join(',')}`;
}
