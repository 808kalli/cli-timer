'use strict';

const { GLYPH_HEIGHT, glyphRows, glyphWidth } = require('./font');
const { fg, bgSeq, visibleLength, DARK, LIGHT, RESET } = require('./colors');

const MAX_HREPEAT = 2;
const MAX_VREPEAT = 2;
const MAX_LAP_ROWS = 6;

// Always hh:mm:ss, zero-padded — the hours field stays on screen even at
// 00 so the readout never changes width as time crosses an hour boundary.
function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':');
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

function buildProgressBar(width, fraction, theme) {
  const barWidth = Math.max(10, Math.min(width, 40));
  const filled = Math.round(barWidth * fraction);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = `${Math.round(fraction * 100)}%`.padStart(4, ' ');
  return fg(...theme.accent, `[${bar}]`) + ' ' + fg(...theme.gray, pct);
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

function bottomBorder(width, hint, color, theme) {
  return borderLine(width, ['╚', '╝'], ` ${hint} `, color, theme.gray, 'right');
}

function sideRow(width, content, color) {
  const interior = center(content || '', width - 2);
  return fg(...color, '║') + interior + fg(...color, '║');
}

const LAP_INDENT = 2;

function leftRow(width, content, color) {
  const interior = width - 2;
  const pad = Math.max(0, interior - LAP_INDENT - visibleLength(content));
  return (
    fg(...color, '║') +
    ' '.repeat(LAP_INDENT) +
    content +
    ' '.repeat(pad) +
    fg(...color, '║')
  );
}

// One lap entry: index, the time it was taken at, and the split from the
// previous lap. Trailing fields are dropped rather than wrapped when the
// terminal is too narrow to hold them.
function buildLapLine(index, value, prevValue, theme, maxWidth) {
  const parts = [`LAP ${String(index).padStart(2, '0')}`, formatTime(value)];
  if (prevValue !== null) parts.push(`+${formatTime(Math.abs(value - prevValue))}`);

  while (parts.length > 1 && parts.join('  ').length > maxWidth) parts.pop();
  if (parts.join('  ').length > maxWidth) {
    return fg(...theme.gray, parts[0].slice(0, Math.max(0, maxWidth)));
  }

  const [label, time, split] = parts;
  return (
    fg(...theme.gray, label) +
    (time ? '  ' + fg(...theme.accent, time) : '') +
    (split ? '  ' + fg(...theme.gray, split) : '')
  );
}

function buildLapLines(laps, theme, maxWidth, maxRows) {
  if (maxRows <= 0 || laps.length === 0) return [];
  const start = Math.max(0, laps.length - maxRows);
  const lines = [];
  for (let i = start; i < laps.length; i++) {
    lines.push(buildLapLine(i + 1, laps[i], i > 0 ? laps[i - 1] : null, theme, maxWidth));
  }
  return lines;
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
  inverted = false,
  laps = [],
  paused = false,
}) {
  const width = Math.max(cols, 20);
  const height = Math.max(rows, 10);
  const isStopwatch = mode === 'stopwatch';
  const timeString = formatTime(isStopwatch ? elapsedSeconds : remainingSeconds);
  const chars = timeString.split('');

  const theme = inverted ? LIGHT : DARK;
  const color = finished ? theme.alert : theme.accent;

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
    contentBlock.push('', fg(...theme.alert, "*** TIME'S UP ***"));
  } else if (paused) {
    // Replaces the progress bar rather than sitting beside it — the combined
    // width would overflow the interior on a narrow terminal.
    contentBlock.push('', fg(...theme.alert, '▌▌ PAUSED'));
  } else if (!isStopwatch) {
    const fraction = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds)) : 1;
    contentBlock.push('', buildProgressBar(width - 10, fraction, theme));
  }

  const interiorHeight = height - 2;

  // Laps sit flush against the bottom-left, claiming rows from the bottom
  // padding only — the digits stay centered in whatever space is left, so a
  // growing lap list never pushes them off-center or off-screen.
  const freeRows = Math.max(0, interiorHeight - contentBlock.length);
  const lapLines = buildLapLines(
    laps,
    theme,
    Math.max(0, width - 2 - LAP_INDENT * 2),
    Math.max(0, Math.min(freeRows - 1, MAX_LAP_ROWS)),
  );

  const centeredHeight = interiorHeight - lapLines.length;
  const topPad = Math.max(0, Math.floor((centeredHeight - contentBlock.length) / 2));
  const bottomPad = Math.max(0, centeredHeight - contentBlock.length - topPad);

  const hint = finished
    ? 'press any key to exit'
    : `ENTER lap · SPACE ${paused ? 'resume' : 'pause'} · TAB invert · Q ${isStopwatch ? 'stop' : 'quit'}`;

  const out = [];
  out.push(topBorder(width, title, color));
  for (let i = 0; i < topPad; i++) out.push(sideRow(width, '', color));
  for (const line of contentBlock) out.push(sideRow(width, line, color));
  for (let i = 0; i < bottomPad; i++) out.push(sideRow(width, '', color));
  for (const line of lapLines) out.push(leftRow(width, line, color));
  out.push(bottomBorder(width, hint, color, theme));

  // Paint the row's background across its full width, then hard-reset at the
  // end of the line. Inner segments only reset the foreground, so the
  // background survives from the start of the row to the terminating reset.
  const bg = bgSeq(theme.bg);
  return out.map((line) => bg + line + RESET).join('\r\n');
}

module.exports = { renderFrame, formatTime };
