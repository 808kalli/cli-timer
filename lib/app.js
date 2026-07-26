'use strict';

const { parseDuration } = require('./parseDuration');
const { renderFrame, formatTime } = require('./render');
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
${fg(...ACCENT, 'cyber-timer')} — a full-screen neon countdown timer & stopwatch for your terminal

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
  -h, --help            show this help

${fg(...ACCENT, 'Examples:')}
  cyber-timer 25
  cyber-timer 90s --title "BREAK"
  cyber-timer 1h --silent
  cyber-timer stopwatch
  cyber-timer sw --title "LAP"
`;

function parseArgs(argv) {
  const args = { title: null, silent: false, help: false, duration: null, mode: 'countdown' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      args.help = true;
    } else if (a === '-s' || a === '--silent') {
      args.silent = true;
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
  let exiting = false;

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
    });
    process.stdout.write(CURSOR_HOME + frame);
  }

  function printSummary() {
    let line;
    if (isStopwatch) {
      line = `Stopped — elapsed ${formatTime(elapsed, elapsed)}`;
    } else if (finished) {
      line = `Timer finished — ${formatTime(totalSeconds, totalSeconds)}`;
    } else {
      line = `Stopped — ${formatTime(totalSeconds, remaining)} remaining`;
    }
    process.stdout.write(fg(...GRAY, line) + '\n');
  }

  function cleanup(exitCode) {
    if (exiting) return;
    exiting = true;
    if (interval) clearInterval(interval);
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
    if (finished) {
      cleanup(0); // any key after completion
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

  draw();
  interval = setInterval(() => {
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
}

module.exports = { run, parseArgs };
