import { posix } from 'node:path';

/**
 * PCGen's `.pcc` load order for the list files the reader uses (#716 plan
 * §2): campaigns by descending RANK (PCGen's `SourceFileLoader.java:512`
 * sorts them with `sortCampaignsByRank`, `:879`, highest rank first; a
 * campaign without RANK has the default 9, `IntegerKey.java:128`). PCGen keeps
 * the user's selection order within a rank; this reader puts a `_pfs` campaign
 * after the books of its rank, then orders by `.pcc` path. Then
 * each campaign's `ABILITY:`, `ABILITYCATEGORY:` and `CLASS:` lines in order.
 * A `.MOD` applies in that order. A file a `.pcc` line loads only under a
 * condition (`|PRECAMPAIGN:1,INCLUDES=…`, `|PRERULE:…`), or one a `_pfs`
 * campaign loads, is conditional: its modifications are optional overlays.
 */
export type PcgenLoadCondition = {
  pcc: string;
  line: number;
  /** The `.pcc` line's conditions, then a `_pfs` campaign's PRECAMPAIGN lines. */
  conditions: string[];
};
export type PcgenFileLoad = {
  /** Order among loaded files; unlisted files come last, in path order. */
  position: number;
  condition: PcgenLoadCondition | null;
  /** Whether a `.pcc` lists the file; an unlisted file is read but PCGen wouldn't load it. */
  isListed: boolean;
};

const loadedTypes = ['ABILITY', 'ABILITYCATEGORY', 'CLASS'];
/** `IntegerKey.CAMPAIGN_RANK`'s default (`IntegerKey.java:128`). */
const defaultRank = 9;

type PccEntry = {
  file: string;
  pccLine: number;
  conditions: string[];
  isFiltered: boolean;
};
type Campaign = {
  pcc: string;
  rank: number;
  isPfs: boolean;
  campaignConditions: string[];
  entries: PccEntry[];
};

/** Splits a `.pcc` value at `|`, leaving `(INCLUDE:…|…)` groups whole. */
function splitPccValue(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  return [...parts, current];
}

/** A list path relative to the paizo data folder, or null outside it. */
function resolveListPath(pcc: string, path: string) {
  if (!path.startsWith('@'))
    return posix.normalize(posix.join(posix.dirname(pcc), path));
  const fromData = path.slice(1).replaceAll('\\', '/').replace(/^\/+/, '');
  const prefix = 'pathfinder/paizo/';
  return fromData.startsWith(prefix) ? fromData.slice(prefix.length) : null;
}

function parseCampaign(pcc: string, text: string): Campaign {
  const lines = text.split(/\r\n|\r|\n/);
  const rank = lines.find((line) => line.startsWith('RANK:'));
  const entries = lines.flatMap((line, index): PccEntry[] => {
    const tag = line.slice(0, line.indexOf(':'));
    if (!loadedTypes.includes(tag)) return [];
    const [path = '', ...rest] = splitPccValue(
      line.slice(tag.length + 1).trim(),
    );
    const file = resolveListPath(pcc, path.trim());
    if (file === null) return [];
    return [
      {
        file,
        pccLine: index + 1,
        conditions: rest.filter((part) => !part.startsWith('(')),
        isFiltered: rest.some((part) => part.startsWith('(')),
      },
    ];
  });
  return {
    pcc,
    rank: rank ? Number(rank.slice('RANK:'.length).trim()) : defaultRank,
    isPfs: pcc.split('/').includes('_pfs'),
    campaignConditions: lines
      .filter((line) => line.startsWith('PRECAMPAIGN:'))
      .map((line) => line.trim()),
    entries,
  };
}

function compareCampaigns(a: Campaign, b: Campaign) {
  if (a.rank !== b.rank) return b.rank - a.rank;
  if (a.isPfs !== b.isPfs) return a.isPfs ? 1 : -1;
  return a.pcc < b.pcc ? -1 : a.pcc > b.pcc ? 1 : 0;
}

function conditionOf(campaign: Campaign, entry: PccEntry) {
  const conditions = [
    ...entry.conditions,
    ...(campaign.isPfs ? campaign.campaignConditions : []),
  ];
  if (conditions.length === 0 && !campaign.isPfs) return null;
  return { pcc: campaign.pcc, line: entry.pccLine, conditions };
}

/**
 * The load of each list file. A file listed more than once loads where a
 * whole, unconditional listing puts it, else at its first listing.
 */
export function planLoadOrder(
  pccTexts: ReadonlyMap<string, string>,
  listFiles: readonly string[],
) {
  const campaigns = [...pccTexts]
    .map(([pcc, text]) => parseCampaign(pcc, text))
    .sort(compareCampaigns);
  const listings = campaigns.flatMap((campaign) =>
    campaign.entries.map((entry) => ({
      file: entry.file,
      isWhole: !entry.isFiltered && conditionOf(campaign, entry) === null,
      condition: conditionOf(campaign, entry),
    })),
  );
  const loads = new Map<string, PcgenFileLoad & { isWhole: boolean }>();
  for (const [position, { file, isWhole, condition }] of listings.entries()) {
    const current = loads.get(file);
    if (current && (current.isWhole || !isWhole)) continue;
    loads.set(file, { position, condition, isListed: true, isWhole });
  }
  for (const [index, file] of listFiles.entries())
    if (!loads.has(file))
      loads.set(file, {
        position: listings.length + index,
        condition: null,
        isListed: false,
        isWhole: false,
      });
  return new Map<string, PcgenFileLoad>(
    [...loads].map(([file, { position, condition, isListed }]) => [
      file,
      { position, condition, isListed },
    ]),
  );
}
