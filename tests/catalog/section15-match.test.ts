// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  committedSection15Confirmations,
  listSection15Reviews,
  section15ConfirmationSchema,
  section15ConfirmationsSchema,
  section15DefectSchema,
} from '../../scripts/catalog/legal/section15-confirmations';
import {
  chainHoldStatuses,
  matchSection15Book,
  pinnedPcgenFiles,
  findSection15FileProblems,
  readSection15State,
  readWeighedHolds,
  renderSection15Files,
  section15Books,
  type PcgenFiles,
  type ReportedDefect,
  type Section15MatchInput,
  type Section15State,
  type WeighedHold,
} from '../../scripts/catalog/legal/section15-match';
import {
  findReceiptProblems,
  hashReport,
  recordReviewReceipt,
} from '../../scripts/catalog/review-receipts';
import type { Section15Registry } from '../../src/lib/catalog/admission-schema';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { formatCatalogData } from '../../scripts/catalog/data-files';
import { draftedSection15, settledSection15 } from './section15-drafted';

// #716 P10a, plan §7 "Section 15 by per-book matching": the matcher over the
// pinned PCGen `OGL.txt` files (owner decisions 5, 6 and 7).
const bookOf = (code: string) => {
  const book = section15Books.find((row) => row.code.id === code);
  if (!book) throw new Error(`No Section 15 book ${code}.`);
  return book;
};
const match = (code: string, input: Partial<Section15MatchInput> = {}) =>
  matchSection15Book({
    book: bookOf(code),
    files: pinnedPcgenFiles,
    registry: section15Registry,
    holds: [],
    ownLineAliases: [],
    defects: [],
    ...input,
  });

const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const pinnedLines = async (path: string) =>
  (await pinnedPcgenFiles.read(path)).toString('utf8').split('\n');
/** A registry with one extra reviewed notice, in memory only. */
const withNotice = (key: string, notice: string): Section15Registry => ({
  ...section15Registry,
  [key]: {
    title: `Supplement ${key}`,
    notice,
    checkedAgainst: 'pf1-content',
    checkedOn: '2026-10-19',
    aliases: [],
    reviewStatus: 'reviewed',
    provenance: ['in-memory test notice'],
  },
});
const harrowRegistryKey =
  'pf1-content/notice/8143b52ca1422b2573b7bbbaa6b8fdd29d54bd6863b7cae08f2a922566f3d19b';
const harrowRegistryLine =
  'Pathfinder Player Companion: The Harrow Handbook © 2014, Paizo Inc.; Authors: Crystal Frasier, Will McCardell, and David Schwartz.';

describe('the shipped block', () => {
  it('ships Advanced Class Origins from line 34 to the end of the file, chain and conversion lines included', async () => {
    const { confirmation, block } = await match('PZO9451');
    // player_companion/advanced_class_origins/OGL.txt:34-38, byte for byte;
    // :35 spells Monte Cook with a no-break space.
    expect(block?.text).toBe(
      [
        'Open Game License v 1.0a Copyright 2000, Wizards of the Coast, Inc.',
        'System Reference Document Copyright 2000, Wizards of the Coast, Inc; Authors: Jonathan Tweet, Monte Cook, and Skip Williams, based on material by E. Gary Gygax and Dave Arneson.',
        'Demon Lord, Baphomet from the Tome of Horrors Complete Copyright 2011, Necromancer Games, Inc., published and distributed by Frog God Games; Author: Scott Greene, based on material by Gary Gygax.',
        'Pathfinder Player Companion: Advanced Class Origins Copyright 2014, Paizo Inc.; Authors: Dennis Baker, Ross Byers, Tom Phillips, Stephen Radney-MacFarland, and Owen K.C. Stephens.',
        'PCGen dataset conversion for "Pathfinder Player Companion: Advanced Class Origins" Copyright 2017, PCGen Data team (Including, but not limited to Stefan Radermacher, Andrew Maitland, Vincent Hatakeyama, and Gwen T.).',
        '',
      ].join('\n'),
    );
    expect(confirmation).toMatchObject({
      code: 'PZO9451',
      pcgen: {
        path: 'player_companion/advanced_class_origins/OGL.txt',
        encoding: 'utf-8',
        hasBom: false,
      },
      block: { firstLine: 34, lastLine: 38 },
      ownLine: { line: 37 },
      registry: { key: null, comparison: 'none' },
      status: 'matched',
      defects: [],
    });
  });
});

describe('own lines, comparisons and the shipped text', () => {
  it('finds Second Darkness chapter 2 through its alias title, skips both PCGen lines and ships its blank lines', async () => {
    const path = 'adventure_path/second_darkness/ap14/OGL.txt';
    const { confirmation, block } = await match('PZO9014');
    const lines = await pinnedLines(path);
    // :39 names "Pathfinder 14: Children of the Void", the P1 proposed alias.
    expect(lines[38]).toBe(
      'Pathfinder 14: Children of the Void. Copyright 2008, Paizo Publishing, LLC; Author: Mike McArtor.',
    );
    expect(lines[42]).toMatch(
      /^Pathfinder RPG Conversion Copyright 2009-2010, PCGen/,
    );
    expect(lines[44]).toMatch(/^PCGen dataset conversion for "Second Darkness/);
    expect(confirmation).toMatchObject({
      ownLine: {
        line: 39,
        title: 'Pathfinder 14: Children of the Void',
        titleFrom: 'registry-title',
      },
      registry: { titleMatch: 'proposed-alias', comparison: 'exact' },
      // ap14.pcc:31 reads "Paizo Inc."; a lead, not a defect.
      pcc: { comparison: 'differs' },
      block: { firstLine: 34, lastLine: 45 },
      defects: [],
      status: 'matched',
    });
    // Line 33 is the heading; the blank line 34 and every later line ship.
    expect(block?.text).toBe(lines.slice(33).join('\n'));
    expect(block?.text.startsWith('\nOpen Game License')).toBe(true);
    expect(block?.text).toContain('\n\nPathfinder RPG Conversion');
    expect(sha256(block?.text ?? '')).toBe(confirmation.block?.sha256);
  });

  it('records a Registry difference as a wrong-line defect covered by the reviewed notice', async () => {
    const corruption = await match('PZO9450');
    expect(corruption.confirmation).toMatchObject({
      status: 'matched',
      ownLine: { line: 36 },
      registry: { comparison: 'differs' },
      defects: [
        {
          kind: 'wrong-line',
          blockLine: 36,
          source: { checkedAgainst: 'pf1-content' },
          // McGowen, where PCGen's :36 reads McGowan.
          exactText:
            'Pathfinder Player Companion: Champions of Corruption © 2014, Paizo Inc.; Authors: Paris Crenshaw, Jim Groves, Sean McGowen, and Philip Minchin.',
          coveredBy: corruption.confirmation.registry.key,
        },
      ],
    });
    expect(corruption.block?.text).toContain('Sean McGowan, Philip Minchin.');
    const armageddon = await match('PZO9015');
    expect(armageddon.confirmation).toMatchObject({
      status: 'matched',
      ownLine: { line: 40 },
      defects: [
        {
          kind: 'wrong-line',
          // The Registry's 2009 against PCGen's 2008.
          exactText:
            'Pathfinder 15: The Armageddon Echo. Copyright 2009, Paizo Publishing, LLC; Author: Jason Bulmahn',
          coveredBy: armageddon.confirmation.registry.key,
        },
      ],
    });
    // The Registry entries themselves are unchanged.
    expect(
      section15Registry[corruption.confirmation.registry.key ?? '']?.notice,
    ).toContain('McGowen');
  });

  it('holds The Harrow Handbook as uncured until a required notice carries the exact line', async () => {
    const covered = await match('PZO9446');
    expect(covered.confirmation).toMatchObject({
      status: 'matched',
      registry: { key: harrowRegistryKey, comparison: 'differs' },
      defects: [
        {
          blockLine: 36,
          exactText: harrowRegistryLine,
          coveredBy: harrowRegistryKey,
        },
      ],
    });
    const uncured = await match('PZO9446', { requiresRegistryNotice: false });
    expect(uncured.confirmation).toMatchObject({
      status: 'mismatch',
      mismatch: 'uncured-defect',
      defects: [{ coveredBy: null }],
      waivedHoldIds: [],
    });
    const supplemented = await match('PZO9446', {
      requiresRegistryNotice: false,
      registry: withNotice('pcgen-supplement:PZO9446', harrowRegistryLine),
    });
    expect(supplemented.confirmation).toMatchObject({
      status: 'matched',
      supplements: ['pcgen-supplement:PZO9446'],
      defects: [{ coveredBy: 'pcgen-supplement:PZO9446' }],
    });
  });

  it('ships The Harrow Handbook’s typos and second conversion line verbatim, decoding 0xF6 as ö', async () => {
    const { confirmation, block } = await match('PZO9446');
    expect(confirmation.pcgen).toMatchObject({ encoding: 'windows-1252' });
    const lines = block?.text.split('\n') ?? [];
    expect(lines[2]).toBe(
      'Pathfinder Player Companion: The Harrow Handbook Copyright 2014, Paizo Inc.; Authors: Authors: Crystal Frasier, Will McCardell, and David Schwartz.',
    );
    expect(lines[4]).toMatch(
      /^PCGen dataset conversion for the System Reference Document Copyright 2001-2004, PCgen Data team/,
    );
    expect(lines[4]).toContain('Martin Fagerström,');
    // The file ends with a blank line, which ships.
    expect(block?.text.endsWith('Devon Jones)\n\n')).toBe(true);
  });

  it('decodes Weapon Master’s Handbook under Windows-1252: 0x92 is ’ and 0xA9 is ©', async () => {
    const { confirmation, block } = await match('PZO9463');
    expect(confirmation).toMatchObject({
      pcgen: { encoding: 'windows-1252', hasBom: false },
      ownLine: { line: 38 },
      registry: { comparison: 'equivalent' },
      status: 'matched',
    });
    expect(block?.text.split('\n')[4]).toBe(
      'Pathfinder Player Companion: Weapon Master’s Handbook  © 2015, Paizo Inc.; Authors: Alexander Augunas and David N. Ross.',
    );
  });

  it('starts Undead Slayer’s Handbook’s block after §14, which stands in for its missing heading', async () => {
    const { confirmation, block } = await match('PZO9444');
    const lines = await pinnedLines(
      'player_companion/undead_slayers_handbook/OGL.txt',
    );
    expect(lines[30]).toMatch(/^14 Reformation:/);
    expect(confirmation).toMatchObject({
      block: { from: 'section-14', firstLine: 32 },
      ownLine: { line: 36 },
      status: 'matched',
    });
    expect(block?.text).toBe(lines.slice(31).join('\n'));
  });

  it('keeps Occult Adventures, whose block ends with its own line and has no PCGen line, pending the PRD', async () => {
    const { confirmation, block } = await match('PZO1132');
    expect(confirmation).toMatchObject({
      ownLine: { line: 39 },
      block: { lastLine: 39 },
      prd: { comparison: 'pending' },
      status: 'pending-prd',
      waivedHoldIds: [],
    });
    expect(block?.text).not.toMatch(/PCGen/i);
  });

  it('records exact and equivalent Registry comparisons', async () => {
    expect((await match('PZO9402')).confirmation).toMatchObject({
      ownLine: { line: 73 },
      registry: { comparison: 'exact' },
      defects: [],
      status: 'matched',
    });
    // Ultimate Wilderness: the title prefix and ©.
    expect((await match('PZO1140')).confirmation).toMatchObject({
      ownLine: { line: 62 },
      registry: { comparison: 'equivalent' },
      defects: [],
      status: 'matched',
    });
  });

  it('matches Inner Sea Races, a book outside the #716 crosswalk, on its own line 65 against its reviewed Registry title', async () => {
    const path = 'campaign_setting/inner_sea_races/OGL.txt';
    const { confirmation, block } = await match('PZO9280');
    const lines = await pinnedLines(path);
    expect(lines[64]).toMatch(
      /^Pathfinder Campaign Setting: Inner Sea Races Copyright {2}2015, Paizo Inc\.; Authors: Ross Byers,/,
    );
    expect(confirmation).toMatchObject({
      code: 'PZO9280',
      book: 'Inner Sea Races',
      pcgen: { path, encoding: 'utf-8', hasBom: false },
      block: { firstLine: 34, lastLine: 67, from: 'heading' },
      ownLine: { line: 65, titleFrom: 'book' },
      registry: { key: expect.stringMatching(/^pf1-content\/notice\//) },
      prd: null,
      status: 'matched',
      mismatch: null,
    });
    // Line 33 is the heading; every later line ships.
    expect(block?.text).toBe(lines.slice(33).join('\n'));
  });

  it('holds Ranged Tactics Toolbox, whose file carries another book’s block, and Ultimate Combat, which has no file', async () => {
    const toolbox = await match('PZO9452');
    expect(toolbox.confirmation).toMatchObject({
      ownLine: null,
      status: 'mismatch',
      mismatch: 'own-line-missing',
      waivedHoldIds: [],
    });
    expect(toolbox.block?.text).toContain(
      'Pathfinder Player Companion: Champions of Purity',
    );
    expect((await match('PZO1118')).confirmation).toMatchObject({
      pcgen: null,
      block: null,
      status: 'mismatch',
      mismatch: 'no-pcgen-ogl',
    });
  });
});

describe('a missing chain entry (synthetic omission, labelled as such)', () => {
  // No real case is known (plan §7): the test drops Advanced Class Origins'
  // Baphomet chain line, in memory only. Every text below is a line of the
  // unmutated pinned file.
  const path = 'player_companion/advanced_class_origins/OGL.txt';
  const syntheticOmission = async () => {
    const bytes = await pinnedPcgenFiles.read(path);
    const lines = bytes.toString('utf8').split('\n');
    const omitted = lines[35] ?? '';
    const ownLine = lines[36] ?? '';
    const files: PcgenFiles = {
      list: pinnedPcgenFiles.list,
      read: async (file) =>
        file === path
          ? Buffer.from(lines.filter((_, index) => index !== 35).join('\n'))
          : pinnedPcgenFiles.read(file),
    };
    const defect: ReportedDefect = {
      kind: 'missing-entry',
      blockLine: null,
      source: {
        checkedAgainst: 'synthetic-omission',
        locator: `pcgen:${path}:36`,
        sha256: sha256(bytes),
      },
      exactText: omitted,
    };
    return { files, defect, omitted, ownLine };
  };

  it('is uncured with no supplement, or with one that carries another line, and cured by the exact line', async () => {
    const { files, defect, omitted, ownLine } = await syntheticOmission();
    expect(omitted).toMatch(/^Demon Lord, Baphomet from the Tome of Horrors/);
    const holds = await readWeighedHolds(process.cwd());
    const uncovered = await match('PZO9451', {
      files,
      defects: [defect],
      holds,
    });
    expect(uncovered.block?.text).not.toContain('Baphomet');
    expect(uncovered.confirmation).toMatchObject({
      status: 'mismatch',
      mismatch: 'uncured-defect',
      defects: [{ kind: 'missing-entry', blockLine: null, coveredBy: null }],
      waivedHoldIds: [],
    });
    const unrelated = await match('PZO9451', {
      files,
      defects: [defect],
      holds,
      registry: withNotice('pcgen-supplement:PZO9451', ownLine),
    });
    expect(unrelated.confirmation).toMatchObject({
      mismatch: 'uncured-defect',
      waivedHoldIds: [],
    });
    const exact = await match('PZO9451', {
      files,
      defects: [defect],
      holds,
      registry: withNotice('pcgen-supplement:PZO9451', omitted),
    });
    expect(exact.confirmation).toMatchObject({
      status: 'matched',
      defects: [{ coveredBy: 'pcgen-supplement:PZO9451' }],
    });
    expect(exact.confirmation.waivedHoldIds.length).toBeGreaterThan(0);
  });

  it('never reaches the committed confirmations or Registry', async () => {
    const { defect } = await syntheticOmission();
    expect(
      section15DefectSchema.safeParse({ ...defect, coveredBy: null }).success,
    ).toBe(false);
    const committed = [
      await readFile(
        'scripts/catalog/legal/section15-confirmations-716.json',
        'utf8',
      ),
      await readFile('src/lib/catalog/data/section15-registry.json', 'utf8'),
      await readFile('scripts/catalog/legal/section15-inputs-716.json', 'utf8'),
    ];
    for (const text of committed) expect(text).not.toContain('synthetic');
    expect(
      committedSection15Confirmations.find(({ code }) => code === 'PZO9451'),
    ).toMatchObject({ defects: [], supplements: [] });
  });
});

describe('the confirmation schema', () => {
  // Champions of Corruption's committed confirmation: matched, with one
  // wrong-line defect at block line 36.
  const corruption = () => {
    const row = committedSection15Confirmations.find(
      ({ code }) => code === 'PZO9450',
    );
    if (!row) throw new Error('No PZO9450 confirmation.');
    return structuredClone(row);
  };
  const parses = (value: unknown) =>
    section15ConfirmationSchema.safeParse(value).success;

  it('gives a wrong-line defect its line, and a missing entry none', () => {
    const row = corruption();
    expect(parses(row)).toBe(true);
    const [defect] = row.defects;
    expect(defect?.kind).toBe('wrong-line');
    expect(parses({ ...row, defects: [{ ...defect, blockLine: null }] })).toBe(
      false,
    );
    expect(
      parses({ ...row, defects: [{ ...defect, kind: 'missing-entry' }] }),
    ).toBe(false);
  });

  it('gives a matched confirmation its file, block and own line, and only a mismatch its kind', () => {
    const row = corruption();
    for (const field of ['pcgen', 'block', 'ownLine', 'pcc'])
      expect(parses({ ...row, [field]: null }), field).toBe(false);
    expect(parses({ ...row, mismatch: 'uncured-defect' })).toBe(false);
    expect(
      parses({ ...row, status: 'mismatch', mismatch: 'uncured-defect' }),
    ).toBe(true);
    // A book without an OGL.txt has no evidence at all.
    expect(
      parses({ ...row, status: 'mismatch', mismatch: 'no-pcgen-ogl' }),
    ).toBe(false);
  });
});

describe('the committed files', () => {
  const root = process.cwd();
  const confirmationsPath =
    'scripts/catalog/legal/section15-confirmations-716.json';
  const registryPath = 'src/lib/catalog/data/section15-registry.json';
  /** The committed files' text, with some replaced in memory. */
  const committedWith = async (
    replaced: Record<string, string> = {},
  ): Promise<Map<string, string>> =>
    new Map(
      await Promise.all(
        [
          confirmationsPath,
          registryPath,
          'scripts/catalog/legal/held-notices.json',
          'scripts/catalog/legal/section15-holds-716.json',
        ].map(
          async (path) =>
            [path, replaced[path] ?? (await readFile(path, 'utf8'))] as const,
        ),
      ),
    );
  const checkedOn = '2026-10-20';
  // The stand-in review that checked Ultimate Wilderness.
  const oldReview = {
    kind: 'legacy' as const,
    runId: 'reviewer-20261020-000000-1',
    reportSha256: hashReport('A stand-in attribution review.'),
    reviewedBy: 'Sol (AI review) for the owner',
    reviewedOn: checkedOn,
  };
  /**
   * The files as if the record step had checked Ultimate Wilderness, and a
   * later batch had then added one more chain hold on its notice. It starts
   * from the settled state, where every confirmation waives every chain hold
   * committed now, so the committed confirmation waives exactly one chain
   * hold fewer than the matcher would now, whatever later batches add. The
   * late hold is named, not picked by position, so later chain holds on the
   * book can't change which one it is (it is a real one; only its lateness
   * is simulated).
   */
  const late = 'feats-330-notice-PZO1140-complete-chain';
  const lateHold = async () => {
    const settled = await settledSection15();
    const { confirmations, registry } = draftedSection15({
      confirmations: settled.state.previous,
      registry: settled.state.registry,
    });
    const uw = confirmations.find(({ code }) => code === 'PZO1140');
    const record = registry['pcgen:PZO1140'];
    if (!uw || !record) throw new Error('No PZO1140.');
    if (!uw.waivedHoldIds.includes(late))
      throw new Error(`The settled PZO1140 doesn't waive ${late}.`);
    uw.waivedHoldIds = uw.waivedHoldIds.filter((id) => id !== late);
    uw.review = {
      status: 'checked',
      reviewedBy: oldReview.reviewedBy,
      reviewedOn: oldReview.reviewedOn,
      receipt: oldReview.runId,
    };
    registry['pcgen:PZO1140'] = {
      ...record,
      reviewStatus: 'reviewed',
      checkedOn,
    };
    const committed = new Map(settled.files);
    committed.set(
      confirmationsPath,
      `${JSON.stringify(section15ConfirmationsSchema.parse({ confirmations }), null, 2)}\n`,
    );
    committed.set(registryPath, formatCatalogData('registry', registry));
    return {
      state: { ...settled.state, previous: confirmations, registry },
      committed,
      uw,
    };
  };

  it('are what the matcher writes from the pinned files, waivers lagging later batches’ new holds apart', async () => {
    const rendered = await renderSection15Files({
      state: await readSection15State({ root }),
      measuredOn: '2099-01-01',
    });
    expect(
      findSection15FileProblems({ rendered, committed: await committedWith() })
        .problems,
    ).toEqual([]);
  });

  /**
   * Why each lagging note may lag, read from the committed holds rather than
   * from what the matcher adopts: the hold names the matched book's code or
   * Registry notice, the confirmation doesn't list it, and its statuses are
   * all chain statuses, or it is a #264-#296 Registry chain hold
   * (`notice-<n>-complete-chain-<hash>`) whose statuses are all `held`.
   */
  const legacyRegistryChainHold = /^notice-\d+-complete-chain-[0-9a-f]{64}$/;
  const findLaggingProblems = ({
    lagging,
    previous,
    holds,
  }: {
    lagging: readonly { code: string; holdIds: readonly string[] }[];
    previous: Section15State['previous'];
    holds: readonly WeighedHold[];
  }) => {
    const byId = new Map(holds.map((hold) => [hold.id, hold]));
    return lagging.flatMap(({ code, holdIds }) => {
      const earlier = previous.find((row) => row.code === code);
      if (earlier?.status !== 'matched') return [`${code} isn't matched.`];
      const keys = [code, earlier.registry.key];
      return holdIds.flatMap((id) => {
        const hold = byId.get(id);
        if (!hold) return [`${code}: ${id} isn't a committed hold.`];
        const statuses = hold.statuses;
        const chain =
          statuses.length > 0 &&
          (statuses.every((status) => chainHoldStatuses.has(status)) ||
            (legacyRegistryChainHold.test(id) &&
              statuses.every((status) => status === 'held')));
        return [
          ...(earlier.waivedHoldIds.includes(id)
            ? [`${code} already waives ${id}.`]
            : []),
          ...(hold.notices.some((notice) => keys.includes(notice))
            ? []
            : [`${code}: ${id} isn't on the book.`]),
          ...(chain
            ? []
            : [`${code}: ${id} isn't a chain hold (${statuses.join(', ')}).`]),
        ];
      });
    });
  };

  it('note as lagging only chain holds on the book that its confirmation doesn’t list yet, and waive no stale hold', async () => {
    // Properties of the committed files that later batches' chain holds
    // can't break: they only add lagging notes of this kind.
    const state = await readSection15State({ root });
    const rendered = await renderSection15Files({
      state,
      measuredOn: '2099-01-01',
    });
    expect(rendered.stale).toEqual([]);
    expect(
      findLaggingProblems({
        lagging: rendered.lagging,
        previous: state.previous,
        holds: await readWeighedHolds(root),
      }),
    ).toEqual([]);
    // Adopting the waivers takes exactly the lagging holds.
    const adopted = await renderSection15Files({
      state,
      measuredOn: '2099-01-01',
      adoptWaivers: true,
    });
    for (const { code, holdIds } of rendered.lagging)
      expect(
        adopted.confirmations.find((row) => row.code === code)?.waivedHoldIds,
        code,
      ).toEqual(expect.arrayContaining(holdIds));
  });

  it('refuse a lagging note on a hold that isn’t a chain hold of the book', async () => {
    const { previous } = await readSection15State({ root });
    const uw = previous.find(({ code }) => code === 'PZO1140');
    const registryKey = uw?.status === 'matched' ? uw.registry.key : null;
    if (!uw || !registryKey) throw new Error('No matched PZO1140.');
    const legacy = `notice-264-complete-chain-${'a'.repeat(64)}`;
    const holds: WeighedHold[] = [
      {
        id: 'late-chain',
        notices: ['PZO1140'],
        statuses: ['held-complete-chain'],
      },
      { id: legacy, notices: [registryKey], statuses: ['held'] },
      { id: 'late-held', notices: ['PZO1140'], statuses: ['held'] },
      {
        id: 'late-mixed',
        notices: ['PZO1140'],
        statuses: ['held', 'held-complete-chain'],
      },
      {
        id: `notice-265-complete-chain-${'b'.repeat(64)}`,
        notices: [registryKey],
        statuses: ['held', 'held-notice-chain'],
      },
      { id: 'late-bare', notices: ['PZO1140'], statuses: [] },
      {
        id: 'elsewhere',
        notices: ['PZO1129'],
        statuses: ['held-complete-chain'],
      },
      ...uw.waivedHoldIds.slice(0, 1).map((id) => ({
        id,
        notices: ['PZO1140'],
        statuses: ['held-complete-chain'],
      })),
    ];
    const problems = (holdIds: string[]) =>
      findLaggingProblems({
        lagging: [{ code: 'PZO1140', holdIds }],
        previous,
        holds,
      });
    expect(problems(['late-chain', legacy])).toEqual([]);
    expect(problems(['late-held'])).toEqual([
      "PZO1140: late-held isn't a chain hold (held).",
    ]);
    expect(problems(['late-mixed'])).toEqual([
      "PZO1140: late-mixed isn't a chain hold (held, held-complete-chain).",
    ]);
    expect(problems([`notice-265-complete-chain-${'b'.repeat(64)}`])).toEqual([
      `PZO1140: notice-265-complete-chain-${'b'.repeat(64)} isn't a chain hold (held, held-notice-chain).`,
    ]);
    expect(problems(['late-bare'])).toEqual([
      "PZO1140: late-bare isn't a chain hold ().",
    ]);
    expect(problems(['elsewhere'])).toEqual([
      "PZO1140: elsewhere isn't on the book.",
    ]);
    expect(problems(['unknown'])).toEqual([
      "PZO1140: unknown isn't a committed hold.",
    ]);
    const [waived = ''] = uw.waivedHoldIds;
    expect(problems([waived])).toEqual([`PZO1140 already waives ${waived}.`]);
  });

  it('keep a checked confirmation, its date and its Registry record while its waivers lag a later chain hold', async () => {
    const { state, committed, uw } = await lateHold();
    const rendered = await renderSection15Files({
      state,
      measuredOn: '2099-01-01',
    });
    expect(
      rendered.confirmations.find(({ code }) => code === 'PZO1140'),
    ).toEqual(uw);
    expect(rendered.files.get(registryPath)).toBe(committed.get(registryPath));
    expect(findSection15FileProblems({ rendered, committed })).toEqual({
      problems: [],
      lagging: [`PZO1140 doesn't waive ${late} yet.`],
    });
  });

  it('take the lagging waivers only when asked, as a new drafted confirmation that only a fresh review checks', async () => {
    const { state, committed } = await lateHold();
    // What the old review saw, and the receipt it was recorded under.
    const id = 'section15-confirmation PZO1140';
    const seenByOld = listSection15Reviews({
      confirmations: structuredClone(state.previous),
      registry: structuredClone(state.registry),
    });
    const oldCover = seenByOld.find((record) => record.id === id);
    if (!oldCover) throw new Error(`No ${id}.`);
    const { runId, reportSha256, reviewedOn } = oldReview;
    const receipts = {
      receipts: [
        {
          runId,
          reportSha256,
          covers: [
            {
              id,
              sources: oldCover.sources,
              payloadSha256: oldCover.payloadSha256,
            },
          ],
        },
      ],
    };
    const rendered = await renderSection15Files({
      state,
      measuredOn: '2099-01-01',
      adoptWaivers: true,
    });
    const uw = rendered.confirmations.find(({ code }) => code === 'PZO1140');
    expect(uw).toMatchObject({
      measuredOn: '2099-01-01',
      review: { status: 'drafted' },
    });
    expect(uw?.waivedHoldIds).toContain(late);
    expect(rendered.registry['pcgen:PZO1140']).toMatchObject({
      reviewStatus: 'unreviewed',
      checkedOn: '2099-01-01',
    });
    expect(findSection15FileProblems({ rendered, committed }).problems).toEqual(
      [
        `${confirmationsPath} is not what the matcher writes.`,
        `${registryPath} is not what the matcher writes.`,
      ],
    );
    const records = () =>
      listSection15Reviews({
        confirmations: rendered.confirmations,
        registry: rendered.registry,
      });
    // The old review saw the confirmation without the late waiver: it can
    // neither promote the redraft nor vouch for it as checked.
    expect(() =>
      recordReviewReceipt({
        records: records(),
        receipts,
        run: oldReview,
        ids: [id],
        seen: seenByOld,
      }),
    ).toThrow(`${id} has another decision than review ${runId} saw.`);
    const reportSha256s = new Map([[runId, reportSha256]]);
    const vouched = records();
    for (const record of vouched)
      if (record.id === id)
        record.review = {
          status: 'checked',
          reviewedBy: oldReview.reviewedBy,
          reviewedOn,
          receipt: runId,
        };
    expect(
      findReceiptProblems({ records: vouched, receipts, reportSha256s }),
    ).toEqual([
      `Review ${runId} saw ${id} with another decision than it holds now.`,
    ]);
    // A fresh review of the redraft checks it, and its Registry block.
    const fresh = {
      kind: 'legacy' as const,
      runId: 'reviewer-20261021-000000-1',
      reportSha256: hashReport('A fresh stand-in attribution review.'),
      reviewedBy: 'Sol (AI review) for the owner',
      reviewedOn: '2026-10-21',
    };
    const promoted = records();
    const recorded = recordReviewReceipt({
      records: promoted,
      receipts,
      run: fresh,
      ids: [id],
      seen: records(),
    });
    expect(uw?.review).toEqual({
      status: 'checked',
      reviewedBy: fresh.reviewedBy,
      reviewedOn: fresh.reviewedOn,
      receipt: fresh.runId,
    });
    expect(rendered.registry['pcgen:PZO1140']).toMatchObject({
      reviewStatus: 'reviewed',
      checkedOn: fresh.reviewedOn,
    });
    expect(
      findReceiptProblems({
        records: promoted,
        receipts: recorded,
        reportSha256s: new Map([
          ...reportSha256s,
          [fresh.runId, fresh.reportSha256],
        ]),
      }),
    ).toEqual([]);
  });

  it('fail a confirmation that waives a hold which isn’t a waivable chain hold', async () => {
    const state = await readSection15State({ root });
    const previous = structuredClone(state.previous);
    const uw = previous.find(({ code }) => code === 'PZO1140');
    if (!uw) throw new Error('No PZO1140 confirmation.');
    // Princes of Darkness' named variant hold, which is never waived.
    const named = 'notice-282-princes-of-darkness-variant-320';
    uw.waivedHoldIds = [...uw.waivedHoldIds, named].sort();
    const rendered = await renderSection15Files({
      state: { ...state, previous },
      measuredOn: '2099-01-01',
    });
    expect(
      findSection15FileProblems({
        rendered,
        committed: await committedWith({
          [confirmationsPath]: `${JSON.stringify({ confirmations: previous }, null, 2)}\n`,
        }),
      }).problems,
    ).toContain(`PZO1140 waives holds it can't: ${named}.`);
  });

  it('hold every book that isn’t matched with its #716 hold, keyed by its pcgen: notice', () => {
    const counts: Record<string, number> = {};
    for (const { status, mismatch } of committedSection15Confirmations) {
      const kind = mismatch ?? status;
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    // 43 of the matched books are outside the #716 crosswalk (owner, 2026-10-31).
    expect(counts).toEqual({
      matched: 118,
      'pending-prd': 7,
      'own-line-missing': 7,
      'no-pcgen-ogl': 3,
    });
    expect(
      committedSection15Confirmations
        .filter(({ mismatch }) => mismatch === 'own-line-missing')
        .map(({ book }) => book),
    ).toEqual([
      'Pathfinder Society Field Guide',
      'Inner Sea Combat',
      'Champions of Balance',
      'Ranged Tactics Toolbox',
      "Disciple's Doctrine",
      "Merchant's Manifest",
      'Martial Arts Handbook',
    ]);
  });
});
