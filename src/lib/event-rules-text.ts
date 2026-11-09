import type { EventType } from './militia-domain';

/**
 * One event's rules as the corpus states them: its bullets in order, and its
 * `Twice:` clause (without the label) when the event has one.
 */
export type EventRulesText = { text: string[]; twice: string | null };

// Verbatim from the `## Event:` sections of
// docs/ai/ironfang-militia/militia-rules.md, plus two sentences that file
// omits, taken word for word from militia-verbatim.md: Roll Twice's
// second-roll rule and Cache Discovered's no-cache Twice case.
// `event-rules-text.test.ts` fails when the catalogue or either source
// drifts. Inline code marks are the corpus's own.
export const EVENT_RULES_TEXT: Record<EventType, EventRulesText> = {
  all_is_calm: {
    text: ['No event this week.'],
    twice:
      'next week skip event-chance roll and apply this outcome directly; this does not build the uneventful bonus chain.',
  },
  broke_the_code: {
    text: [
      'Identify one magic item of any caster level.',
      'PCs gain +2 Knowledge (local) for week.',
    ],
    twice: 'bonus becomes +5.',
  },
  cache_discovered: {
    text: [
      'Lose one hidden/planned cache and contents.',
      'Mitigate: Secrecy check DC `10 + rank` to retrieve.',
    ],
    twice:
      'all caches discovered. If the militia hasn’t hidden or can’t retrieve any caches, this has no effect.',
  },
  calm_before_the_storm: {
    text: [
      'No event now.',
      'Next week: roll event table and apply that event automatically (ignore Roll Twice result), then continue with normal Event phase roll.',
      'This week does not count as uneventful for rank bonus purposes.',
    ],
    twice:
      'next week roll two automatic events (ignore all Roll Twice), then run Event phase normally.',
  },
  double_agent: {
    text: [
      'Cannot use Secure Cache next Activity phase.',
      'Secrecy checks suffer -2 penalty.',
    ],
    twice: 'becomes persistent.',
  },
  festival: {
    text: [
      'Choose recently used town.',
      'PCs gain +2 morale to Bluff/Diplomacy/Intimidate there for week.',
    ],
    twice: 'bonus becomes +5.',
  },
  found_fire: {
    text: [
      'Each PC gets one non-poison alchemical item worth <=100 gp.',
      'Security checks gain +2 for upcoming week.',
    ],
    twice: 'choose one additional <=100 gp item.',
  },
  hidden_agenda: {
    text: ['Militia gains +2 on all Activity phase checks this week.'],
    twice: 'bonus becomes +5.',
  },
  high_morale: {
    text: [
      'End one current persistent event immediately.',
      'Loyalty checks gain +2 for upcoming week.',
    ],
    twice: 'end two persistent events and bonus becomes +5.',
  },
  invasion: {
    text: ['GM presents random combat encounter at CR `APL + 1`.'],
    twice: null,
  },
  low_morale: {
    text: ['Loyalty checks suffer -2.'],
    twice: 'becomes persistent.',
  },
  market_day: {
    text: [
      'One operated town (PC choice): all items/services gain extra 5% discount.',
    ],
    twice:
      'applies to all operated marketplaces, including Broker Market marketplaces.',
  },
  missing_in_action: {
    text: ['One random team that operated this week is unavailable next week.'],
    twice: 'team returns end of following week, but disabled.',
  },
  night_ops: {
    text: ['PCs gain +2 circumstance bonus to Stealth after dark for week.'],
    twice: 'bonus becomes +5.',
  },
  raid: {
    text: [
      'In random settlement with active refuge(s), all refuges deactivate.',
      'Hidden persons may be captured and can be recovered next week via Rescue Character (DC `5 + rank`).',
      'Mitigate: DC 20 Security per person to reduce capture chance by 50%.',
    ],
    twice: null,
  },
  rivalry: {
    text: ['Two random teams cannot act next Activity phase.'],
    twice:
      'persistent until officer succeeds at DC 20 Bluff, Diplomacy, or Intimidate.',
  },
  roll_twice: {
    text: [
      'Roll and resolve two events.',
      'Roll Twice can only take effect once per Event phase.',
      'Additional Roll Twice results in same phase are rerolled.',
      'If the same event is rolled twice and it has a Twice subsection, only the bonuses and penalties mentioned in the Twice subsection are resolved for the second roll.',
    ],
    twice: null,
  },
  sickness: {
    text: ['One random team becomes disabled.'],
    twice: 'team is lost unless militia succeeds on DC 20 Loyalty.',
  },
  theft: {
    text: [
      'Militia treasury is halved.',
      'Mitigate: DC 20 Loyalty reduces loss to 10% instead.',
    ],
    twice:
      'becomes persistent and militia loses half of all incoming treasury gains until successful Reduce Danger action.',
  },
  turn_around: {
    text: [
      'All disabled teams recover.',
      'If none disabled, one team gains +2 on one check next Activity phase.',
    ],
    twice: null,
  },
  turncoat: {
    text: ['Training decreases by `1d6 + rank`.'],
    twice:
      'one full team defects (GM choice) unless officer succeeds at Diplomacy DC `10 + rank`; even on success team is unavailable next Activity phase.',
  },
  war_games: {
    text: ['Training increases by rank.'],
    twice: null,
  },
  week_of_pain: {
    text: [
      'Next week: -1 penalty to all organization checks.',
      'Next Upkeep training loss is doubled.',
    ],
    twice: 'no additional effect.',
  },
  week_of_serenity: {
    text: [
      'Next week: +5 bonus to all organization checks.',
      'Next Activity training gain is doubled.',
    ],
    twice: 'no additional effect.',
  },
};
