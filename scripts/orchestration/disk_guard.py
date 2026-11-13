#!/usr/bin/env python3
"""Disk floor for heavy commands and gates (owner decision 2026-11-08, disk-guard).

  python3 -B scripts/orchestration/disk_guard.py check PATH...   0 when every volume holding a PATH is above its
                                                                 floors (a warning on stderr for a part it could
                                                                 not read), 74 with the floor and values when one
                                                                 is below; 64 on a usage error (admission.sh)
  python3 -B scripts/orchestration/disk_guard.py show PATH...    the reading as JSON, for reports

On 2026-11-08 `df` showed 11 GiB free while btrfs metadata was full (incident-20261108-btrfs-metadata-enospc.md):
data chunks had taken the whole device, metadata had only its GlobalReserve left and writes failed with ENOSPC. So
on btrfs the probe reads the metadata headroom and the unallocated device space too, read-only from sysfs:
- **free data:** statvfs's f_bavail;
- **metadata headroom:** allocation/metadata total_bytes - bytes_used - allocation/global_rsv_size;
- **unallocated:** the sizes of devices/* less every chunk type's disk_total (raw bytes, so DUP metadata counts twice).
The btrfs tree is /sys/fs/btrfs/<fsid>, the one whose devices/ names the mount's source device (/proc/self/mountinfo).
A part that cannot be read is unavailable with its reason: it is never judged and so never blocks, and the
parts that were read still are. Volumes are counted once by their mountinfo device number.
Tests only: DISK_GUARD_SYSFS (another /sys), DISK_GUARD_MOUNTINFO (another mountinfo) and DISK_GUARD_FREE_BYTES
(the free data statvfs would report, or @<file> holding it, read at each probe).
Exit 74 (sysexits EX_IOERR): 75 already means a provider usage limit for worker runs and a busy WIP slot.
"""
import glob
import json
import os
from pathlib import Path
import sys

GiB = 1 << 30
# The floors (owner decision 2026-11-08, item 3; mvp-20261023/disk-guard-authorization.md): free data at least
# 15 GiB; btrfs metadata headroom at least 1 GiB unless at least 2 GiB is unallocated, since metadata grows into it.
DATA_FLOOR, METADATA_FLOOR, UNALLOCATED_FLOOR = 15 * GiB, GiB, 2 * GiB
FLOORS = 'floors: free data %d GiB; metadata headroom %d GiB unless %d GiB unallocated' % (
    DATA_FLOOR // GiB, METADATA_FLOOR // GiB, UNALLOCATED_FLOOR // GiB)


def unescape(field):
    """A mountinfo path field: spaces, tabs, newlines and backslashes are octal escapes there."""
    for code, char in (('\\040', ' '), ('\\011', '\t'), ('\\012', '\n'), ('\\134', '\\')):
        field = field.replace(code, char)
    return field


def mount_of(path, mountinfo):
    """The mount holding PATH: (mount point, maj:min, fstype, source), the longest mount point above it."""
    target, best = os.path.realpath(path), None
    for line in Path(mountinfo).read_text().splitlines():
        fields = line.split()
        if ' - ' not in line or len(fields) < 5:
            continue
        after = line.split(' - ', 1)[1].split()
        point = unescape(fields[4])
        inside = target == point or target.startswith(point.rstrip('/') + '/')
        if inside and len(after) >= 2 and (best is None or len(point) >= len(best[0])):
            best = (point, fields[2], after[0], unescape(after[1]))
    if best is None:
        raise OSError('no mount in %s holds %s' % (mountinfo, target))
    return best


def number(path):
    return int(Path(path).read_text().strip())


def btrfs_allocation(source, sysfs):
    """The btrfs reading of the filesystem on device SOURCE, from <sysfs>/fs/btrfs/<fsid>."""
    device = os.path.basename(os.path.realpath(source))
    trees = sorted(glob.glob(os.path.join(glob.escape(str(sysfs)), 'fs/btrfs/*/devices', glob.escape(device))))
    if not trees:
        raise OSError('no %s/fs/btrfs/*/devices/%s' % (sysfs, device))
    fs = Path(trees[0]).parent.parent
    allocation = fs / 'allocation'
    total, used, reserve = (number(allocation / name) for name in ('metadata/total_bytes', 'metadata/bytes_used', 'global_rsv_size'))
    kinds = [kind for kind in sorted(allocation.iterdir()) if kind.is_dir()]
    if not kinds:
        raise OSError('no chunk types in %s' % allocation)
    allocated = sum(number(kind / 'disk_total') for kind in kinds)
    devices = sum(number(entry / 'size') * 512 for entry in sorted((fs / 'devices').iterdir()))
    return dict(fsid=fs.name, metadataTotalBytes=total, metadataUsedBytes=used, globalReserveBytes=reserve,
                metadataHeadroomBytes=total - used - reserve, deviceBytes=devices, allocatedBytes=allocated,
                unallocatedBytes=devices - allocated)


def probe(path, sysfs, mountinfo, statvfs):
    """One path's volume: its mount, free data and on btrfs its allocation; each unreadable part is a reason in
    `unavailable`. `key` is the mount's device number (the path itself when no mount could be read)."""
    volume = dict(path=str(path), key=str(path), mount=str(path), fstype=None, dataFreeBytes=None, btrfs=None, unavailable=[])
    try:
        volume['mount'], volume['key'], volume['fstype'], source = mount_of(path, mountinfo)
    except (OSError, ValueError) as exc:
        volume['unavailable'].append('mount: %s' % exc)
        source = None
    try:
        stat = statvfs(path)
        volume['dataFreeBytes'] = stat.f_bavail * stat.f_frsize
    except (OSError, ValueError) as exc:
        volume['unavailable'].append('free data: %s' % exc)
    if volume['fstype'] == 'btrfs':
        try:
            volume['btrfs'] = btrfs_allocation(source, sysfs)
        except (OSError, ValueError) as exc:
            volume['unavailable'].append('btrfs allocation: %s' % exc)
    return volume


def below(volume):
    """What of VOLUME is below its floors, each as text with its values; empty when nothing is."""
    found, gib = [], lambda value: '%.2f GiB' % (value / GiB)
    if volume['dataFreeBytes'] is not None and volume['dataFreeBytes'] < DATA_FLOOR:
        found.append('free data %s < %s' % (gib(volume['dataFreeBytes']), gib(DATA_FLOOR)))
    fs = volume['btrfs']
    if fs and fs['metadataHeadroomBytes'] < METADATA_FLOOR and fs['unallocatedBytes'] < UNALLOCATED_FLOOR:
        found.append('btrfs metadata headroom %s < %s and unallocated %s < %s' % (
            gib(fs['metadataHeadroomBytes']), gib(METADATA_FLOOR), gib(fs['unallocatedBytes']), gib(UNALLOCATED_FLOOR)))
    return found


class FixedFree:
    def __init__(self, free):
        self.f_bavail, self.f_frsize = free, 1


def fixed_statvfs(fixed):
    """The tests-only DISK_GUARD_FREE_BYTES as a statvfs: a number, or @<file> holding one, read at each call."""
    if fixed.startswith('@'):
        return lambda path: FixedFree(int(Path(fixed[1:]).read_text()))
    return lambda path: FixedFree(int(fixed))


def reading(paths, sysfs=None, mountinfo=None, statvfs=None):
    """The volumes holding PATHS, each once, with `blockers` (one line per volume below a floor) and `unavailable`
    (one line per part that could not be read). Defaults: /sys, /proc/self/mountinfo and os.statvfs, unless the
    tests-only DISK_GUARD_* variables name others."""
    sysfs = sysfs or os.environ.get('DISK_GUARD_SYSFS') or '/sys'
    mountinfo = mountinfo or os.environ.get('DISK_GUARD_MOUNTINFO') or '/proc/self/mountinfo'
    statvfs = statvfs or default_statvfs()
    return summarize(distinct_volumes(paths, sysfs, mountinfo, statvfs))


def default_statvfs():
    """os.statvfs, unless the tests-only DISK_GUARD_FREE_BYTES names the free data."""
    fixed = os.environ.get('DISK_GUARD_FREE_BYTES')
    return fixed_statvfs(fixed) if fixed else os.statvfs


def distinct_volumes(paths, sysfs, mountinfo, statvfs):
    """Every path's volume, probed in order and kept once per device number (the first path's)."""
    volumes = {}
    for path in paths:
        volume = probe(path, sysfs, mountinfo, statvfs)
        volumes.setdefault(volume['key'], volume)
    return list(volumes.values())


def summarize(volumes):
    """The reading: the volumes, one blocker line per volume below a floor and one line per unreadable part."""
    return dict(volumes=volumes, blockers=['%s: %s' % (v['mount'], '; '.join(below(v))) for v in volumes if below(v)],
                unavailable=['%s: %s' % (v['mount'], reason) for v in volumes for reason in v['unavailable']])


def main(argv):
    if len(argv) < 2 or argv[0] not in ('check', 'show'):
        print(__doc__.split('\n\n')[0], file=sys.stderr)
        return 64
    result = reading(argv[1:])
    if argv[0] == 'show':
        print(json.dumps(result, indent=2))
        return 0
    if result['unavailable']:
        print('disk floor: warning: probe unavailable (%s); not checked' % '; '.join(result['unavailable']), file=sys.stderr)
    if result['blockers']:
        print('disk floor: %s (%s)' % ('; '.join(result['blockers']), FLOORS), file=sys.stderr)
        return 74
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
