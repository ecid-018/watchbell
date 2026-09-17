/* ------------------------------------------------------------------
   The journal, and the days it is behind.

   A reflection is stored under its reading day — an integer — because the
   reading plan is a continuous counter and that is what the plan rows,
   the recovery merge and the auto-backups have always keyed on. That is
   right, and it stays. What it never carried was a date, so a reflection
   written four days ago could not be found by when it was written, and a
   day missed at sea left no trace at all: the app simply assumed the past
   was read.

   This module answers both questions without moving a single stored key.
   It reads the reflections, the read flags and the phase list, and says
   what is unread and what has been written, in the order a person looks
   for them: the unread oldest first, because that is the order you catch
   up in, and the journal newest first, because that is the order you
   remember in.
------------------------------------------------------------------ */

import { dayPlan } from "./schedule.js";
import { dateForReadingDay } from "./phase.js";

/** How far back the catch-up list reaches. A passage and a bit — far
    enough to cover anything worth going back for, short enough that a
    long-unmarked history does not become an endless list. */
export const CATCHUP_WINDOW = 45;

const isBlank = (v) => !v || !String(v).trim();

/**
 * Reading days behind today that were never marked read.
 *
 * `read[d] !== true` rather than a falsy test: the flag is set false on
 * purpose by un-reading a day, and that day is unread in exactly the same
 * way as one never opened.
 * @param {Record<string|number, boolean>} read
 * @param {number} fromDay @param {number} todayReadDay
 */
export const unreadDays = (read, fromDay, todayReadDay) => {
  const out = [];
  for (let d = Math.max(1, fromDay); d < todayReadDay; d++) if ((read || {})[d] !== true) out.push(d);
  return out;
};

/**
 * The unread days as rows: each with the chapters it is asking for and the
 * date it belonged to, so the list reads like the passage list rather than
 * like a column of numbers.
 * @param {number[]} days @param {object[]} phases
 */
export const unreadRows = (days, phases) =>
  (days || []).map((day) => ({ day, plan: dayPlan(day), date: dateForReadingDay(phases, day) }));

/** The opening of a reflection, for a row that is one line tall. */
export const firstLine = (text, n = 90) => {
  const flat = String(text || "").trim().replace(/\s+/g, " ");
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

/**
 * Every reflection that has words in it, newest first.
 *
 * `date` is the day the reading belonged to, derived from the phase list;
 * `writtenOn` is the day it was actually typed, which is only known for
 * entries written since the app started recording it. They differ exactly
 * when a day was caught up late, which is worth seeing.
 * @param {Record<string|number, string>} reflect
 * @param {Record<string|number, string>} reflectDates
 * @param {object[]} phases
 */
export function journalEntries(reflect, reflectDates, phases) {
  const out = [];
  for (const [key, text] of Object.entries(reflect || {})) {
    if (isBlank(text)) continue;
    const day = Number(key);
    if (!Number.isFinite(day)) continue;
    const writtenOn = (reflectDates || {})[key] || null;
    out.push({ day, text, plan: dayPlan(day), date: dateForReadingDay(phases, day), writtenOn });
  }
  return out.sort((a, b) => b.day - a.day);
}
