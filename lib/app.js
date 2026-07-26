'use strict';

const { parseDuration } = require('./parseDuration');
const { renderFrame } = require('./render');
const {
  HIDE_CURSOR,
  SHOW_CURSOR,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  CURSOR_HOME,
  CLEAR_SCREEN,
  fg,
  NEON_CYAN,
  NEON_MAGENTA,
  GRAY,
} = require('./colors');

const HELP = `
${fg(...NEON_CYAN, 'cyber-timer')} — a full-screen neon countdown timer for your terminal

${fg(...NEON_MAGENTA, 'Usage:')}
  cyber-timer <duration> [options]

${fg(...NEON_MAGENTA, 'Duration formats:')}
  25            25 minutes
  25m           25 minutes
  90s           90 seconds
  1h30m         1 hour 30 minutes
  10:00         mm:ss
  1:10:00       hh:mm:ss

${fg(...NEON_MAGENTA, 'Options:')}
  -t, --title <text>   custom label shown in the title bar (default: CYBER TIMER)
  -s, --silent          disable the completion beep
  -h, --help            show this help

${fg(...NEON_MAGENTA, 'Examples:')}
  cyber-timer 25
  cyber-timer 90s --title "BREAK"
  cyber-timer 1h --silent
`;

function parseArgs(argv) {
  const args = { title: 'CYBER TIMER', silent: false, help: false, duration: null };
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
  if (rest.length > 0) args.duration = rest.join(' ');
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

  if (args.help || !args.duration) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }

  const totalSeconds = parseDuration(args.duration);
  if (totalSeconds === null || totalSeconds <= 0) {
    process.stderr.write(fg(...NEON_MAGENTA, `Could not parse duration "${args.duration}".`) + '\n');
    process.stdout.write(HELP);
    process.exit(1);
  }

  if (!process.stdout.isTTY) {
    process.stderr.write('cyber-timer needs an interactive terminal to run.\n');
    process.exit(1);
  }

  let remaining = totalSeconds;
  let finished = false;
  let interval = null;
  let exiting = false;

  function draw() {
    const frame = renderFrame({
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      title: args.title,
      remainingSeconds: remaining,
      totalSeconds,
      finished,
    });
    process.stdout.write(CURSOR_HOME + frame);
  }

  function cleanup(exitCode) {
    if (exiting) return;
    exiting = true;
    if (interval) clearInterval(interval);
    process.stdout.write(SHOW_CURSOR + EXIT_ALT_SCREEN);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
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
