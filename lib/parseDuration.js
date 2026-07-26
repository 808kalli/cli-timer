'use strict';

// Accepts: "25" (minutes), "25m", "90s", "1h30m", "2h", "10:00" (mm:ss),
// "1:10:00" (hh:mm:ss). Returns whole seconds, or null if unparseable.
function parseDuration(input) {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(raw)) {
    const parts = raw.split(':').map(Number);
    if (parts.length === 2) {
      const [m, s] = parts;
      if (s > 59) return null;
      return m * 60 + s;
    }
    const [h, m, s] = parts;
    if (m > 59 || s > 59) return null;
    return h * 3600 + m * 60 + s;
  }

  const unitPattern = /(\d+(?:\.\d+)?)\s*(h|m|s)/g;
  let match;
  let total = 0;
  let matched = false;
  while ((match = unitPattern.exec(raw)) !== null) {
    matched = true;
    const value = Number(match[1]);
    const unit = match[2];
    total += unit === 'h' ? value * 3600 : unit === 'm' ? value * 60 : value;
  }
  if (matched) return Math.round(total);

  if (/^\d+(\.\d+)?$/.test(raw)) return Math.round(Number(raw) * 60);

  return null;
}

module.exports = { parseDuration };
