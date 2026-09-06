/* ------------------------------------------------------------------
   A hand-rolled ZIP writer — STORE only, no compression.

   Photos are already JPEG-compressed, so DEFLATE would save almost
   nothing here, and pulling in a compression library just to save a few
   percent on files that are already small is not worth the dependency.
   STORE-only ZIP is simple enough to write by hand: a local header, the
   raw bytes, and a central directory at the end, checksummed with the
   same CRC32 table storage.js already builds for its own checksums.
------------------------------------------------------------------ */

import { crc32Bytes } from "./storage.js";
import { allPhotos } from "./photodb.js";

const enc = new TextEncoder();

const dosDateTime = (date) => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  day: (Math.max(0, date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
});

const u16 = (arr, v) => arr.push(v & 0xff, (v >> 8) & 0xff);
const u32 = (arr, v) => arr.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);

/** A safe filename fragment — printable ASCII only, no path separators. */
export const safeName = (s, fallback = "file") =>
  (String(s || "").normalize("NFKD").replace(/[^\w.\- ]/g, "_").trim() || fallback).slice(0, 80);

/** entries: [{ name, bytes: Uint8Array, date }] — returns a Blob,
    type "application/zip". */
export async function buildZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const bytes = entry.bytes;
    const crc = crc32Bytes(bytes);
    const { time, day } = dosDateTime(entry.date || new Date());

    const local = [];
    u32(local, 0x04034b50);
    u16(local, 20); u16(local, 0x0800); u16(local, 0);
    u16(local, time); u16(local, day);
    u32(local, crc); u32(local, bytes.length); u32(local, bytes.length);
    u16(local, nameBytes.length); u16(local, 0);
    localChunks.push(new Uint8Array(local), nameBytes, bytes);

    const cdh = [];
    u32(cdh, 0x02014b50);
    u16(cdh, 20); u16(cdh, 20); u16(cdh, 0x0800); u16(cdh, 0);
    u16(cdh, time); u16(cdh, day);
    u32(cdh, crc); u32(cdh, bytes.length); u32(cdh, bytes.length);
    u16(cdh, nameBytes.length); u16(cdh, 0); u16(cdh, 0); u16(cdh, 0); u16(cdh, 0);
    u32(cdh, 0); u32(cdh, offset);
    centralChunks.push(new Uint8Array(cdh), nameBytes);

    offset += local.length + nameBytes.length + bytes.length;
  }

  const centralStart = offset;
  const centralSize = centralChunks.reduce((n, c) => n + c.length, 0);

  const eocd = [];
  u32(eocd, 0x06054b50);
  u16(eocd, 0); u16(eocd, 0);
  u16(eocd, entries.length); u16(eocd, entries.length);
  u32(eocd, centralSize); u32(eocd, centralStart);
  u16(eocd, 0);

  return new Blob([...localChunks, ...centralChunks, new Uint8Array(eocd)], { type: "application/zip" });
}

/** Every stored photo, bundled as <job-id>-<title>/<n>-<tag>.jpg, or
    unfiled/<n>.jpg for anything never paired to a job (including photos
    explicitly skipped in batch attach). */
export async function buildPhotoZip(jobs) {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const photos = await allPhotos();
  const perFolder = new Map();

  const entries = [];
  for (const p of photos) {
    const job = p.jobId && byId.get(p.jobId);
    const folder = job ? `${safeName(job.id, "job")}-${safeName(job.title, "job")}` : "unfiled";
    const n = (perFolder.get(folder) || 0) + 1;
    perFolder.set(folder, n);
    const bytes = new Uint8Array(await p.blob.arrayBuffer());
    const suffix = job ? `-${p.tag || "after"}` : "";
    entries.push({ name: `${folder}/${n}${suffix}.jpg`, bytes, date: new Date(p.capturedAt || Date.now()) });
  }

  return buildZip(entries);
}
