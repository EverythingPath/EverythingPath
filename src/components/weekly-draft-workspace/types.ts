import type { WeekReviewFacts } from '../week-review/review-facts';
import type { CanonicalRoster } from '~/lib/canonical-roster';
import type { ReferenceFacts } from './reference-facts';
import type { CanonicalResolutionEffects } from '~/lib/canonical-weekly-resolution';
import type { PersistentChange } from '~/lib/rules-persistent-events';
import type { EventOutcomeChange } from '~/lib/rules-event-outcomes';
import type {
  EventDispatch,
  EventTableArithmetic,
} from '~/lib/rules-event-selection';
import type { ActivityProjection } from '~/lib/rules-activity';
import type { EconomyState } from '~/lib/rules-economy-state';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll, StagedActionChoice } from '~/lib/weekly-draft-facts';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type { RollReadFacts } from './roll-facts';
import type { RollSpec } from '~/lib/raw-roll';
import type { OFFICER_ROLES } from '~/lib/canonical-roster';
import type { TrackedCharacter } from '~/lib/rules-character-state';
import type { ProgressionBoon } from '~/lib/rules-progression';
import type { EventSabotageFacts } from './event-sabotage-facts';
import type { OverseerSupportFacts } from './overseer-support-facts';
export type OfficerRole = (typeof OFFICER_ROLES)[number];
type CharacterStatus = TrackedCharacter['status'];
export type Phase = 'upkeep' | 'activity' | 'event' | 'persistent' | 'summary';
export type UpkeepRollField = Extract<
  WeeklyDraftEdit,
  { kind: 'upkeep_roll' }
>['field'];
export type RollFact = RollReadFacts & {
  field: UpkeepRollField;
  count: number;
  sides: number;
  modifier: number | null;
  total: number | null;
  dc: number | null;
  modifiers: { source: string; value: number }[];
};
export type UpkeepView = {
  phase: 'upkeep';
  skipped: boolean;
  ready: boolean;
  rolls: RollFact[];
  before: {
    rank: number;
    training: number;
    treasuryCopper: number;
    notoriety: number;
  };
  after: {
    rank: number;
    training: number;
    treasuryCopper: number;
    notoriety: number;
  };
  minimumTreasuryCopper: number;
  officers: {
    characterId: string;
    name: string | null;
    roles: CanonicalRoster['officers'][number]['role'][];
  }[];
  transfers: WeeklyDraft['upkeep']['treasuryTransfers'];
  exceptions: {
    subjectId: string;
    ruleId: string;
    name: string;
    exceptionId: string;
    reason: string;
  }[];
  requirements: string[];
  warnings: string[];
  // Null in the militia's first week, when Upkeep is skipped entirely.
  sections: UpkeepSections | null;
};
// A warning or blocker message owned by one Upkeep item; the view shows it
// under that item while the frame lists the same codes in This phase.
export type UpkeepIssue = { code: string; message: string };
export type UpkeepCheck<Result extends string> = RollFact & {
  // Null while the roll is missing, incomplete or otherwise not calculable.
  result: Result | null;
  issues: UpkeepIssue[];
};
// A training roll. `rank` is added by the rules (never entered) and
// `trainingDelta` is this step's calculated change, null until known.
export type UpkeepLoss = RollFact & {
  rank: number | null;
  multiplier: number;
  trainingDelta: number | null;
  issues: UpkeepIssue[];
};
// Open: applicable and still needs an input here. Waiting: an earlier step
// must be resolved before this one can be known. Inapplicable sections
// collapse to one line with their reason.
export type UpkeepSectionStatus =
  | 'inapplicable'
  | 'waiting'
  | 'open'
  | 'resolved';
export type UpkeepDisabledTeam = {
  teamId: string;
  name: string;
  typeName: string;
  tier: number | null;
  decision: 'recover' | 'leave' | null;
  rulesCostCopper: number;
  enteredCostCopper: number;
  adjustment: { deltaCopper: number; reason: string } | null;
  // Present while the recovery needs, or already has, a reasoned exception.
  fundsException: {
    exceptionId: string;
    reason: string;
    required: boolean;
  } | null;
  issues: UpkeepIssue[];
};
export type UpkeepMissingTeam = {
  teamId: string;
  name: string;
  typeName: string;
  tier: number | null;
  return:
    | { kind: 'scheduled'; week: number; status: 'active' | 'disabled' }
    | {
        kind: 'check';
        check: Omit<UpkeepCheck<'returns' | 'stays-missing' | 'lost'>, 'field'>;
      }
    | null;
  issues: UpkeepIssue[];
};
// One staged deposit or withdrawal, in staged order.
export type UpkeepTransfer = {
  transferId: string;
  direction: 'deposit' | 'withdraw';
  copper: number;
  // The treasury change Theft makes to this deposit (negative); null if none.
  theftCopper: number | null;
  // Present while a withdrawal beyond the treasury needs, or already has, its
  // reasoned exception.
  fundsException: {
    exceptionId: string;
    reason: string;
    required: boolean;
  } | null;
  issues: UpkeepIssue[];
};
// One PC's boon for one gained rank, recorded as the text acknowledgement
// of `subjectId` (`upkeep:boon:<rank>:<characterId>`).
export type UpkeepRankBoon = {
  subjectId: string;
  characterId: string;
  name: string;
  // The recorded acknowledgement's identity, or the one a first record uses.
  acknowledgementId: string;
  // Null until the boon's outcome is recorded.
  outcome: string | null;
  // The feat cards of a title with a fixed feat package; null for open
  // outcomes (Skilled, Gift, XP, Champion), which are recorded as text.
  feats: {
    options: string[];
    selected: string | null;
  } | null;
  // Still unrecorded, so the week cannot be confirmed yet.
  required: boolean;
};
// A rank gained this week, its Table 6-1 training threshold and the boon
// every eligible PC gains with it.
export type UpkeepRankGain = {
  rank: number;
  minimumTraining: number;
  reward: ProgressionBoon;
  boons: UpkeepRankBoon[];
};
export type UpkeepRank = {
  status: UpkeepSectionStatus;
  before: number;
  // Null while waiting or while no active PC level can cap the rank.
  after: number | null;
  // The training Step 4 judged, after the earlier steps; null while waiting.
  training: number | null;
  // The next rank above `after` and its minimum training; null at the top
  // rank or while `after` is unknown.
  next: { rank: number; minimumTraining: number } | null;
  // Set when the highest active PC level, not training, keeps the militia
  // from its next rank; `trainingRank` is the rank training alone reaches.
  capped: { trainingRank: number; highestPcLevel: number } | null;
  // Every rank gained this week in order, each with its boons.
  gains: UpkeepRankGain[];
  issues: UpkeepIssue[];
};
export type UpkeepSections = {
  teams: {
    status: UpkeepSectionStatus;
    treasuryBeforeCopper: number;
    // Rules Baseline treasury after paying decided recoveries.
    treasuryAfterRecoveryCopper: number;
    // Post-baseline Table Adjustments from changed recovery prices.
    adjustments: { teamId: string; name: string; deltaCopper: number }[];
    disabled: UpkeepDisabledTeam[];
    missing: UpkeepMissingTeam[];
    // What the open step still needs from the table, or null when settled.
    need: 'decision' | 'roll' | null;
    // Staged decisions for teams no longer on the roster (for example after
    // a Militia correction removed them); each blocks until cleared.
    orphans: { teamId: string }[];
  };
  attrition: {
    status: UpkeepSectionStatus;
    trainingDelta: number | null;
    check: UpkeepCheck<'natural-20' | 'success' | 'failure'>;
    training: UpkeepLoss | null;
  };
  notoriety: {
    status: UpkeepSectionStatus;
    notoriety: number;
    threshold: number;
    trainingDelta: number | null;
    loss: UpkeepLoss | null;
    check: UpkeepCheck<'success' | 'failure'> | null;
    settlement: {
      required: boolean;
      selected: string | null;
      choices: {
        settlementId: string;
        name: string;
        reputation: string | null;
      }[];
      change: { name: string; before: string; after: string } | null;
      issues: UpkeepIssue[];
    } | null;
  };
  shortage: {
    status: UpkeepSectionStatus;
    treasuryAfterRecoveryCopper: number;
    minimumCopper: number;
    trainingDelta: number | null;
    loss: UpkeepLoss | null;
  };
  rank: UpkeepRank;
  transfers: {
    status: UpkeepSectionStatus;
    // Treasury before and after the ordered transfers (and any Theft on
    // them); null while an earlier step is still open.
    beforeCopper: number | null;
    afterCopper: number | null;
    items: UpkeepTransfer[];
    // Treasury Table Adjustments, which apply after the whole week and are
    // never part of before/after; named under the list only.
    // A recovery price names its team; any other adjustment its reason.
    adjustments: {
      adjustmentId: string;
      label: string;
      operation: 'add' | 'set';
      copper: number;
    }[];
    // Transfer warnings no listed transfer owns.
    issues: UpkeepIssue[];
  };
  // Warnings no single item owns, such as archived officers' check bonuses.
  general: UpkeepIssue[];
};
// A requirement or warning code with its player-facing message.
export type ActivityIssue = { code: string; message: string };
// One team as Activity sees it: its post-Upkeep condition, or a team that an
// earlier Recruit Team choice in this week stages.
export type ActivityTeamFact = {
  teamId: string;
  name: string;
  teamType: string | null;
  typeName: string | null;
  tier: number | null;
  condition: CanonicalRoster['teams'][number]['status'];
  // A queued effect or a carried Rivalry keeps it out of this Activity.
  unavailable: boolean;
  // Set for a team staged by the Recruit Team choice in Action Slot N.
  recruitedInSlot: number | null;
};
export type ActivityCheck = {
  spec: RollSpec;
  organizationCheck: 'loyalty' | 'secrecy' | 'security' | null;
  dc: number | null;
  // Null until the rules reach this check (for example before a team is
  // chosen); the entered dice total is never folded into the bonus.
  modifier: number | null;
  total: number | null;
  // The rules' reading of the total against the DC (true when the check has
  // no DC); null until the rules decide it.
  succeeded: boolean | null;
  breakdown: { source: string; label: string; value: number }[];
};
// A modifier recorded on the check roll. Helpful and bonus entries select a
// rules source; custom entries carry their own reason; automatic sources are
// calculated anyway, so a recorded copy is ignored; unknown ones come from
// older data and stay visible and removable.
export type ActivityRecordedModifier = {
  index: number;
  sourceId: string;
  kind: 'helpful' | 'bonus' | 'custom' | 'automatic' | 'unknown';
  label: string;
  value: number;
  reason: string;
  warning: string | null;
};
export type ActivityBonusChoice = {
  sourceId: string;
  label: string;
  value: number;
};
// What the ordered Activity fold has done before one slot: officer changes,
// refuges activated, characters rescued or restored, and items and caches
// moved by earlier choices.
export type ActivityPositionFacts = {
  officers: { characterId: string; role: OfficerRole }[];
  // Settlements whose refuge is active at this position.
  refugeSettlementIds: string[];
  // Each settlement as the ordered fold sees it at this position: its
  // reputation with every current shift (null while unknown), whether a
  // refuge may be activated there, and its recorded occupation and security.
  settlements: {
    settlementId: string;
    reputation: string | null;
    refugeAllowed: boolean;
    occupied: boolean | null;
    secured: boolean | null;
  }[];
  // Settlements an earlier choice already tried to sway with propaganda,
  // with that choice's identity.
  propaganda: { settlementId: string; choiceId: string }[];
  // Tracked character conditions at this position; absent when untracked.
  characterStatus: { characterId: string; status: CharacterStatus }[];
  // The militia's items and caches at this position; null while the militia
  // records no economy.
  economy: Pick<EconomyState, 'items' | 'caches'> | null;
};
// One Guarantee Event or Manipulate Events choice's event candidates, read
// from the Event phase's own facts. Event rolls and chooses them; Activity
// only shows where they stand.
export type ActivityCandidateSet = {
  choiceId: string;
  // False when the choice guarantees nothing this week (a calm week).
  active: boolean;
  candidates: {
    eventId: string;
    // "Event 2A"; never an identity.
    label: string;
    // The rolled event's name, or null before its table roll resolves.
    name: string | null;
    // Event's status wording, such as "Awaiting roll" or "Not chosen".
    status: string;
    chosen: boolean;
    // Recorded nested events under this candidate, used or not.
    nested: number;
  }[];
  // Event's wording for what the set still needs.
  issues: { code: string; message: string }[];
};
export type ActivitySlotStatus =
  | { kind: 'empty' }
  | { kind: 'ready' }
  | { kind: 'todo'; count: number };
export type ActivityAllowance = {
  occupied: number;
  // The allowance after every slot: what a newly added slot receives.
  actions: number;
  rank: number;
  rankActions: number | null;
  strategist: boolean;
  // Positions where the ordered fold changes the allowance (an officer
  // change adding or removing the Strategist's action).
  changes: { slotNumber: number; allowance: number }[];
  // Why extra empty slots cannot be removed right now, if they cannot.
  removalBlocked: 'upkeep' | 'unknown' | null;
};
export type ActivityView = {
  phase: 'activity';
  ready: boolean;
  occupiedSlots: number;
  allowance: ActivityAllowance;
  slots: (ActivityProjection['slots'][number] & {
    number: number;
    actionName: string | null;
    status: ActivitySlotStatus;
    // Every issue of the choice, requirements first.
    issues: ActivityIssue[];
    warningCount: number;
    removable: boolean;
    // The recorded team reference, its name, or null when it no longer
    // matches any team this Activity knows.
    team: { teamId: string; name: string | null } | null;
    check: ActivityCheck | null;
    modifiers: ActivityRecordedModifier[];
    bonusChoices: ActivityBonusChoice[];
    requirements: string[];
    warnings: string[];
    calculatedCostCopper: number | null;
    exceptions: { exceptionId: string; ruleId: string; reason: string }[];
    // Null while the rules preview is unavailable.
    position: ActivityPositionFacts | null;
  })[];
  teamRoster: ActivityTeamFact[];
  // Every candidate-owning choice's event candidates, by choice.
  candidateSets: ActivityCandidateSet[];
  // Campaign characters with the level the rules use; null when unknown.
  characters: { characterId: string; name: string; level: number | null }[];
  // Present while the operating settlement is Helpful.
  helpful: {
    settlementName: string;
    usedIn: { slotId: string; slotNumber: number }[];
  } | null;
  operating: {
    selected: string | null;
    // The recorded settlement is no longer one of the campaign's.
    missing: boolean;
    choices: { value: string; label: string; reputation: string | null }[];
  };
  // Actions an event currently blocks this Activity.
  blockedActions: StagedActionChoice['actionId'][];
  actions: { actionId: StagedActionChoice['actionId']; name: string }[];
  teams: { value: string; label: string; description: string }[];
  settlements: { value: string; label: string }[];
  people: { value: string; label: string }[];
  items: { value: string; label: string }[];
  caches: { value: string; label: string }[];
  events: { value: string; label: string }[];
  bonuses: { value: string; label: string }[];
  automaticSources: { value: string; label: string }[];
  modifierSources: { value: string; label: string }[];
  startDay: number;
  operatingSettlementId: string | null;
  checks: ActivityProjection['checks'];
  requirements: string[];
  warnings: string[];
};
export type EventOccurrenceFacts = {
  occurrence: WeeklyDraft['event']['occurrences'][number];
  // Display label such as "Event 2A.1"; never an identity.
  label: string;
  resolvedType: string | null;
  optionalMitigation: 'unavailable' | 'unattempted' | 'attempted';
  exceptionChoices: WeeklyDraft['rulesExceptions'];
  changes: EventOutcomeChange[];
  mode: EventDispatch['mode'] | null;
  selected: boolean;
  negated: boolean;
  requirements: string[];
  warnings: string[];
  owner: { slotId: string; choice: StagedActionChoice } | null;
  // The event-specific controls for this occurrence's family, or null while
  // the family still uses the general details editor.
  panel: EventPanel | null;
};
// One Event check row: the dice total field, the calculated bonus beside it
// and the result against the DC. Shared by every event check (target checks,
// mandatory saves, officer and Sabotage checks).
export type EventCheckFacts = {
  checkId: string;
  // Names the check and its target, e.g. "Security check for Wren Ashby".
  label: string;
  // "Security DC 20"; the dice are stated once, on the roll field.
  legend: string;
  spec: RollSpec;
  dc: number;
  mandatory: boolean;
  // Null until the rules can calculate the bonus.
  modifier: number | null;
  total: number | null;
  breakdown: { source: string; label: string; value: number }[];
  succeeded: boolean | null;
  // What the result means for this event, once the roll is in.
  resultText: string | null;
  required: boolean;
};
// A card for a team, settlement or person target.
export type EventTargetCard = {
  value: string;
  label: string;
  description: string;
};
// A recorded target the current choices do not include, kept until cleared.
export type EventRetainedTarget = {
  value: string;
  label: string;
  reason: string;
};
export type EventTargetChoice = {
  // "Team that falls sick"
  label: string;
  hint: string | null;
  required: boolean;
  selected: string | null;
  choices: EventTargetCard[];
  retained: EventRetainedTarget[];
};
export type EventWhatHappened = {
  subjectId: string;
  required: boolean;
  hint: string;
  acknowledgement: { acknowledgementId: string; outcome: string } | null;
};
export type EventRaidPerson = {
  characterId: string;
  name: string;
  // Attempt it / Let it happen for this person; `explicit` when the choice
  // is recorded on the person rather than read from the event or a roll.
  mitigation: 'attempted' | 'unattempted';
  explicit: boolean;
  check: EventCheckFacts;
  checkRoll: RawRoll | undefined;
  capture: {
    // The percentile roll decides only after a successful Security check.
    applies: boolean;
    chance: number | null;
    recorded: RawRoll | undefined;
    required: boolean;
  };
};
// A recorded occurrence input the resolved event does not use, kept until
// cleared on purpose. `field` names the occurrence field; for `targets` only
// the kinds the event does not use are listed and cleared.
export type EventRetainedField = {
  field:
    | 'targets'
    | 'averagePartyLevel'
    | 'mitigation'
    | 'rolls'
    | 'officerCheck'
    | 'targetChecks'
    | 'rewards'
    | 'persistent'
    | 'persistentDecision'
    | 'overseerCharacterId';
  label: string;
  value: string;
};
// High Morale's carried events that end here, oldest first.
export type EventEndingChoice = {
  // "Persistent event that ends"
  label: string;
  hint: string | null;
  required: boolean;
  // How many this occurrence ends: fewer than the rules name when fewer
  // carried events remain.
  count: number;
  // The recorded choice, or false while the rules end the oldest.
  chosen: boolean;
  selected: string[];
  choices: EventTargetCard[];
  retained: EventRetainedTarget[];
};
// Rivalry's two rival teams, chosen on cards. `selected` holds at most two
// known teams; any other recorded team stays until cleared.
export type EventTeamPairChoice = {
  // "Rival teams"
  label: string;
  hint: string | null;
  required: boolean;
  selected: string[];
  choices: EventTargetCard[];
  retained: EventRetainedTarget[];
};
// One officer's own skill check made during the Event: Rivalry Twice's
// optional Bluff, Diplomacy or Intimidate check that ends it, and Turncoat
// Twice's mandatory Diplomacy check against the defection. It is the
// character's skill check, so only the entered skill bonus and custom
// modifiers count.
export type EventOfficerCheckFacts = {
  // "Officer check" or "Diplomacy check"
  label: string;
  // "Bluff, Diplomacy or Intimidate DC 20"; the dice are stated once, on the roll field.
  legend: string;
  mandatory: boolean;
  dc: number;
  characterId: string | null;
  // Officers first, each labelled with their roles. A character the check
  // cannot use (not an officer for Rivalry) is not offered.
  characters: (EventTargetCard & { officer: boolean })[];
  // A recorded character the choices do not include, kept until replaced.
  retainedCharacter: EventRetainedTarget | null;
  skill: RivalrySkill | null;
  // The skill the rules name first; a Turncoat skill other than Diplomacy
  // needs a Rules Exception.
  expectedSkill: RivalrySkill | null;
  skillBonus: number | null;
  recorded: RawRoll | undefined;
  spec: RollSpec;
  // Skill bonus plus counted modifiers; null without a skill bonus.
  modifier: number | null;
  // The engine's recorded result; null until every input it needs is in.
  total: number | null;
  breakdown: { source: string; label: string; value: number }[];
  succeeded: boolean | null;
  resultText: string | null;
  // Why a complete entry has no result yet, or null.
  waiting: string | null;
  required: { character: boolean; skillBonus: boolean; roll: boolean };
  notes: string[];
};
// A same-week persistent decision recorded on the occurrence that became
// persistent: Persistent resolves it, Event keeps it with its occurrence.
export type EventSameWeekDecision = {
  // "Check · Loyalty check roll recorded", "Ending · <what happened>"
  value: string;
  // Whether this occurrence's event is persistent this week, so Persistent
  // reads the decision.
  used: boolean;
};
export type EventRecurringFamily =
  | 'rivalry'
  | 'turncoat'
  | 'theft'
  | 'double_agent'
  | 'low_morale';
export type EventOutcomeFamily =
  | 'all_is_calm'
  | 'calm_before_the_storm'
  | 'high_morale'
  | 'invasion'
  | 'night_ops'
  | 'war_games'
  | 'week_of_pain'
  | 'week_of_serenity';
export type EventResourceFamily =
  | 'broke_the_code'
  | 'cache_discovered'
  | 'festival'
  | 'market_day'
  | 'found_fire'
  | 'hidden_agenda';
// One cache Cache Discovered finds: its own Attempt it / Let it happen and
// Secrecy check, like a Raid's hidden person.
export type EventCacheTarget = {
  cacheId: string;
  // "Minor cache at Bridge"
  name: string;
  // "Hidden · Supplies, Rope"
  description: string;
  // Contents the campaign no longer records, by item identity.
  missingItems: string[];
  mitigation: 'attempted' | 'unattempted';
  // The choice is recorded on the cache, not read from the event or a roll.
  explicit: boolean;
  check: EventCheckFacts;
  checkRoll: RawRoll | undefined;
};
// A recorded Rules Exception, or the blank one a reward can take.
export type EventRewardException = {
  exceptionId: string;
  subjectId: string;
  ruleId: string;
  reason: string;
};
// One Found Fire reward: an item a player character receives.
export type EventReward = {
  itemId: string;
  characterId: string;
  // The recipient's name, or words for one no longer an active PC.
  recipient: string;
  name: string;
  valueCopper: number;
  weight: number;
  alchemical: boolean;
  poison: boolean;
  // "100 gp · 1 lb · alchemical"
  description: string;
  // A non-poison alchemical item worth 100 gp or less, as the rules allow.
  permitted: boolean;
  // Present when the reward is not permitted or an exception is recorded.
  exception: EventRewardException | null;
  exceptionRequired: boolean;
  // What else the rules ask of this reward, worded.
  issues: string[];
};
export type EventRewardFacts = {
  // Each active PC and the rewards recorded for them; the rules ask for
  // exactly one each.
  recipients: {
    characterId: string;
    name: string;
    required: boolean;
    // "Record one reward." / "Only one reward counts. Remove the others."
    issue: string | null;
    rewards: EventReward[];
  }[];
  // Rewards recorded for someone who is not an active PC.
  others: EventReward[];
  // The PCs a reward can go to, for the reward form.
  choices: { value: string; label: string }[];
};
// One Activity check Hidden Agenda recalculates.
export type EventActivityCheck = {
  slotId: string;
  // "Action Slot 2 · Recruit Team · Scouts"
  label: string;
  // "Loyalty check 19 vs DC 15 (Hidden Agenda +2): success"
  result: string;
  // The outcome turns on this bonus: without it the check fails.
  decided: boolean;
  // The choice's missing inputs, worded by Activity.
  issues: string[];
};
export type EventActivityRecalculation = {
  bonus: number;
  checks: EventActivityCheck[];
  // Activity is not ready: its outcome is not final yet.
  pending: boolean;
  cycle: boolean;
};
export type EventPanel =
  | {
      // Calm, morale, narrative and training events: their outcome lines,
      // with High Morale's endings and Invasion's party level as the only
      // inputs besides What happened.
      family: 'outcome';
      eventType: EventOutcomeFamily;
      endings: EventEndingChoice | null;
      partyLevel: {
        value: number | null;
        required: boolean;
        // The encounter's CR from the rules, once the level is in.
        challengeRating: number | null;
      } | null;
      // Rules facts beside the outcome: uneventful carry, Twice, independence.
      notes: string[];
      // Null for events that record no account of their own (and have none).
      whatHappened: EventWhatHappened | null;
      outcomes: string[];
      // Inputs are still missing, so the outcome lines are not final.
      partial: boolean;
      retained: EventRetainedField[];
    }
  | {
      family: 'team';
      eventType: 'missing_in_action' | 'sickness' | 'turn_around';
      // Null when the rules need no team (Turn Around recovering teams).
      team: EventTargetChoice | null;
      // Sickness Twice's mandatory Loyalty save; null otherwise.
      check: EventCheckFacts | null;
      checkRoll: RawRoll | undefined;
      // A recorded check roll the current event does not use.
      retainedCheck: boolean;
      whatHappened: EventWhatHappened;
      outcomes: string[];
    }
  | {
      // Officer-check and persistent-producing events: Rivalry, Turncoat,
      // Theft, Double Agent and Low Morale. Each part is null where the
      // event and its mode do not use it.
      family: 'recurring';
      eventType: EventRecurringFamily;
      // Rivalry's two teams, base and Twice.
      teams: EventTeamPairChoice | null;
      // Turncoat Twice's defecting team (GM choice).
      team: EventTargetChoice | null;
      // Turncoat's raw 1d6 training loss; the rank is added by the rules.
      lossRoll: {
        label: string;
        legend: string;
        spec: RollSpec;
        recorded: RawRoll | undefined;
        required: boolean;
      } | null;
      // Attempt it / Let it happen: Theft's Loyalty check and Rivalry Twice's
      // officer check. `explicit` when the choice is recorded rather than
      // read from a roll or the default.
      mitigation: {
        value: 'attempted' | 'unattempted';
        explicit: boolean;
        attemptDescription: string;
        letDescription: string;
      } | null;
      // Theft's optional Loyalty check (base mode only).
      check: EventCheckFacts | null;
      checkRoll: RawRoll | undefined;
      // A Theft check roll kept while Let it happen applies.
      unusedCheckRoll: boolean;
      officer: EventOfficerCheckFacts | null;
      sameWeek: EventSameWeekDecision | null;
      notes: string[];
      whatHappened: EventWhatHappened | null;
      outcomes: string[];
      partial: boolean;
      retained: EventRetainedField[];
      // What clearing retained targets or rolls keeps: the target kinds and
      // named rolls this event reads.
      keep: {
        targets: NonNullable<
          WeeklyDraft['event']['occurrences'][number]['targets']
        >[number]['kind'][];
        rolls: string[];
      };
    }
  | {
      // Item, cache, settlement, reward and Activity-recalculation events:
      // Broke the Code, Cache Discovered, Festival, Market Day, Found Fire
      // and Hidden Agenda. Each part is null where the event and its mode do
      // not use it.
      family: 'resource';
      eventType: EventResourceFamily;
      // Broke the Code's identified item.
      item: EventTargetChoice | null;
      // Festival's and Market Day's town.
      settlement: EventTargetChoice | null;
      // Market Day Twice: every operated town the discount reaches.
      towns: EventTargetCard[] | null;
      // Cache Discovered's cache (base mode), then each cache found.
      cache: EventTargetChoice | null;
      caches: EventCacheTarget[];
      // Recorded per-cache checks for caches this event does not find.
      retainedCacheChecks: (EventRetainedTarget & { index: number })[];
      rewards: EventRewardFacts | null;
      activity: EventActivityRecalculation | null;
      notes: string[];
      whatHappened: EventWhatHappened | null;
      outcomes: string[];
      partial: boolean;
      retained: EventRetainedField[];
      keep: {
        targets: NonNullable<
          WeeklyDraft['event']['occurrences'][number]['targets']
        >[number]['kind'][];
        rolls: string[];
      };
    }
  | {
      family: 'raid';
      settlement: EventTargetChoice;
      people: EventRaidPerson[];
      // Recorded per-person entries for people not hidden in that refuge.
      retainedPeople: (EventRetainedTarget & { index: number })[];
      // Recorded inputs Raid does not use, such as an event-level
      // mitigation left by a table roll that named another event.
      retained: EventRetainedField[];
      keep: {
        targets: NonNullable<
          WeeklyDraft['event']['occurrences'][number]['targets']
        >[number]['kind'][];
        rolls: string[];
      };
      noPeople: string | null;
      whatHappened: EventWhatHappened;
      outcomes: string[];
    };
// What an event block says about its occurrence this week. Every status has
// its own words; colour never carries the distinction alone.
export type EventBlockStatus =
  | 'preparing'
  | 'awaiting_roll'
  | 'happens'
  | 'twice'
  | 'no_additional_effect'
  | 'two_more'
  | 'reroll'
  | 'cannot_occur'
  | 'kept'
  | 'sabotaged'
  | 'candidate'
  | 'not_chosen'
  | 'not_used'
  | 'needs_repair';
export type EventIssue = { code: string; message: string };
// An event's corpus rules for one block; `twice` only when it applies there.
export type EventBlockRules = {
  name: string;
  text: string[];
  twice: string | null;
};
// What a block's status, rules and issues read from its occurrence facts.
export type EventTraceFacts = Pick<
  EventOccurrenceFacts,
  | 'label'
  | 'resolvedType'
  | 'mode'
  | 'selected'
  | 'negated'
  | 'requirements'
  | 'warnings'
>;
// `Item` is the full occurrence facts, except for readers (Activity's
// candidate summary) that need only the traced status.
export type EventBlock<Item extends EventTraceFacts = EventOccurrenceFacts> = {
  eventId: string;
  label: string;
  item: Item;
  // False until the occurrence exists in the accepted draft: its inputs wait.
  saved: boolean;
  status: EventBlockStatus;
  statusLabel: string;
  statusText: string;
  origin: string;
  table: {
    raw: number | null;
    // Recorded extra table modifiers, with why the rules ignore one if they do.
    modifiers: EventTableArithmetic['modifiers'];
    total: number | null;
    name: string | null;
  };
  // The corpus rules for the rolled event; null until the table roll is
  // complete. `twice` is set only when its Twice clause applies here.
  rules: EventBlockRules | null;
  candidate: { slotId: string; choiceId: string; chosen: boolean } | null;
  // Active nested events (Roll Twice children, a replacement) in order.
  children: EventBlock<Item>[];
  // Recorded children the current roll does not use; restored if it returns.
  hidden: EventBlock<Item>[];
  // A position the rules do not ask for: clearing its last input removes it.
  surplus: boolean;
  // The existing tree/candidate edit removing this surplus position once its
  // table roll is cleared; null when clearing must keep the position.
  removal: WeeklyDraftEdit | null;
  issues: EventIssue[];
};
export type EventChanceStep = {
  applies: 'roll' | 'guaranteed' | 'forced_calm';
  effect: string;
  explanation: string | null;
  breakdown: { label: string; value: number }[];
  required: boolean;
  raw: number | null;
  total: number | null;
  result: 'event' | 'quiet' | null;
  operating: {
    name: string;
    reputation: string | null;
    // Null while the operating settlement's reputation is unknown.
    modifier: number | null;
  } | null;
  sources: { choiceId: string; label: string }[];
  issues: EventIssue[];
};
export type EventCandidateSet = {
  slotId: string;
  choiceId: string;
  label: string;
  // False when the choice guarantees nothing this week (for example a calm week).
  active: boolean;
  selectedEventId: string | null;
  blocks: EventBlock[];
  issues: EventIssue[];
};
export type EventView = {
  phase: 'event';
  ready: boolean;
  chance: number;
  chanceRoll: WeeklyDraft['event']['chanceRoll'] | null;
  chanceModifier: number | null;
  guaranteed: boolean;
  chanceStep: EventChanceStep;
  automatic: {
    // "Calm before the Storm" from `week`, bringing `count` events now.
    sources: { sourceId: string; label: string; week: number; count: number }[];
    blocks: EventBlock[];
    issues: EventIssue[];
  } | null;
  rolled: {
    applies: boolean;
    effect: string;
    reason: string | null;
    blocks: EventBlock[];
    issues: EventIssue[];
  };
  candidates: EventCandidateSet[];
  // Recorded top-level events the rules do not use this week.
  inactive: EventBlock[];
  outcome: { complete: boolean; lines: string[] };
  preparation: 'idle' | 'preparing' | 'failed';
  occurrences: EventOccurrenceFacts[];
  // Event-identified wording for every Event requirement and warning code.
  messages: Record<string, string>;
  acknowledgements: WeeklyDraft['acknowledgements'];
  exceptions: WeeklyDraft['rulesExceptions'];
  checks: ActivityView['checks'];
  options: Record<string, { value: string; label: string }[]>;
  // Sabotage per occurrence, by event identity, and the week's one Overseer
  // support shared with Persistent. Hand-built test views may omit them.
  sabotage?: Record<string, EventSabotageFacts>;
  overseer?: OverseerSupportFacts;
  requirements: string[];
  warnings: string[];
};
// A phase and, where it can be named, the DOM id of the item within it.
export type SourceLink = { phase: Phase; anchor: string | null };
/**
 * One of this device's held local forms: the Required decision's message,
 * the phase showing the form when not Review & confirm, and what the form
 * was typed against (a Persistent ending's saved decision).
 */
export type LocalFormRegistration = {
  message: string;
  phase?: Phase;
  basis?: string;
};
// Where an Activity or Event result that ended a carried event is edited.
export type PersistentSourceLink = SourceLink & {
  phase: 'activity' | 'event';
};
export type PersistentView = {
  phase: 'persistent';
  ready: boolean;
  firstBuyoff: boolean;
  // "First buyoff available now", "Buyoff available now" or the week the
  // four-week wait ends, from the week-start facts.
  buyoffAvailability: string;
  // Includes buyoffs staged this week; null only without a preview.
  nextBuyoffWeek: number | null;
  // Null while earlier phases leave the rank open: never a guessed cost.
  buyoffCostCopper: number | null;
  // Earlier phases whose open requirements hold Persistent back.
  earlierPhases: Phase[];
  options: EventView['options'];
  overseer?: OverseerSupportFacts;
  events: (WeeklyDraft['context']['carriedEvents'][number] & {
    name: string;
    // The event type's display name, e.g. "Low Morale".
    typeLabel: string;
    ageWeeks: number;
    // The recorded within-week order, e.g. "2nd that week".
    orderLabel: string;
    targetNames: string[];
    decision: WeeklyDraft['persistent']['decisions'][number] | null;
    ended: boolean;
    // Set when a resolved Activity or Event result ended this event: the
    // section then offers no Persistent decision of its own.
    endedBy: { label: string; link: PersistentSourceLink } | null;
    result: { tone: 'ends' | 'stays' | 'attention'; text: string };
    leaveNote: string;
    // Theft's Loyalty check or Rivalry's officer check; null otherwise.
    check: { label: string; note: string } | null;
    changes: PersistentChange[];
    checks: ActivityView['checks'];
    // The saved check's own inputs and result, when the decision is a
    // Theft or Rivalry check; null otherwise.
    theftCheck: PersistentTheftCheck | null;
    rivalryCheck: PersistentRivalryCheck | null;
    // Recorded check fields this event's check does not use.
    retained: PersistentRetained[];
    exceptions: WeeklyDraft['rulesExceptions'];
    requirements: string[];
    warnings: string[];
  })[];
  requirements: string[];
  warnings: string[];
};
// One modifier recorded on a Persistent check roll, by list position.
export type PersistentRecordedModifier = {
  index: number;
  sourceId: string;
  value: number;
  reason: string;
  // A one-use bonus by its source name; otherwise the entered reason.
  label: string;
  // Custom and other entered modifiers can be edited; a bonus only removed.
  kind: 'custom' | 'bonus' | 'other';
  // Why the rules add nothing for this entry, or null when it counts.
  note: string | null;
};
// A one-use rules bonus this check can still take.
export type PersistentBonusChoice = {
  sourceId: string;
  label: string;
  value: number;
};
// Theft's Loyalty check for this week's temporary mitigation.
export type PersistentTheftCheck = {
  row: EventCheckFacts;
  recorded: RawRoll | undefined;
  modifiers: PersistentRecordedModifier[];
  bonusChoices: PersistentBonusChoice[];
};
export type RivalrySkill = NonNullable<
  Extract<
    WeeklyDraft['persistent']['decisions'][number],
    { kind: 'mitigate' }
  >['officerCheck']
>['skill'];
// Rivalry's officer check: one character's skill check against DC 20.
export type PersistentRivalryCheck = {
  characterId: string | null;
  // Every militia character, labelled with their officer roles ("Aubrin ·
  // Ambassador", "Pell · not an officer"); a recorded character no longer
  // in the militia is listed as unavailable.
  characters: {
    value: string;
    label: string;
    officer: boolean;
    available: boolean;
  }[];
  skill: RivalrySkill | null;
  // Null when blank, which leaves the check incomplete; zero is valid.
  skillBonus: number | null;
  recorded: RawRoll | undefined;
  spec: RollSpec;
  // Skill bonus plus counted modifiers; null without a skill bonus.
  modifier: number | null;
  total: number | null;
  breakdown: { source: string; label: string; value: number }[];
  succeeded: boolean | null;
  resultText: string | null;
  required: { character: boolean; skillBonus: boolean; roll: boolean };
  // The chosen character is no longer in the militia.
  unavailable: boolean;
  // The chosen character holds no officer role: the check needs the
  // officer-assignment Rules Exception.
  notOfficer: boolean;
  modifiers: PersistentRecordedModifier[];
};
// Check fields recorded that this check does not use.
export type PersistentRetainedField =
  | 'officerCheck'
  | 'rolls'
  | 'overseerCharacterId';
// One retained field as shown: its name and recorded value in words.
export type PersistentRetained = {
  field: PersistentRetainedField;
  label: string;
  value: string;
};
export type PhaseView =
  | UpkeepView
  | ActivityView
  | EventView
  | PersistentView
  | {
      phase: 'summary';
      effects: Omit<CanonicalResolutionEffects, 'adjudication'> | null;
      adjustments: WeeklyDraft['tableAdjustments'];
      exceptions: (WeeklyDraft['rulesExceptions'][number] & { name: string })[];
      acknowledgements: (WeeklyDraft['acknowledgements'][number] & {
        name: string;
      })[];
      people: { characterId: string; name: string }[];
      options: EventView['options'];
      // Event-identified wording for Event codes (see EventView['messages']).
      eventMessages?: Record<string, string>;
      ready: boolean;
      baseline: CanonicalWeekState | null;
      outcome: CanonicalWeekState | null;
      requirements: string[];
      warnings: string[];
      /** Where each requirement or warning code comes from, when known. */
      sources?: Record<string, SourceLink>;
      /** The six-section presentation facts from the live adapter. */
      review: WeekReviewFacts;
    };
export type PhaseReadiness = {
  phase: Phase;
  available: boolean;
  // Upkeep in the militia's first week: nothing applies or is required.
  skipped?: boolean;
  ready: boolean;
  requirements: { id: string; message: string }[];
  warnings: { id: string; message: string }[];
};
export type WeeklyDraftWorkspace =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready';
      setupNotes?: string;
      week: number;
      phaseView: PhaseView;
      phases: PhaseReadiness[];
      referenceFacts: ReferenceFacts;
      navigation: { previous: Phase | null; next: Phase | null };
      confirmationDisabledReason: string | null;
      feedback: 'idle' | 'pending' | 'saved' | 'failed' | 'confirming';
      editingDisabled: boolean;
      remoteChange: { sequence: number; phases: readonly Phase[] } | null;
      confirmedWeek: { transitionId: string; week: number } | null;
      dismissConfirmedWeek(this: void): void;
      failureReason: string | null;
      canConfirm: boolean;
      reviewRequired: boolean;
      forecastPending: boolean;
      pendingWork: boolean;
      /**
       * This device's open or locally invalid Summary forms, each also a
       * local Required decision; while any is open, Confirm is disabled here.
       */
      localForms: ({ id: string } & LocalFormRegistration)[];
      edit(this: void, edit: WeeklyDraftEdit): Promise<'accepted' | 'failed'>;
      viewPhase(this: void, phase: Phase): void;
      /** Review updated week: the explicit review after a rejected request. */
      reviewUpdatedWeek(this: void): void;
      confirm(this: void): Promise<'accepted' | 'failed'>;
      // Preparing the Event positions the rules ask for, shared by every phase.
      eventPreparation?: {
        status: 'idle' | 'preparing' | 'failed';
        retry(this: void): void;
      };
    };
