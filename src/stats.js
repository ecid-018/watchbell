/* ------------------------------------------------------------------
   The figures that used to be literals: rolling seven days, grace days,
   sessions on plan.

   Everything here is computed on read from the stored daily records —
   nothing is derived once and cached. Back-fill a day and every figure
   recalculates. There is no aggregate state to migrate or corrupt.
------------------------------------------------------------------ */

import { doableForLeg } from "./schedule.js";
import { readLog } from "./storage.js";
import {
  addDays,
  dateForDay,
  dateKey,
  legForDay,
  mondayOf,
  rawDayForDate,
  startOfDay,
  VOYAGE_DAYS,
} from "./voyage.js";

export const GRACE_PER_WEEK = 2;
export const GRACE_THRESHOLD = 50; // a day under this percent burns a grace day
export const ROLLING_WINDOW = 7;

/**
 * The stored record for a voyage day, unless `live` supplies a fresher one for
 * that date. Today's ticks are held in React state and only flushed to storage
 * in an effect, so reading storage alone would leave every figure one tick behind.
 */
function logForDay(startKey, day, live) {
  const dk = dateKey(dateForDay(startKey, day));
  return (live && live[dk]) || readLog(dk);
}

/**
 * Completion for one voyage day, resolved against that day's own leg —
 * so a Cape day is scored out of 11 items, not 12.
 */
export function completionForDay(startKey, day, live) {
  const doable = doableForLeg(legForDay(day));
  const log = logForDay(startKey, day, live);
  const hit = doable.filter((i) => log[i.id]).length;
  const total = doable.length;
  return { hit, total, pct: total ? Math.round((hit / total) * 100) : 0 };
}

/**
 * The voyage days falling in [from, to] that have actually happened:
 * on or after departure, on or before today, within the 40-day passage.
 * A day inside that range with no stored record is a real 0%, not a gap.
 */
function elapsedDaysBetween(startKey, from, to) {
  const days = [];
  const last = startOfDay(to);
  for (let d = startOfDay(from); d <= last; d = addDays(d, 1)) {
    const day = rawDayForDate(startKey, d);
    if (day >= 1 && day <= VOYAGE_DAYS) days.push(day);
  }
  return days;
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
export function rollingSeven(startKey, today, live) {
  const days = elapsedDaysBetween(startKey, addDays(today, -(ROLLING_WINDOW - 1)), today);
  if (!days.length) return null;
  const sum = days.reduce((acc, day) => acc + completionForDay(startKey, day, live).pct, 0);
  return { pct: Math.round(sum / days.length), days: days.length };
}

/**
 * Grace days: two per calendar week, burnt by any day under 50%, reset Monday.
 *
 * The week window itself moves, so Monday resets for free — nothing is stored
 * or cleared. Only Monday..yesterday is judged: scoring today would burn a
 * grace day at 06:00 every morning before the day had a chance to happen.
 */
export function graceDays(startKey, today, live) {
  const monday = mondayOf(today);
  const yesterday = addDays(today, -1);
  const judged = yesterday < monday ? [] : elapsedDaysBetween(startKey, monday, yesterday);
  const consumed = judged.filter(
    (day) => completionForDay(startKey, day, live).pct < GRACE_THRESHOLD,
  ).length;
  return { left: Math.max(0, GRACE_PER_WEEK - consumed), consumed, judged: judged.length };
}

/**
 * Sessions on plan: over the same rolling seven days, how many trade-enabled
 * days had the trading session ticked. Days on a stood-down leg are excluded
 * from both sides, so rounding the Cape does not count against the record.
 * Returns null when the window contains no trading days at all.
 */
export function onPlan(startKey, today, live) {
  const days = elapsedDaysBetween(startKey, addDays(today, -(ROLLING_WINDOW - 1)), today).filter(
    (day) => legForDay(day).trade,
  );
  if (!days.length) return null;
  const hit = days.filter((day) => logForDay(startKey, day, live).trade).length;
  return { hit, total: days.length };
}
