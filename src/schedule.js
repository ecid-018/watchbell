/* ------------------------------------------------------------------
   The passage itself: legs, the base day, the reading plan.
   Lifted verbatim out of the original watchbell.jsx, plus itemsForLeg()
   which is the body of the component's existing `items` useMemo pulled
   out into a pure function so the stats can ask what was doable on any
   past day without rendering anything.
------------------------------------------------------------------ */

export const LEGS = [
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

export const dayPlan = (day) => ({
  psalm: `Psalm ${((day - 1) % 150) + 1}`,
  nt: NT[(day - 1) % NT.length],
});

/**
 * The template, and when each line of it was true.
 *
 * `since` and `until` exist so that changing the day does not rewrite the past.
 * A day is scored against the template as it stood *on that day*, so adding the
 * evening block did not suddenly make every logged day of the passage look like
 * a worse one. Same reason `cabin` is retired rather than deleted: the days you
 * ticked it still get the credit.
 */
export const BASE = [
  { id: "wake", t: "0530", label: "Wake, hydrate, make the bunk", tag: "reset" },
  { id: "word", t: "0535", label: "Prayer and Bible reading", tag: "word" },
  { id: "train", t: "0550", label: "Exercise", tag: "body" },
  { id: "prep", t: "0640", label: "Shower, breakfast, three priorities", tag: "reset" },
  { id: "round-am", t: "0730", label: "Morning round", tag: "duty" },
  { id: "work", t: "0800", label: "Daywork", tag: "duty" },
  { id: "admin", t: "1500", label: "Admin block", tag: "duty", until: "2026-08-27" },
  { id: "admin-am", t: "0800", label: "Morning admin", tag: "duty", since: "2026-08-27" },
  { id: "admin-pm", t: "1600", label: "Afternoon admin", tag: "duty", since: "2026-08-27" },
  // fuel-open's t is a placeholder — the fasting window's open time depends on
  // the ramp stage and the HIIT-day override, so fasting.js retimes this item
  // (and re-sorts) after itemsForLeg has read the template.
  { id: "fuel-open", t: "1130", label: "Open the window — lunch", tag: "fuel", since: "2026-08-29" },
  { id: "fuel-water", t: "1200", label: "Water target", tag: "fuel", since: "2026-08-29" },
  { id: "trade", t: "", label: "Trading session", tag: "desk" },
  { id: "fuel-close", t: "1900", label: "Close the window — dinner done", tag: "fuel", since: "2026-08-29" },
  { id: "fuel-protein", t: "1905", label: "Protein at both meals", tag: "fuel", since: "2026-08-29" },
  { id: "fuel-veg", t: "1910", label: "Vegetables at both meals", tag: "fuel", since: "2026-08-29" },
  { id: "round-pm", t: "2000", label: "Night round", tag: "duty" },
  { id: "evening", t: "2030", label: "Evening block", tag: "reset", since: "2026-08-25" },
  { id: "shower-pm", t: "2100", label: "Shower", tag: "reset", since: "2026-08-25" },
  { id: "cabin", t: "2115", label: "Cabin reset", tag: "reset", until: "2026-08-25" },
  { id: "vespers", t: "2130", label: "Evening prayer, phone down", tag: "word", until: "2026-08-25" },
  { id: "vespers", t: "2130", label: "Cabin reset and evening prayer", tag: "word", since: "2026-08-25" },
  { id: "fuel-no-late", t: "2200", label: "No late merienda", tag: "fuel", since: "2026-08-29" },
  { id: "sleep", t: "2215", label: "Lights out", tag: "reset" },
];

/**
 * The evening block rotates by weekday, so the slot always has something in it
 * rather than being open time. Index 0 is Sunday, to match Date#getDay.
 */
export const EVENING = [
  "Call home / rest",
  "Engine room reading / study",
  "Laundry",
  "Trading journal review",
  "Cabin clean (heads and deck)",
  "Laundry",
  "Cabin deep clean — bedding, lockers, ports",
];

export const eveningFor = (date) => EVENING[date.getDay()];

/** The template as it stood on a date. */
export const baseOn = (dateKey) =>
  BASE.filter((b) => (!b.since || b.since <= dateKey) && (!b.until || b.until > dateKey));

export const TAGS = {
  duty: { k: "text2", n: "Duty" },
  word: { k: "gold", n: "Word" },
  body: { k: "foam", n: "Body" },
  desk: { k: "amber", n: "Desk" },
  reset: { k: "dim", n: "Reset" },
  fuel: { k: "fuel", n: "Fuel" },
};

/**
 * The cash open, as a UTC instant rather than a wall-clock time.
 *
 * Every entry in the original leg table resolves to exactly this — 08:30 at
 * UTC−5, 19:00 at UTC+5:30, and every step between. The table was never data:
 * it was the New York open expressed in whatever time the ship was keeping.
 * Holding it as one instant is what lets a passage between any two ports
 * retime itself without a hand-written table.
 */
export const CASH_OPEN_UTC = 13 * 60 + 30;

/** The cash open in ship's time, for a UTC offset in hours (5.5 for +5:30). */
export const openForUTC = (hours) => {
  const m = (((CASH_OPEN_UTC + Math.round(hours * 60)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** "−5", "+5:30", "0" — how an offset is written in the header and on a chip. */
export const utcLabel = (hours) => {
  if (!hours) return "0";
  const a = Math.abs(hours);
  const hh = Math.floor(a);
  const mm = Math.round((a - hh) * 60);
  return `${hours < 0 ? "−" : "+"}${hh}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`;
};

/** The reverse of utcLabel — needed because the legacy route's hand-written
    LEGS table only ever carried the formatted string, never a plain number. */
export const parseUtcLabel = (label) => {
  const m = /^([+−-]?)(\d+)(?::(\d{2}))?$/.exec(String(label ?? "").trim());
  if (!m) return 0;
  const sign = m[1] === "−" || m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0));
};

/** Half-hour granularity covers every zone a ship keeps, India's +5:30 included. */
export const UTC_CHOICES = Array.from({ length: 53 }, (_, i) => -12 + i * 0.5);

export const mins = (h) => parseInt(h.slice(0, 2), 10) * 60 + parseInt(h.slice(2), 10);

export const addMin = (h, m) => {
  const v = (mins(h) + m + 1440) % 1440;
  return String(Math.floor(v / 60)).padStart(2, "0") + String(v % 60).padStart(2, "0");
};

export const pretty = (h) => `${h.slice(0, 2)}:${h.slice(2)}`;

/** The day's items retimed to a leg's cash open. Pure — same expression the UI used. */
export const itemsForLeg = (leg, dateKey = "9999-12-31") => {
  const o = leg.open.replace(":", "");
  return baseOn(dateKey).map((b) => {
    if (b.id === "trade") return { ...b, t: addMin(o, -30), endT: addMin(o, 105), stood: !leg.trade };
    if (b.id === "round-pm" && leg.lateRound) return { ...b, t: "2200" };
    return b;
  }).sort((a, b) => mins(a.t) - mins(b.t));
};

/** Items that actually count against completion — stood-down ones do not. */
export const doableForLeg = (leg, dateKey) => itemsForLeg(leg, dateKey).filter((i) => !i.stood);

/** Minutes since local midnight, for comparing the wall clock against a schedule. */
export const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

/**
 * The item that owns this moment — the last one to have started.
 *
 * Before the first start of the day (anywhere from midnight to 05:30) the
 * answer is the *last* item of the schedule: the night still belongs to
 * lights out. Stood-down items are skipped, so on a Cape day the afternoon
 * belongs to the admin block rather than to a session that is not happening.
 */
export const currentItem = (items, m) => {
  const live = items.filter((i) => !i.stood);
  if (!live.length) return null;
  let cur = live[live.length - 1];
  for (const i of live) if (mins(i.t) <= m) cur = i;
  return cur;
};

/** The item due after this one, wrapping past midnight to tomorrow's first. */
export const nextItem = (items, item) => {
  const live = items.filter((i) => !i.stood);
  if (!live.length || !item) return null;
  return live.find((i) => mins(i.t) > mins(item.t)) ?? live[0];
};

/**
 * When the current item's window closes: its own hard stop if it has one
 * (the trading session does), otherwise the moment the next item starts.
 */
export const windowEnd = (items, item) => {
  if (!item) return null;
  if (item.endT) return item.endT;
  const n = nextItem(items, item);
  return n ? n.t : null;
};
