# cyber-timer

A full-screen, neon/cyberpunk countdown timer and stopwatch for your
terminal. It takes over the whole window, draws a glowing box around the
edge, and shows the time in a big blocky digital font.

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
cyber-timer <duration> [options]   # countdown
cyber-timer stopwatch [options]    # count up (alias: sw)
```

Duration formats (countdown mode):

| Input      | Meaning          |
| ---------- | ---------------- |
| `25`       | 25 minutes       |
| `25m`      | 25 minutes       |
| `90s`      | 90 seconds       |
| `1h30m`    | 1 hour 30 minutes|
| `10:00`    | mm:ss            |
| `1:10:00`  | hh:mm:ss         |

The time is always shown as `hh:mm:ss`, so the hours field stays on screen
even at `00` and the readout never changes width.

Options:

- `-t, --title <text>` — custom label in the title bar (default `CYBER TIMER` / `STOPWATCH`)
- `-s, --silent` — disable the completion beep (countdown only)
- `-i, --invert` — start in the flipped theme
- `-h, --help` — show help

Keys:

- `Space` — record a lap. Laps are listed in the bottom-left corner with the
  split from the previous one, and the full list is printed to your terminal
  when you exit. The six most recent are kept on screen; older ones scroll off
  the display but still appear in the exit list.
- `Tab` — flip between the default theme (muted ember on your terminal
  background) and the flipped theme (warm amber on a dark grey panel). Toggle
  as often as you like; the timer keeps running.
- `q` / `Ctrl+C` — quit

Examples:

```bash
cyber-timer 25
cyber-timer 90s --title "BREAK"
cyber-timer 1h --silent
cyber-timer 45m --invert
cyber-timer stopwatch
cyber-timer sw --title "LAP"
```

While running, press `q` or `Ctrl+C` to stop/quit at any time — the elapsed or
remaining time is printed to your terminal once the app exits. When a
countdown finishes, press any key to exit.

## Development

```bash
git clone https://github.com/e.kallioras/cyber-timer.git
cd cyber-timer
npm link
cyber-timer 5s
```

## License

MIT
