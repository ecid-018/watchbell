import React, { useState, useMemo, useEffect } from "react";

/* ------------------------------------------------------------------
   WATCHBELL — daily discipline log for a passage
   New Orleans → India via the Cape of Good Hope
   Apple system typography · auto light/dark
------------------------------------------------------------------ */

const F = {
  ui: '-apple-system, "SF Pro Text", "SF Pro Display", BlinkMacSystemFont, "Helvetica Neue", sans-serif',
  serif: 'ui-serif, "New York", Iowan Old Style, Georgia, serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
};

const THEME = {
  dark: {
    bg: "#08151A", card: "#0E1C22", panel: "#0B1A20", sub: "#12262C",
    line: "#1B333B", line2: "#24404A", text: "#E9F0EF", text2: "#9DB2B8",
    dim: "#5E7C87", dim2: "#48646E", amber: "#E9B255", foam: "#6FB9A6",
    oxide: "#D0674A", gold: "#C7A86B", ring: "#2C4A54", track: "#1B333B",
    shadow: "0 24px 60px rgba(0,0,0,.55)",
  },
  light: {
    bg: "#DDE5E8", card: "#F7FAFA", panel: "#EDF2F4", sub: "#FFFFFF",
    line: "#DCE5E8", line2: "#C7D6DB", text: "#10262E", text2: "#3E5B66",
    dim: "#6C848D", dim2: "#8AA0A8", amber: "#96650F", foam: "#1C7A64",
    oxide: "#A2422A", gold: "#7E6428", ring: "#BDCDD3", track: "#D8E2E5",
    shadow: "0 16px 40px rgba(16,38,46,.14)",
  },
};

const LEGS = [
  { id: 0, name: "Gulf / Florida Straits", short: "Gulf", utc: "−5", open: "08:30", d0: 1, d1: 3, trade: true },
  { id: 1, name: "Mid-Atlantic", short: "Mid-Atl", utc: "−3", open: "10:30", d0: 4, d1: 12, trade: true },
  { id: 2, name: "South Atlantic", short: "S. Atl", utc: "−1", open: "12:30", d0: 13, d1: 22, trade: true, prime: true },
  { id: 3, name: "Cape approach", short: "Approach", utc: "+1", open: "14:30", d0: 23, d1: 26, trade: true },
  { id: 4, name: "Rounding the Cape", short: "Cape", utc: "+2", open: "15:30", d0: 27, d1: 29, trade: false, why: "Agulhas transit — heavy rolling, lashing checks" },
  { id: 5, name: "Indian Ocean", short: "Indian Oc.", utc: "+4", open: "17:30", d0: 30, d1: 37, trade: true },
  { id: 6, name: "India arrival", short: "Arrival", utc: "+5:30", open: "19:00", d0: 38, d1: 40, trade: true, lateRound: true },
];

const NT = [
  ...Array.from({ length: 28 }, (_, i) => `Matthew ${i + 1}`),
  ...Array.from({ length: 16 }, (_, i) => `Mark ${i + 1}`),
];
const dayPlan = (day) => ({ psalm: `Psalm ${((day - 1) % 150) + 1}`, nt: NT[(day - 1) % NT.length] });

const BASE = [
  { id: "wake", t: "0530", label: "Wake, hydrate, make the bunk", tag: "reset" },
  { id: "word", t: "0535", label: "Prayer and Bible reading", tag: "word" },
  { id: "train", t: "0550", label: "Exercise", tag: "body" },
  { id: "prep", t: "0640", label: "Shower, breakfast, three priorities", tag: "reset" },
  { id: "round-am", t: "0730", label: "Morning round", tag: "duty" },
  { id: "work", t: "0800", label: "Daywork", tag: "duty" },
  { id: "admin", t: "1500", label: "Admin block", tag: "duty" },
  { id: "trade", t: "", label: "Trading session", tag: "desk" },
  { id: "round-pm", t: "2000", label: "Night round", tag: "duty" },
  { id: "cabin", t: "2115", label: "Cabin reset", tag: "reset" },
  { id: "vespers", t: "2130", label: "Evening prayer, phone down", tag: "word" },
  { id: "sleep", t: "2215", label: "Lights out", tag: "reset" },
];

const TAGS = {
  duty: { k: "text2", n: "Duty" },
  word: { k: "gold", n: "Word" },
  body: { k: "foam", n: "Body" },
  desk: { k: "amber", n: "Desk" },
  reset: { k: "dim", n: "Reset" },
};

const mins = (h) => parseInt(h.slice(0, 2), 10) * 60 + parseInt(h.slice(2), 10);
const addMin = (h, m) => {
  const v = (mins(h) + m + 1440) % 1440;
  return String(Math.floor(v / 60)).padStart(2, "0") + String(v % 60).padStart(2, "0");
};
const pretty = (h) => `${h.slice(0, 2)}:${h.slice(2)}`;

export default function Watchbell() {
  const [legIdx, setLegIdx] = useState(2);
  const [tab, setTab] = useState("log");
  const [mode, setMode] = useState("auto");
  const [done, setDone] = useState({ wake: true, word: true, train: true, prep: true, "round-am": true, work: true });
  const [read, setRead] = useState({});

  const hour = new Date().getHours();
  const autoDark = hour >= 18 || hour < 7;
  const dark = mode === "auto" ? autoDark : mode === "dark";
  const C = dark ? THEME.dark : THEME.light;

  const leg = LEGS[legIdx];
  const day = Math.round((leg.d0 + leg.d1) / 2);
  const plan = dayPlan(day);

  const items = useMemo(() => {
    const o = leg.open.replace(":", "");
    return BASE.map((b) => {
      if (b.id === "trade") return { ...b, t: addMin(o, -30), endT: addMin(o, 105), stood: !leg.trade };
      if (b.id === "round-pm" && leg.lateRound) return { ...b, t: "2200" };
      return b;
    }).sort((a, b) => mins(a.t) - mins(b.t));
  }, [legIdx]);

  const doable = items.filter((i) => !i.stood);
  const hit = doable.filter((i) => done[i.id]).length;
  const pct = Math.round((hit / doable.length) * 100);
  const progress = ((day - 1) / 39) * 100;

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `.wb-x::-webkit-scrollbar{display:none}
      .wb-t{transition:background-color .35s ease,color .35s ease,border-color .35s ease}
      @media (prefers-reduced-motion:reduce){.wb-t{transition:none}}`;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const Seg = ({ v, label }) => (
    <button onClick={() => setMode(v)} className="wb-t px-2.5 py-1 rounded-md" style={{
      fontFamily: F.ui, fontSize: 11, fontWeight: 500,
      background: mode === v ? C.sub : "transparent",
      color: mode === v ? C.text : C.dim,
      border: `1px solid ${mode === v ? C.line2 : "transparent"}`,
    }}>{label}</button>
  );

  return (
    <div className="wb-t min-h-screen w-full flex justify-center py-6 px-3" style={{ background: C.bg, fontFamily: F.ui }}>
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
            Day {String(day).padStart(2, "0")} of 40 · {leg.name}
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
              <button key={l.id} onClick={() => setLegIdx(l.id)} className="wb-t px-2.5 py-1 rounded-full whitespace-nowrap"
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
                const isDone = !!done[i.id];
                const accent = C[TAGS[i.tag].k];
                return (
                  <button key={i.id} onClick={() => !i.stood && setDone((d) => ({ ...d, [i.id]: !d[i.id] }))}
                    className="wb-t w-full flex items-center gap-3 py-2.5 px-2 rounded-xl text-left"
                    style={{ background: isDone ? C.sub : "transparent", opacity: i.stood ? 0.5 : 1 }}>
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
                {Array.from({ length: 8 }, (_, k) => day - 2 + k).filter((d) => d >= 1 && d <= 40).map((d) => {
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
                  {pct}<span style={{ fontSize: 26, fontWeight: 600 }}>%</span>
                </div>
                <div style={{ fontSize: 12.5, marginTop: 2, color: C.text2 }}>{hit} of {doable.length} logged today</div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[["Grace days", "2", "left this week", C.amber], ["On plan", "9/9", "sessions to rule", C.foam]].map(([t, v, s, col]) => (
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
                  const n = doable.filter((i) => i.tag === k);
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
            </div>
          )}
        </div>

        <div className="px-5 py-3 wb-t" style={{ borderTop: `1px solid ${C.line}`, fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>
          TAP A LEG — THE DAY RETIMES ITSELF
        </div>
      </div>
    </div>
  );
}
