/* ------------------------------------------------------------------
   Ship's business, and what it does to the day.

   Arrival, departure, bunkering and a Suez-type transit land at all hours.
   The day is not abandoned for them and it is not failed by them: the work
   that cannot happen is suspended and the work that must happen is moved
   clear.

   A suspended item is `stood`, which is the same mechanism the Cape leg
   already uses — greyed in the list, and excluded from the day's total by
   doableForLeg. That exclusion is the point. A day taken by ship's business
   scores out of a shorter day, so it cannot cost a percentage and cannot
   burn a grace day.
------------------------------------------------------------------ */

import { itemsForLeg, mins } from "./schedule.js";
import { addDays, dateKey, parseKey } from "./voyage.js";
import { sessionForDate } from "./training.js";

export const EVENT_TYPES = ["Arrival", "Departure", "Bunkering", "Drill", "Survey", "Other"];

/** What ship's business displaces. */
const SUSPEND = new Set(["trade", "train", "evening"]);

/**
 * What it does not get to displace — moved clear instead.
 *
 * `vespers` is here because the whole Word thread is non-negotiable, not just
 * the morning half of it. Leaving it out meant a seven-hour bunkering left
 * evening prayer due at 21:30 and quietly missable, which is the one shape of
 * failure this app is built to refuse.
 */
const PROTECT = new Set(["word", "vespers", "prep", "shower-pm", "sleep"]);

/** The most of the next morning a night's work is allowed to take. */
export const GRAVEYARD_CAP = 3;

/** The personal morning, which moves together so it keeps its spacing. */
const MORNING = ["wake", "word", "train", "prep"];

export const eventOn = (events, dk) => (events || []).find((e) => e.date === dk) || null;

/** [start, end] in minutes from midnight. End may run past 1440 — that is the point. */
export const windowOf = (ev) => {
  const [h, m] = String(ev.start || "00:00").split(":").map(Number);
  const start = h * 60 + (m || 0);
  return [start, start + Math.round((Number(ev.hours) || 0) * 60)];
};

export const runsPastMidnight = (ev) => windowOf(ev)[1] > 1440;

/** Hours of the following morning an overnight event ate, capped. */
export const lostTo = (ev) => {
  const end = windowOf(ev)[1];
  return end <= 1440 ? 0 : Math.min(GRAVEYARD_CAP, (end - 1440) / 60);
};

/**
 * A day owed sleep by the night before. Recovery is not a punishment and not
 * a streak break: the wake moves later and the two hardest things come off.
 */
export const recoveryOn = (events, dk) => {
  const prev = eventOn(events, dateKey(addDays(parseKey(dk), -1)));
  if (!prev || !runsPastMidnight(prev)) return null;
  const lost = lostTo(prev);
  return lost > 0 ? { lost, from: prev.type } : null;
};

const fmt = (m) => {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return String(Math.floor(v / 60)).padStart(2, "0") + String(v % 60).padStart(2, "0");
};

/**
 * The day's items with ship's business applied.
 *
 * Suspensions come first, then protected items are moved clear of the window.
 * Where the window runs past midnight there is no "after" left in the day, so
 * what is protected is stacked into the last hour — and the graveyard rule
 * takes care of the morning that follows.
 */
export function dayItems(leg, dk, events, opts = {}) {
  const ev = opts.event !== undefined ? opts.event : eventOn(events, dk);
  const rec = opts.recovery !== undefined ? opts.recovery : recoveryOn(events, dk);
  let items = itemsForLeg(leg, dk);
  if (!ev && !rec) return items;

  if (rec) {
    const hiit = sessionForDate(parseKey(dk)).kind === "HIIT";
    const shift = rec.lost * 60;
    items = items.map((i) => {
      if (i.id === "trade" || (hiit && i.id === "train")) {
        return { ...i, stood: true, why: `recovery after ${rec.from.toLowerCase()}`, recovery: true };
      }
      // Shifted as a block. Clamping each item to the first round instead
      // would stack the whole morning on one minute, which is not a lie-in.
      if (MORNING.includes(i.id)) return { ...i, t: fmt(mins(i.t) + shift), shifted: true };
      return i;
    });
  }

  if (ev) {
    const [start, end] = windowOf(ev);
    const inWindow = (t) => mins(t) >= start && mins(t) < end;
    const why = `${ev.type.toLowerCase()}${ev.note ? ` — ${ev.note}` : ""}`;

    items = items.map((i) =>
      SUSPEND.has(i.id) && i.t && inWindow(i.t) ? { ...i, stood: true, why, suspended: true } : i,
    );

    // Moved clear, in the order they were already in.
    const overnight = end >= 1440;
    let slot = overnight ? 22 * 60 + 20 : Math.min(end, 1425);
    const moved = items
      .filter((i) => PROTECT.has(i.id) && i.t && inWindow(i.t))
      .sort((a, b) => mins(a.t) - mins(b.t));
    const at = new Map();
    for (const i of moved) {
      at.set(i.id, fmt(Math.min(slot, 1439)));
      slot += 20;
    }
    items = items.map((i) => (at.has(i.id) ? { ...i, t: at.get(i.id), movedFor: ev.type } : i));
  }

  return items.sort((a, b) => mins(a.t) - mins(b.t));
}

/** What actually counts on a day: suspended work is not owed. */
export const dayDoable = (leg, dk, events, opts) =>
  dayItems(leg, dk, events, opts).filter((i) => !i.stood);

/** Plans falling due soon enough to be today's problem. */
export const DUE_WINDOW = 14;
export const dueSoon = (plans, today) => {
  const limit = dateKey(addDays(today, DUE_WINDOW));
  const now = dateKey(today);
  return (plans || [])
    .filter((p) => p.status !== "done" && p.target && p.target <= limit)
    .sort((a, b) => a.target.localeCompare(b.target))
    .map((p) => ({ ...p, overdue: p.target < now }));
};
