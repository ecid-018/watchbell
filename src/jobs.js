/* ------------------------------------------------------------------
   The engine room job list.

   Not a habit tracker. A job is work that either got done or did not, and
   an unfinished one is not a failure — it is tomorrow's work. Carry-over is
   therefore not a state the app has to maintain overnight: an open job is
   on today's list by definition, and how long it has been there is read off
   its creation date. Nothing has to happen at midnight, so nothing can go
   wrong at midnight.
------------------------------------------------------------------ */

import { newId } from "./store.js";
import { addDays, dateKey, daysBetween, parseKey } from "./voyage.js";

/** Carried this many days and the row starts saying so in oxide. */
export const CARRY_WARN = 3;

export const makeJob = (fields, todayKey) => ({
  id: newId("job"),
  title: (fields.title || "").trim(),
  detail: (fields.detail || "").trim(),
  assignee: fields.assignee,
  priority: fields.priority === "urgent" ? "urgent" : "normal",
  created: todayKey,
  status: "open",
  doneOn: null,
  droppedOn: null,
  ackOn: null, // the last day it was explicitly carried
  from: fields.from || null, // the plan it was spawned out of
});

/** Days on the list. 0 is today's work, 2 is its third day. */
export const carriedFor = (job, todayKey) =>
  Math.max(0, daysBetween(parseKey(job.created), parseKey(todayKey)));

export const carryLabel = (n) => {
  if (n <= 0) return "today";
  if (n === 1) return "2nd day";
  if (n === 2) return "3rd day";
  return `${n + 1}th day`;
};

export const isOpen = (j) => j.status === "open";
export const isArchived = (j) => j.status === "dropped";

/** Lower sorts first. PSC and defect items lead every list they appear
    in — they are the ones written up as deficiencies at arrival. */
export const PRIORITY_RANK = { psc: 0, defect: 1, urgent: 2, normal: 3, cosmetic: 4 };

/** PSC and defect items cannot be dropped, only done or deferred with a
    reason — everything else can be dropped freely. */
export const canDrop = (j) => j.priority !== "psc" && j.priority !== "defect";

/** A photo's default before/after tag: still in the pool is "before" the
    work, anything else (open, done) is "after" — correctable with one tap
    since a quick-captured job (born open, never pooled) has no "before". */
export const autoPhotoTag = (job) => (job.status === "pooled" ? "before" : "after");

/** Today's list, PSC/defect first, then urgent, then longest-carried, grouped by rank. */
export function groupByAssignee(jobs, ranks, todayKey) {
  const open = jobs.filter(isOpen);
  const order = new Map(ranks.map((r, i) => [r, i]));
  const groups = new Map();
  for (const j of open) {
    if (!groups.has(j.assignee)) groups.set(j.assignee, []);
    groups.get(j.assignee).push(j);
  }
  for (const list of groups.values()) {
    list.sort((a, b) =>
      (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
      carriedFor(b, todayKey) - carriedFor(a, todayKey) ||
      a.title.localeCompare(b.title));
  }
  return [...groups.entries()].sort(
    (a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99) || a[0].localeCompare(b[0]),
  );
}

/**
 * How the list moved over the seven days ending today: what was closed out,
 * and what is still riding. Deliberately a count and not a percentage of a
 * percentage — jobs and habits are different kinds of thing and averaging
 * them together would say nothing about either.
 */
export function jobsInWindow(jobs, today, days = 7) {
  const from = dateKey(addDays(today, -(days - 1)));
  const to = dateKey(today);
  const done = jobs.filter((j) => j.doneOn && j.doneOn >= from && j.doneOn <= to).length;
  const dropped = jobs.filter((j) => j.droppedOn && j.droppedOn >= from && j.droppedOn <= to).length;
  const carried = jobs.filter((j) => isOpen(j) && carriedFor(j, to) > 0).length;
  return { done, dropped, carried, total: done + carried };
}
