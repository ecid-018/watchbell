/* ------------------------------------------------------------------
   Recovering reflections from wherever a copy of them survives: the
   last seven days of auto-backup, or the one-time schema snapshot.

   Never destructive. A candidate only ever fills a day the live journal
   is currently missing or blank — an already-written reflection is never
   touched, replaced, or asked to defer to an older copy, however old or
   new that copy is.
------------------------------------------------------------------ */

import { K, listAutoBackups, readAutoBackup, readSnapshot } from "./storage.js";
import { SCHEMA } from "./store.js";

const isBlank = (v) => !v || !String(v).trim();

/** Days `current` is missing or blank that `source` has real text for. */
export function reflectGaps(current, source) {
  const gaps = [];
  for (const [day, text] of Object.entries(source || {})) {
    if (!isBlank(text) && isBlank(current[day])) gaps.push(day);
  }
  return gaps;
}

/** Every place a copy of the journal might still exist, each annotated
    with how many of the live journal's gaps it could fill. Only sources
    that would actually recover something are returned. */
export function recoveryCandidates(currentReflect) {
  const out = [];
  for (const date of listAutoBackups()) {
    const backup = readAutoBackup(date);
    const reflect = backup?.data?.[K.reflect];
    if (!reflect) continue;
    const gaps = reflectGaps(currentReflect, reflect);
    if (gaps.length) {
      out.push({ id: `autobackup:${date}`, label: `auto-backup, ${date}`, reflect, read: backup?.data?.[K.read] || {}, gaps });
    }
  }
  const snap = readSnapshot(SCHEMA);
  const snapReflect = snap?.data?.[K.reflect];
  if (snapReflect) {
    const gaps = reflectGaps(currentReflect, snapReflect);
    if (gaps.length) {
      out.push({ id: "snapshot", label: `schema snapshot (v${SCHEMA})`, reflect: snapReflect, read: snap?.data?.[K.read] || {}, gaps });
    }
  }
  return out;
}

/** Fill gaps only — anything already in `current` stands. */
export function mergeReflect(current, source) {
  const merged = { ...current };
  for (const [day, text] of Object.entries(source || {})) {
    if (!isBlank(text) && isBlank(merged[day])) merged[day] = text;
  }
  return merged;
}

export function mergeRead(current, source) {
  const merged = { ...current };
  for (const [day, val] of Object.entries(source || {})) {
    if (val && !merged[day]) merged[day] = val;
  }
  return merged;
}

/** How many distinct days, across every candidate, are actually
    recoverable — for the headline figure. */
export const totalGapDays = (candidates) => new Set(candidates.flatMap((c) => c.gaps)).size;
