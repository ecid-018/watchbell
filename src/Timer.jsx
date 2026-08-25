import React, { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------
   The session clock.

   Bouts come from the plan; this only counts them down. Two behaviours:
   an interval run for sessions the plan times, and a plain stopwatch for
   strength days, where the sets are yours to pace and only the total is
   worth knowing.

   Everything is timestamp-driven rather than decremented, so a screen
   that sleeps, a backgrounded app or a dropped frame cannot make the
   clock lie. Sound is synthesised, not fetched — there is nothing to
   load and nothing to fail at sea.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { mmss } from "./training.js";
import { ExerciseFigure } from "./components/ExerciseFigure.jsx";

const COUNT_IN = 3; // seconds of warning before every work bout

export default function Timer({ C, dark, wide, mode, queue, onComplete, completed }) {
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | countin | running | paused | done
  const [endsAt, setEndsAt] = useState(0);
  const [left, setLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0); // stopwatch
  const held = useRef(0); // ms left when paused
  const lastTick = useRef(0);
  const audioRef = useRef(null);
  const lockRef = useRef(null);

  const bout = queue[idx] || null;

  /* -------- sound: synthesised, so there is nothing to fetch -------- */

  const ctx = () => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioRef.current = new Ctx();
      }
      if (audioRef.current.state === "suspended") audioRef.current.resume();
      return audioRef.current;
    } catch (e) {
      return null;
    }
  };

  const tone = (freq, dur, when = 0, gain = 0.22, type = "sine") => {
    const c = ctx();
    if (!c) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  };

  // Work rises and rest falls, so the two are told apart without looking.
  const sndWork = () => { tone(784, 0.13); tone(1175, 0.24, 0.13); };
  const sndRest = () => tone(392, 0.32, 0, 0.18);
  const sndTick = () => tone(600, 0.05, 0, 0.13, "triangle");
  const sndDone = () => { tone(659, 0.16); tone(784, 0.16, 0.17); tone(1047, 0.4, 0.34); };

  /* -------- wake lock: the screen must not sleep mid-bout -------- */

  const grabLock = async () => {
    try {
      if ("wakeLock" in navigator) lockRef.current = await navigator.wakeLock.request("screen");
    } catch (e) { /* unsupported or refused — the session still runs */ }
  };
  const dropLock = () => {
    try { lockRef.current?.release(); } catch (e) { /* already gone */ }
    lockRef.current = null;
  };

  const live = status === "countin" || status === "running";

  // iOS drops both the wake lock and the audio clock when the app goes away.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && live) { grabLock(); ctx(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [live]);

  useEffect(() => () => dropLock(), []);

  /* -------- the run -------- */

  const enter = (i) => {
    const next = queue[i];
    if (!next) {
      setStatus("done");
      dropLock();
      sndDone();
      return;
    }
    setIdx(i);
    lastTick.current = 0;
    if (next.kind === "work") {
      setStatus("countin");
      setEndsAt(Date.now() + COUNT_IN * 1000);
      setLeft(COUNT_IN * 1000);
    } else {
      sndRest();
      setStatus("running");
      setEndsAt(Date.now() + next.secs * 1000);
      setLeft(next.secs * 1000);
    }
  };

  const start = () => {
    ctx();       // both of these need the gesture that got us here
    grabLock();
    if (mode === "stopwatch") {
      setEndsAt(Date.now() - elapsed);
      setStatus("running");
      return;
    }
    enter(0);
  };

  const pause = () => {
    held.current = mode === "stopwatch" ? Date.now() - endsAt : Math.max(0, endsAt - Date.now());
    setStatus("paused");
    dropLock();
  };

  const resume = () => {
    ctx();
    grabLock();
    setEndsAt(mode === "stopwatch" ? Date.now() - held.current : Date.now() + held.current);
    setStatus("running");
  };

  const skip = () => {
    if (mode === "stopwatch") return;
    lastTick.current = 0;
    enter(idx + 1);
  };

  const stop = () => {
    setStatus("idle");
    setIdx(0);
    setLeft(0);
    setElapsed(0);
    dropLock();
  };

  // One loop for both modes. Absolute timestamps, so nothing drifts.
  useEffect(() => {
    if (status !== "running" && status !== "countin") return undefined;
    let t;
    const step = () => {
      const now = Date.now();
      if (mode === "stopwatch") {
        setElapsed(now - endsAt);
      } else {
        const ms = endsAt - now;
        setLeft(ms);
        if (status === "countin") {
          const s = Math.ceil(ms / 1000);
          if (s !== lastTick.current && s >= 1 && s <= COUNT_IN) {
            lastTick.current = s;
            sndTick();
          }
        }
        if (ms <= 0) {
          if (status === "countin") {
            sndWork();
            setStatus("running");
            setEndsAt(now + queue[idx].secs * 1000);
            setLeft(queue[idx].secs * 1000);
          } else {
            enter(idx + 1);
          }
          return;
        }
      }
      t = setTimeout(step, 100);
    };
    step();
    return () => clearTimeout(t);
  }, [status, endsAt, idx, mode]);

  if (mode === "none") return null;

  /* -------- the face -------- */

  const accent = status === "countin" ? C.amber : bout?.kind === "rest" ? C.text2 : C.foam;
  const total = queue.reduce((n, b) => n + b.secs, 0);
  const doneSecs = queue.slice(0, idx).reduce((n, b) => n + b.secs, 0);
  const boutMs = status === "countin" ? COUNT_IN * 1000 : (bout?.secs || 1) * 1000;
  const frac = live ? Math.min(1, Math.max(0, 1 - left / boutMs)) : 0;

  const button = (label, onClick, primary) => (
    <button onClick={onClick} className="wb-t flex-1 rounded-xl py-3" style={{
      fontSize: 14, fontWeight: 600,
      background: primary ? C.amber : "transparent",
      color: primary ? (dark ? "#0E1C22" : "#FFFFFF") : C.text2,
      border: `1px solid ${primary ? C.amber : C.line2}`,
    }}>{label}</button>
  );

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };

  return (
    <div className="wb-t rounded-2xl overflow-hidden" style={{ background: C.sub, border: `1px solid ${live ? `${accent}66` : C.line2}` }}>
      {status === "idle" || status === "done" ? (
        <div className="p-4">
          {status === "done" ? (
            <>
              <div style={{ ...eyebrow, color: C.foam }}>SESSION RUN THROUGH</div>
              <div style={{ fontSize: 15, lineHeight: 1.4, marginTop: 4, color: C.text }}>
                {mmss(total)} of work behind you. Log it and the 05:50 item goes with it.
              </div>
              <div className="flex gap-2 mt-3">
                {button(completed ? "Logged" : "Log the session", () => onComplete(true), !completed)}
                {button("Run it again", stop)}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span style={eyebrow}>{mode === "stopwatch" ? "STOPWATCH" : "SESSION TIMER"}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>
                  {mode === "stopwatch" ? "sets at your own pace" : `${queue.length} bouts · ${mmss(total)}`}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                {button(mode === "stopwatch" ? "Start the clock" : "Start the session", start, true)}
                {completed
                  ? button("Logged — undo", () => onComplete(false))
                  : button("Log without timing", () => onComplete(true))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="px-4 pt-3 flex items-baseline justify-between">
            <span style={{ ...eyebrow, color: accent }}>
              {status === "countin" ? "COUNT IN" : bout?.kind === "rest" ? "REST" : "WORK"}
            </span>
            {mode !== "stopwatch" && bout && (
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.text2, fontVariantNumeric: "tabular-nums" }}>
                {bout.round} / {bout.of}
              </span>
            )}
          </div>

          {bout?.figure && (
            <div className="px-6 pt-1" style={{ maxWidth: 300, margin: "0 auto" }}>
              <ExerciseFigure move={bout.figure} colors={{ fig: C.text, line: C.dim, accent: C.amber }} />
            </div>
          )}

          <div className="px-4 pb-1 text-center">
            <div style={{
              fontFamily: F.mono, fontSize: wide ? 68 : 58, fontWeight: 600,
              letterSpacing: "-.04em", lineHeight: 1.05, color: accent,
              fontVariantNumeric: "tabular-nums",
            }}>
              {mode === "stopwatch"
                ? mmss(elapsed / 1000)
                : status === "countin"
                  ? String(Math.max(0, Math.ceil(left / 1000)))
                  : mmss(left / 1000)}
            </div>
            {bout && (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{bout.name}</div>
                {bout.detail && (
                  <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 2, color: C.dim }}>{bout.detail}</div>
                )}
              </>
            )}
            {mode === "stopwatch" && (
              <div style={{ fontSize: 12, color: C.dim }}>running · pause when you rack up</div>
            )}
          </div>

          {mode !== "stopwatch" && (
            <div className="mx-4 mt-3 rounded-full" style={{ height: 4, background: C.track }}>
              <div className="rounded-full wb-t" style={{ height: 4, width: `${frac * 100}%`, background: accent }} />
            </div>
          )}

          <div className="flex gap-2 p-4">
            {status === "paused" ? button("Resume", resume, true) : button("Pause", pause)}
            {mode !== "stopwatch" && button("Skip", skip)}
            {button(mode === "stopwatch" ? "Done" : "Stop", mode === "stopwatch" ? () => { pause(); onComplete(true); } : stop)}
          </div>

          {mode !== "stopwatch" && (
            <div className="px-4 pb-3 flex justify-between" style={{ fontFamily: F.mono, fontSize: 10, color: C.dim2 }}>
              <span>{queue[idx + 1] ? `NEXT ${queue[idx + 1].name}` : "LAST BOUT"}</span>
              <span>{mmss(doneSecs + (boutMs - Math.max(0, left)) / 1000)} / {mmss(total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
