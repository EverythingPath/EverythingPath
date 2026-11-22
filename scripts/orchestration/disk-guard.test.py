"""Disk floor fixtures (disk_guard.py; owner decision 2026-11-08, disk-guard).

Every probe reads a fixture /sys tree and mountinfo and a fixed statvfs, so no test depends on this host's disk.
The metadata-full numbers are the 2026-11-08 incident's (mvp-20261023/incident-20261108-btrfs-metadata-enospc.md):
metadata 6.04 GiB allocated, 5.39 GiB used, a 0.5 GiB GlobalReserve and no unallocated device space.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import disk_guard  # noqa: E402

GiB = 1 << 30
FSID = '9ce0f286-843c-4cb9-9dcc-663b9fa76d18'


class Statvfs:
    def __init__(self, free):
        self.f_bavail, self.f_frsize = free // 4096, 4096


class Fixture(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name)
        self.sysfs, self.mountinfo = self.root / 'sys', self.root / 'mountinfo'
        self.sysfs.mkdir()

    def mounts(self, *rows):
        """mountinfo rows (mount point, maj:min, fstype, source), in /proc/self/mountinfo's format."""
        self.mountinfo.write_text(''.join('%d 1 %s / %s rw,relatime shared:1 - %s %s rw\n' % (index + 20, majmin, point, fstype, source)
                                          for index, (point, majmin, fstype, source) in enumerate(rows)))

    def btrfs(self, metadata_total, metadata_used, unallocated, reserve=0.5, data_total=440.0, device='fixture0'):
        """A btrfs sysfs tree: DUP metadata (twice its total on disk), single data, a 32 MiB DUP system chunk and a
        device whose size leaves `unallocated` GiB outside every chunk."""
        fs = self.sysfs / 'fs/btrfs' / FSID
        chunks = dict(data=(int(data_total * GiB), int(data_total * GiB)), metadata=(int(metadata_total * GiB), int(2 * metadata_total * GiB)),
                      system=(32 << 20, 64 << 20))
        used = dict(data=int(data_total * GiB) - GiB, metadata=int(metadata_used * GiB), system=1 << 16)
        for kind, (total, disk_total) in chunks.items():
            (fs / 'allocation' / kind).mkdir(parents=True)
            for name, value in (('total_bytes', total), ('bytes_used', used[kind]), ('disk_total', disk_total)):
                (fs / 'allocation' / kind / name).write_text('%d\n' % value)
        (fs / 'allocation/global_rsv_size').write_text('%d\n' % int(reserve * GiB))
        (fs / 'devices' / device).mkdir(parents=True)
        size = sum(disk_total for _, disk_total in chunks.values()) + int(unallocated * GiB)
        (fs / 'devices' / device / 'size').write_text('%d\n' % -(-size // 512))
        return fs

    def reading(self, free, paths=('/home/andreas/repos/everythingpath/ep-orch',)):
        return disk_guard.reading(list(paths), sysfs=self.sysfs, mountinfo=self.mountinfo, statvfs=lambda path: Statvfs(int(free * GiB)))


class FloorTest(Fixture):
    def test_the_floors_are_the_owner_decision(self):
        self.assertEqual((disk_guard.DATA_FLOOR, disk_guard.METADATA_FLOOR, disk_guard.UNALLOCATED_FLOOR), (15 * GiB, GiB, 2 * GiB))

    def test_a_healthy_btrfs_volume_passes_with_its_values(self):
        self.mounts(('/home/andreas/repos', '0:46', 'btrfs', '/dev/fixture0'))
        self.btrfs(metadata_total=7.0, metadata_used=3.5, unallocated=90)
        result = self.reading(100)
        self.assertEqual((result['blockers'], result['unavailable']), ([], []))
        volume, = result['volumes']
        self.assertEqual((volume['mount'], volume['fstype'], volume['dataFreeBytes']), ('/home/andreas/repos', 'btrfs', 100 * GiB))
        self.assertEqual((volume['btrfs']['fsid'], volume['btrfs']['metadataHeadroomBytes'], volume['btrfs']['unallocatedBytes']),
                         (FSID, 3 * GiB, 90 * GiB))

    def test_full_metadata_with_nothing_unallocated_blocks_although_data_is_free(self):
        """The incident: df showed free space while metadata had only its reserve left and could not grow."""
        self.mounts(('/home/andreas/repos', '0:46', 'btrfs', '/dev/fixture0'))
        self.btrfs(metadata_total=6.04, metadata_used=5.39, unallocated=0)
        self.assertEqual(self.reading(20)['blockers'],
                         ['/home/andreas/repos: btrfs metadata headroom 0.15 GiB < 1.00 GiB and unallocated 0.00 GiB < 2.00 GiB'])
        self.assertEqual(self.reading(11)['blockers'],
                         ['/home/andreas/repos: free data 11.00 GiB < 15.00 GiB; '
                          'btrfs metadata headroom 0.15 GiB < 1.00 GiB and unallocated 0.00 GiB < 2.00 GiB'])

    def test_unallocated_space_lets_metadata_grow(self):
        self.mounts(('/home/andreas/repos', '0:46', 'btrfs', '/dev/fixture0'))
        self.btrfs(metadata_total=6.04, metadata_used=5.39, unallocated=8)
        self.assertEqual(self.reading(20)['blockers'], [])
        shutil.rmtree(self.sysfs / 'fs')
        self.btrfs(metadata_total=6.04, metadata_used=5.39, unallocated=1.9)
        self.assertEqual(self.reading(20)['blockers'],
                         ['/home/andreas/repos: btrfs metadata headroom 0.15 GiB < 1.00 GiB and unallocated 1.90 GiB < 2.00 GiB'])

    def test_a_non_btrfs_volume_has_only_the_data_floor(self):
        self.mounts(('/', '259:2', 'ext4', '/dev/fixture1'))
        result = self.reading(20)
        self.assertEqual((result['blockers'], result['unavailable'], result['volumes'][0]['btrfs']), ([], [], None))
        self.assertEqual(self.reading(14.5)['blockers'], ['/: free data 14.50 GiB < 15.00 GiB'])

    def test_the_longest_mount_holds_the_path_and_each_volume_counts_once(self):
        """ep-orch and a ~/.t3 worktree are two subvolumes of one btrfs device: one volume, read once."""
        self.mounts(('/', '259:2', 'ext4', '/dev/fixture1'), ('/home/andreas/repos', '0:46', 'btrfs', '/dev/fixture0'),
                    ('/home/andreas/.t3', '0:46', 'btrfs', '/dev/fixture0'))
        self.btrfs(metadata_total=7.0, metadata_used=3.5, unallocated=90)
        result = self.reading(100, paths=('/home/andreas/repos/everythingpath/ep-orch', '/home/andreas/.t3/worktrees/everythingpath/t3-x'))
        self.assertEqual([volume['mount'] for volume in result['volumes']], ['/home/andreas/repos'])
        self.assertEqual([volume['mount'] for volume in self.reading(100, paths=('/home/andreas-other',))['volumes']], ['/'])


class UnavailableTest(Fixture):
    """A part that cannot be read is unavailable with its reason and is never judged; the parts read still are."""

    def test_a_btrfs_volume_without_its_sysfs_tree_is_unavailable_and_does_not_block(self):
        self.mounts(('/home/andreas/repos', '0:46', 'btrfs', '/dev/fixture0'))
        result = self.reading(20)
        self.assertEqual(result['blockers'], [])
        self.assertEqual(result['unavailable'], ['/home/andreas/repos: btrfs allocation: no %s/fs/btrfs/*/devices/fixture0' % self.sysfs])
        self.assertEqual(self.reading(11)['blockers'], ['/home/andreas/repos: free data 11.00 GiB < 15.00 GiB'], 'free data is still judged')

    def test_a_missing_reserve_file_leaves_metadata_unjudged(self):
        self.mounts(('/home/andreas/repos', '0:46', 'btrfs', '/dev/fixture0'))
        fs = self.btrfs(metadata_total=6.04, metadata_used=5.39, unallocated=0)
        (fs / 'allocation/global_rsv_size').unlink()
        result = self.reading(20)
        self.assertEqual(result['blockers'], [])
        self.assertEqual(len(result['unavailable']), 1)
        self.assertRegex(result['unavailable'][0], r'^/home/andreas/repos: btrfs allocation: .*global_rsv_size')

    def test_unreadable_mountinfo_and_statvfs_are_unavailable(self):
        result = disk_guard.reading(['/x'], sysfs=self.sysfs, mountinfo=self.root / 'no-mountinfo', statvfs=lambda path: Statvfs(100 * GiB))
        self.assertEqual(result['blockers'], [])
        self.assertRegex(result['unavailable'][0], r'^/x: mount: .*no-mountinfo')
        self.mounts(('/', '259:2', 'ext4', '/dev/fixture1'))
        def broken(path):
            raise OSError(5, 'Input/output error')
        result = disk_guard.reading(['/x'], sysfs=self.sysfs, mountinfo=self.mountinfo, statvfs=broken)
        self.assertEqual((result['blockers'], result['unavailable']), ([], ['/: free data: [Errno 5] Input/output error']))


class CommandTest(Fixture):
    """`disk_guard.py check` for admission.sh and `show` for reports, with the tests-only DISK_GUARD_* overrides."""

    def command(self, *argv, free):
        env = {**os.environ, 'DISK_GUARD_SYSFS': str(self.sysfs), 'DISK_GUARD_MOUNTINFO': str(self.mountinfo),
               'DISK_GUARD_FREE_BYTES': str(int(free * GiB))}
        return subprocess.run([sys.executable, '-B', str(HERE / 'disk_guard.py'), *argv], env=env, capture_output=True, text=True)

    def test_check_refuses_below_a_floor_with_74_and_names_it(self):
        self.mounts(('/home/andreas/repos', '0:46', 'btrfs', '/dev/fixture0'))
        self.btrfs(metadata_total=6.04, metadata_used=5.39, unallocated=0)
        done = self.command('check', '/home/andreas/repos/everythingpath/ep-orch', free=20)
        self.assertEqual((done.returncode, done.stdout), (74, ''))
        self.assertEqual(done.stderr, 'disk floor: /home/andreas/repos: btrfs metadata headroom 0.15 GiB < 1.00 GiB and unallocated 0.00 GiB '
                                      '< 2.00 GiB (floors: free data 15 GiB; metadata headroom 1 GiB unless 2 GiB unallocated)\n')

    def test_check_passes_quietly_or_with_a_warning_when_unavailable(self):
        self.mounts(('/', '259:2', 'ext4', '/dev/fixture1'))
        done = self.command('check', '/x', free=20)
        self.assertEqual((done.returncode, done.stdout, done.stderr), (0, '', ''))
        self.mounts(('/', '0:46', 'btrfs', '/dev/fixture0'))
        done = self.command('check', '/x', free=20)
        self.assertEqual((done.returncode, done.stdout), (0, ''))
        self.assertEqual(done.stderr, 'disk floor: warning: probe unavailable (/: btrfs allocation: no %s/fs/btrfs/*/devices/fixture0); '
                                      'not checked\n' % self.sysfs)

    def test_show_prints_the_reading(self):
        self.mounts(('/', '259:2', 'ext4', '/dev/fixture1'))
        done = self.command('show', '/x', free=20)
        self.assertEqual(done.returncode, 0)
        self.assertEqual(json.loads(done.stdout)['volumes'][0]['dataFreeBytes'], 20 * GiB)

    def test_a_usage_error_is_64(self):
        self.assertEqual(self.command('check', free=20).returncode, 64)


if __name__ == '__main__':
    unittest.main()
