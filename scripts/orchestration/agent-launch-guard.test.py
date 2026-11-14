"""agent_launch_guard.py fixtures, then the guard over this repository.

Fixture launches are inert text tracked in temporary Git repositories: nothing here runs one. This
file is listed whole in the guard's ALLOWED_FILES, so it may name the binaries; the review reports'
examples below are quoted verbatim."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import agent_launch_guard as guard  # noqa: E402
import light_lane  # noqa: E402

CX, CL, GM, OC, CA, AI = guard.AGENTS
SH = '#!/usr/bin/env bash\n'

# Headless invocations of every agent binary: (binary, arguments).
INVOCATIONS = [
    (CX, ['exec', '-m', 'model', 'fix it']), (CX, ['e', 'fix it']), (CX, ['resume', '--last']),
    (CX, ['-m', 'model', 'fix it']), (CX, ['--config', 'model=x', 'fix it']),
    (CL, ['-p', 'fix it']), (CL, ['--print', 'fix it']), (CL, ['--model', 'opus', '--print', 'fix it']),
    (CL, ['--resume', 'abc']), (CL, ['-c']),
    (GM, ['-p', 'fix it']), (GM, ['--model', 'x', '--prompt', 'fix it']),
    (OC, ['run', 'fix it']), (CA, ['-p', 'fix it']), (AI, ['--message', 'fix it']),
]


def sh_args(args):
    return ' '.join("'%s'" % a if ' ' in a else a for a in args)


def js_items(args, quote="'"):
    return ', '.join(quote + a + quote for a in args)


def py_lines(args, indent):
    return ''.join('%s"%s",\n' % (indent, a) for a in args)


# Every shape a launch takes in ordinary code: name -> (path, mode, content) for (binary, arguments).
# The r2 shapes are the ordinary forms both round-2 reviews named; the rule needs no shape of its own.
SHAPES = {
    'shell line': lambda b, a: ('run.sh', '100644', SH + '%s %s\n' % (b, sh_args(a))),
    'absolute path': lambda b, a: ('run.sh', '100644', SH + '/usr/local/bin/%s %s < /dev/null\n' % (b, sh_args(a))),
    'relative path': lambda b, a: ('run.sh', '100644', SH + './node_modules/.bin/%s %s\n' % (b, sh_args(a))),
    'continuation': lambda b, a: ('run.sh', '100644', SH + '%s \\\n  %s \\\n  >> log\n' % (b, ' \\\n  '.join(sh_args([x]) for x in a))),
    'substitution': lambda b, a: ('run.sh', '100644', SH + 'out=$(%s %s)\n' % (b, sh_args(a))),
    'prefixed': lambda b, a: ('run.sh', '100644', SH + '(cd "$wt" && setsid env CI=1 %s %s &)\n' % (b, sh_args(a))),
    'r2 quoted absolute path': lambda b, a: ('run.sh', '100644', SH + '"/usr/local/bin/%s" %s\n' % (b, sh_args(a))),
    'r2 quoted binary': lambda b, a: ('run.sh', '100644', SH + "'%s' %s\n" % (b, sh_args(a))),
    'r2 quoted arguments': lambda b, a: ('run.sh', '100644', SH + '%s %s\n' % (b, ' '.join('"%s"' % x for x in a))),
    'zsh': lambda b, a: ('run.zsh', '100644', '%s %s\n' % (b, sh_args(a))),
    'Makefile recipe': lambda b, a: ('Makefile', '100644', 'review:\n\t%s %s\n' % (b, sh_args(a))),
    'make include': lambda b, a: ('rules.mk', '100644', 'review:\n\t@%s %s\n' % (b, sh_args(a))),
    'make, errors ignored': lambda b, a: ('Makefile', '100644', 'review:\n\t-%s %s\n' % (b, sh_args(a))),
    'r2 Makefile quoted path': lambda b, a: ('Makefile', '100644', 'review:\n\t"/usr/bin/%s" %s\n' % (b, sh_args(a))),
    'executable, no shebang': lambda b, a: ('scripts/worker', '100755', '%s %s\n' % (b, sh_args(a))),
    'shebang, no exec bit': lambda b, a: ('bin/worker', '100644', SH + 'exec %s %s\n' % (b, sh_args(a))),
    'husky hook': lambda b, a: ('.husky/pre-commit', '100644', '%s %s\n' % (b, sh_args(a))),
    'package script': lambda b, a: ('package.json', '100644', '{\n  "scripts": {\n    "x": "%s %s"\n  }\n}\n' % (b, ' '.join(a))),
    'workflow step': lambda b, a: ('.github/workflows/x.yml', '100644', 'jobs:\n  x:\n    steps:\n      - run: %s %s\n' % (b, sh_args(a))),
    'r2 workflow folded scalar': lambda b, a: ('.github/workflows/x.yml', '100644',
                                               'jobs:\n  x:\n    steps:\n      - run: >-\n          %s\n          %s\n' % (b, sh_args(a))),
    'r2 workflow quoted step': lambda b, a: ('.github/workflows/x.yaml', '100644', "steps:\n  - run: '\"%s\" %s'\n" % (b, ' '.join(a))),
    'Node spawn': lambda b, a: ('s.ts', '100644', "spawn('%s', [%s]);\n" % (b, js_items(a))),
    'Node spawn, multiline': lambda b, a: ('s.ts', '100644', "const child = spawn(\n  '%s',\n  [\n%s  ],\n  { stdio: 'inherit' },\n);\n"
                                           % (b, ''.join("    '%s',\n" % x for x in a))),
    'r2 Node comment before the program': lambda b, a: ('s.ts', '100644', "spawn(/* worker */ '%s', [%s]);\n" % (b, js_items(a))),
    'r2 Node line comment, multiline': lambda b, a: ('s.mts', '100644', "spawn(\n  // Review\n  '%s', [%s]\n);\n" % (b, js_items(a))),
    'Node execFileSync, multiline': lambda b, a: ('s.mjs', '100644', 'execFileSync(\n  "%s",\n  [%s]\n);\n' % (b, js_items(a, '"'))),
    'execa, backtick': lambda b, a: ('s.mts', '100644', 'await execa(\n  `%s`,\n  [%s],\n);\n' % (b, js_items(a))),
    'Node execSync string': lambda b, a: ('s.cjs', '100644', "execSync('%s %s');\n" % (b, ' '.join(a))),
    'Python shell string': lambda b, a: ('s.py', '100644', 'subprocess.run(\n    "%s %s",\n    shell=True,\n)\n' % (b, ' '.join(a))),
    'os.system': lambda b, a: ('s.py', '100644', "os.system('%s %s')\n" % (b, ' '.join(a))),
    'Node absolute binary': lambda b, a: ('s.js', '100644', "spawnSync('/usr/local/bin/%s', [%s]);\n" % (b, js_items(a))),
    'Node program constant': lambda b, a: ('s.cjs', '100644', "const BIN = '%s';\nexecFileSync(BIN, [%s]);\n" % (b, js_items(a))),
    'Python run, multiline': lambda b, a: ('s.py', '100644', 'subprocess.run(\n    [\n%s    ],\n    check=True,\n)\n' % py_lines([b] + a, '        ')),
    'Python Popen': lambda b, a: ('s.py', '100644', "subprocess.Popen(['%s', %s])\n" % (b, js_items(a))),
    'r2 Python args keyword': lambda b, a: ('s.py', '100644', 'subprocess.run(args=["%s", %s], check=True)\n' % (b, js_items(a, '"'))),
    'r2 Python Popen args keyword': lambda b, a: ('s.py', '100644', 'subprocess.Popen(args=["%s", %s])\n' % (b, js_items(a, '"'))),
    'r2 Python comment, multiline': lambda b, a: ('s.py', '100644', 'subprocess.run(\n    # worker\n    ["%s", %s]\n)\n' % (b, js_items(a, '"'))),
    'Python check_output, multiline': lambda b, a: ('s.py', '100644', 'out = subprocess.check_output(\n    [\n        "%s", %s\n    ]\n)\n' % (b, js_items(a, '"'))),
    'Python program variable': lambda b, a: ('s.py', '100644', "program = '%s'\nsubprocess.call([program, %s])\n" % (b, js_items(a))),
    # Round 3: the program anywhere in a command string, and quoting that hides its boundaries.
    'r3 prefixed command string': lambda b, a: ('s.ts', '100644', "execSync('env CI=1 %s %s');\n" % (b, ' '.join(a))),
    'r3 chained command string': lambda b, a: ('s.mjs', '100644', "execSync('cd /work && %s %s');\n" % (b, ' '.join(a))),
    'r3 multiline template': lambda b, a: ('s.ts', '100644', 'execSync(`\n  %s %s\n`);\n' % (b, ' '.join(a))),
    'r3 template after an expression': lambda b, a: ('s.ts', '100644', 'const cmd = `cd ${root} && %s %s`;\nexecSync(cmd);\n' % (b, ' '.join(a))),
    'r3 string inside a template expression': lambda b, a: ('s.ts', '100644', "execSync(`${'%s'} %s`);\n" % (b, ' '.join(a))),
    'r3 escaped quotes in a string': lambda b, a: ('s.js', '100644', 'execSync("\\"%s\\" %s");\n' % (b, ' '.join(a))),
    'r3 escaped newline in a string': lambda b, a: ('s.cjs', '100644', "execSync('set -e\\n%s %s');\n" % (b, ' '.join(a))),
    'r3 Node path with spaces': lambda b, a: ('s.ts', '100644', "spawn('/opt/Agent Tools/bin/%s', [%s]);\n" % (b, js_items(a))),
    'r3 indented shell string': lambda b, a: ('s.py', '100644', "subprocess.run('  %s %s', shell=True)\n" % (b, ' '.join(a))),
    'r3 chained os.system': lambda b, a: ('s.py', '100644', "os.system('cd repo && %s %s')\n" % (b, ' '.join(a))),
    'r3 triple-quoted command': lambda b, a: ('s.py', '100644', 'subprocess.run(\n    """\n    set -e\n    %s %s\n    """,\n    shell=True,\n)\n'
                                              % (b, ' '.join(a))),
    'r3 f-string command': lambda b, a: ('s.py', '100644', "subprocess.run(f'cd {wt} && %s %s', shell=True)\n" % (b, ' '.join(a))),
    'r3 Python path with spaces': lambda b, a: ('s.py', '100644', "subprocess.run(['/opt/Agent Tools/bin/%s', %s])\n" % (b, js_items(a))),
    'r3 hash inside a string': lambda b, a: ('s.py', '100644', "tag = '#'; cmd = '%s %s'\n" % (b, ' '.join(a))),
    'r3 escaped package script': lambda b, a: ('package.json', '100644', '{"scripts":{"review":"\\"%s\\" %s"}}\n' % (b, ' '.join(a))),
    'r3 escaped absolute path script': lambda b, a: ('package.json', '100644', '{"scripts":{"review":"\\"/opt/Agent Tools/bin/%s\\" %s"}}\n' % (b, ' '.join(a))),
    'r3 chained package script': lambda b, a: ('package.json', '100644', '{"scripts":{"review":"pnpm build && %s %s"}}\n' % (b, ' '.join(a))),
    'r3 YAML block command': lambda b, a: ('.github/workflows/x.yml', '100644', 'steps:\n  - run: |\n      cd repo\n      %s %s\n' % (b, sh_args(a))),
    'r3 shell path with spaces': lambda b, a: ('run.sh', '100644', SH + '"/opt/Agent Tools/bin/%s" %s\n' % (b, sh_args(a))),
    # Round 4: forms that defeated the r3 string and recipe scanners; the raw scan needs no shape.
    'r4 f-string, nested same quote': lambda b, a: ('s.py', '100644', 'print(f"Worker: {subprocess.Popen(["%s", %s])}")\n' % (b, js_items(a, '"'))),
    'r4 regex after if (...)': lambda b, a: ('s.ts', '100644', "if (ready) /'/.test(execSync('%s %s'));\n" % (b, ' '.join(a))),
    'r4 regex after if (...), dot': lambda b, a: ('s.js', '100644', "if (ready) /./.test(execSync('%s %s').toString());\n" % (b, ' '.join(a))),
    'r4 indented Make prefix': lambda b, a: ('Makefile', '100644', 'review:\n\t -%s %s\n' % (b, sh_args(a))),
    'r4 indented Make prefixes': lambda b, a: ('rules.mk', '100644', 'review:\n\t  @-%s %s\n' % (b, sh_args(a))),
    'r4 comment': lambda b, a: ('s.ts', '100644', '// %s %s\n' % (b, ' '.join(a))),
    'r4 bare word in code': lambda b, a: ('s.py', '100644', 'subprocess.run([%s, %s])\n' % (b, js_items(a))),
    # Round 5: launch-capable files of types no list named; the default scan reads them all.
    'r5 netlify build command': lambda b, a: ('netlify.toml', '100644', '[build]\n  command = "%s %s"\n' % (b, ' '.join(a))),
    'r5 netlify context command': lambda b, a: ('netlify.toml', '100644', '[context.deploy-preview]\n  command = "pnpm build && %s %s"\n' % (b, ' '.join(a))),
    'r5 netlify plugin input': lambda b, a: ('netlify.toml', '100644', "[[plugins]]\n  package = './p'\n  [plugins.inputs]\n    cmd = '%s %s'\n" % (b, ' '.join(a))),
    'r5 Dockerfile shell form': lambda b, a: ('Dockerfile', '100644', 'FROM node:22\nRUN %s %s\n' % (b, sh_args(a))),
    'r5 Dockerfile exec form': lambda b, a: ('docker/Dockerfile.review', '100644', 'FROM node:22\nCMD ["%s", %s]\n' % (b, js_items(a, '"'))),
    'r5 VS Code task': lambda b, a: ('.vscode/tasks.json', '100644', '{"tasks": [{"label": "review", "command": "%s", "args": [%s]}]}\n' % (b, js_items(a, '"'))),
    'r5 devcontainer command': lambda b, a: ('.devcontainer/devcontainer.json', '100644', '{"postCreateCommand": "%s %s"}\n' % (b, ' '.join(a))),
    'r5 fish script': lambda b, a: ('tools/review.fish', '100644', '%s %s\n' % (b, sh_args(a))),
    'r5 PowerShell script': lambda b, a: ('tools/review.ps1', '100644', '& "%s" %s\n' % (b, ' '.join('"%s"' % x for x in a))),
    'r5 Ruby script': lambda b, a: ('tools/review.rb', '100644', 'system("%s", %s)\n' % (b, js_items(a, '"'))),
    'r5 Perl script': lambda b, a: ('tools/review.pl', '100644', 'system("%s", %s);\n' % (b, js_items(a, '"'))),
    'r5 Lua script': lambda b, a: ('tools/review.lua', '100644', 'os.execute("%s %s")\n' % (b, ' '.join(a))),
    'r5 direnv file': lambda b, a: ('.envrc', '100644', '%s %s\n' % (b, sh_args(a))),
    'r5 ini hook': lambda b, a: ('setup.cfg', '100644', '[tool:hooks]\npre = %s %s\n' % (b, ' '.join(a))),
    'r5 unknown type': lambda b, a: ('foo.xyz', '100644', 'run: %s %s\n' % (b, ' '.join(a))),
    'r5 extensionless file': lambda b, a: ('tools/review', '100644', '%s %s\n' % (b, sh_args(a))),
    # Standards r5's further shapes.
    'r5 Dockerfile entrypoint': lambda b, a: ('Dockerfile', '100644', 'FROM node:22\nENTRYPOINT ["/usr/local/bin/%s", %s]\n' % (b, js_items(a, '"'))),
    'r5 VS Code process task': lambda b, a: ('.vscode/tasks.json', '100644',
                                             '{\n  "tasks": [\n    {\n      "type": "process",\n      "command": "%s",\n      "args": [%s]\n    }\n  ]\n}\n'
                                             % (b, js_items(a, '"'))),
    'r5 devcontainer argument array': lambda b, a: ('.devcontainer/devcontainer.json', '100644', '{"postStartCommand": ["%s", %s]}\n' % (b, js_items(a, '"'))),
    'r5 Just recipe': lambda b, a: ('justfile', '100644', 'review:\n    %s %s\n' % (b, sh_args(a))),
    'r5 ksh script': lambda b, a: ('tools/review.ksh', '100644', '%s %s\n' % (b, sh_args(a))),
    'r5 Go source': lambda b, a: ('tools/review.go', '100644', 'package main\n\nimport "os/exec"\n\nfunc main() { exec.Command("%s", %s).Run() }\n'
                                  % (b, js_items(a, '"'))),
    'r5 Rust source': lambda b, a: ('tools/review.rs', '100644', 'fn main() { std::process::Command::new("%s").args([%s]).status().unwrap(); }\n'
                                    % (b, js_items(a, '"'))),
    'r5 Ruby script a package script runs': lambda b, a: ('scripts/review.rb', '100644', 'system("%s", %s)\n' % (b, js_items(a, '"'))),
}

# The Spec r2 report's examples, verbatim but for the assembled binary names.
SPEC_R2_EXAMPLES = {
    'quoted absolute path': ('run.sh', '100644', SH + '"/usr/bin/%s" exec "fix it"\n' % CX),
    'quoted binary': ('run.sh', '100644', SH + '"%s" -p "fix it"\n' % CL),
    'args keyword': ('s.py', '100644', 'subprocess.run(args=["%s", "exec", "fix it"])\n' % CX),
    'comment before the first argument': ('s.ts', '100644', "spawn(\n  // Review\n  '%s', ['exec', 'fix it']\n)\n" % CX),
}
# The Standards r2 report's examples, likewise.
STANDARDS_R2_EXAMPLES = {
    'quoted absolute path': ('run.sh', '100644', SH + '"/usr/local/bin/%s" exec fix\n' % CX),
    'quoted binary': ('run.sh', '100644', SH + "'%s' --print fix\n" % CL),
    'quoted subcommand': ('run.sh', '100644', SH + '%s "exec" fix\n' % CX),
    'args keyword': ('s.py', '100644', 'subprocess.run(args=["%s", "exec", "fix"], check=True)\n' % CX),
    'Popen args keyword': ('s.py', '100644', 'subprocess.Popen(args=["%s", "--print", "fix"])\n' % CL),
    'Node block comment': ('s.ts', '100644', "spawn(/* worker */ '%s', ['exec', 'fix'])\n" % CX),
    'Python comment': ('s.py', '100644', 'subprocess.run(\n # worker\n ["%s", "--print", "fix"]\n)\n' % CL),
    'folded workflow command': ('.github/workflows/x.yml', '100644', 'run: >-\n  %s\n  --print fix\n' % CL),
}

# The Standards r3 report's examples, likewise.
STANDARDS_R3_EXAMPLES = {
    'chained command string': ('s.ts', '100644', "execSync('cd /work && %s exec fix')\n" % CX),
    'prefixed command string': ('s.ts', '100644', "execSync('env CI=1 %s exec fix')\n" % CX),
    'multiline backtick command': ('s.ts', '100644', 'execSync(`\n%s exec fix\n`)\n' % CX),
    'indented shell string': ('s.py', '100644', "subprocess.run('  %s exec fix', shell=True)\n" % CX),
    'escaped package script': ('package.json', '100644', '{"scripts":{"review":"\\"%s\\" exec fix"}}\n' % CX),
    'Node path with spaces': ('s.ts', '100644', "spawn('/opt/Agent Tools/bin/%s', ['exec', 'fix'])\n" % CX),
    'Python path with spaces': ('s.py', '100644', "subprocess.run(['/opt/Agent Tools/bin/%s', 'exec', 'fix'])\n" % CX),
}
# The Spec r3 report's examples, likewise.
SPEC_R3_EXAMPLES = {
    'prefixed command string': ('s.ts', '100644', "execSync('env CI=1 %s exec fix')\n" % CX),
    'chained command string': ('s.ts', '100644', "execSync('cd repo && %s exec fix')\n" % CX),
    'chained os.system': ('s.py', '100644', "os.system('cd repo && %s -p fix')\n" % CL),
    'indented multiline template': ('s.ts', '100644', 'execSync(`\n    %s exec fix\n  `)\n' % CX),
    'triple-quoted shell command': ('s.py', '100644', 'subprocess.run("""\n    %s exec fix\n""", shell=True)\n' % CX),
    'escaped package script': ('package.json', '100644', '{"scripts":{"review":"\\"%s\\" exec fix"}}\n' % CX),
}

# The Standards r4 report's examples, verbatim.
STANDARDS_R4_EXAMPLES = {
    'regex after if (...)': ('s.ts', '100644', "if (ready) /'/.test(execSync('codex exec fix'));\n"),
    'f-string, nested same quote': ('s.py', '100644', 'print(f"Worker: {subprocess.Popen(["codex", "exec", "fix"])}")\n'),
}
# The Spec r4 report's examples, verbatim.
SPEC_R4_EXAMPLES = {
    'f-string, nested same quote': ('s.py', '100644', 'print(f"Review: {subprocess.check_output(["codex", "exec", "fix"]).decode()}")\n'),
    'regex after if (...)': ('s.js', '100644', "if (ready) /./.test(execSync('codex exec fix').toString());\n"),
    'indented Make prefix': ('Makefile', '100644', 'review:\n\t -codex exec fix\n'),
}

# The Spec r5 report's examples, verbatim: the tracked netlify.toml's build command replaced.
SPEC_R5_EXAMPLES = {
    'Netlify build command': ('netlify.toml', '100644', '[build]\n  command = "codex exec fix"\n'),
}

# Deliberate obfuscation, out of scope by the threat model: asserted not caught, to pin the boundary.
OUT_OF_SCOPE = {
    'a Node program name from an environment variable': ('s.ts', '100644', "spawn(process.env.AGENT_BIN, ['exec', 'fix']);\n"),
    'a shell program name from an environment variable': ('run.sh', '100644', SH + '"$AGENT_BIN" exec fix\n'),
    'a program name built from pieces': ('s.py', '100644', "subprocess.run(['co' + 'dex', 'exec', 'fix'])\n"),
    'a shell program name built from pieces': ('run.sh', '100644', SH + 'bin=co; "${bin}dex" exec fix\n'),
}

# Spared until round 3 (the scanners skipped comments, identifiers and non-script JSON); the raw scan
# refuses them: name -> (path, mode, content).
NOW_CAUGHT = {
    'JS comments': ('c.ts', '100644', "// run %s exec here\n/* or %s -p */\nconst x = 'git';\n" % (CX, CL)),
    'a Python comment': ('c.py', '100644', "# the %s operator\nx = 'git'  # then %s -p\n" % (CX, CL)),
    'an identifier outside strings': ('i.py', '100644', 'operator_identity(values, %s)\n' % CX),
    'a regex literal holding quotes': ('r.ts', '100644', "const re = /['\"]/g; const %s = 1;\n" % CX),
    'a division before a string': ('v.ts', '100644', "const half = total / 2; const s = 'git'; const %s = half;\n" % CX),
    'an identifier in a template expression': ('t.ts', '100644', 'const s = `${%s.name} is ready`;\n' % CX),
    'package.json outside its scripts': ('package.json', '100644', '{"devDependencies":{"@openai/%s":"1.0.0"},"scripts":{"x":"git status"}}\n' % CX),
    # Spared until round 5: JSON outside the named data trees is scanned as config.
    'a JSON file outside the data trees': ('data.json', '100644', '{"cmd": "%s", "args": ["exec"]}\n' % CX),
}

# Files the default scan does not read, with a launch inside: name -> (path, mode, content).
NOT_SCANNED = {
    'Markdown': ('docs/x.md', '100644', '%s exec fix\n' % CX),
    'MDX': ('docs/x.mdx', '100644', '%s exec fix\n' % CX),
    'HTML': ('public/x.html', '100644', '<pre>%s exec</pre>\n' % CX),
    'CSS': ('src/x.css', '100644', '/* %s exec */\n' % CX),
    'the lockfile': ('pnpm-lock.yaml', '100644', 'packages:\n  %s@1.0.0:\n    resolution: {}\n' % CX),
    'pinned YAML source data': ('tests/fixtures/pinned/packs/a.yaml', '100644', 'command: %s exec\n' % CX),
    'pinned PCGen data': ('tests/fixtures/pcgen/a.lst', '100644', '%s exec\n' % CX),
    'a pinned PCGen campaign file': ('tests/fixtures/pcgen/a.pcc', '100644', '%s exec\n' % CX),
    'captured fixture text': ('tests/fixtures/x/a.txt', '100644', '%s exec\n' % CX),
    'recorded fixture JSON': ('tests/fixtures/review-766/a.json', '100644', '{"providerInstanceId": "%s"}\n' % CX),
    'a legal record': ('scripts/catalog/legal/a.json', '100644', '{"reviewedBy": "gpt-6.1-sol (%s; AI review)"}\n' % CX),
    'a catalog scope': ('scripts/catalog/scopes/a.json', '100644', '{"x": "%s"}\n' % CX),
    'catalog registry data': ('src/lib/catalog/data/a.json', '100644', '{"x": "%s"}\n' % CX),
    'binary content': ('assets/a.bin', '100644', '\0%s exec\n' % CX),
    # A shebang would make it a script anywhere else.
    'a light-lane path': (next(p for p in light_lane.EXACT if not p.endswith('.md')), '100644', SH + '%s -p x\n' % CL),
}

# Text that names a binary without naming it as a program: name -> (path, mode, content).
NEAR_MISSES = {
    'a function that only contains a name': ('f.sh', '100644', SH + '%s_limit "$status" log\n' % CX),
    'a dot directory': ('d.sh', '100644', SH + 'ls .%s/agents -p\nmkdir -p "$HOME/.%s"\n' % (CL, CX)),
    'a dot directory literal': ('d.ts', '100644', "const dir = join(root, '.%s', 'agents');\nconst conf = '~/.%s/config.toml';\n" % (CL, CX)),
    'identifiers that contain a name': ('i.ts', '100644', 'const %sResume = config.%s;\nconst monster%s = 1;\n' % (CL, CL, CX.capitalize())),
    'words that end in a name after a dash': ('w.sh', '100644', SH + 'run-%s -p x\nmy%s exec x\nfoo-%s exec\n' % (CL, CX, CX)),
    'a name after a dashed dot word': ('w.ts', '100644', "const pkg = 'x.y-%s';\n" % CX),
    'a literal that only starts with a name': ('l.ts', '100644', "const model = '%s-opus-5-5';\nconst pkg = '@openai/%s-sdk';\n" % (CL, CX)),
    'a multiline call of another program': ('m.ts', '100644', "spawn(\n  'git',\n  ['status'],\n);\n"),
    'a multiline Python call of another program': ('m.py', '100644', 'subprocess.run(\n    [\n        "git",\n        "log",\n    ],\n)\n'),
    'Markdown prose': ('docs/x.md', '100644', 'Run `%s exec -m model` or "%s" -p to start a worker.\n' % (CX, CL)),
    'an escaped dot directory in a regex': ('e.py', '100644', "LINE = re.compile(r'\\.%s/[A-Za-z]+')\n" % CL),
    'a capitalised word in a string': ('w.ts', '100644', "const label = '%s CLI';\n" % CX.capitalize()),
    'a long unbroken path-like token':('long.sh', '100644', SH + 'x="%s%s-x"\n' % ('a/' * 200000, CX)),
}


def git(root, *args, **kwargs):
    return subprocess.run(['git', '-C', str(root), *args], check=True, capture_output=True, **kwargs)


def repository(files):
    """A temporary Git repository tracking FILES: {path: (mode, content)}."""
    root = Path(tempfile.mkdtemp(prefix='agent-launch-guard-', dir=os.environ.get('TMPDIR')))
    git(root, 'init', '-q')
    for path, (mode, content) in files.items():
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text(content)
        git(root, 'add', '-f', path)
        if mode == '100755':
            git(root, 'update-index', '--chmod=+x', path)
    return root


def launches(root, allowlist=()):
    return guard.check(root, dict.fromkeys(allowlist, 'test'), {})[0]


def as_files(cases):
    return {'%s/%s' % (name.replace(' ', '-').replace(',', ''), path): (mode, content)
            for name, (path, mode, content) in cases.items()}


class LaunchCorpus(unittest.TestCase):
    def assert_each_caught(self, files):
        caught = {hit.split(':', 1)[0] for hit in launches(repository(files))}
        self.assertEqual(sorted(set(files) - caught), [])
        self.assertEqual(sorted(caught - set(files)), [])

    def test_every_shape_of_every_launch_is_caught(self):
        self.assert_each_caught({'%s-%d/%s' % (name.replace(' ', '-').replace(',', ''), i, path): (mode, content)
                                 for name, shape in SHAPES.items()
                                 for i, (path, mode, content) in enumerate(shape(b, a) for b, a in INVOCATIONS)})

    def test_every_binary_is_refused_as_a_bare_program(self):
        self.assert_each_caught({'bare-%s/%s' % (agent, path): (mode, content % agent)
                                 for agent in guard.AGENTS
                                 for path, mode, content in [('run.sh', '100644', SH + '%s\n'), ('s.py', '100644', 'run(["%s"])\n'),
                                                             ('s.ts', '100644', "spawn('%s');\n")]})

    def test_the_review_r2_examples_are_caught(self):
        for name, cases in (('spec r2', SPEC_R2_EXAMPLES), ('standards r2', STANDARDS_R2_EXAMPLES),
                            ('spec r3', SPEC_R3_EXAMPLES), ('standards r3', STANDARDS_R3_EXAMPLES),
                            ('spec r4', SPEC_R4_EXAMPLES), ('standards r4', STANDARDS_R4_EXAMPLES),
                            ('spec r5', SPEC_R5_EXAMPLES)):
            with self.subTest(name):
                self.assert_each_caught(as_files(cases))

    def test_comments_identifiers_and_all_of_package_json_are_scanned(self):
        self.assert_each_caught(as_files(NOW_CAUGHT))

    def test_a_text_file_of_an_unknown_type_is_scanned(self):
        # Review r5: the scan is by default, so a type nobody listed is read too.
        for path in ('foo.xyz', 'conf/review.unknown-type', 'NOEXTENSION'):
            with self.subTest(path):
                self.assertEqual(len(launches(repository({path: ('100644', 'run = "%s exec fix"\n' % CX)}))), 1)

    def test_code_inside_the_excluded_data_trees_is_scanned(self):
        # The data exclusions name their trees and data types; a module there is code and stays scanned.
        self.assert_each_caught({'%s-%d%s' % (tree, i, suffix): ('100644', "spawn('%s', [%s]);\n" % (b, js_items(a)))
                                 for i, (b, a) in enumerate(INVOCATIONS)
                                 for tree, suffix in (('tests/fixtures/x/helper', '.ts'), ('tests/fixtures/x/helper', '.mjs'),
                                                      ('scripts/catalog/legal/check', '.ts'),
                                                      ('src/lib/catalog/data/load', '.ts'))})

    def test_the_excluded_files_are_not_scanned(self):
        for name, (path, mode, content) in NOT_SCANNED.items():
            with self.subTest(name):
                self.assertEqual(launches(repository({path: (mode, content)})), [])

    def test_deliberate_obfuscation_is_out_of_scope(self):
        for name, (path, mode, content) in OUT_OF_SCOPE.items():
            with self.subTest(name):
                self.assertEqual(launches(repository({path: (mode, content)})), [])

    def test_near_misses_are_spared(self):
        for name, (path, mode, content) in NEAR_MISSES.items():
            with self.subTest(name):
                self.assertEqual(launches(repository({path: (mode, content)})), [])

    def test_each_hit_names_its_line(self):
        root = repository({'run.sh': ('100644', SH + 'set -e\n\n%s \\\n  exec fix\n' % CX),
                           's.py': ('100644', 'import subprocess\nsubprocess.run(\n    ["%s", "-p", "x"],\n)\n' % CL)})
        self.assertEqual([hit.split(': ', 1)[0] for hit in launches(root)], ['run.sh:4', 's.py:3'])

    def test_an_untracked_launch_is_not_the_repositorys(self):
        root = repository({})
        (root / 'run.sh').write_text('%s exec x\n' % CX)
        self.assertEqual(launches(root), [])


class Allowlist(unittest.TestCase):
    LINE = "providerInstanceId: '%s'," % CX

    def test_an_entry_covers_its_exact_line_in_its_file_only(self):
        root = repository({'a.ts': ('100644', 'const t = {\n  %s\n};\n' % self.LINE),
                           'b.ts': ('100644', '  %s\n' % self.LINE)})
        self.assertEqual(launches(root, [('a.ts', self.LINE)]), ['b.ts:1: ' + self.LINE])
        self.assertEqual(launches(root, [('a.ts', self.LINE), ('b.ts', self.LINE)]), [])

    def test_an_entry_does_not_cover_a_changed_line(self):
        root = repository({'a.ts': ('100644', "spawn('%s', ['exec']);\n" % CX)})
        self.assertEqual(len(launches(root, [('a.ts', self.LINE)])), 1)

    def test_an_entry_no_refused_line_matches_is_stale(self):
        root = repository({'a.ts': ('100644', "const x = 'git';\n")})
        self.assertEqual(guard.check(root, {('a.ts', self.LINE): 'gone'}, {}), ([], ['a.ts: ' + self.LINE]))

    def test_a_whole_file_entry_covers_every_line_and_goes_stale_without_one(self):
        root = repository({'a.ts': ('100644', "spawn('%s', ['exec']);\n// %s\n" % (CX, CL)),
                           'b.ts': ('100644', "const x = 'git';\n")})
        self.assertEqual(guard.check(root, {}, {'a.ts': 'test'}), ([], []))
        self.assertEqual(guard.check(root, {}, {'a.ts': 'test', 'b.ts': 'test'}), ([], ['b.ts (whole file)']))

    def test_every_exclusion_has_a_reason_and_none_excludes_a_runnable_type(self):
        prose_and_pages = ('.md', '.mdx', '.html', '.css')
        for glob, reason in guard.EXCLUSIONS.items():
            with self.subTest(glob):
                self.assertTrue(reason.strip())
                if glob.startswith('**/'):  # by type alone, anywhere: prose and pages only
                    self.assertTrue(glob.endswith(prose_and_pages), glob)

    def test_only_the_guards_own_files_are_listed_whole(self):
        self.assertEqual(sorted(guard.ALLOWED_FILES), sorted(guard.GUARD_FILES))

    def test_every_entry_has_a_reason(self):
        for key, reason in list(guard.ALLOWLIST.items()) + list(guard.ALLOWED_FILES.items()):
            self.assertTrue(reason.strip(), key)


class ThisRepository(unittest.TestCase):
    ROOT = Path(git(HERE, 'rev-parse', '--show-toplevel', text=True).stdout.strip())

    def test_the_guard_and_its_test_are_tracked_and_scanned(self):
        # Review r1: the guard matched itself, unseen while it was untracked.
        scanned = guard.scanned(self.ROOT)
        for path in guard.GUARD_FILES:
            self.assertIn(path, scanned)

    def test_no_tracked_code_names_an_agent_cli_and_no_entry_is_stale(self):
        self.assertEqual(guard.check(self.ROOT), ([], []))


if __name__ == '__main__':
    unittest.main()
