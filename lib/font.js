'use strict';

// Solid seven-segment digits, built procedurally. Segments: a=top,
// b=top-right, c=bottom-right, d=bottom, e=bottom-left, f=top-left,
// g=middle. Strokes are filled blocks, so a lit segment reads as one solid
// slab rather than an outline.
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
const BAR_UNITS = 2; // inner span between the two vertical strokes

const BLOCK = '█';

// At scale n a digit is (2 + BAR_UNITS) * n columns wide: an n-wide vertical
// stroke on each side plus a BAR_UNITS*n inner span. Horizontal bars fill the
// entire width so they join flush with the strokes.
function digitRows(char, scale) {
  const on = SEGMENTS[char] || '';
  const strokeW = scale;
  const innerW = BAR_UNITS * scale;
  const fullW = strokeW * 2 + innerW;

  const bar = (seg) => (on.includes(seg) ? BLOCK.repeat(fullW) : ' '.repeat(fullW));
  const stroke = (seg) => (on.includes(seg) ? BLOCK.repeat(strokeW) : ' '.repeat(strokeW));
  const sides = (left, right) => stroke(left) + ' '.repeat(innerW) + stroke(right);

  return [bar('a'), sides('f', 'b'), bar('g'), sides('e', 'c'), bar('d')];
}

function colonRows(scale) {
  const dot = BLOCK.repeat(scale);
  const gap = ' '.repeat(scale);
  return [gap, dot, gap, dot, gap];
}

function glyphRows(char, scale) {
  if (char === ':') return colonRows(scale);
  if (char === ' ') return Array(GLYPH_HEIGHT).fill(' '.repeat(scale));
  return digitRows(char, scale);
}

// Width in columns of one glyph at the given scale.
function glyphWidth(char, scale) {
  if (char === ':' || char === ' ') return scale;
  return (2 + BAR_UNITS) * scale;
}

module.exports = { GLYPH_HEIGHT, BAR_UNITS, glyphRows, glyphWidth };
