import type { Project } from '@playwright/test';
import { z } from 'zod';
import type { CaseKey } from '../fixtures/catalog';

// The browser suites (#752, e2e/README.md "Suites"). A routine run selects
// any combination of the mandatory suite, focused feature groups and live
// integration; nightly runs all of them plus the compatibility projects;
// release qualification (#753) runs alone. A diagnosis or a test-only fix
// (D-10) can select single journeys.

type Journey = readonly [file: string, title: string];

const workspaceFile = 'canonical-workspace.spec.ts';
// Each Workspace journey owns a catalog case so the journeys can run on
// separate cohorts. The Upkeep journey's setup and week-frame parts (#752,
// D-7) share its case: they run in other projects (case ownership is per
// project), never beside the core in one.
const workspaceJourneys = {
  upkeep: [
    'players prepare shared Upkeep with independent navigation and save recovery',
    'workspaceUpkeep',
  ],
  upkeepSetup: [
    'players set up a new and an existing militia while the other member follows and the outsider is refused',
    'workspaceUpkeep',
  ],
  upkeepFrame: [
    'the Upkeep week frame, reference panel and a failed History stay usable at every size',
    'workspaceUpkeep',
  ],
  notoriety: [
    'players choose the nearest settlement at maximum notoriety and resolve team conditions',
    'workspaceNotoriety',
  ],
  recovery: [
    'players recover a team at an adjusted cost and confirm a week through Activity and Event',
    'workspaceRecovery',
  ],
  persistent: [
    'players review and buy off carried persistent events before confirming the week',
    'workspacePersistent',
  ],
  confirmation: [
    'racing Confirmations commit one reviewed week and reject stale and delayed changes',
    'workspaceConfirmation',
  ],
  upkeepLayout: [
    'settlement and rank cards and team repairs stay reachable on phone and desktop',
    'workspaceUpkeepLayout',
  ],
  eventReview: [
    'Event blocks and the week review stay reachable at phone landscape and on a narrow tablet',
    'workspaceEventReview',
  ],
  activity: [
    'Activity fits landscape sizes, pans by touch and follows a correction and a Confirmation from another device',
    'workspaceActivity',
  ],
  settlementTouch: [
    'a finger pan over the settlement cards scrolls and chooses nothing, and a tap chooses',
    'workspaceSettlementTouch',
  ],
  drillRolls: [
    'Drill shows its notoriety and Training rolls only when its check needs them, with a maximum-rank exception',
    'workspaceDrillRolls',
  ],
  recoveryActivity: [
    'players stage, move and clear Activity choices for a recovered team and see a stale replacement rejected',
    'workspaceRecoveryActivity',
  ],
} as const satisfies Record<string, readonly [string, CaseKey]>;
const workspace = (part: keyof typeof workspaceJourneys): Journey => [
  workspaceFile,
  workspaceJourneys[part][0],
];

export function workspaceCaseKey(title: string): CaseKey {
  const journey = Object.values(workspaceJourneys).find(
    ([candidate]) => candidate === title,
  );
  if (!journey) throw new Error('Workspace journey has no catalog case');
  return journey[1];
}

const journeys = {
  access: [
    'access.spec.ts',
    'organization members can open their campaign and outsiders cannot',
  ],
  // Split from access (#187 and the load timeouts in XxSqla, rUyJDK and
  // qnkZrD): each owns a case seeded like `smoke`.
  campaignHome: [
    'campaign-home.spec.ts',
    'members choose and edit their campaign home and outsiders never see it',
  ],
  campaignSections: [
    'campaign-sections.spec.ts',
    'members move between campaign sections at every width and through browser history',
  ],
  weekLinks: [
    'week-links.spec.ts',
    'week links open their phase in a bounded week, and unknown campaigns stay unavailable',
  ],
  existingMilitia: [
    'existing-militia.spec.ts',
    'existing militia state survives reload within its campaign',
  ],
  characterLedger: [
    'character-ledger.spec.ts',
    'players share character and officer assignment changes',
  ],
  characterSheet: [
    'character-sheet.spec.ts',
    'two players edit one living sheet; failures stay local and rows keep their identity',
  ],
  // Split from the Character Sheet journey (#752, D-7).
  characterAttacks: [
    'character-attacks.spec.ts',
    'Attack Routines support keyboard and touch in both member sessions',
  ],
  completeWeek: [
    'complete-week.spec.ts',
    'a player confirms a complete week, every device moves to the next week once it is usable, and the outcome survives reload',
  ],
  realtimeActionSlot: [
    'realtime-action-slot.spec.ts',
    'players share a Staged Action Choice',
  ],
  // The thin lifecycle journey (#752, D-2).
  privateCharacter: [
    'private-character.spec.ts',
    'an owner creates a private Character and deletes it behind a question, after which its address is unavailable',
  ],
  characterNavigation: [
    'character-navigation.spec.ts',
    'players find grouped Characters and create campaign sheets with independent URLs and phone navigation',
  ],
  membershipLoss: [
    'membership-loss.spec.ts',
    'a player who leaves the organization loses its campaign at once while another member keeps working, and gets their Character back under No campaign',
  ],
  accountDeletion: [
    'account-deletion.spec.ts',
    'a member who deletes their account leaves their campaign Character ownerless; the others keep editing it and one takes it over',
  ],
  characterMove: [
    'character-move.spec.ts',
    'an owner moves a Character and its familiar out of a campaign and back as one group while another member watches',
  ],
  sheetSelections: [
    'sheet-selections.spec.ts',
    'a Fighter’s owner adds and orders two feats while another member follows, and the sheet’s blocks keep their places at every width',
  ],
  sheetClasses: [
    'sheet-classes.spec.ts',
    'a Wizard records a cantrip on the Spells page at every width, and a Rogue switches to Unchained rules only when asked while another member follows',
  ],
  animalCompanion: [
    'animal-companion.spec.ts',
    'a Druid’s owner creates an animal companion and sets up its progression while another member follows, at every width',
  ],
  legalNotices: [
    'legal-notices.spec.ts',
    'anyone reads the legal notices of the committed Registry, from the app footer or signed out, at every width',
  ],
  persistenceContract: [
    'canonical-persistence.spec.ts',
    'shared persistence contract uses authenticated isolated Convex',
  ],
  confirmationContract: [
    'canonical-confirmation.spec.ts',
    'shared Confirmation contract commits reviewed weeks in isolated Convex',
  ],
} as const satisfies Record<string, Journey>;

// Runs only against a preview with an active fixture Catalog Release, so it
// never joins the routine projects, and no routine journey joins its project:
// those that create ordinary private Characters can't run while a release is
// active (convex/lib/catalogFixturePolicy.ts).
export const releaseJourney = [
  'catalog-release.spec.ts',
  'a fixture Character takes the admitted Skill Focus (Acrobatics) from the feat picker under the active Catalog Release and its Acrobatics rises by 3',
] as const;

/** Every application change (`E2E required`): the 2026-10-16 coverage map's §3.1, with membership loss (D-9). */
export const mandatoryJourneys: readonly Journey[] = [
  journeys.access,
  journeys.characterSheet,
  journeys.completeWeek,
  workspace('upkeep'),
  workspace('drillRolls'),
  journeys.membershipLoss,
];

/** Named by the brief for the features a change touches (D-8); all run nightly. */
export const focusedGroups = {
  shell: [
    journeys.campaignHome,
    journeys.campaignSections,
    journeys.weekLinks,
    journeys.characterNavigation,
    journeys.privateCharacter,
  ],
  legal: [journeys.legalNotices],
  'setup-corrections': [
    journeys.existingMilitia,
    journeys.characterLedger,
    workspace('upkeepSetup'),
  ],
  sheet: [
    journeys.sheetSelections,
    journeys.sheetClasses,
    journeys.animalCompanion,
    journeys.characterAttacks,
  ],
  'week-upkeep': [
    workspace('notoriety'),
    workspace('settlementTouch'),
    workspace('upkeepLayout'),
    workspace('upkeepFrame'),
  ],
  'week-activity': [
    workspace('activity'),
    workspace('recoveryActivity'),
    journeys.realtimeActionSlot,
  ],
  'week-event-review': [
    workspace('recovery'),
    workspace('eventReview'),
    workspace('persistent'),
  ],
  'week-confirmation': [workspace('confirmation')],
} as const satisfies Record<string, readonly Journey[]>;
export type FocusedGroup = keyof typeof focusedGroups;
export const focusedGroupNames = Object.keys(focusedGroups) as [
  FocusedGroup,
  ...FocusedGroup[],
];

/** Backend contracts and Character lifecycle against real Convex (D-15). */
export const liveJourneys: readonly Journey[] = [
  journeys.confirmationContract,
  journeys.persistenceContract,
  journeys.characterMove,
  journeys.accountDeletion,
];

// Access and the journeys split from it run on every browser project that
// runs access.
export const accessJourneyFiles = [
  journeys.access[0],
  journeys.campaignHome[0],
  journeys.campaignSections[0],
  journeys.weekLinks[0],
] as const;
const accessJourneys = [
  journeys.access,
  journeys.campaignHome,
  journeys.campaignSections,
  journeys.weekLinks,
];

// Scheduled compatibility (nightly, advisory): each project keeps the
// selection it had before #752, with the Character Sheet journey's Attack
// Routines part beside it on WebKit.
const compatibility = {
  'webkit-tablet': [
    ...accessJourneys,
    journeys.existingMilitia,
    journeys.characterLedger,
    journeys.characterSheet,
    journeys.characterAttacks,
    journeys.completeWeek,
    journeys.realtimeActionSlot,
    journeys.privateCharacter,
    journeys.characterNavigation,
    journeys.membershipLoss,
    journeys.accountDeletion,
    journeys.characterMove,
    journeys.sheetSelections,
    journeys.sheetClasses,
    journeys.animalCompanion,
    journeys.legalNotices,
  ],
  'chromium-phone': accessJourneys,
  'firefox-desktop': [
    ...accessJourneys,
    journeys.existingMilitia,
    journeys.completeWeek,
  ],
} as const satisfies Record<string, readonly Journey[]>;

const routineJourneys: readonly Journey[] = [
  ...mandatoryJourneys,
  ...Object.values(focusedGroups).flat(),
  ...liveJourneys,
];

const routineTitles = z
  .array(
    z.string().refine((title) => routineJourneys.some(([, t]) => t === title)),
  )
  .min(1);

export const suiteSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('routine'),
      mandatory: z.boolean(),
      live: z.boolean(),
      groups: z.array(z.enum(focusedGroupNames)),
    })
    .refine((suite) => suite.mandatory || suite.live || suite.groups.length),
  // `titles` narrows nightly to those journeys (focused diagnosis).
  z.object({
    kind: z.literal('nightly'),
    titles: routineTitles.optional(),
  }),
  z.object({ kind: z.literal('release') }),
  z.object({ kind: z.literal('journeys'), titles: routineTitles }),
]);
export type Suite = z.infer<typeof suiteSchema>;

const routine = (parts: {
  mandatory?: boolean;
  live?: boolean;
  groups?: FocusedGroup[];
}): Suite => ({
  kind: 'routine',
  mandatory: parts.mandatory ?? false,
  live: parts.live ?? false,
  groups: focusedGroupNames.filter((group) => parts.groups?.includes(group)),
});
export const suites = {
  mandatory: routine({ mandatory: true }),
  live: routine({ live: true }),
  nightly: { kind: 'nightly' },
  release: { kind: 'release' },
} as const satisfies Record<string, Suite>;
/** Focused groups alone, as `--suite focused --group …` selects them. */
export const focused = (...groups: FocusedGroup[]): Suite =>
  routine({ groups });

const isGroup = (name: string): name is FocusedGroup =>
  (focusedGroupNames as string[]).includes(name);

// An exact journey title, or a journey file for all its routine journeys.
function journeyTitles(value: string) {
  return routineJourneys
    .filter(([file, title]) => title === value || file === value)
    .map(([, title]) => title);
}

// `--journey`, alone or with `--suite nightly` only: each value an exact
// title, or a journey file for all its routine journeys.
function selectJourneys({
  selected,
  names,
  groups,
}: {
  selected: string[];
  names: string[];
  groups: string[];
}): Suite | undefined {
  const titles = selected.map(journeyTitles);
  const nightly = names.length === 1 && names[0] === 'nightly';
  if (
    (names.length && !nightly) ||
    groups.length ||
    titles.some((found) => !found.length)
  )
    return undefined;
  return {
    kind: nightly ? 'nightly' : 'journeys',
    titles: [...new Set(titles.flat())],
  };
}

// Any combination of mandatory, focused (with its groups) and live.
function selectRoutine({
  names,
  groups,
}: {
  names: string[];
  groups: string[];
}): Suite | undefined {
  const parts = new Set(names);
  if (
    [...parts].some((name) => !['mandatory', 'focused', 'live'].includes(name))
  )
    return undefined;
  if (parts.has('focused') !== groups.length > 0 || !groups.every(isGroup))
    return undefined;
  return routine({
    mandatory: parts.has('mandatory'),
    live: parts.has('live'),
    groups: groups.filter(isGroup),
  });
}

/**
 * The suite a runner's `--suite`, `--group` and `--journey` options select,
 * or undefined for a combination the runner refuses. With none, the run is
 * the mandatory suite; nightly and release run alone.
 */
export function selectSuite({
  suites: names = [],
  groups = [],
  journeys: selected = [],
}: {
  suites?: string[];
  groups?: string[];
  journeys?: string[];
}): Suite | undefined {
  if (selected.length) return selectJourneys({ selected, names, groups });
  if (names.length === 0) return groups.length ? undefined : suites.mandatory;
  if (names.length === 1 && (names[0] === 'nightly' || names[0] === 'release'))
    return groups.length ? undefined : suites[names[0]];
  return selectRoutine({ names, groups });
}

/** The selection's exact scope, built only from the closed suite and journey names. */
export function describeSuite(suite: Suite): string {
  switch (suite.kind) {
    case 'nightly':
      return suite.titles
        ? `nightly ${suite.titles.length === 1 ? 'journey' : 'journeys'} (${suite.titles.join('; ')})`
        : 'nightly (mandatory + every focused group + live + compatibility)';
    case 'release':
      return 'release';
    case 'journeys':
      return `${suite.titles.length === 1 ? 'journey' : 'journeys'} (${suite.titles.join('; ')})`;
    case 'routine':
      return [
        suite.mandatory ? 'mandatory' : [],
        suite.groups.length ? `focused (${suite.groups.join(', ')})` : [],
        suite.live ? 'live' : [],
      ]
        .flat()
        .join(' + ');
  }
}

/** A short name for diagnostics and console lines. */
export function suiteLabel(suite: Suite) {
  return suite.kind === 'routine' ? describeSuite(suite) : suite.kind;
}

const tablet: Project = {
  dependencies: ['authentication'],
  use: {
    browserName: 'chromium',
    viewport: { width: 1194, height: 834 },
    hasTouch: true,
  },
};
const compatibilityUse = {
  'webkit-tablet': { ...tablet.use, browserName: 'webkit' },
  'chromium-phone': {
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
  'firefox-desktop': {
    browserName: 'firefox',
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
  },
} as const satisfies Record<keyof typeof compatibility, Project['use']>;

// Playwright matches a project's `grep` against the test's title path joined
// by spaces (root, project, file, describes, title), so a pattern anchored
// after a space at the end selects exactly that title. No journey title ends
// with another title (catalog.test.ts).
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titlePattern = (title: string) => new RegExp(` ${escapeRegExp(title)}$`);

type SelectedProject = { project: Project; journeys: readonly Journey[] };
function journeyProject({
  name,
  selected,
  base = tablet,
}: {
  name: string;
  selected: readonly Journey[];
  base?: Project;
}): SelectedProject {
  return {
    project: {
      ...base,
      name,
      testMatch: [...new Set(selected.map(([file]) => file))],
      grep: selected.map(([, title]) => titlePattern(title)),
    },
    journeys: selected,
  };
}

// Routine projects in run order. Workers take test groups in project order,
// so the longest go first and the parallel critical path stays short
// (coverage map §3, 2026-10-16 run): the Confirmation and persistence
// contracts (202 s and 170 s), the move journey (102 s), then the parts
// with the longest journeys. The two contracts stay separate projects: both
// own the `canonicalPersistence` case.
type RoutinePart =
  | { kind: 'live' }
  | { kind: 'mandatory' }
  | { kind: 'focused'; group: FocusedGroup };
const routineProjects: readonly {
  name: string;
  part: RoutinePart;
  journeys: readonly Journey[];
}[] = [
  {
    name: 'canonical-confirmation',
    part: { kind: 'live' },
    journeys: [journeys.confirmationContract],
  },
  {
    name: 'canonical-persistence',
    part: { kind: 'live' },
    journeys: [journeys.persistenceContract],
  },
  {
    name: 'live',
    part: { kind: 'live' },
    journeys: [journeys.characterMove, journeys.accountDeletion],
  },
  ...(
    [
      'week-event-review',
      'mandatory',
      'week-activity',
      'sheet',
      'shell',
      'setup-corrections',
      'week-upkeep',
      'week-confirmation',
      'legal',
    ] as const
  ).map((name) =>
    name === 'mandatory'
      ? {
          name,
          part: { kind: 'mandatory' } as const,
          journeys: mandatoryJourneys,
        }
      : {
          name: `focused-${name}`,
          part: { kind: 'focused', group: name } as const,
          journeys: focusedGroups[name],
        },
  ),
];

function includesPart({ suite, part }: { suite: Suite; part: RoutinePart }) {
  if (suite.kind === 'nightly') return true;
  if (suite.kind !== 'routine') return false;
  if (part.kind === 'focused') return suite.groups.includes(part.group);
  return suite[part.kind];
}

const authentication: Project = {
  name: 'authentication',
  testMatch: 'auth.setup.ts',
  retries: 0,
};

function selectedProjects(suite: Suite): SelectedProject[] {
  if (suite.kind === 'release')
    return [
      journeyProject({
        name: 'release-qualification',
        selected: [releaseJourney],
      }),
    ];
  // A journey selection keeps only its journeys, and only projects with one.
  const titles = 'titles' in suite ? suite.titles : undefined;
  const narrow = (members: readonly Journey[]) =>
    titles ? members.filter(([, title]) => titles.includes(title)) : members;
  const routineSelection = routineProjects.flatMap(
    ({ name, part, journeys: members }) => {
      const selected =
        suite.kind === 'journeys' || includesPart({ suite, part })
          ? narrow(members)
          : [];
      return selected.length ? [journeyProject({ name, selected })] : [];
    },
  );
  const compatibilityProjects =
    suite.kind === 'nightly'
      ? Object.entries(compatibility).flatMap(([name, members]) => {
          const selected = narrow(members);
          return selected.length
            ? [
                journeyProject({
                  name,
                  selected,
                  base: {
                    ...tablet,
                    use: compatibilityUse[name as keyof typeof compatibility],
                  },
                }),
              ]
            : [];
        })
      : [];
  return [...routineSelection, ...compatibilityProjects];
}

export function browserProjects(suite: Suite): Project[] {
  return [
    authentication,
    ...selectedProjects(suite).map(({ project }) => project),
  ];
}

/**
 * Every result the selection requires: authentication, then each project's
 * journeys. The reporter and runner count and identify them independently
 * of what Playwright selected.
 */
export function requiredTests(
  suite: Suite,
): (readonly [file: string, project: string, title: string])[] {
  return [
    ['auth.setup.ts', 'authentication', 'prepare fresh role sessions'],
    ...selectedProjects(suite).flatMap(({ project, journeys: members }) =>
      members.map(([file, title]) => [file, project.name!, title] as const),
    ),
  ];
}

/** Whether a nightly-only step runs in this project (access's extension). */
export function runsNightlyExtension({
  suite,
  project,
}: {
  suite: Suite;
  project: string;
}) {
  return (
    suite.kind === 'nightly' &&
    ['mandatory', 'chromium-phone'].includes(project)
  );
}
