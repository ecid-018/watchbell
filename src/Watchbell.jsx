import React, { useState, useMemo, useEffect } from "react";

/* ------------------------------------------------------------------
   WATCHBELL — daily discipline log for a passage
   New Orleans → India via the Cape of Good Hope
   Apple system typography · auto light/dark

   Layout, colour and typography are unchanged from the original component.
   What changed: state persists to localStorage keyed by date, the current
   day and leg are derived from the real calendar, and the three figures on
   the Standing tab are computed instead of hardcoded.
------------------------------------------------------------------ */

import { F, THEME, isDark } from "./theme.js";
import { LEGS, TAGS, dayPlan, doableForLeg, itemsForLeg, pretty } from "./schedule.js";
import { K, readJSON, readLog, writeJSON } from "./storage.js";
import { dateKey, dayForDate, legForDay, prettyDate, parseKey, VOYAGE_DAYS } from "./voyage.js";
import { graceDays, onPlan, rollingSeven } from "./stats.js";

export default function Watchbell({ voyageStart, onChangeStart }) {
  // `now` lives in state so an app left open on the home screen rolls over at
  // midnight instead of writing ticks into yesterday's record.
  const [now, setNow] = useState(() => new Date());
  const todayKey = dateKey(now);

  const [tab, setTab] = useState("log");
  const [mode, setMode] = useState(() => readJSON(K.mode, "auto"));
  const [done, setDone] = useState(() => readLog(dateKey(new Date())));
  const [read, setRead] = useState(() => readJSON(K.read, {}) || {});

  // Real calendar position. legOverride === null means "live".
  const realDay = dayForDate(voyageStart, now);
  const autoLegIdx = legForDay(realDay).id;
  const [legOverride, setLegOverride] = useState(null);
  const legIdx = legOverride ?? autoLegIdx;
  const previewing = legOverride !== null && legOverride !== autoLegIdx;

  const dark = isDark(mode, now);
  const C = dark ? THEME.dark : THEME.light;

  const leg = LEGS[legIdx];
  // Live, the day is the calendar's. Previewing another leg, fall back to that
  // leg's midpoint — the original component's rule, kept so look-ahead reads the same.
  const day = previewing ? Math.round((leg.d0 + leg.d1) / 2) : realDay;
  const plan = dayPlan(day);

  const items = useMemo(() => itemsForLeg(leg), [legIdx]);

  // The Standing tab always reports today, never the previewed leg — otherwise
  // previewing the Cape would score today's ticks against an 11-item day.
  const todayDoable = useMemo(() => doableForLeg(LEGS[autoLegIdx]), [autoLegIdx]);
  const hit = todayDoable.filter((i) => done[i.id]).length;
  const progress = Math.min(100, Math.max(0, ((day - 1) / (VOYAGE_DAYS - 1)) * 100));

  // Computed figures for the Standing tab. Today's record is handed in from state
  // rather than re-read from storage, which is written only in an effect — so the
  // rolling number moves the moment a box is ticked instead of lagging one tick.
  const live = useMemo(() => ({ [todayKey]: done }), [todayKey, done]);
  const r7 = useMemo(() => rollingSeven(voyageStart, now, live), [voyageStart, todayKey, live]);
  const grace = useMemo(() => graceDays(voyageStart, now, live), [voyageStart, todayKey, live]);
  const plan7 = useMemo(() => onPlan(voyageStart, now, live), [voyageStart, todayKey, live]);

  /* -------- persistence -------- */

  useEffect(() => writeJSON(K.mode, mode), [mode]);
  useEffect(() => writeJSON(K.read, read), [read]);
  useEffect(() => writeJSON(K.log(todayKey), done), [todayKey, done]);

  // Day rollover: re-check the clock when the app comes back to the foreground
  // and on a slow timer, and reload the tick record if the date has moved on.
  useEffect(() => {
    const tick = () => {
      const fresh = new Date();
      if (dateKey(fresh) !== todayKey) {
        setDone(readLog(dateKey(fresh)));
        setLegOverride(null);
      }
      setNow(fresh);
    };
    const id = setInterval(tick, 60_000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [todayKey]);

  // Paint the page behind the card so iOS rubber-band overscroll does not flash
  // white, and keep the installed app's status bar tint in step with the theme.
  useEffect(() => {
    document.documentElement.style.background = C.bg;
    document.body.style.background = C.bg;
    const meta = document.getElementById("theme-color");
    if (meta) meta.setAttribute("content", C.card);
  }, [C]);

  const Seg = ({ v, label }) => (
    <button onClick={() => setMode(v)} className="wb-t px-2.5 py-1 rounded-md" style={{
      fontFamily: F.ui, fontSize: 11, fontWeight: 500,
      background: mode === v ? C.sub : "transparent",
      color: mode === v ? C.text : C.dim,
      border: `1px solid ${mode === v ? C.line2 : "transparent"}`,
    }}>{label}</button>
  );

  return (
    <div className="wb-t w-full flex justify-center px-3" style={{
      background: C.bg, fontFamily: F.ui,
      minHeight: "100dvh",
      paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
      paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
    }}>
      <div className="wb-t w-full max-w-sm rounded-[22px] overflow-hidden flex flex-col"
        style={{ background: C.card, border: `1px solid ${C.line2}`, boxShadow: C.shadow }}>

        {/* masthead */}
        <div className="px-5 pt-5 pb-4 wb-t" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: ".14em", color: C.dim }}>MV QUEEN TRADER</span>
            <div className="flex gap-0.5"><Seg v="auto" label="Auto" /><Seg v="light" label="Light" /><Seg v="dark" label="Dark" /></div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.024em", color: C.text }}>Watchbell</span>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: C.amber }}>UTC {leg.utc}</span>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: ".05em", color: C.text2, marginTop: 2 }}>
            Day {String(day).padStart(2, "0")} of {VOYAGE_DAYS} · {leg.name}
          </div>
        </div>

        {/* voyage strip */}
        <div className="px-5 py-4 wb-t" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
          <div className="flex justify-between" style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".1em", color: C.dim2, marginBottom: 8 }}>
            <span>NEW ORLEANS</span><span>CAPE</span><span>INDIA</span>
          </div>
          <div className="relative h-[3px] rounded-full" style={{ background: C.track }}>
            <div className="absolute h-[3px] rounded-full" style={{ width: `${progress}%`, background: C.foam }} />
            <div className="absolute -top-[3px] w-[9px] h-[9px] rounded-full" style={{ left: `calc(${progress}% - 4px)`, background: C.amber, boxShadow: dark ? "0 0 10px rgba(233,178,85,.7)" : "none" }} />
            <div className="absolute -top-[2px] w-[1px] h-[7px]" style={{ left: "67%", background: C.oxide }} />
          </div>

          <div className="flex gap-1.5 mt-3 overflow-x-auto wb-x" style={{ scrollbarWidth: "none" }}>
            {LEGS.map((l) => (
              <button key={l.id} onClick={() => setLegOverride(l.id === autoLegIdx ? null : l.id)} className="wb-t px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{
                  fontSize: 11, fontWeight: 500,
                  background: l.id === legIdx ? C.amber : "transparent",
                  color: l.id === legIdx ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                  border: `1px solid ${l.id === legIdx ? C.amber : C.line2}`,
                }}>{l.short}</button>
            ))}
          </div>

          <div className="mt-4 flex items-end justify-between">
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".1em", color: C.dim2 }}>CASH OPEN, SHIP'S TIME</div>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.05, marginTop: 2, color: leg.trade ? C.amber : C.oxide }}>
                {leg.trade ? leg.open : "Stood down"}
              </div>
            </div>
            {leg.prime && (
              <span className="wb-t px-2 py-1 rounded-md" style={{ fontSize: 10, fontWeight: 600, color: C.foam, background: dark ? "#12302B" : "#E4F1ED", border: `1px solid ${C.foam}40` }}>
                Prime window
              </span>
            )}
          </div>
          {!leg.trade && <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 8, color: C.oxide }}>{leg.why}. Prep and journal review only.</div>}
        </div>

        {/* tabs */}
        <div className="flex wb-t" style={{ borderBottom: `1px solid ${C.line}` }}>
          {[["log", "The day"], ["word", "Bible plan"], ["score", "Standing"]].map(([k, n]) => (
            <button key={k} onClick={() => setTab(k)} className="flex-1 py-3 wb-t"
              style={{ fontSize: 13, fontWeight: tab === k ? 600 : 500, color: tab === k ? C.text : C.dim, borderBottom: `2px solid ${tab === k ? C.amber : "transparent"}` }}>
              {n}
            </button>
          ))}
        </div>

        <div className="flex-1 px-4 py-4">
          {tab === "log" && (
            <div className="space-y-0.5">
              {items.map((i) => {
                // While previewing another leg the log is read-only: ticking a day
                // that has not happened yet would pre-fill its record.
                const isDone = previewing ? false : !!done[i.id];
                const accent = C[TAGS[i.tag].k];
                return (
                  <button key={i.id} onClick={() => !i.stood && !previewing && setDone((d) => ({ ...d, [i.id]: !d[i.id] }))}
                    className="wb-t w-full flex items-center gap-3 py-2.5 px-2 rounded-xl text-left"
                    style={{ background: isDone ? C.sub : "transparent", opacity: i.stood || previewing ? 0.5 : 1 }}>
                    <span style={{ fontFamily: F.mono, fontSize: 12, width: 38, color: isDone ? C.dim2 : C.text2 }}>{pretty(i.t)}</span>
                    <span className="self-stretch rounded-full" style={{ width: 3, background: accent, opacity: isDone ? 0.35 : 0.9 }} />
                    <span className="flex-1">
                      <span style={{ fontSize: 14, color: isDone ? C.dim : C.text, textDecoration: isDone ? "line-through" : "none", textDecorationColor: C.dim2 }}>{i.label}</span>
                      {i.id === "word" && (
                        <span className="block" style={{ fontFamily: F.serif, fontSize: 12.5, marginTop: 2, color: C.gold }}>{plan.psalm} · {plan.nt}</span>
                      )}
                      {i.id === "trade" && !i.stood && (
                        <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.dim }}>checklist {pretty(i.t)} → hard stop {pretty(i.endT)}</span>
                      )}
                      {i.id === "trade" && i.stood && (
                        <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.oxide }}>no session this leg</span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full flex items-center justify-center wb-t"
                      style={{ width: 20, height: 20, border: `1.5px solid ${isDone ? C.foam : C.ring}`, background: isDone ? C.foam : "transparent" }}>
                      {isDone && <span style={{ color: dark ? "#0E1C22" : "#FFFFFF", fontSize: 12, lineHeight: 1 }}>✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "word" && (
            <div>
              <div className="wb-t rounded-2xl p-5 mb-4" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>TODAY</div>
                <div style={{ fontFamily: F.serif, fontSize: 27, lineHeight: 1.22, marginTop: 6, color: C.gold }}>{plan.psalm}</div>
                <div style={{ fontFamily: F.serif, fontSize: 27, lineHeight: 1.22, color: C.text }}>{plan.nt}</div>
                <div style={{ fontSize: 12, marginTop: 8, color: C.dim }}>About twelve minutes. One Psalm, one chapter.</div>
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2, marginBottom: 6 }}>THE PASSAGE</div>
              <div>
                {Array.from({ length: 8 }, (_, k) => day - 2 + k).filter((d) => d >= 1 && d <= VOYAGE_DAYS).map((d) => {
                  const p = dayPlan(d);
                  const isRead = read[d] ?? d < day;
                  return (
                    <button key={d} onClick={() => setRead((r) => ({ ...r, [d]: !isRead }))}
                      className="wb-t w-full flex items-center gap-3 py-2.5 px-2 rounded-xl text-left">
                      <span style={{ fontFamily: F.mono, fontSize: 10.5, width: 30, color: d === day ? C.amber : C.dim2 }}>D{String(d).padStart(2, "0")}</span>
                      <span className="flex-1" style={{ fontFamily: F.serif, fontSize: 14, color: isRead ? C.dim : C.text }}>{p.psalm} · {p.nt}</span>
                      <span className="shrink-0 rounded-full" style={{ width: 15, height: 15, border: `1.5px solid ${isRead ? C.gold : C.ring}`, background: isRead ? C.gold : "transparent" }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "score" && (
            <div>
              <div className="wb-t rounded-2xl p-5 mb-3 text-center" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>ROLLING SEVEN DAYS</div>
                <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: "-.04em", lineHeight: 1.02, marginTop: 4, color: C.foam }}>
                  {r7 ? r7.pct : "—"}{r7 && <span style={{ fontSize: 26, fontWeight: 600 }}>%</span>}
                </div>
                <div style={{ fontSize: 12.5, marginTop: 2, color: C.text2 }}>{hit} of {todayDoable.length} logged today</div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  ["Grace days", String(grace.left), "left this week", grace.left === 0 ? C.oxide : C.amber],
                  ["On plan", plan7 ? `${plan7.hit}/${plan7.total}` : "—", "sessions to rule", C.foam],
                ].map(([t, v, s, col]) => (
                  <div key={t} className="wb-t rounded-2xl p-4" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
                    <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".1em", color: C.dim2 }}>{t.toUpperCase()}</div>
                    <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.05, marginTop: 4, color: col }}>{v}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>{s}</div>
                  </div>
                ))}
              </div>
              <div className="wb-t rounded-2xl p-4" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2, marginBottom: 6 }}>BY THREAD</div>
                {Object.entries(TAGS).map(([k, v]) => {
                  const n = todayDoable.filter((i) => i.tag === k);
                  const h = n.filter((i) => done[i.id]).length;
                  return (
                    <div key={k} className="flex items-center gap-3 py-1.5">
                      <span style={{ fontSize: 12.5, width: 48, color: C.text2 }}>{v.n}</span>
                      <span className="flex-1 rounded-full" style={{ height: 5, background: C.track }}>
                        <span className="block rounded-full" style={{ height: 5, width: `${n.length ? (h / n.length) * 100 : 0}%`, background: C[v.k] }} />
                      </span>
                      <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>{h}/{n.length}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 12, padding: "0 4px", color: C.dim }}>
                A missed day costs a grace day, not the record. Sunday closes the week with the journal review.
              </div>
              <button onClick={onChangeStart} className="wb-t text-left"
                style={{ fontSize: 12, lineHeight: 1.45, marginTop: 10, padding: "0 4px", color: C.dim2 }}>
                Passage began {prettyDate(parseKey(voyageStart))} · <span style={{ color: C.text2 }}>change</span>
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3 wb-t" style={{ borderTop: `1px solid ${C.line}`, fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>
          {previewing
            ? `PREVIEW — TAP ${LEGS[autoLegIdx].short.toUpperCase()} FOR TODAY`
            : "TAP A LEG — THE DAY RETIMES ITSELF"}
        </div>
      </div>
    </div>
  );
}
