import React, { useState } from "react";

/* ------------------------------------------------------------------
   PSC as a first-class priority: every psc/defect item, closed-over-total
   up front, and the days-to-arrival countdown that pins open items to the
   top of Today once inside 21 days. Cannot be dropped here — only done,
   or deferred with a reason.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { pscItems, pscReadiness } from "./psc.js";
import { autoPhotoTag } from "./jobs.js";
import PhotoRow from "./PhotoRow.jsx";

export default function PscView({ C, dark, wide, jobs, todayKey, daysToArrival, pscDeferrals, onSet, onDefer }) {
  const [open, setOpen] = useState(null);
  const [deferring, setDeferring] = useState(null);
  const [reason, setReason] = useState("");

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const items = pscItems(jobs);
  const readiness = pscReadiness(jobs);

  const byGroup = new Map();
  for (const j of items) {
    const g = j.group || "Ungrouped";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(j);
  }
  const groups = [...byGroup.entries()];

  return (
    <div>
      <div className="wb-t rounded-2xl p-5 mb-3 text-center" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
        <div style={eyebrow}>PSC READINESS</div>
        <div style={{
          fontSize: 48, fontWeight: 700, letterSpacing: "-.03em", marginTop: 4,
          color: readiness.total && readiness.closed === readiness.total ? C.foam : C.oxide,
        }}>
          {readiness.total ? `${readiness.closed}/${readiness.total}` : "—"}
        </div>
        {daysToArrival != null && (
          <div style={{ fontSize: 12.5, marginTop: 4, color: daysToArrival <= 21 ? C.oxide : C.text2 }}>
            {daysToArrival} day{daysToArrival === 1 ? "" : "s"} to arrival
            {daysToArrival <= 21 ? " — open items lead the Today list" : ""}
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <div style={{ fontSize: 13, lineHeight: 1.5, padding: "8px 4px", color: C.dim }}>
          No PSC or defect items on the list.
        </div>
      )}

      {groups.map(([group, list]) => (
        <div key={group} className="mb-3">
          <div className="px-2" style={{ marginBottom: 2, ...eyebrow }}>{group.toUpperCase()}</div>
          {list.map((j) => {
            const isOpen = open === j.id;
            const isDeferring = deferring === j.id;
            const history = pscDeferrals[j.id] || [];
            return (
              <div key={j.id}>
                <button onClick={() => { setOpen(isOpen ? null : j.id); setDeferring(null); }}
                  className="wb-t w-full flex items-start gap-3 py-2.5 px-2 rounded-xl text-left"
                  style={{ background: isOpen ? C.panel : "transparent" }}>
                  <span className="shrink-0 rounded-full" style={{
                    width: 8, height: 8, marginTop: 6,
                    background: j.status === "done" ? C.foam : j.priority === "defect" ? C.oxide : C.amber,
                  }} />
                  <span className="flex-1">
                    <span className="block" style={{
                      fontSize: wide ? 15 : 14, color: C.text,
                      textDecoration: j.status === "done" ? "line-through" : "none", textDecorationColor: C.dim2,
                    }}>{j.title}</span>
                    <span className="block" style={{ fontFamily: F.mono, fontSize: 10, marginTop: 2, color: C.dim2 }}>
                      {j.priority.toUpperCase()} · {j.status === "done" ? `closed ${j.doneOn}` : j.status.toUpperCase()}
                      {history.length > 0 ? ` · deferred ${history.length}×` : ""}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <div className="px-2 pb-3">
                    {j.detail && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.text2, marginBottom: 8 }}>{j.detail}</div>}
                    <PhotoRow C={C} dark={dark} job={j} defaultTag={autoPhotoTag(j)} />
                    {history.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {history.map((d, i) => (
                          <div key={i} style={{ fontSize: 11.5, color: C.dim, marginTop: 2 }}>{d.date} — {d.reason}</div>
                        ))}
                      </div>
                    )}
                    {j.status !== "done" && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => onSet(j.id, { status: "done", doneOn: todayKey })}
                          className="wb-t flex-1 rounded-lg py-2" style={{ fontSize: 12.5, fontWeight: 600, color: C.foam, border: `1px solid ${C.line2}` }}>
                          Done
                        </button>
                        {isDeferring ? (
                          <div className="flex-[2] flex gap-1.5">
                            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                              placeholder="Reason" autoCapitalize="sentences"
                              className="wb-t flex-1 rounded-lg px-2" style={{
                                fontSize: 12.5, color: C.text, height: 34, minWidth: 0,
                                background: C.sub, border: `1px solid ${C.line2}`,
                              }} />
                            <button onClick={() => { if (reason.trim()) { onDefer(j.id, reason.trim()); setReason(""); setDeferring(null); } }}
                              disabled={!reason.trim()} className="wb-t rounded-lg px-2.5"
                              style={{ fontSize: 12, fontWeight: 600, color: reason.trim() ? C.text2 : C.dim2, border: `1px solid ${C.line2}` }}>
                              Confirm
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeferring(j.id)} className="wb-t flex-1 rounded-lg py-2"
                            style={{ fontSize: 12.5, fontWeight: 600, color: C.dim, border: `1px solid ${C.line2}` }}>
                            Defer, with reason
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
