'use strict';

const { parseDuration } = require('./parseDuration');
const { renderFrame, formatTime } = require('./render');
const { createSlime, updateSlime } = require('./slime');
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
      --no-slime        hide the hopping slime
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
    } else if (a === '-t' || a === '--title') {
      args.title = argv[++i] || args.title;
    } else {
      rest.push(a);
    }
  }
  if (rest.length > 0 && ['stopwatch', 'sw'].includes(rest[0].toLowerCase())) {
    args.mode = 'stopwatch';
  } else if (rest.length > 0) {
    args.duration = rest.join(' ');
  }
  if (args.title === null) {
    args.title = args.mode === 'stopwatch' ? 'STOPWATCH' : 'CYBER TIMER';
  }
  return args;
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

  if (args.help || (!isStopwatch && !args.duration)) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }

  let totalSeconds = null;
  if (!isStopwatch) {
    totalSeconds = parseDuration(args.duration);
    if (totalSeconds === null || totalSeconds <= 0) {
      process.stderr.write(fg(...ACCENT, `Could not parse duration "${args.duration}".`) + '\n');
      process.stdout.write(HELP);
      process.exit(1);
    }
  }

  if (!process.stdout.isTTY) {
    process.stderr.write('cyber-timer needs an interactive terminal to run.\n');
    process.exit(1);
  }

  let remaining = totalSeconds;
  let elapsed = 0;
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
      inverted,
      laps,
      paused,
      slime,
    });
    process.stdout.write(CURSOR_HOME + frame);
  }

  function printSummary() {
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
    process.stdout.write(SHOW_CURSOR + EXIT_ALT_SCREEN);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    printSummary();
    process.exit(exitCode);
  }

  function onData(data) {
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
