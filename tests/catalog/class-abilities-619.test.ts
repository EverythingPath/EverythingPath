// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  formulaAt,
  LEVELS,
  recordModifiers,
  scheduleValues,
  WAVE_E_REVIEWED_ON,
} from './class-abilities-596';

// #619, MVP launch subset (#619 wave E, contextNotes): Studied Target,
// admitted with its four increments. Its 15 Foundry notes have checked
// note records; its description record adds Sense Motive, which the body
// names and the notes leave out.
const studied = describeIncrementParent({
  batch: 619,
  key: 'pf1/JnXrphJlr1ULx1MK',
  name: 'Studied Target',
  books: ['PZO1129'],
  classes: ['pf1/cOY76lMUkupH534m'],
  prdExact: false,
  reviewedOn: WAVE_E_REVIEWED_ON,
  noteRecords: 15,
});

const FORMULA = 'floor(@classLevel.slayer / 5) + 1';
const SITUATION = { local: 'against studied target' };
const TARGETS = [
  'skill.blf',
  'skill.kar',
  'skill.kdu',
  'skill.ken',
  'skill.kge',
  'skill.khi',
  'skill.klo',
  'skill.kna',
  'skill.kno',
  'skill.kpl',
  'skill.kre',
  'skill.per',
  'skill.sur',
  'attack.melee',
  'damage.melee',
  'attack.ranged',
  'damage.ranged',
  'skill.sen',
];

it('applies +1, and +1 more at 5th, 10th, 15th and 20th, on its skills and weapon attack and damage against the studied target', () => {
  const modifiers = TARGETS.map((target) => ({
    target,
    bonusType: 'untyped',
    value: { formula: FORMULA },
    condition: { situation: SITUATION },
  }));
  expect(recordModifiers(studied.candidate)).toEqual(modifiers);
  expectIncrementParentFacts({ ...studied, notes: 'none', modifiers });
  expect(LEVELS.map((slayer) => formulaAt(FORMULA, { slayer }))).toEqual(
    scheduleValues(studied.candidate),
  );
  expect(scheduleValues(studied.candidate)).toEqual(
    LEVELS.map((level) => 1 + Math.floor(level / 5)),
  );
});

it('adds Sense Motive from the body, which names it, and requires Pathfinder Unchained for its action metadata', () => {
  const { candidate } = studied;
  expect(candidate.mechanicsReview.descriptionText).toContain(
    'Bluff, Knowledge, Perception, Sense Motive, and Survival checks',
  );
  const notes = candidate.sourceFields.contextNotes as { target: string }[];
  expect(notes.map((note) => note.target)).not.toContain('skill.sen');
  expect(candidate.mechanicsReview.curationRecords[0]?.outputs).toEqual([
    {
      kind: 'modifier',
      target: 'skill.sen',
      bonusType: 'untyped',
      value: { formula: FORMULA },
      condition: { situation: SITUATION },
    },
  ]);
  expect(candidate.requiredNotices).toEqual(['PZO1129', 'PZO1131']);
  expect(candidate.sourceFields.actions).toEqual([
    expect.objectContaining({
      activation: { type: 'move', unchained: { type: 'action' } },
    }),
  ]);
});
