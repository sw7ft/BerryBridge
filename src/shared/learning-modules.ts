import { DEVICE_PATHS, SSH_DEFAULTS } from './types'
import { LEARNING_FUNDAMENTALS } from './learning-fundamentals'

export type {
  ProgLang,
  LearningCodeBlock,
  LearningSection,
  LangGuide,
  FundamentalsExample,
  CompareRow,
  FundamentalsTopic,
  LearningModule
} from './learning-types'
export { PROG_LANG_LABELS, PROG_LANGS } from './learning-types'

export const LEARNING_MODULES: LearningModule[] = [
  {
    id: 'terminals',
    number: 1,
    title: 'Terminals',
    subtitle: 'Where commands actually run — on your phone and from Berry Bridge.',
    sections: [
      {
        heading: 'What a terminal is',
        body:
          'A terminal is a text interface to your operating system. Instead of tapping icons, you type commands and read output. On BlackBerry 10, Term49 is the built-in terminal app. Berry Bridge adds a full SSH terminal on your desktop that talks to the same shell on the device.',
        bullets: [
          'Prompt — shows who you are, where you are, and that the shell is waiting (often ends with $ or #)',
          'Command — a program name plus arguments (e.g. ls -la)',
          'Output — text printed to stdout; errors go to stderr',
          'Exit code — 0 means success; non-zero means something failed'
        ]
      },
      {
        heading: 'Term49 on your BB10 device',
        body: 'Open Term49 from the app grid. You land in a POSIX shell on QNX — the same environment BerryCore extends. This is where you run install scripts, edit configs, and inspect logs.',
        code: {
          lang: 'sh',
          caption: 'Check that the shell responds',
          code: `# who am I?
whoami

# where am I?
pwd

# what is in this folder?
ls`
        }
      },
      {
        heading: 'Berry Bridge terminal',
        body:
          'After SSH is set up (Quick Start steps 4–7), open Terminal in the sidebar. Berry Bridge opens an interactive session over SSH — same shell, larger keyboard, copy/paste, and scrollback. Use it for long installs and log tailing.',
        tip: 'If the terminal disconnects, your session on the device may still be running. Reconnect and check with ps or re-attach if you use tmux (module 8).'
      },
      {
        heading: 'Essential habits',
        bullets: [
          'Read the prompt before typing — wrong directory causes wrong results',
          'Use Tab for filename completion; Up arrow recalls previous commands',
          'Ctrl+C stops the current foreground command (does not close the terminal)',
          'Ctrl+D sends EOF — often exits the shell or ends input',
          'Never paste commands you do not understand, especially from the web'
        ]
      }
    ]
  },
  {
    id: 'unix-shell',
    number: 2,
    title: 'The UNIX shell (BerryCore)',
    subtitle: 'Navigation, pipes, and paths on a BerryCore-enabled BB10.',
    sections: [
      {
        heading: 'BerryCore in context',
        body:
          'BerryCore layers open tooling on top of BB10\'s QNX shell: familiar UNIX commands, package/build helpers, and paths under /accounts/1000. You are not learning “Linux on a phone” — you are learning a real RTOS with a real shell, tuned for handheld use.',
        code: {
          lang: 'sh',
          code: `# BerryCore-related paths (see also Storage in Berry Bridge)
echo "${DEVICE_PATHS.berrycore.defaultInstall}"
echo "${DEVICE_PATHS.berrycore.transferDir}"
echo "${DEVICE_PATHS.berrycore.sharedMisc}"`
        }
      },
      {
        heading: 'Moving around the filesystem',
        bullets: [
          'pwd — print working directory',
          'cd path — change directory; cd .. goes up; cd ~ goes home',
          'ls — list files; ls -la shows hidden files and permissions',
          'cat file — print file contents; less file — scrollable view'
        ],
        code: {
          lang: 'sh',
          code: `cd ${DEVICE_PATHS.berrycore.sharedMisc}
ls -la
cat some-config.txt`
        }
      },
      {
        heading: 'Redirection and pipes',
        body: 'The shell connects programs together. > writes stdout to a file (overwrite). >> appends. | sends one command\'s output into the next.',
        code: {
          lang: 'sh',
          code: `# Save command output
uname -a > /tmp/sysinfo.txt

# Append a line
echo "installed $(date)" >> /tmp/sysinfo.txt

# Pipe: count lines in a log
cat /var/log/messages 2>/dev/null | wc -l

# Search output
ps -ef | grep berry`
        }
      },
      {
        heading: 'Environment variables',
        body: 'Variables like PATH tell the shell where to find programs. BerryCore installers often adjust PATH or provide wrappers in known directories.',
        code: {
          lang: 'sh',
          code: `echo $PATH
echo $HOME
export MY_VAR="hello"
echo $MY_VAR`
        },
        tip: 'Changes from export only last for the current shell session unless you add them to a startup file (.profile, .bashrc, or BerryCore-specific profile snippets).'
      },
      {
        heading: 'Running scripts',
        body: 'BerryCore installs via upload + shell script — the pattern you use in Quick Start step 6.',
        code: {
          lang: 'sh',
          caption: 'Typical BerryCore install (from Documents after upload)',
          code: `cd ${DEVICE_PATHS.berrycore.transferDir}
ls -la berrycore.zip install.sh
sh install.sh`
        }
      }
    ]
  },
  {
    id: 'ssh-sftp',
    number: 3,
    title: 'SSH & SFTP',
    subtitle: 'Secure access to your device from Mac, PC, or Berry Bridge.',
    sections: [
      {
        heading: 'Why SSH on BB10',
        body:
          'SSH gives you encrypted remote shell access. BB10 uses port 2022 (not 22), RSA keys, and legacy algorithms — Berry Bridge handles that in ~/.ssh/config. Once a key is in authorized_keys, you log in without typing the dev password every time.',
        code: {
          lang: 'text',
          code: `Host passport
  HostName 192.168.1.226
  Port ${SSH_DEFAULTS.port}
  User ${SSH_DEFAULTS.user}
  IdentityFile ~/.ssh/id_rsa_bb10`
        }
      },
      {
        heading: 'Key-based authentication',
        bullets: [
          'Generate a key pair on your computer (private + public .pub)',
          'Install the public key on the device → authorized_keys',
          'Keep the private key on your machine only; never share it',
          'Berry Bridge Quick Start and SSH Keys pages automate this flow',
          'Open term49-ssh-key-install.txt on the phone, copy all, paste into Term49 (meta mode + Ctrl+V)'
        ],
        code: {
          lang: 'sh',
          caption: 'In term49-ssh-key-install.txt (uploaded to misc via WiFi Storage)',
          code: `mkdir -p ~/.ssh
cat ~/shared/misc/id_rsa_bb10.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys`
        }
      },
      {
        heading: 'SFTP — files over SSH',
        body: 'SFTP is file transfer on the same SSH connection. Use it when you want CLI copy without WiFi Storage.',
        code: [
          {
            lang: 'sh',
            caption: 'Interactive SFTP from your computer',
            code: `sftp -P ${SSH_DEFAULTS.port} ${SSH_DEFAULTS.user}@192.168.1.226
# inside sftp:
#   ls
#   cd shared/documents
#   put local-file.zip
#   get remote-file.log`
          },
          {
            lang: 'sh',
            caption: 'One-shot copy with scp',
            code: `scp -P ${SSH_DEFAULTS.port} ./notes.txt ${SSH_DEFAULTS.user}@192.168.1.226:${DEVICE_PATHS.berrycore.transferDir}/`
          }
        ]
      },
      {
        heading: 'When to use what',
        bullets: [
          'Berry Bridge Terminal — daily shell work, installs, logs',
          'WiFi Storage (SMB) — bulk drag-and-drop from Finder/Explorer (module in Storage page)',
          'SFTP/scp — scripted transfers, automation, CI-style deploys',
          'SSH Keys page — regenerate keys, preview config, test connection'
        ],
        tip: 'If SSH fails after too many password attempts, Development Mode may lock — wait or reboot the device before retrying.'
      }
    ]
  },
  {
    id: 'editors',
    number: 4,
    title: 'nano & text editors',
    subtitle: 'Edit configs and scripts directly on the device.',
    sections: [
      {
        heading: 'Why learn an editor',
        body:
          'BerryCore setup means editing shell scripts, config files, and small programs on the phone. You need at least one terminal editor you can use without a mouse.',
        bullets: [
          'nano — easiest starting point; shortcuts shown at the bottom',
          'vi / vim — everywhere on UNIX; steeper curve, very fast once learned',
          'ed — classic line editor; rarely needed but still on some systems'
        ]
      },
      {
        heading: 'nano basics',
        code: {
          lang: 'sh',
          code: `# open or create a file
nano ~/notes.txt

# inside nano:
#   Ctrl+O  write (save)
#   Ctrl+X  exit
#   Ctrl+K  cut line
#   Ctrl+U  paste
#   Ctrl+W  search
#   Ctrl+G  help`
        },
        tip: 'Always save to a path you can write — user files usually live under /accounts/1000/ or shared folders.'
      },
      {
        heading: 'vi / vim essentials',
        body: 'vi has two modes: Normal (navigate) and Insert (type). Esc returns to Normal.',
        code: {
          lang: 'text',
          code: `vi ~/config.conf

# Normal mode:
#   i      enter Insert mode
#   Esc    back to Normal
#   :w     write
#   :q     quit
#   :wq    save and quit
#   :q!    quit without saving
#   dd     delete line
#   /word  search forward`
        }
      },
      {
        heading: 'Safe editing workflow',
        bullets: [
          'Copy the original before big changes: cp file.conf file.conf.bak',
          'Edit small files in nano first; graduate to vi when comfortable',
          'Validate shell scripts with sh -n script.sh (syntax check) before running',
          'For large edits, use Berry Bridge Storage upload/download or SFTP from your desktop editor'
        ]
      }
    ]
  },
  {
    id: 'compilation-packages',
    number: 5,
    title: 'Compilation & packages',
    subtitle: 'Build software from source and manage dependencies on BerryCore.',
    sections: [
      {
        heading: 'Source vs binaries',
        body:
          'Some BerryCore tools ship as prebuilt binaries or .bar packages. Others arrive as source you compile with gcc/clang and make. Understanding both paths keeps you unblocked when a package is not prebuilt for ARM.',
        bullets: [
          'Binary — ready to run; fastest path if architecture matches',
          'Source — you compile for your exact CPU/OS; flexible but needs dev headers',
          'Package script — install.sh pattern used by BerryCore releases'
        ]
      },
      {
        heading: 'Classic build flow',
        code: {
          lang: 'sh',
          code: `# typical autotools project
tar xzf mytool-1.0.tar.gz
cd mytool-1.0
./configure --prefix=/accounts/1000/shared/misc/mytool
make -j4
make install`
        },
        tip: 'If configure fails, you are usually missing a library or header. Read the error — it names the package you need.'
      },
      {
        heading: 'Make and Makefiles',
        body: 'make reads a Makefile: targets, dependencies, and commands. -j runs parallel jobs.',
        code: {
          lang: 'makefile',
          code: `# minimal Makefile
all: hello

hello: hello.c
\tgcc -o hello hello.c

clean:
\trm -f hello`
        }
      },
      {
        heading: 'Language-specific package managers',
        body: 'On BerryCore you may have several ecosystems side by side:',
        bullets: [
          'npm / node — JavaScript tools and servers (package.json, node_modules)',
          'pip — Python libraries (requirements.txt, virtual environments if available)',
          'gem — Ruby (if Ruby is installed)',
          'go install — Go modules when Go toolchain is present',
          'BerryCore install scripts — curated bundles (berrycore.zip + install.sh)'
        ],
        code: [
          {
            lang: 'sh',
            caption: 'Node',
            code: 'npm init -y\nnpm install express\nnode server.js'
          },
          {
            lang: 'sh',
            caption: 'Python',
            code: 'pip install requests\npython3 -c "import requests; print(requests.__version__)"'
          }
        ]
      },
      {
        heading: 'Berry Bridge angle',
        body:
          'Upload source archives via Storage → documents, build in Term49 or Berry Bridge Terminal, and keep artifacts in shared/misc. Track what you installed — note versions in a simple PACKAGES.txt for future you.'
      }
    ]
  },
  {
    id: 'languages',
    number: 6,
    title: 'Programming languages',
    subtitle: 'Bash, Python, and Node.js — plus friends — on a handheld UNIX system.',
    sections: [
      {
        heading: 'Bash / shell',
        body: 'The shell is your glue language: automate installs, cron-style tasks, and wrap CLI tools. Every BerryCore admin should be comfortable here.',
        code: {
          lang: 'bash',
          code: `#!/bin/sh
# backup a folder with a timestamp
SRC="${DEVICE_PATHS.berrycore.defaultInstall}"
DEST="/accounts/1000/shared/documents/backup-$(date +%Y%m%d).tar.gz"
tar czf "$DEST" -C "$(dirname "$SRC")" "$(basename "$SRC")"
echo "Saved to $DEST"`
        }
      },
      {
        heading: 'Python',
        body: 'Python excels at scripting, parsing, APIs, and small services. Check python3 --version on device; use venv when available to isolate dependencies.',
        code: {
          lang: 'python',
          code: `#!/usr/bin/env python3
import json, urllib.request

url = "https://api.github.com/repos/sw7ft/BerryCore/releases/latest"
with urllib.request.urlopen(url, timeout=15) as r:
    data = json.load(r)
print(data["tag_name"])`
        }
      },
      {
        heading: 'Node.js',
        body: 'Node fits HTTP servers, WebSocket bridges, and tooling you already know from the desktop. Berry Bridge itself is Electron + Node on your computer; your device can run lighter Node services too.',
        code: {
          lang: 'javascript',
          code: `#!/usr/bin/env node
const http = require('http')
const port = 8080

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('BerryCore says hello\\n')
}).listen(port, () => console.log('listening on', port))`
        }
      },
      {
        heading: 'Other languages worth knowing',
        bullets: [
          'C — QNX and BerryCore native code; closest to the metal',
          'Go — single static binaries, great for small network services',
          'Ruby — quick scripts and Rails-style tooling if installed',
          'Rust — memory-safe systems programming when toolchain is available',
          'Lua — lightweight embedding in games and config-driven tools'
        ],
        tip: 'Module 7 walks the same concepts (print, variables, loops…) in Bash, Python, and Node with a language toggle.'
      }
    ]
  },
  {
    id: 'fundamentals',
    number: 7,
    title: 'Programming fundamentals',
    subtitle: 'Eight lessons in Python-first order — compare Bash and Node when you are ready.',
    sections: [
      {
        heading: 'How this module works',
        body:
          'Lessons run down the right sidebar (1–8). Content defaults to Python; switch to Bash, Node, or Compare all anytime. Each lesson covers one concept with syntax tables, walkthroughs, and a hands-on exercise.',
        bullets: [
          'Work top to bottom — lesson 3 (if statements) builds on lesson 2 (operators)',
          'Run examples in Term49 (Bash) or with python3 / node on BerryCore',
          'Try the exercise before moving on; reveal the solution when stuck'
        ]
      }
    ],
    fundamentals: LEARNING_FUNDAMENTALS
  },
  {
    id: 'tmux',
    number: 8,
    title: 'tmux & multiplexers',
    subtitle: 'Keep shells alive, split the screen, and survive disconnects on BerryCore.',
    sections: [
      {
        heading: 'What is a terminal multiplexer?',
        body:
          'A normal SSH session dies when WiFi drops, Berry Bridge closes, or your laptop sleeps. A terminal multiplexer sits between you and the shell: it owns the session on the device, and you attach or detach without killing what is running inside.',
        bullets: [
          'Session — one persistent workspace (can hold many windows)',
          'Window — like a tab; each has its own shell or program',
          'Pane — split view inside a window (side-by-side or stacked)',
          'Attach / detach — connect and disconnect without stopping work',
          'Scrollback — history you can search even after output scrolls off screen'
        ],
        tip: 'Think of tmux as a window manager for your terminal — essential for long installs, log tailing, and anything you cannot afford to lose mid-run.'
      },
      {
        heading: 'Multiplexer options on UNIX',
        body: 'BerryCore and BB10 may not ship every tool preinstalled. Know the ladder from lightest to richest:',
        bullets: [
          'nohup cmd & — simplest; process survives logout but no re-attach UI',
          'disown — remove job from shell so hangup signal does not kill it',
          'screen — classic multiplexer; lighter, often available on embedded systems',
          'tmux — modern default; panes, scripts, plugins, better defaults',
          'Berry Bridge Terminal — great for daily use; tmux adds persistence on the device itself'
        ]
      },
      {
        heading: 'screen quick reference',
        body: 'If tmux is not installed, screen is the usual fallback. Prefix key is Ctrl+A.',
        code: {
          lang: 'sh',
          caption: 'GNU screen essentials',
          code: `# start
screen -S berry

# detach: Ctrl+A then D

# list
screen -ls

# re-attach
screen -r berry

# kill
screen -X -S berry quit

# inside screen — new window: Ctrl+A c
# next/prev window: Ctrl+A n / Ctrl+A p
# split horizontal: Ctrl+A S  then Ctrl+A Tab to move
# scroll mode: Ctrl+A [  (q to quit scroll)`
        },
        tip: 'screen and tmux commands differ — muscle memory from one does not fully transfer. Pick one and standardize on your device.'
      },
      {
        heading: 'Install & verify tmux',
        body: 'Check what you have before relying on it for a long BerryCore install.',
        code: {
          lang: 'sh',
          code: `which tmux
tmux -V

# if missing — path depends on your BerryCore package setup
# build from source, or install via your platform package tool
# then verify:
tmux new -d -s test && tmux kill-session -t test && echo "tmux OK"`
        }
      },
      {
        heading: 'Session basics',
        body: 'Name sessions for projects — berry, install, server — so tmux ls stays readable.',
        code: {
          lang: 'sh',
          code: `# start named session (creates + attaches)
tmux new -s berry

# start detached (good for scripts / auto-start)
tmux new -d -s berry 'tail -f /var/log/messages'

# detach (session keeps running): Ctrl+B then D

# list sessions
tmux ls

# attach to most recent
tmux attach

# attach to named session
tmux attach -t berry
tmux a -t berry          # short form

# attach read-only (watch without typing)
tmux attach -rt berry

# kill one session
tmux kill-session -t berry

# kill all sessions (careful)
tmux kill-server`
        }
      },
      {
        heading: 'The prefix key',
        body:
          'tmux uses a two-key chord: prefix (default Ctrl+B), release, then command key. This keeps tmux from stealing shortcuts your shell needs.',
        bullets: [
          'Ctrl+B — default prefix (change in ~/.tmux.conf with set -g prefix C-a)',
          'Ctrl+B ? — searchable list of all key bindings',
          'Ctrl+B : — command prompt (type rename-session berry, set mouse on, etc.)',
          'Ctrl+B d — detach',
          'Ctrl+B $ — rename session',
          'Ctrl+B , — rename current window'
        ]
      },
      {
        heading: 'Windows',
        body: 'Windows are tabs. Use them for separate tasks: install in one window, logs in another, editor in a third.',
        bullets: [
          'Ctrl+B c — create window',
          'Ctrl+B n / p — next / previous window',
          'Ctrl+B 0–9 — jump to window number',
          'Ctrl+B w — interactive window picker',
          'Ctrl+B & — kill current window (confirm)',
          'Ctrl+B l — last active window (toggle back)'
        ],
        code: {
          lang: 'sh',
          caption: 'CLI window management',
          code: `# new window running a command
tmux new-window -t berry -n logs 'tail -f /var/log/messages'

# rename window from shell
tmux rename-window -t berry:1 install

# list windows
tmux list-windows -t berry`
        }
      },
      {
        heading: 'Panes — split the screen',
        body: 'Panes let you watch install output and run commands in the same window without alt-tabbing.',
        bullets: [
          'Ctrl+B % — split vertical (left | right)',
          'Ctrl+B " — split horizontal (top / bottom)',
          'Ctrl+B arrow keys — move focus between panes',
          'Ctrl+B o — cycle to next pane',
          'Ctrl+B z — zoom pane full-screen (toggle)',
          'Ctrl+B x — kill pane (confirm)',
          'Ctrl+B { / } — swap pane positions',
          'Ctrl+B space — cycle through preset layouts'
        ],
        code: {
          lang: 'sh',
          caption: 'CLI pane splits',
          code: `# split current pane vertically, run command in new pane
tmux split-window -h -t berry:0 'watch -n2 ps aux | grep berry'

# split horizontal
tmux split-window -v -t berry:0

# send keys to a specific pane (automation)
tmux send-keys -t berry:0.1 'cd ${DEVICE_PATHS.berrycore.transferDir}' Enter`
        }
      },
      {
        heading: 'Copy mode & scrollback',
        body:
          'Terminal output scrolls away. Copy mode lets you scroll up, search, and yank text — critical for grabbing error lines from a failed install.',
        bullets: [
          'Ctrl+B [ — enter copy mode (q to exit)',
          'Arrow keys / Page Up — scroll',
          '/ — search forward, ? — search backward',
          'Space — start selection, Enter — copy selection',
          'Ctrl+B ] — paste buffer (in another pane or window)',
          'Mouse wheel may work if mouse mode is on (set -g mouse on)'
        ],
        tip: 'On BB10 without mouse, copy mode is your only way to recover long error messages from scrollback.'
      },
      {
        heading: 'Layouts & pane sizing',
        body: 'After splitting, resize panes instead of living with 50/50.',
        bullets: [
          'Ctrl+B Alt+arrow — resize pane edge (hold Alt)',
          'Ctrl+B : then resize-pane -R 5 — nudge right 5 cells',
          'even-horizontal / even-vertical — preset layouts via command prompt',
          'Ctrl+B z — zoom one pane; run install full-width, then zoom out to watch logs'
        ],
        code: {
          lang: 'sh',
          code: `# from command prompt (Ctrl+B :)
resize-pane -L 10
select-layout even-vertical
display-panes   # show pane numbers briefly`
        }
      },
      {
        heading: 'Config: ~/.tmux.conf',
        body: 'A small config on the device makes tmux feel modern — mouse, larger scrollback, sensible prefix.',
        code: {
          lang: 'tmux',
          caption: 'Starter ~/.tmux.conf for BerryCore / BB10',
          code: `# reload: tmux source-file ~/.tmux.conf  (or Ctrl+B : source-file ~/.tmux.conf)

set -g default-terminal "screen-256color"
set -g history-limit 50000
set -g mouse on
set -g base-index 1          # windows start at 1 not 0
setw -g pane-base-index 1

# easier prefix: Ctrl+A (screen muscle memory)
# set -g prefix C-a
# unbind C-b
# bind C-a send-prefix

bind | split-window -h
bind - split-window -v
bind r source-file ~/.tmux.conf \\; display "Config reloaded"

# highlight active pane subtly
set -g pane-border-style fg=colour238
set -g pane-active-border-style fg=colour39`
        },
        tip: 'Keep tmux.conf in dotfiles or sync via Storage — re-applying after wipe saves re-tuning.'
      },
      {
        heading: 'BerryCore workflow: install session',
        body: 'Pattern used during BerryCore setup — one session, multiple windows, survives Berry Bridge disconnect.',
        code: {
          lang: 'sh',
          code: `# 1) create install session
tmux new -s install

# 2) window 0: run install from Documents upload
cd ${DEVICE_PATHS.berrycore.transferDir}
ls -la berrycore.zip install.sh
sh install.sh

# 3) Ctrl+B c — window 1: watch system log
tail -f /var/log/messages

# 4) Ctrl+B c — window 2: spare shell for checks
ps -ef | grep berry
df -h

# 5) Ctrl+B d — detach, close laptop

# 6) later, from Berry Bridge Terminal or Term49:
tmux attach -t install`
        }
      },
      {
        heading: 'BerryCore workflow: dev server + logs',
        body: 'Run a Node or Python service in one pane, HTTP checks in another, logs in a third.',
        code: {
          lang: 'sh',
          code: `tmux new -s dev

# pane 0: start service
cd ${DEVICE_PATHS.berrycore.defaultInstall}
node server.js
# or: python3 app.py

# Ctrl+B " — split horizontal
# pane 1: hit the service
while true; do curl -s -o /dev/null -w "%{http_code}\\n" http://127.0.0.1:8080/; sleep 5; done

# Ctrl+B % — split vertical in bottom
# pane 2: app log
tail -f ./app.log

# detach and leave running overnight on WiFi`
        }
      },
      {
        heading: 'Automation & scripting',
        body: 'tmux is scriptable — useful for repeatable BerryCore lab setups from a single shell script.',
        code: {
          lang: 'sh',
          code: `#!/bin/sh
SESSION=berry-lab

tmux has-session -t "$SESSION" 2>/dev/null && tmux kill-session -t "$SESSION"

tmux new-session -d -s "$SESSION" -n shell
tmux send-keys -t "$SESSION:shell" "cd ${DEVICE_PATHS.berrycore.sharedMisc}" Enter

tmux new-window -t "$SESSION" -n logs
tmux send-keys -t "$SESSION:logs" "tail -f /var/log/messages" Enter

tmux split-window -h -t "$SESSION:shell"
tmux send-keys -t "$SESSION:shell.1" "watch -n5 ls -la ${DEVICE_PATHS.berrycore.transferDir}" Enter

tmux attach -t "$SESSION"`
        },
        tip: 'tmux has-session avoids duplicate sessions when you re-run a setup script.'
      },
      {
        heading: 'When things go wrong',
        bullets: [
          'Session still running but cannot attach — tmux attach -d (force detach other client)',
          'Garbled screen after resize — Ctrl+B : then refresh-client or exit and re-attach',
          'Stuck in copy mode — press q',
          'Prefix not working — another program may capture Ctrl+B; try prefix change in conf',
          'Process died but session remains — tmux kill-window or exit the dead shell and start fresh',
          'Out of memory on device — many panes + tail -f can add up; close unused windows'
        ]
      },
      {
        heading: 'tmux vs screen — pick one',
        body: 'Both solve persistence. tmux wins on ergonomics; screen wins when bytes are tight or only screen is packaged.',
        bullets: [
          'tmux — better pane splits, consistent scripting, active development',
          'screen — smaller footprint, decades of embedded use, often preinstalled',
          'nohup — one-shot background job when you cannot install either',
          'Berry Bridge — always attach tmux/screen from inside an SSH session, not instead of it'
        ]
      },
      {
        heading: 'Cheat sheet (print mentally)',
        code: {
          lang: 'text',
          code: `SESSIONS          WINDOWS           PANES
tmux new -s N     Ctrl+B c          Ctrl+B %  (split |)
tmux ls           Ctrl+B n/p        Ctrl+B "  (split -)
tmux a -t N       Ctrl+B 0-9        Ctrl+B arrows (focus)
Ctrl+B d          Ctrl+B w          Ctrl+B z  (zoom)
tmux kill -t N    Ctrl+B &          Ctrl+B x  (kill pane)

COPY              CONFIG
Ctrl+B [          ~/.tmux.conf
/ search           tmux source-file ~/.tmux.conf
Ctrl+B ] paste    set -g mouse on`
        }
      }
    ]
  },
  {
    id: 'git',
    number: 9,
    title: 'Git & version control',
    subtitle: 'Track changes, collaborate, and ship BerryCore-related projects safely.',
    sections: [
      {
        heading: 'Why Git',
        body:
          'Configs drift. Scripts break. Git records every change with a message, branches experiments, and syncs with GitHub — where BerryCore and QNX-Handhelds live.',
        bullets: [
          'Repository — project folder under version control',
          'Commit — snapshot with message',
          'Branch — parallel line of work (feature/fix)',
          'Remote — GitHub/GitLab copy you push to and pull from'
        ]
      },
      {
        heading: 'Daily commands',
        code: {
          lang: 'sh',
          code: `git clone https://github.com/sw7ft/BerryCore.git
cd BerryCore
git status
git pull

# after edits:
git add install.sh
git commit -m "Fix path for documents upload"
git push`
        }
      },
      {
        heading: 'Branches and merges',
        code: {
          lang: 'sh',
          code: `git checkout -b my-feature
# ... work ...
git add .
git commit -m "Add helper script"
git checkout main
git merge my-feature`
        },
        tip: 'Never commit secrets — SSH private keys, dev passwords, or API tokens. Use .gitignore for local-only files.'
      },
      {
        heading: 'On the device',
        body:
          'You can git clone small repos directly on BB10 if git is installed, or develop on desktop and deploy artifacts via Storage/SFTP. For tiny hotfixes, nano + backup is fine; for anything you might need again, commit.'
      }
    ]
  },
  {
    id: 'networking',
    number: 10,
    title: 'Networking fundamentals',
    subtitle: 'IPs, ports, and connectivity — the layer under SSH and WiFi Storage.',
    sections: [
      {
        heading: 'Addresses and ports',
        body:
          'Every device on your LAN has an IP (e.g. 192.168.1.226). Services listen on ports: SSH on 2022, SMB on 445, HTTP on 80. Berry Bridge device scan looks for these signatures.',
        bullets: [
          '127.0.0.1 — loopback (this device only)',
          '192.168.x.x — typical home LAN',
          'Port — number routing traffic to the right program',
          'Firewall — may block ports; BB10 dev mode opens SSH when enabled'
        ]
      },
      {
        heading: 'Checking connectivity',
        code: {
          lang: 'sh',
          code: `# from your computer (names vary on QNX)
ping -c 3 192.168.1.226

# is SSH port open?
nc -zv 192.168.1.226 ${SSH_DEFAULTS.port}

# from Berry Bridge: Devices scan or SSH test on SSH Keys page`
        }
      },
      {
        heading: 'DNS preview',
        body:
          'Human names (github.com) map to IPs via DNS. Module 11 goes deeper on hosting your own names and services. For now: if SSH by IP works but a hostname fails, suspect DNS or /etc/hosts.',
        code: {
          lang: 'sh',
          code: `# optional static entry on your computer
# /etc/hosts
192.168.1.226  passport

# then:
ssh passport`
        }
      },
      {
        heading: 'HTTP in one minute',
        body: 'curl requests URLs; wget downloads files. Useful for fetching BerryCore releases or testing a small Node server on the phone.',
        code: {
          lang: 'sh',
          code: `curl -I https://github.com/sw7ft/BerryCore/releases/latest
wget -O berrycore.zip "https://example.com/berrycore.zip"`
        }
      }
    ]
  },
  {
    id: 'dns-hosting',
    number: 11,
    title: 'DNS, hosting & domains',
    subtitle: 'Name your services and reach them from beyond your LAN.',
    sections: [
      {
        heading: 'DNS in plain language',
        body:
          'DNS translates names to IP addresses. When you visit github.com, a resolver walks a tree of records (A, AAAA, CNAME, MX, TXT) until it finds an answer.',
        bullets: [
          'A record — name → IPv4',
          'AAAA — name → IPv6',
          'CNAME — alias to another name',
          'MX — mail routing',
          'TXT — verification, SPF, DKIM, arbitrary notes'
        ]
      },
      {
        heading: 'Domains and registrars',
        body:
          'You rent a domain from a registrar (Porkbun, Cloudflare, Namecheap…). Point its nameservers to a DNS host where you edit records. Subdomains (berry.example.com) get their own records.',
        tip: 'TTL controls cache duration. Lower TTL before migrations; raise it for stability once settled.'
      },
      {
        heading: 'Self-hosting vs PaaS',
        bullets: [
          'Home / BB10 — great for learning; use dynamic DNS or tunnel if exposing to internet',
          'VPS — full VM with public IP (DigitalOcean, Hetzner, Linode)',
          'PaaS — Heroku/Fly.io/Render run your app without managing OS',
          'Static — GitHub Pages, Cloudflare Pages for docs and landing sites'
        ]
      },
      {
        heading: 'Serving from BerryCore',
        body:
          'A Node or Python HTTP server on the phone is perfect on LAN. Putting it on the public internet requires port forwarding, reverse proxy, TLS certificates, and serious security review — start with LAN-only services.',
        code: {
          lang: 'sh',
          code: `# LAN-only: bind to all interfaces on port 8080
# (firewall / router must not expose unless intended)
node server.js

# check from another machine on same WiFi:
curl http://192.168.1.226:8080/`
        }
      },
      {
        heading: 'TLS / HTTPS',
        body:
          'Let\'s Encrypt issues free certificates, usually via certbot on a public server. BB10-era TLS stacks may not speak modern TLS — another reason to terminate HTTPS on a reverse proxy and speak plain HTTP on LAN behind it.'
      }
    ]
  },
  {
    id: 'hypervisors',
    number: 12,
    title: 'Hypervisors & virtualization',
    subtitle: 'Run full OS guests on your desktop — lab safely before touching hardware.',
    sections: [
      {
        heading: 'What virtualization is',
        body:
          'A hypervisor runs virtual machines (VMs): entire guest operating systems on simulated hardware. Use VMs to test Linux scripts, QNX bring-up tools, or network layouts without risking your daily machine.',
        bullets: [
          'Type 1 — bare-metal (ESXi, Proxmox, Hyper-V on Windows Server)',
          'Type 2 — hosted (VirtualBox, VMware Fusion, Parallels, QEMU)',
          'Container — shares host kernel (Docker); lighter but not a full OS'
        ]
      },
      {
        heading: 'Common desktop options',
        bullets: [
          'UTM / QEMU — Apple Silicon friendly; good for ARM Linux guests',
          'VirtualBox — free, cross-platform x86 guests',
          'VMware Fusion / Parallels — macOS commercial options',
          'Hyper-V — built into Windows Pro',
          'Proxmox — homelab favorite on a spare PC'
        ]
      },
      {
        heading: 'Lab ideas for BerryCore builders',
        code: {
          lang: 'text',
          code: `# example lab topology
[Your Mac] --SSH--> [BB10 device on LAN]
[Your Mac] --VM--> [Debian ARM/x86] -- build / cross-compile
[Your Mac] --VM--> [DNS server VM] -- practice module 11 records`
        },
        tip: 'Snapshot the VM before risky experiments. Roll back in seconds when a package install goes wrong.'
      },
      {
        heading: 'QNX note',
        body:
          'QNX licenses differ from Linux. Public QNX evaluation and automotive SDKs have constraints — QNX-Handhelds and community docs cover what is realistic for handheld experiments. VMs excel for everything around the device: DNS, Git, CI, and cross-build hosts.'
      },
      {
        heading: 'Resources vs performance',
        bullets: [
          'RAM — give each VM enough headroom (2 GB minimum for light Linux)',
          'Disk — thin provisioning saves space; preallocate for performance',
          'Networking — NAT for internet; bridged to appear on LAN like a real machine',
          'USB passthrough — sometimes needed for serial/JTAG hardware debug'
        ]
      }
    ]
  }
]

export function learningModuleById(id: string): LearningModule | undefined {
  return LEARNING_MODULES.find((m) => m.id === id)
}
