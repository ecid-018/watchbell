import React from "react";

/* ------------------------------------------------------------------
   Two lists under the passage: what is owed, and what has been written.

   The unread list runs oldest first, because that is the order you catch
   up in — you do not start with yesterday. The journal runs newest first,
   because that is the order you go looking. Both open a day the same way
   a row of the passage does, so catching up is the ordinary act of
   reading and writing, not a separate mode.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { firstLine } from "./journal.js";
import { parseKey } from "./voyage.js";

/* Spelled out rather than left to toLocaleDateString: the row is a fixed
   width, and ICU renders the same month as "Sep" on one device and "Sept" on
   another. The journal should read the same wherever it is opened. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "30 Aug" — a date at row scale. */
const shortDate = (key) => {
  if (!key) return null;
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export default function JournalList({ C, unread, entries, shownReadDay, onOpen }) {
  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const code = (d) => `D${String(d).padStart(2, "0")}`;

  const row = (d, children, key) => (
    <button key={key} onClick={() => onOpen(d)}
      className="wb-t w-full flex items-center gap-3 py-2.5 px-2 rounded-xl text-left"
      style={{ minHeight: 44, background: d === shownReadDay ? C.sub : "transparent" }}>
      {children}
    </button>
  );

  return (
    <>
      {unread.length > 0 && (
        <>
          <div style={{ ...eyebrow, color: C.oxide, margin: "18px 0 6px" }}>
            {unread.length} READING DAY{unread.length === 1 ? "" : "S"} UNREAD
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, padding: "0 2px 6px", color: C.dim2 }}>
            Oldest first. Open one and write — the chapters are already aboard.
          </div>
          {unread.map((u) => row(u.day, (
            <>
              <span style={{ fontFamily: F.mono, fontSize: 10.5, width: 30, color: C.oxide }}>{code(u.day)}</span>
              <span className="flex-1" style={{ fontFamily: F.serif, fontSize: 14, color: C.text }}>
                {u.plan.psalm} · {u.plan.nt}
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim2 }}>{shortDate(u.date) || "—"}</span>
            </>
          ), `u${u.day}`))}
        </>
      )}

      <div style={{ ...eyebrow, margin: "18px 0 6px" }}>JOURNAL · {entries.length}</div>
      {entries.length === 0 && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, padding: "2px 2px 0", color: C.dim }}>
          Nothing written yet. A reflection is what marks a reading read.
        </div>
      )}
      {entries.map((e) => row(e.day, (
        <>
          <span style={{ fontFamily: F.mono, fontSize: 10.5, width: 30, color: C.dim2 }}>{code(e.day)}</span>
          <span className="flex-1" style={{ minWidth: 0 }}>
            <span className="block" style={{ fontFamily: F.serif, fontSize: 14, color: C.text }}>
              {e.plan.psalm} · {e.plan.nt}
            </span>
            <span className="block" style={{ fontSize: 12, lineHeight: 1.4, marginTop: 1, color: C.dim }}>
              {firstLine(e.text)}
            </span>
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim2, textAlign: "right" }}>
            {shortDate(e.date) || "—"}
            {e.writtenOn && e.writtenOn !== e.date && (
              <span className="block" style={{ color: C.dim2 }}>written {shortDate(e.writtenOn)}</span>
            )}
          </span>
        </>
      ), `j${e.day}`))}
    </>
  );
}
