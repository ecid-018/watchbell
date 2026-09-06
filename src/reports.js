/* ------------------------------------------------------------------
   Three reports, all built the same way: pure data first (testable, no
   photos, no async), then an HTML/Markdown assembly step that layers
   photos on top. A report with zero photos is not a degraded report —
   the embedding step is just skipped, and the tables and figures still
   stand on their own.
------------------------------------------------------------------ */

import { getPhotosForJob } from "./photodb.js";
import { blobToDataUrl } from "./imagepipe.js";
import { renderReportHtml, escapeHtml } from "./reportShell.js";
import { prettyDate } from "./voyage.js";

const isPscItem = (j) => j.priority === "psc" || j.priority === "defect";
const groupOf = (j) => j.group || "Ungrouped";
const statusLabel = (j) => (j.status === "pooled" ? "backlog" : j.status);

/* -------- pure data -------- */

export function pscReadinessReportData(jobs) {
  const items = jobs.filter(isPscItem).sort(
    (a, b) => groupOf(a).localeCompare(groupOf(b)) || a.title.localeCompare(b.title),
  );
  const closed = items.filter((j) => j.status === "done").length;
  return { items, readiness: { closed, total: items.length } };
}

export function backlogStatusReportData(jobs) {
  const byGroup = new Map();
  for (const j of jobs) {
    const g = groupOf(j);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(j);
  }
  return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([group, items]) => ({
    group,
    items: items.slice().sort((a, b) => a.title.localeCompare(b.title)),
    open: items.filter((j) => j.status === "open" || j.status === "pooled").length,
    done: items.filter((j) => j.status === "done").length,
    dropped: items.filter((j) => j.status === "dropped").length,
  }));
}

export function periodReportData(jobs, fromKey, toKey) {
  const done = jobs.filter((j) => j.doneOn && j.doneOn >= fromKey && j.doneOn <= toKey);
  const byGroup = new Map();
  for (const j of done) {
    const g = groupOf(j);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(j);
  }
  return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([group, items]) => ({
    group,
    items: items.slice().sort((a, b) => a.doneOn.localeCompare(b.doneOn)),
  }));
}

/* -------- photos -------- */

async function photoFigures(jobId) {
  const photos = await getPhotosForJob(jobId);
  // A photo the browser cannot read drops out of the figure block rather
  // than taking the whole report down with it — the tables are the report,
  // and one unreadable JPEG is not a reason to hand back nothing.
  const withUrls = await Promise.all(photos.map(async (p) => {
    try { return { ...p, url: await blobToDataUrl(p.blob) }; }
    catch (e) { console.warn("Watchbell: leaving an unreadable photo out of the report.", e); return null; }
  }));
  return withUrls.filter(Boolean).sort((a, b) => (a.tag === b.tag ? 0 : a.tag === "before" ? -1 : 1));
}

const photosBlock = (photos) => (photos.length
  ? `<div class="photos">${photos.map((p) =>
      `<figure><img src="${p.url}" alt=""><figcaption>${escapeHtml(p.tag || "")}</figcaption></figure>`).join("")}</div>`
  : "");

const headerFields = (profile) => ({
  vessel: profile?.vessel || "",
  generated: prettyDate(new Date()),
  signee: [profile?.rank, profile?.name].filter(Boolean).join(" · "),
});

/* -------- PSC readiness report -------- */

export async function pscReadinessReportHtml(jobs, profile) {
  const { items, readiness } = pscReadinessReportData(jobs);
  const rows = await Promise.all(items.map(async (j) => {
    const photos = await photoFigures(j.id);
    const tag = j.status === "done" ? "done" : j.status === "dropped" ? "dropped" : "open";
    return `
      <tr>
        <td>${escapeHtml(j.group || "")}</td>
        <td>
          <div>${escapeHtml(j.title)}</div>
          ${j.detail ? `<div class="note">${escapeHtml(j.detail)}</div>` : ""}
          ${j.lastDeferral ? `<div class="note">Deferred ${escapeHtml(j.lastDeferral.date)} — ${escapeHtml(j.lastDeferral.reason)}</div>` : ""}
          ${photosBlock(photos)}
        </td>
        <td><span class="tag tag-${tag}">${escapeHtml(tag)}</span></td>
        <td>${escapeHtml(j.doneOn || "")}</td>
      </tr>`;
  }));

  const body = `
    <div class="figure-line">${readiness.closed} / ${readiness.total} closed</div>
    <div class="note" style="margin-bottom:14px">PSC and defect items — readiness at arrival.</div>
    <table>
      <thead><tr><th>Group</th><th>Item</th><th>Status</th><th>Closed</th></tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;

  return renderReportHtml({ title: "PSC readiness report", ...headerFields(profile), bodyHtml: body });
}

export function pscReadinessReportMarkdown(jobs, profile) {
  const { items, readiness } = pscReadinessReportData(jobs);
  const { vessel, generated, signee } = headerFields(profile);
  const lines = [`# PSC readiness report`, ``, vessel, `Generated ${generated}`, signee, ``,
    `**${readiness.closed} / ${readiness.total} closed**`, ``];
  for (const j of items) {
    const tag = j.status === "done" ? "done" : j.status === "dropped" ? "dropped" : "open";
    lines.push(`- [${tag}] **${j.group || ""}** — ${j.title}${j.doneOn ? ` (closed ${j.doneOn})` : ""}`);
    if (j.lastDeferral) lines.push(`  deferred ${j.lastDeferral.date} — ${j.lastDeferral.reason}`);
  }
  return lines.join("\n");
}

/* -------- backlog status report -------- */

export async function backlogStatusReportHtml(jobs, profile) {
  const groups = backlogStatusReportData(jobs);
  const sections = groups.map((g) => `
    <div class="group">
      <div class="group-title">${escapeHtml(g.group)} — ${g.open} open · ${g.done} done · ${g.dropped} dropped</div>
      <table>
        <thead><tr><th>Item</th><th>Priority</th><th>Status</th></tr></thead>
        <tbody>${g.items.map((j) => `
          <tr>
            <td>${escapeHtml(j.title)}</td>
            <td>${escapeHtml(j.priority)}</td>
            <td>${escapeHtml(statusLabel(j))}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>`).join("");

  return renderReportHtml({
    title: "Backlog status report", ...headerFields(profile),
    bodyHtml: sections || `<div class="note">Nothing in the backlog.</div>`,
  });
}

export function backlogStatusReportMarkdown(jobs, profile) {
  const groups = backlogStatusReportData(jobs);
  const { vessel, generated, signee } = headerFields(profile);
  const lines = [`# Backlog status report`, ``, vessel, `Generated ${generated}`, signee, ``];
  for (const g of groups) {
    lines.push(`## ${g.group} — ${g.open} open · ${g.done} done · ${g.dropped} dropped`, ``);
    for (const j of g.items) lines.push(`- [${statusLabel(j)}] ${j.title} (${j.priority})`);
    lines.push(``);
  }
  return lines.join("\n");
}

/* -------- period report -------- */

export async function periodReportHtml(jobs, fromKey, toKey, profile) {
  const groups = periodReportData(jobs, fromKey, toKey);
  const sections = await Promise.all(groups.map(async (g) => {
    const rows = await Promise.all(g.items.map(async (j) => {
      const photos = await photoFigures(j.id);
      return `
        <tr>
          <td>${escapeHtml(j.title)}</td>
          <td>${escapeHtml(j.assignee || "")}</td>
          <td>${escapeHtml(j.doneOn)}</td>
          <td>${photosBlock(photos)}</td>
        </tr>`;
    }));
    return `
      <div class="group">
        <div class="group-title">${escapeHtml(g.group)}</div>
        <table>
          <thead><tr><th>Item</th><th>Who</th><th>Done</th><th>Photos</th></tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>`;
  }));

  const { vessel, generated, signee } = headerFields(profile);
  return renderReportHtml({
    title: "Period report", vessel, generated, signee,
    bodyHtml: `<div class="note" style="margin-bottom:12px">${escapeHtml(fromKey)} to ${escapeHtml(toKey)}</div>${
      sections.join("") || `<div class="note">Nothing closed out in this period.</div>`}`,
  });
}

export function periodReportMarkdown(jobs, fromKey, toKey, profile) {
  const groups = periodReportData(jobs, fromKey, toKey);
  const { vessel, signee } = headerFields(profile);
  const lines = [`# Period report`, ``, vessel, `${fromKey} to ${toKey}`, signee, ``];
  for (const g of groups) {
    lines.push(`## ${g.group}`, ``);
    for (const j of g.items) lines.push(`- ${j.title} — ${j.assignee || "unassigned"} (${j.doneOn})`);
    lines.push(``);
  }
  return lines.join("\n");
}
