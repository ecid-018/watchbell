import React, { useState } from "react";

/* ------------------------------------------------------------------
   Standing orders: what the ship is doing, and since when.

   One screen serves three moments — first run, changing the current
   phase's date, and deciding what happens after arrival — because they
   are the same form with a different heading and a different verb.
   Same shell, tokens and type as the app so it reads as one piece.
   Native <input type="date|time"> — the iPad's own pickers, no library,
   offline.
------------------------------------------------------------------ */

import { F, THEME, isDark } from "./theme.js";
import { K, readJSON } from "./storage.js";
import { dateKey } from "./voyage.js";
import { LEGACY_PREFILL, isLegacy } from "./phase.js";
import { openForUTC, utcLabel } from "./schedule.js";

const COPY = {
  first: { eyebrow: "STANDING ORDERS", verb: "Begin passage", sub: "Where the ship is, and since when" },
  edit: { eyebrow: "CHANGE STANDING ORDERS", verb: "Save", sub: "Correct the passage as logged" },
  next: { eyebrow: "PASSAGE COMPLETE — WHAT NOW", verb: "Log it in", sub: "Put to sea again, or lie alongside" },
};

/** Half-hour granularity covers every zone a ship keeps, India's +5:30 included. */
const UTC_CHOICES = Array.from({ length: 53 }, (_, i) => -12 + i * 0.5);

export default function Setup({ mode = "first", value, onSave, onCancel }) {
  const now = new Date();
  const theme = readJSON(K.mode, "auto");
  const dark = isDark(theme, now);
  const C = dark ? THEME.dark : THEME.light;
  const copy = COPY[mode] ?? COPY.first;

  // A passage stored before voyages were configurable has no fields to show, so
  // it is prefilled with the plan it was drawn from — the note below says plainly
  // that saving re-cuts it.
  const seed = value && isLegacy(value) ? { ...LEGACY_PREFILL, start: value.start } : value;
  const first = mode === "first";

  const [kind, setKind] = useState(seed?.kind ?? "voyage");
  const [start, setStart] = useState(seed?.start ?? dateKey(now));
  const [from, setFrom] = useState(seed?.from ?? (first ? LEGACY_PREFILL.from : ""));
  const [to, setTo] = useState(seed?.to ?? (first ? LEGACY_PREFILL.to : ""));
  const [days, setDays] = useState(String(seed?.days ?? (first ? LEGACY_PREFILL.days : 40)));
  const [utc0, setUtc0] = useState(seed?.utc0 ?? (first ? LEGACY_PREFILL.utc0 : 0));
  // A passage that crosses nothing is a real passage, so the arrival offset
  // starts equal to the departure one rather than at UTC.
  const [utc1, setUtc1] = useState(seed?.utc1 ?? seed?.utc0 ?? (first ? LEGACY_PREFILL.utc1 : 0));
  const [stand0, setStand0] = useState(seed?.stand0 ? String(seed.stand0) : "");
  const [stand1, setStand1] = useState(seed?.stand1 ? String(seed.stand1) : "");
  const [standWhy, setStandWhy] = useState(seed?.standWhy ?? (first ? LEGACY_PREFILL.standWhy : ""));
  const [port, setPort] = useState(seed?.port ?? "");
  const [open, setOpen] = useState(seed?.open ?? "09:30");
  const [trade, setTrade] = useState(seed?.trade !== false);

  const nDays = Math.round(Number(days));
  const stood = Number(stand0) > 0 && Number(stand1) > 0;
  const valid = start && (kind === "port" ? port.trim() : from.trim() && to.trim() && nDays >= 1);

  const submit = () => {
    if (!valid) return;
    onSave(
      kind === "voyage"
        ? {
            kind: "voyage", start,
            from: from.trim(), to: to.trim(), days: nDays,
            utc0: Number(utc0), utc1: Number(utc1),
            ...(stood
              ? { stand0: Number(stand0), stand1: Number(stand1), standWhy: standWhy.trim() }
              : {}),
          }
        : { kind: "port", start, port: port.trim(), open, trade },
    );
  };

  const field = {
    fontFamily: F.mono, fontSize: 16, color: C.text,
    background: C.sub, border: `1px solid ${C.line2}`,
    height: 48, WebkitAppearance: "none", colorScheme: dark ? "dark" : "light",
  };
  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };

  const Choice = ({ on, onClick, title, note }) => (
    <button onClick={onClick} className="wb-t flex-1 rounded-xl px-3 py-3 text-left"
      style={{ background: on ? C.sub : "transparent", border: `1px solid ${on ? C.amber : C.line2}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: on ? C.text : C.text2 }}>{title}</div>
      <div style={{ fontSize: 11, lineHeight: 1.35, marginTop: 2, color: C.dim }}>{note}</div>
    </button>
  );

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
            {copy.sub}
          </div>
        </div>

        <div className="px-5 py-5">
          {mode !== "edit" && (
            <>
              <div style={eyebrow}>{copy.eyebrow}</div>
              <div className="flex gap-2 mt-2 mb-5">
                <Choice on={kind === "voyage"} onClick={() => setKind("voyage")}
                  title="At sea" note="A passage on the ship's regular run" />
                <Choice on={kind === "port"} onClick={() => setKind("port")}
                  title="Alongside" note="A port stay, open-ended until you sail" />
              </div>
            </>
          )}

          {kind === "voyage" ? (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div style={eyebrow}>DEPARTURE PORT</div>
                  <input type="text" value={from} onChange={(e) => setFrom(e.target.value)}
                    placeholder="New Orleans" autoCapitalize="words" autoCorrect="off"
                    className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, fontFamily: F.ui }} />
                </div>
                <div className="flex-1">
                  <div style={eyebrow}>ARRIVAL PORT</div>
                  <input type="text" value={to} onChange={(e) => setTo(e.target.value)}
                    placeholder="Mundra" autoCapitalize="words" autoCorrect="off"
                    className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, fontFamily: F.ui }} />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <div className="flex-[1.4]">
                  <div style={eyebrow}>DEPARTURE</div>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                    className="wb-t w-full rounded-xl mt-2 px-3" style={field} />
                </div>
                <div className="flex-1">
                  <div style={eyebrow}>DAYS AT SEA</div>
                  <input type="number" inputMode="numeric" min="1" value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="wb-t w-full rounded-xl mt-2 px-3" style={field} />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <div className="flex-1">
                  <div style={eyebrow}>UTC AT DEPARTURE</div>
                  <select value={utc0} onChange={(e) => setUtc0(Number(e.target.value))}
                    className="wb-t w-full rounded-xl mt-2 px-3" style={field}>
                    {UTC_CHOICES.map((v) => <option key={v} value={v}>{utcLabel(v)}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <div style={eyebrow}>UTC AT ARRIVAL</div>
                  <select value={utc1} onChange={(e) => setUtc1(Number(e.target.value))}
                    className="wb-t w-full rounded-xl mt-2 px-3" style={field}>
                    {UTC_CHOICES.map((v) => <option key={v} value={v}>{utcLabel(v)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 10, color: C.dim }}>
                The legs draw themselves from the clock: one per hour you put on or take
                off, and the session retimes with them. Cash open is 13:30 UTC wherever
                the ship is — {utcLabel(utc0)} makes that {openForUTC(utc0)}, {utcLabel(utc1)} makes it {openForUTC(utc1)}.
              </div>

              <div style={{ ...eyebrow, marginTop: 20 }}>NO SESSION — OPTIONAL</div>
              <div className="flex gap-2 items-center mt-2">
                <input type="number" inputMode="numeric" min="1" max={nDays || undefined} value={stand0}
                  onChange={(e) => setStand0(e.target.value)} placeholder="day"
                  className="wb-t flex-1 rounded-xl px-3" style={field} />
                <span style={{ fontSize: 12.5, color: C.dim }}>to</span>
                <input type="number" inputMode="numeric" min="1" max={nDays || undefined} value={stand1}
                  onChange={(e) => setStand1(e.target.value)} placeholder="day"
                  className="wb-t flex-1 rounded-xl px-3" style={field} />
              </div>
              {stood && (
                <input type="text" value={standWhy} onChange={(e) => setStandWhy(e.target.value)}
                  placeholder="Agulhas transit — heavy rolling"
                  className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, fontFamily: F.ui, fontSize: 14 }} />
              )}
              <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 8, color: C.dim }}>
                Days those checks are not yours to make. They score out of a shorter day
                rather than against you, and the reason shows on the session row.
              </div>

              {value && isLegacy(value) && (
                <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 12, color: C.oxide }}>
                  This passage was logged before legs were drawn from the clock. Saving
                  re-cuts it — the same days and the same stand-down, named by ship's time
                  rather than by sea area.
                </div>
              )}
            </>
          ) : (
            <>
              <div style={eyebrow}>PORT</div>
              <input type="text" value={port} onChange={(e) => setPort(e.target.value)}
                placeholder="Mundra" autoCapitalize="words" autoCorrect="off"
                className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, fontFamily: F.ui }} />

              <div style={{ ...eyebrow, marginTop: 20 }}>ALONGSIDE SINCE</div>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="wb-t w-full rounded-xl mt-2 px-3" style={field} />

              <div style={{ ...eyebrow, marginTop: 20 }}>CASH OPEN, LOCAL</div>
              <input type="time" value={open} onChange={(e) => setOpen(e.target.value)}
                className="wb-t w-full rounded-xl mt-2 px-3" style={field} />

              <button onClick={() => setTrade(!trade)}
                className="wb-t w-full rounded-xl mt-3 px-3 flex items-center justify-between"
                style={{ height: 48, background: C.sub, border: `1px solid ${C.line2}` }}>
                <span style={{ fontSize: 14, color: C.text }}>Trading alongside</span>
                <span className="wb-t rounded-full flex items-center" style={{
                  width: 44, height: 26, padding: 3,
                  background: trade ? C.foam : C.track,
                  justifyContent: trade ? "flex-end" : "flex-start",
                }}>
                  <span className="rounded-full" style={{ width: 20, height: 20, background: dark ? "#0E1C22" : "#FFFFFF" }} />
                </span>
              </button>

              <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 10, color: C.dim }}>
                The stay runs open-ended — the day count keeps climbing until you log the
                next passage. The day itself keeps its shape; only the session retimes.
              </div>
            </>
          )}

          <button onClick={submit} disabled={!valid} className="wb-t w-full rounded-xl mt-5"
            style={{
              height: 46, fontSize: 15, fontWeight: 600,
              background: valid ? C.amber : C.sub,
              color: valid ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
              border: `1px solid ${valid ? C.amber : C.line2}`,
            }}>
            {copy.verb}
          </button>

          {onCancel && (
            <button onClick={onCancel} className="wb-t w-full mt-3" style={{ fontSize: 12.5, color: C.dim }}>
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
