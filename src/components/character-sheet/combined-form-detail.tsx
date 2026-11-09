'use client';
import { CombinedFormEvolutions } from './combined-form-evolutions';
import { CombinedFormFact } from './combined-form-fact';
import { CombinedFormRules } from './combined-form-rules';
import { CombinedFormSkills } from './combined-form-skills';
import { CombinedFormStatistic } from './combined-form-statistic';
import {
  CompanionComponentTable,
  type ComponentTableRow,
} from './companion-component-table';
import type { CompanionsController } from './companion-props';
import {
  fieldLabel,
  isUnresolvedValue,
  noteText,
  unresolvedValue,
} from './sheet-parts';

type CombinedFormView = NonNullable<
  CompanionsController['combinedForm']['view']
>;

function abilityRows(view: CombinedFormView): ComponentTableRow[] {
  return view.abilities.map((row) => ({
    key: row.key,
    label: row.label,
    notes: row.excluded,
    cells: [
      {
        column: 'Score',
        value: row.score,
        isMuted: isUnresolvedValue(row.score),
      },
      {
        column: 'Modifier',
        value: row.modifier ?? unresolvedValue,
        isMuted: row.modifier === null,
      },
      { column: 'From', value: row.source },
    ],
  }));
}

/**
 * The whole Combined Form behind its disclosure: the abilities with their
 * builds, every statistic with its breakdown, the skills, the evolutions,
 * the linked values with any saved fallback, the features and the rules.
 */
export function CombinedFormDetail({ view }: { view: CombinedFormView }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h4 className={fieldLabel}>Abilities</h4>
        <CompanionComponentTable
          label="Abilities"
          rowHeading="Ability"
          columns={['Score', 'Modifier', 'From']}
          rows={abilityRows(view)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <h4 className={fieldLabel}>Statistics</h4>
        <ul
          aria-label="Statistics"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        >
          {view.statistics.map((statistic) => (
            <CombinedFormStatistic key={statistic.key} statistic={statistic} />
          ))}
        </ul>
      </div>
      <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
        <CombinedFormSkills skills={view.skills} />
        <div className="flex min-w-0 flex-col gap-3">
          <CombinedFormEvolutions evolutions={view.evolutions} />
          {view.inputs.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h4 className={fieldLabel}>Linked values</h4>
              <dl
                aria-label="Linked values"
                className="grid grid-cols-2 gap-x-4 gap-y-2"
              >
                {view.inputs.map((input) => (
                  <CombinedFormFact
                    key={input.label}
                    label={input.label}
                    value={input.value}
                  >
                    {input.note ? (
                      <span className="text-xs [overflow-wrap:anywhere] text-sky-300">
                        {input.note}
                      </span>
                    ) : null}
                  </CombinedFormFact>
                ))}
              </dl>
            </div>
          ) : null}
          {view.features.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h4 className={fieldLabel}>Features</h4>
              <ul aria-label="Features" className="flex flex-col gap-1">
                {view.features.map((feature) => (
                  <li
                    key={feature.name}
                    aria-label={feature.name}
                    className="flex flex-col"
                  >
                    <span className="text-sm">{feature.name}</span>
                    <span className={noteText}>{feature.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <CombinedFormRules sources={view.sources} />
    </>
  );
}
