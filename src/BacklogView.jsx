import React from "react";

/* ------------------------------------------------------------------
   The pool: work that exists but isn't scheduled for today. Grouped so
   related jobs batch together, one tap to pull a job onto Today.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { portItemVisible } from "./backlog.js";

export default function BacklogView({ C, dark, wide, pool, events, todayKey, onPull }) {
  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const visible = pool.filter((j) => portItemVisible(j, events, todayKey));
  const hiddenAtSea = pool.length - visible.length;

  const byGroup = new Map();
  for (const j of visible) {
    const g = j.group || "Ungrouped";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(j);
  }
  const groups = [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      {groups.length === 0 && (
        <div style={{ fontSize: 13, lineHeight: 1.5, padding: "8px 4px", color: C.dim }}>
          Nothing waiting in the backlog.
          {hiddenAtSea > 0 ? ` ${hiddenAtSea} port item${hiddenAtSea === 1 ? "" : "s"} will show once you're alongside.` : ""}
        </div>
      )}
      {groups.map(([group, items]) => (
        <div key={group} className="mb-3">
          <div className="flex items-baseline justify-between px-2" style={{ marginBottom: 2 }}>
            <span style={eyebrow}>{group.toUpperCase()}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>{items.length}</span>
          </div>
          {items.map((j) => (
            <div key={j.id} className="flex items-start gap-3 py-2.5 px-2 rounded-xl">
              <span className="flex-1">
                <span className="block" style={{ fontSize: wide ? 15 : 14, color: C.text }}>{j.title}</span>
                {j.detail && <span className="block" style={{ fontSize: 12, lineHeight: 1.4, marginTop: 1, color: C.dim }}>{j.detail}</span>}
                <span className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                  {(j.priority === "psc" || j.priority === "defect") && <span style={{ ...eyebrow, color: C.oxide }}>{j.priority.toUpperCase()}</span>}
                  {j.check && <span style={{ ...eyebrow, color: C.amber }}>CHECK WORDING</span>}
                  {j.fabrication && <span style={{ ...eyebrow, color: C.fuel }}>FABRICATION</span>}
                  {j.where === "port" && <span style={{ ...eyebrow, color: C.foam }}>PORT</span>}
                </span>
              </span>
              <button onClick={() => onPull(j.id)} className="wb-t shrink-0 rounded-lg px-3 py-2"
                style={{ fontSize: 12.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
                Pull to today
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
