import React, { useState } from "react";

/* ------------------------------------------------------------------
   The reading is not logged until it has been thought about.

   Ticking a reading opens this instead of setting a flag, so the tick is
   the *result* of writing something rather than a thing you can do on the
   way past. Untick lives in here too — one door in and out, which is what
   keeps the reflection reachable after the fact instead of stranded
   behind a completed checkbox.

   Storage is by reading-plan day, the same continuous counter the plan
   itself runs on, so reflections survive a change of passage.
------------------------------------------------------------------ */

import { F } from "./theme.js";

/** A reflection is a sentence, not a keystroke. Roughly seven or eight words. */
export const REFLECT_MIN = 40;

export default function Reflection({ C, dark, day, plan, value, isRead, onSave, onUnread, onClose }) {
  const [text, setText] = useState(value ?? "");
  const body = text.trim();
  const short = Math.max(0, REFLECT_MIN - body.length);
  const ok = short === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3"
      style={{ background: dark ? "rgba(4,10,13,.72)" : "rgba(16,38,46,.42)" }}
      onClick={onClose}>
      <div className="wb-t w-full max-w-md rounded-[22px] overflow-hidden"
        style={{
          background: C.card, border: `1px solid ${C.line2}`, boxShadow: C.shadow,
          marginBottom: "env(safe-area-inset-bottom)",
        }}
        onClick={(e) => e.stopPropagation()}>

        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>
            REFLECTION · READING DAY {String(day).padStart(2, "0")}
          </div>
          <div style={{ fontFamily: F.serif, fontSize: 22, lineHeight: 1.25, marginTop: 6, color: C.gold }}>{plan.psalm}</div>
          <div style={{ fontFamily: F.serif, fontSize: 22, lineHeight: 1.25, color: C.text }}>{plan.nt}</div>
        </div>

        <div className="px-5 py-4">
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>
            WHAT IT SAID · WHAT YOU WILL DO
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            autoFocus={!isRead}
            placeholder="One honest sentence is enough."
            className="wb-t w-full rounded-xl mt-2 px-3 py-3"
            style={{
              fontFamily: F.serif, fontSize: 16, lineHeight: 1.5, color: C.text,
              background: C.sub, border: `1px solid ${C.line2}`,
              resize: "none", WebkitAppearance: "none",
            }}
          />

          <div className="flex items-center justify-between mt-2" style={{ fontFamily: F.mono, fontSize: 10.5 }}>
            <span style={{ color: ok ? C.foam : C.dim }}>
              {ok ? "logged in full" : `${short} more character${short === 1 ? "" : "s"}`}
            </span>
            <span style={{ color: C.dim2 }}>{body.length}</span>
          </div>

          <button onClick={() => ok && onSave(text)} disabled={!ok}
            className="wb-t w-full rounded-xl mt-4"
            style={{
              height: 46, fontSize: 15, fontWeight: 600,
              background: ok ? C.gold : C.sub,
              color: ok ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
              border: `1px solid ${ok ? C.gold : C.line2}`,
            }}>
            {isRead ? "Save reflection" : "Mark read"}
          </button>

          <div className="flex gap-3 mt-3">
            <button onClick={onClose} className="wb-t flex-1" style={{ fontSize: 12.5, color: C.dim }}>
              Close
            </button>
            {isRead && (
              <button onClick={onUnread} className="wb-t flex-1" style={{ fontSize: 12.5, color: C.oxide }}>
                Mark unread
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
