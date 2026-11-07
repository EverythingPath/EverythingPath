# Ported from the root-qualified external monitor (2026-10-27).
# Source SHA-256: 04208817cc54e3eec3cf27ef9641914b1bb0e8fcde30307c8942464f5fe9d7be
# Only imports, storage-baseline lookup and mapping lookup adapt to gate_core (the storage
# pattern is a module constant, unchanged, so gate-run.py shares it);
# the gate memory cap is per gate mode (operations.md#gate-memory); a unit deactivating after a clean
# exit is a terminal state and a stop request to an unloaded unit is not a failure (observer-deactivation-race);
# only the gate's own refs are protected, the rest recorded, an archive added mid-gate kept by the archive ledger,
# and automatic Git maintenance must stay off in MAIN (gate-hold-scope, gate-modes.md#protected-refs).
# Qualification/limitations: docs/agents/orchestration/operations.md#monitor-provenance
"""Continuous 5s observations (tool caller yields/polls at <=55s) on the saved invocation; never dispatches work."""
import hashlib
import json
import os
import re
import signal
import sys
from pathlib import Path
import subprocess
import time
from gate_core import (env, preflight, mapping, submission, load, save, now, git, require, snapshot, execution_control, all_refs,
                       maintenance_reading, maintenance_refusals, MAINTENANCE_FIX)
from workflow_evidence import landing_read, receipt_ok

PROPS = ('ControlGroup ActiveState MemoryPeak MemoryCurrent Result ExecMainStatus MemoryMax '
         'MemoryHigh MemorySwapMax CPUQuotaPerSecUSec TasksMax CPUWeight Nice LimitCORE '
         'Restart TimeoutStopUSec MainPID LoadState').split()
CGROUP_ROOT = Path('/sys/fs/cgroup')
CGFILES = ('memory.events memory.events.local memory.current memory.peak memory.stat '
           'memory.pressure cpu.stat').split()
# The gate unit's MemoryMax per gate mode (gate.json remoteChecks.mode, or local
# without remoteChecks). The operator passes it to $EP_ORCH/bounded.sh for kind
# gate (BOUNDED_GATE_MEMORY_MAX); the launch guard, the unit's in-run real-memory
# stops and the expected unit cap follow it. Local and compare gates run the full
# suite: option 1 (owner, 2026-10-30), 2-worker gates peaked at 11.96 GiB kernel /
# 10.26 GiB real, and 15G keeps Node's 4 GiB default heap. Replace gates run no
# local typecheck, lint or suite (owner, 2026-11-03): their whole local sequence
# in queue order (install, writer check, artifacts, codegen, pin, remote verify,
# host audits, the real e2e preflight) peaked at 6.55 GiB kernel (6.59 with any
# reclaimed cache added back) / 5.16 GiB real; x1.5, rounded up. Every Node
# process they run without a heap flag stays below 0.1 GiB of the 2 GiB default
# heap below 15G.
GiB = 1024**3
GATE_MEMORY_MAX_BYTES = dict(local=15 * GiB, compare=15 * GiB, replace=10 * GiB)
BOUNDED_GATE_MEMORY_MAX_VALUES = frozenset('%dG' % (cap // GiB) for cap in GATE_MEMORY_MAX_BYTES.values())
# The slice also holds admitted curator jobs; its real-memory stop keeps the
# full-suite cap in every mode.
SLICE_REAL_STOP_BYTES = GATE_MEMORY_MAX_BYTES['local']
HOST_FLOOR_BYTES = 6 * GiB
# Kernel storage events since the storage baseline; gate-run.py checks the same pattern before the claim.
STORAGE_PATTERN = 'BTRFS.*(error|corrupt|csum|checksum)|I/O error|ata[0-9]+.*(exception|hard resetting|EH complete)|sda.*(error|failed|timeout)'
_last_guard = None
_guard_cache = None
_low_since = None

class StoppedEvidence(RuntimeError):
    pass

def gate_mode(config):
    remote = config.get('remoteChecks')
    if remote is None:
        return 'local'
    require(remote.get('mode') in ('replace', 'compare'), 'Unknown remoteChecks mode: ' + str(remote.get('mode')))
    return remote['mode']

def gate_memory_max_bytes(config):
    return GATE_MEMORY_MAX_BYTES[gate_mode(config)]

def launch_minimum_bytes(config):
    return gate_memory_max_bytes(config) + HOST_FLOOR_BYTES

def bounded_gate_memory_max(config):
    """The unit's MemoryMax as bounded.sh takes it for kind gate."""
    return '%dG' % (gate_memory_max_bytes(config) // GiB)

def guard_command(argv, accepted=(0,)):
    p=subprocess.run(argv,capture_output=True,text=True,timeout=4)
    require(p.returncode in accepted,'Guard instrumentation failed: '+str(argv)+' '+p.stderr)
    return dict(argv=argv,exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr)

def stop_unit(unit):
    """Request the unit's stop. A unit systemd has already unloaded (collected after it exited) has nothing to
    stop: that is recorded, not an observer failure. Any other refused stop fails as before."""
    argv=['systemctl','--user','stop','--no-block',unit]
    p=subprocess.run(argv,capture_output=True,text=True,timeout=4)
    if p.returncode==0:return dict(argv=argv,exitCode=0,unloaded=False)
    shown=subprocess.run(['systemctl','--user','show',unit,'-p','LoadState','--value'],capture_output=True,text=True,timeout=4)
    require(shown.returncode==0 and shown.stdout.strip()=='not-found','Guard instrumentation failed: '+str(argv)+' '+p.stderr)
    return dict(argv=argv,exitCode=p.returncode,stderr=p.stderr,unloaded=True)

def guard_observation(v):
    """Reuse the qualified #761 observer inside this monitor; no separate daemon."""
    global _last_guard,_guard_cache,_low_since
    stamp=time.monotonic();available=int(re.search(r'^MemAvailable:\s+(\d+)',Path('/proc/meminfo').read_text(),re.M)[1])*1024
    _low_since=(_low_since if _low_since is not None else stamp) if available<HOST_FLOOR_BYTES else None
    g=dict(hostAvailableBytes=available,hostLowSeconds=stamp-_low_since if _low_since is not None else 0,observationGapSeconds=stamp-_last_guard if _last_guard is not None else 0)
    _last_guard=stamp
    if _guard_cache is None or stamp-_guard_cache['sampleMonotonic']>=3:
        prior=load(v['STORAGE_BASELINE'])
        cursor=prior['journal']['stdout'].split('-- cursor: ')[1].strip()
        pattern=STORAGE_PATTERN
        baseline_path=Path(v['E'])/'resource-baseline.json'
        baseline=load(baseline_path)['guard'] if baseline_path.exists() else None
        ids=guard_command(['docker','ps','-aq','--no-trunc'])['stdout'].split()
        scratch_root=Path(v['MAIN']).parent/'.ep-tmp'
        scratch=sorted({str(p) for pattern in ('local-codegen-*','e2e-*','queue-*','cur-land-*','triage-*') for p in scratch_root.glob(pattern)}|{str(p) for p in scratch_root.parent.glob('ep-gate-'+Path(v['WT']).name+'-*')})
        before_ids=baseline['dockerIdsBefore'] if baseline else ids
        before_scratch=baseline['scratchBefore'] if baseline else scratch
        labelled=guard_command(['docker','ps','-aq','--no-trunc','--filter','label=dev.everythingpath.local-convex'])['stdout'].split()
        docker=[]
        for container in labelled:
            if container in before_ids:continue
            fmt='{"id":{{json .Id}},"name":{{json .Name}},"state":{{json .State}},"mounts":{{json .Mounts}},"ports":{{json .NetworkSettings.Ports}},"image":{{json .Config.Image}}}'
            inspected=guard_command(['docker','inspect','--format',fmt,container],(0,1))
            if inspected['exitCode']:
                require(not guard_command(['docker','ps','-aq','--filter','id='+container])['stdout'],'Owned Docker instrumentation failed')
                continue
            d=json.loads(inspected['stdout']);pid=str(d['state']['Pid']);p=Path('/proc')/pid/'cgroup'
            if pid!='0' and p.exists():
                cg=Path('/sys/fs/cgroup'+p.read_text().strip().split('::',1)[1])
                d['cgroup']={n:(cg/n).read_text() for n in ('memory.current','memory.peak','memory.stat','memory.events','memory.max','memory.high','memory.swap.max','cpu.max')}
            docker.append(d)
        _guard_cache=dict(sampleMonotonic=stamp,dockerIdsBefore=before_ids,scratchBefore=before_scratch,ownedScratch=[p for p in scratch if p not in before_scratch],docker=docker,expectedStorageCounters=prior['counters']['stdout'],storage=dict(journal=guard_command(['journalctl','-k','-b','--after-cursor',cursor,'--no-pager','-o','short-iso','--show-cursor','--grep',pattern],(0,1)),counters=guard_command(['btrfs','device','stats','/home'])))
    return {**g,**_guard_cache}

def guard_violations(row):
    g=row.get('guard');bad=[]
    if not g:return [dict(guardEvidence='missing')]
    if g['hostAvailableBytes']<HOST_FLOOR_BYTES and g['hostLowSeconds']>=5:bad.append(dict(hostBelow6GiBSeconds=g['hostLowSeconds']))
    if g['observationGapSeconds']>10:bad.append(dict(instrumentationGapSeconds=g['observationGapSeconds']))
    storage=g['storage']
    if storage['journal']['exitCode']!=1:bad.append(dict(newStorageError=storage['journal']))
    if storage['counters']['stdout']!=g['expectedStorageCounters']:bad.append(dict(storageCounterChange=storage['counters']))
    for d in g['docker']:
        events=counters(d.get('cgroup',{}).get('memory.events',''))
        if d['state'].get('OOMKilled') or any(events.get(k,0)>0 for k in ('max','oom','oom_kill','oom_group_kill')):bad.append(dict(dockerResourceFailure=d['id'],events=events))
    return bad

def guard_cleanup(rows):
    """Read-only targeted checks on resources observed outside the bounded scope."""
    containers={d['id']:d for r in rows for d in r.get('guard',{}).get('docker',[])}
    volumes={m['Name'] for d in containers.values() for m in d['mounts'] if m.get('Type')=='volume'}
    scratch={p for r in rows for p in r.get('guard',{}).get('ownedScratch',[])}
    remaining_containers={c:guard_command(['docker','ps','-aq','--no-trunc','--filter','id='+c])['stdout'] for c in containers}
    remaining_volumes={n:guard_command(['docker','volume','ls','-q','--filter','name=^'+n+'$'])['stdout'] for n in volumes}
    remaining_scratch={p:Path(p).exists() for p in scratch}
    return dict(observedContainers=containers,remainingContainers=remaining_containers,remainingVolumes=remaining_volumes,remainingScratch=remaining_scratch,passed=not any([*remaining_containers.values(),*remaining_volumes.values(),*remaining_scratch.values()]),limitation='Observed resources only; terminal missing cgroups are unavailable, never zero. Docker is outside the unit/slice; no whole-host cap or combined peak claim.')

def counters(text):
    return {k: int(v) for k, v in (x.split() for x in text.splitlines())}

def real(row):
    if 'memory.current' not in row or 'memory.stat' not in row:
        return None
    st = counters(row['memory.stat'])
    return int(row['memory.current']) - st.get('file', 0) + st.get('shmem', 0)

def observe_scope(unit):
    """One unit's or slice's systemd properties and cgroup counters. A counter that cannot be read is listed
    under `unavailable` and never stands in as zero."""
    p = subprocess.run(['systemctl', '--user', 'show', unit,
          *[arg for prop in PROPS for arg in ['-p', prop]]], capture_output=True, text=True,timeout=4)
    fields = dict(x.split('=', 1) for x in p.stdout.splitlines() if '=' in x)
    r = dict(systemd=fields, systemctlExit=p.returncode, error=p.stderr)
    cg = CGROUP_ROOT / fields['ControlGroup'].lstrip('/') if fields.get('ControlGroup') else None
    for name in CGFILES:
        try:
            if cg is not None:
                r[name] = (cg / name).read_text()
        except FileNotFoundError:
            pass  # Terminal disappearance is unavailable evidence, never zero.
    r['unavailable'] = [name for name in CGFILES if name not in r]
    return r

def terminal_exit(v, s, r):
    """Whether a unit row without counters is the clean end of the run rather than lost observation: the
    main process exited 0 with success (MainPID 0) and systemd is deactivating the unit. A canonical
    receipt, once written, must be ok; collection always has it."""
    props = r.get('systemd', {})
    if s is None or props.get('ActiveState') != 'deactivating':
        return False
    if (props.get('Result'), props.get('ExecMainStatus'), props.get('MainPID')) != ('success', '0', '0'):
        return False
    path = Path(v['ORCH']) / 'bounded' / s['invocationId'] / 'receipt.json'
    if not path.exists():
        return True  # Pending: the loop requires the receipt before it accepts the terminal state.
    try:
        return receipt_ok(load(path), s)
    except Exception:
        return False

# The gate's own refs (operations.md#protected-refs): its branch, the integration branch, its reviewed
# archive and main, which move only as the gate moves them, and every archive, which may be added but
# never rewritten or deleted. Any other ref (a worker's t3/* branch, a T3 checkpoint, a fetched
# remote-tracking ref) cannot affect the landing: rows record its moves and never stop on one.
ARCHIVES = 'refs/archive/'

def gate_refs(v):
    return ('refs/heads/' + v['BR'], 'refs/heads/' + v['FEATURE'], v['ARCHIVE'], 'refs/heads/main')

def protected_ref(v, ref):
    return ref in gate_refs(v) or ref.startswith(ARCHIVES)

def ref_digest(refs):
    """The count and sha256 of `object refname` lines in refname order."""
    text = ''.join('%s %s\n' % (refs[ref], ref) for ref in sorted(refs))
    return dict(count=len(refs), sha256=hashlib.sha256(text.encode()).hexdigest())

_other_refs = None

def other_ref_moves(v, other):
    """The unprotected refs that moved, appeared or went since the monitor's previous row (its first row:
    since the snapshot preparation stored), as {ref, before, after}; this process keeps the last set."""
    global _other_refs
    if _other_refs is None or _other_refs[0] != v['E']:
        stored = load(Path(v['E']) / 'protected-refs.json')
        _other_refs = (v['E'], {ref: value for ref, value in stored.items() if not protected_ref(v, ref)})
    before = _other_refs[1]
    _other_refs = (v['E'], other)
    return [dict(ref=ref, before=before.get(ref), after=other.get(ref))
            for ref in sorted(set(before) | set(other)) if before.get(ref) != other.get(ref)]

class ArchiveLedger:
    """The archives added during the attempt, each at the value its first row observed. From that row on an
    added archive is protected like one in the snapshot: a new value or its disappearance stops the gate. One
    ledger judges one attempt's rows in order, wherever they are judged: the live loop, a restarted monitor
    (which first replays the rows already written) and collection."""

    def __init__(self):
        self.first = {}

    def replay(self, v, s, d):
        """Feed this invocation's rows already in resource-progress.jsonl; returns their ref violations."""
        bad = []
        path = Path(v['E']) / 'resource-progress.jsonl'
        if path.exists():
            with path.open() as stream:
                for line in stream:
                    row = json.loads(line)
                    if row.get('invocationId') == s['invocationId'] and 'refs' in row:
                        bad += ref_violations(v, d, row, self)
        return bad

def ref_violations(v, d, row, ledger):
    """Each protected ref against the snapshot preparation stored: the gate's branch only at the prepared
    commit, the integration branch at the base or the landed commit, the reviewed archive at REVIEWED;
    main and every other archive in the snapshot unchanged. An archive the snapshot lacks is an addition:
    the ledger keeps its first observed value, which it must keep from then on. Rows that carry every ref
    (before 2026-11-07) are judged by the same rule."""
    stored = load(Path(v['E']) / 'protected-refs.json')
    allowed = {v['ARCHIVE']: [v['REVIEWED']], 'refs/heads/' + v['BR']: [d['SQUASHED']], 'refs/heads/' + v['FEATURE']: [v['BASE'], d['SQUASHED']]}
    bad = []
    for ref in sorted(set(stored) | set(row['refs']) | set(ledger.first)):
        if not protected_ref(v, ref):
            continue
        after = row['refs'].get(ref)
        if ref not in allowed and ref not in stored and ref not in ledger.first and ref.startswith(ARCHIVES):
            ledger.first[ref] = after
            continue
        before = stored[ref] if ref in stored else ledger.first.get(ref)
        if after not in allowed.get(ref, [before]):
            bad.append(dict(protectedRef=ref, before=before, after=after))
    return bad

def observe(v, s):
    row = dict(at=now(), invocationId=s['invocationId'] if s else None)
    pairs = [('slice', 'ep-heavy.slice')]
    if s:
        pairs.insert(0, ('unit', s['unit']))
    for key, unit in pairs:
        row[key] = observe_scope(unit)
    if s:
        p = Path(v['ORCH']) / 'bounded' / s['invocationId'] / 'memory'
        if p.exists():
            row['boundedSample'] = p.read_text()
        with landing_read(v):
            row['candidateStatus'] = git(v['WT'], 'status', '--porcelain')
            row['candidateHead'] = git(v['WT'], 'rev-parse', 'HEAD')
            row['candidateTree'] = git(v['WT'], 'rev-parse', 'HEAD^{tree}')
            row['integrationStatus'] = git(v['MAIN'], 'status', '--porcelain=v1', '--untracked-files=all')
            row['integrationHead'] = git(v['MAIN'], 'rev-parse', 'HEAD')
            row['integrationTree'] = git(v['MAIN'], 'rev-parse', 'HEAD^{tree}')
            refs = all_refs(v['MAIN'])
            row['refs'] = {ref: value for ref, value in refs.items() if protected_ref(v, ref)}
            other = {ref: value for ref, value in refs.items() if not protected_ref(v, ref)}
            row['otherRefs'] = ref_digest(other)
            moves = other_ref_moves(v, other)
            if moves:
                row['otherRefMoves'] = moves
            row['baseRef'] = git(v['MAIN'], 'rev-parse', v['BASE'])
            row['archiveSHA'] = git(v['WT'], 'rev-parse', v['ARCHIVE'])
    row['guard']=guard_observation(v)
    row['maintenance']=maintenance_reading(v['MAIN'],v['E'])
    if s is None:
        launch=launch_minimum_bytes(load(v['CONFIG']))
        require(row['guard']['hostAvailableBytes']>=launch,'Host below %d GiB launch threshold' % (launch//GiB))
        require(not guard_violations(row),'Prelaunch host/storage/Docker guard refused')
        off=maintenance_refusals(row['maintenance'])
        require(not off,'Prelaunch refused: automatic Git maintenance can run on MAIN\'s object store: '+'; '.join(off)+' (root: '+MAINTENANCE_FIX+')')
    with (Path(v['E']) / 'resource-progress.jsonl').open('a') as f:
        f.write(json.dumps(row) + '\n'); f.flush()
    return row

def violations(v, s, d, base, row, ledger):
    bad = guard_violations(row)
    cap = gate_memory_max_bytes(load(v['CONFIG']))
    keys = ('max', 'oom', 'oom_kill', 'oom_group_kill')
    for key in ('unit', 'slice'):
        r = row.get(key, {})
        if r.get('systemctlExit')!=0:bad.append(dict(systemdInstrumentationFailure=key))
        events = counters(r.get('memory.events', ''))
        start = counters(base['slice'].get('memory.events', '')) if key == 'slice' else {}
        if any(events.get(k, 0) - start.get(k, 0) > 0 for k in keys) or any(events.get(k,0)<start.get(k,0) for k in start):
            bad.append(dict(scope=key, events=events, baseline=start))
        if r.get('systemd',{}).get('ActiveState') in ('active','activating','deactivating') and 'memory.events' not in r \
                and not (key == 'unit' and terminal_exit(v, s, r)):
            bad.append(dict(observerMissingCounters=key))
        value = real(r)
        if value is not None and value >= (cap if key == 'unit' else SLICE_REAL_STOP_BYTES):
            bad.append(dict(scope=key, realBytes=value))
    sample = dict(x.split('=', 1) for x in row.get('boundedSample', '').splitlines() if '=' in x)
    if int(sample.get('real_peak', 0)) >= cap:
        bad.append(dict(realPeak=sample['real_peak']))
    if row.get('integrationStatus') or row.get('candidateStatus') or row['candidateHead'] != d['SQUASHED'] or row['integrationHead'] not in (v['BASE'], d['SQUASHED']) or row['candidateTree'] != v['TREE'] or row['archiveSHA'] != v['REVIEWED']:
        bad.append(dict(unexpectedIdentity=row))
    if row.get('integrationHead') == d['SQUASHED'] and row.get('integrationTree') != v['TREE']:
        bad.append(dict(integrationTree=row.get('integrationTree')))
    for scope, expected in [('slice',dict(MemoryMax=str(20*1024**3),MemoryHigh=str(18*1024**3),MemorySwapMax='0',CPUQuotaPerSecUSec='8s',TasksMax='2048')), ('unit',dict(MemoryMax=str(cap),MemoryHigh='infinity',MemorySwapMax='0',CPUQuotaPerSecUSec='6s',TasksMax='1024',CPUWeight='20',Nice='10',Restart='no',LimitCORE='0',TimeoutStopUSec='5min'))]:
        props=row.get(scope,{}).get('systemd',{})
        if props.get('ActiveState') in ('active','activating','deactivating'):
            wrong={k:dict(expected=x,actual=props.get(k)) for k,x in expected.items() if props.get(k)!=x}
            if wrong:
                bad.append(dict(scope=scope,capMismatch=wrong))
    bad += ref_violations(v, d, row, ledger)
    bad += [dict(automaticMaintenance=reason) for reason in maintenance_refusals(row.get('maintenance'))]
    # Capture result/status as well as memory recurrence; preserve canonical failure.
    if row.get('unit', {}).get('systemd', {}).get('Result') in ('oom-kill', 'signal', 'core-dump', 'resources'):
        bad.append(dict(unitResult=row['unit']['systemd']))
    return bad

def integrity_binding(v):
    return {k:v[k] for k in ('BUNDLE','E','LABEL','WT','REVIEWED','TREE','BASE')}

def run_integrity_checks(v):
    """The same complete integrity chain, off the observation path."""
    phases=[]
    for name,check in [('preflight',lambda:preflight('monitor',values=v)),
                       ('authorization',lambda:__import__('gate_core').authorization(v)),
                       ('control',lambda:execution_control(v,step='observe')),
                       ('snapshot',lambda:snapshot(v))]:
        started=time.monotonic();cpu=time.process_time()
        try:check()
        except Exception as exc:
            return dict(passed=False,binding=integrity_binding(v),phase=name,error=str(exc),phases=phases)
        phases.append(dict(phase=name,wallSeconds=time.monotonic()-started,cpuSeconds=time.process_time()-cpu))
    return dict(passed=True,binding=integrity_binding(v),phases=phases)

def start_integrity(v):
    # One process, in the caller's bounded cgroup/reservation. Its own group
    # lets shutdown reap an outstanding Git subprocess as well as Python.
    return subprocess.Popen([sys.executable,'-B',str(Path(__file__).resolve()),'--integrity-worker'],
                            stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)

def integrity_output(process,timeout=None):
    """Collect the process pipes once, including when cleanup follows a read."""
    if not hasattr(process,'_integrity_output'):
        process._integrity_output=process.communicate(timeout=timeout)
    return process._integrity_output

def read_integrity(process,v):
    output,_=integrity_output(process,timeout=4)
    try:result=json.loads(output)
    except (ValueError,TypeError):raise RuntimeError('Integrity worker returned no valid result')
    require(result.get('binding')==integrity_binding(v),'Integrity worker binding changed')
    require(process.returncode==0 and result.get('passed') is True,'Integrity worker failed: '+str(result.get('error','unknown')))
    return result

def stop_integrity(process):
    if process is None or getattr(process,'_integrity_closed',False):return
    # Even a completed parent may have left members of its owned group.
    try:os.killpg(process.pid,signal.SIGTERM)
    except ProcessLookupError:pass
    try:integrity_output(process,timeout=5)
    except subprocess.TimeoutExpired:
        try:os.killpg(process.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        integrity_output(process,timeout=5)
    process._integrity_closed=True

def run_monitor_loop(v,s,d,base,launch_integrity=start_integrity):
    """Observe continuously while one full check runs; never accept a partial check."""
    e=Path(v['E'])
    require('memory.events' in base['slice'], 'Missing slice baseline; stop for parent inspection')
    run = Path(v['ORCH']) / 'bounded' / s['invocationId']
    window_end=time.monotonic()+10800
    process=None;stage='periodic';terminal_seen=False;terminal_verified=False;stopped=False;passes=0
    try:
        # A restarted monitor first replays the rows already written, so archives added before it keep their values.
        ledger=ArchiveLedger();pending=ledger.replay(v,s,d)
        process=launch_integrity(v)
        for tick in range(10800):
            if time.monotonic()>=window_end:break
            row=observe(v,s);bad=pending+violations(v,s,d,base,row,ledger);pending=[]
            terminal_seen=terminal_seen or (run/'receipt.json').exists()
            if process is not None and process.poll() is not None:
                try:
                    result=read_integrity(process,v);passes+=1
                    with (e/'integrity-progress.jsonl').open('a') as f:
                        f.write(json.dumps(dict(at=now(),stage=stage,**result))+'\n');f.flush()
                    terminal_verified=stage=='terminal'
                except Exception as exc:bad.append(dict(inputMismatch=str(exc)))
                finally:stop_integrity(process);process=None
            if bad and not stopped:
                save(e/'stop-reason.json',dict(at=now(),violations=bad,invocation=s));stopped=True
                stop_unit(s['unit'])
                stop_integrity(process);process=None
            if terminal_seen and (stopped or terminal_verified):
                require(stopped or passes>0,'No completed integrity proof')
                print((run/'receipt.json').read_text(),flush=True)
                return
            if process is None and not stopped:
                stage='terminal' if terminal_seen else 'periodic'
                process=launch_integrity(v)
            if row.get('unit',{}).get('systemd',{}).get('ActiveState') in ('inactive','failed','') and not terminal_seen:
                raise RuntimeError('No canonical receipt and unit unavailable; inspect same ID; NO RETRY')
            if tick%50==0:
                print(json.dumps(dict(at=row['at'],invocationId=s['invocationId'],integrityStage=stage,integrityPending=process is not None,integrityPasses=passes,stopped=stopped)),flush=True)
            time.sleep(1)
        raise RuntimeError('Monitoring window ended; preserve same ID; NO RETRY')
    except BaseException as exc:
        if not (e/'observer-failure.json').exists():
            save(e/'observer-failure.json',dict(at=now(),error=str(exc),invocation=s))
        if not (run/'receipt.json').exists():stop_unit(s['unit'])
        raise
    finally:stop_integrity(process)

def main():
    v=env();e=Path(v['E'])
    if (e/'stop-reason.json').exists():raise StoppedEvidence('Stopped evidence cannot be monitored again')
    s=submission(v)  # Validates the durable invocation and exact-tree mapping once.
    d=mapping(v)
    run_monitor_loop(v,s,d,load(e/'resource-baseline.json'))

if __name__ == '__main__':
    if sys.argv[1:]==['--integrity-worker']:
        signal.signal(signal.SIGTERM,lambda *_:sys.exit(143))
        try:result=run_integrity_checks(env())
        except Exception as exc:result=dict(passed=False,error=str(exc))
        print(json.dumps(result),flush=True);sys.exit(0 if result.get('passed') is True else 1)
    try:
        main()
    except StoppedEvidence as exc:
        print(str(exc),file=sys.stderr);sys.exit(64)
    except Exception as exc:
        v = env(); e = Path(v['E']); s = submission(v)
        if not (e/'observer-failure.json').exists():
            save(e/'observer-failure.json', dict(at=now(), error=str(exc), invocation=s))
        if not (Path(v['ORCH'])/'bounded'/s['invocationId']/'receipt.json').exists():
            stop_unit(s['unit'])
        raise
