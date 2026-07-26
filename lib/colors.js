'use strict';

const RESET = '\x1b[0m';
const FG_RESET = '\x1b[39m';
const BG_RESET = '\x1b[49m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const ENTER_ALT_SCREEN = '\x1b[?1049h';
const EXIT_ALT_SCREEN = '\x1b[?1049l';
const CURSOR_HOME = '\x1b[H';
const CLEAR_SCREEN = '\x1b[2J';

// Resets the foreground only. A full reset would also drop the line's
// background, which the inverted theme paints across the whole row.
function fg(r, g, b, text) {
  return `\x1b[38;2;${r};${g};${b}m${text}${FG_RESET}`;
}

function bgSeq(color) {
  return color ? `\x1b[48;2;${color[0]};${color[1]};${color[2]}m` : BG_RESET;
}

// Two flat themes. Within each one every element (border, digits, title)
// shares a single tone rather than shifting hue across characters.
// Muted, low-saturation tones — an ember/ash orange rather than a bright
// neon one, so the readout sits back instead of glaring.
const DARK = {
  bg: null, // terminal default
  accent: [158, 104, 74],
  alert: [186, 118, 84],
  gray: [98, 92, 88],
};

// The flipped theme: a dark grey panel painted across the whole screen with a
// warm amber on top. Going light enough for dark text made the panel glare, so
// the flip is panel-vs-transparent rather than light-vs-dark, which also lets
// the accent stay a properly saturated orange instead of a near-black brown.
const LIGHT = {
  bg: [70, 68, 66],
  accent: [222, 138, 70],
  alert: [240, 118, 66],
  gray: [150, 142, 134],
};

const ACCENT = DARK.accent;
const GRAY = DARK.gray;

function visibleLength(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

module.exports = {
  RESET,
  FG_RESET,
  BG_RESET,
  HIDE_CURSOR,
  SHOW_CURSOR,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  CURSOR_HOME,
  CLEAR_SCREEN,
  fg,
  bgSeq,
  DARK,
  LIGHT,
  ACCENT,
  GRAY,
  visibleLength,
};
