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

export default function PlansTab({ C, dark, wide, plans, today, onAdd, onSet, onSpawn, onExport }) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState({ title: "", notes: "", target: "", source: "" });

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
            <button onClick={onExport} className="wb-t w-full rounded-xl py-2.5 mb-3"
              style={{ fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
              Export everything to JSON
            </button>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, padding: "0 4px", color: C.dim2 }}>
              The vault lives on this iPad only. Export before a reinstall — deleting the
              home-screen icon takes it with it.
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
