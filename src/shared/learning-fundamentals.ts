import type { FundamentalsTopic, LearningCodeBlock } from './learning-types'

const BERRYCORE = '/accounts/1000/shared/misc/berrycore'

function ex(
  title: string,
  code: string,
  lang: string,
  description?: string
): { title: string; description?: string; code: LearningCodeBlock } {
  return { title, description, code: { lang, code, caption: title } }
}

export const LEARNING_FUNDAMENTALS: FundamentalsTopic[] = [
  {
    id: 'print',
    number: 1,
    title: 'Console & print',
    summary: 'Send text to the screen — the first tool for debugging and user feedback.',
    why:
      'Every script you write on BerryCore starts by showing something: install progress, API responses, error messages. stdout is where normal output goes; stderr is for errors. Learn both early.',
    concepts: [
      'stdout — standard output stream (what users normally see)',
      'stderr — error stream (keeps errors separate from normal output)',
      'String quoting — single vs double quotes affect expansion',
      'Formatting — interpolate values into readable messages'
    ],
    compare: [
      { idea: 'Print text', bash: 'echo "hello"', python: 'print("hello")', node: 'console.log("hello")' },
      { idea: 'Format a number', bash: 'printf "%.2f\\n" 3.14', python: 'print(f"{x:.2f}")', node: 'console.log(x.toFixed(2))' },
      { idea: 'Print to stderr', bash: 'echo "err" >&2', python: 'import sys; print("err", file=sys.stderr)', node: 'console.error("err")' },
      { idea: 'No trailing newline', bash: 'printf "ok"', python: 'print("ok", end="")', node: 'process.stdout.write("ok")' }
    ],
    langGuide: {
      bash: {
        syntax: 'echo TEXT  ·  printf FORMAT ARGS',
        notes: [
          'Use double quotes when you need variable expansion: echo "$HOME"',
          'echo -e enables escape sequences on some systems; printf is more portable',
          'Shebang #!/bin/sh vs #!/bin/bash — BerryCore may default to sh'
        ]
      },
      python: {
        syntax: 'print(value, sep=" ", end="\\n")',
        notes: [
          'f-strings (f"{name}") are the modern way to format — Python 3.6+',
          'print() returns None — it is for side effect, not building strings',
          'Run with python3 script.py on device'
        ]
      },
      node: {
        syntax: 'console.log(...args)  ·  console.error(...)',
        notes: [
          'Template literals use backticks: `Hello ${name}`',
          'console.log auto-adds spaces between args and a newline at the end',
          'Run with node script.js — use #!/usr/bin/env node for direct execution'
        ]
      }
    },
    walkthrough: {
      bash: [
        ex(
          'Hello BerryCore',
          `# Save as hello.sh, then: sh hello.sh
echo "Hello from BerryCore"

device="Passport"
echo "Running on $device"`,
          'bash',
          'Double quotes expand variables; single quotes do not.'
        ),
        ex(
          'Formatted install banner',
          `version="1.2.0"
printf "BerryCore %s\\n" "$version"
printf "Install path: %s\\n" "${BERRYCORE}"`,
          'bash',
          'printf is predictable across UNIX — good for columns and precision.'
        ),
        ex(
          'Debug vs error output',
          `echo "Downloading release…"
echo "ERROR: missing berrycore.zip" >&2
exit 1`,
          'bash',
          'Redirect >&2 sends text to stderr so success output stays clean.'
        )
      ],
      python: [
        ex(
          'Hello BerryCore',
          `# Save as hello.py, then: python3 hello.py
print("Hello from BerryCore")

device = "Passport"
print(f"Running on {device}")`,
          'python',
          'f-strings embed expressions inside {braces}.'
        ),
        ex(
          'Formatted install banner',
          `version = "1.2.0"
path = "${BERRYCORE}"
print(f"BerryCore {version}")
print(f"Install path: {path}")`,
          'python',
          'Multiple print calls each add their own newline.'
        ),
        ex(
          'Debug vs error output',
          `import sys

print("Downloading release…")
print("ERROR: missing berrycore.zip", file=sys.stderr)
raise SystemExit(1)`,
          'python',
          'file=sys.stderr mirrors Bash >&2.'
        )
      ],
      node: [
        ex(
          'Hello BerryCore',
          `// Save as hello.js, then: node hello.js
console.log("Hello from BerryCore")

const device = "Passport"
console.log(\`Running on \${device}\`)`,
          'javascript',
          'Backtick strings allow ${expression} interpolation.'
        ),
        ex(
          'Formatted install banner',
          `const version = "1.2.0"
const path = "${BERRYCORE}"
console.log(\`BerryCore \${version}\`)
console.log(\`Install path: \${path}\`)`,
          'javascript',
          'Template literals can span multiple lines.'
        ),
        ex(
          'Debug vs error output',
          `console.log("Downloading release…")
console.error("ERROR: missing berrycore.zip")
process.exit(1)`,
          'javascript',
          'console.error writes to stderr in Node.'
        )
      ]
    },
    exercise: {
      prompt:
        'Print two lines: a greeting with your device name, then "BerryCore path: …" using the real install path variable/path above.',
      hint: 'Combine string interpolation with the path constant from the examples.',
      solution: {
        bash: {
          lang: 'bash',
          code: `device="Passport"
echo "Hello, $device"
echo "BerryCore path: ${BERRYCORE}"`
        },
        python: {
          lang: 'python',
          code: `device = "Passport"
print(f"Hello, {device}")
print(f"BerryCore path: ${BERRYCORE}")`
        },
        node: {
          lang: 'javascript',
          code: `const device = "Passport"
console.log(\`Hello, \${device}\`)
console.log(\`BerryCore path: ${BERRYCORE}\`)`
        }
      }
    }
  },
  {
    id: 'operators',
    number: 2,
    title: 'Operators',
    summary: 'Combine and compare values — arithmetic, logic, and precedence.',
    why:
      'Operators drive every decision: Is SSH port open? Is disk space enough? Should the install continue? Master arithmetic and boolean logic before writing conditionals and loops.',
    concepts: [
      'Arithmetic: + − * / % (modulo) and integer vs float behavior',
      'Comparison: == != < > <= >= (strict equality matters in JavaScript)',
      'Logical: AND OR NOT — combine conditions',
      'Precedence: * before +; use parentheses when unsure'
    ],
    compare: [
      { idea: 'Add / multiply', bash: 'echo $((2 + 3 * 4))', python: '2 + 3 * 4', node: '2 + 3 * 4' },
      { idea: 'Equal?', bash: '[ "$a" = "$b" ]', python: 'a == b', node: 'a === b' },
      { idea: 'Greater than', bash: '[ "$a" -gt "$b" ]', python: 'a > b', node: 'a > b' },
      { idea: 'AND', bash: '[ cond1 ] && [ cond2 ]', python: 'a and b', node: 'a && b' },
      { idea: 'OR', bash: '[ cond1 ] || [ cond2 ]', python: 'a or b', node: 'a || b' },
      { idea: 'NOT', bash: '! command', python: 'not flag', node: '!flag' }
    ],
    langGuide: {
      bash: {
        syntax: '$(( arithmetic ))  ·  [ "$a" -gt "$b" ]  ·  cmd1 && cmd2',
        notes: [
          'Use $(( )) for math; [ ] is the test command — spaces inside are required',
          '&& runs the next command only if the previous succeeded (exit 0)',
          'Compare numbers with -eq -ne -lt -gt; compare strings with = !='
        ]
      },
      python: {
        syntax: '+ - * / // %  ·  == !=  ·  and or not',
        notes: [
          '// is integer division; / is true division in Python 3',
          'and / or are short-circuit — second operand may not run',
          'Chained comparisons: 0 < x < 10'
        ]
      },
      node: {
        syntax: '+ - * / %  ·  === !==  ·  && || !',
        notes: [
          'Use === not == — avoids type coercion surprises ("5" == 5 is true)',
          '?? nullish coalescing: value ?? "default"',
          'Optional chaining: obj?.prop?.nested'
        ]
      }
    },
    walkthrough: {
      bash: [
        ex(
          'Port check math',
          `ssh_port=2022
dev_port=445
total=$((ssh_port + dev_port))
echo "Combined port sum (demo): $total"
echo "SSH is high port: $(( ssh_port > 1024 ))"`,
          'bash'
        ),
        ex(
          'Compare and branch inline',
          `free_mb=128
[ "$free_mb" -lt 256 ] && echo "Low memory warning"
[ "$free_mb" -ge 256 ] && echo "Memory OK"`,
          'bash',
          '&& is both logical AND and "run if success" for commands.'
        ),
        ex(
          'String vs number traps',
          `a=10
b=010
# Always quote in [ ]; use -eq for integers
[ "$a" -eq 10 ] && echo "ten"`,
          'bash',
          'Leading zeros can confuse — treat counts as integers with -eq.'
        )
      ],
      python: [
        ex(
          'Port check math',
          `ssh_port = 2022
dev_port = 445
total = ssh_port + dev_port
print("Combined port sum (demo):", total)
print("SSH is high port:", ssh_port > 1024)`,
          'python'
        ),
        ex(
          'Comparison results',
          `free_mb = 128
print("low memory:", free_mb < 256)
print("enough memory:", free_mb >= 256)
print("in range:", 64 <= free_mb < 4096)`,
          'python',
          'Comparisons evaluate to True or False — if statements use these next.'
        ),
        ex(
          'Modulo and parity',
          `n = 7
print("even" if n % 2 == 0 else "odd")
print("wrap index:", n % 3)`,
          'python',
          '% is remainder — useful for cycling array indices.'
        )
      ],
      node: [
        ex(
          'Port check math',
          `const sshPort = 2022
const devPort = 445
const total = sshPort + devPort
console.log("Combined port sum (demo):", total)
console.log("SSH is high port:", sshPort > 1024)`,
          'javascript'
        ),
        ex(
          'Strict equality',
          `const port = "2022"
console.log(port == 2022)   // true — coercion
console.log(port === 2022)  // false — types differ
console.log(Number(port) === 2022)  // true — explicit convert`,
          'javascript',
          'Always prefer === when comparing ports, IDs, and counts.'
        ),
        ex(
          'Logical combos',
          `const sshUp = true
const smbUp = false
if (sshUp && smbUp) console.log("Both up")
if (sshUp || smbUp) console.log("At least one up")`,
          'javascript'
        )
      ]
    },
    exercise: {
      prompt:
        'Set a=10 and b=3. Print the sum, the product, and three comparison results: a > b, a == b, a < b.',
      hint: 'Arithmetic with + and *; comparisons print True/False or use echo with [ ].',
      solution: {
        bash: {
          lang: 'bash',
          code: `a=10
b=3
echo $((a + b))
echo $((a * b))
[ "$a" -gt "$b" ] && echo "a > b: yes" || echo "a > b: no"
[ "$a" -eq "$b" ] && echo "a == b: yes" || echo "a == b: no"
[ "$a" -lt "$b" ] && echo "a < b: yes" || echo "a < b: no"`
        },
        python: {
          lang: 'python',
          code: `a, b = 10, 3
print(a + b)
print(a * b)
print("a > b:", a > b)
print("a == b:", a == b)
print("a < b:", a < b)`
        },
        node: {
          lang: 'javascript',
          code: `const a = 10, b = 3
console.log(a + b)
console.log(a * b)
console.log("a > b:", a > b)
console.log("a == b:", a === b)
console.log("a < b:", a < b)`
        }
      }
    }
  },
  {
    id: 'if-statements',
    number: 3,
    title: 'If statements & comparisons',
    summary: 'Branch on true/false — the control flow every script relies on.',
    why:
      'Should the install continue? Is SSH up? Is free space below 256 MB? Comparison operators from lesson 2 feed if/elif/else branches that choose what runs next. This is how BerryCore scripts stay safe.',
    concepts: [
      'Condition — expression that evaluates to true or false',
      'if / else — run one block or another',
      'elif / else if — chain multiple cases',
      'Truthy vs falsy — empty string, 0, and null behave differently per language'
    ],
    compare: [
      { idea: 'If', bash: 'if [ cond ]; then …; fi', python: 'if cond:', node: 'if (cond) { … }' },
      { idea: 'Else', bash: 'else …', python: 'else:', node: 'else { … }' },
      { idea: 'Else if', bash: 'elif [ cond ]; then', python: 'elif cond:', node: 'else if (cond)' },
      { idea: 'Equal', bash: '[ "$a" = "$b" ]', python: 'a == b', node: 'a === b' },
      { idea: 'Not equal', bash: '[ "$a" != "$b" ]', python: 'a != b', node: 'a !== b' },
      { idea: 'Combine', bash: '[ a ] && [ b ]', python: 'a and b', node: 'a && b' }
    ],
    langGuide: {
      bash: {
        syntax: 'if [ TEST ]; then … elif [ TEST ]; then … else … fi',
        notes: [
          'Every if needs fi; elif and else are optional',
          'Use [ ] or [[ ]] — spaces around [ and inside tests are mandatory',
          'Combine tests: if [ "$a" -gt 0 ] && [ "$b" -gt 0 ]; then'
        ]
      },
      python: {
        syntax: 'if cond: … elif cond: … else: …',
        notes: [
          'Colons and indentation define blocks — no braces',
          'Chained comparisons: if 64 <= free_mb < 4096:',
          'elif not path: handles missing file/path checks cleanly'
        ]
      },
      node: {
        syntax: 'if (cond) { … } else if (cond) { … } else { … }',
        notes: [
          'Use === and !== inside conditions',
          'Ternary: const ok = freeMb >= 64 ? "yes" : "no"',
          'Optional: switch (port) { case 2022: … break } for many discrete values'
        ]
      }
    },
    walkthrough: {
      bash: [
        ex(
          'SSH port check',
          `port=2022
if [ "$port" -eq 2022 ]; then
  echo "BB10 SSH port"
elif [ "$port" -eq 22 ]; then
  echo "Standard SSH"
else
  echo "Custom port: $port"
fi`,
          'bash'
        ),
        ex(
          'Install gate on free space',
          `free_mb=512
if [ "$free_mb" -lt 64 ]; then
  echo "out of range: too low"
elif [ "$free_mb" -ge 4096 ]; then
  echo "out of range: unusually high"
else
  echo "install OK"
fi`,
          'bash',
          'elif picks up the next case when the first test fails.'
        ),
        ex(
          'Nested service check',
          `ssh_up=1
smb_up=0
if [ "$ssh_up" -eq 1 ]; then
  if [ "$smb_up" -eq 1 ]; then
    echo "Both services up"
  else
    echo "SSH only"
  fi
else
  echo "SSH down"
fi`,
          'bash'
        )
      ],
      python: [
        ex(
          'SSH port check',
          `port = 2022
if port == 2022:
    print("BB10 SSH port")
elif port == 22:
    print("Standard SSH")
else:
    print(f"Custom port: {port}")`,
          'python'
        ),
        ex(
          'Install gate on free space',
          `free_mb = 512
if free_mb < 64:
    print("out of range: too low")
elif free_mb >= 4096:
    print("out of range: unusually high")
else:
    print("install OK")`,
          'python',
          'Chained range: if 64 <= free_mb < 4096 works as a single condition too.'
        ),
        ex(
          'Truthy string check',
          `device_name = ""
if device_name:
    print(f"Using {device_name}")
else:
    print("No device name set")`,
          'python',
          'Empty strings are falsy — useful for optional config values.'
        )
      ],
      node: [
        ex(
          'SSH port check',
          `const port = 2022
if (port === 2022) {
  console.log("BB10 SSH port")
} else if (port === 22) {
  console.log("Standard SSH")
} else {
  console.log(\`Custom port: \${port}\`)
}`,
          'javascript'
        ),
        ex(
          'Install gate on free space',
          `const freeMb = 512
if (freeMb < 64) {
  console.log("out of range: too low")
} else if (freeMb >= 4096) {
  console.log("out of range: unusually high")
} else {
  console.log("install OK")
}`,
          'javascript'
        ),
        ex(
          'Ternary shorthand',
          `const sshUp = true
const label = sshUp ? "connected" : "offline"
console.log(\`SSH: \${label}\`)`,
          'javascript',
          'Ternary picks one of two values — not for multi-line blocks.'
        )
      ]
    },
    exercise: {
      prompt:
        'Set port to 2022. Print "BB10 dev SSH" if port is 2022, "standard SSH" if port is 22, otherwise print "unknown port". Use if/elif/else.',
      hint: 'Compare with === or -eq depending on language.',
      solution: {
        bash: {
          lang: 'bash',
          code: `port=2022
if [ "$port" -eq 2022 ]; then
  echo "BB10 dev SSH"
elif [ "$port" -eq 22 ]; then
  echo "standard SSH"
else
  echo "unknown port"
fi`
        },
        python: {
          lang: 'python',
          code: `port = 2022
if port == 2022:
    print("BB10 dev SSH")
elif port == 22:
    print("standard SSH")
else:
    print("unknown port")`
        },
        node: {
          lang: 'javascript',
          code: `const port = 2022
if (port === 2022) {
  console.log("BB10 dev SSH")
} else if (port === 22) {
  console.log("standard SSH")
} else {
  console.log("unknown port")
}`
        }
      }
    }
  },
  {
    id: 'variables',
    number: 4,
    title: 'Variables',
    summary: 'Name values, update them, and know what mutability means in each language.',
    why:
      'Device IP, paths, passwords (never hard-code secrets in shared scripts), loop counters — variables are how scripts remember state. Each language has different rules for scope and constants.',
    concepts: [
      'Assignment — bind a name to a value',
      'Scope — where the name is visible (block vs function vs global)',
      'Mutability — can you reassign? (const vs let in JS)',
      'Naming — snake_case in Python; camelCase common in JS; UPPER_CASE for constants'
    ],
    compare: [
      { idea: 'Assign', bash: 'name="Passport"', python: 'name = "Passport"', node: 'const name = "Passport"' },
      { idea: 'Reassign', bash: 'count=2; count=3', python: 'count = 3', node: 'let count = 3' },
      { idea: 'Constant', bash: 'readonly PORT=2022', python: 'PORT = 2022  # convention', node: 'const PORT = 2022' },
      { idea: 'Undefined', bash: 'echo "${X:-default}"', python: 'x = x if "x" in dir() else "default"', node: 'x ?? "default"' }
    ],
    langGuide: {
      bash: {
        syntax: 'NAME=value  ·  "$NAME"  ·  ${NAME:-default}',
        notes: [
          'No spaces around = in assignments',
          'Export with export VAR=1 to pass to child processes',
          'Always quote "$var" in tests — handles empty and spaces'
        ]
      },
      python: {
        syntax: 'name = value',
        notes: [
          'No var/let — assignment creates a local in function scope',
          'global keyword only when mutating module-level from inside a function',
          'Tuple unpacking: a, b = 1, 2'
        ]
      },
      node: {
        syntax: 'const x = 1  ·  let y = 2  ·  var z = 3 (avoid var)',
        notes: [
          'const prevents rebinding — objects/arrays can still mutate inside',
          'let is block-scoped; prefer const until you need reassignment',
          'Destructuring: const { host, port } = device'
        ]
      }
    },
    walkthrough: {
      bash: [
        ex(
          'Device profile',
          `device_name="passport"
device_ip="192.168.1.226"
ssh_port=2022

echo "Connecting to $device_name at $device_ip:$ssh_port"`,
          'bash'
        ),
        ex(
          'Default when unset',
          `echo "User: \${BB_USER:-blackberry}"
echo "Port: \${BB_PORT:-2022}"`,
          'bash',
          '${VAR:-default} expands to default if VAR is unset or empty.'
        ),
        ex(
          'Read-only constant',
          `readonly BERRYCORE_PATH="${BERRYCORE}"
echo "$BERRYCORE_PATH"
# BERRYCORE_PATH="/tmp"  # would error`,
          'bash'
        )
      ],
      python: [
        ex(
          'Device profile',
          `device_name = "passport"
device_ip = "192.168.1.226"
ssh_port = 2022

print(f"Connecting to {device_name} at {device_ip}:{ssh_port}")`,
          'python'
        ),
        ex(
          'Multiple assignment',
          `device_name, device_ip, ssh_port = "passport", "192.168.1.226", 2022
print(device_name, ssh_port)`,
          'python'
        ),
        ex(
          'Swap values',
          `a, b = "ssh", "smb"
a, b = b, a
print(a, b)  # smb ssh`,
          'python',
          'Tuple packing/unpacking — no temporary variable needed.'
        )
      ],
      node: [
        ex(
          'Device object',
          `const device = {
  name: "passport",
  ip: "192.168.1.226",
  sshPort: 2022
}
console.log(\`Connecting to \${device.name} at \${device.ip}:\${device.sshPort}\`)`,
          'javascript'
        ),
        ex(
          'Destructuring',
          `const { name, ip, sshPort } = device
console.log(name, sshPort)`,
          'javascript',
          'Pull fields out of objects cleanly.'
        ),
        ex(
          'let vs const',
          `const MAX_RETRIES = 3
let attempt = 0
attempt += 1
console.log(attempt, "of", MAX_RETRIES)`,
          'javascript'
        )
      ]
    },
    exercise: {
      prompt:
        'Create variables for device name, IP, and SSH port. Build one string/message that prints them in the form: ssh blackberry@IP -p PORT # name',
      solution: {
        bash: {
          lang: 'bash',
          code: `name="passport"
ip="192.168.1.226"
port=2022
echo "ssh blackberry@$ip -p $port # $name"`
        },
        python: {
          lang: 'python',
          code: `name = "passport"
ip = "192.168.1.226"
port = 2022
print(f"ssh blackberry@{ip} -p {port} # {name}")`
        },
        node: {
          lang: 'javascript',
          code: `const name = "passport"
const ip = "192.168.1.226"
const port = 2022
console.log(\`ssh blackberry@\${ip} -p \${port} # \${name}\`)`
        }
      }
    }
  },
  {
    id: 'arrays',
    number: 5,
    title: 'Arrays & lists',
    summary: 'Store ordered collections — index, iterate, append, and slice.',
    why:
      'Lists of devices, log lines, package names, BAR files — real scripts process collections. Bash arrays are awkward but everywhere; Python lists and JS arrays are your daily drivers.',
    concepts: [
      'Zero-based indexing — first item is [0]',
      'Length — len(), ${#arr[@]}, array.length',
      'Append / push — grow a collection',
      'Iteration — for each item (feeds directly into loops lesson)'
    ],
    compare: [
      { idea: 'Create', bash: 'arr=(a b c)', python: 'arr = ["a", "b", "c"]', node: 'const arr = ["a", "b", "c"]' },
      { idea: 'First item', bash: '${arr[0]}', python: 'arr[0]', node: 'arr[0]' },
      { idea: 'Length', bash: '${#arr[@]}', python: 'len(arr)', node: 'arr.length' },
      { idea: 'Append', bash: 'arr+=("d")', python: 'arr.append("d")', node: 'arr.push("d")' },
      { idea: 'Slice', bash: '${arr[@]:1:2}', python: 'arr[1:3]', node: 'arr.slice(1, 3)' }
    ],
    langGuide: {
      bash: {
        syntax: 'arr=(one two)  ·  ${arr[i]}  ·  ${arr[@]}',
        notes: [
          '${arr[@]} expands all elements — use when looping',
          'Arrays are 0-indexed; ${#arr[@]} is element count',
          'Associative arrays need declare -A (bash 4+) — may not exist on minimal sh'
        ]
      },
      python: {
        syntax: 'lst = [1, 2]  ·  lst[i]  ·  lst[start:end]',
        notes: [
          'Negative index: lst[-1] is last item',
          'List comprehensions: [x * 2 for x in lst]',
          'append vs extend — extend merges another list'
        ]
      },
      node: {
        syntax: 'const a = [1, 2]  ·  a[i]  ·  a.slice(s, e)',
        notes: [
          'push/pop at end; shift/unshift at start',
          'map/filter/reduce — functional patterns over arrays',
          'Spread: [...a, ...b] merges arrays'
        ]
      }
    },
    walkthrough: {
      bash: [
        ex(
          'Berry device list',
          `devices=("Passport" "Classic" "Leap")
echo "First: \${devices[0]}"
echo "Count: \${#devices[@]}"
for d in "\${devices[@]}"; do
  echo "  - $d"
done`,
          'bash'
        ),
        ex(
          'Build list from loop',
          `ports=(2022 445 8080)
open=()
for p in "\${ports[@]}"; do
  open+=("$p")
done
echo "Tracking \${#open[@]} ports"`,
          'bash'
        )
      ],
      python: [
        ex(
          'Berry device list',
          `devices = ["Passport", "Classic", "Leap"]
print("First:", devices[0])
print("Last:", devices[-1])
print("Count:", len(devices))
for d in devices:
    print("  -", d)`,
          'python'
        ),
        ex(
          'List comprehension',
          `names = ["passport", "classic"]
upper = [n.upper() for n in names]
print(upper)`,
          'python',
          'Compact transform — maps each element through an expression.'
        ),
        ex(
          'Split string into list',
          `line = "2022,445,8080"
ports = [int(p) for p in line.split(",")]
print(ports)`,
          'python'
        )
      ],
      node: [
        ex(
          'Berry device list',
          `const devices = ["Passport", "Classic", "Leap"]
console.log("First:", devices[0])
console.log("Last:", devices.at(-1))
console.log("Count:", devices.length)
for (const d of devices) {
  console.log("  -", d)
}`,
          'javascript'
        ),
        ex(
          'map and filter',
          `const names = ["passport", "classic"]
const upper = names.map((n) => n.toUpperCase())
const long = names.filter((n) => n.length > 6)
console.log(upper, long)`,
          'javascript'
        ),
        ex(
          'Split CSV ports',
          `const line = "2022,445,8080"
const ports = line.split(",").map(Number)
console.log(ports)`,
          'javascript'
        )
      ]
    },
    exercise: {
      prompt:
        'Given devices ["Passport", "Classic", "Leap"], print only devices whose name length is greater than 6 (Classic and Passport qualify).',
      hint: 'Loop and check length, or use filter/list comprehension.',
      solution: {
        bash: {
          lang: 'bash',
          code: `devices=("Passport" "Classic" "Leap")
for d in "\${devices[@]}"; do
  [ "\${#d}" -gt 6 ] && echo "$d"
done`
        },
        python: {
          lang: 'python',
          code: `devices = ["Passport", "Classic", "Leap"]
for d in devices:
    if len(d) > 6:
        print(d)`
        },
        node: {
          lang: 'javascript',
          code: `const devices = ["Passport", "Classic", "Leap"]
devices.filter((d) => d.length > 6).forEach(console.log)`
        }
      }
    }
  },
  {
    id: 'functions',
    number: 6,
    title: 'Functions',
    summary: 'Package reusable logic — define once, call from many places.',
    why:
      'Install scripts, SSH helpers, and service checks repeat the same steps. Functions (and later modules) keep scripts short and testable. On BerryCore, a well-named function documents intent better than twenty lines of inline shell.',
    concepts: [
      'Definition — name a block of code',
      'Call / invocation — run that block',
      'Return value vs side effects (print only)',
      'Scope — locals inside functions do not leak (mostly)'
    ],
    compare: [
      { idea: 'Define', bash: 'fn() { … }', python: 'def fn(): …', node: 'function fn() { … }' },
      { idea: 'Call', bash: 'fn', python: 'fn()', node: 'fn()' },
      { idea: 'Return', bash: 'echo result', python: 'return result', node: 'return result' },
      { idea: 'Arrow fn', bash: '—', python: 'lambda x: x*2', node: '(x) => x * 2' }
    ],
    langGuide: {
      bash: {
        syntax: 'name() { commands; }  ·  name arg1 arg2',
        notes: [
          'Functions are commands — call without parentheses',
          'return sets exit status; echo captures output via $(fn)',
          'Define before use in strict scripts'
        ]
      },
      python: {
        syntax: 'def name(): …  ·  return value',
        notes: [
          'Docstrings """…""" document purpose — use them',
          'Functions are first-class: pass as arguments',
          'None is returned if no return statement'
        ]
      },
      node: {
        syntax: 'function name() {}  ·  const fn = () => {}',
        notes: [
          'Arrow functions inherit this from surrounding scope',
          'Hoisting: function declarations available before line',
          'Module exports: module.exports = { fn }'
        ]
      }
    },
    walkthrough: {
      bash: [
        ex(
          'Banner function',
          `banner() {
  echo "================================"
  echo " BerryCore helper"
  echo "================================"
}
banner`,
          'bash'
        ),
        ex(
          'Return via stdout',
          `berrycore_path() {
  echo "${BERRYCORE}"
}
path=$(berrycore_path)
echo "Using $path"`,
          'bash',
          '$(…) captures function output as a string.'
        )
      ],
      python: [
        ex(
          'Banner function',
          `def banner():
    print("================================")
    print(" BerryCore helper")
    print("================================")

banner()`,
          'python'
        ),
        ex(
          'Return a value',
          `def berrycore_path():
    return "${BERRYCORE}"

path = berrycore_path()
print(f"Using {path}")`,
          'python'
        )
      ],
      node: [
        ex(
          'Banner function',
          `function banner() {
  console.log("================================")
  console.log(" BerryCore helper")
  console.log("================================")
}
banner()`,
          'javascript'
        ),
        ex(
          'Arrow helper',
          `const berrycorePath = () => "${BERRYCORE}"
console.log("Using", berrycorePath())`,
          'javascript'
        )
      ]
    },
    exercise: {
      prompt: 'Write a function status_line that prints "BerryCore: ready" (no parameters yet). Call it twice.',
      solution: {
        bash: { lang: 'bash', code: `status_line() { echo "BerryCore: ready"; }
status_line
status_line` },
        python: { lang: 'python', code: `def status_line():
    print("BerryCore: ready")

status_line()
status_line()` },
        node: {
          lang: 'javascript',
          code: `function statusLine() {
  console.log("BerryCore: ready")
}
statusLine()
statusLine()`
        }
      }
    }
  },
  {
    id: 'functions-params',
    number: 7,
    title: 'Functions with parameters',
    summary: 'Pass data in, get results out — the core of reusable code.',
    why:
      'Parameterized functions work for any device IP, any path, any retry count. Positional args, defaults, and return values differ per language — but the design skill is universal.',
    concepts: [
      'Parameters vs arguments — definition vs call site',
      'Default values — optional parameters',
      'Return early on invalid input',
      'Positional ($1 $2) vs named (def f(a, b))'
    ],
    compare: [
      { idea: 'Two params', bash: 'add() { echo $(( $1 + $2 )); }', python: 'def add(a, b): return a + b', node: 'function add(a, b) { return a + b }' },
      { idea: 'Default', bash: 'port=\${1:-2022}', python: 'def f(port=2022):', node: 'function f(port = 2022)' },
      { idea: 'Call', bash: 'add 3 4', python: 'add(3, 4)', node: 'add(3, 4)' },
      { idea: 'Rest / varargs', bash: 'for arg in "$@"; do', python: 'def f(*args):', node: 'function f(...args)' }
    ],
    langGuide: {
      bash: {
        syntax: '$1 $2 …  ·  $@  ·  ${1:-default}',
        notes: [
          'Shift consumes $1 — useful in parsers',
          'Quote "$@" when forwarding all args to another command',
          'Functions share positional params with script — watch naming'
        ]
      },
      python: {
        syntax: 'def f(a, b=0, *args, **kwargs):',
        notes: [
          'Keyword args: connect(host="x", port=2022)',
          '*args is tuple; **kwargs is dict',
          'Type hints def f(ip: str) -> bool: help readers'
        ]
      },
      node: {
        syntax: 'function f(a, b = 0, ...rest) {}',
        notes: [
          'Default params evaluate once — avoid mutable defaults',
          'Destructuring params: function f({ host, port }) {}',
          'Rest ...rest collects remaining arguments as array'
        ]
      }
    },
    walkthrough: {
      bash: [
        ex(
          'SSH command builder',
          `ssh_cmd() {
  local user="\${1:-blackberry}"
  local host="\$2"
  local port="\${3:-2022}"
  echo "ssh \${user}@\${host} -p \${port}"
}
ssh_cmd blackberry 192.168.1.226 2022`,
          'bash',
          'local keeps helper variables inside the function.'
        ),
        ex(
          'Sum many args',
          `sum() {
  total=0
  for n in "$@"; do
    total=$((total + n))
  done
  echo "$total"
}
sum 10 20 12`,
          'bash'
        )
      ],
      python: [
        ex(
          'SSH command builder',
          `def ssh_cmd(host, user="blackberry", port=2022):
    return f"ssh {user}@{host} -p {port}"

print(ssh_cmd("192.168.1.226"))
print(ssh_cmd("192.168.1.226", port=2222))`,
          'python'
        ),
        ex(
          'Validate before return',
          `def ping_label(host, ms):
    if ms < 0:
        return "invalid"
    if ms < 50:
        return f"{host}: fast"
    return f"{host}: slow"

print(ping_label("passport", 12))`,
          'python'
        )
      ],
      node: [
        ex(
          'SSH command builder',
          `function sshCmd(host, user = "blackberry", port = 2022) {
  return \`ssh \${user}@\${host} -p \${port}\`
}
console.log(sshCmd("192.168.1.226"))`,
          'javascript'
        ),
        ex(
          'Object parameter',
          `function connect({ host, user = "blackberry", port = 2022 }) {
  return \`\${user}@\${host}:\${port}\`
}
console.log(connect({ host: "192.168.1.226" }))`,
          'javascript',
          'One options object scales better than many positional args.'
        )
      ]
    },
    exercise: {
      prompt:
        'Write greet(name, device="Passport") that prints "Hello NAME (DEVICE)". Call once with only your name, once with both args.',
      solution: {
        bash: {
          lang: 'bash',
          code: `greet() {
  local name="$1"
  local device="\${2:-Passport}"
  echo "Hello $name ($device)"
}
greet "Alex"
greet "Alex" "Classic"`
        },
        python: {
          lang: 'python',
          code: `def greet(name, device="Passport"):
    print(f"Hello {name} ({device})")

greet("Alex")
greet("Alex", "Classic")`
        },
        node: {
          lang: 'javascript',
          code: `function greet(name, device = "Passport") {
  console.log(\`Hello \${name} (\${device})\`)
}
greet("Alex")
greet("Alex", "Classic")`
        }
      }
    }
  },
  {
    id: 'loops',
    number: 8,
    title: 'Loops',
    summary: 'Repeat until done — iterate lists, count retries, and process files.',
    why:
      'Install retries, batch SSH checks, parsing log lines — loops turn one-off code into automation. Combine with functions and arrays for real BerryCore maintenance scripts.',
    concepts: [
      'for each — walk a list or range',
      'while — repeat until condition is false',
      'break / continue — exit early or skip iteration',
      'Infinite loop danger — always move toward an exit condition'
    ],
    compare: [
      { idea: 'For each item', bash: 'for x in "$@"; do …; done', python: 'for x in items:', node: 'for (const x of items)' },
      { idea: 'Counted for', bash: 'for i in $(seq 1 5); do', python: 'for i in range(5):', node: 'for (let i = 0; i < 5; i++)' },
      { idea: 'While', bash: 'while [ cond ]; do …; done', python: 'while cond:', node: 'while (cond) { … }' },
      { idea: 'Break', bash: 'break', python: 'break', node: 'break' }
    ],
    langGuide: {
      bash: {
        syntax: 'for v in LIST; do …; done  ·  while [ cond ]; do …; done',
        notes: [
          'Quote "$@" in for loops over arrays',
          '(( i++ )) for arithmetic loops in bash',
          'set -e + loops — a failed command in loop may exit script'
        ]
      },
      python: {
        syntax: 'for x in iterable:  ·  while cond:',
        notes: [
          'range(5) is 0..4; range(1, 6) is 1..5',
          'enumerate(items) gives index + value',
          'else on loops runs if no break — rarely needed but exists'
        ]
      },
      node: {
        syntax: 'for (const x of arr)  ·  for (let i=0; …)  ·  while (cond)',
        notes: [
          'for…in on arrays gives indices as strings — prefer for…of',
          'async in loops — await inside for…of, not forEach',
          'Classic infinite: while (true) { … break when done }'
        ]
      }
    },
    walkthrough: {
      bash: [
        ex(
          'Retry install up to 3 times',
          `attempt=1
max=3
while [ "$attempt" -le "$max" ]; do
  echo "Attempt $attempt of $max"
  # sh install.sh && break
  attempt=$((attempt + 1))
done`,
          'bash'
        ),
        ex(
          'For each device',
          `for device in Passport Classic Leap; do
  echo "Checking $device…"
done`,
          'bash'
        ),
        ex(
          'Read file line by line',
          `while IFS= read -r line; do
  echo "LOG: $line"
done < /var/log/messages 2>/dev/null || echo "No log access"`,
          'bash',
          'IFS= and -r preserve whitespace and backslashes.'
        )
      ],
      python: [
        ex(
          'Retry with range',
          `max_attempts = 3
for attempt in range(1, max_attempts + 1):
    print(f"Attempt {attempt} of {max_attempts}")
    # if install_ok: break`,
          'python'
        ),
        ex(
          'Enumerate with index',
          `devices = ["Passport", "Classic", "Leap"]
for i, name in enumerate(devices, start=1):
    print(f"{i}. {name}")`,
          'python'
        ),
        ex(
          'While read lines',
          `lines = ["ssh ok", "smb ok", "done"]
while lines:
    print("Processing", lines.pop(0))`,
          'python'
        )
      ],
      node: [
        ex(
          'Retry loop',
          `const maxAttempts = 3
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  console.log(\`Attempt \${attempt} of \${maxAttempts}\`)
  // if (ok) break
}`,
          'javascript'
        ),
        ex(
          'For…of with break',
          `const ports = [2022, 445, 9999]
for (const port of ports) {
  if (port === 445) {
    console.log("Found SMB port", port)
    break
  }
}`,
          'javascript'
        ),
        ex(
          'While countdown',
          `let n = 3
while (n > 0) {
  console.log("Tick", n)
  n--
}`,
          'javascript'
        )
      ]
    },
    exercise: {
      prompt:
        'Loop integers 1 through 5. Print "port check: N" for each. Stop early (break) when N reaches 4.',
      solution: {
        bash: {
          lang: 'bash',
          code: `for n in 1 2 3 4 5; do
  echo "port check: $n"
  [ "$n" -eq 4 ] && break
done`
        },
        python: {
          lang: 'python',
          code: `for n in range(1, 6):
    print(f"port check: {n}")
    if n == 4:
        break`
        },
        node: {
          lang: 'javascript',
          code: `for (let n = 1; n <= 5; n++) {
  console.log(\`port check: \${n}\`)
  if (n === 4) break
}`
        }
      }
    }
  }
]
