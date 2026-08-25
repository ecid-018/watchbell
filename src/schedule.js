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

export const BASE = [
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

export const TAGS = {
  duty: { k: "text2", n: "Duty" },
  word: { k: "gold", n: "Word" },
  body: { k: "foam", n: "Body" },
  desk: { k: "amber", n: "Desk" },
  reset: { k: "dim", n: "Reset" },
};

export const mins = (h) => parseInt(h.slice(0, 2), 10) * 60 + parseInt(h.slice(2), 10);

export const addMin = (h, m) => {
  const v = (mins(h) + m + 1440) % 1440;
  return String(Math.floor(v / 60)).padStart(2, "0") + String(v % 60).padStart(2, "0");
};

export const pretty = (h) => `${h.slice(0, 2)}:${h.slice(2)}`;

/** The day's items retimed to a leg's cash open. Pure — same expression the UI used. */
export const itemsForLeg = (leg) => {
  const o = leg.open.replace(":", "");
  return BASE.map((b) => {
    if (b.id === "trade") return { ...b, t: addMin(o, -30), endT: addMin(o, 105), stood: !leg.trade };
    if (b.id === "round-pm" && leg.lateRound) return { ...b, t: "2200" };
    return b;
  }).sort((a, b) => mins(a.t) - mins(b.t));
};

/** Items that actually count against completion — stood-down ones do not. */
export const doableForLeg = (leg) => itemsForLeg(leg).filter((i) => !i.stood);
