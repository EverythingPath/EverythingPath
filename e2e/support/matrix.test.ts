// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  browserProjects,
  describeSuite,
  focused,
  runsNightlyExtension,
  focusedGroupNames,
  requiredTests,
  selectSuite,
  suites,
  type Suite,
} from './matrix';

const authentication = [
  'auth.setup.ts',
  'authentication',
  'prepare fresh role sessions',
];

describe('the mandatory suite', () => {
  it('requires authentication and the six journeys the 2026-10-16 coverage map keeps, membership loss included (D-9)', () => {
    expect(requiredTests(suites.mandatory)).toEqual([
      authentication,
      [
        'access.spec.ts',
        'mandatory',
        'organization members can open their campaign and outsiders cannot',
      ],
      [
        'character-sheet.spec.ts',
        'mandatory',
        'two players edit one living sheet; failures stay local and rows keep their identity',
      ],
      [
        'complete-week.spec.ts',
        'mandatory',
        'a player confirms a complete week, every device moves to the next week once it is usable, and the outcome survives reload',
      ],
      [
        'canonical-workspace.spec.ts',
        'mandatory',
        'players prepare shared Upkeep with independent navigation and save recovery',
      ],
      [
        'canonical-workspace.spec.ts',
        'mandatory',
        'Drill shows its notoriety and Training rolls only when its check needs them, with a maximum-rank exception',
      ],
      [
        'membership-loss.spec.ts',
        'mandatory',
        'a player who leaves the organization loses its campaign at once while another member keeps working, and gets their Character back under No campaign',
      ],
    ]);
  });
});

describe('suite selection', () => {
  it('runs the mandatory suite when nothing is selected', () => {
    expect(selectSuite({})).toEqual(suites.mandatory);
    expect(selectSuite({ suites: ['mandatory'] })).toEqual(suites.mandatory);
  });

  it('combines mandatory, named focused groups and live in one run, in a fixed order', () => {
    expect(
      selectSuite({
        suites: ['live', 'focused', 'mandatory'],
        groups: ['week-activity', 'shell', 'shell'],
      }),
    ).toEqual({
      kind: 'routine',
      mandatory: true,
      live: true,
      groups: ['shell', 'week-activity'],
    });
    expect(selectSuite({ suites: ['focused'], groups: ['legal'] })).toEqual(
      focused('legal'),
    );
    expect(selectSuite({ suites: ['live'] })).toEqual(suites.live);
  });

  it('runs nightly and release alone', () => {
    expect(selectSuite({ suites: ['nightly'] })).toEqual(suites.nightly);
    expect(selectSuite({ suites: ['release'] })).toEqual(suites.release);
  });

  it('selects single journeys by exact title or by file', () => {
    expect(
      selectSuite({
        journeys: [
          'private-character.spec.ts',
          'players share a Staged Action Choice',
        ],
      }),
    ).toEqual({
      kind: 'journeys',
      titles: [
        'an owner creates a private Character and deletes it behind a question, after which its address is unavailable',
        'players share a Staged Action Choice',
      ],
    });
  });

  it('narrows nightly to journeys by exact title or by file', () => {
    expect(
      selectSuite({
        suites: ['nightly'],
        journeys: ['access.spec.ts', 'players share a Staged Action Choice'],
      }),
    ).toEqual({
      kind: 'nightly',
      titles: [
        'organization members can open their campaign and outsiders cannot',
        'players share a Staged Action Choice',
      ],
    });
  });

  it.each([
    [{ suites: ['nightly', 'mandatory'] }],
    [{ suites: ['nightly'], groups: ['shell'], journeys: ['access.spec.ts'] }],
    [{ suites: ['nightly', 'live'], journeys: ['access.spec.ts'] }],
    [{ suites: ['release'], journeys: ['access.spec.ts'] }],
    [{ suites: ['nightly'], journeys: ['catalog-release.spec.ts'] }],
    [{ suites: ['nightly'], journeys: ['canonical-cutover.spec.ts'] }],
    [{ suites: ['release', 'nightly'] }],
    [{ suites: ['release'], groups: ['shell'] }],
    [{ suites: ['focused'] }],
    [{ suites: ['mandatory'], groups: ['shell'] }],
    [{ groups: ['shell'] }],
    [{ suites: ['focused'], groups: ['finished-weeks'] }],
    [{ suites: ['routine'] }],
    [{ suites: ['mandatory'], journeys: ['access.spec.ts'] }],
    [{ journeys: ['canonical-cutover.spec.ts'] }],
    [{ journeys: ['players share a Staged Action'] }],
    [{ journeys: ['catalog-release.spec.ts'] }],
  ])('refuses %j', (options) => {
    expect(selectSuite(options)).toBeUndefined();
  });
});

describe('scope', () => {
  it.each([
    [suites.mandatory, 'mandatory', 7],
    [
      selectSuite({
        suites: ['mandatory', 'focused', 'live'],
        groups: ['week-activity', 'shell'],
      })!,
      'mandatory + focused (shell, week-activity) + live',
      7 + 5 + 3 + 4,
    ],
    [focused('sheet'), 'focused (sheet)', 5],
    [suites.live, 'live', 5],
    [
      suites.nightly,
      'nightly (mandatory + every focused group + live + compatibility)',
      64,
    ],
    [suites.release, 'release', 2],
    [
      selectSuite({ journeys: ['legal-notices.spec.ts'] })!,
      'journey (anyone reads the legal notices of the committed Registry, from the app footer or signed out, at every width)',
      2,
    ],
  ] as [Suite, string, number][])(
    'states the exact scope of %j and its required results',
    (suite, description, count) => {
      expect(describeSuite(suite)).toBe(description);
      expect(requiredTests(suite)).toHaveLength(count);
    },
  );

  it('sizes each focused group as the coverage map lists it', () => {
    expect(
      Object.fromEntries(
        focusedGroupNames.map((group) => [
          group,
          requiredTests(focused(group)).length - 1,
        ]),
      ),
    ).toEqual({
      shell: 5,
      legal: 1,
      'setup-corrections': 3,
      sheet: 4,
      'week-upkeep': 4,
      'week-activity': 3,
      'week-event-review': 3,
      'week-confirmation': 1,
    });
  });

  it('puts every routine journey in exactly one of mandatory, a focused group and live', () => {
    const routine = selectSuite({
      suites: ['mandatory', 'focused', 'live'],
      groups: [...focusedGroupNames],
    })!;
    const identities = requiredTests(routine).map(
      ([file, , title]) => `${file}: ${title}`,
    );
    expect(new Set(identities).size).toBe(identities.length);
    // Nightly runs each of them on Chromium tablet beside the compatibility
    // projects.
    const nightly = requiredTests(suites.nightly);
    expect(
      nightly.filter(
        ([, project]) =>
          !['webkit-tablet', 'chromium-phone', 'firefox-desktop'].includes(
            project,
          ),
      ),
    ).toEqual(requiredTests(routine));
  });

  it('runs a selected journey in the project of its suite part only', () => {
    expect(
      requiredTests(selectSuite({ journeys: ['private-character.spec.ts'] })!),
    ).toEqual([
      authentication,
      [
        'private-character.spec.ts',
        'focused-shell',
        'an owner creates a private Character and deletes it behind a question, after which its address is unavailable',
      ],
    ]);
  });
});

describe('nightly journeys (focused diagnosis)', () => {
  const access =
    'organization members can open their campaign and outsiders cannot';
  const sheet = selectSuite({
    suites: ['nightly'],
    journeys: ['character-sheet.spec.ts'],
  })!;

  it('requires each selected journey in every nightly project that runs it, and nothing else', () => {
    const nightly = selectSuite({
      suites: ['nightly'],
      journeys: [access, 'players share a Staged Action Choice'],
    })!;
    expect(requiredTests(nightly)).toEqual([
      ...requiredTests(suites.nightly).filter(
        ([, project, title]) =>
          project === 'authentication' ||
          title === access ||
          title === 'players share a Staged Action Choice',
      ),
    ]);
    expect(requiredTests(nightly).map(([, project]) => project)).toEqual([
      'authentication',
      'mandatory',
      'focused-week-activity',
      'webkit-tablet',
      'webkit-tablet',
      'chromium-phone',
      'firefox-desktop',
    ]);
  });

  it('keeps nightly-only coverage: the compatibility projects and the access extension', () => {
    expect(requiredTests(sheet).map(([, project, title]) => [project, title]))
      .toMatchInlineSnapshot(`
        [
          [
            "authentication",
            "prepare fresh role sessions",
          ],
          [
            "mandatory",
            "two players edit one living sheet; failures stay local and rows keep their identity",
          ],
          [
            "webkit-tablet",
            "two players edit one living sheet; failures stay local and rows keep their identity",
          ],
        ]
      `);
    const nightly = selectSuite({ suites: ['nightly'], journeys: [access] })!;
    for (const project of ['mandatory', 'chromium-phone'])
      expect(runsNightlyExtension({ suite: nightly, project })).toBe(true);
    // A routine --journey run never runs the extension.
    expect(
      runsNightlyExtension({
        suite: selectSuite({ journeys: [access] })!,
        project: 'mandatory',
      }),
    ).toBe(false);
  });

  it('runs only the projects with a selected journey, each with only those journeys', () => {
    expect(
      browserProjects(sheet).map(({ name, grep }) => [name, grep]),
    ).toEqual([
      ['authentication', undefined],
      ['mandatory', [expect.any(RegExp)]],
      ['webkit-tablet', [expect.any(RegExp)]],
    ]);
  });

  it('names the scope and its required results', () => {
    expect(describeSuite(sheet)).toBe(
      'nightly journey (two players edit one living sheet; failures stay local and rows keep their identity)',
    );
    expect(requiredTests(sheet)).toHaveLength(3);
  });
});

describe('browser projects', () => {
  // Playwright's grep title: root, project, file and title joined by spaces.
  const grepTitle = ({
    project,
    file,
    title,
  }: {
    project: string;
    file: string;
    title: string;
  }) => ['', project, file, title].join(' ');

  it("selects exactly each project's journeys within the files it matches", () => {
    const every = requiredTests(suites.nightly);
    for (const project of browserProjects(suites.nightly).slice(1)) {
      const files = [project.testMatch].flat();
      const patterns = [project.grep].flat() as RegExp[];
      const selected = every
        .filter(([file]) => files.includes(file))
        .filter(([file, , title]) =>
          patterns.some((pattern) =>
            pattern.test(grepTitle({ project: project.name!, file, title })),
          ),
        )
        .map(([file, , title]) => `${file}: ${title}`);
      expect([...new Set(selected)].sort()).toEqual(
        every
          .filter(([, name]) => name === project.name)
          .map(([file, , title]) => `${file}: ${title}`)
          .sort(),
      );
    }
  });

  it('never lets a journey title end another, so title patterns stay exact', () => {
    const titles = [
      ...new Set(requiredTests(suites.nightly).map(([, , title]) => title)),
    ];
    for (const title of titles)
      for (const other of titles)
        if (other !== title) expect(other.endsWith(` ${title}`)).toBe(false);
  });

  it('orders the routine projects longest first and adds the compatibility projects only at night', () => {
    expect(browserProjects(suites.nightly).map(({ name }) => name)).toEqual([
      'authentication',
      'canonical-confirmation',
      'canonical-persistence',
      'live',
      'focused-week-event-review',
      'mandatory',
      'focused-week-activity',
      'focused-sheet',
      'focused-shell',
      'focused-setup-corrections',
      'focused-week-upkeep',
      'focused-week-confirmation',
      'focused-legal',
      'webkit-tablet',
      'chromium-phone',
      'firefox-desktop',
    ]);
    expect(browserProjects(suites.mandatory).map(({ name }) => name)).toEqual([
      'authentication',
      'mandatory',
    ]);
    expect(
      browserProjects(focused('legal', 'shell')).map(({ name }) => name),
    ).toEqual(['authentication', 'focused-shell', 'focused-legal']);
  });
});
