"""Deterministic gate inputs from one gate spec (script operator, root decision 2026-11-05).

The spec is the JSON that `$EP_ORCH/scripts/brief.py ITEM gate` writes and `make-gate-brief.py` reads
(R/ITEM-gate-spec-rN.json). Everything `gate.json` needs comes from the spec, the files it names and
the driver's own identity; nothing comes from prose. Spec paths are absolute or start with `R/` (the
spec's own directory) or `EP_ORCH/`. operations.md "Script gate operator" is the contract.
"""
import json
from pathlib import Path
import re

from gate_core import SCRIPT_OPERATOR, git, prep_receipt_path, require, script_operator_task_id, task_options
from workflow_evidence import reference

FEATURE = 'feature/pf1-character-builder'
PHASES = ['prepare', 'submit', 'observe', 'collect', 'complete', 'checked-land']
TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
# Root's run-wide adoption record, preserved by every gate since 2026-10-28.
ADOPTION = 'workflow-adoption-r1.json'
REQUIRED = ('title', 'kind', 'base', 'basetree', 'reviewed', 'tree', 'wt', 'branch', 'label', 'archive',
            'inputs_dir', 'evidence_dir', 'result', 'done_marker', 'acceptance', 'author_terminal', 'reviews')
OPTIONAL = ('issue', 'message', 'message_body', 'message_file', 'message_sha256', 'prepared', 'browser',
            'worked_example', 'notes', 'rebase_proof', 'carried_review', 'conditional_land', 'remote', 'lane', 'feature', 'preserve')
SHA = re.compile('[0-9a-f]{40}')
PREPARED_KEYS = {'candidate', 'mapping', 'mapping_sha256'}
# A retry keeps everything the prior spec bound except its attempt's own names.
ATTEMPT_KEYS = ('label', 'inputs_dir', 'evidence_dir', 'result', 'done_marker', 'prepared')
RETRY_SPEC = re.compile(r'(?P<item>[a-z0-9][a-z0-9-]*)-gate-spec-r(?P<round>[1-9][0-9]*)\.json')


def resolve(path, r, orch):
    """A spec path as an absolute path: `R/x` is the spec's directory, `EP_ORCH/x` the shared root."""
    require(isinstance(path, str) and path, 'Spec path must be a non-empty string')
    if path.startswith('R/'):
        return str(Path(r) / path[2:])
    if path.startswith('EP_ORCH/'):
        return str(Path(orch) / path[len('EP_ORCH/'):])
    require(path.startswith('/'), 'Spec path must be absolute or start with R/ or EP_ORCH/: ' + path)
    return path


def full_sha(value, name):
    require(isinstance(value, str) and SHA.fullmatch(value), 'Full Git identity required: ' + name)
    return value


def load_spec(spec_path, orch):
    """The validated spec, with every path it names resolved (`paths`). Unknown keys refuse, so a
    misspelt mode field never silently becomes a local gate."""
    spec_path = Path(spec_path).resolve()
    require(spec_path.is_relative_to(Path(orch)), 'Gate spec must live under EP_ORCH: ' + str(spec_path))
    spec = json.loads(spec_path.read_text())
    require(isinstance(spec, dict), 'Gate spec must be a JSON object')
    check_keys(spec)
    check_identities(spec)
    check_kind(spec)
    return {**spec, 'paths': spec_paths(spec, spec_path.parent, orch)}


def check_keys(spec):
    missing = [key for key in REQUIRED if key not in spec]
    require(not missing, 'Gate spec missing: ' + ', '.join(missing))
    unknown = sorted(set(spec) - set(REQUIRED) - set(OPTIONAL))
    require(not unknown, 'Unknown gate spec keys: ' + ', '.join(unknown))


def check_identities(spec):
    for name in ('base', 'basetree', 'reviewed', 'tree'):
        full_sha(spec[name], name)
    require(re.fullmatch('[a-z0-9-]+', spec['label']), 'Unsafe invocation label')
    require(spec['archive'].startswith('refs/archive/'), 'Use an explicit archive ref')
    if 'prepared' in spec:
        prepared = spec['prepared']
        require(isinstance(prepared, dict) and set(prepared) == PREPARED_KEYS, 'Prepared needs exactly candidate, mapping and mapping_sha256')
        full_sha(prepared['candidate'], 'prepared candidate')


def check_kind(spec):
    """The kind's review axes, its discriminator, its supported modes and its preparation message."""
    require(spec['kind'] in ('code', 'curation'), 'Gate spec kind must be code or curation')
    axes = {'standards', 'spec'} if spec['kind'] == 'code' else {'curation'}
    require(isinstance(spec['reviews'], dict) and set(spec['reviews']) == axes, 'Gate spec reviews must be exactly: ' + ', '.join(sorted(axes)))
    if spec['kind'] == 'curation':
        require(type(spec.get('issue')) is int and spec['issue'] > 0, 'Curation issue required')
        # Remote checks bind the prep commit itself (curation-remote slice B); the other modes stay code-only.
        # A curation squash binds its prep commit's own message file, so a message_body would be silently unused.
        for key in ('rebase_proof', 'carried_review', 'lane', 'message_body'):
            require(key not in spec, key + ' is supported for code gates only')
    else:
        require('issue' not in spec or spec['issue'] is None, 'Issue is a curation discriminator only')
    require('message_body' not in spec or isinstance(spec['message_body'], str) and spec['message_body'].strip(),
            'message_body must be a non-empty string')
    require(all(isinstance(item, dict) and {'terminal', 'report'} <= set(item) <= {'terminal', 'report', 'conditional'}
                for item in spec['reviews'].values()), 'Gate spec review entries take terminal, report and an optional conditional')
    if 'prepared' in spec:
        return
    if spec['kind'] == 'curation':
        require('message_file' in spec and 'message_sha256' in spec, 'Curation squash needs message_file and message_sha256')
    else:
        require(isinstance(spec.get('message'), str) and spec['message'].strip(), 'Code squash needs a commit message subject')


# The spec keys that name one file, and the `paths` key each resolves to.
OPTIONAL_PATHS = (('prepared', 'mapping', 'mapping'), ('carried_review', 'attestation', 'attestation'),
                  ('conditional_land', 'attestation', 'conditional'), ('lane', 'cli_output', 'lane'), ('remote', 'manifest', 'remote'))


def spec_paths(spec, r, orch):
    resolved = lambda path: resolve(path, r, orch)
    paths = dict(r=str(r), inputs=resolved(spec['inputs_dir']), attempt=resolved(spec['evidence_dir']),
                 result=resolved(spec['result']), done=resolved(spec['done_marker']), acceptance=resolved(spec['acceptance']),
                 author=resolved(spec['author_terminal']),
                 reviews={axis: dict(terminal=resolved(item['terminal']), report=resolved(item['report']),
                                     **({'conditional': resolved(item['conditional'])} if 'conditional' in item else {}))
                          for axis, item in spec['reviews'].items()})
    require(paths['result'].endswith('.md'), 'Gate spec result must be a .md path')
    for key in ('inputs', 'attempt'):
        require(Path(paths[key]).is_relative_to(Path(orch)), 'Gate ' + key + ' directory must live under EP_ORCH')
    for field, key, name in OPTIONAL_PATHS:
        if field in spec:
            paths[name] = resolved(spec[field][key])
    if 'message_file' in spec:
        paths['message'] = resolved(spec['message_file'])
    paths['q1'] = [resolved(spec[key]['q1']) for key in ('rebase_proof', 'carried_review', 'remote')
                   if key in spec and spec[key].get('q1')]
    paths['preserve'] = [resolved(path) for path in spec.get('preserve', [])]
    return paths


def validation_plan(spec, main, orch):
    """The owner-approved empty plan (2026-10-31): no reused author receipts; the queue's full suite is authoritative."""
    return dict(version=1, main=str(main), orch=str(orch), worktree=spec['wt'], base=spec['base'],
                fullQueueRequired=True, checks={},
                note='Owner process change 2026-10-31: no reused author receipts; the queue\'s full suite is authoritative.')


def commit_message(spec):
    """A code squash's message: the spec's subject, its optional body (`message_body`, which brief.py copies
    from the item spec) and the trailer; None when the attempt reuses a prepared mapping or curation binds
    its reviewed commit's own message. gate-run.py writes it to I/commit-message.txt, which gate.json pins and
    preparation's `git commit-tree -F` uses."""
    if 'prepared' in spec or spec['kind'] == 'curation':
        return None
    parts = [spec['message'].strip()]
    if spec.get('message_body'):
        parts.append(spec['message_body'].strip())
    if TRAILER not in spec['message'] + spec.get('message_body', ''):
        parts.append(TRAILER)
    return '\n\n'.join(parts) + '\n'


def script_operator(main, base, run_id):
    """The script operator's identity: MAIN's committed driver at BASE, by path and blob."""
    blob = git(main, 'rev-parse', base + ':' + SCRIPT_OPERATOR)
    return dict(kind='script', path=str(Path(main) / SCRIPT_OPERATOR), commit=base, blob=blob,
                taskId=script_operator_task_id(blob), runId=run_id)


def control(spec, operator):
    return dict(state='active', taskId=operator['taskId'], runId=operator['runId'],
                reviewed=spec['reviewed'], tree=spec['tree'], base=spec['base'])


def review_scopes(spec):
    """The (commit, tree) each review axis binds: REVIEWED/TREE, the accepted commit a mechanical-rebase
    proof carries, the earlier commit a single-axis carried review keeps, or the commit a conditional LAND
    reviewed before its mechanical repair."""
    default = (spec['reviewed'], spec['tree'])
    proof = spec.get('rebase_proof')
    if proof:
        default = (full_sha(proof['accepted'], 'rebase proof accepted'), full_sha(proof['acceptedTree'], 'rebase proof acceptedTree'))
    scopes = {axis: default for axis in spec['reviews']}
    carry = spec.get('carried_review')
    if carry:
        require(carry.get('axis') in ('standards', 'spec'), 'Carried review axis must be standards or spec')
        scopes[carry['axis']] = (full_sha(carry['commit'], 'carried commit'), full_sha(carry['tree'], 'carried tree'))
    land = spec.get('conditional_land')
    if land:
        require(isinstance(land.get('axes'), list) and set(land['axes']) <= set(spec['reviews']),
                "Conditional LAND axes must be the gate kind's review axes")
        for axis in land['axes']:
            scopes[axis] = (full_sha(land['commit'], 'conditional LAND commit'), full_sha(land['tree'], 'conditional LAND tree'))
    return scopes


def reviews(spec):
    out = {}
    for axis, (commit, tree) in review_scopes(spec).items():
        paths = spec['paths']['reviews'][axis]
        task = json.loads(Path(paths['terminal']).read_text())
        out[axis] = dict(commit=commit, tree=tree, taskId=task.get('taskId'), runId=task.get('childRunId') or task.get('runId'),
                         target=dict(providerInstanceId=task.get('providerInstanceId'), model=task.get('model'), options=task_options(task)),
                         task=reference(paths['terminal']), report=reference(paths['report']),
                         disposition='accepted', unresolved=[])
        if 'conditional' in paths:
            # A conditional LAND's scope file, written by the reviewer next to the report (gate_core.conditional_file).
            out[axis]['conditional'] = reference(paths['conditional'])
    return out


def preserved(spec, orch, evidence):
    """The acceptance, Q1 records, the driver's own precheck evidence, the lane check, a curation batch's
    prep receipt, the spec's `preserve` list and the run's adoption record. Under remote checks the curation
    receipt is the remote-suite prep's, which must exist (gate_core.curation_remote_scope joins it with the
    gate); otherwise the local prep's, when there is one."""
    paths = spec['paths']
    items = [paths['acceptance'], *paths['q1'], *evidence]
    if 'lane' in paths:
        items.append(paths['lane'])
    if spec['kind'] == 'curation':
        receipt = Path(prep_receipt_path(orch, spec['issue'], remote='remote' in spec))
        if 'remote' in spec:
            require(receipt.is_file(), 'Curation with remote checks needs its remote-suite prep receipt: ' + str(receipt))
        if receipt.is_file():
            items.append(str(receipt))
    items += paths['preserve']
    adoption = Path(paths['r']) / ADOPTION
    if adoption.is_file():
        items.append(str(adoption))
    return [reference(path) for path in dict.fromkeys(items)]


def gate_config(spec, main, orch, refs):
    """gate.json for the operations schema. `refs` holds {path, sha256} for the inputs the driver wrote:
    operator, plan, storageBaseline, precheck and (code squash only) message; control is a path, and
    the optional `evidence` lists further driver evidence paths to preserve."""
    paths = spec['paths']
    modes = mode_fields(spec)
    config = dict(version=1, kind=spec['kind'])
    if spec['kind'] == 'curation':
        config['issue'] = spec['issue']
    config.update(main=str(main), orch=str(orch), worktree=spec['wt'], branch=spec['branch'],
                  feature=spec.get('feature', FEATURE), base=spec['base'], reviewed=spec['reviewed'], tree=spec['tree'],
                  attempt=paths['attempt'], label=spec['label'], operator=refs['operator'], author=reference(paths['author']),
                  validation=dict(plan=refs['plan'], receipts={}), resourcePolicy=reference(Path(orch) / 'resource-policy.md'),
                  storageBaseline=refs['storageBaseline'], reviews=modes.pop('reviews'), phases=list(PHASES), control=refs['control'])
    if 'prepared' in spec:
        prepared = spec['prepared']
        config['preparation'] = dict(mode='prepared', archive=spec['archive'], candidate=prepared['candidate'],
                                     mapping=dict(path=paths['mapping'], sha256=prepared['mapping_sha256']))
    elif spec['kind'] == 'curation':
        config['preparation'] = dict(mode='squash', archive=spec['archive'],
                                     message=dict(path=paths['message'], sha256=spec['message_sha256']))
    else:
        config['preparation'] = dict(mode='squash', archive=spec['archive'], message=refs['message'])
    modes.pop('kind')
    config.update(modes)
    config['preservedEvidence'] = preserved(spec, orch, [refs['precheck']['path'], *refs.get('evidence', [])])
    return config


def mode_fields(spec):
    """kind, reviews and the optional mode fields (rebaseProof, carriedReview, conditionalLand, remoteChecks, lane), as gate.json
    carries them; the driver also re-proves them with gate_core before it waits for the host."""
    paths = spec['paths']
    config = dict(kind=spec['kind'], reviews=reviews(spec))
    if 'rebase_proof' in spec:
        proof = spec['rebase_proof']
        config['rebaseProof'] = {key: full_sha(proof[key], 'rebase proof ' + key) for key in ('oldBase', 'accepted', 'acceptedTree')}
    if 'carried_review' in spec:
        carry = spec['carried_review']
        config['carriedReview'] = dict(axis=carry['axis'], commit=carry['commit'], tree=carry['tree'],
                                       attestation=dict(path=paths['attestation'], sha256=carry['attestation_sha256']))
    if 'conditional_land' in spec:
        land = spec['conditional_land']
        config['conditionalLand'] = dict(axes=land['axes'], commit=land['commit'], tree=land['tree'], paths=land['paths'],
                                         message=land['message'],
                                         attestation=dict(path=paths['conditional'], sha256=land['attestation_sha256']))
    if 'remote' in spec:
        remote = spec['remote']
        require(remote.get('mode') in ('compare', 'replace'), 'Remote mode must be compare or replace')
        config['remoteChecks'] = dict(path=paths['remote'], sha256=remote['sha256'], mode=remote['mode'])
    if 'lane' in spec:
        config['lane'] = json.loads(Path(paths['lane']).read_text())['lane']
    return config


def mode_config(spec):
    """The fields gate_monitor needs to pick the gate mode's memory cap and launch guard."""
    return {'remoteChecks': {'mode': spec['remote']['mode']}} if 'remote' in spec else {}


def prepared_retry(attempt):
    """The exact `prepared` spec field a later attempt takes from this attempt's mapping, or None when the
    attempt never wrote one (it stopped before preparation)."""
    mapping = Path(attempt) / 'mapping.json'
    if not mapping.is_file():
        return None
    candidate = full_sha(json.loads(mapping.read_text()).get('SQUASHED'), 'mapping SQUASHED')
    return dict(candidate=candidate, mapping=str(mapping), mapping_sha256=reference(mapping)['sha256'])


def retry_spec(prior_path, new_path, label, orch):
    """The next attempt's spec after a stopped one. Every binding of the prior spec stays as it was: BASE,
    REVIEWED, TREE, branch, archive, reviews, author, acceptance, message and modes; never the squashed HEAD.
    Only the attempt's names change (from NEW_PATH, R/ITEM-gate-spec-rN.json), and `prepared` comes from the
    prior attempt's mapping when it prepared; otherwise the prior `prepared`, or else a fresh squash."""
    prior = load_spec(prior_path, orch)
    result_path = Path(prior['paths']['result']).with_suffix('.json')
    require(result_path.is_file(), 'Prior attempt has no result: ' + str(result_path))
    result = json.loads(result_path.read_text())
    require(result.get('verdict') == 'stopped', 'Only a stopped attempt is retried: ' + str(result.get('verdict')))
    new_path = Path(new_path).resolve()
    match = RETRY_SPEC.fullmatch(new_path.name)
    require(match is not None and str(new_path.parent) == prior['paths']['r'], 'Retry spec must be R/ITEM-gate-spec-rN.json beside the prior spec')
    require(not new_path.exists(), 'Retry spec exists: ' + str(new_path))
    item, n = match['item'], match['round']
    spec = {key: value for key, value in prior.items() if key not in ATTEMPT_KEYS and key != 'paths'}
    spec.update(label=label, inputs_dir='R/%s-gate-r%s-inputs' % (item, n), evidence_dir='R/%s-gate-r%s-evidence' % (item, n),
                result='R/%s-gate-r%s-result.md' % (item, n),
                done_marker='EP_ORCH/runs/%s-%s-final-gate-r%s.done' % (Path(prior['paths']['r']).name, item, n))
    prepared = prepared_retry(prior['paths']['attempt'])
    require(result.get('preparedRetry') == prepared, "Prior result's preparedRetry does not match its attempt's mapping")
    if prepared is None:
        prepared = prior.get('prepared')
    if prepared is not None:
        spec['prepared'] = prepared
    spec['notes'] = list(prior.get('notes', [])) + ['Retry of %s (stopped: %s).' % (prior['label'], result.get('stopReason'))]
    check_keys(spec)
    check_identities(spec)
    check_kind(spec)
    with new_path.open('x') as output:
        output.write(json.dumps(spec, indent=2) + '\n')
    return new_path


def main(argv=None):
    import argparse
    import os
    parser = argparse.ArgumentParser(description='Write the spec for the next attempt after a stopped gate.')
    parser.add_argument('command', choices=['retry'])
    parser.add_argument('prior')
    parser.add_argument('new')
    parser.add_argument('--label', required=True)
    parser.add_argument('--orch', default=os.environ.get('EP_ORCH', '/home/andreas/repos/everythingpath/ep-orch'))
    args = parser.parse_args(argv)
    print(retry_spec(args.prior, args.new, args.label, args.orch))


if __name__ == '__main__':
    main()
