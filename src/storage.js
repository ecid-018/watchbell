/* ------------------------------------------------------------------
   localStorage, defensively.

   iOS Safari can throw on localStorage access — quota pressure, private
   browsing, a storage-cleared home-screen app. None of that should white-screen
   the app mid-ocean, so every access falls back to an in-memory map and the
   session simply stops persisting.

   Additions:
   - Write-ahead log (WAL) for crash-safe writes
   - CRC32 checksums for corruption detection
   - BroadcastChannel for multi-tab sync
   - Quota monitoring with 80% warning
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
  adminCompletions: "watchbell:admin:completions",
  adminDeferrals: "watchbell:admin:deferrals",
  fasting: "watchbell:fasting",
  prolongedFast: "watchbell:fasting:prolonged",
  prolongedFastLog: "watchbell:fasting:prolongedLog",
  // Pre-phases format. Still read on first launch after an update so an
  // existing passage survives, and still written so a rollback finds it.
  start: "watchbell:voyageStart",
  // Write-ahead log
  wal: "watchbell:wal",
  // Auto-backups (daily, keep 7)
  autobackup: (dateKey) => `watchbell:autobackup:${dateKey}`,
  // Schema snapshots for rollback
  snapshot: (schema) => `watchbell:snapshot:v${schema}`,
};

const memory = new Map();
let warned = false;
let quotaWarned = false;

/** BroadcastChannel for multi-tab coordination */
const channel = (() => {
  try {
    return new BroadcastChannel("watchbell-storage");
  } catch (e) {
    return null; // unsupported (private browsing, old browser)
  }
})();

/** Listen for external writes and update memory */
if (channel) {
  channel.onmessage = (e) => {
    if (e.data?.type === "write" && e.data.key) {
      memory.set(e.data.key, e.data.value);
    }
  };
}

/** Lightweight CRC32 for checksums (no deps, ~200 bytes). Table built once —
    every write and read verifies a checksum, so this runs constantly. */
const CRC_TABLE = (() => {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(str) {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const fallback = (why) => {
  if (!warned) {
    warned = true;
    console.warn("Watchbell: localStorage unavailable, running session-only.", why);
  }
};

const quotaWarn = (usage, quota) => {
  if (!quotaWarned && quota > 0 && usage / quota > 0.8) {
    quotaWarned = true;
    console.warn(`Watchbell: localStorage at ${Math.round(usage / quota * 100)}% capacity (${Math.round(usage / 1024)} KB / ${Math.round(quota / 1024)} KB)`);
  }
};

/** Checksum, persist, cache and broadcast a value — the part every write needs. */
function applyWrite(key, value) {
  memory.set(key, value);
  try {
    const payload = JSON.stringify({ v: value, crc: crc32(JSON.stringify(value)), ts: Date.now() });
    window.localStorage.setItem(key, payload);
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(({ usage, quota }) => quotaWarn(usage, quota));
    }
  } catch (e) {
    fallback(e);
  }
  if (channel) channel.postMessage({ type: "write", key, value });
}

/** Write to WAL first, then apply. The WAL itself, and bulk backups/snapshots
    that already duplicate the live data, bypass the log — logging them would
    let one day's full export multiply itself 50 times over in the log. */
export function writeJSON(key, value) {
  if (key !== K.wal) {
    try {
      const wal = readJSON(K.wal, []);
      wal.push({ key, value, ts: Date.now(), crc: crc32(JSON.stringify(value)) });
      if (wal.length > 50) wal.splice(0, wal.length - 50);
      window.localStorage.setItem(K.wal, JSON.stringify(wal));
    } catch (e) {
      fallback(e);
    }
  }
  applyWrite(key, value);
}

/** Read with checksum verification; fallback to memory/WAL on corruption */
export function readJSON(key, fallbackValue) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return memory.has(key) ? memory.get(key) : fallbackValue;

    const parsed = JSON.parse(raw);
    // New format: { v: value, crc, ts }
    if (parsed && typeof parsed === "object" && "v" in parsed) {
      const expectedCrc = crc32(JSON.stringify(parsed.v));
      if (parsed.crc !== undefined && parsed.crc !== expectedCrc) {
        // The WAL cannot recover itself — a corrupt log falls back plainly,
        // rather than reading itself again and looping forever.
        if (key === K.wal) {
          console.warn("Watchbell: the write-ahead log itself is corrupt, starting a fresh one.");
          return memory.has(key) ? memory.get(key) : fallbackValue;
        }
        console.warn(`Watchbell: checksum mismatch for ${key}, attempting WAL recovery...`);
        return recoverFromWAL(key, fallbackValue);
      }
      return parsed.v;
    }
    // Old format (no checksum) — accept but don't verify
    return parsed;
  } catch (e) {
    fallback(e);
    return memory.has(key) ? memory.get(key) : fallbackValue;
  }
}

/** Attempt to recover a key from the WAL */
function recoverFromWAL(key, fallbackValue) {
  try {
    const wal = readJSON(K.wal, []);
    // Find most recent entry for this key
    for (let i = wal.length - 1; i >= 0; i--) {
      if (wal[i].key === key) {
        const entry = wal[i];
        const expectedCrc = crc32(JSON.stringify(entry.value));
        if (entry.crc === expectedCrc) {
          console.log(`Watchbell: recovered ${key} from WAL (${new Date(entry.ts).toISOString()})`);
          memory.set(key, entry.value);
          // Rewrite to localStorage with correct checksum
          try {
            window.localStorage.setItem(key, JSON.stringify({ v: entry.value, crc: entry.crc, ts: entry.ts }));
          } catch (_) { /* ignore */ }
          return entry.value;
        }
      }
    }
  } catch (_) { /* ignore */ }
  return memory.has(key) ? memory.get(key) : fallbackValue;
}

/** Replay WAL on startup to catch any half-written entries */
export function replayWAL() {
  try {
    const wal = readJSON(K.wal, []);
    for (const entry of wal) {
      if (!memory.has(entry.key)) {
        const expectedCrc = crc32(JSON.stringify(entry.value));
        if (entry.crc === expectedCrc) {
          memory.set(entry.key, entry.value);
          try {
            window.localStorage.setItem(entry.key, JSON.stringify({ v: entry.value, crc: entry.crc, ts: entry.ts }));
          } catch (_) { /* ignore */ }
        }
      }
    }
  } catch (_) { /* ignore */ }
}

/** Get storage quota info for UI */
export async function getQuotaInfo() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return { usage: usage || 0, quota: quota || 0, pct: quota ? Math.round((usage || 0) / quota * 100) : 0 };
}

/** Today's tick record, or {} if the day has no record yet. */
export const readLog = (dateKey) => readJSON(K.log(dateKey), {}) || {};

const AUTOBACKUP_PREFIX = "watchbell:autobackup:";

/** Write today's auto-backup. Safe to call on every launch — it overwrites
    the same day's entry rather than piling up. Bypasses the WAL — a backup
    is already a duplicate of the live data, so logging it too would just let
    one day's full export multiply itself across the log's 50 entries. */
export function writeAutoBackup(data) {
  const today = new Date().toISOString().slice(0, 10);
  applyWrite(K.autobackup(today), data);
  // Prune backups older than 7 days. Iterated back-to-front with the standard
  // length/key(i) API, since removeItem() shifts indices as it goes and not
  // every localStorage shim exposes keys via Object.keys().
  try {
    const cutoff = Date.now() - 7 * 864e5;
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(AUTOBACKUP_PREFIX)) {
        const ts = new Date(key.slice(AUTOBACKUP_PREFIX.length)).getTime();
        if (ts < cutoff) window.localStorage.removeItem(key);
      }
    }
  } catch (_) { /* ignore */ }
}

/** List available auto-backups, most recent first */
export function listAutoBackups() {
  try {
    const out = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(AUTOBACKUP_PREFIX)) out.push(key.slice(AUTOBACKUP_PREFIX.length));
    }
    return out.sort().reverse();
  } catch (_) { return []; }
}

/** Read an auto-backup by date */
export function readAutoBackup(dateKey) {
  return readJSON(K.autobackup(dateKey), null);
}

/** Write a schema snapshot for rollback. Bypasses the WAL for the same reason
    an auto-backup does — it is a full copy of the data, not an increment. */
export function writeSnapshot(schema, data) {
  applyWrite(K.snapshot(schema), data);
}

/** Read a schema snapshot */
export function readSnapshot(schema) {
  return readJSON(K.snapshot(schema), null);
}
