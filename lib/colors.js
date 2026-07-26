'use strict';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
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

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function lerpColor(from, to, t) {
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
}

const NEON_CYAN = [0, 255, 240];
const NEON_MAGENTA = [255, 0, 170];
const NEON_PURPLE = [180, 70, 255];
const NEON_RED = [255, 40, 60];
const GRAY = [110, 110, 130];

function visibleLength(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

module.exports = {
  RESET,
  BOLD,
  DIM,
  HIDE_CURSOR,
  SHOW_CURSOR,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  CURSOR_HOME,
  CLEAR_SCREEN,
  fg,
  lerpColor,
  NEON_CYAN,
  NEON_MAGENTA,
  NEON_PURPLE,
  NEON_RED,
  GRAY,
  visibleLength,
};
