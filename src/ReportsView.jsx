import React, { useState } from "react";

/* ------------------------------------------------------------------
   Three reports the office or a superintendent can actually use: printable
   HTML that survives iOS Safari's share sheet → Print → Save as PDF, plus
   a plain-text export for when bandwidth won't carry a PDF.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import {
  pscReadinessReportHtml, pscReadinessReportMarkdown,
  backlogStatusReportHtml, backlogStatusReportMarkdown,
  periodReportHtml, periodReportMarkdown,
} from "./reports.js";
import { dateKey } from "./voyage.js";

async function shareOrFallback(html, filename, setFallback) {
  const blob = new Blob([html], { type: "text/html" });
  const file = new File([blob], filename, { type: "text/html" });
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  setFallback(URL.createObjectURL(blob));
}

export default function ReportsView({ C, dark, jobs, profile, todayKey }) {
  const [busy, setBusy] = useState(null);
  const [fallbackUrl, setFallbackUrl] = useState(null);
  const [copied, setCopied] = useState(null);
  const [period, setPeriod] = useState({ from: dateKey(new Date(Date.now() - 6 * 864e5)), to: todayKey });

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const field = {
    fontFamily: F.mono, fontSize: 15, color: C.text, height: 42,
    background: C.sub, border: `1px solid ${C.line2}`, WebkitAppearance: "none",
    colorScheme: dark ? "dark" : "light",
    minWidth: 0,
  };

  const run = async (key, htmlFn, filename) => {
    setBusy(key);
    try {
      const html = await htmlFn();
      await shareOrFallback(html, filename, setFallbackUrl);
    } finally {
      setBusy(null);
    }
  };

  const copyText = async (text, key) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); }
    catch (e) { /* clipboard unavailable — nothing more to offer here */ }
  };

  const card = (key, title, blurb, onGenerate, onCopy) => (
    <div className="wb-t rounded-2xl p-4 mb-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
      <div style={eyebrow}>{title.toUpperCase()}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.4, marginTop: 4, marginBottom: 10, color: C.dim }}>{blurb}</div>
      <div className="flex gap-2">
        <button onClick={onGenerate} disabled={busy === key} className="wb-t flex-1 rounded-xl py-2.5"
          style={{ fontSize: 13, fontWeight: 600, background: C.amber, color: dark ? "#0E1C22" : "#FFFFFF", border: `1px solid ${C.amber}` }}>
          {busy === key ? "Building…" : "Generate & share"}
        </button>
        <button onClick={onCopy} className="wb-t rounded-xl py-2.5 px-3" style={{ fontSize: 12.5, color: C.text2, border: `1px solid ${C.line2}` }}>
          {copied === key ? "Copied" : "Copy as text"}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {card("psc", "PSC readiness report", "Every PSC and defect item, status, date closed, before/after photos.",
        () => run("psc", () => pscReadinessReportHtml(jobs, profile), `psc-readiness-${todayKey}.html`),
        () => copyText(pscReadinessReportMarkdown(jobs, profile), "psc"))}

      {card("backlog", "Backlog status report", "All jobs by group — open, done and dropped, with counts.",
        () => run("backlog", () => backlogStatusReportHtml(jobs, profile), `backlog-status-${todayKey}.html`),
        () => copyText(backlogStatusReportMarkdown(jobs, profile), "backlog"))}

      <div className="wb-t rounded-2xl p-4 mb-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
        <div style={eyebrow}>PERIOD REPORT</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.4, marginTop: 4, marginBottom: 10, color: C.dim }}>
          Jobs completed between two dates, grouped, with who did each one.
        </div>
        <div className="flex gap-2 mb-3">
          <input type="date" value={period.from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            className="wb-t flex-1 rounded-xl px-3" style={field} />
          <input type="date" value={period.to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            className="wb-t flex-1 rounded-xl px-3" style={field} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => run("period", () => periodReportHtml(jobs, period.from, period.to, profile), `period-${period.from}-to-${period.to}.html`)}
            disabled={busy === "period"} className="wb-t flex-1 rounded-xl py-2.5"
            style={{ fontSize: 13, fontWeight: 600, background: C.amber, color: dark ? "#0E1C22" : "#FFFFFF", border: `1px solid ${C.amber}` }}>
            {busy === "period" ? "Building…" : "Generate & share"}
          </button>
          <button onClick={() => copyText(periodReportMarkdown(jobs, period.from, period.to, profile), "period")}
            className="wb-t rounded-xl py-2.5 px-3" style={{ fontSize: 12.5, color: C.text2, border: `1px solid ${C.line2}` }}>
            {copied === "period" ? "Copied" : "Copy as text"}
          </button>
        </div>
      </div>

      {fallbackUrl && (
        <div className="wb-t rounded-2xl p-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.line2}` }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, marginBottom: 8, color: C.text2 }}>
            Sharing isn't available here — open the report in a new tab, then use Safari's own
            share sheet to print or save it.
          </div>
          <a href={fallbackUrl} target="_blank" rel="noreferrer" className="wb-t w-full block text-center rounded-xl py-2.5"
            style={{ fontSize: 13, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
            Open report
          </a>
        </div>
      )}

      {!profile?.vessel && (
        <div style={{ fontSize: 11.5, lineHeight: 1.5, padding: "0 4px", color: C.dim2 }}>
          Set the vessel, rank and name in Plans so reports carry a header.
        </div>
      )}
    </div>
  );
}
