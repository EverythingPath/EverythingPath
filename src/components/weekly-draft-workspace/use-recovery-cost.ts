'use client';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { copperToGpInput, parseGpInput } from '~/lib/gp-money';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepDisabledTeam } from './types';
import { recoverTeam } from './upkeep-edits';

type Field = 'cost' | 'reason';
type Values = Record<Field, string>;

function recoverySchema(rulesCostCopper: number) {
  return z
    .object({
      cost: z.string().transform((text, context) => {
        const parsed = parseGpInput(text);
        if (parsed.kind === 'valid') return parsed.copper;
        context.addIssue({
          code: 'custom',
          message:
            parsed.kind === 'empty'
              ? 'A recovery cost is required.'
              : parsed.message,
        });
        return z.NEVER;
      }),
      reason: z.string().trim(),
    })
    .refine(
      (values) => values.cost === rulesCostCopper || values.reason.length > 0,
      {
        path: ['reason'],
        message: 'A reason is required for a changed recovery cost.',
      },
    );
}

// Whether valid local values are what the shared decision already records.
function representsShared(
  values: { cost: number; reason: string },
  shared: { rules: number; entered: number; reason: string | null },
) {
  if (values.cost !== shared.entered) return false;
  return values.cost === shared.rules
    ? shared.reason === null
    : values.reason === shared.reason;
}

// A disabled team's recovery price, entered in gp. Every valid cost/reason
// saves at once through the atomic `upkeep_team` edit (the rules cost stays
// the decision's cost; a different price is the reasoned post-baseline
// adjustment). Invalid input stays local with field errors and never replaces
// the last shared decision. A newer shared price or a rejected save replaces
// a valid local entry that no longer represents it.
export function useRecoveryCost(
  team: UpkeepDisabledTeam,
  edit: (edit: WeeklyDraftEdit) => unknown,
) {
  const rules = team.rulesCostCopper;
  const schema = useMemo(() => recoverySchema(rules), [rules]);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    defaultValues: {
      cost: copperToGpInput(team.enteredCostCopper),
      reason: team.adjustment?.reason ?? '',
    },
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const shared = useMemo(
    () => ({
      rules,
      entered: team.enteredCostCopper,
      reason: team.adjustment?.reason ?? null,
    }),
    [rules, team.enteredCostCopper, team.adjustment?.reason],
  );
  useEffect(() => {
    // Synchronizes the form store with accepted shared data.
    const local = schema.safeParse(form.getValues());
    if (local.success && !representsShared(local.data, shared))
      form.reset({
        cost: copperToGpInput(shared.entered),
        reason: shared.reason ?? '',
      });
  }, [form, schema, shared]);

  function save(copper: number, reason: string) {
    edit(recoverTeam(team, { copper, reason }));
  }

  const cost = parseGpInput(form.watch('cost'));
  return {
    form,
    // The price differs from the rules cost (or cannot be read), so the
    // reason and resulting Table Adjustment apply.
    changed: cost.kind !== 'valid' || cost.copper !== rules,
    pendingDeltaCopper: cost.kind === 'valid' ? rules - cost.copper : null,
    change(field: Field, text: string) {
      form.setValue(field, text, { shouldDirty: true });
      void form.trigger();
      const parsed = schema.safeParse(form.getValues());
      if (parsed.success && !representsShared(parsed.data, shared))
        save(parsed.data.cost, parsed.data.reason);
    },
    applyRulesCost() {
      save(rules, '');
      form.reset({ cost: copperToGpInput(rules), reason: '' });
    },
  };
}
