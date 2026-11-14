import { z } from 'zod';
import { isLocalConvexUrl } from '../../src/lib/local-convex-url';

export const FIXTURE_VERSION = 1;
export const convexCloudUrlPattern =
  /^https:\/\/[a-z0-9-]+(?:\.[a-z]{2}-[a-z]+-[0-9]+)?\.convex\.cloud$/;
export const roleKeys = ['gm', 'player', 'outsider'] as const;
export type RoleKey = (typeof roleKeys)[number];
export const caseKeys = [
  'smoke',
  'isolation',
  'existingMilitia',
  'characterLedger',
  'characterSheet',
  'characterAttacks',
  'privateCharacter',
  'characterNavigation',
  'membershipLoss',
  'accountDeletion',
  'characterMove',
  'sheetSelections',
  'sheetClasses',
  'animalCompanion',
  'legalNotices',
  'completeWeek',
  'realtimeActionSlot',
  'canonicalPersistence',
  'workspaceUpkeep',
  'workspaceNotoriety',
  'workspaceRecovery',
  'workspacePersistent',
  'workspaceConfirmation',
  'workspaceUpkeepLayout',
  'workspaceEventReview',
  'workspaceActivity',
  'workspaceSettlementTouch',
  'workspaceDrillRolls',
  'workspaceRecoveryActivity',
  'campaignHome',
  'campaignSections',
  'weekLinks',
  // The release-qualification suite's case (#753), never a routine journey's.
  'catalogRelease',
] as const;
export type CaseKey = (typeof caseKeys)[number];
// These cases start with a bare militia; canonical fixtures install the source.
export const canonicalCaseKeys = [
  'canonicalPersistence',
  'workspaceUpkeep',
  'workspaceNotoriety',
  'workspaceRecovery',
  'workspacePersistent',
  'workspaceConfirmation',
  'workspaceUpkeepLayout',
  'workspaceEventReview',
  'workspaceActivity',
  'workspaceSettlementTouch',
  'workspaceDrillRolls',
  'workspaceRecoveryActivity',
] as const satisfies readonly CaseKey[];
export function isCanonicalCase(caseKey: CaseKey) {
  return (canonicalCaseKeys as readonly CaseKey[]).includes(caseKey);
}

const canonicalDomain = {
  campaign: 'canonical-persistence-campaign',
  militia: 'canonical-persistence-militia',
  character: 'canonical-persistence-officer',
};

const harnessDomain = {
  campaign: 'harness-campaign',
  militia: 'harness-militia',
  character: 'harness-officer',
};

// Provider IDs belong in the external resource declaration, never in this catalog.
export const fixtureCatalog = {
  canonicalPersistence: canonicalDomain,
  // The Workspace parts keep the names they had as one journey, so layout and
  // overflow assertions still measure text of the same length.
  workspaceUpkeep: canonicalDomain,
  workspaceNotoriety: canonicalDomain,
  workspaceRecovery: canonicalDomain,
  workspacePersistent: canonicalDomain,
  workspaceConfirmation: canonicalDomain,
  workspaceUpkeepLayout: canonicalDomain,
  workspaceEventReview: canonicalDomain,
  workspaceActivity: canonicalDomain,
  workspaceSettlementTouch: canonicalDomain,
  workspaceDrillRolls: canonicalDomain,
  workspaceRecoveryActivity: canonicalDomain,
  smoke: harnessDomain,
  // The journeys split from access (smoke) keep its names so the list,
  // header and overflow checks measure text of the same length.
  campaignHome: harnessDomain,
  campaignSections: harnessDomain,
  weekLinks: harnessDomain,
  existingMilitia: {
    campaign: 'existing-militia-campaign',
    militia: 'existing-militia',
    character: 'existing-officer',
  },
  isolation: {
    campaign: 'isolation-campaign',
    militia: 'isolation-militia',
    character: 'isolation-officer',
  },
  realtimeActionSlot: {
    campaign: 'realtime-action-slot-campaign',
    militia: 'realtime-action-slot-militia',
    character: 'realtime-action-slot-officer',
  },
  completeWeek: {
    campaign: 'complete-week-campaign',
    militia: 'complete-week-militia',
    character: 'complete-week-officer',
  },
  characterLedger: {
    campaign: 'character-ledger-campaign',
    militia: 'character-ledger-militia',
    character: 'character-ledger-officer',
  },
  characterSheet: {
    campaign: 'character-sheet-campaign',
    militia: 'character-sheet-militia',
    character: 'character-sheet-character',
  },
  privateCharacter: {
    campaign: 'private-character-campaign',
    militia: 'private-character-militia',
    character: 'private-character-officer',
  },
  characterAttacks: {
    campaign: 'character-attacks-campaign',
    militia: 'character-attacks-militia',
    character: 'character-attacks-character',
  },
  characterNavigation: {
    campaign: 'character-navigation-campaign',
    militia: 'character-navigation-militia',
    character: 'character-navigation-character',
  },
  membershipLoss: {
    campaign: 'membership-loss-campaign',
    militia: 'membership-loss-militia',
    character: 'membership-loss-character',
  },
  accountDeletion: {
    campaign: 'account-deletion-campaign',
    militia: 'account-deletion-militia',
    character: 'account-deletion-character',
  },
  characterMove: {
    campaign: 'character-move-campaign',
    militia: 'character-move-militia',
    character: 'character-move-character',
  },
  sheetSelections: {
    campaign: 'sheet-selections-campaign',
    militia: 'sheet-selections-militia',
    character: 'sheet-selections-character',
  },
  sheetClasses: {
    campaign: 'sheet-classes-campaign',
    militia: 'sheet-classes-militia',
    character: 'sheet-classes-character',
  },
  animalCompanion: {
    campaign: 'animal-companion-campaign',
    militia: 'animal-companion-militia',
    character: 'animal-companion-character',
  },
  legalNotices: {
    campaign: 'legal-notices-campaign',
    militia: 'legal-notices-militia',
    character: 'legal-notices-character',
  },
  catalogRelease: {
    campaign: 'catalog-release-campaign',
    militia: 'catalog-release-militia',
    character: 'catalog-release-character',
  },
} satisfies Record<
  CaseKey,
  { campaign: string; militia: string; character: string }
>;

// A cohort capability: 32 random bytes in base64url, minted for every run
// (`support/capabilities.ts`). The whole config is one Convex environment
// variable, whose value is capped at 8 KiB (`fixtureConfigMaxBytes`); one
// capability per cohort keeps its size independent of the number of cases.
const capability = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const fixtureConfigMaxBytes = 8 * 1024;

const providerId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[a-zA-Z0-9]+$`));
const identitySchema = z
  .object({ userId: providerId('user'), email: z.email() })
  .strict();
export const workerSchema = z
  .object({
    key: z.string().regex(/^worker-[0-9]+$/),
    organizationId: providerId('org'),
    outsiderOrganizationId: providerId('org'),
    gm: identitySchema,
    player: identitySchema,
    outsider: identitySchema,
  })
  .strict();
export type WorkerCohort = z.infer<typeof workerSchema>;

export const resourceSchema = z
  .object({
    version: z.literal(FIXTURE_VERSION),
    team: z.string().regex(/^[a-z0-9-]+$/),
    project: z.string().regex(/^[a-z0-9-]+$/),
    previewName: z
      .string()
      .regex(
        /^e2e-(?:local-[a-z0-9-]+-slot-[0-9]+|pr-[1-9][0-9]*-shard-[0-9]+)$/,
      )
      .max(63),
    clerkHost: z.string().regex(/^[a-z0-9-]+\.clerk\.accounts\.dev$/),
    production: z
      .object({
        clerkHosts: z.array(z.string().min(1)),
        convexUrls: z.array(z.url()).min(1),
      })
      .strict(),
    workers: z.array(workerSchema).min(1),
  })
  .strict()
  .superRefine((resources, ctx) => {
    const keys = resources.workers.map((worker) => worker.key);
    const orgs = resources.workers.flatMap((worker) => [
      worker.organizationId,
      worker.outsiderOrganizationId,
    ]);
    const users = resources.workers.flatMap((worker) =>
      roleKeys.map((role) => worker[role].userId),
    );
    const emails = resources.workers.flatMap((worker) =>
      roleKeys.map((role) => worker[role].email.toLowerCase()),
    );
    if (
      [keys, orgs, users, emails].some(
        (values) => new Set(values).size !== values.length,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Worker cohorts must have distinct keys, organizations and identities',
      });
    }
  });
export type Resources = z.infer<typeof resourceSchema>;

export const deploymentFixtureSchema = z
  .object({
    version: z.literal(FIXTURE_VERSION),
    namespace: resourceSchema.shape.previewName,
    convexUrl: z.url(),
    localInstance: z
      .string()
      .regex(/^ep-e2e-[a-f0-9-]{36}$/)
      .optional(),
    clerkHost: resourceSchema.shape.clerkHost,
    productionConvexUrls: z.array(z.url()).min(1),
    // A fresh random ID per run: credentials of an earlier run's session
    // are refused once the next run binds its config.
    session: z.uuid(),
    workers: z.array(workerSchema.extend({ capability }).strict()).min(1),
  })
  .strict();
export type DeploymentFixture = z.infer<typeof deploymentFixtureSchema>;

export const scopeSchema = z
  .object({
    namespace: z.string(),
    version: z.number(),
    workerKey: z.string(),
    caseKey: z.enum(caseKeys),
    session: z.string(),
    token: z.string(),
  })
  .strict();
export type FixtureScope = z.infer<typeof scopeSchema>;

// Compares without stopping at the first difference, so the time a refusal
// takes says nothing about how much of the capability matched. The default
// Convex runtime has no `timingSafeEqual`.
function isSameSecret(expected: string, actual: string) {
  let difference = expected.length ^ actual.length;
  for (let index = 0; index < expected.length; index++)
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  return difference === 0;
}

export function guardFixtureScope(
  environment: Record<string, string | undefined>,
  scope: FixtureScope,
) {
  const refuse = () => {
    throw new Error('E2E fixture access refused');
  };
  if (environment.E2E_ENABLED !== 'true' || !environment.E2E_FIXTURE_CONFIG)
    return refuse();
  let config: DeploymentFixture;
  try {
    config = deploymentFixtureSchema.parse(
      JSON.parse(environment.E2E_FIXTURE_CONFIG),
    );
  } catch {
    return refuse();
  }
  // The runner installs this binding only on the newly created preview. Copying
  // fixture env flags to another deployment does not enable these operations.
  if (
    environment.CONVEX_CLOUD_URL !== config.convexUrl ||
    environment.CONVEX_DEPLOYMENT?.startsWith('prod:') ||
    config.productionConvexUrls.includes(config.convexUrl) ||
    !(config.localInstance
      ? isLocalConvexUrl(config.convexUrl) &&
        environment.E2E_LOCAL_INSTANCE === config.localInstance
      : convexCloudUrlPattern.test(config.convexUrl)) ||
    scope.version !== config.version ||
    scope.namespace !== config.namespace
  )
    return refuse();
  if (scope.session !== config.session) return refuse();
  const worker = config.workers.find((entry) => entry.key === scope.workerKey);
  if (!worker || !isSameSecret(worker.capability, scope.token)) return refuse();
  return { config, worker, domain: fixtureCatalog[scope.caseKey] };
}
