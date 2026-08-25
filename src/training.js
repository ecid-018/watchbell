/* ------------------------------------------------------------------
   Reading the training plan.

   Every fact here comes out of data/training-plan.js. Nothing in this
   file invents a movement, a rest, or a round: it parses what the plan
   already says and hands it to the UI and the timer. If a session needs
   to change, the plan changes — not this.
------------------------------------------------------------------ */

import { COOLDOWN, PLAN, RULES, WARMUP } from "./data/training-plan.js";
import { K, readJSON, writeJSON } from "./storage.js";
import { addDays, dateKey } from "./voyage.js";

export { COOLDOWN, PLAN, RULES, WARMUP };

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The session for a date. The plan is a seven-day rotation on the weekday. */
export const sessionForDate = (date) =>
  PLAN.find((s) => s.day === WEEKDAY[date.getDay()]) ?? PLAN[PLAN.length - 1];

/** The block actually being worked — heavy weather replaces it whole, or not at all. */
export const mainBlock = (session, heavy) =>
  heavy && session.heavyWeather ? session.heavyWeather : session.main;

export const warmupFor = (session) => (session.warmup ? WARMUP[session.warmup] ?? [] : []);

/** A session that swaps out when the sea gets up. */
export const hasHeavyBlock = (session) => Array.isArray(session.heavyWeather);

/* -------- reading the plan's time strings -------- */

/**
 * Seconds out of a plan time string: "60 s", "3 min", "3:30", and the trailing
 * prose the plan writes in ("2 min between blocks", "45 s each"). Returns null
 * where there is no leading duration to read, which is how a set-and-rep line
 * like "4 × 8–12" declines to be a bout.
 */
export const parseDuration = (value) => {
  if (!value) return null;
  const t = String(value).trim();
  const clock = /^(\d+):(\d{2})/.exec(t);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const m = /^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Math.round(/^m/i.test(m[2]) ? n * 60 : n);
};

/** A movement that names both halves on one line: "3:30 work + 3:30 easy". */
const COMPOUND = /^(\d+:\d{2}|\d+(?:\.\d+)?\s*(?:s|min)[a-z]*)\s*work\s*\+\s*(\d+:\d{2}|\d+(?:\.\d+)?\s*(?:s|min)[a-z]*)\s*(?:easy|rest|recovery)/i;

/** A movement that *is* the rest, rather than one the rest follows. */
export const isRestBout = (entry) => /\b(easy|rest|recovery)\b/i.test(entry.name || "");

/**
 * The rest a format line names, for circuits that do not list rest as a
 * movement of its own — "30 s work / 30 s rest" is Wednesday saying so.
 */
export const restFromFormat = (session) => {
  const m = /(\d+(?:\.\d+)?\s*(?:s|sec|min)[a-z]*)\s+rest/i.exec(session?.format || "");
  return m ? parseDuration(m[1]) : null;
};

/**
 * The bout queue for a timed session.
 *
 * Each movement contributes one bout per round, taken in plan order, so
 * Monday's hard/easy pair alternates and Wednesday's four movements cycle.
 * A movement naming both halves splits in two. Where the format names a rest
 * the block does not list, it follows every work bout — Wednesday's 30 on,
 * 30 off. Movements with no readable time sit the timer out.
 */
export const buildIntervals = (session, heavy) => {
  const block = mainBlock(session, heavy) || [];
  const gap = restFromFormat(session);
  const rounds = block.reduce((n, e) => Math.max(n, e.rounds || 1), 1);
  const out = [];

  for (let r = 1; r <= rounds; r++) {
    for (const e of block) {
      if (e.rounds && r > e.rounds) continue;
      const of = e.rounds || rounds;

      const compound = COMPOUND.exec(e.time || "");
      if (compound) {
        out.push({ name: e.name, detail: e.detail, figure: e.figure, kind: "work", secs: parseDuration(compound[1]), round: r, of });
        out.push({ name: `${e.name} — easy`, detail: "", kind: "rest", secs: parseDuration(compound[2]), round: r, of });
        continue;
      }

      const secs = parseDuration(e.time);
      if (!secs) continue;
      const resting = isRestBout(e);
      out.push({ name: e.name, detail: e.detail, figure: e.figure, kind: resting ? "rest" : "work", secs, round: r, of });
      if (!resting && gap) out.push({ name: "Rest", detail: "", kind: "rest", secs: gap, round: r, of });
    }
  }
  return out;
};

/**
 * How the button behaves: the plan's own `kind` decides. Strength days are sets
 * against a clock you keep yourself, so they get a stopwatch; a rest day gets
 * nothing at all rather than an invitation.
 */
export const timerMode = (session) => {
  if (!session || session.kind === "Rest" || !(session.main || []).length) return "none";
  return session.kind === "Strength" ? "stopwatch" : "intervals";
};

/* -------- the session log -------- */

/** One record per date: which session, whether it was finished, and the sea state. */
export const readSession = (dk) => readJSON(K.train(dk), null);
export const writeSession = (dk, record) => writeJSON(K.train(dk), record);

/** Sessions marked complete over the seven calendar days ending today. */
export const sessionsInWindow = (today, days = 7) => {
  let n = 0;
  for (let i = 0; i < days; i++) {
    if (readSession(dateKey(addDays(today, -i)))?.completed) n++;
  }
  return n;
};

/** The days in the window that had a session to do at all — rest days do not count. */
export const sessionsDueInWindow = (today, days = 7) => {
  let n = 0;
  for (let i = 0; i < days; i++) {
    if (sessionForDate(addDays(today, -i)).kind !== "Rest") n++;
  }
  return n;
};

export const mmss = (secs) => {
  const s = Math.max(0, Math.round(secs));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
