#!/usr/bin/env python3
"""The suite shard weights (tests/shard-weights.json) from one green sharded gate run's evidence.

tests/shard-plan.ts deals the suite's test files over `--shard=i/N` by these weights (speed-ci-shards
fix r1): Vitest's own sharding splits by file count, and run 42222977832 ran its eight count-equal shards
in 405 to 1050 s. The input is a fetched ORCH/remote-checks/<runId>/ directory (remote-fetch.sh) whose
manifest the gate verified; each shard's own JSON report gives every test file's duration
(endTime - startTime). The output stores only the files at or above THRESHOLD seconds (the rest are
the default weight, their median), so it stays small and changes only when a heavy file moves:

    fileOverheadSeconds  the per-file worker time durations leave out (import, transform, environment),
                         from the run: 2 x (shard elapsed - shard durations / 2) / files, the mean over shards
    defaultSeconds       the median duration of the files below THRESHOLD
    browserFiles         the files that launch Chromium (shard 1 alone runs them; ci.yaml installs it there)
    seconds              {file: duration} at or above THRESHOLD, one decimal

python3 -B shard_weights.py RUN_DIR > tests/shard-weights.json
"""
import json
from pathlib import Path
import statistics
import sys

KIND = 'shard-weights-v1'
THRESHOLD = 5.0
WORKERS = 2  # VITEST_MAX_WORKERS (remote_checks.ENVIRONMENT)
BROWSER_FILES = ('e2e/support/control-geometry.test.ts',)


def durations(directory):
    """(file, seconds) for every test file of the run's shard reports, and the per-file overhead estimate."""
    manifest = json.loads((directory / 'manifest.json').read_text())
    root = manifest['source']['root'] + '/'
    files, overheads = {}, []
    for row in manifest['shards']:
        report = json.loads((directory / row['report']['file']).read_text())
        seconds = {item['name'][len(root):]: (item['endTime'] - item['startTime']) / 1000 for item in report['testResults']}
        files.update(seconds)
        overheads.append(WORKERS * (row['elapsedSeconds'] - sum(seconds.values()) / WORKERS) / len(seconds))
    return files, statistics.mean(overheads), manifest['runner'].get('runId')


def weights(directory):
    files, overhead, run = durations(Path(directory))
    light = [value for value in files.values() if value < THRESHOLD]
    return dict(kind=KIND, source='gate run %s (%s): each shard report\'s per-file durations' % (run, Path(directory).name),
                fileOverheadSeconds=round(overhead, 1), defaultSeconds=round(statistics.median(light), 1),
                browserFiles=list(BROWSER_FILES),
                seconds={name: round(value, 1) for name, value in sorted(files.items()) if value >= THRESHOLD})


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: shard_weights.py RUN_DIR')
    print(json.dumps(weights(sys.argv[1]), indent=2))
