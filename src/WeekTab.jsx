import React, { useState } from "react";

/* ------------------------------------------------------------------
   Sunday, in two halves.

   Look back is read off what already happened — nothing to fill in but the
   journal. Look forward is three priorities and a plan, and last week's
   three sit beside them still tickable, because seeing what did not get
   done is the point of writing them down.

   Every week is kept. You can walk back through them.
------------------------------------------------------------------ */

import { useMemo } from "react";
import { F } from "./theme.js";
import { addDays, dateKey, mondayOf, parseKey, prettyDate } from "./voyage.js";
import { readLog } from "./storage.js";
import { ADMIN } from "./data/admin-tasks.js";
import { BACKLOG } from "./data/jobs-backlog.js";
import { criticalCarriedInWeek } from "./admin.js";
import { recurringTasksFromBacklog } from "./backlog.js";

// Weekly backlog items (S03/S04) ride the admin cadence engine too, so the
// carried-critical lookup here needs to know their titles as well as ADMIN's.
const TASKS = [...ADMIN, ...recurringTasksFromBacklog(BACKLOG)];

const blank = () => ({ review: "", plan: "", priorities: [{ text: "", done: false }, { text: "", done: false }, { text: "", done: false }] });

export const weekKey = (date) => dateKey(mondayOf(date));

export default function WeekTab({ C, dark, wide, weeks, today, onSet, figures }) {
  const [offset, setOffset] = useState(0); // weeks back from this one
  const monday = mondayOf(addDays(today, -offset * 7));
  const key = dateKey(monday);
  const entry = { ...blank(), ...(weeks[key] || {}) };
  const prevKey = dateKey(addDays(monday, -7));
  const prev = weeks[prevKey];
  const current = offset === 0;
  const carried = useMemo(
    () => criticalCarriedInWeek(TASKS, monday, addDays(monday, 6), readLog),
    [key],
  );

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const area = {
    fontFamily: F.serif, fontSize: 16, lineHeight: 1.5, color: C.text,
    background: C.sub, border: `1px solid ${C.line2}`,
    resize: "none", WebkitAppearance: "none", width: "100%",
  };

  const patch = (p) => onSet(key, { ...entry, ...p });
  const setPriority = (i, p) => {
    const next = entry.priorities.map((x, n) => (n === i ? { ...x, ...p } : x));
    patch({ priorities: next });
  };

  const stat = (label, value, note, col) => (
    <div className="wb-t rounded-2xl p-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
      <div style={{ ...eyebrow, letterSpacing: ".1em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.1, marginTop: 3, color: col || C.text }}>{value}</div>
      <div style={{ fontSize: 10.5, lineHeight: 1.3, color: C.dim }}>{note}</div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setOffset(offset + 1)} className="wb-t px-3 py-1.5 rounded-lg"
          style={{ fontSize: 13, color: C.text2, border: `1px solid ${C.line2}` }}>←</button>
        <div className="text-center">
          <div style={eyebrow}>{current ? "THIS WEEK" : `${offset} WEEK${offset > 1 ? "S" : ""} BACK`}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginTop: 2 }}>
            {prettyDate(monday)} — {prettyDate(addDays(monday, 6))}
          </div>
        </div>
        <button onClick={() => setOffset(Math.max(0, offset - 1))} disabled={current}
          className="wb-t px-3 py-1.5 rounded-lg"
          style={{ fontSize: 13, color: current ? C.dim2 : C.text2, border: `1px solid ${C.line2}` }}>→</button>
      </div>

      <div className={wide ? "grid grid-cols-2 gap-4 items-start" : ""}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 6 }}>LOOK BACK</div>
          {carried.length > 0 && (
            <div className="wb-t rounded-xl p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.oxide}66` }}>
              <div style={{ ...eyebrow, color: C.oxide }}>CRITICAL TASKS CARRIED THIS WEEK</div>
              {carried.map((c) => (
                <div key={c.key} className="flex items-baseline gap-2 py-1">
                  <span className="flex-1" style={{ fontSize: 13, color: C.text }}>{c.title}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.oxide }}>{c.date}</span>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {stat("Habits", figures.habit === null ? "—" : `${figures.habit}%`, "rolling seven", C.foam)}
            {stat("Sessions", `${figures.trained}/${figures.due}`, "trained", C.foam)}
            {stat("Jobs", `${figures.jobs.done}/${figures.jobs.total || 0}`, `${figures.jobs.carried} carried`, C.amber)}
            {stat("On plan", figures.plan ? `${figures.plan.hit}/${figures.plan.total}` : "—", "sessions to rule", C.amber)}
          </div>

          <div style={{ ...eyebrow, marginTop: 16 }}>TRADING JOURNAL REVIEW</div>
          <textarea value={entry.review} onChange={(e) => patch({ review: e.target.value })}
            rows={6} placeholder="What the week's trading actually said."
            className="wb-t rounded-xl mt-2 px-3 py-3" style={area} />
        </div>

        <div className={wide ? "" : "mt-5"}>
          <div style={{ ...eyebrow, marginBottom: 6 }}>LOOK FORWARD</div>

          {prev && prev.priorities?.some((p) => p.text) && (
            <div className="wb-t rounded-xl p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line2}` }}>
              <div style={eyebrow}>LAST WEEK'S THREE</div>
              {prev.priorities.filter((p) => p.text).map((p, i) => (
                <button key={i} onClick={() => onSet(prevKey, {
                  ...prev,
                  priorities: prev.priorities.map((x, n) => (n === i ? { ...x, done: !x.done } : x)),
                })} className="wb-t w-full flex items-center gap-2 py-1.5 text-left">
                  <span className="shrink-0 rounded-full" style={{
                    width: 13, height: 13,
                    border: `1.5px solid ${p.done ? C.foam : C.ring}`,
                    background: p.done ? C.foam : "transparent",
                  }} />
                  <span style={{
                    fontSize: 13, color: p.done ? C.dim : C.text2,
                    textDecoration: p.done ? "line-through" : "none", textDecorationColor: C.dim2,
                  }}>{p.text}</span>
                </button>
              ))}
            </div>
          )}

          <div style={eyebrow}>THREE PRIORITIES</div>
          {entry.priorities.map((p, i) => (
            <div key={i} className="flex items-center gap-2 mt-2">
              <button onClick={() => setPriority(i, { done: !p.done })} className="wb-t shrink-0 rounded-full"
                style={{
                  width: 18, height: 18,
                  border: `1.5px solid ${p.done ? C.foam : C.ring}`,
                  background: p.done ? C.foam : "transparent",
                }} />
              <input type="text" value={p.text} onChange={(e) => setPriority(i, { text: e.target.value })}
                placeholder={`Priority ${i + 1}`} autoCapitalize="sentences"
                className="wb-t flex-1 rounded-xl px-3" style={{
                  fontFamily: F.ui, fontSize: 15, color: C.text, height: 42,
                  background: C.sub, border: `1px solid ${C.line2}`,
                  textDecoration: p.done ? "line-through" : "none",
                }} />
            </div>
          ))}

          <div style={{ ...eyebrow, marginTop: 16 }}>THE WEEK'S PLAN</div>
          <textarea value={entry.plan} onChange={(e) => patch({ plan: e.target.value })}
            rows={5} placeholder="What the week is for."
            className="wb-t rounded-xl mt-2 px-3 py-3" style={area} />
        </div>
      </div>
    </div>
  );
}
