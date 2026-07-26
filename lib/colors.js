'use strict';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const ENTER_ALT_SCREEN = '\x1b[?1049h';
const EXIT_ALT_SCREEN = '\x1b[?1049l';
const CURSOR_HOME = '\x1b[H';
const CLEAR_SCREEN = '\x1b[2J';

function fg(r, g, b, text) {
  return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

// Single flat accent — every element (border, digits, title) uses this same
// tone rather than shifting hue across characters.
const ACCENT = [64, 200, 255];
const ALERT = [255, 70, 90];
const GRAY = [105, 115, 130];

function visibleLength(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

module.exports = {
  RESET,
  DIM,
  HIDE_CURSOR,
  SHOW_CURSOR,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  CURSOR_HOME,
  CLEAR_SCREEN,
  fg,
  ACCENT,
  ALERT,
  GRAY,
  visibleLength,
};
