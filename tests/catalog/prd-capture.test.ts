// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  factsOf,
  monsterCodexChapters,
} from '../../scripts/catalog/prd-capture';
import {
  checklistFileSchema,
  completeManifestSchema,
  manifestSchema,
} from '../../scripts/catalog/prd-manifest';
import { pinnedPath } from './pinned-sources';

async function committedChecklist() {
  return checklistFileSchema.parse(
    JSON.parse(
      await readFile(pinnedPath('prd', 'checklist/pf-archetypes.json'), 'utf8'),
    ),
  );
}

// The Monster Codex's race chapters as the PRD root links them, in book order.
const monsterCodexLinks = [
  'boggards',
  'bugbears',
  'drow',
  'duergar',
  'fireGiants',
  'frostGiants',
  'ghouls',
  'gnolls',
  'goblins',
  'hobgoblins',
  'kobolds',
  'lizardfolk',
  'ogres',
  'orcs',
  'ratfolk',
  'sahuagin',
  'serpentfolk',
  'troglodytes',
  'trolls',
  'vampires',
  'appendix',
].map((race) => `monsterCodex/${race}.html`);

describe('the PRD capture tool', () => {
  it('picks the Monster Codex chapters from the checklist pages', async () => {
    const { items } = await committedChecklist();
    expect(
      monsterCodexChapters({
        links: monsterCodexLinks,
        items,
        selection: {
          pattern: /^monsterCodex\/(?!appendix\.html)\w+\.html$/,
          chapters: 20,
          bookId: 'PZO1130',
          firstPage: 8,
          chapterPages: 12,
        },
      }),
    ).toEqual([
      'monsterCodex/bugbears.html',
      'monsterCodex/gnolls.html',
      'monsterCodex/goblins.html',
      'monsterCodex/hobgoblins.html',
      'monsterCodex/kobolds.html',
      'monsterCodex/lizardfolk.html',
      'monsterCodex/trolls.html',
    ]);
  });

  it("keeps only a checklist item's facts", async () => {
    const { items } = await committedChecklist();
    const file =
      'src/pf-archetypes/druid/druid-troll-fury.427Q4zmOLzGNrEig.yaml';
    const text = [
      '_id: 427Q4zmOLzGNrEig',
      "_key: '!items!427Q4zmOLzGNrEig'",
      'name: Druid (Troll Fury)',
      'type: feat',
      'system:',
      '  subType: misc',
      '  associations:',
      '    classes:',
      '      - Druid',
      '  sources:',
      '    - id: PZO1130',
      "      pages: '224'",
    ].join('\n');
    expect(
      factsOf({
        file,
        blob: 'f05c21e8459a45c8568d157b382a315c96b7951e',
        text,
      }),
    ).toEqual(items.find((item) => item.file === file));
  });

  it('skips folder records and rejects an item without its facts', () => {
    const blob = 'f05c21e8459a45c8568d157b382a315c96b7951e';
    expect(
      factsOf({
        file: 'src/pf-archetypes/druid/_folder.yaml',
        blob,
        text: "_key: '!folders!abc'\nname: Druid\ntype: Item\n",
      }),
    ).toBeNull();
    expect(() =>
      factsOf({
        file: 'src/pf-archetypes/druid/druid-troll-fury.yaml',
        blob,
        text: 'name: Druid (Troll Fury)\ntype: feat\n',
      }),
    ).toThrow();
  });

  it('parses the committed manifest as complete, every page with its bytes and hash', async () => {
    const json = JSON.parse(
      await readFile(pinnedPath('prd', 'manifest.json'), 'utf8'),
    );
    expect(manifestSchema.parse(json).status).toBe('complete');
    const { sha256: _sha256, ...unhashed } = json.pages[0];
    expect(
      completeManifestSchema.safeParse({
        ...json,
        pages: [unhashed, ...json.pages.slice(1)],
      }).success,
    ).toBe(false);
  });

  it('keeps pending pages in a draft only', async () => {
    const json = JSON.parse(
      await readFile(pinnedPath('prd', 'manifest.json'), 'utf8'),
    );
    const { bytes: _bytes, sha256: _sha256, ...pending } = json.pages[0];
    const draft = {
      status: 'draft',
      capture: json.capture,
      source: json.source,
      retiredBy: json.retiredBy,
      pages: [{ kind: 'pending', ...pending }],
      projection: {
        pages: 1,
        capturedBytes: 0,
        pendingPages: 1,
        basis: { kind: 'mean-page', meanPageBytes: 0 },
        projectedBytes: 0,
      },
    };
    expect(manifestSchema.parse(draft).status).toBe('draft');
    expect(
      manifestSchema.safeParse({
        ...draft,
        pages: [{ kind: 'captured', ...pending }],
      }).success,
    ).toBe(false);
  });
});
