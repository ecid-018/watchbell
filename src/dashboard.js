/* ------------------------------------------------------------------
   What WatchBell tells the Ops Dashboard.

   The dashboard is a wall display in the engine control room. It reads
   files dropped into a shared folder on the ship's LAN, and this module
   is the one it reads from us: today's plan, as schedule.json.

   It is deliberately not exportAll(). A backup is personal — the reading,
   the reflections, fasting, training — and it is shaped like this app's
   storage keys, so a reader of it would break the day those keys change.
   This payload is small on purpose and has a contract of its own, the
   same way rob.json from NoonLog does: a versioned shape, HH:MM times the
   reader does not have to decode, and null wherever something is not
   known, so the wall shows a dash rather than a zero that looks like data.

   Everything here is pure. It is handed the state and the moment and
   returns the file, so it is tested without a screen and without storage.
------------------------------------------------------------------ */

import { dayDoable } from "./events.js";
import { PRIORITY_RANK, carriedFor, isOpen } from "./jobs.js";
import { currentPhase, dayOf, legOf } from "./phase.js";
import { dateKey } from "./voyage.js";

export const SCHEDULE_SCHEMA_VERSION = 1;

/** The dashboard watches its folder for this exact name. */
export const SCHEDULE_FILENAME = "schedule.json";

/**
 * The only schedule tags that go on a shared screen.
 *
 * Whatever is in this file is readable by anyone who walks into the ECR, so
 * the list is an allow-list, not a deny-list: a tag added to the template
 * later stays off the wall until someone decides otherwise, here.
 *
 * Left out on purpose — `word` (prayer and reading), `body` (training),
 * `fuel` (the fasting window), `desk` (the trading session) and `reset`
 * (wake, showers, cabin, lights out). Those are one person's day, not the
 * engine room's. Nothing from the reading, reflection, fasting or training
 * stores is read by this module at all.
 */
export const SHARED_TAGS = ["duty"];

/** WatchBell's "0730" as the reader expects it, "07:30". Anything that is
    not a real four-digit time is unknown, and says so with null — never
    midnight. @param {unknown} t @returns {string|null} */
export const hhmm = (t) => {
  const m = typeof t === "string" ? /^(\d{2})(\d{2})$/.exec(t) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1]}:${m[2]}`;
};

/**
 * The shared items for the day, in time order.
 *
 * Built on dayDoable, the app's own answer to "what does today actually
 * ask": ship's business has already moved what it moves, and anything it
 * stood down (an admin block during an arrival) is gone rather than shown on
 * the wall as not done when it was never owed.
 *
 * `done` is read from the day's log. An empty log is a real record of a day
 * with nothing stood yet, so it reads false; no log at all is unknown, null.
 */
function planItems(leg, dk, events, log) {
  if (!leg) return [];
  return dayDoable(leg, dk, events)
    .filter((i) => SHARED_TAGS.includes(i.tag))
    .map((i) => ({
      time: hhmm(i.t),
      label: i.label || null,
      tag: i.tag,
      done: log ? log[i.id] === true : null,
    }));
}

/** A job with no creation date cannot be aged; it sorts as fresh rather
    than throwing out of the whole export. */
const carried = (job, dk) => (job.created ? carriedFor(job, dk) : 0);

/**
 * Open jobs only — not the backlog pool, not closed, not dropped — in the
 * order the iPad's own list uses: PSC and defects first, then the longest
 * carried, then by title. Title, priority and who has it; nothing else.
 */
function planJobs(jobs, dk) {
  return (jobs || [])
    .filter(isOpen)
    .slice()
    .sort((a, b) =>
      (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
      carried(b, dk) - carried(a, dk) ||
      (a.title || "").localeCompare(b.title || ""))
    .map((j) => ({
      label: j.title || null,
      priority: j.priority || null,
      assignee: j.assignee || null,
    }));
}

/**
 * Today's plan, as the Ops Dashboard reads it.
 *
 * The leg is the live one for the date — never a leg being previewed on the
 * iPad, which is look-ahead, not what the engine room is doing today.
 *
 * @param {{ phases?: object[], jobs?: object[], log?: object|null, events?: object[] }} state
 * @param {Date} now
 */
export function todaysPlan({ phases, jobs, log, events }, now) {
  const dk = dateKey(now);
  const phase = currentPhase(phases || []);
  const leg = phase ? legOf(phase, dayOf(phase, now)) : null;

  return {
    schema_version: SCHEDULE_SCHEMA_VERSION,
    app: "WatchBell",
    date: dk,
    generated_utc: now.toISOString(),
    leg: leg ? leg.name || null : null,
    items: planItems(leg, dk, events || [], log),
    jobs: planJobs(jobs, dk),
  };
}

/** The file's bytes. Two-space JSON and a closing newline, so two days'
    files diff line by line. @param {object} plan */
export const scheduleJson = (plan) => `${JSON.stringify(plan, null, 2)}\n`;
