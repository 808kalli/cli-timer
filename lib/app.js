'use strict';

const { parseDuration } = require('./parseDuration');
const { renderFrame, formatTime } = require('./render');
const { createSlime, updateSlime, isOverSlime } = require('./slime');

// Terminals have no hover event, so hovering is synthesised from raw motion
// reports: 1003 asks for all motion, 1006 for SGR coordinates that survive
// past column 223. Terminals that do not implement these ignore them, and the
// slime simply never notices the pointer.
const ENABLE_MOUSE = '\x1b[?1003h\x1b[?1006h';
const DISABLE_MOUSE = '\x1b[?1003l\x1b[?1006l';
const MOUSE_REPORT = /\x1b\[<\d+;(\d+);(\d+)[Mm]/g;

// Startle-jump on hover: a beat looking at you, then a crouch, a stretch as it
// launches, the hang, and a squash on landing. Timed rather than tied to the
// animation tick, which is far too coarse for these durations.
const STARTLE_FRAMES = [
  [200, 'crouch'], // look at you first, then gather
  [110, 'stretch'], // draw out as it leaves the floor
  [110, 'air'], // back to normal height, clear of the floor
  [500, 'land'], // hang, then squash on impact
  [130, null], // back to normal
];
const {
  HIDE_CURSOR,
  SHOW_CURSOR,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  CURSOR_HOME,
  CLEAR_SCREEN,
  fg,
  ACCENT,
  GRAY,
} = require('./colors');

const HELP = `
${fg(...ACCENT, 'cyber-timer')} — a full-screen countdown timer & stopwatch for your terminal

${fg(...ACCENT, 'Usage:')}
  cyber-timer <duration> [options]
  cyber-timer stopwatch [options]
  cyber-timer clock [options]

${fg(...ACCENT, 'Duration formats:')}
  25            25 minutes
  25m           25 minutes
  90s           90 seconds
  1h30m         1 hour 30 minutes
  10:00         mm:ss
  1:10:00       hh:mm:ss

${fg(...ACCENT, 'Options:')}
  -t, --title <text>   custom label shown in the title bar (default: CYBER TIMER / STOPWATCH)
  -s, --silent          disable the completion beep (countdown only)
  -i, --invert          start in the flipped theme
      --from <duration> start the stopwatch already at this time
      --no-slime        hide the slime
      --no-mouse        do not track the mouse (the slime stops noticing hover)
  -h, --help            show this help

${fg(...ACCENT, 'Keys:')}
  ENTER                 record a lap (listed bottom-left, printed on exit)
  SPACE                 pause / resume
  BACKSPACE             reset (stopwatch to 0, countdown to full) and clear laps
  TAB                   flip between the default and flipped theme
  Q / Ctrl+C            quit

${fg(...ACCENT, 'Examples:')}
  cyber-timer 25
  cyber-timer 90s --title "BREAK"
  cyber-timer 1h --silent
  cyber-timer stopwatch
  cyber-timer sw --title "LAP"
  cyber-timer clock
`;

function parseArgs(argv) {
  const args = {
    title: null,
    silent: false,
    help: false,
    duration: null,
    mode: 'countdown',
    invert: false,
    slime: true,
    mouse: true,
    from: null,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      args.help = true;
    } else if (a === '-s' || a === '--silent') {
      args.silent = true;
    } else if (a === '-i' || a === '--invert') {
      args.invert = true;
    } else if (a === '--no-slime') {
      args.slime = false;
    } else if (a === '--no-mouse') {
      args.mouse = false;
    } else if (a === '--from') {
      args.from = argv[++i] || null;
    } else if (a === '-t' || a === '--title') {
      args.title = argv[++i] || args.title;
    } else {
      rest.push(a);
    }
  }
  const first = rest.length > 0 ? rest[0].toLowerCase() : '';
  if (['stopwatch', 'sw'].includes(first)) {
    args.mode = 'stopwatch';
  } else if (first === 'clock') {
    args.mode = 'clock';
  } else if (rest.length > 0) {
    args.duration = rest.join(' ');
  }
  if (args.title === null) {
    args.title =
      args.mode === 'stopwatch' ? 'STOPWATCH' : args.mode === 'clock' ? 'CLOCK' : 'CYBER TIMER';
  }
  return args;
}

// Read fresh on every paint so the clock always shows the machine's real
// time rather than counting ticks of its own and drifting away from it.
function secondsSinceMidnight() {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function beep(times = 1) {
  let i = 0;
  const ring = () => {
    process.stdout.write('\x07');
    i++;
    if (i < times) setTimeout(ring, 300);
  };
  ring();
}

function run(argv) {
  const args = parseArgs(argv);
  const isStopwatch = args.mode === 'stopwatch';
  const isClock = args.mode === 'clock';
  const isCountdown = !isStopwatch && !isClock;

  if (args.help || (isCountdown && !args.duration)) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }

  let totalSeconds = null;
  if (isCountdown) {
    totalSeconds = parseDuration(args.duration);
    if (totalSeconds === null || totalSeconds <= 0) {
      process.stderr.write(fg(...ACCENT, `Could not parse duration "${args.duration}".`) + '\n');
      process.stdout.write(HELP);
      process.exit(1);
    }
  }

  // Lets a stopwatch pick up where another one left off, since nothing is
  // persisted between runs.
  let startAt = 0;
  if (args.from !== null) {
    if (!isStopwatch) {
      process.stderr.write(fg(...ACCENT, '--from only applies to the stopwatch.') + '\n');
      process.exit(1);
    }
    startAt = parseDuration(args.from);
    if (startAt === null || startAt < 0) {
      process.stderr.write(fg(...ACCENT, `Could not parse --from "${args.from}".`) + '\n');
      process.exit(1);
    }
  }

  if (!process.stdout.isTTY) {
    process.stderr.write('cyber-timer needs an interactive terminal to run.\n');
    process.exit(1);
  }

  let remaining = totalSeconds;
  let elapsed = startAt;
  let finished = false;
  let interval = null;
  let animInterval = null;
  let exiting = false;
  let inverted = args.invert;
  let paused = false;
  const laps = [];
  const slime = args.slime ? createSlime() : null;

  function stepSlime() {
    if (slime) updateSlime(slime, (process.stdout.columns || 80) - 2, paused);
  }

  let startleTimers = [];
  let startling = false;

  function clearStartle() {
    startleTimers.forEach(clearTimeout);
    startleTimers = [];
    startling = false;
  }

  // Once begun the jump always runs to completion, even if the pointer has
  // already moved on. Cancelling it when the pointer left meant a quick pass
  // over the slime showed nothing at all.
  function startStartle() {
    if (startling) return;
    startling = true;
    let at = 0;
    for (const [delay, pose] of STARTLE_FRAMES) {
      at += delay;
      startleTimers.push(
        setTimeout(() => {
          if (exiting) return;
          slime.pose = pose;
          if (pose === null) startling = false;
          draw();
        }, at),
      );
    }
  }

  function draw() {
    const frame = renderFrame({
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      title: args.title,
      mode: args.mode,
      remainingSeconds: remaining,
      totalSeconds,
      finished,
      elapsedSeconds: elapsed,
      clockSeconds: secondsSinceMidnight(),
      inverted,
      laps,
      paused,
      slime,
    });
    process.stdout.write(CURSOR_HOME + frame);
  }

  function printSummary() {
    if (isClock) return; // nothing to report — it was only showing the time
    let line;
    if (isStopwatch) {
      line = `Stopped — elapsed ${formatTime(elapsed)}`;
    } else if (finished) {
      line = `Timer finished — ${formatTime(totalSeconds)}`;
    } else {
      line = `Stopped — ${formatTime(remaining)} remaining`;
    }
    process.stdout.write(fg(...GRAY, line) + '\n');

    laps.forEach((value, i) => {
      const split = i > 0 ? `  +${formatTime(Math.abs(value - laps[i - 1]))}` : '';
      process.stdout.write(
        fg(...GRAY, `  LAP ${String(i + 1).padStart(2, '0')}  ${formatTime(value)}${split}`) + '\n',
      );
    });
  }

  function cleanup(exitCode) {
    if (exiting) return;
    exiting = true;
    if (interval) clearInterval(interval);
    if (animInterval) clearInterval(animInterval);
    clearStartle();
    process.stdout.write(DISABLE_MOUSE + SHOW_CURSOR + EXIT_ALT_SCREEN);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    printSummary();
    process.exit(exitCode);
  }

  // Returns true when the chunk was a mouse report, so it is not also read as
  // a keypress. Only the last position in the chunk matters.
  function handleMouse(data) {
    if (!slime || !args.mouse) return false;
    const text = data.toString('utf8');
    MOUSE_REPORT.lastIndex = 0;
    let match;
    let last = null;
    while ((match = MOUSE_REPORT.exec(text)) !== null) last = match;
    if (!last) return false;

    const col = Number(last[1]);
    const row = Number(last[2]);
    const over = isOverSlime(
      slime,
      process.stdout.columns || 80,
      process.stdout.rows || 24,
      col,
      row,
    );
    if (over !== slime.hovered) {
      // Only the flag is touched here. Advancing the slime from this handler
      // gave it an extra movement step on every boundary crossing, so waggling
      // the pointer across its edge dragged it along.
      slime.hovered = over;
      if (over) startStartle();
      draw();
    }
    return true;
  }

  function onData(data) {
    if (handleMouse(data)) return;
    const byte = data[0];
    if (byte === 0x03) {
      cleanup(0); // Ctrl+C
      return;
    }
    if (byte === 0x09) {
      inverted = !inverted; // Tab
      draw();
      return;
    }
    if (finished) {
      cleanup(0); // any other key after completion
      return;
    }
    if (isClock) {
      // Lapping, pausing and resetting are meaningless against wall time.
      if (data.toString('utf8').toLowerCase() === 'q') cleanup(0);
      return;
    }
    if (byte === 0x0d || byte === 0x0a) {
      laps.push(isStopwatch ? elapsed : remaining); // Enter
      draw();
      return;
    }
    if (byte === 0x20) {
      paused = !paused; // Space
      draw();
      return;
    }
    if (byte === 0x7f || byte === 0x08) {
      // Backspace — back to the starting point, clearing laps that would
      // otherwise refer to a run that no longer exists.
      elapsed = 0;
      remaining = totalSeconds;
      laps.length = 0;
      draw();
      return;
    }
    if (data.toString('utf8').toLowerCase() === 'q') {
      cleanup(0);
    }
  }

  process.stdout.write(ENTER_ALT_SCREEN + CLEAR_SCREEN + HIDE_CURSOR);
  if (slime && args.mouse) process.stdout.write(ENABLE_MOUSE);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', onData);
  process.stdout.on('resize', draw);
  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));

  stepSlime(); // center it before the first paint
  draw();
  interval = setInterval(() => {
    if (paused) return;
    if (isClock) {
      draw(); // the time is read fresh at paint time
      return;
    }
    if (isStopwatch) {
      elapsed += 1;
      draw();
      return;
    }
    remaining -= 1;
    if (remaining <= 0 && !finished) {
      remaining = 0;
      finished = true;
      draw();
      if (!args.silent) beep(3);
      return;
    }
    draw();
  }, 1000);

  // The slime animates faster than the clock ticks. Paused means asleep, so
  // nothing moves and there is nothing to repaint.
  if (args.slime) {
    animInterval = setInterval(() => {
      if (paused) return;
      stepSlime();
      draw();
    }, 250);
  }
}

module.exports = { run, parseArgs };
