/* ------------------------------------------------------------------
   What the ship is keeping, and the night it changed.

   The passage plan deals clock changes out evenly between departure and
   arrival, which is a guess and was only ever used to place the cash
   open. The master's orders are the real thing, so the clock is
   something you declare: a zone, and the date it came into force. A
   declaration dated tomorrow with a higher offset says the clock goes
   forward tonight, and that is the whole input.

   Nothing here is inferred from the plan. A leg boundary is not evidence
   of anything — an even walk between two ports says the clock moved on
   some arithmetic day, not the day the ship actually moved it — so an
   undeclared change earns no adjustment and the header goes on showing
   the zone in force, which is how you notice.

   Declarations are scoped to a phase, like the manual offset they
   replace: a correction from a finished passage is never read for a new
   one.
------------------------------------------------------------------ */

import { dayOf, legOf, rawDayOf } from "./phase.js";
import { openForUTC, parseUtcLabel, utcLabel } from "./schedule.js";
import { addDays, dateKey, parseKey } from "./voyage.js";

/** A phase with nothing declared yet. */
export const emptyZoneLog = (phase) => ({ phaseStart: phase ? phase.start : null, changes: [] });

const changesFor = (log, phase) =>
  (log && phase && log.phaseStart === phase.start && Array.isArray(log.changes) ? log.changes : []);

/** Every declaration standing for this phase, oldest first. */
export const zoneChanges = (log, phase) => [...changesFor(log, phase)];

/** What the passage plan assumes for a date. Null alongside — a port stay
    keeps no offset of its own, which is why the header reads ALONGSIDE. */
export const planZoneFor = (phase, dk) => {
  if (!phase) return null;
  const leg = legOf(phase, dayOf(phase, parseKey(dk)));
  return leg && leg.utc ? (leg.utcHours ?? parseUtcLabel(leg.utc)) : null;
};

/** The last offset declared on or before a date, or null if none is. */
export const declaredZoneFor = (log, phase, dk) => {
  let found = null;
  for (const c of changesFor(log, phase)) if (c.from <= dk) found = c.offset;
  return found;
};

/** What the ship is keeping on a date: what was declared, else what the
    plan assumed. */
export const zoneFor = (log, phase, dk) => {
  const declared = declaredZoneFor(log, phase, dk);
  return declared != null ? declared : planZoneFor(phase, dk);
};

/** Record a change, replacing anything already standing from that date. */
export const declareZone = (log, phase, offset, fromKey) => ({
  phaseStart: phase.start,
  changes: [...changesFor(log, phase).filter((c) => c.from !== fromKey), { from: fromKey, offset }]
    .sort((a, b) => a.from.localeCompare(b.from)),
});

/** Go back to what the passage plan assumes. */
export const clearZone = (phase) => emptyZoneLog(phase);

/**
 * A night an hour short, because the clock was declared forward into this
 * date. Shaped like recoveryOn()'s answer so the day treats it the same way.
 *
 * Capped at an hour however far the zone jumped: two hours in one night is a
 * passage plan compressing two nights into one step, not a night you actually
 * lost two hours of sleep to. Declaring the clock back does nothing — the day
 * is twenty-five hours long and nothing is owed.
 *
 * @param {object|null} log @param {object} phase @param {string} dk
 */
export const clockAdvanceOn = (log, phase, dk) => {
  const change = changesFor(log, phase).find((c) => c.from === dk);
  if (!change) return null;
  // Day one has no night before it aboard; a declaration there is the
  // departure offset being corrected, not the clock going forward.
  if (rawDayOf(phase, parseKey(dk)) <= 1) return null;
  const before = zoneFor(log, phase, dateKey(addDays(parseKey(dk), -1)));
  if (before == null) return null;
  const delta = change.offset - before;
  return delta > 0 ? { lost: Math.min(1, delta), from: "the clock", clock: true } : null;
};

/** A leg wearing the zone actually in force on a date. Alongside, and with
    nothing declared, it is the leg unchanged. */
export const applyZone = (leg, log, phase, dk) => {
  const zone = zoneFor(log, phase, dk);
  if (zone == null || !leg || !leg.utc) return leg;
  return { ...leg, utcHours: zone, utc: utcLabel(zone), open: openForUTC(zone) };
};
