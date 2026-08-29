/* ------------------------------------------------------------------
   The stores added beyond the daily log, and the schema they are at.

   Everything is additive. A migration may create a store or backfill a
   field; nothing here deletes or rewrites what it finds, because the only
   copy of this data is on one iPad in the middle of an ocean. If a future
   change cannot be made additively, write a migration that reads the old
   shape and writes a new key alongside it.
------------------------------------------------------------------ */

import { K, readJSON, writeJSON, writeSnapshot } from "./storage.js";

export const SCHEMA = 3;

/** Ranks, not names — the list is edited on the Standing tab. */
export const DEFAULT_RANKS = ["Self", "2/E", "3/E", "4/E", "Oiler", "Fitter", "Wiper"];

const STORES = {
  jobs: [],
  plans: [],
  events: [],
  weeks: {},
  ranks: DEFAULT_RANKS,
  marks: {},
};

/**
 * Bring storage up to the current schema. Runs once at boot, before anything
 * reads. Each step is guarded so a half-applied migration — the app killed
 * mid-write — resumes rather than repeating.
 */
export function migrateStores() {
  const at = readJSON(K.schema, 1);
  const migrating = at < SCHEMA;

  // 1 → 2: the stores behind Jobs, Week, Plans and ship events. Creating them
  // empty is the whole migration; the daily log and phases are untouched.
  if (at < 2) {
    for (const [name, empty] of Object.entries(STORES)) {
      if (readJSON(K[name], null) === null) writeJSON(K[name], empty);
    }
  }

  // 2 → 3: highlighted verses. Same shape of migration: create it empty.
  if (at < 3 && readJSON(K.marks, null) === null) writeJSON(K.marks, {});

  if (migrating) {
    writeJSON(K.schema, SCHEMA);
    // A snapshot of the freshly migrated data, so a schema that turns out to
    // be wrong has something to roll back to besides the pre-migration state.
    writeSnapshot(SCHEMA, exportAll());
  }
  return SCHEMA;
}

export const loadStore = (name) => {
  const v = readJSON(K[name], null);
  return v === null ? STORES[name] : v;
};

export const saveStore = (name, value) => writeJSON(K[name], value);

/** Enough for one ship. Monotonic within a session, unique across them by time. */
let seq = 0;
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Everything the app holds, as one object — the backup you take before a
 * reinstall wipes the home screen icon and everything under it.
 */
export function exportAll() {
  const out = { app: "watchbell", schema: SCHEMA, exported: new Date().toISOString(), data: {} };
  for (const name of ["jobs", "plans", "events", "weeks", "ranks", "marks", "phases", "read", "reflect", "figures", "mode", "adminCompletions", "adminDeferrals", "fasting", "prolongedFast", "prolongedFastLog"]) {
    const v = readJSON(K[name], null);
    if (v !== null) out.data[K[name]] = v;
  }
  // The daily records are one key per day, so they are gathered by prefix.
  // Read through readJSON, not a raw parse — the value on disk is wrapped in
  // a checksum envelope, and exporting that envelope instead of the record
  // itself would double-wrap it on the next import.
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith("watchbell:log:") || key.startsWith("watchbell:train:"))) {
        const v = readJSON(key, null);
        if (v !== null) out.data[key] = v;
      }
    }
  } catch (e) { /* storage refused — the rest of the export still stands */ }
  return out;
}

/**
 * The reverse of exportAll: write every key from a backup straight back to
 * storage, then bring the result up to the current schema. Additive, like
 * every migration — an older export just backfills whatever it predates.
 */
export function importAll(backup) {
  if (!backup || typeof backup !== "object" || backup.app !== "watchbell" ||
    !backup.data || typeof backup.data !== "object") {
    throw new Error("not a Watchbell backup");
  }
  for (const [key, value] of Object.entries(backup.data)) writeJSON(key, value);
  migrateStores();
}
