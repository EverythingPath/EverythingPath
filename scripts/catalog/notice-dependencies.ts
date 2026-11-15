import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Section15Registry } from '../../src/lib/catalog/admission-schema.ts';
import {
  createNoticeIndex,
  resolveNotice,
} from '../../src/lib/catalog/resolve-notice.ts';

const text = z.string().trim().min(1);
const list = <T extends z.ZodType>(item: T) => z.array(item).default([]);
const sources = list(z.object({ id: text }));
/** An inherited rule a batch reviewed, with the book its rules come from. */
const inheritedRule = z.object({ book: text, rule: text });
/** A linked or supporting record, with the books that publish it. */
const linkedRecord = z.object({ name: text, sources, citedSources: sources });
// The recorded dependency shapes batch inventories use, field by field.
const candidateSchema = z.object({
  externalKey: text,
  name: z.string(),
  descriptionSha256: z.string().optional(),
  requiredNotices: z.array(text),
  noticeHoldIds: list(text),
  inheritedRuleNotices: list(inheritedRule),
  fullContentReview: z
    .object({ inheritedRules: list(inheritedRule) })
    .default({ inheritedRules: [] }),
  inheritedRuleSourceEvidence: list(linkedRecord),
  inheritedNoticeReview: list(z.object({ book: text, reason: text })),
  linkedContentReview: list(linkedRecord),
  mechanicsReview: z
    .object({
      descriptionText: z.string().optional(),
      inheritedRuleEvidence: list(
        z.union([z.object({ book: text, reason: text }), linkedRecord]),
      ),
    })
    .default({ inheritedRuleEvidence: [] }),
});
/** A curated candidate records its required notices; others are skipped. */
const curatedSchema = z.object({
  externalKey: z.string().optional(),
  requiredNotices: z.array(z.unknown()),
});
const inventorySchema = z.object({ candidates: z.array(z.unknown()) });

const legalDirectory = 'scripts/catalog/legal';
export const noticeDependencyWaiversPath = `${legalDirectory}/notice-dependency-waivers.json`;

/** Reviewed exceptions: a recorded dependency whose notice is deliberately not required. */
const noticeDependencyWaiverSchema = z.array(
  z.object({
    key: text,
    notice: text,
    reason: text,
    reviewedBy: text,
    reviewedOn: z.iso.date(),
  }),
);

/**
 * Reviewed advisory terms: wording that signalled a missing inherited-rule
 * notice in a curation review. A match without the book's notice is a
 * warning only; prose matches have false positives, so it never fails.
 */
const noticeDependencyTerms = [
  {
    term: 'stamina',
    pattern: /\bstamina\b/i,
    notice: 'PZO1131',
    finding: '#337 review: Combat Trick stamina is Pathfinder Unchained',
  },
  {
    term: 'Story feat',
    pattern: /\bstory feats?\b/i,
    notice: 'PZO1125',
    finding: '#341 review: Story feats are Ultimate Campaign',
  },
  {
    term: 'Completion Benefit',
    pattern: /\bcompletion benefits?\b/i,
    notice: 'PZO1125',
    finding: '#341 review: Story feat Goal/Completion Benefit',
  },
  {
    term: 'mythic',
    pattern: /\bmythic\b/i,
    notice: 'PZO1126',
    finding: '#522 review: Planar Inquiry "mythic ranks" (Mythic Adventures)',
  },
  {
    term: 'advanced simple template',
    pattern: /\badvanced (?:creature )?simple template\b/i,
    notice: 'PZO1112',
    finding: '#520 review: the advanced simple template is Bestiary',
  },
  {
    term: 'mascot',
    pattern: /\bmascot\b/i,
    notice: 'PZO9454',
    finding:
      "#339 review: Mascot's Affection, mascot archetype (Familiar Folio)",
  },
  {
    term: 'Wolf Style',
    pattern: /\bWolf Style\b/i,
    notice: 'PZO9439',
    finding: '#339 review: Wolf Trip, Wolf Style (Blood of the Moon)',
  },
  {
    term: 'Linnorm Style',
    pattern: /\bLinnorm Style\b/i,
    notice: 'PZO9470',
    finding:
      '#339 review: Linnorm Vengeance, Linnorm Style (Legacy of Dragons)',
  },
] as const;

type Candidate = z.infer<typeof candidateSchema>;
type HeldNotice = { id: string; notices: string[] };
type GapIdentity = { key: string; notice: string };
type DescriptionRecord = {
  externalKey: string;
  kind: string;
  textSha256: string;
  text: string;
};

/** A notice dependency the batch inventory records for one candidate. */
type RecordedDependency = {
  /** Any one of these notices satisfies the dependency. */
  notices: string[];
  recordedBy: string;
};

type NoticeDependencyGap = {
  inventory: string;
  key: string;
  name: string;
  /** The missing notice: the first the dependency names. */
  notice: string;
  /** Other notices that would equally satisfy the dependency. */
  alternatives: string[];
  /** `unheld`: required, but neither a reviewed Registry notice nor held. */
  kind: 'missing' | 'unheld';
  recordedBy: string[];
};

type NoticeDependencyAdvisory = {
  inventory: string;
  key: string;
  name: string;
  notice: string;
} & (
  | { kind: 'term'; term: string; finding: string }
  | { kind: 'linked'; alternatives: string[]; linked: string }
);

/**
 * Checks that every inherited-rule notice dependency a batch inventory records
 * for a curated candidate is in that candidate's `requiredNotices` as a
 * reviewed or held notice. Only the batch's own recorded inherited-rule fields
 * and notice holds count; prose is never read for the hard rule. A dependency
 * on a record published in several books is satisfied by any one of them, so
 * the rule can miss a gap but never fails falsely. Gaps fail unless a reviewed
 * waiver names them, and a waiver matching no gap fails as stale.
 *
 * Warnings never fail: reviewed terms in description text, and
 * `linkedContentReview` records whose books are not required, because those
 * links include prerequisites and do not show the rules were incorporated.
 */
export function checkNoticeDependencies({
  inventories,
  heldNotices,
  registry,
  waivers = [],
  descriptions = [],
}: {
  inventories: { path: string; data: unknown }[];
  heldNotices: HeldNotice[];
  registry: Section15Registry;
  waivers?: z.input<typeof noticeDependencyWaiverSchema>;
  /** Curation Overlay records; `description` records supply advisory text. */
  descriptions?: DescriptionRecord[];
}) {
  const notices = createNoticeMatcher({ registry, heldNotices });
  const holds = new Map(heldNotices.map((hold) => [hold.id, hold]));
  const descriptionOf = createDescriptionLookup(descriptions);
  const gaps = new Map<string, NoticeDependencyGap>();
  const advisories: NoticeDependencyAdvisory[] = [];
  const checked = {
    inventories: inventories.length,
    candidates: 0,
    dependencies: 0,
  };
  for (const { path, candidate } of curatedCandidates(inventories)) {
    checked.candidates += 1;
    const requires = (code: string) =>
      candidate.requiredNotices.filter((required) =>
        notices.satisfies(required, code),
      );
    const description = descriptionOf(candidate);
    for (const { term, pattern, notice, finding } of noticeDependencyTerms)
      if (description && pattern.test(description) && !requires(notice).length)
        advisories.push({
          kind: 'term',
          inventory: path,
          key: candidate.externalKey,
          name: candidate.name,
          notice,
          term,
          finding,
        });
    for (const linked of candidate.linkedContentReview) {
      const [notice, ...alternatives] = books(linked);
      if (notice && !books(linked).some((code) => requires(code).length))
        advisories.push({
          kind: 'linked',
          inventory: path,
          key: candidate.externalKey,
          name: candidate.name,
          notice,
          alternatives,
          linked: linked.name,
        });
    }
    for (const dependency of recordedDependencies({ candidate, holds })) {
      checked.dependencies += 1;
      const present = [...new Set(dependency.notices.flatMap(requires))];
      // A present notice must also be reviewed or held, so the admission
      // gate cannot admit the candidate on an unreviewed notice.
      if (present.some(notices.enforced)) continue;
      const [notice = '', ...alternatives] = present.length
        ? present
        : dependency.notices;
      const identity = gapKey({ key: candidate.externalKey, notice });
      const gap = gaps.get(identity) ?? {
        inventory: path,
        key: candidate.externalKey,
        name: candidate.name,
        notice,
        alternatives,
        kind: present.length ? ('unheld' as const) : ('missing' as const),
        recordedBy: [],
      };
      gap.recordedBy.push(dependency.recordedBy);
      gaps.set(identity, gap);
    }
  }
  return {
    ...applyWaivers({ gaps, waivers }),
    checked,
    advisories,
  };
}

/** The books that publish a linked or supporting record. */
const books = (linked: z.infer<typeof linkedRecord>) =>
  [...linked.citedSources, ...linked.sources].map(({ id }) => id);

function* curatedCandidates(inventories: { path: string; data: unknown }[]) {
  for (const { path, data } of inventories)
    for (const entry of inventorySchema.parse(data).candidates) {
      const curated = curatedSchema.safeParse(entry);
      if (!curated.success) continue;
      const parsed = candidateSchema.safeParse(entry);
      if (!parsed.success)
        throw new Error(
          `${path} ${curated.data.externalKey}: unreadable notice dependencies\n${z.prettifyError(parsed.error)}`,
        );
      yield { path, candidate: parsed.data };
    }
}

function recordedDependencies({
  candidate,
  holds,
}: {
  candidate: Candidate;
  holds: Map<string, HeldNotice>;
}): RecordedDependency[] {
  const dependencies: RecordedDependency[] = [];
  const record = (field: string, notices: string[], label: string) => {
    if (notices.length)
      dependencies.push({ notices, recordedBy: `${field}: ${label}` });
  };
  for (const id of candidate.noticeHoldIds)
    record('noticeHoldIds', holds.get(id)?.notices ?? [], id);
  for (const { book, rule } of candidate.inheritedRuleNotices)
    record('inheritedRuleNotices', [book], rule);
  for (const { book, rule } of candidate.fullContentReview.inheritedRules)
    record('fullContentReview.inheritedRules', [book], rule);
  for (const evidence of candidate.inheritedRuleSourceEvidence)
    record('inheritedRuleSourceEvidence', books(evidence), evidence.name);
  for (const { book, reason } of candidate.inheritedNoticeReview)
    record('inheritedNoticeReview', [book], reason);
  for (const evidence of candidate.mechanicsReview.inheritedRuleEvidence)
    if ('book' in evidence)
      record(
        'mechanicsReview.inheritedRuleEvidence',
        [evidence.book],
        evidence.reason,
      );
    else
      record(
        'mechanicsReview.inheritedRuleEvidence',
        books(evidence),
        evidence.name,
      );
  return dependencies;
}

/**
 * Matches notice codes as the admission gate does: by code or by any
 * identifier of the same Registry notice. A notice is enforced when it is a
 * reviewed Registry notice or `legal/held-notices.json` holds it.
 */
function createNoticeMatcher({
  registry,
  heldNotices,
}: {
  registry: Section15Registry;
  heldNotices: HeldNotice[];
}) {
  const index = createNoticeIndex({ registry });
  const notice = (code: string) => resolveNotice({ registry, code, index });
  const held = new Set<string>();
  for (const code of heldNotices.flatMap(({ notices }) => notices)) {
    held.add(code);
    const named = notice(code);
    if (named)
      for (const [identifier, indexed] of index)
        if (indexed === named) held.add(identifier);
  }
  return {
    satisfies: (required: string, code: string) =>
      required === code ||
      (notice(required) !== undefined && notice(required) === notice(code)),
    enforced: (code: string) =>
      notice(code)?.reviewStatus === 'reviewed' || held.has(code),
  };
}

/** The candidate's reviewed description as plain text, when one is bound. */
function createDescriptionLookup(descriptions: DescriptionRecord[]) {
  const texts = new Map(
    descriptions
      .filter(({ kind }) => kind === 'description')
      .map(({ externalKey, textSha256, text }) => [
        `${externalKey}\0${textSha256}`,
        text,
      ]),
  );
  return (candidate: Candidate) => {
    const html =
      texts.get(`${candidate.externalKey}\0${candidate.descriptionSha256}`) ??
      candidate.mechanicsReview.descriptionText;
    return html?.replace(/<[^>]*>/g, ' ');
  };
}

const gapKey = ({ key, notice }: GapIdentity) => `${key}\0${notice}`;

function applyWaivers({
  gaps,
  waivers,
}: {
  gaps: Map<string, NoticeDependencyGap>;
  waivers: z.input<typeof noticeDependencyWaiverSchema>;
}) {
  const waived = noticeDependencyWaiverSchema
    .parse(waivers)
    .map(({ key, notice }) => ({ key, notice }));
  const waivedKeys = new Set(waived.map(gapKey));
  const found = [...gaps.values()];
  return {
    passed:
      found.every((gap) => waivedKeys.has(gapKey(gap))) &&
      waived.every((entry) => gaps.has(gapKey(entry))),
    gaps: found.filter((gap) => !waivedKeys.has(gapKey(gap))),
    waived: found.filter((gap) => waivedKeys.has(gapKey(gap))),
    // A waiver that no longer matches a gap must be removed with the fix.
    stale: waived.filter((entry) => !gaps.has(gapKey(entry))),
  };
}

/**
 * The committed batch inventories (every legal evidence file with
 * `candidates`) and the reviewed waivers, read from the checkout at `root`.
 */
export async function readNoticeDependencyInputs(root: string) {
  const json = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(join(root, path), 'utf8'));
  const inventories: { path: string; data: unknown }[] = [];
  for (const file of (await readdir(join(root, legalDirectory))).sort()) {
    if (!file.endsWith('.json')) continue;
    const path = `${legalDirectory}/${file}`;
    const data = await json(path);
    if (inventorySchema.safeParse(data).success)
      inventories.push({ path, data });
  }
  return {
    inventories,
    waivers: noticeDependencyWaiverSchema.parse(
      await json(noticeDependencyWaiversPath),
    ),
  };
}
