/* ------------------------------------------------------------------
   localStorage, defensively.

   iOS Safari can throw on localStorage access — quota pressure, private
   browsing, a storage-cleared home-screen app. None of that should white-screen
   the app mid-ocean, so every access falls back to an in-memory map and the
   session simply stops persisting.
------------------------------------------------------------------ */

export const K = {
  log: (dateKey) => `watchbell:log:${dateKey}`,
  train: (dateKey) => `watchbell:train:${dateKey}`,
  read: "watchbell:read",
  reflect: "watchbell:reflect",
  figures: "watchbell:figures",
  schema: "watchbell:schema",
  jobs: "watchbell:jobs",
  plans: "watchbell:plans",
  events: "watchbell:events",
  weeks: "watchbell:weeks",
  ranks: "watchbell:ranks",
  marks: "watchbell:marks",
  mode: "watchbell:mode",
  phases: "watchbell:phases",
  // Pre-phases format. Still read on first launch after an update so an
  // existing passage survives, and still written so a rollback finds it.
  start: "watchbell:voyageStart",
};

const memory = new Map();
let warned = false;

const fallback = (why) => {
  if (!warned) {
    warned = true;
    console.warn("Watchbell: localStorage unavailable, running session-only.", why);
  }
};

export function readJSON(key, fallbackValue) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return memory.has(key) ? memory.get(key) : fallbackValue;
    return JSON.parse(raw);
  } catch (e) {
    fallback(e);
    return memory.has(key) ? memory.get(key) : fallbackValue;
  }
}

export function writeJSON(key, value) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    fallback(e);
  }
}

/** Today's tick record, or {} if the day has no record yet. */
export const readLog = (dateKey) => readJSON(K.log(dateKey), {}) || {};
