import React, { useState } from "react";

/* ------------------------------------------------------------------
   The day's training.

   Three sections, in the order you meet them: the warm-up folded away
   because you know it by now, the main block open because it is the
   session, and the finisher and cool-down folded because they come
   after. Every line is read from the plan.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import Timer from "./Timer.jsx";
import { EXERCISE_KEYS, ExerciseFigure, exerciseCue, exerciseLabel } from "./components/ExerciseFigure.jsx";
import {
  COOLDOWN, RULES, buildIntervals, hasHeavyBlock, mainBlock, timerMode, warmupFor,
} from "./training.js";

/** Seen this many times and it stops asking for your attention. */
export const LEARNED_AT = 3;

const Chevron = ({ open, color }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"
    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>
    <path d="M2.5 4.5 6 8l3.5-3.5" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * One movement: what it is, how it is done, and how much of it.
 *
 * A movement the plan has tagged with a figure opens in place to show it.
 * One you have opened three times stops drawing the eye — the chevron goes
 * quiet but the figure stays a tap away, because the day you forget is the
 * day you need it.
 */
const Movement = ({ C, m, wide, open, onToggle, seen }) => {
  const figure = m.figure;
  const learned = (seen || 0) >= LEARNED_AT;
  const mark = open ? C.amber : learned ? C.dim2 : C.amber;

  const row = (
    <div className="flex items-baseline gap-3">
      <div className="flex-1">
        <div style={{ fontSize: wide ? 15 : 14, color: C.text }}>{m.name}</div>
        {m.detail && (
          <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 1, color: C.dim }}>{m.detail}</div>
        )}
      </div>
      {m.rounds && (
        <span className="shrink-0 rounded-md px-1.5 py-0.5" style={{
          fontFamily: F.mono, fontSize: 9.5, letterSpacing: ".04em",
          color: C.foam, border: `1px solid ${C.foam}55`,
        }}>
          ×{m.rounds}
        </span>
      )}
      <span className="shrink-0 text-right" style={{
        fontFamily: F.mono, fontSize: 12, color: C.text2,
        fontVariantNumeric: "tabular-nums", minWidth: 62,
      }}>
        {m.reps || m.time || ""}
      </span>
      {/* No figure, no control — nothing here to tap at. */}
      <span className="shrink-0 flex items-center justify-center" style={{ width: 14 }}>
        {figure && <Chevron open={open} color={mark} />}
      </span>
    </div>
  );

  if (!figure) return <div className="py-2">{row}</div>;

  return (
    <div className="py-1">
      <button onClick={onToggle} className="wb-t w-full text-left py-1">{row}</button>
      {open && (
        <div className="wb-t rounded-xl mt-1 mb-1 px-3 py-3" style={{ background: C.panel, border: `1px solid ${C.line2}` }}>
          <ExerciseFigure move={figure} colors={{ fig: C.text, line: C.dim, accent: C.amber }} />
          <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8, color: C.text2 }}>
            {exerciseCue(figure)}
          </div>
        </div>
      )}
    </div>
  );
};

/** A section that stays out of the way until it is wanted. */
const Fold = ({ C, title, count, open, onToggle, children }) => (
  <div className="wb-t rounded-2xl" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
    <button onClick={onToggle} className="wb-t w-full flex items-center justify-between px-4 py-3 text-left">
      <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>
        {title}
      </span>
      <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>
        {count} {open ? "▴" : "▾"}
      </span>
    </button>
    {open && <div className="px-4 pb-3">{children}</div>}
  </div>
);

export default function BodyTab({ C, dark, wide, session, heavy, onHeavy, record, onComplete, autoHeavy, recovery = null, seen = {}, onSeen = () => {}, onFlagPoor = () => {} }) {
  const [openWarm, setOpenWarm] = useState(false);
  const [openAfter, setOpenAfter] = useState(false);
  const [rules, setRules] = useState(false);
  // Every figure, reachable on a day whose own session has none — a treadmill
  // Monday is exactly when you are thinking about tomorrow's movements.
  const [reference, setReference] = useState(null);
  const [shown, setShown] = useState(null); // only one figure open at a time

  const toggleFigure = (m) => {
    if (shown === m.name) return setShown(null);
    setShown(m.name);
    if (m.figure) onSeen(m.figure);
  };

  const block = mainBlock(session, heavy);
  const swapped = heavy && hasHeavyBlock(session);
  const queue = buildIntervals(session, heavy);
  const mode = timerMode(session);
  const warm = warmupFor(session);
  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };

  const header = (
    <div className="wb-t rounded-2xl p-5" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div style={eyebrow}>{session.day.toUpperCase()} · {session.kind.toUpperCase()}</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", marginTop: 4, color: C.text }}>
            {session.name}
          </div>
        </div>
        <button onClick={() => onHeavy(!heavy)} className="wb-t shrink-0 rounded-xl px-3 py-2 text-left" style={{
          background: heavy ? C.oxide : "transparent",
          border: `1px solid ${heavy ? C.oxide : C.line2}`,
        }}>
          <span style={{
            fontFamily: F.mono, fontSize: 9, letterSpacing: ".1em",
            color: heavy ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
          }}>
            HEAVY WX
          </span>
        </button>
      </div>

      <div style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 8, color: C.text2 }}>{session.format}</div>
      <div className="flex gap-3 mt-2" style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>
        {session.duration > 0 && <span>{session.duration} min</span>}
        {session.gear && <span>{session.gear}</span>}
      </div>

      {recovery && (
        <div className="wb-t rounded-xl mt-3 p-3" style={{ background: C.panel, border: `1px solid ${C.amber}66` }}>
          <div style={{ ...eyebrow, color: C.amber }}>RECOVERY DAY</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 3, color: C.text }}>
            {recovery.from} ran past midnight and took {recovery.lost} h of the morning. Nothing hard
            today — walk it or take it off. The week's figure does not hold this against you.
          </div>
        </div>
      )}

      {heavy && (
        <div className="wb-t rounded-xl mt-3 p-3" style={{ background: dark ? "#2A130D" : "#F6E5E0", border: `1px solid ${C.oxide}66` }}>
          <div style={{ ...eyebrow, color: C.oxide }}>
            HEAVY WEATHER{autoHeavy ? " · SET BY THE LEG" : ""}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 3, color: C.text }}>
            {swapped
              ? "Main block swapped for the heavy-weather set."
              : hasHeavyBlock(session)
                ? RULES.seaState
                : "This session has no heavy-weather block. Use your judgement."}
          </div>
        </div>
      )}

      {session.gear === "Treadmill" && (
        <div className="flex items-start gap-2 mt-3">
          <span style={{ color: C.oxide, fontSize: 12 }}>▲</span>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: C.oxide }}>{RULES.treadmillLanyard}</span>
        </div>
      )}

      <div className="flex gap-4 mt-3">
        <button onClick={() => setRules(!rules)} className="wb-t text-left" style={{ fontSize: 11.5, color: C.dim2 }}>
          {rules ? "Hide the standing rules" : "The standing rules"}
        </button>
        <button onClick={() => setReference(EXERCISE_KEYS[0])} className="wb-t text-left" style={{ fontSize: 11.5, color: C.dim2 }}>
          Form reference
        </button>
        {session.kind === "HIIT" && record?.completed && (
          <button onClick={onFlagPoor} className="wb-t text-left" style={{ fontSize: 11.5, color: record?.poor ? C.oxide : C.dim2 }}>
            {record?.poor ? "Flagged as a poor session" : "Flag as a poor session"}
          </button>
        )}
      </div>
      {rules && (
        <div className="mt-2 flex flex-col gap-2">
          {Object.entries(RULES).map(([k, v]) => (
            <div key={k} style={{ fontSize: 12, lineHeight: 1.45, color: C.text2 }}>{v}</div>
          ))}
        </div>
      )}
    </div>
  );

  const rest = session.kind === "Rest";

  const body = (
    <div className="flex flex-col gap-3">
      {!rest && warm.length > 0 && (
        <Fold C={C} title="WARM-UP" count={`${warm.length}`} open={openWarm} onToggle={() => setOpenWarm(!openWarm)}>
          {warm.map((m) => <Movement key={m.name} C={C} m={m} wide={wide}
              open={shown === m.name} onToggle={() => toggleFigure(m)} seen={seen[m.figure] || 0} />)}
        </Fold>
      )}

      {rest ? (
        <div className="wb-t rounded-2xl p-5" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: C.text2 }}>{session.progression}</div>
        </div>
      ) : (
        <div className="wb-t rounded-2xl px-4 py-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
            <span style={eyebrow}>{swapped ? "MAIN BLOCK · HEAVY WEATHER" : "MAIN BLOCK"}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>{block.length}</span>
          </div>
          {block.map((m) => <Movement key={m.name} C={C} m={m} wide={wide}
              open={shown === m.name} onToggle={() => toggleFigure(m)} seen={seen[m.figure] || 0} />)}
        </div>
      )}

      {!rest && (session.finisher?.length > 0 || COOLDOWN.length > 0) && (
        <Fold C={C} title="FINISHER AND COOL-DOWN"
          count={`${(session.finisher?.length || 0) + COOLDOWN.length}`}
          open={openAfter} onToggle={() => setOpenAfter(!openAfter)}>
          {session.finisher?.length > 0 && (
            <>
              <div style={{ ...eyebrow, marginTop: 2 }}>FINISHER</div>
              {session.finisher.map((m) => <Movement key={m.name} C={C} m={m} wide={wide}
              open={shown === m.name} onToggle={() => toggleFigure(m)} seen={seen[m.figure] || 0} />)}
            </>
          )}
          <div style={{ ...eyebrow, marginTop: 8 }}>COOL-DOWN</div>
          {COOLDOWN.map((m) => <Movement key={m.name} C={C} m={m} wide={wide}
              open={shown === m.name} onToggle={() => toggleFigure(m)} seen={seen[m.figure] || 0} />)}
        </Fold>
      )}

      {!rest && (
        <div style={{ fontSize: 12, lineHeight: 1.5, padding: "0 4px", color: C.dim }}>
          {session.progression}
        </div>
      )}
    </div>
  );

  const referenceSheet = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3"
      style={{ background: dark ? "rgba(4,10,13,.72)" : "rgba(16,38,46,.42)" }}
      onClick={() => setReference(null)}>
      <div className="wb-t w-full max-w-md rounded-[22px] overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.line2}`, boxShadow: C.shadow }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div style={eyebrow}>FORM REFERENCE</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", color: C.text, marginTop: 4 }}>
            {exerciseLabel(reference)}
          </div>
        </div>
        <div className="px-4 py-4" style={{ background: C.panel }}>
          <ExerciseFigure move={reference} colors={{ fig: C.text, line: C.dim, accent: C.amber }} />
        </div>
        <div className="px-5 py-4">
          <div style={{ fontSize: 13, lineHeight: 1.5, color: C.text2 }}>{exerciseCue(reference)}</div>
        </div>
        <div className="px-4 pb-4 flex flex-wrap gap-1.5">
          {EXERCISE_KEYS.map((k) => (
            <button key={k} onClick={() => { setReference(k); onSeen(k); }}
              className="wb-t px-2.5 py-1.5 rounded-full" style={{
                fontSize: 11, fontWeight: 500,
                background: k === reference ? C.amber : "transparent",
                color: k === reference ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                border: `1px solid ${k === reference ? C.amber : C.line2}`,
              }}>{exerciseLabel(k)}</button>
          ))}
        </div>
        <button onClick={() => setReference(null)} className="wb-t w-full py-3"
          style={{ fontSize: 12.5, color: C.dim, borderTop: `1px solid ${C.line}` }}>Close</button>
      </div>
    </div>
  );

  return (
    <div className={wide ? "grid grid-cols-2 gap-4 items-start" : "flex flex-col gap-3"}>
      {reference && referenceSheet()}
      <div className="flex flex-col gap-3">
        {header}
        {!rest && (
          <Timer C={C} dark={dark} wide={wide} mode={queue.length ? mode : mode === "none" ? "none" : "stopwatch"}
            queue={queue} completed={!!record?.completed} onComplete={onComplete} />
        )}
        {rest && (
          <button onClick={() => onComplete(!record?.completed)} className="wb-t w-full rounded-xl py-3" style={{
            fontSize: 14, fontWeight: 600,
            color: record?.completed ? C.dim : C.text2,
            border: `1px solid ${C.line2}`,
          }}>
            {record?.completed ? "Rest logged" : "Log the rest day"}
          </button>
        )}
      </div>
      {body}
    </div>
  );
}
