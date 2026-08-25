import React, { useState } from "react";

/* ------------------------------------------------------------------
   First run: when did the passage begin.
   Same shell, tokens and type as the app so it reads as one piece.
   Native <input type="date"> — the iPad's own picker, no library, offline.
------------------------------------------------------------------ */

import { F, THEME, isDark } from "./theme.js";
import { K, readJSON } from "./storage.js";
import { dateKey } from "./voyage.js";

export default function Setup({ value, onSave, onCancel }) {
  const now = new Date();
  const mode = readJSON(K.mode, "auto");
  const dark = isDark(mode, now);
  const C = dark ? THEME.dark : THEME.light;

  const [draft, setDraft] = useState(value || dateKey(now));

  return (
    <div className="wb-t w-full flex justify-center px-3" style={{
      background: C.bg, fontFamily: F.ui,
      minHeight: "100dvh",
      paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
      paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
    }}>
      <div className="wb-t w-full max-w-sm rounded-[22px] overflow-hidden flex flex-col"
        style={{ background: C.card, border: `1px solid ${C.line2}`, boxShadow: C.shadow, height: "fit-content" }}>

        <div className="px-5 pt-5 pb-4 wb-t" style={{ borderBottom: `1px solid ${C.line}` }}>
          <span style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: ".14em", color: C.dim }}>MV QUEEN TRADER</span>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.024em", color: C.text, marginTop: 6 }}>Watchbell</div>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: ".05em", color: C.text2, marginTop: 2 }}>
            New Orleans → India · 40 days
          </div>
        </div>

        <div className="px-5 py-5">
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>DEPARTURE, NEW ORLEANS</div>

          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="wb-t w-full rounded-xl mt-2 px-3"
            style={{
              fontFamily: F.mono, fontSize: 17, color: C.text,
              background: C.sub, border: `1px solid ${C.line2}`,
              height: 48, WebkitAppearance: "none", colorScheme: dark ? "dark" : "light",
            }}
          />

          <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 10, color: C.dim }}>
            The day count and the leg follow the ship's clock from here. Set the iPad to
            ship's time and the day rolls over when the watch does.
          </div>

          <button
            onClick={() => draft && onSave(draft)}
            disabled={!draft}
            className="wb-t w-full rounded-xl mt-5"
            style={{
              height: 46, fontSize: 15, fontWeight: 600,
              background: draft ? C.amber : C.sub,
              color: draft ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
              border: `1px solid ${draft ? C.amber : C.line2}`,
            }}
          >
            Begin passage
          </button>

          {onCancel && (
            <button onClick={onCancel} className="wb-t w-full mt-3"
              style={{ fontSize: 12.5, color: C.dim }}>
              Cancel
            </button>
          )}
        </div>

        <div className="px-5 py-3 wb-t" style={{ borderTop: `1px solid ${C.line}`, fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>
          LOGGED ON THIS DEVICE — NOTHING LEAVES THE SHIP
        </div>
      </div>
    </div>
  );
}
