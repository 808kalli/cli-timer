'use strict';

const { GLYPH_HEIGHT, glyphRows, glyphWidth } = require('./font');
const { fg, visibleLength, ACCENT, ALERT, GRAY } = require('./colors');

const MAX_HREPEAT = 2;
const MAX_VREPEAT = 2;

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

function minContentWidth(chars) {
  return chars.reduce((sum, c) => sum + glyphWidth(c, 1), 0) + (chars.length - 1);
}

// Solves hRepeat/vRepeat to keep the digits compact (capped well below what
// the terminal could hold) rather than stretching to fill the screen. Every
// glyph column scales with hRepeat, including the inter-glyph gap, so the
// whole readout is (unitTotal + gaps) * hRepeat columns wide.
function pickScale(chars, cols, rows) {
  const availableWidth = Math.max(cols - 6, 6);
  const availableHeight = Math.max(rows - 6, GLYPH_HEIGHT + 2);

  const vRepeat = Math.max(1, Math.min(Math.floor(availableHeight / GLYPH_HEIGHT), MAX_VREPEAT));

  const unitTotal = chars.reduce((sum, c) => sum + glyphWidth(c, 1), 0) + (chars.length - 1);
  const hRepeat = Math.max(1, Math.min(Math.floor(availableWidth / unitTotal), MAX_HREPEAT));

  return { hRepeat, vRepeat };
}

function buildDigitRows(chars, scale, color) {
  const { hRepeat, vRepeat } = scale;
  const lines = [];

  for (let glyphRow = 0; glyphRow < GLYPH_HEIGHT; glyphRow++) {
    let rawLine = '';
    chars.forEach((ch, i) => {
      rawLine += glyphRows(ch, hRepeat)[glyphRow];
      if (i < chars.length - 1) rawLine += ' '.repeat(hRepeat);
    });
    const colored = fg(...color, rawLine);
    for (let r = 0; r < vRepeat; r++) lines.push(colored);
  }
  return lines;
}

function buildProgressBar(width, fraction) {
  const barWidth = Math.max(10, Math.min(width, 40));
  const filled = Math.round(barWidth * fraction);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = `${Math.round(fraction * 100)}%`.padStart(4, ' ');
  return fg(...ACCENT, `[${bar}]`) + ' ' + fg(...GRAY, pct);
}

function center(text, width) {
  const len = visibleLength(text);
  if (len >= width) return text;
  const left = Math.floor((width - len) / 2);
  const right = width - len - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

// Builds a border line of exactly `width` visible columns, embedding a
// label near one edge. Truncates or drops the label entirely when the
// terminal is too narrow to fit it, so the row width is never wrong.
function borderLine(width, corners, label, borderColor, labelColor, bias) {
  const interior = Math.max(width - 2, 0);
  const border = fg(...borderColor, '═');
  let text = label;
  if (text.length > interior) text = text.slice(0, interior);
  const remaining = interior - text.length;
  const nearFill = Math.min(3, remaining);
  const farFill = remaining - nearFill;
  const leftFill = bias === 'left' ? nearFill : farFill;
  const rightFill = bias === 'left' ? farFill : nearFill;
  return (
    fg(...borderColor, corners[0]) +
    border.repeat(leftFill) +
    fg(...labelColor, text) +
    border.repeat(rightFill) +
    fg(...borderColor, corners[1])
  );
}

function topBorder(width, title, color) {
  return borderLine(width, ['╔', '╗'], ` ${title} `, color, color, 'left');
}

function bottomBorder(width, hint, color) {
  return borderLine(width, ['╚', '╝'], ` ${hint} `, color, GRAY, 'right');
}

function sideRow(width, content, color) {
  const interior = center(content || '', width - 2);
  return fg(...color, '║') + interior + fg(...color, '║');
}

function renderFrame({
  cols,
  rows,
  title,
  mode = 'countdown',
  remainingSeconds,
  totalSeconds,
  finished,
  elapsedSeconds,
}) {
  const width = Math.max(cols, 20);
  const height = Math.max(rows, 10);
  const isStopwatch = mode === 'stopwatch';
  const seconds = isStopwatch ? elapsedSeconds : remainingSeconds;
  const formatBasis = isStopwatch ? elapsedSeconds : totalSeconds;
  const timeString = formatTime(formatBasis, seconds);
  const chars = timeString.split('');

  const color = finished ? ALERT : ACCENT;

  let digitRows;
  if (width - 2 < minContentWidth(chars) + 2) {
    // Too narrow for the segment font — fall back to plain colored text.
    digitRows = [fg(...color, timeString)];
  } else {
    const scale = pickScale(chars, width, height);
    digitRows = buildDigitRows(chars, scale, color);
  }

  const contentBlock = [...digitRows];
  if (finished) {
    contentBlock.push('', fg(...ALERT, "*** TIME'S UP ***"));
  } else if (!isStopwatch) {
    const fraction = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds)) : 1;
    contentBlock.push('', buildProgressBar(width - 10, fraction));
  }

  const interiorHeight = height - 2;
  const topPad = Math.max(0, Math.floor((interiorHeight - contentBlock.length) / 2));
  const bottomPad = Math.max(0, interiorHeight - contentBlock.length - topPad);

  const hint = finished
    ? 'press any key to exit'
    : isStopwatch
      ? 'Q / Ctrl+C to stop'
      : 'Q / Ctrl+C to quit';

  const out = [];
  out.push(topBorder(width, title, color));
  for (let i = 0; i < topPad; i++) out.push(sideRow(width, '', color));
  for (const line of contentBlock) out.push(sideRow(width, line, color));
  for (let i = 0; i < bottomPad; i++) out.push(sideRow(width, '', color));
  out.push(bottomBorder(width, hint, color));

  return out.join('\r\n');
}

module.exports = { renderFrame, formatTime };
