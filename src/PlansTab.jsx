import React, { useState } from "react";

/* ------------------------------------------------------------------
   The vault.

   Office instructions, overhauls, surveys, class items — the things that
   outlive a week and a voyage. This is the app's long-term memory, which
   is why it exports: the only copy lives under a home-screen icon, and
   deleting that icon takes it with it.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { dateKey } from "./voyage.js";

export const SOURCES = ["Office", "Class", "Own", "Superintendent"];
export const STATUSES = [["planned", "Planned"], ["active", "In progress"], ["done", "Done"]];

export default function PlansTab({
  C, dark, wide, plans, today, onAdd, onSet, onSpawn, onExport, onExportFallback, onImport, quota,
  reportProfile, onSetReportProfile, photoBytes, onPurgePhotos, onExportPhotos,
}) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState({ title: "", notes: "", target: "", source: "" });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [exportingPhotos, setExportingPhotos] = useState(false);
  const [photoExportUrl, setPhotoExportUrl] = useState(null);
  const [purgeArmed, setPurgeArmed] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const field = {
    fontFamily: F.ui, fontSize: 16, color: C.text, height: 46,
    background: C.sub, border: `1px solid ${C.line2}`,
    WebkitAppearance: "none", colorScheme: dark ? "dark" : "light",
  };

  const todayKey = dateKey(today);
  const sorted = [...plans].sort((a, b) => {
    const rank = (p) => (p.status === "done" ? 2 : p.status === "active" ? 0 : 1);
    return rank(a) - rank(b) || (a.target || "9999").localeCompare(b.target || "9999");
  });

  const submit = () => {
    if (!draft.title.trim()) return;
    onAdd(draft);
    setDraft({ title: "", notes: "", target: "", source: "" });
    setAdding(false);
  };

  const chip = (label, on, onClick, tone) => (
    <button key={label} onClick={onClick} className="wb-t px-2.5 py-1 rounded-full" style={{
      fontSize: 11.5, fontWeight: 500,
      background: on ? (tone || C.amber) : "transparent",
      color: on ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
      border: `1px solid ${on ? (tone || C.amber) : C.line2}`,
    }}>{label}</button>
  );

  /** Share sheet first — the one path that reliably saves a file from an iOS
      home-screen app. Anything that can't share falls back to the on-screen
      copy/download panel, which works everywhere. */
  const handleExport = async () => {
    const json = onExport();
    const blob = new Blob([json], { type: "application/json" });
    const file = new File([blob], `watchbell-${dateKey(new Date())}.json`, { type: "application/json" });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Watchbell Backup" });
        return;
      }
    } catch (e) {
      if (e.name === "AbortError") return; // user cancelled the share sheet
    }
    onExportFallback(json);
  };

  const handleExportPhotos = async () => {
    setExportingPhotos(true);
    try {
      const blob = await onExportPhotos();
      const file = new File([blob], `watchbell-photos-${dateKey(new Date())}.zip`, { type: "application/zip" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Watchbell Photos" });
      } else {
        setPhotoExportUrl({ url: URL.createObjectURL(blob), name: file.name, size: blob.size });
      }
    } catch (e) {
      if (e.name !== "AbortError") console.warn("Watchbell: photo export failed.", e);
    }
    setExportingPhotos(false);
  };

  // Two taps — the first arms it, the second actually deletes. The only
  // genuinely destructive action in the app, so it earns the friction.
  const handlePurge = async () => {
    if (!purgeArmed) { setPurgeArmed(true); return; }
    setPurging(true);
    const n = await onPurgePhotos();
    setPurgeResult(n);
    setPurging(false);
    setPurgeArmed(false);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        setImportError("");
        await onImport(data);
        setImporting(false);
        window.location.reload();
      } catch (err) {
        setImportError("Invalid backup file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={wide ? "grid grid-cols-2 gap-4 items-start" : ""}>
      <div>
        {adding ? (
          <div className="wb-t rounded-2xl p-4 mb-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
            <div style={eyebrow}>NEW PLAN</div>
            <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Main engine unit 3 overhaul" autoCapitalize="sentences"
              className="wb-t w-full rounded-xl mt-2 px-3" style={field} />
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={4} placeholder="Notes, scope, what the office actually said"
              className="wb-t w-full rounded-xl mt-2 px-3 py-2"
              style={{ ...field, height: "auto", fontFamily: F.serif, fontSize: 15, lineHeight: 1.5, resize: "none" }} />

            <div style={{ ...eyebrow, marginTop: 14 }}>TARGET DATE — OPTIONAL</div>
            <input type="date" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })}
              className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, fontFamily: F.mono }} />

            <div style={{ ...eyebrow, marginTop: 14 }}>SOURCE — OPTIONAL</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SOURCES.map((s) => chip(s, draft.source === s, () => setDraft({ ...draft, source: draft.source === s ? "" : s })))}
            </div>

            <button onClick={submit} disabled={!draft.title.trim()} className="wb-t w-full rounded-xl mt-4 py-2.5"
              style={{
                fontSize: 13.5, fontWeight: 600,
                background: draft.title.trim() ? C.amber : "transparent",
                color: draft.title.trim() ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
                border: `1px solid ${draft.title.trim() ? C.amber : C.line2}`,
              }}>Add to the vault</button>
            <button onClick={() => setAdding(false)} className="wb-t w-full mt-2" style={{ fontSize: 12.5, color: C.dim }}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => setAdding(true)} className="wb-t w-full rounded-xl py-3 mb-2"
              style={{ fontSize: 14, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
              Add a plan
            </button>
            <button onClick={handleExport} className="wb-t w-full rounded-xl py-2.5 mb-2"
              style={{ fontSize: 12.5, color: C.text2, border: `1px solid ${C.line2}` }}>
              Export everything to JSON
            </button>
            {importing ? (
              <div className="wb-t rounded-2xl p-4 mb-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
                <div style={eyebrow}>IMPORT BACKUP</div>
                <input type="file" accept=".json" onChange={handleImport}
                  className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, fontFamily: F.mono }} />
                {importError && <div style={{ color: C.oxide, marginTop: 8, fontSize: 13 }}>{importError}</div>}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setImporting(false)} className="wb-t flex-1 rounded-xl py-2.5"
                    style={{ fontSize: 13, fontWeight: 600, color: C.dim, border: `1px solid ${C.line2}` }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setImporting(true)} className="wb-t w-full rounded-xl py-2.5 mb-3"
                style={{ fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
                Import backup from file
              </button>
            )}
            <div style={{ fontSize: 11.5, lineHeight: 1.5, padding: "0 4px", color: C.dim2 }}>
              The vault lives on this iPad only. Export before a reinstall — deleting the
              home-screen icon takes it with it.
              {quota && quota.quota > 0 && (
                <span style={{ display: "block", marginTop: 4, color: quota.pct > 80 ? C.oxide : C.dim2 }}>
                  Storage: {quota.pct}% used ({Math.round(quota.usage / 1024)} KB of {Math.round(quota.quota / 1024)} KB)
                </span>
              )}
            </div>

            {reportProfile && (
              <div className="wb-t rounded-2xl p-4 mt-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
                <div style={eyebrow}>REPORT HEADER</div>
                <input type="text" value={reportProfile.vessel} onChange={(e) => onSetReportProfile({ vessel: e.target.value })}
                  placeholder="Vessel" className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, height: 40, fontSize: 14 }} />
                <div className="flex gap-2 mt-2">
                  <input type="text" value={reportProfile.rank} onChange={(e) => onSetReportProfile({ rank: e.target.value })}
                    placeholder="Rank" className="wb-t flex-1 rounded-xl px-3" style={{ ...field, height: 40, fontSize: 14 }} />
                  <input type="text" value={reportProfile.name} onChange={(e) => onSetReportProfile({ name: e.target.value })}
                    placeholder="Name" className="wb-t flex-1 rounded-xl px-3" style={{ ...field, height: 40, fontSize: 14 }} />
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.4, marginTop: 6, color: C.dim2 }}>
                  Carried in the header of every PSC, backlog and period report.
                </div>
              </div>
            )}

            <div className="wb-t rounded-2xl p-4 mt-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
              <div style={eyebrow}>PHOTOS</div>
              <div style={{ fontSize: 12, marginTop: 4, color: C.text2 }}>
                {photoBytes == null ? "—" : `${(photoBytes / 1024 / 1024).toFixed(1)} MB stored`}
              </div>
              <button onClick={handleExportPhotos} disabled={exportingPhotos} className="wb-t w-full rounded-xl mt-3 py-2.5"
                style={{ fontSize: 12.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
                {exportingPhotos ? "Building…" : "Export photos"}
              </button>
              {photoExportUrl && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11.5, lineHeight: 1.4, marginBottom: 6, color: C.dim2 }}>
                    {(photoExportUrl.size / 1024 / 1024).toFixed(1)} MB. Sharing isn't available here.
                  </div>
                  <a href={photoExportUrl.url} download={photoExportUrl.name}
                    className="wb-t w-full block text-center rounded-xl py-2" style={{ fontSize: 12.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
                    Save the zip
                  </a>
                </div>
              )}
              <button onClick={handlePurge} disabled={purging} className="wb-t w-full rounded-xl mt-2 py-2.5"
                style={{
                  fontSize: 12.5, fontWeight: 600,
                  color: purgeArmed ? (dark ? "#0E1C22" : "#FFFFFF") : C.oxide,
                  background: purgeArmed ? C.oxide : "transparent",
                  border: `1px solid ${C.oxide}`,
                }}>
                {purging ? "Purging…" : purgeArmed ? "Tap again to delete — closed 90+ days ago" : "Purge photos on jobs closed over 90 days"}
              </button>
              {purgeArmed && (
                <button onClick={() => setPurgeArmed(false)} className="wb-t w-full mt-2" style={{ fontSize: 11.5, color: C.dim }}>
                  Cancel
                </button>
              )}
              {purgeResult !== null && (
                <div style={{ fontSize: 11.5, marginTop: 6, color: C.dim2 }}>
                  {purgeResult === 0 ? "Nothing old enough to purge." : `${purgeResult} photo${purgeResult === 1 ? "" : "s"} removed.`}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div>
        {sorted.length === 0 && (
          <div style={{ fontSize: 13, lineHeight: 1.5, padding: "8px 4px", color: C.dim }}>
            Nothing in the vault yet.
          </div>
        )}
        {sorted.map((p) => {
          const isOpen = open === p.id;
          const due = p.target && p.status !== "done";
          const overdue = due && p.target < todayKey;
          return (
            <div key={p.id} className="mb-1">
              <button onClick={() => setOpen(isOpen ? null : p.id)}
                className="wb-t w-full flex items-start gap-3 py-2.5 px-2 rounded-xl text-left"
                style={{ background: isOpen ? C.sub : "transparent" }}>
                <span className="shrink-0 rounded-full" style={{
                  width: 8, height: 8, marginTop: 6,
                  background: p.status === "done" ? C.foam : p.status === "active" ? C.amber : C.ring,
                }} />
                <span className="flex-1">
                  <span className="block" style={{
                    fontSize: wide ? 15 : 14,
                    color: p.status === "done" ? C.dim : C.text,
                    textDecoration: p.status === "done" ? "line-through" : "none",
                    textDecorationColor: C.dim2,
                  }}>{p.title}</span>
                  <span className="block" style={{ fontFamily: F.mono, fontSize: 10, marginTop: 2, color: overdue ? C.oxide : C.dim2 }}>
                    {[p.source, p.target ? (overdue ? `overdue ${p.target}` : p.target) : null,
                      STATUSES.find(([k]) => k === p.status)?.[1]].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="px-2 pb-3">
                  {p.notes && (
                    <div style={{ fontFamily: F.serif, fontSize: 14, lineHeight: 1.55, color: C.text2, marginBottom: 10, whiteSpace: "pre-wrap" }}>
                      {p.notes}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map(([k, label]) =>
                      chip(label, p.status === k, () => onSet(p.id, { status: k }), k === "done" ? C.foam : C.amber))}
                  </div>
                  <button onClick={() => onSpawn(p)} className="wb-t w-full rounded-xl mt-3 py-2.5"
                    style={{ fontSize: 13, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
                    Send to the job list
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
