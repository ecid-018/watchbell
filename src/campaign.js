/* ------------------------------------------------------------------
   A campaign: a time-boxed run of work with a date on the end of it.

   Not a second checklist system. A campaign item IS a job — the same
   record, in the same store, with the same statuses, photos, carry
   arithmetic and archive as every other job — carrying two more fields
   saying which campaign and which phase it answers to. The phases hold
   the deadlines, because a job has never had one and should not grow one
   for this: an audit's dates belong to the audit, not to each of its
   eighty-four lines.

   The checklist itself is data, in data/campaign-templates.json, so the
   next one is an edit and not a commit. Phases are copied out of the
   template when a campaign is started rather than read through it, so
   editing the file later never moves the deadlines of a campaign already
   under way.

   The open-items tracker is the same jobs again, the ten of them the
   office asks about, wearing an owner and a status. Closed is not a
   fourth status kept alongside the job's own — it IS the job being done,
   read back. Two places to say the same thing is how they come apart.
------------------------------------------------------------------ */

import { PRIORITY_RANK } from "./jobs.js";
import { K, readJSON, writeJSON } from "./storage.js";
import { addDays, dateKey, daysBetween, parseKey } from "./voyage.js";

/** A deadline the way it is said out loud — "29 Sep", not "2026-09-29".
    Hand-rolled rather than toLocaleDateString, which says "Sept" in some
    locales and would quietly change the width of every row on the iPad
    depending on where it thinks it is. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDue = (key) => {
  if (!key) return "";
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** Where an item stands with the office. "Closed" is derived from the job
    being done, never stored — see the banner above. */
export const TRACKER_STATUSES = [
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["awaiting_office", "Awaiting office"],
  ["closed", "Closed"],
];

/** Days until the target. Negative once it is behind you. */
export const daysToTarget = (campaign, todayKey) =>
  daysBetween(parseKey(todayKey), parseKey(campaign.target));

const shiftKey = (key, days) => (days ? dateKey(addDays(parseKey(key), days)) : key);

/**
 * One checklist line, as a job.
 *
 * Built directly rather than through makeJob(), which coerces every
 * priority to urgent-or-normal — the same reason backlogJobFrom() builds
 * its own. The template's id becomes part of the job id, so re-importing
 * is idempotent and photos keyed to a job survive it.
 */
export const campaignJobFrom = (item, campaign, phase, group, todayKey) => ({
  id: `${campaign.id}-${item.id}`,
  title: item.title,
  detail: item.note || "",
  group,
  priority: item.priority || "normal",
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
  campaign: campaign.id,
  phase: phase.id,
  tracked: !!item.tracker,
  owner: (item.tracker && item.tracker.owner) || null,
  trackerStatus: (item.tracker && item.tracker.status) || null,
  evidence: "",
  lastStatus: null,
});

/** A template, made into a campaign and its jobs. A different target
    moves every phase by the same offset. */
export function instantiateTemplate(template, todayKey, opts = {}) {
  const id = opts.id || template.id;
  const target = opts.target || template.target;
  const shift = daysBetween(parseKey(template.target), parseKey(target));
  const campaign = {
    id,
    templateId: template.id,
    title: template.title,
    target,
    created: todayKey,
    status: "active",
    phases: (template.phases || []).map((p) => ({ id: p.id, name: p.name, due: shiftKey(p.due, shift) })),
  };
  const jobs = [];
  for (const p of template.phases || []) {
    const phase = campaign.phases.find((x) => x.id === p.id);
    for (const g of p.groups || []) {
      for (const item of g.items || []) jobs.push(campaignJobFrom(item, campaign, phase, g.name, todayKey));
    }
  }
  return { campaign, jobs };
}

/** What is wrong with a template, in plain words. Empty means it will load. */
export function templateProblems(template) {
  const out = [];
  if (!template || !template.id) out.push("a template needs an id");
  if (!template || !template.title) out.push("a template needs a title");
  if (!template || !template.target) out.push("a template needs a target date");
  const seen = new Set();
  for (const p of (template && template.phases) || []) {
    if (!p.id) out.push("a phase has no id");
    if (!p.due) out.push(`phase ${p.id || "?"} has no due date`);
    if (p.due && template.target && p.due > template.target) out.push(`phase ${p.id} falls due after the target`);
    for (const g of p.groups || []) {
      for (const item of g.items || []) {
        if (!item.id) out.push(`an item in ${p.id} has no id`);
        else if (seen.has(item.id)) out.push(`duplicate item id ${item.id}`);
        seen.add(item.id);
        if (item.tracker && item.tracker.status === "closed") {
          out.push(`${item.id} is seeded closed — closed comes from the job being done`);
        }
      }
    }
  }
  return out;
}

/**
 * Seed campaigns, the way importBacklog seeds the pool: read what is on
 * disk, add what is missing by id, write only if something was. Safe on
 * every boot. An item added to the file later joins the campaign already
 * running; a phase added later does not, because the phases were copied
 * when it started and its deadlines are its own.
 */
export function importCampaigns(templates, todayKey) {
  const campaigns = readJSON(K.campaigns, []) || [];
  const jobs = readJSON(K.jobs, []) || [];
  const haveJob = new Set(jobs.map((j) => j.id));
  const addedCampaigns = [];
  const addedJobs = [];

  for (const template of templates || []) {
    if (!template.seed || templateProblems(template).length) continue;
    const live = campaigns.find((c) => c.id === template.id);

    if (!live) {
      const { campaign, jobs: seeded } = instantiateTemplate(template, todayKey);
      addedCampaigns.push(campaign);
      for (const j of seeded) if (!haveJob.has(j.id)) addedJobs.push(j);
      continue;
    }

    // Already running: backfill only lines whose phase it already has.
    const phases = new Map(live.phases.map((p) => [p.id, p]));
    for (const p of template.phases || []) {
      const phase = phases.get(p.id);
      if (!phase) continue;
      for (const g of p.groups || []) {
        for (const item of g.items || []) {
          const job = campaignJobFrom(item, live, phase, g.name, todayKey);
          if (!haveJob.has(job.id)) addedJobs.push(job);
        }
      }
    }
  }

  if (addedCampaigns.length) writeJSON(K.campaigns, [...campaigns, ...addedCampaigns]);
  if (addedJobs.length) writeJSON(K.jobs, [...jobs, ...addedJobs]);
  return { campaigns: addedCampaigns.length, jobs: addedJobs.length };
}

const countOf = (list) => ({ closed: list.filter((j) => j.status === "done").length, total: list.length });
const pctOf = ({ closed, total }) => (total ? Math.round((closed / total) * 100) : null);

/** Where a phase stands. Done outranks overdue: finished is finished. */
export function phaseStatus(phase, count, todayKey, days = 7) {
  if (count.total > 0 && count.closed === count.total) return "done";
  if (phase.due < todayKey) return "overdue";
  if (phase.due <= dateKey(addDays(parseKey(todayKey), days))) return "due-soon";
  return "later";
}

/**
 * Closed over total, for the campaign and for each phase. A count first,
 * as the PSC tile is — the percentage is alongside it, not instead of it.
 * A dropped job is not owed and is not counted either way.
 */
export function campaignProgress(jobs, campaign, todayKey, days = 7) {
  const mine = (jobs || []).filter((j) => j.campaign === campaign.id && j.status !== "dropped");
  const overall = countOf(mine);
  return {
    ...overall,
    pct: pctOf(overall),
    phases: (campaign.phases || []).map((p) => {
      const count = countOf(mine.filter((j) => j.phase === p.id));
      return { ...p, ...count, pct: pctOf(count), state: phaseStatus(p, count, todayKey, days) };
    }),
  };
}

/**
 * Campaign work close enough to be today's problem: still open or still
 * in the pool, in a phase due within the week or already behind. Overdue
 * first, then by the date it was owed — the same shape the PSC pin has.
 */
export function campaignPinned(jobs, campaigns, todayKey, days = 7) {
  const limit = dateKey(addDays(parseKey(todayKey), days));
  const out = [];
  for (const c of (campaigns || []).filter((x) => x.status === "active")) {
    const phases = new Map((c.phases || []).map((p) => [p.id, p]));
    for (const j of jobs || []) {
      if (j.campaign !== c.id) continue;
      if (j.status !== "open" && j.status !== "pooled") continue;
      const p = phases.get(j.phase);
      if (!p || p.due > limit) continue;
      out.push({ ...j, due: p.due, phaseName: p.name, campaignTitle: c.title, overdue: p.due < todayKey });
    }
  }
  return out.sort((a, b) =>
    (a.overdue === b.overdue ? 0 : a.overdue ? -1 : 1) ||
    a.due.localeCompare(b.due) ||
    (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
    (a.title || "").localeCompare(b.title || ""));
}

/** The open-items tracker: the tracked jobs, still-open ones first, each
    with the history of what it has been. */
export const trackerRows = (jobs, campaign, log) =>
  (jobs || [])
    .filter((j) => j.campaign === campaign.id && j.tracked && j.status !== "dropped")
    .map((j) => ({
      ...j,
      closed: j.status === "done",
      shownStatus: j.status === "done" ? "closed" : (j.trackerStatus || "open"),
      history: (log || {})[j.id] || [],
    }))
    .sort((a, b) =>
      (a.closed === b.closed ? 0 : a.closed ? 1 : -1) ||
      (a.phase || "").localeCompare(b.phase || "") ||
      (a.title || "").localeCompare(b.title || ""));

/**
 * The patch a status change makes to the job. Closing it is the job being
 * done; moving off closed re-opens it, because the tracker and the list
 * must not be able to disagree about whether the work is finished.
 */
export function trackerPatch(job, status, todayKey) {
  const lastStatus = { date: todayKey, status };
  if (status === "closed") return { status: "done", doneOn: todayKey, lastStatus };
  if (job.status === "done") return { status: "open", doneOn: null, trackerStatus: status, lastStatus };
  return { trackerStatus: status, lastStatus };
}

/** A free id beside the ones already taken: AS26, then AS26-2, AS26-3. */
export const nextCampaignId = (base, campaigns) => {
  const have = new Set((campaigns || []).map((c) => c.id));
  if (!have.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!have.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now().toString(36)}`;
};

/**
 * The same campaign again against a new date: every phase moves by the
 * same offset, and the work comes back to the pool with its tracker
 * cleared. Nothing is carried over from the last run except the list.
 */
export function duplicateCampaign(campaign, jobs, newTarget, todayKey, id) {
  const shift = daysBetween(parseKey(campaign.target), parseKey(newTarget));
  const next = {
    ...campaign,
    id,
    target: newTarget,
    created: todayKey,
    status: "active",
    phases: (campaign.phases || []).map((p) => ({ ...p, due: shiftKey(p.due, shift) })),
  };
  const clones = (jobs || [])
    .filter((j) => j.campaign === campaign.id)
    .map((j) => ({
      ...j,
      id: `${id}-${j.id.slice(campaign.id.length + 1)}`,
      campaign: id,
      created: todayKey,
      status: "pooled",
      assignee: null,
      doneOn: null,
      droppedOn: null,
      ackOn: null,
      lastDeferral: null,
      lastStatus: null,
      trackerStatus: j.tracked ? "open" : null,
      evidence: "",
    }));
  return { campaign: next, jobs: clones };
}
