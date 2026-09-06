/* ------------------------------------------------------------------
   Photo evidence, in IndexedDB.

   Not localStorage — a handful of compressed JPEGs already fills a
   meaningful fraction of that quota, and a full-resolution capture before
   compression would blow it in days. IndexedDB holds blobs natively and
   has room to spare.

   `jobId` is a string, never null: IndexedDB cannot index a null key, so
   an unfiled photo (imported from the library, not yet paired to a job)
   uses "" rather than null, and a skipped one uses "skipped" — both
   ordinary, indexable strings.

   Every call is wrapped the way bible.js wraps the Cache API: private
   browsing, a browser with IndexedDB disabled, or a device under storage
   pressure should degrade to "no photos" rather than white-screen the app.
------------------------------------------------------------------ */

import { daysBetween, parseKey } from "./voyage.js";

const DB_NAME = "watchbell-photos";
const DB_VERSION = 1;
const STORE = "photos";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("by_job", "jobId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => { dbPromise = null; throw e; });
  return dbPromise;
}

const reqToPromise = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** Runs `fn(store)` inside one transaction; `fn` may itself be async, as
    long as every await inside it chains directly off another IDB request
    — the transaction stays alive across those, the way it would across
    plain synchronous IDB calls. */
async function withStore(mode, fn) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      Promise.resolve(fn(store)).then((r) => { result = r; }).catch(reject);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Watchbell: photo storage unavailable.", e);
    return null;
  }
}

let seq = 0;
export const newPhotoId = () => `photo_${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Write (or overwrite) a photo record. */
export async function putPhoto(photo) {
  return (await withStore("readwrite", (store) => { store.put(photo); return true; })) === true;
}

async function getAllByIndex(indexValue) {
  const rows = await withStore("readonly", (store) => reqToPromise(store.index("by_job").getAll(indexValue)));
  return rows || [];
}

export const getPhotosForJob = (jobId) => getAllByIndex(jobId);
export const getUnassignedPhotos = () => getAllByIndex("");

export async function allPhotos() {
  return (await withStore("readonly", (store) => reqToPromise(store.getAll()))) || [];
}

export async function deletePhoto(id) {
  return (await withStore("readwrite", (store) => { store.delete(id); return true; })) === true;
}

export async function deletePhotosForJob(jobId) {
  const photos = await getPhotosForJob(jobId);
  await withStore("readwrite", (store) => { for (const p of photos) store.delete(p.id); return true; });
  return photos.length;
}

export async function updatePhoto(id, patch) {
  return withStore("readwrite", async (store) => {
    const existing = await reqToPromise(store.get(id));
    if (!existing) return false;
    store.put({ ...existing, ...patch });
    return true;
  });
}

/** {jobId: count}, one pass over the whole store — used to badge the
    backlog jobs that still have no photo, without a query per job. */
export async function photoCountsByJob() {
  const rows = await allPhotos();
  const counts = {};
  for (const p of rows) {
    if (!p.jobId || p.jobId === "skipped") continue;
    counts[p.jobId] = (counts[p.jobId] || 0) + 1;
  }
  return counts;
}

/** Sums the stored byte counts — no blob reads, so this is cheap enough
    to show in Settings on every render. */
export async function estimatePhotoBytes() {
  const rows = await allPhotos();
  return rows.reduce((sum, p) => sum + (p.bytes || 0), 0);
}

/** Deletes every photo attached to a job closed (done or dropped) more
    than `days` ago. Returns how many photos were removed. */
export async function purgeOldPhotos(jobs, todayKey, days = 90) {
  const cutoff = (closedOn) => closedOn && daysBetween(parseKey(closedOn), parseKey(todayKey)) > days;
  const oldJobIds = new Set(jobs.filter((j) => cutoff(j.doneOn) || cutoff(j.droppedOn)).map((j) => j.id));
  if (!oldJobIds.size) return 0;
  const rows = await allPhotos();
  const toDelete = rows.filter((p) => oldJobIds.has(p.jobId));
  if (!toDelete.length) return 0;
  await withStore("readwrite", (store) => { for (const p of toDelete) store.delete(p.id); return true; });
  return toDelete.length;
}
