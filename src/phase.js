/* ------------------------------------------------------------------
   What the ship is doing, and since when.

   A phase is one stretch of days sharing a schedule: a passage at sea, or
   a stay alongside. They are held as an ordered list, oldest first, each
   stamped with the day it began; the last one is current. A phase is never
   closed out — a date resolves by finding the last phase that had begun by
   then, so tying up alongside is one append and the day you did it needs no
   edit. That is also what keeps the rolling seven honest across the join:
   the sea days in the window still score against sea legs.

   The reading plan runs on its own continuous counter (readOffset) rather
   than the day-of-phase, so a new passage does not send you back to Psalm 1.
------------------------------------------------------------------ */

import { LEGS, openForUTC, utcLabel } from "./schedule.js";
import { daysBetween, parseKey, startOfDay } from "./voyage.js";

/**
 * The passage the app was built around, kept as data only for phases stored
 * before voyages became configurable. Nothing new is created against it — it
 * exists so a passage already under way keeps its named legs and its Agulhas
 * stand-down rather than being silently re-cut into clock legs mid-ocean.
 */
export const LEGACY_ROUTE = { name: "New Orleans → India", from: "New Orleans", to: "India", legs: LEGS };

/** The legacy plan written as configuration, for editing one into the new shape. */
export const LEGACY_PREFILL = {
  kind: "voyage",
  from: "New Orleans",
  to: "India",
  days: 40,
  utc0: -5,
  utc1: 5.5,
  stand0: 27,
  stand1: 29,
  standWhy: "Agulhas transit — heavy rolling, lashing checks",
};

/** Whole-hour clock changes from one offset to the other, endpoints exact. */
const offsetWalk = (a, b) => {
  const out = [a];
  const step = b > a ? 1 : -1;
  for (let v = Math[step > 0 ? "floor" : "ceil"](a) + step; step > 0 ? v < b : v > b; v += step) out.push(v);
  if (b !== a) out.push(b);
  return out;
};

/** Thin a walk down to n offsets, always keeping both ends. */
const thin = (all, n) => {
  if (n >= all.length) return all;
  if (n <= 1) return [all[0]];
  return Array.from({ length: n }, (_, i) => all[Math.round((i * (all.length - 1)) / (n - 1))]);
};

/**
 * The legs of a configured passage.
 *
 * Days are dealt out across the clock changes first, then a leg is cut wherever
 * the answer to "what time is it" or "is there a session" changes. That second
 * cut is what keeps a stand-down honest: name days 27 to 29 and you get a
 * three-day leg, not the two whole clock legs those days happen to touch —
 * which is exactly how the Agulhas leg was drawn by hand.
 *
 * A hop between two ports on the same offset is one leg, which is the right
 * answer rather than a degenerate case. A passage shorter than its own number
 * of clock changes gets one leg per day.
 */
export const generateLegs = (phase) => {
  const days = Math.max(1, Math.round(phase.days || 1));
  const offsets = thin(offsetWalk(phase.utc0 ?? 0, phase.utc1 ?? phase.utc0 ?? 0), days);
  const base = Math.floor(days / offsets.length);
  const extra = days % offsets.length;

  const lo = phase.stand0 && phase.stand1 ? Math.min(phase.stand0, phase.stand1) : 0;
  const hi = phase.stand0 && phase.stand1 ? Math.max(phase.stand0, phase.stand1) : 0;

  // One entry per day, then group runs that agree on both answers.
  const perDay = [];
  offsets.forEach((utc, i) => {
    const len = base + (i < extra ? 1 : 0);
    for (let k = 0; k < len; k++) {
      const day = perDay.length + 1;
      perDay.push({ utc, stood: lo > 0 && day >= lo && day <= hi });
    }
  });

  const legs = [];
  for (const [day0, d] of perDay.entries()) {
    const last = legs[legs.length - 1];
    if (last && last.utcHours === d.utc && !last.trade === d.stood) {
      last.d1 = day0 + 1;
      continue;
    }
    legs.push({
      id: legs.length,
      utcHours: d.utc,
      utc: utcLabel(d.utc),
      short: d.stood ? `⊘ ${utcLabel(d.utc)}` : utcLabel(d.utc),
      open: openForUTC(d.utc),
      d0: day0 + 1,
      d1: day0 + 1,
      trade: !d.stood,
      why: phase.standWhy || "stood down for this stretch",
    });
  }

  return legs.map((l, i) => ({
    ...l,
    id: i,
    name: l.trade
      ? i === 0 && legs.length > 1 ? `Departure, ${phase.from}`
        : i === legs.length - 1 && legs.length > 1 ? `Arrival, ${phase.to}`
        : `Ship's time ${l.utc}`
      : phase.standWhy || "Stood down",
    // The night round goes late on the last leg, as it did on arrival at India.
    lateRound: i === legs.length - 1 && legs.length > 1,
  }));
};

/** A port stay wears one synthetic leg so everything downstream stays uniform. */
export const portLeg = (phase) => ({
  id: 0,
  name: phase.port ? `Alongside ${phase.port}` : "Alongside",
  short: "Alongside",
  utc: "",
  open: phase.open || "09:30",
  d0: 1,
  d1: Infinity,
  trade: phase.trade !== false,
  port: true,
  why: "alongside — cargo operations and port watches",
});

/** A phase stored before voyages were configurable. */
export const isLegacy = (phase) => phase.kind !== "port" && !!phase.route;

export const legsOf = (phase) =>
  phase.kind === "port" ? [portLeg(phase)] : isLegacy(phase) ? LEGACY_ROUTE.legs : generateLegs(phase);

/** Days in the phase. A port stay is open-ended — it lasts until you sail. */
export const lengthOf = (phase) => {
  if (phase.kind === "port") return Infinity;
  if (isLegacy(phase)) return LEGACY_ROUTE.legs[LEGACY_ROUTE.legs.length - 1].d1;
  return Math.max(1, Math.round(phase.days || 1));
};

/** The offset the ship is keeping on arrival — where the next passage starts. */
export const arrivalUTCOf = (phase) =>
  phase.kind === "port" ? undefined : isLegacy(phase) ? LEGACY_PREFILL.utc1 : phase.utc1;

/** The two ends of the passage, for the rail and the departure field. */
export const endpointsOf = (phase) =>
  isLegacy(phase) ? { from: LEGACY_ROUTE.from, to: LEGACY_ROUTE.to } : { from: phase.from, to: phase.to };

export const nameOf = (phase) => {
  if (phase.kind === "port") return phase.port ? `Alongside ${phase.port}` : "In port";
  if (isLegacy(phase)) return LEGACY_ROUTE.name;
  return `${phase.from} → ${phase.to}`;
};

/** Day of the phase for a date. Unclamped, so day 41 of a 40-day passage says so. */
export const rawDayOf = (phase, date) => daysBetween(parseKey(phase.start), date) + 1;

/** Day of the phase, held at the last day once a passage has run its length. */
export const dayOf = (phase, date) =>
  Math.min(lengthOf(phase), Math.max(1, rawDayOf(phase, date)));

export const legOf = (phase, day) => {
  const legs = legsOf(phase);
  return legs.find((l) => day >= l.d0 && day <= l.d1) ?? legs[legs.length - 1];
};

/** The continuous reading-plan day, which does not reset when a phase does. */
export const readingDayOf = (phase, day) => (phase.readOffset ?? 1) + day - 1;

/** A passage whose last day is behind us. Port stays never complete on their own. */
export const isComplete = (phase, date) =>
  phase.kind !== "port" && rawDayOf(phase, date) > lengthOf(phase);

/* -------- the list -------- */

/** The phase covering a date: the last one to have begun by then, or null. */
export const phaseForDate = (phases, date) => {
  const d = startOfDay(date);
  let found = null;
  for (const p of phases) if (parseKey(p.start) <= d) found = p;
  return found;
};

export const currentPhase = (phases) => phases[phases.length - 1] ?? null;

/**
 * Where a new phase picks up the reading plan: the day after the last one
 * the outgoing phase covered. Derived from the calendar rather than from the
 * outgoing phase's own length, so cutting a passage short or overrunning it
 * still leaves the plan continuous.
 */
export const nextReadOffset = (prev, startKey) =>
  prev ? (prev.readOffset ?? 1) + Math.max(0, daysBetween(parseKey(prev.start), parseKey(startKey))) : 1;

/** Append a phase, or replace the last one when it would start on the same day. */
export const appendPhase = (phases, phase) => {
  const prev = currentPhase(phases);
  const stamped = { ...phase, readOffset: nextReadOffset(prev, phase.start) };
  if (prev && prev.start === phase.start) return [...phases.slice(0, -1), { ...stamped, readOffset: prev.readOffset }];
  return [...phases, stamped];
};

/** Edit the current phase in place — the "change departure date" path. */
export const replaceCurrent = (phases, phase) => {
  const prev = phases[phases.length - 2] ?? null;
  return [...phases.slice(0, -1), { ...phase, readOffset: nextReadOffset(prev, phase.start) }];
};

/** One phase list out of whatever is in storage, including the pre-phase format. */
export const migrate = (stored, legacyStart) => {
  if (Array.isArray(stored) && stored.length) return stored;
  if (legacyStart) return [{ kind: "voyage", route: "outbound", start: legacyStart, readOffset: 1 }];
  return [];
};
