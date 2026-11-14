#!/usr/bin/env python3
"""Gate time: a gate's own work time against the median of the last five landed gates of its mode.

Owner rule 2026-11-08 (decisions.md "Gate-time review", with its same-day correction): an item-caused
increase of more than 30% fails the gate; root alone records an outside cause (`gate_time_exempt`).

- **CI part:** the remote manifest's run, as its longest job's execution (`startedAt` to `completedAt`, so runner
  queueing and launch delay are left out), read from GitHub (`gh run view <id> --attempt <n> --json jobs`; the
  manifest holds command times, not job times). Skipped jobs and the assembly job (the manifest runner's `job`,
  `remote-checks`, which only starts after every other job) are left out; a run whose only job is the assembly
  (CI before the shards) counts it. A gate without remote checks has no CI part.
- **Host part:** the driver's stage seconds without prelaunch, the admission probe and this measurement
  (`gate-time`), less the resume stage's waits: the unit's launch (the submission claim to the queue's `started` line
  in the wait ledger: bounded.sh's lock and admission waits) and every wait the queue recorded through paths.sh
  `gate_wait` (land.lock, heavy.lock, a curation prep's memory escalation, the landing observation lock).
- **Baseline** (root's final ruling, gate-time-check fix r2): exactly the last five landed results of the mode among
  `R/*-gate-r*-result.json`, in landing order (`endedAt`, newest first), each giving its `gateTime` total; a lower-bound
  total gives its recorded host part plus its manifest's GitHub run. The baseline is unavailable, naming the result and
  why, when one of the five is unreadable, lacks gate-time fields (every result from before gate-time-check: its stage
  seconds hold untimed waits) or lacks its recorded waits, and when any result's verdict, or a landed result's mode or
  landing time, cannot be read, since it could be one of the five. With fewer than five there is no baseline. An older
  result never takes a place, and building the baseline never raises: neither case refuses.
- **Checks** (root's rulings, 2026-11-08): the measure is the total. Before prelaunch, only a CI part already over the total
  trigger stops a gate; the CI part against its own median is information. An unreadable CI part is an outside cause:
  it never refuses, and the host part alone is judged as a lower bound.

  python3 -B gate_time.py land GATE-TIME.json   the total check cur-land.sh runs just before land.sh (exit 1 refuses;
                                                an unreadable file, claim or wait ledger refuses too)
"""
import json
import math
from pathlib import Path
import statistics
import subprocess
import sys
import time
from datetime import datetime

TRIGGER = 0.30
GATES = 5
MODES = ('replace', 'local', 'curation', 'light')
# Driver stages that are waits or this measurement, not gate work.
EXCLUDED_STAGES = ('prelaunch', 'admission-probe', 'gate-time')
GH_TIMEOUT = 60
# The unit's launch: from the submission claim (written just before bounded.sh) to the queue's start in the unit.
LAUNCH = 'launch (bounded.sh locks and admission)'
# gateTime fields a landed result needs to give its gate time (gate-run.py `gate_time_result`).
FIELDS = ('ci', 'host', 'total', 'totalLowerBound')


class Unmeasured(Exception):
    """A time the rule needs cannot be read; the message says why."""


def mode(kind, lane, remote_mode):
    """A gate's mode: curation for every curation gate, then light, replace, or local (local and compare)."""
    if kind == 'curation':
        return 'curation'
    if lane:
        return 'light'
    return 'replace' if remote_mode == 'replace' else 'local'


def result_mode(result):
    """The mode of a published result: its `gateTime.mode`, or for older results its kind and suite source."""
    recorded = (result.get('gateTime') or {}).get('mode') if isinstance(result.get('gateTime'), dict) else None
    if recorded in MODES:
        return recorded
    source = result['suite'].get('source') if isinstance(result.get('suite'), dict) else None
    if result.get('kind') == 'curation':
        return 'curation'
    if source == 'light lane: no suite':
        return 'light'
    if isinstance(source, str) and source.startswith('remote+host-audits'):
        return 'replace'
    if source in ('local', 'local+remote-compare'):
        return 'local'
    return None


def instant(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def ci_part(runner, jobs):
    """The longest job's execution in seconds, without skipped jobs and the assembly job (runner['job']). A run
    whose only job is the assembly (CI before the shards, e.g. run 42205929901) counts that job: it ran everything."""
    assembly = runner.get('job') or 'remote-checks'
    candidates, is_assembly_excluded = ci_candidates(runner, jobs, assembly)
    seconds, name = max([job_seconds(row, runner.get('runId')) for row in candidates])
    return dict(seconds=seconds, job=name, runId=runner.get('runId'), attempt=runner.get('attempt'), url=runner.get('url'),
                assemblyExcluded=assembly if is_assembly_excluded else None, source='github: gh run view --json jobs')


def ci_candidates(runner, jobs, assembly):
    """(the jobs the CI part is the longest of, whether the assembly job was left out): the jobs that ran without the
    assembly, or every job that ran when the assembly is the only one."""
    ran = [row for row in jobs if row.get('conclusion') != 'skipped']
    if not ran:
        raise Unmeasured('run %s has no job that ran' % runner.get('runId'))
    gate_jobs = [row for row in ran if row.get('name') != assembly]
    return gate_jobs or ran, bool(gate_jobs)


def job_seconds(row, run_id):
    """(execution seconds, name) of a completed job with both times, else Unmeasured."""
    if row.get('status') != 'completed' or not row.get('startedAt') or not row.get('completedAt'):
        raise Unmeasured('job %s of run %s is not completed with times' % (row.get('name'), run_id))
    return round((instant(row['completedAt']) - instant(row['startedAt'])).total_seconds()), row['name']


def github_jobs(runner, gh, run=subprocess.run):
    """The run attempt's jobs as GitHub reports them."""
    argv = [gh, 'run', 'view', str(runner['runId']), '--attempt', str(runner.get('attempt') or 1), '-R', runner['repository'], '--json', 'jobs']
    try:
        result = run(argv, capture_output=True, text=True, timeout=GH_TIMEOUT)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise Unmeasured('gh run view %s failed: %s' % (runner['runId'], exc))
    if result.returncode != 0:
        raise Unmeasured('gh run view %s exited %d: %s' % (runner['runId'], result.returncode, result.stderr.strip()))
    try:
        return json.loads(result.stdout)['jobs']
    except (ValueError, KeyError, TypeError) as exc:
        raise Unmeasured('gh run view %s printed no job list: %s' % (runner['runId'], exc))


def manifest_runner(path):
    runner = json.loads(Path(path).read_text()).get('runner')
    if not (isinstance(runner, dict) and runner.get('runId') and runner.get('repository')):
        raise Unmeasured('manifest %s names no GitHub run' % path)
    return runner


def host_seconds(stages):
    """The driver's finished stage seconds without the waits and the measurement."""
    return round(sum(row['seconds'] for row in stages
                     if row.get('name') not in EXCLUDED_STAGES and isinstance(row.get('seconds'), (int, float))), 3)


def read_ledger(path):
    """The queue's wait ledger (LAND_GATE_WAITS; paths.sh `gate_wait`): one `started<TAB><epoch>` line, written when the
    queue starts in the unit, then one `wait<TAB><label><TAB><seconds>` line per wait. Anything else is unreadable."""
    try:
        rows = [ledger_row(line) for line in Path(path).read_text().splitlines()]
    except OSError as exc:
        raise Unmeasured('no wait ledger %s: %s' % (path, exc))
    except ValueError as exc:
        raise Unmeasured('wait ledger %s: %s' % (path, exc))
    started = [row['at'] for row in rows if 'at' in row]
    if len(started) != 1:
        raise Unmeasured('wait ledger %s has %d started lines, not one' % (path, len(started)))
    return dict(startedAt=started[0], waits=[row for row in rows if 'at' not in row])


def ledger_row(line):
    """{at} for the started line, {label, seconds} for a wait; ValueError for anything else."""
    fields = line.split('\t')
    if fields[0] == 'started' and len(fields) == 2:
        return dict(at=float(fields[1]))
    if fields[0] == 'wait' and len(fields) == 3 and fields[1] and float(fields[2]) >= 0:
        return dict(label=fields[1], seconds=float(fields[2]))
    raise ValueError('unreadable line %r' % line)


def resume_waits(claim, ledger):
    """Every wait of the resume stage: the unit's launch (the submission claim's `at` to the queue's start: bounded.sh's
    lock and admission waits) and each wait the queue recorded. A queue start before the claim is unreadable."""
    try:
        claimed = instant(json.loads(Path(claim).read_text())['at']).timestamp()
    except Exception as exc:
        raise Unmeasured('submission claim %s has no time: %s' % (claim, exc))
    value = read_ledger(ledger)
    if value['startedAt'] < claimed:
        raise Unmeasured('wait ledger %s: the queue started before its submission claim' % ledger)
    return [dict(label=LAUNCH, seconds=round(value['startedAt'] - claimed, 3)), *value['waits']]


def wait_seconds(waits):
    return round(sum(row['seconds'] for row in waits), 3)


def seconds_of(value):
    """A finite number of seconds (not a bool, not negative), or None."""
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None


def recorded_fields(result):
    """A landed result's `gateTime`, with every field the rule needs, else Unmeasured with why."""
    recorded = result.get('gateTime')
    if recorded is None:
        raise Unmeasured('it has no gate-time fields (a result from before gate-time-check)')
    if not isinstance(recorded, dict):
        raise Unmeasured('it has no gate-time fields: %r' % recorded)
    if 'unavailable' in recorded:
        raise Unmeasured('its gate time was not recorded: %s' % recorded['unavailable'])
    missing = [key for key in FIELDS if key not in recorded]
    if missing:
        raise Unmeasured('its gateTime lacks %s' % ', '.join(missing))
    return recorded


def host_part(recorded):
    """The recorded host part's seconds, which left out its waits: only a host part with every wait recorded counts."""
    host = recorded['host']
    if not isinstance(host, dict) or seconds_of(host.get('seconds')) is None:
        raise Unmeasured('its host part has no seconds: %r' % host)
    waits = host.get('waits')
    if isinstance(waits, dict):
        raise Unmeasured('its waits were not recorded: %s' % waits.get('unavailable'))
    if not isinstance(waits, list):
        raise Unmeasured('its host part has no wait record')
    for row in waits:
        if not (isinstance(row, dict) and isinstance(row.get('label'), str) and row['label'] and seconds_of(row.get('seconds')) is not None):
            raise Unmeasured('its host part has an unreadable wait: %r' % row)
    return host['seconds']


def measured(path, result, read_jobs):
    """One landed result's {label, result, ci, host, total, source}, from its recorded gate time, else Unmeasured."""
    recorded = recorded_fields(result)
    host = host_part(recorded)
    row = dict(label=result.get('label'), result=str(path))
    if recorded['totalLowerBound'] is True:
        # The CI part was unreadable: the recorded host part plus the gate's GitHub run, read again.
        ci, run = github_ci(result, read_jobs)
        return dict(row, ci=ci, host=host, total=round(host + ci, 3), source='gateTime host part + GitHub run %s' % run)
    if recorded['totalLowerBound'] is not False:
        raise Unmeasured('its totalLowerBound is not true or false: %r' % recorded['totalLowerBound'])
    if seconds_of(recorded['total']) is None:
        raise Unmeasured('its total is not a number of seconds: %r' % recorded['total'])
    ci = recorded['ci']
    if ci is not None and not (isinstance(ci, dict) and seconds_of(ci.get('seconds')) is not None):
        raise Unmeasured('its CI part has no seconds: %r' % ci)
    return dict(row, ci=ci['seconds'] if ci else None, host=host, total=recorded['total'], source='gateTime')


def github_ci(result, read_jobs):
    """(CI part seconds, run id) of a lower-bound result's remote manifest run."""
    remote = json.loads(Path(result['gateConfig']['path']).read_text()).get('remoteChecks')
    if not remote:
        raise Unmeasured("its lower-bound total's gate.json names no remote checks")
    runner = manifest_runner(remote['path'])
    return ci_part(runner, read_jobs(runner))['seconds'], runner['runId']


def median(values):
    return statistics.median(values) if values and all(value is not None for value in values) else None


def placed(path, gate_mode):
    """(landing time, result) for a landed result of the mode, None for any other result, else Unmeasured: a result
    whose verdict, or a landed result's mode or landing time, cannot be read could be one of the last five."""
    try:
        result = json.loads(path.read_text())
    except (OSError, ValueError) as exc:
        raise Unmeasured('unreadable: %s' % exc)
    if not isinstance(result, dict):
        raise Unmeasured('not a JSON object')
    if not isinstance(result.get('verdict'), str):
        raise Unmeasured('no verdict')
    if result['verdict'] != 'landed':
        return None
    found = result_mode(result)
    if found is None:
        raise Unmeasured('landed, of no known mode')
    if found != gate_mode:
        return None
    try:
        ended = instant(result['endedAt'])
    except (KeyError, AttributeError, TypeError, ValueError):
        ended = None
    if ended is None or ended.tzinfo is None:
        raise Unmeasured('landed with no landing time (endedAt %r)' % result.get('endedAt'))
    return ended, result


def landed(r, gate_mode):
    """(the landed results of the mode in R newest first as (path, result), the results that cannot be placed)."""
    rows, unplaced = [], []
    for path in sorted(Path(r).glob('*-gate-r*-result.json')):
        try:
            row = placed(path, gate_mode)
        except Unmeasured as exc:
            unplaced.append(dict(label=None, result=str(path), reason=str(exc)))
            continue
        if row:
            rows.append((row[0], path, row[1]))
    rows.sort(key=lambda row: row[0], reverse=True)
    return [(path, result) for _, path, result in rows], unplaced


def baseline(r, gate_mode, read_jobs):
    """The last five landed gates of the mode in R and their medians. With fewer than five, or when the five cannot be
    told or one of them gives no wait-free gate time, the median is None with the reason; never raises."""
    try:
        return last_five(r, gate_mode, read_jobs)
    except Exception as exc:  # a gate always runs: a baseline it cannot build is unavailable, never a stop
        return dict(mode=gate_mode, gates=[], unreadable=[dict(label=None, result=str(r), reason=str(exc))], median=None, trigger=None,
                    reason='baseline unavailable (%s: %s)' % (r, exc))


def last_five(r, gate_mode, read_jobs):
    rows, unreadable = landed(r, gate_mode)
    gates = []
    if not unreadable:
        gates, unreadable = measured_newest(rows[:GATES], read_jobs)
    value = dict(mode=gate_mode, gates=gates, unreadable=unreadable, median=None, trigger=None)
    if unreadable:
        return dict(value, reason='baseline unavailable (%s)' % '; '.join('%s: %s' % (row['result'], row['reason']) for row in unreadable))
    if len(gates) < GATES:
        return dict(value, reason='no baseline: %d landed %s gates, %d needed' % (len(gates), gate_mode, GATES))
    return dict(value, **medians_of(gates))


def measured_newest(rows, read_jobs):
    """(the measured gates, the ones that give no gate time) of the newest landed results (path, result)."""
    gates, unreadable = [], []
    for path, result in rows:
        try:
            gates.append(measured(path, result, read_jobs))
        except Exception as exc:  # named in the reason; the baseline is unavailable, never a different five
            unreadable.append(dict(label=result.get('label'), result=str(path), reason=str(exc)))
    return gates, unreadable


def medians_of(gates):
    """{median: the gates' total, CI and host medians, trigger: the total median plus TRIGGER}."""
    medians = {part: median([gate[part] for gate in gates]) for part in ('total', 'ci', 'host')}
    return dict(median=medians, trigger=round(medians['total'] * (1 + TRIGGER), 3))


def judge(seconds, median_seconds):
    percent = round((seconds / median_seconds - 1) * 100, 1)
    return dict(seconds=seconds, median=median_seconds, percent=percent, trigger=seconds > median_seconds * (1 + TRIGGER))


def number(value):
    return '%d' % round(value)


def reason(gate_mode, verdict, part=None):
    return 'gate time %s%s s is %.1f%% over the %s s median of %s' % (
        '(%s) ' % part if part else '', number(verdict['seconds']), verdict['percent'], number(verdict['median']), gate_mode)


def comparison(gate_mode, verdict):
    side = 'over' if verdict['percent'] >= 0 else 'under'
    return '%.1f%% %s the %s s median of %s' % (abs(verdict['percent']), side, number(verdict['median']), gate_mode)


def land_check(path, now=time.time):
    """(exit code, line) for the total just before land.sh: the CI part plus the host part so far (the stages before
    resume, then the time since resume started without the resume stage's waits), or the host part alone when the CI
    part was unreadable. Over the trigger refuses unless root recorded an outside cause; an unreadable file or wait
    ledger refuses."""
    try:
        value = json.loads(Path(path).read_text())
        # An unreadable CI part is an outside cause: the host part alone is judged, as a lower bound.
        lower = 'unavailable' in (value.get('ci') or {})
        ci = (value.get('ci') or {}).get('seconds') or 0
        waited = wait_seconds(resume_waits(value['claim'], value['waits']))
        host = round(value['hostBefore'] + now() - value['resumeStartedAt'] - waited)
        base, exempt, gate_mode = value['baseline'], value.get('exempt'), value['mode']
    except Exception as exc:
        return 1, 'gate-time refused: unreadable %s: %s' % (path, exc)
    total = round(ci + host)
    parts = ('at least %s s (CI unavailable + host %s s, waits %s s left out)' % (number(total), number(host), number(waited)) if lower
             else '%s s (CI %s s + host %s s, waits %s s left out)' % (number(total), number(ci), number(host), number(waited)))
    if not base.get('median'):
        return 0, 'gate-time no baseline: %s; %s' % (parts, base.get('reason'))
    verdict = judge(total, base['median']['total'])
    if not verdict['trigger']:
        return 0, 'gate-time pass: %s is %s' % (parts, comparison(gate_mode, verdict))
    if exempt:
        return 0, 'gate-time exempt: %s; outside cause (root): %s' % (reason(gate_mode, verdict), exempt['reason'])
    return 1, 'gate-time refused: ' + reason(gate_mode, verdict)


def main(argv):
    if len(argv) != 2 or argv[0] != 'land':
        print('usage: gate_time.py land GATE-TIME.json', file=sys.stderr)
        return 64
    code, line = land_check(argv[1])
    print(line)
    return code


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
