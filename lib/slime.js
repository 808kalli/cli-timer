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
    look: 'center', // 'center' | 'left' | 'right'
    shut: false,
    lookDelay: randInt(LOOK_DELAY_MIN, LOOK_DELAY_MAX),
    blinksLeft: 0,
    nextBlink: 0,
    blinkTicks: 0,
  };
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
    const step = Math.sign(delta) * Math.min(MOVE_SPEED, Math.abs(delta));
    state.x += step;
    return;
  }

  state.rest -= 1;
  if (state.rest <= 0) {
    state.target = pickTarget(state.x, interior);
    state.rest = randInt(REST_MIN, REST_MAX);
  }
}

function updateEyes(state, interior) {
  if (state.look === 'center') {
    state.lookDelay -= 1;
    if (state.lookDelay <= 0) {
      state.blinksLeft = randInt(BLINKS_MIN, BLINKS_MAX);
      state.nextBlink = randInt(BLINK_GAP_MIN, BLINK_GAP_MAX);
      state.blinkTicks = 0;
      state.look = 'right'; // replaced below by the direction of the clock
    }
  }

  if (state.look === 'center') return;

  // The clock sits in the middle, so glance whichever way it lies.
  state.look = state.x + WIDTH / 2 < interior / 2 ? 'right' : 'left';

  if (state.blinkTicks > 0) {
    state.blinkTicks -= 1;
    if (state.blinkTicks === 0) {
      state.shut = false;
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
  updateMovement(state, interior);
  updateEyes(state, interior);
  return state;
}

// Eyes are unlit tiles with a solid tile on every side, so they read as holes
// in a face rather than notches in the outline — including when the glance
// shifts them a tile up and a tile sideways.
const EYE_COLUMNS = { center: [2, 5], right: [3, 6], left: [1, 4] };
const EYE_ROW = { center: 2, right: 1, left: 1 };

function slimeSprite(state) {
  const rows = [];
  for (let r = 0; r < HEIGHT; r++) rows.push('█'.repeat(WIDTH).split(''));
  if (!state.shut) {
    const row = rows[EYE_ROW[state.look]];
    for (const c of EYE_COLUMNS[state.look]) row[c] = ' ';
  }
  return rows.map((r) => r.join(''));
}

module.exports = {
  WIDTH,
  HEIGHT,
  MARGIN,
  createSlime,
  updateSlime,
  slimeSprite,
};
