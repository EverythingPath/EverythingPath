/**
 * stats-d1 fix r2: a rule-value record's status in an import, and what a
 * release scope makes of it. Its own module, so the scopes read it without
 * the curation applier's dependencies.
 */

/**
 * A rule-value record's status in an import (stats-d1 fix r1), in record
 * order: applied; drafted, so applying nothing; omitted, its entry left out
 * by the scope being built (`reason` says how); not established (fix r2), a
 * checked record whose entry inputs not verified as the whole pinned corpus
 * lack, which may be a partial tree, so neither the entry's existence nor a
 * scope's exclusion of it is shown, and no release scope with it qualifies
 * (`ruleValueScopeFindings`), so production activation refuses the artifact;
 * or refused, a record that cannot apply, which fails admission and so the
 * preview and the release build (`collectInventoryFailures`).
 */
export type RuleValueStatus =
  | { externalKey: string; status: 'applied' | 'drafted' }
  | {
      externalKey: string;
      status: 'omitted' | 'not-established' | 'refused';
      reason: string;
    };

/**
 * Why the import has no entry a rule-value record names, when it can say:
 * `omitted`, the scope being built leaves the entry out; `not-established`,
 * unverified inputs lack it (stats-d1 fix r2).
 */
export type RuleValueAbsence = {
  status: 'omitted' | 'not-established';
  reason: string;
};

/**
 * stats-d1 fix r2: a release scope's findings for its build's rule-value
 * statuses: one per record whose entry is not established, so the scope
 * cannot qualify: production activation, and a fixture one beside ordinary
 * data, refuse the artifact. The release's own record of such records (fix
 * r3) refuses every activation but a fixture one on fixture-isolated data.
 */
export function ruleValueScopeFindings(
  statuses: readonly RuleValueStatus[] = [],
) {
  return statuses
    .filter(({ status }) => status === 'not-established')
    .map(({ externalKey }) => ({
      code: 'rule-value-not-established',
      key: externalKey,
      reason: `The checked rule-value record for ${externalKey} names no entry of these inputs, which are not verified as the whole pinned corpus, so whether the entry exists is not established; only a build from verified inputs can qualify.`,
    }));
}
