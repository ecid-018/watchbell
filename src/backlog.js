/* ------------------------------------------------------------------
   The notebook backlog: a pool of jobs that exist but aren't scheduled
   for today.

   A backlog item promoted to today's list keeps the notebook's own id
   rather than minting a new one — that's what makes importing the list
   idempotent (run it twice, get the same jobs, not 82 of them) and what
   makes pushing a job back to the pool lossless (its photos are keyed by
   job id in IndexedDB, and a status flip never touches them).
------------------------------------------------------------------ */

import { K, readJSON, writeJSON } from "./storage.js";
import { daysToArrival } from "./phase.js";
import { BACKLOG } from "./data/jobs-backlog.js";

const BACKLOG_IDS = new Set(BACKLOG.map((item) => item.id));
export const isFromBacklog = (jobId) => BACKLOG_IDS.has(jobId);

export const backlogJobFrom = (item, todayKey) => ({
  id: item.id,
  title: item.title,
  detail: item.note || "",
  group: item.group,
  priority: item.priority,
  where: item.where || "sea",
  check: !!item.check,
  fabrication: !!item.fabrication,
  assignee: null,
  created: todayKey,
  status: "pooled",
  doneOn: null,
  droppedOn: null,
  ackOn: null,
  from: null,
  lastDeferral: null,
});

/** Runs on every boot. Not schema-gated — the whole point is that
    swapping the placeholder BACKLOG for the real 41-job list later still
    works, by only ever adding a job whose id isn't already present. */
export function importBacklog(todayKey) {
  const jobs = readJSON(K.jobs, []);
  const have = new Set(jobs.map((j) => j.id));
  const additions = BACKLOG
    .filter((item) => item.recurring !== "weekly" && !have.has(item.id))
    .map((item) => backlogJobFrom(item, todayKey));
  if (additions.length) writeJSON(K.jobs, [...jobs, ...additions]);
}

/** A "port"-only item stays hidden at sea and surfaces once an Arrival is
    declared for today or any day still to come. */
export const portItemVisible = (item, events, todayKey) =>
  item.where !== "port" || (events || []).some((e) => e.type === "Arrival" && e.date >= todayKey);

/** Weekly backlog items go to the admin cadence system, not the pool. */
export const recurringTasksFromBacklog = (backlog) =>
  backlog
    .filter((item) => item.recurring === "weekly")
    .map((item) => ({
      key: `backlog:${item.id}`,
      title: item.title,
      detail: item.note || "",
      est: 20,
      critical: item.priority === "psc" || item.priority === "defect",
      slot: "pm",
      cadence: "weekly",
      day: item.day || "mon",
    }));

/** Literal spec wording: only OPEN psc/defect items pin to the top of
    Today once inside 21 days of arrival — a pooled one surfaces only
    once it's pulled into Today. */
export const pscPinned = (jobs, phase, now) =>
  phase.kind !== "port" && daysToArrival(phase, now) <= 21
    ? jobs.filter((j) => j.status === "open" && (j.priority === "psc" || j.priority === "defect"))
    : [];
