// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { importCatalog } from '../../scripts/catalog/import';
import { collectDescriptionInputs } from '../../scripts/catalog/curation';
import {
  sourceDescription,
  sourceBody,
  type LoadedRecord,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { mapEntry } from '../../scripts/catalog/map';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import { z } from 'zod';
import { readCompanionSource, pinnedCompanionBody } from './companion-source';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sanitizeDescription } from '../../scripts/catalog/sanitize';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { pinnedFiles, pinnedSha256 } from '../fixtures/pf-companions-508/data';
import { materializePinnedTree } from './pinned-sources';

const WOLF = 'pf1-content/9gMnOdTPE6GA1DGi';
const bodyHashes = new Map([
  [WOLF, 'd58c63ab7514162a29333bf046605aeef7c29967a257ddca5704d2f287fb9d39'],
  [
    'pf1-content/069F47e2x4CbT6s9',
    'fa3a5a0497e31eb45138584fc8b434c62e22f52fc7eb18dc53ede3f14d4762cf',
  ],
  [
    'pf1-content/0dheEWrsMf3PmJx7',
    '1dcf7fd6d6a3c9b95d7d3f81ebdcee899f17b72bb562dc7fc947b39232115c0b',
  ],
]);
function mapCompanion(source: LoadedRecord) {
  return mapEntry({
    source,
    kind: 'companion',
    resolveKey: (key) => key,
    lookup: new Map(),
    spellClassTags: new Set(),
  });
}

it('retains complete pinned companion bodies and binds description curation to the same source', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      candidateKeys: [...bodyHashes.keys()],
    });
    for (const [key, bodyHash] of bodyHashes) {
      const source = await readCompanionSource(key);
      const body = pinnedCompanionBody(source.record);
      expect(createHash('sha256').update(body).digest('hex')).toBe(bodyHash);
      const resource = artifact.catalog.resources.find(
        (entry) => entry.externalKey === key,
      );
      if (!resource) throw new Error(`Missing imported companion ${key}`);
      expect(resource.description, source.record.name).toBe(
        sanitizeDescription({ html: body, link: () => undefined }),
      );
      expect(resource.description).toContain('Base Stats');
      expect(resource.description).toContain('Advancement');
      expect(resource.modifiers).toEqual([]);
      expect(resource.situationalNotes ?? []).toEqual([]);
      const [input] = collectDescriptionInputs({
        source,
        externalKey: key,
        kind: 'companion',
        explicitlyReviewed: true,
      });
      expect(input?.text).toBe(body);
    }
  } finally {
    await tree.dispose();
  }
});

it('preserves existing fallbacks, appends distinct notes once and ignores malformed notes', async () => {
  const source = await readCompanionSource(WOLF);
  const record = source.record;
  record.system.description = {
    value: '<p>Game content</p>',
    unidentified: '<p>Unidentified</p>',
  };
  record.system.details = {
    biography: { value: '<p>Aberrant description</p>' },
    notes: { value: '<p>Notice</p>' },
    xp: { value: 400 },
  };
  expect(sourceBody({ source })).toBe('<p>Game content</p>\n<p>Notice</p>');
  record.system.description = { unidentified: '<p>Unidentified</p>' };
  expect(sourceBody({ source })).toBe('<p>Unidentified</p>\n<p>Notice</p>');
  record.system.description = {};
  expect(sourceBody({ source })).toBe(
    '<p>Aberrant description</p>\n<p>Notice</p>',
  );
  for (const notes of [
    { value: '<p>Aberrant description</p>' },
    '<p>Aberrant description</p>',
    '',
    '   ',
    {},
    { value: 400 },
    [],
    null,
  ]) {
    record.system.details = { biography: '<p>Aberrant description</p>', notes };
    expect(sourceBody({ source })).toBe('<p>Aberrant description</p>');
  }
  record.system.details = { notes: '<p>Notice</p>' };
  expect(sourceBody({ source })).toBe('<p>Notice</p>');
  for (const notes of ['', '   ', {}, { value: 400 }, [], null]) {
    record.system.details = { notes };
    expect(sourceBody({ source })).toBe('');
  }
});

it('keeps generic readers and nonselected resource packs notes-blind', async () => {
  const source = await readCompanionSource(WOLF);
  source.record.system.details = {
    biography: '<p>Game content</p>',
    notes: { value: '<p>Notice</p>' },
  };
  expect(sourceDescription(source.record)).toBe('<p>Game content</p>');
  const contexts: Pick<LoadedRecord, 'repo' | 'pack'>[] = [
    { repo: 'pf1-content', pack: 'pf-familiars' },
    { repo: 'pf1-content', pack: 'pf-eidolon-forms' },
    { repo: 'pf1-content', pack: 'pf-monsters' },
    { repo: 'pf1', pack: 'pf-companions' },
  ];
  for (const context of contexts) {
    expect(sourceBody({ source: { ...source, ...context } })).toBe(
      '<p>Game content</p>',
    );
    const mapped = mapCompanion({ ...source, ...context });
    expect(mapped.description).toBe('<p>Game content</p>');
    expect(
      collectDescriptionInputs({
        source: { ...source, ...context },
        externalKey: WOLF,
        kind: 'companion',
        explicitlyReviewed: true,
      })[0]?.text,
    ).toBe('<p>Game content</p>');
  }
});

it('sanitizes retained notes and diagnoses links without importing actor bookkeeping', async () => {
  const source = await readCompanionSource(WOLF);
  // The same unsafe user-authored HTML exercised by the existing importer fixtures.
  source.record.system.details = {
    notes: {
      value:
        '<p onclick="evil()">Safe <strong>rules</strong><script>evil()</script><img src="x" onerror="evil()"><a href="javascript:evil()">bad</a> @UUID[Compendium.pf1.macros.Item.missing]{Unknown}</p>',
    },
    xp: { value: 'runtime-sentinel' },
    scriptCalls: [{ command: 'runtime-sentinel' }],
  };
  const resource = mapCompanion(source);
  expect(resource.description).toBe(
    '<p>Safe <strong>rules</strong>bad Unknown</p>',
  );
  expect(resource.unsupported).toContainEqual(
    expect.objectContaining({
      field: 'description.link',
      value: 'Compendium.pf1.macros.Item.missing',
    }),
  );
  expect(JSON.stringify(resource)).not.toContain('runtime-sentinel');
  expect(resource.modifiers).toEqual([]);
});

it('invalidates empty-body curation and changes the real content closure when retained notes change', async () => {
  const source = await readCompanionSource(WOLF);
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const empty = {
      externalKey: WOLF,
      kind: 'description',
      target: 'description',
      text: '',
      textSha256: createHash('sha256').update('').digest('hex'),
      status: 'drafted',
      outputs: [],
      rationale: 'Historical empty body',
    };
    const options = {
      ...tree,
      remaps,
      candidateKeys: [WOLF],
      curation: { records: [empty] },
    };
    const before = await importCatalog(options);
    expect(before.curation.stale).toContainEqual(
      expect.objectContaining({ externalKey: WOLF, text: '' }),
    );
    expect(before.curation.applied).toEqual([]);
    expect(before.curation.summary.descriptions).toEqual({
      candidates: 1,
      drafted: 0,
      checked: 0,
    });
    const binding = (artifact: typeof before) => {
      const [entry] = artifact.catalog.resources;
      if (!entry) throw new Error('Missing imported wolf');
      return buildAssessmentBinding({
        artifact,
        entry,
        evidence: {},
        registry: {},
        evidenceIds: [],
        requiredNotices: [],
      }).contentFingerprint;
    };
    const path = join(tree.contentPath, source.path);
    const record = upstreamRecord.parse(parse(await readFile(path, 'utf8')));
    const details = z
      .record(z.string(), z.unknown())
      .parse(record.system.details);
    record.system.details = { ...details, notes: '<p>Game content</p>' };
    await writeFile(path, stringify(record));
    const after = await importCatalog(options);
    expect(after.catalog.resources[0]?.description).toBe('<p>Game content</p>');
    expect(binding(after)).not.toBe(binding(before));
  } finally {
    await tree.dispose();
  }
});
