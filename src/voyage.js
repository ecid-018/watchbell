/* ------------------------------------------------------------------
   Date arithmetic. Nothing here knows about legs, routes or phases —
   that moved to phase.js when a stay in port became possible, so this
   file stayed a leaf and the import graph stayed acyclic.

   All arithmetic is done on Dates built at LOCAL midnight and differenced
   with Math.round, so a daylight-saving shift (a 23- or 25-hour day) cannot
   slide the day count by one.

   "Today" is the iPad's local date, which assumes the clock is set to
   ship's time.
------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, "0");

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

/** Monday of the calendar week containing `date`. Weeks reset on Monday. */
export const mondayOf = (date) => addDays(date, -((date.getDay() + 6) % 7));

/** "1 August 2026" — for the passage-began line. */
export const prettyDate = (d) =>
  d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** "MON 24 AUG" — for under the clock. */
export const clockDate = (d) =>
  d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
