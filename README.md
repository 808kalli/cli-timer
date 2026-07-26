# cyber-timer

A full-screen, neon/cyberpunk countdown timer for your terminal. It takes over
the whole window, draws a glowing box around the edge, and shows the time
remaining in a big blocky digital font.

## Install

Requires [Node.js](https://nodejs.org) 14 or newer.

Install directly from GitHub — no cloning, no build step:

```bash
npm install -g github:e.kallioras/cyber-timer
```

That's it. `cyber-timer` is now a command available in any terminal on your
machine.

To upgrade later, run the same command again. To remove it:

```bash
npm uninstall -g cyber-timer
```

Prefer not to install anything permanently? Run it on demand instead:

```bash
npx github:e.kallioras/cyber-timer 25
```

## Usage

```bash
cyber-timer <duration> [options]
```

Duration formats:

| Input      | Meaning          |
| ---------- | ---------------- |
| `25`       | 25 minutes       |
| `25m`      | 25 minutes       |
| `90s`      | 90 seconds       |
| `1h30m`    | 1 hour 30 minutes|
| `10:00`    | mm:ss            |
| `1:10:00`  | hh:mm:ss         |

Options:

- `-t, --title <text>` — custom label in the title bar (default `CYBER TIMER`)
- `-s, --silent` — disable the completion beep
- `-h, --help` — show help

Examples:

```bash
cyber-timer 25
cyber-timer 90s --title "BREAK"
cyber-timer 1h --silent
```

While running, press `q` or `Ctrl+C` to quit. When the timer finishes, press
any key to exit.

## Development

```bash
git clone https://github.com/e.kallioras/cyber-timer.git
cd cyber-timer
npm link
cyber-timer 5s
```

## License

MIT
