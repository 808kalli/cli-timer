'use strict';

// Thin-line seven-segment digits, built procedurally instead of pre-baked
// pixel art. Segments: a=top, b=top-right, c=bottom-right, d=bottom,
// e=bottom-left, f=top-left, g=middle.
const SEGMENTS = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgecd',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

const GLYPH_HEIGHT = 5;
const BAR_UNITS = 2; // horizontal segment length at hRepeat 1

// Builds the 5 logical rows for a digit at a given bar length (hRepeat).
// Vertical strokes stay exactly one column wide regardless of hRepeat —
// only the horizontal bars (and the gap between the side columns) stretch —
// which keeps the glyph looking like a slim LCD readout instead of a
// chunky filled block even as it scales up.
function digitRows(char, hRepeat) {
  const on = SEGMENTS[char] || '';
  const barLen = BAR_UNITS * hRepeat;
  const bar = (seg) => (on.includes(seg) ? '─'.repeat(barLen) : ' '.repeat(barLen));
  const side = (seg) => (on.includes(seg) ? '│' : ' ');
  return [
    ' ' + bar('a') + ' ',
    side('f') + ' '.repeat(barLen) + side('b'),
    ' ' + bar('g') + ' ',
    side('e') + ' '.repeat(barLen) + side('c'),
    ' ' + bar('d') + ' ',
  ];
}

function colonRows() {
  return ['  ', ' •', '  ', ' •', '  '];
}

function glyphRows(char, hRepeat) {
  if (char === ':') return colonRows();
  if (char === ' ') return [' ', ' ', ' ', ' ', ' '];
  return digitRows(char, hRepeat);
}

function glyphWidth(char, hRepeat) {
  if (char === ':' || char === ' ') return char === ':' ? 2 : 1;
  return 2 + BAR_UNITS * hRepeat;
}

module.exports = { GLYPH_HEIGHT, BAR_UNITS, glyphRows, glyphWidth };
