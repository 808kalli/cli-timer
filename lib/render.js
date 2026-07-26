'use strict';

const { FONT, GLYPH_HEIGHT, glyphWidth } = require('./font');
const {
  fg,
  lerpColor,
  visibleLength,
  NEON_CYAN,
  NEON_MAGENTA,
  NEON_PURPLE,
  NEON_RED,
  GRAY,
} = require('./colors');

function formatTime(totalSeconds, seconds) {
  const s = Math.max(0, Math.round(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (totalSeconds >= 3600) {
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// Picks how many times to repeat each font pixel horizontally/vertically so
// the digits fill the terminal without ever overflowing it. hRepeat and
// vRepeat are solved independently (then hRepeat is capped relative to
// vRepeat) since monospace cells are roughly twice as tall as wide.
function pickScale(timeString, cols, rows) {
  const chars = timeString.split('');
  const glyphColumns = chars.reduce((sum, c) => sum + glyphWidth(c), 0);
  const numGaps = chars.length - 1;
  const availableWidth = Math.max(cols - 6, 6);
  const availableHeight = Math.max(rows - 8, GLYPH_HEIGHT + 2);

  const vRepeat = Math.max(1, Math.min(Math.floor(availableHeight / GLYPH_HEIGHT), 6));
  const hRepeatMax = Math.floor((availableWidth - numGaps * vRepeat) / glyphColumns);
  const hRepeat = Math.max(1, Math.min(hRepeatMax, vRepeat * 3, 12));

  return { hRepeat, vRepeat };
}

function buildDigitRows(timeString, scale, topColor, bottomColor) {
  const { hRepeat, vRepeat } = scale;
  const chars = timeString.split('');
  const totalRows = GLYPH_HEIGHT * vRepeat;
  const lines = [];

  for (let glyphRow = 0; glyphRow < GLYPH_HEIGHT; glyphRow++) {
    let rawLine = '';
    chars.forEach((ch, i) => {
      const glyph = FONT[ch] || FONT[' '];
      const pattern = glyph[glyphRow] || '';
      let cell = '';
      for (const px of pattern) {
        cell += (px === '#' ? '█' : ' ').repeat(hRepeat);
      }
      rawLine += cell;
      if (i < chars.length - 1) rawLine += ' '.repeat(vRepeat);
    });
    for (let r = 0; r < vRepeat; r++) {
      const rowIndex = glyphRow * vRepeat + r;
      const t = totalRows === 1 ? 0 : rowIndex / (totalRows - 1);
      const [cr, cg, cb] = lerpColor(topColor, bottomColor, t);
      lines.push(fg(cr, cg, cb, rawLine));
    }
  }
  return lines;
}

function buildProgressBar(width, fraction) {
  const barWidth = Math.max(10, Math.min(width, 40));
  const filled = Math.round(barWidth * fraction);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = `${Math.round(fraction * 100)}%`.padStart(4, ' ');
  return fg(...NEON_PURPLE, `[${bar}]`) + ' ' + fg(...GRAY, pct);
}

function center(text, width) {
  const len = visibleLength(text);
  if (len >= width) return text;
  const left = Math.floor((width - len) / 2);
  const right = width - len - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

// Builds a border line of exactly `width` visible columns, embedding a
// colored label near one edge. Truncates or drops the label entirely when
// the terminal is too narrow to fit it, so the row width is never wrong.
function borderLine(width, corners, label, labelColor, bias) {
  const interior = Math.max(width - 2, 0);
  const border = fg(...NEON_MAGENTA, '═');
  let text = label;
  if (text.length > interior) text = text.slice(0, interior);
  const remaining = interior - text.length;
  const nearFill = Math.min(3, remaining);
  const farFill = remaining - nearFill;
  const leftFill = bias === 'left' ? nearFill : farFill;
  const rightFill = bias === 'left' ? farFill : nearFill;
  return (
    fg(...NEON_MAGENTA, corners[0]) +
    border.repeat(leftFill) +
    fg(...labelColor, text) +
    border.repeat(rightFill) +
    fg(...NEON_MAGENTA, corners[1])
  );
}

function topBorder(width, title) {
  return borderLine(width, ['╔', '╗'], ` ${title} `, NEON_CYAN, 'left');
}

function bottomBorder(width, hint) {
  return borderLine(width, ['╚', '╝'], ` ${hint} `, GRAY, 'right');
}

function sideRow(width, content) {
  const interior = center(content || '', width - 2);
  return fg(...NEON_MAGENTA, '║') + interior + fg(...NEON_MAGENTA, '║');
}

function renderFrame({ cols, rows, title, remainingSeconds, totalSeconds, finished }) {
  const width = Math.max(cols, 20);
  const height = Math.max(rows, 10);
  const timeString = formatTime(totalSeconds, remainingSeconds);

  const topColor = finished ? NEON_RED : NEON_CYAN;
  const bottomColor = finished ? NEON_MAGENTA : NEON_MAGENTA;

  const chars = timeString.split('');
  const minContentWidth =
    chars.reduce((sum, c) => sum + glyphWidth(c), 0) + (chars.length - 1);

  let digitRows;
  if (width - 2 < minContentWidth + 2) {
    // Too narrow for the big blocky font — fall back to plain colored text.
    digitRows = [fg(...topColor, timeString)];
  } else {
    const scale = pickScale(timeString, width, height);
    digitRows = buildDigitRows(timeString, scale, topColor, bottomColor);
  }
  const fraction = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds)) : 1;
  const progressBar = finished
    ? fg(...NEON_RED, '*** TIME\'S UP ***')
    : buildProgressBar(width - 10, fraction);

  const contentBlock = [...digitRows, '', progressBar];
  const interiorHeight = height - 2;
  const topPad = Math.max(0, Math.floor((interiorHeight - contentBlock.length) / 2));
  const bottomPad = Math.max(0, interiorHeight - contentBlock.length - topPad);

  const out = [];
  out.push(topBorder(width, title));
  for (let i = 0; i < topPad; i++) out.push(sideRow(width, ''));
  for (const line of contentBlock) out.push(sideRow(width, line));
  for (let i = 0; i < bottomPad; i++) out.push(sideRow(width, ''));
  out.push(bottomBorder(width, finished ? 'press any key to exit' : 'Q / Ctrl+C to quit'));

  return out.join('\r\n');
}

module.exports = { renderFrame, formatTime };
