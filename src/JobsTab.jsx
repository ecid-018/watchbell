import React, { useState } from "react";

/* ------------------------------------------------------------------
   The engine room list.

   A working list, so it reads as one: rank, then the work, then how long
   it has been waiting. Nothing here scores you. A job that has been on the
   list four days turns oxide because that is information you need, not
   because you have failed at it.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { CARRY_WARN, carriedFor, carryLabel, groupByAssignee } from "./jobs.js";

export default function JobsTab({ C, dark, wide, jobs, ranks, todayKey, onAdd, onSet, onSpawnBack }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignee, setAssignee] = useState(ranks[0] || "Self");
  const [priority, setPriority] = useState("normal");
  const [open, setOpen] = useState(null);
  const [showArchive, setShowArchive] = useState(false);

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const field = {
    fontFamily: F.ui, fontSize: 16, color: C.text,
    background: C.sub, border: `1px solid ${C.line2}`,
    height: 46, WebkitAppearance: "none", colorScheme: dark ? "dark" : "light",
  };

  const groups = groupByAssignee(jobs, ranks, todayKey);
  const archive = jobs.filter((j) => j.status !== "open");

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title, detail, assignee, priority });
    setTitle(""); setDetail(""); setPriority("normal"); setAdding(false);
  };

  const act = (label, onClick, tone) => (
    <button onClick={onClick} className="wb-t flex-1 rounded-lg py-2" style={{
      fontSize: 12.5, fontWeight: 600, color: tone || C.text2, border: `1px solid ${C.line2}`,
    }}>{label}</button>
  );

  const row = (j) => {
    const n = carriedFor(j, todayKey);
    const late = n >= CARRY_WARN;
    const isOpen = open === j.id;
    return (
      <div key={j.id}>
        <button onClick={() => setOpen(isOpen ? null : j.id)}
          className="wb-t w-full flex items-start gap-3 py-2.5 px-2 rounded-xl text-left"
          style={{ background: isOpen ? C.sub : "transparent" }}>
          <span className="shrink-0 rounded-full" style={{
            width: 8, height: 8, marginTop: 6,
            background: j.priority === "urgent" ? C.oxide : late ? C.amber : C.ring,
          }} />
          <span className="flex-1">
            <span className="block" style={{ fontSize: wide ? 15 : 14, color: C.text }}>{j.title}</span>
            {j.detail && (
              <span className="block" style={{ fontSize: 12, lineHeight: 1.4, marginTop: 1, color: C.dim }}>{j.detail}</span>
            )}
            <span className="block" style={{ fontFamily: F.mono, fontSize: 10, marginTop: 2, color: late ? C.oxide : C.dim2 }}>
              {carryLabel(n)}
              {j.priority === "urgent" && " · URGENT"}
              {j.from && " · from a plan"}
            </span>
          </span>
        </button>
        {isOpen && (
          <div className="flex gap-2 px-2 pb-3">
            {act("Done", () => { onSet(j.id, { status: "done", doneOn: todayKey }); setOpen(null); }, C.foam)}
            {act("Carry", () => { onSet(j.id, { ackOn: todayKey }); setOpen(null); })}
            {act("Drop", () => { onSet(j.id, { status: "dropped", droppedOn: todayKey }); setOpen(null); }, C.oxide)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={wide ? "grid grid-cols-2 gap-4 items-start" : ""}>
      <div>
        {adding ? (
          <div className="wb-t rounded-2xl p-4 mb-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
            <div style={eyebrow}>NEW JOB</div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing" autoCapitalize="sentences"
              className="wb-t w-full rounded-xl mt-2 px-3" style={field} />
            <input type="text" value={detail} onChange={(e) => setDetail(e.target.value)}
              placeholder="Detail, if it needs it" autoCapitalize="sentences"
              className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, height: 42, fontSize: 14 }} />

            <div style={{ ...eyebrow, marginTop: 14 }}>ASSIGNED TO</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ranks.map((r) => (
                <button key={r} onClick={() => setAssignee(r)} className="wb-t px-2.5 py-1 rounded-full"
                  style={{
                    fontSize: 11.5, fontWeight: 500,
                    background: assignee === r ? C.amber : "transparent",
                    color: assignee === r ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                    border: `1px solid ${assignee === r ? C.amber : C.line2}`,
                  }}>{r}</button>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setPriority(priority === "urgent" ? "normal" : "urgent")}
                className="wb-t flex-1 rounded-xl py-2.5" style={{
                  fontSize: 13, fontWeight: 600,
                  color: priority === "urgent" ? (dark ? "#0E1C22" : "#FFFFFF") : C.text2,
                  background: priority === "urgent" ? C.oxide : "transparent",
                  border: `1px solid ${priority === "urgent" ? C.oxide : C.line2}`,
                }}>Urgent</button>
              <button onClick={submit} disabled={!title.trim()} className="wb-t flex-1 rounded-xl py-2.5"
                style={{
                  fontSize: 13, fontWeight: 600,
                  background: title.trim() ? C.amber : "transparent",
                  color: title.trim() ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
                  border: `1px solid ${title.trim() ? C.amber : C.line2}`,
                }}>Add</button>
            </div>
            <button onClick={() => setAdding(false)} className="wb-t w-full mt-2" style={{ fontSize: 12.5, color: C.dim }}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="wb-t w-full rounded-xl py-3 mb-3"
            style={{ fontSize: 14, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
            Add a job
          </button>
        )}
      </div>

      <div>
        {groups.length === 0 && (
          <div style={{ fontSize: 13, lineHeight: 1.5, padding: "8px 4px", color: C.dim }}>
            Nothing on the list. Anything you add stays on it until it is done or dropped.
          </div>
        )}
        {groups.map(([rank, list]) => (
          <div key={rank} className="mb-3">
            <div className="flex items-baseline justify-between px-2" style={{ marginBottom: 2 }}>
              <span style={eyebrow}>{rank.toUpperCase()}</span>
              <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>{list.length}</span>
            </div>
            {list.map(row)}
          </div>
        ))}

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
    </div>
  );
}
