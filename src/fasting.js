/* ------------------------------------------------------------------
   16:8, ramped in rather than started cold.

   The window's open time is the only thing that moves — close is always
   19:00. A stage is read off the calendar (days since fastingStart) unless
   pinned, and a pin only ever overrides the number, never advances it:
   nothing here counts a week up on its own once you have said where you
   stand.

   The window's state (fasting, open, or suspended) is computed fresh from
   the clock every time it is asked, the same way the rest of the app
   treats a day — nothing is cached, so back-dating a stage change or
   declaring ship's business after the fact still resolves correctly.
------------------------------------------------------------------ */

import { mins, pretty } from "./schedule.js";
import { eventOn, recoveryOn } from "./events.js";
import { elapsedDates, legForDate } from "./stats.js";
import { addDays, dateKey, daysBetween, parseKey } from "./voyage.js";
import { readLog } from "./storage.js";
import { readSession, sessionForDate } from "./training.js";

/** Ramp stages: weeks 1–2 at 12 h, weeks 3–4 at 14 h, week 5 on at 16 h.
    Close never moves — only the open time widens. */
const STAGES = [
  { stage: 1, days: 14, open: "0700" },
  { stage: 2, days: 28, open: "0900" },
  { stage: 3, days: Infinity, open: "1130" },
];
export const CLOSE = "1900";
export const HIIT_BREAK_OPEN = "0700";

/** The stage the calendar alone would put you at — no pin considered. */
export function naturalStage(fastingStart, today) {
  if (!fastingStart) return 1;
  const days = daysBetween(parseKey(fastingStart), today);
  return STAGES.find((s) => days < s.days)?.stage ?? 3;
}

/** The stage actually in force: a pin wins, and a pin can hold or step back
    a stage the calendar has already moved past, but it never advances one. */
export function currentStage(fasting, today) {
  return fasting.stagePin ?? naturalStage(fasting.startDate, today);
}

/** Today's window, in the schedule's own "HHMM" shape — the HIIT override
    only ever moves the open time earlier to a fixed 07:00, on a HIIT day,
    when the setting is on. It does not interact with the ramp otherwise. */
export function windowForDay(fasting, stage, isHiitDay) {
  const stageOpen = STAGES.find((s) => s.stage === stage)?.open ?? STAGES[0].open;
  const open = isHiitDay && fasting.breakFastOnHiit && mins(HIIT_BREAK_OPEN) < mins(stageOpen)
    ? HIIT_BREAK_OPEN
    : stageOpen;
  return { open, close: CLOSE };
}

/** Retime the two window items to today's actual window and re-sort — the
    same move events.js makes for a shifted or moved item, just for a window
    whose edges depend on the ramp rather than ship's business. */
export function applyFastingWindow(items, window, prolongedActive = false) {
  return items
    .map((i) => {
      if (i.id === "fuel-open") return { ...i, t: window.open };
      if (i.id === "fuel-close") return { ...i, t: window.close };
      return i;
    })
    .map((i) =>
      // A prolonged fast replaces the ordinary day's eating entirely — the
      // whole Fuel thread stands down rather than racking up misses for a
      // day that was never going to keep the regular window.
      prolongedActive && i.tag === "fuel" ? { ...i, stood: true, why: "prolonged fast" } : i,
    )
    .sort((a, b) => mins(a.t) - mins(b.t));
}

/** Ship's business suspends the whole day's window, not just whatever item
    happens to overlap it — a 03:00 bunkering is nowhere near 11:30 or 19:00,
    but it still means "eat when you can", not a missed window. */
export const isWindowSuspended = (events, dk) => !!eventOn(events, dk);

const fmtHM = (m) => `${Math.floor(m / 60)} h ${m % 60} m`;

/** The one line the header exists to show. */
export function windowState(now, window, suspended) {
  if (suspended) {
    return { phase: "suspended", label: "Ship's business", detail: "Eat when you can — today doesn't count against the window." };
  }
  const nowM = now.getHours() * 60 + now.getMinutes();
  const openM = mins(window.open);
  const closeM = mins(window.close);
  if (nowM >= openM && nowM < closeM) {
    const left = closeM - nowM;
    return { phase: "open", label: "Window open", detail: `closes in ${fmtHM(left)}`, closesAt: pretty(window.close) };
  }
  const elapsed = nowM >= closeM ? nowM - closeM : 1440 - closeM + nowM;
  return { phase: "fasting", label: "Fasting", detail: `${fmtHM(elapsed)} elapsed`, opensAt: pretty(window.open) };
}

/** Rolling seven days: the window counted as kept on a day if both ends were
    ticked. Ship's-business days are excluded from both sides, same as a
    stood-down leg is for trading — you cannot miss a window the ship did
    not let you keep. A day spent on a prolonged fast is excluded the same
    way — it is a deliberate departure from the ordinary cycle, not a day
    the window was broken. */
export function windowAdherence(phases, today, live, events, days = 7, prolongedDates = []) {
  const prolonged = new Set(prolongedDates);
  const dates = elapsedDates(phases, addDays(today, -(days - 1)), today)
    .filter((d) => !isWindowSuspended(events, dateKey(d)) && !prolonged.has(dateKey(d)));
  if (!dates.length) return null;
  const hit = dates.filter((d) => {
    const dk = dateKey(d);
    const log = (live && live[dk]) || readLog(dk);
    return !!(log["fuel-open"] && log["fuel-close"]);
  }).length;
  return { hit, total: dates.length };
}

/* -------- fasted training -------- */

/**
 * Whether to nudge toward the HIIT break-fast override: three weeks of the
 * feature running, at least one HIIT session flagged poor in that window,
 * the override not already on, and the nudge not already shown. Shown once,
 * ever — declining or accepting both retire it for good.
 */
export function hiitPromptEligible(fasting, today) {
  if (fasting.breakFastOnHiit || fasting.hiitPromptShown || !fasting.startDate) return false;
  if (daysBetween(parseKey(fasting.startDate), today) < 21) return false;
  for (let i = 0; i < 21; i++) {
    const d = addDays(today, -i);
    if (sessionForDate(d).kind === "HIIT" && readSession(dateKey(d))?.poor) return true;
  }
  return false;
}

/* -------- the prolonged fast -------- */

export const PROLONGED_CAP_HOURS = 24;

/** Whether a 24-hour fast can be started for this date — every reason it
    might not be is a reason to leave the ship's actual business alone. */
export function canStartProlongedFast(dk, phases, events) {
  const date = parseKey(dk);
  if (date.getDay() !== 0) return { ok: false, reason: "Only available on a Sunday." };
  const leg = legForDate(phases, date);
  if (leg && leg.trade === false) return { ok: false, reason: "Not while the leg is stood down." };
  if (eventOn(events, dk) || eventOn(events, dateKey(addDays(date, -1)))) {
    return { ok: false, reason: "Not with ship's business today or yesterday." };
  }
  if (recoveryOn(events, dk)) return { ok: false, reason: "Not on a recovery day." };
  return { ok: true };
}

/** Hours elapsed since a prolonged fast started, hard-capped — there is no
    "extend" path past this number anywhere in the feature. */
export function prolongedElapsedHours(startedAt, now) {
  const hours = (now.getTime() - new Date(startedAt).getTime()) / 36e5;
  return Math.min(PROLONGED_CAP_HOURS, Math.max(0, hours));
}
