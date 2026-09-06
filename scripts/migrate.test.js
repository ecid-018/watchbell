// Migration test harness
// Run with: node scripts/migrate.test.js

import { migrateStores, SCHEMA, DEFAULT_RANKS, exportAll, importAll } from "../src/store.js";
import { K, readJSON, writeJSON, replayWAL, crc32, readSnapshot, writeAutoBackup } from "../src/storage.js";
import { migrate, appendPhase } from "../src/phase.js";
import { dateKey, addDays, parseKey } from "../src/voyage.js";
import { importBacklog } from "../src/backlog.js";
import { BACKLOG } from "../src/data/jobs-backlog.js";
import { mergeReflect, recoveryCandidates } from "../src/recovery.js";

// Mock localStorage for Node testing
const mockStorage = new Map();
global.window = {
  localStorage: {
    getItem: (k) => mockStorage.get(k) ?? null,
    setItem: (k, v) => { mockStorage.set(k, v); },
    removeItem: (k) => { mockStorage.delete(k); },
    key: (i) => Array.from(mockStorage.keys())[i] ?? null,
    get length() { return mockStorage.size; },
    clear: () => { mockStorage.clear(); },
  },
  BroadcastChannel: class {
    constructor() {}
    postMessage() {}
    close() {}
  },
  navigator: {
    storage: { estimate: async () => ({ usage: 1000, quota: 5000000 }) }},
  crypto: { randomUUID: () => "test-uuid" },
};

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log("  \u2713 " + name);
    passed++;
  } else {
    console.log("  \u2717 " + name);
    failed++;
  }
}

function resetStorage() {
  mockStorage.clear();
}

async function runTests() {
  console.log("\n=== Migration Tests ===\n");

  resetStorage();
  const schema1 = migrateStores();
  assert("Fresh install creates schema 3", schema1 === 3);
  assert("Fresh install creates all stores", 
    readJSON(K.jobs, null) !== null &&
    readJSON(K.plans, null) !== null &&
    readJSON(K.events, null) !== null &&
    readJSON(K.weeks, null) !== null &&
    readJSON(K.ranks, null) !== null &&
    readJSON(K.marks, null) !== null);
  assert("Fresh install uses DEFAULT_RANKS", 
    JSON.stringify(readJSON(K.ranks)) === JSON.stringify(DEFAULT_RANKS));

  resetStorage();
  const day1 = dateKey(new Date());
  writeJSON(K.phases, [{ kind: "voyage", start: day1, from: "A", to: "B", days: 10, utc0: -5, utc1: 0 }]);
  writeJSON(K.start, day1);
  writeJSON(K.schema, 1);
  const schema2 = migrateStores();
  assert("v1 -> v3 migration works", schema2 === 3);
  assert("v1 phases preserved", readJSON(K.phases).length === 1);
  assert("v1 creates new stores", readJSON(K.jobs) !== null);

  resetStorage();
  writeJSON(K.phases, [{ kind: "voyage", start: day1, from: "A", to: "B", days: 10, utc0: -5, utc1: 0 }]);
  writeJSON(K.jobs, []);
  writeJSON(K.plans, []);
  writeJSON(K.events, []);
  writeJSON(K.weeks, {});
  writeJSON(K.ranks, DEFAULT_RANKS);
  writeJSON(K.schema, 2);
  const schema3 = migrateStores();
  assert("v2 -> v3 migration works", schema3 === 3);
  assert("v2 creates marks store", readJSON(K.marks) !== null);

  resetStorage();
  writeJSON(K.phases, [{ kind: "voyage", start: day1 }]);
  writeJSON(K.schema, 1);
  const walEntry = { key: K.jobs, value: [], ts: Date.now(), crc: crc32(JSON.stringify([])) };
  writeJSON(K.wal, [walEntry]);
  mockStorage.delete(K.jobs);
  replayWAL();
  assert("WAL replay recovers missing key", readJSON(K.jobs, null) !== null);

  resetStorage();
  // Two historical writes to the same key, oldest first — a real write log
  // always looks like this once a key has been written more than once.
  // Setup goes straight through mockStorage rather than writeJSON, so the
  // module's in-memory cache is never touched here, mirroring a fresh page
  // load where that cache starts empty. The key's on-disk value is already
  // the newer one — an ordinary, uncorrupted write, nothing to recover.
  const staleValue = { id: "job-stale" };
  const staleCrc = crc32(JSON.stringify(staleValue));
  const freshValue = { id: "job-fresh" };
  const freshCrc = crc32(JSON.stringify(freshValue));
  const regressionKey = "test:regression-key";
  const wal2 = [
    { key: regressionKey, value: staleValue, ts: 1000, crc: staleCrc },
    { key: regressionKey, value: freshValue, ts: 2000, crc: freshCrc },
  ];
  mockStorage.set(K.wal, JSON.stringify({ v: wal2, crc: crc32(JSON.stringify(wal2)), ts: Date.now() }));
  mockStorage.set(regressionKey, JSON.stringify({ v: freshValue, crc: freshCrc, ts: 2000 }));
  replayWAL();
  const afterReplay = JSON.parse(mockStorage.get(regressionKey)).v;
  assert("WAL replay never regresses a key to an older logged value", afterReplay.id === "job-fresh");

  resetStorage();
  writeJSON(K.jobs, [{ id: "job1", title: "Test" }]);
  const corrupted = JSON.stringify({ v: [{ id: "job1", title: "Corrupted" }], crc: 999999, ts: Date.now() });
  mockStorage.set(K.jobs, corrupted);
  const recovered = readJSON(K.jobs, []);
  assert("Corrupted data falls back to memory", recovered.length === 1 && recovered[0].title === "Test");

  resetStorage();
  writeJSON(K.start, day1);
  const migrated = migrate(null, day1);
  assert("Pre-phases migration creates voyage phase", migrated.length === 1 && migrated[0].kind === "voyage");
  assert("Pre-phases migration preserves start date", migrated[0].start === day1);

  resetStorage();
  const phases1 = [{ kind: "voyage", start: day1, from: "A", to: "B", days: 10, utc0: -5, utc1: 0, readOffset: 1 }];
  const day3 = dateKey(addDays(parseKey(day1), 10));
  const phases2 = appendPhase(phases1, { kind: "voyage", start: day3, from: "B", to: "C", days: 5, utc0: 0, utc1: 5 });
  assert("Append phase calculates readOffset", phases2[1].readOffset === 11);

  resetStorage();
  writeJSON(K.phases, [{ kind: "voyage", start: day1, from: "A", to: "B", days: 10, utc0: -5, utc1: 0 }]);
  writeJSON(K.jobs, [{ id: "job1", title: "Test job" }]);
  writeJSON(K.plans, [{ id: "plan1", title: "Test plan" }]);
  writeJSON(K.events, [{ id: "evt1", type: "Arrival", date: day1 }]);
  writeJSON(K.weeks, { [day1]: { review: "Good week" } });
  writeJSON(K.ranks, ["Self", "2/E"]);
  writeJSON(K.marks, { "PSA.23.1": "gold" });
  writeJSON(K.mode, "dark");
  writeJSON(K.read, { [day1]: true });
  writeJSON(K.reflect, { [day1]: "Reflection" });
  writeJSON(K.figures, { "dead-bug": 3 });
  const logKey = K.log(day1);
  writeJSON(logKey, { wake: true, word: true });
  const trainKey = K.train(day1);
  writeJSON(trainKey, { completed: true });
  
  const exported = exportAll();
  assert("Export includes app metadata", exported.app === "watchbell" && exported.schema === SCHEMA);
  assert("Export includes phases", exported.data[K.phases] !== undefined);
  assert("Export includes jobs", exported.data[K.jobs] !== undefined);
  assert("Export includes plans", exported.data[K.plans] !== undefined);
  assert("Export includes events", exported.data[K.events] !== undefined);
  assert("Export includes weeks", exported.data[K.weeks] !== undefined);
  assert("Export includes ranks", exported.data[K.ranks] !== undefined);
  assert("Export includes marks", exported.data[K.marks] !== undefined);
  assert("Export includes mode", exported.data[K.mode] !== undefined);
  assert("Export includes daily logs", exported.data[logKey] !== undefined);
  assert("Export includes training logs", exported.data[trainKey] !== undefined);
  assert("Exported daily log is unwrapped, not the checksum envelope",
    exported.data[logKey].wake === true && exported.data[logKey].crc === undefined);

  resetStorage();
  writeJSON(K.jobs, [{ id: "job1" }]);
  writeJSON(K.schema, 2);
  migrateStores();
  assert("Migration writes a snapshot at the new schema", readSnapshot(SCHEMA) !== null);
  assert("Snapshot holds the migrated data", readSnapshot(SCHEMA).data[K.jobs][0].id === "job1");

  resetStorage();
  const corruptWal = JSON.stringify({ v: "not an array", crc: 999999, ts: Date.now() });
  mockStorage.set(K.wal, corruptWal);
  let walReadThrew = false;
  try { writeJSON(K.jobs, [{ id: "job1" }]); } catch (_) { walReadThrew = true; }
  assert("A corrupt WAL does not recurse or throw on write", !walReadThrew);
  assert("A corrupt WAL still lets the target key read back", readJSON(K.jobs, null)[0].id === "job1");

  resetStorage();
  writeJSON(K.phases, [{ kind: "voyage", start: day1, from: "A", to: "B", days: 10, utc0: -5, utc1: 0 }]);
  writeJSON(K.jobs, [{ id: "job1", title: "Round-trip job" }]);
  const backup = exportAll();
  resetStorage();
  importAll(backup);
  assert("Import restores jobs", readJSON(K.jobs)[0].title === "Round-trip job");
  assert("Import restores phases", readJSON(K.phases)[0].from === "A");
  assert("Import brings storage to the current schema", readJSON(K.schema) === SCHEMA);
  let rejectedBadBackup = false;
  try { importAll({ not: "a backup" }); } catch (_) { rejectedBadBackup = true; }
  assert("Import rejects a file that isn't a Watchbell backup", rejectedBadBackup);

  resetStorage();
  const today = dateKey(new Date());
  const oldDate = dateKey(addDays(new Date(), -10));
  writeJSON(K.autobackup(today), { test: "today" });
  writeJSON(K.autobackup(oldDate), { test: "old" });
  const { listAutoBackups } = await import("../src/storage.js");
  const backups = listAutoBackups();
  assert("Auto-backup lists today", backups.includes(today));

  console.log("\n=== Reflection recovery ===\n");

  resetStorage();
  // An earlier test in this file (schema snapshot) leaves the in-process
  // memory cache holding a snapshot keyed with its own K.reflect value —
  // resetStorage() only clears the fake localStorage, not that cache, so
  // it has to be overwritten explicitly for this test's own snapshot
  // check to start from a clean slate.
  writeJSON(K.snapshot(SCHEMA), null);
  const richReflect = { "10": "A full week of reflection.", "11": "Another day's thought." };
  writeAutoBackup({ app: "watchbell", schema: SCHEMA, data: { [K.reflect]: richReflect, [K.read]: { "10": true, "11": true } } });
  const currentReflect = { "10": "A full week of reflection.", "11": "" }; // day 11 since gone missing
  const candidates = recoveryCandidates(currentReflect);
  assert("A backup with a fuller journal is offered as a recovery candidate", candidates.length === 1);
  assert("The candidate correctly identifies only the missing day", candidates[0].gaps.length === 1 && candidates[0].gaps[0] === "11");
  const recoveredReflect = mergeReflect(currentReflect, candidates[0].reflect);
  assert("Recovery fills the day the journal is missing", recoveredReflect["11"] === "Another day's thought.");
  assert("Recovery never touches a day already present", recoveredReflect["10"] === "A full week of reflection.");

  resetStorage();
  writeJSON(K.snapshot(SCHEMA), null);
  writeAutoBackup({ app: "watchbell", schema: SCHEMA, data: { [K.reflect]: richReflect } });
  assert("A journal with nothing missing offers no candidates", recoveryCandidates(richReflect).length === 0);

  console.log("\n=== Backlog import ===\n");

  resetStorage();
  writeJSON(K.jobs, []);
  const nonWeekly = BACKLOG.filter((i) => i.recurring !== "weekly");
  importBacklog(day1);
  const afterFirst = readJSON(K.jobs, []);
  assert("First import adds every non-weekly backlog item", afterFirst.length === nonWeekly.length);
  assert("A promoted item keeps the notebook's own id", nonWeekly.length > 0 && afterFirst.some((j) => j.id === nonWeekly[0].id));
  assert("A promoted item starts pooled", afterFirst.every((j) => j.status === "pooled"));

  importBacklog(day1);
  const afterSecond = readJSON(K.jobs, []);
  assert("A second import does not duplicate the backlog", afterSecond.length === afterFirst.length);

  resetStorage();
  writeJSON(K.jobs, [{ id: nonWeekly[0].id, title: "Already pulled to today", status: "open" }]);
  importBacklog(day1);
  const afterPartial = readJSON(K.jobs, []);
  assert("Import never overwrites a job already promoted off the pool",
    afterPartial.find((j) => j.id === nonWeekly[0].id).status === "open");
  assert("Import still backfills whatever else is missing", afterPartial.length === nonWeekly.length);

  console.log("\n=== Results: " + passed + " passed, " + failed + " failed ===");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error(e); process.exit(1); });
