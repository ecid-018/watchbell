/* ------------------------------------------------------------------
   The figures that used to be literals: rolling seven days, grace days,
   sessions on plan.

   Everything here is computed on read from the stored daily records —
   nothing is derived once and cached. Back-fill a day and every figure
   recalculates. There is no aggregate state to migrate or corrupt.

   The walk is over *dates*, and each date is resolved against whichever
   phase covered it. A rolling window spanning the day you tied up
   alongside therefore scores its sea days against sea legs and its port
   days against the port schedule, rather than re-scoring the lot against
   whatever the ship happens to be doing today.
------------------------------------------------------------------ */

import { doableForLeg } from "./schedule.js";
import { readLog } from "./storage.js";
import { dayOf, legOf, phaseForDate } from "./phase.js";
import { addDays, dateKey, mondayOf, startOfDay } from "./voyage.js";

export const GRACE_PER_WEEK = 2;
export const GRACE_THRESHOLD = 50; // a day under this percent burns a grace day
export const ROLLING_WINDOW = 7;

/**
 * The stored record for a date, unless `live` supplies a fresher one. Today's
 * ticks are held in React state and only flushed to storage in an effect, so
 * reading storage alone would leave every figure one tick behind.
 */
const logFor = (dk, live) => (live && live[dk]) || readLog(dk);

/** The leg in force on a date, or null if the date predates the first phase. */
export function legForDate(phases, date) {
  const phase = phaseForDate(phases, date);
  return phase ? legOf(phase, dayOf(phase, date)) : null;
}

/**
 * Completion for one date, resolved against that date's own leg — so a Cape
 * day is scored out of 11 items, not 12.
 */
export function completionForDate(phases, date, live) {
  const leg = legForDate(phases, date);
  if (!leg) return null;
  const doable = doableForLeg(leg);
  const log = logFor(dateKey(date), live);
  const hit = doable.filter((i) => log[i.id]).length;
  return { hit, total: doable.length, pct: doable.length ? Math.round((hit / doable.length) * 100) : 0 };
}

/**
 * The dates in [from, to] that have actually happened: on or after the first
 * phase began, and not in the future. A date inside that range with no stored
 * record is a real 0%, not a gap.
 */
function elapsedDates(phases, from, to) {
  const out = [];
  const last = startOfDay(to);
  for (let d = startOfDay(from); d <= last; d = addDays(d, 1)) {
    if (phaseForDate(phases, d)) out.push(d);
  }
  return out;
}

/**
 * Rolling completion over the seven calendar days ending today.
 *
 * Daily percentages are averaged with equal weight per day rather than
 * pooling items, because day lengths differ (11 items rounding the Cape,
 * 12 elsewhere) and a short day should not count for less.
 *
 * Today is included, still in progress — the figure climbs through the day.
 * Returns null when the window holds no elapsed days at all.
 */
export function rollingSeven(phases, today, live) {
  const dates = elapsedDates(phases, addDays(today, -(ROLLING_WINDOW - 1)), today);
  if (!dates.length) return null;
  const sum = dates.reduce((acc, d) => acc + completionForDate(phases, d, live).pct, 0);
  return { pct: Math.round(sum / dates.length), days: dates.length };
}

/**
 * Grace days: two per calendar week, burnt by any day under 50%, reset Monday.
 *
 * The week window itself moves, so Monday resets for free — nothing is stored
 * or cleared. Only Monday..yesterday is judged: scoring today would burn a
 * grace day at 06:00 every morning before the day had a chance to happen.
 */
export function graceDays(phases, today, live) {
  const monday = mondayOf(today);
  const yesterday = addDays(today, -1);
  const judged = yesterday < monday ? [] : elapsedDates(phases, monday, yesterday);
  const consumed = judged.filter(
    (d) => completionForDate(phases, d, live).pct < GRACE_THRESHOLD,
  ).length;
  return { left: Math.max(0, GRACE_PER_WEEK - consumed), consumed, judged: judged.length };
}

/**
 * Sessions on plan: over the same rolling seven days, how many trade-enabled
 * days had the trading session ticked. Days on a stood-down leg are excluded
 * from both sides, so rounding the Cape does not count against the record —
 * and neither does a port stay logged as no trading alongside.
 * Returns null when the window contains no trading days at all.
 */
export function onPlan(phases, today, live) {
  const dates = elapsedDates(phases, addDays(today, -(ROLLING_WINDOW - 1)), today).filter(
    (d) => legForDate(phases, d).trade,
  );
  if (!dates.length) return null;
  const hit = dates.filter((d) => logFor(dateKey(d), live).trade).length;
  return { hit, total: dates.length };
}
