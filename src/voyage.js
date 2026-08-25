/* ------------------------------------------------------------------
   Real date  →  voyage day  →  leg.

   The original component had this backwards: legIdx was hardcoded and the
   day was read back out of the leg's midpoint. Here the calendar leads.

   All arithmetic is done on Dates built at LOCAL midnight and differenced
   with Math.round, so a daylight-saving shift (a 23- or 25-hour day) cannot
   slide the day count by one.

   "Today" is the iPad's local date, which assumes the clock is set to
   ship's time. leg.utc stays display metadata; it is not used for this.
------------------------------------------------------------------ */

import { LEGS } from "./schedule.js";

export const VOYAGE_DAYS = 40;

const pad = (n) => String(n).padStart(2, "0");

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Date → "YYYY-MM-DD" in local time. */
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "YYYY-MM-DD" → Date at local midnight. */
export const parseKey = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Whole days from a to b, DST-safe. */
export const daysBetween = (a, b) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 864e5);

/** Voyage day for a date, clamped into 1..40. Days past arrival hold at 40. */
export const dayForDate = (startKey, date) =>
  clamp(daysBetween(parseKey(startKey), date) + 1, 1, VOYAGE_DAYS);

/** Unclamped, for deciding whether a day is actually part of the passage. */
export const rawDayForDate = (startKey, date) => daysBetween(parseKey(startKey), date) + 1;

/** Inverse of dayForDate. */
export const dateForDay = (startKey, day) => addDays(parseKey(startKey), day - 1);

/** The leg containing a voyage day. Falls through to the last leg past arrival. */
export const legForDay = (day) =>
  LEGS.find((l) => day >= l.d0 && day <= l.d1) ?? LEGS[LEGS.length - 1];

/** Monday of the calendar week containing `date`. Weeks reset on Monday. */
export const mondayOf = (date) => addDays(date, -((date.getDay() + 6) % 7));

/** "1 August 2026" — for the passage-began line. */
export const prettyDate = (d) =>
  d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
