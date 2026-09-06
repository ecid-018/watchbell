import React, { useState } from "react";

/* ------------------------------------------------------------------
   Today: scheduled or carried work, grouped by rank the same way it
   always was — plus the PSC pin, editable assignee/priority/detail on
   the expanded row, and each job's photo strip.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { CARRY_WARN, autoPhotoTag, canDrop, carriedFor, carryLabel, groupByAssignee } from "./jobs.js";
import { isFromBacklog } from "./backlog.js";
import PhotoRow from "./PhotoRow.jsx";

export default function TodayView({
  C, dark, wide, jobs, ranks, todayKey, pscPinnedIds, pscDeferrals,
  onSet, onPush, onDefer,
}) {
  const [open, setOpen] = useState(null);
  const [deferring, setDeferring] = useState(null);
  const [reason, setReason] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const field = {
    fontFamily: F.ui, fontSize: 14, color: C.text,
    background: C.card, border: `1px solid ${C.line2}`,
    height: 38, WebkitAppearance: "none", colorScheme: dark ? "dark" : "light",
  };

  const groups = groupByAssignee(jobs, ranks, todayKey);
  const archive = jobs.filter((j) => j.status === "done" || j.status === "dropped");
  const pinned = jobs.filter((j) => pscPinnedIds.has(j.id));

  const act = (label, onClick, tone) => (
    <button onClick={onClick} className="wb-t flex-1 rounded-lg py-2" style={{
      fontSize: 12.5, fontWeight: 600, color: tone || C.text2, border: `1px solid ${C.line2}`,
    }}>{label}</button>
  );

  const row = (j, pinnedRow) => {
    const n = carriedFor(j, todayKey);
    const late = n >= CARRY_WARN;
    const isOpen = open === j.id;
    const isDeferring = deferring === j.id;
    const history = pscDeferrals[j.id] || [];
    return (
      <div key={j.id}>
        <button onClick={() => { setOpen(isOpen ? null : j.id); setDeferring(null); }}
          className="wb-t w-full flex items-start gap-3 py-2.5 px-2 rounded-xl text-left"
          style={{ background: isOpen ? C.sub : pinnedRow ? C.panel : "transparent" }}>
          <span className="shrink-0 rounded-full" style={{
            width: 8, height: 8, marginTop: 6,
            background: j.priority === "psc" || j.priority === "defect" || j.priority === "urgent"
              ? C.oxide : late ? C.amber : C.ring,
          }} />
          <span className="flex-1">
            <span className="block" style={{ fontSize: wide ? 15 : 14, color: C.text }}>{j.title}</span>
            {j.detail && (
              <span className="block" style={{ fontSize: 12, lineHeight: 1.4, marginTop: 1, color: C.dim }}>{j.detail}</span>
            )}
            <span className="block" style={{ fontFamily: F.mono, fontSize: 10, marginTop: 2, color: late ? C.oxide : C.dim2 }}>
              {carryLabel(n)}
              {(j.priority === "psc" || j.priority === "defect") && ` · ${j.priority.toUpperCase()}`}
              {j.priority === "urgent" && " · URGENT"}
              {j.from && " · from a plan"}
              {history.length > 0 && ` · deferred ${history.length}×`}
            </span>
          </span>
        </button>
        {isOpen && (
          <div className="px-2 pb-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ranks.map((r) => (
                <button key={r} onClick={() => onSet(j.id, { assignee: r })} className="wb-t px-2.5 py-1 rounded-full"
                  style={{
                    fontSize: 11, fontWeight: 500,
                    background: j.assignee === r ? C.amber : "transparent",
                    color: j.assignee === r ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                    border: `1px solid ${j.assignee === r ? C.amber : C.line2}`,
                  }}>{r}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["normal", "urgent", "psc", "defect", "cosmetic"].map((p) => (
                <button key={p} onClick={() => onSet(j.id, { priority: p })} className="wb-t px-2.5 py-1 rounded-full"
                  style={{
                    fontSize: 11, fontWeight: 500, textTransform: "uppercase",
                    background: j.priority === p ? C.oxide : "transparent",
                    color: j.priority === p ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                    border: `1px solid ${j.priority === p ? C.oxide : C.line2}`,
                  }}>{p}</button>
              ))}
            </div>
            <input type="text" defaultValue={j.detail} placeholder="Detail"
              onBlur={(e) => { if (e.target.value !== j.detail) onSet(j.id, { detail: e.target.value }); }}
              className="wb-t w-full rounded-lg px-2.5 mb-2" style={field} />

            <PhotoRow C={C} dark={dark} job={j} defaultTag={autoPhotoTag(j)} />

            {history.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {history.map((d, i) => (
                  <div key={i} style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{d.date} — {d.reason}</div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              {act("Done", () => { onSet(j.id, { status: "done", doneOn: todayKey }); setOpen(null); }, C.foam)}
              {canDrop(j) ? (
                <>
                  {act("Carry", () => onSet(j.id, { ackOn: todayKey }))}
                  {isFromBacklog(j.id)
                    ? act("Back to backlog", () => { onPush(j.id); setOpen(null); })
                    : act("Drop", () => { onSet(j.id, { status: "dropped", droppedOn: todayKey }); setOpen(null); }, C.oxide)}
                </>
              ) : isDeferring ? (
                <div className="flex-[2] flex gap-1.5">
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason" autoCapitalize="sentences"
                    className="wb-t flex-1 rounded-lg px-2" style={{ ...field, height: 34, fontSize: 12.5 }} />
                  <button onClick={() => { if (reason.trim()) { onDefer(j.id, reason.trim()); setReason(""); setDeferring(null); } }}
                    disabled={!reason.trim()} className="wb-t rounded-lg px-2.5"
                    style={{ fontSize: 12, fontWeight: 600, color: reason.trim() ? C.text2 : C.dim2, border: `1px solid ${C.line2}` }}>
                    Confirm
                  </button>
                </div>
              ) : (
                act("Defer, with reason", () => setDeferring(j.id))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {pinned.length > 0 && (
        <div className="wb-t rounded-2xl p-3 mb-3" style={{ background: C.sub, border: `1px solid ${C.oxide}` }}>
          <div style={{ ...eyebrow, color: C.oxide, marginBottom: 4 }}>INSIDE 21 DAYS — PSC OPEN</div>
          {pinned.map((j) => row(j, true))}
        </div>
      )}

      {groups.length === 0 && (
        <div style={{ fontSize: 13, lineHeight: 1.5, padding: "8px 4px", color: C.dim }}>
          Nothing on today's list. Pull something from the backlog, or use the + button.
        </div>
      )}
      {groups.map(([rank, list]) => {
        const rest = list.filter((j) => !pscPinnedIds.has(j.id));
        if (rest.length === 0) return null;
        return (
          <div key={rank} className="mb-3">
            <div className="flex items-baseline justify-between px-2" style={{ marginBottom: 2 }}>
              <span style={eyebrow}>{rank.toUpperCase()}</span>
              <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>{rest.length}</span>
            </div>
            {rest.map((j) => row(j, false))}
          </div>
        );
      })}

      {archive.length > 0 && (
        <>
          <button onClick={() => setShowArchive(!showArchive)} className="wb-t w-full text-left px-2 py-2"
            style={{ ...eyebrow, color: C.dim }}>
            {showArchive ? "HIDE" : "SHOW"} CLOSED AND DROPPED · {archive.length}
          </button>
          {showArchive && archive.slice().reverse().map((j) => (
            <div key={j.id} className="flex items-baseline gap-3 py-1.5 px-2">
              <span className="flex-1" style={{
                fontSize: 13, color: C.dim,
                textDecoration: j.status === "done" ? "line-through" : "none",
                textDecorationColor: C.dim2,
              }}>{j.title}</span>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: j.status === "done" ? C.foam : C.oxide }}>
                {j.status === "done" ? j.doneOn : `dropped ${j.droppedOn}`}
              </span>
              <button onClick={() => onSet(j.id, { status: "open", doneOn: null, droppedOn: null })}
                className="wb-t" style={{ fontSize: 11, color: C.dim2 }}>reopen</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
