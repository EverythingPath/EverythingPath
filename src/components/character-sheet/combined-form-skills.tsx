'use client';
import { cn } from '~/lib/utils';
import type { CompanionsController } from './companion-props';
import { chip, fieldLabel, isUnresolvedValue, noteText } from './sheet-parts';

type CombinedFormView = NonNullable<
  CompanionsController['combinedForm']['view']
>;

/**
 * The fused skill totals, each named by its skill, with the eidolon's
 * Skilled bonus as a chip where the total includes it.
 */
export function CombinedFormSkills({
  skills,
}: {
  skills: CombinedFormView['skills'];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h4 className={fieldLabel}>Skills</h4>
      {skills.length > 0 ? (
        <ul
          aria-label="Skills"
          className="divide-foreground/10 flex flex-col divide-y text-sm"
        >
          {skills.map((skill) => (
            <li
              key={skill.key}
              aria-label={skill.label}
              className="flex items-baseline gap-2 py-1"
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {skill.label}
              </span>
              {skill.note ? <span className={chip}>{skill.note}</span> : null}
              <span
                className={cn(
                  'font-mono tabular-nums',
                  isUnresolvedValue(skill.value) &&
                    'text-muted-foreground text-xs',
                )}
              >
                {skill.value}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={noteText}>None.</p>
      )}
    </div>
  );
}
