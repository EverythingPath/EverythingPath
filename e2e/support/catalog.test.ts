// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  canonicalCaseKeys,
  caseKeys,
  fixtureCatalog,
} from '../fixtures/catalog';
import {
  accessJourneyFiles,
  browserProjects,
  releaseJourney,
  requiredTests,
  suites,
  workspaceCaseKey,
} from './matrix';

it('declares a domain for every catalog case', () => {
  expect(Object.keys(fixtureCatalog).sort()).toEqual([...caseKeys].sort());
  expect(caseKeys).toEqual(expect.arrayContaining([...canonicalCaseKeys]));
});

it('gives each Workspace journey a canonical case', () => {
  const titles = requiredTests(suites.nightly)
    .filter(([file]) => file === 'canonical-workspace.spec.ts')
    .map(([, , title]) => title);
  expect(titles).toHaveLength(13);
  for (const title of titles)
    expect(canonicalCaseKeys).toContain(workspaceCaseKey(title));
  expect(() => workspaceCaseKey('an undeclared journey')).toThrow();
});

// Each required journey file's `test.use({ caseKey })` selections.
const journeyCases = [
  ...new Set(requiredTests(suites.nightly).map(([name]) => name)),
]
  .filter((name) => name.endsWith('.spec.ts'))
  .flatMap((name) =>
    [
      ...readFileSync(join(process.cwd(), 'e2e', name), 'utf8').matchAll(
        /test\.use\(\{ caseKey: '([A-Za-z]+)'(?:,| \})/g,
      ),
    ].map(([, key]) => [name, key] as const),
  );

const sheetJourneys = [
  [
    'character-sheet.spec.ts',
    'two players edit one living sheet; failures stay local and rows keep their identity',
    'characterSheet',
  ],
  [
    'character-attacks.spec.ts',
    'Attack Routines support keyboard and touch in both member sessions',
    'characterAttacks',
  ],
  [
    'private-character.spec.ts',
    'an owner creates a private Character and deletes it behind a question, after which its address is unavailable',
    'privateCharacter',
  ],
  [
    'character-navigation.spec.ts',
    'players find grouped Characters and create campaign sheets with independent URLs and phone navigation',
    'characterNavigation',
  ],
  [
    'membership-loss.spec.ts',
    'a player who leaves the organization loses its campaign at once while another member keeps working, and gets their Character back under No campaign',
    'membershipLoss',
  ],
  [
    'account-deletion.spec.ts',
    'a member who deletes their account leaves their campaign Character ownerless; the others keep editing it and one takes it over',
    'accountDeletion',
  ],
  [
    'character-move.spec.ts',
    'an owner moves a Character and its familiar out of a campaign and back as one group while another member watches',
    'characterMove',
  ],
  [
    'sheet-selections.spec.ts',
    'a Fighter’s owner adds and orders two feats while another member follows, and the sheet’s blocks keep their places at every width',
    'sheetSelections',
  ],
  [
    'sheet-classes.spec.ts',
    'a Wizard records a cantrip on the Spells page at every width, and a Rogue switches to Unchained rules only when asked while another member follows',
    'sheetClasses',
  ],
  [
    'animal-companion.spec.ts',
    'a Druid’s owner creates an animal companion and sets up its progression while another member follows, at every width',
    'animalCompanion',
  ],
  [
    'legal-notices.spec.ts',
    'anyone reads the legal notices of the committed Registry, from the app footer or signed out, at every width',
    'legalNotices',
  ],
] as const;

it.each(sheetJourneys)(
  'requires %s once on Chromium tablet and on nightly WebKit, with its own case',
  (file, title, caseKey) => {
    const projects = requiredTests(suites.nightly)
      .filter(([name]) => name === file)
      .map(([, project, required]) => [project, required]);
    expect(projects).toHaveLength(2);
    expect(projects).toContainEqual(['webkit-tablet', title]);
    // The journey selects exactly this case, which no other journey uses.
    expect(journeyCases.filter(([, key]) => key === caseKey)).toEqual([
      [file, caseKey],
    ]);
  },
);

// Within a project a case belongs to one journey (case-attempt.ts); the
// Upkeep journey's parts share its case only across projects.
it('gives every journey of a project a case of its own', () => {
  const caseOf = (file: string, title: string) =>
    file === 'canonical-workspace.spec.ts'
      ? workspaceCaseKey(title)
      : journeyCases.find(([name]) => name === file)?.[1];
  for (const { name } of browserProjects(suites.nightly).slice(1)) {
    const cases = requiredTests(suites.nightly)
      .filter(([, project]) => project === name)
      .map(([file, , title]) => caseOf(file, title));
    expect(cases.every(Boolean), name).toBe(true);
    expect(new Set(cases).size, name).toBe(cases.length);
  }
});

const accessSplits = [
  ['campaign-home.spec.ts', 'campaignHome'],
  ['campaign-sections.spec.ts', 'campaignSections'],
  ['week-links.spec.ts', 'weekLinks'],
] as const;

it('lists every journey split from access with its case', () => {
  expect([...accessJourneyFiles].sort()).toEqual(
    ['access.spec.ts', ...accessSplits.map(([file]) => file)].sort(),
  );
});

it.each(accessSplits)(
  'gives %s, split from access, its own case seeded like access, wherever access runs',
  (file, caseKey) => {
    expect(caseKeys).toContain(caseKey);
    expect(fixtureCatalog[caseKey]).toEqual(fixtureCatalog.smoke);
    expect(canonicalCaseKeys).not.toContain(caseKey);
    expect(accessJourneyFiles).toContain(file);
    // The journey selects exactly this case, which no other journey uses.
    expect(journeyCases.filter(([, key]) => key === caseKey)).toEqual([
      [file, caseKey],
    ]);
    // Every compatibility project runs access and this journey.
    for (const name of [file, 'access.spec.ts'])
      expect(
        requiredTests(suites.nightly)
          .filter(([candidate]) => candidate === name)
          .map(([, project]) => project)
          .filter((project) =>
            ['webkit-tablet', 'chromium-phone', 'firefox-desktop'].includes(
              project,
            ),
          ),
      ).toEqual(['webkit-tablet', 'chromium-phone', 'firefox-desktop']);
  },
);

it('runs the release journey only in the release suite, on its own case, and no routine journey there', () => {
  expect(requiredTests(suites.release)).toEqual([
    ['auth.setup.ts', 'authentication', 'prepare fresh role sessions'],
    [...releaseJourney.slice(0, 1), 'release-qualification', releaseJourney[1]],
  ]);
  for (const suite of [suites.mandatory, suites.live, suites.nightly]) {
    expect(
      requiredTests(suite).filter(([file]) => file === releaseJourney[0]),
    ).toEqual([]);
    expect(
      browserProjects(suite).flatMap((project) => [project.testMatch].flat()),
    ).not.toContain(releaseJourney[0]);
  }
  const cases = readdirSync(join(process.cwd(), 'e2e'))
    .filter((name) => name.endsWith('.spec.ts'))
    .flatMap((name) =>
      [
        ...readFileSync(join(process.cwd(), 'e2e', name), 'utf8').matchAll(
          /test\.use\(\{ caseKey: '([A-Za-z]+)'(?:,| \})/g,
        ),
      ].map(([, key]) => [name, key] as const),
    );
  expect(cases.filter(([, key]) => key === 'catalogRelease')).toEqual([
    [releaseJourney[0], 'catalogRelease'],
  ]);
  expect(fixtureCatalog.catalogRelease.campaign).toBe(
    'catalog-release-campaign',
  );
});
