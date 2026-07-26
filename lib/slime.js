'use strict';

// Behaviour and sprite for the little slime. Kept apart from the renderer so
// that renderFrame stays a pure function of the state it is handed, while the
// wandering and glancing accumulate here across animation ticks.

// 8 wide rather than 7: with the eyes 2 tiles apart their columns differ by
// 3, and an odd width cannot centre that span — one side ends up a tile
// thinner, and a glance then pushes the leading eye onto the edge, where it
// reads as a bite out of the outline instead of an eye.
const WIDTH = 8;
const HEIGHT = 4;
// One row of air above the body so it has somewhere to jump to.
const BAND_HEIGHT = HEIGHT + 1;
const MARGIN = 1;

// Ticks are 250ms, so 4 per second.
const MOVE_SPEED = 2; // columns per tick while travelling
const REST_MIN = 16; // 4s
const REST_MAX = 40; // 10s
const LOOK_DELAY_MIN = 20; // 5s
const LOOK_DELAY_MAX = 60; // 15s
const BLINK_GAP_MIN = 12; // 3s
const BLINK_GAP_MAX = 16; // 4s
const BLINK_TICKS = 2; // eyes stay shut 500ms
const BLINKS_MIN = 1;
const BLINKS_MAX = 4;

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function createSlime() {
  return {
    x: null, // centered on the first update, once the width is known
    target: null,
    rest: randInt(REST_MIN, REST_MAX),
    look: 'center', // 'center' | 'left' | 'right' — a glance up at the clock
    moveDir: null, // 'left' | 'right' while travelling, null when stopped
    shut: false,
    hovered: false, // set from mouse reports, when the terminal sends them
    airborne: false, // mid startle-jump, driven by timers in the caller
    lookDelay: randInt(LOOK_DELAY_MIN, LOOK_DELAY_MAX),
    blinksLeft: 0,
    nextBlink: 0,
    blinkTicks: 0,
  };
}

// Where the slime is sitting on screen, in the 1-indexed cell coordinates
// that terminals report mouse positions in. It occupies the last rows of the
// interior, and column 1 is the left border, so interior offset 0 is column 2.
function slimeHitbox(rows, x) {
  return {
    top: rows - HEIGHT,
    bottom: rows - 1,
    left: x + 2,
    right: x + 1 + WIDTH,
  };
}

function isOverSlime(state, cols, rows, col, row) {
  if (state.x === null) return false;
  const box = slimeHitbox(rows, state.x);
  return col >= box.left && col <= box.right && row >= box.top && row <= box.bottom;
}

function maxXFor(interior) {
  return Math.max(MARGIN, interior - WIDTH - MARGIN);
}

// Targets are always a real distance away — at least a quarter of the box —
// so the slime crosses the floor in one purposeful trip rather than jittering
// back and forth a column at a time.
function pickTarget(x, interior) {
  const maxX = maxXFor(interior);
  const minDist = Math.max(2, Math.floor(interior / 4));

  const ranges = [];
  if (x - minDist >= MARGIN) ranges.push([MARGIN, x - minDist]);
  if (x + minDist <= maxX) ranges.push([x + minDist, maxX]);
  if (ranges.length === 0) return x > (MARGIN + maxX) / 2 ? MARGIN : maxX;

  const [lo, hi] = ranges[randInt(0, ranges.length - 1)];
  return randInt(lo, hi);
}

function updateMovement(state, interior) {
  const maxX = maxXFor(interior);
  state.x = Math.min(maxX, Math.max(MARGIN, state.x));

  if (state.target === null) state.target = state.x;
  state.target = Math.min(maxX, Math.max(MARGIN, state.target));

  if (state.x !== state.target) {
    const delta = state.target - state.x;
    state.moveDir = delta > 0 ? 'right' : 'left';
    const step = Math.sign(delta) * Math.min(MOVE_SPEED, Math.abs(delta));
    state.x += step;
    return;
  }

  state.moveDir = null;
  state.rest -= 1;
  if (state.rest <= 0) {
    state.target = pickTarget(state.x, interior);
    state.rest = randInt(REST_MIN, REST_MAX);
  }
}

// The clock sits in the middle, so a glance goes whichever way it lies.
function facing(state, interior) {
  return state.x + WIDTH / 2 < interior / 2 ? 'right' : 'left';
}

function updateEyes(state, interior) {
  if (state.blinkTicks === 0) state.shut = false;

  if (state.look === 'center') {
    state.lookDelay -= 1;
    if (state.lookDelay <= 0) {
      state.blinksLeft = randInt(BLINKS_MIN, BLINKS_MAX);
      state.nextBlink = randInt(BLINK_GAP_MIN, BLINK_GAP_MAX);
      state.blinkTicks = 0;
      state.look = facing(state, interior);
    }
    return;
  }

  if (state.blinkTicks > 0) {
    // Mid-blink the direction is frozen: eyes never swing across while shut.
    state.blinkTicks -= 1;
    if (state.blinkTicks === 0) {
      state.shut = false;
      // Reopening is the only moment the direction may change, so a change is
      // always hidden behind a blink. If the slime crossed the middle since
      // the eyes closed, the clock is now the other way and it reopens
      // looking the opposite way to before.
      state.look = facing(state, interior);
      state.blinksLeft -= 1;
      if (state.blinksLeft <= 0) {
        // The glance lasts as long as its blinks do, then it faces front.
        state.look = 'center';
        state.lookDelay = randInt(LOOK_DELAY_MIN, LOOK_DELAY_MAX);
      } else {
        state.nextBlink = randInt(BLINK_GAP_MIN, BLINK_GAP_MAX);
      }
    }
    return;
  }

  state.nextBlink -= 1;
  if (state.nextBlink <= 0) {
    state.shut = true;
    state.blinkTicks = BLINK_TICKS;
  }
}

function updateSlime(state, interior, paused) {
  if (state.x === null) {
    state.x = Math.floor((MARGIN + maxXFor(interior)) / 2);
    state.target = state.x;
  }
  if (paused) {
    state.shut = true;
    state.look = 'center';
    return state;
  }
  if (state.hovered) {
    // Noticed the pointer: stops where it is and looks straight at you until
    // the mouse moves off again. The startle-jump itself is timed by the
    // caller, since it is far quicker than the animation tick.
    state.shut = false;
    state.look = 'center';
    state.moveDir = null;
    state.blinkTicks = 0;
    return state;
  }
  updateMovement(state, interior);
  updateEyes(state, interior);
  return state;
}

// Eyes are unlit tiles with a solid tile on every side, so they read as holes
// in a face rather than notches in the outline — including when the glance
// shifts them a tile up and a tile sideways.
// Eye columns for each horizontal direction, and the row the eyes sit on:
// the upper row while glancing at the clock, the lower one the rest of the
// time. Every combination keeps a solid tile on all four sides of each eye.
const EYE_COLUMNS = { center: [2, 5], right: [3, 6], left: [1, 4] };
const ROW_UP = 1;
const ROW_DOWN = 2;

function slimeSprite(state) {
  const rows = [];
  for (let r = 0; r < HEIGHT; r++) rows.push('█'.repeat(WIDTH).split(''));
  if (state.shut) return rows.map((r) => r.join(''));

  let row;
  let columns;
  if (state.hovered) {
    // Looking straight at you, with its ordinary eyes.
    row = ROW_DOWN;
    columns = EYE_COLUMNS.center;
  } else if (state.look !== 'center') {
    // Glancing up at the clock.
    row = ROW_UP;
    columns = EYE_COLUMNS[state.look];
  } else {
    // At rest the eyes sit low, turned the way it is travelling — or straight
    // down when it has stopped.
    row = ROW_DOWN;
    columns = EYE_COLUMNS[state.moveDir || 'center'];
  }

  for (const c of columns) rows[row][c] = ' ';
  return rows.map((r) => r.join(''));
}

module.exports = {
  WIDTH,
  HEIGHT,
  BAND_HEIGHT,
  MARGIN,
  createSlime,
  updateSlime,
  slimeSprite,
  slimeHitbox,
  isOverSlime,
};
