/* ------------------------------------------------------------------
   PSC readiness: a count, not a percentage of a percentage.

   The figure that matters at arrival is closed-over-total, plain — the
   same reason jobs and admin tasks are counted rather than averaged in
   elsewhere in this app.
------------------------------------------------------------------ */

const isPscItem = (j) => j.priority === "psc" || j.priority === "defect";

export function pscReadiness(jobs) {
  const items = jobs.filter(isPscItem);
  return { closed: items.filter((j) => j.status === "done").length, total: items.length };
}

/** Every PSC/defect item, grouped for batching — sorted by group first so
    the PSC view reads the same way the readiness report does. */
export const pscItems = (jobs) =>
  jobs
    .filter(isPscItem)
    .sort((a, b) => (a.group || "").localeCompare(b.group || "") || a.title.localeCompare(b.title));
