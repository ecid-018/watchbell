import React, { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   Matching a set of imported photos to backlog jobs in one sitting:
   photos on one side, jobs on the other, tap a photo then tap a job to
   pair them. Skipping a photo is one tap — some won't correspond to
   anything.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { compressImage } from "./imagepipe.js";
import { readExifDate } from "./exif.js";
import { getUnassignedPhotos, photoCountsByJob, putPhoto, newPhotoId, updatePhoto } from "./photodb.js";
import { useObjectUrl } from "./usePhotos.js";

function Thumb({ blob }) {
  const url = useObjectUrl(blob);
  return url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null;
}

export default function BatchAttachView({ C, dark, wide, jobs }) {
  const [photos, setPhotos] = useState([]);
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const refresh = () => {
    getUnassignedPhotos().then(setPhotos);
    photoCountsByJob().then(setCounts);
  };
  useEffect(refresh, []);

  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setImporting(true);
    for (const file of files) {
      const exifDate = await file.arrayBuffer().then(readExifDate).catch(() => null);
      const full = await compressImage(file);
      const thumb = await compressImage(full.blob, { maxEdge: 240, quality: 0.5 });
      await putPhoto({
        id: newPhotoId(), jobId: "", blob: full.blob, thumbBlob: thumb.blob,
        tag: "after", capturedAt: (exifDate || new Date()).toISOString(),
        exifDate: exifDate ? exifDate.toISOString() : null, source: "library",
        width: full.width, height: full.height, bytes: full.blob.size,
      });
    }
    setImporting(false);
    refresh();
  };

  const pair = async (jobId) => {
    if (!selected) return;
    const job = jobs.find((j) => j.id === jobId);
    await updatePhoto(selected, { jobId, tag: job && job.status === "pooled" ? "before" : "after" });
    setSelected(null);
    refresh();
  };

  const skip = async (photoId) => {
    await updatePhoto(photoId, { jobId: "skipped" });
    if (selected === photoId) setSelected(null);
    refresh();
  };

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const pending = photos.filter((p) => p.jobId === "");
  const skipped = photos.filter((p) => p.jobId === "skipped");
  const activeJobs = jobs.filter((j) => j.status !== "dropped");
  const unpaired = activeJobs.filter((j) => !counts[j.id]);

  return (
    <div>
      <label className="wb-t w-full flex items-center justify-center rounded-xl py-3 mb-3"
        style={{ fontSize: 14, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
        {importing ? "Importing…" : "Add photos from the library"}
        <input type="file" accept="image/*" multiple hidden onChange={onFiles} disabled={importing} />
      </label>

      <div style={{ fontSize: 11.5, lineHeight: 1.5, padding: "0 2px 10px", color: C.dim2 }}>
        {unpaired.length > 0
          ? `${unpaired.length} job${unpaired.length === 1 ? "" : "s"} still have no photo.`
          : "Every job has at least one photo."}
      </div>

      <div style={{ ...eyebrow, marginBottom: 6 }}>PHOTOS TO PLACE · {pending.length}</div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {pending.map((p) => (
          <div key={p.id} className="relative">
            <button onClick={() => setSelected(selected === p.id ? null : p.id)}
              className="wb-t w-full rounded-lg overflow-hidden" style={{
                aspectRatio: "1", border: `2px solid ${selected === p.id ? C.amber : C.line2}`,
              }}>
              <Thumb blob={p.thumbBlob || p.blob} />
            </button>
            <button onClick={() => skip(p.id)} className="wb-t absolute rounded-full flex items-center justify-center"
              style={{ top: -6, right: -6, width: 20, height: 20, fontSize: 11, background: C.card, border: `1px solid ${C.line2}`, color: C.dim }}
              aria-label="Skip photo">×</button>
            {p.exifDate && (
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.dim2, textAlign: "center", marginTop: 2 }}>
                {new Date(p.exifDate).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
        {pending.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.dim, gridColumn: "1 / -1" }}>Nothing waiting to be placed.</div>
        )}
      </div>

      <div style={{ ...eyebrow, marginBottom: 6 }}>{selected ? "TAP A JOB TO PAIR" : "SELECT A PHOTO ABOVE, THEN A JOB"}</div>
      {activeJobs.map((j) => (
        <button key={j.id} onClick={() => pair(j.id)} disabled={!selected}
          className="wb-t w-full flex items-center gap-3 py-2 px-2 rounded-xl text-left"
          style={{ opacity: selected ? 1 : 0.6 }}>
          <span className="flex-1" style={{ fontSize: 13.5, color: C.text }}>{j.title}</span>
          <span style={{ fontFamily: F.mono, fontSize: 10.5, color: counts[j.id] ? C.foam : C.oxide }}>
            {counts[j.id] ? `${counts[j.id]} photo${counts[j.id] === 1 ? "" : "s"}` : "no photo"}
          </span>
        </button>
      ))}

      {skipped.length > 0 && (
        <>
          <button onClick={() => setShowSkipped(!showSkipped)} className="wb-t w-full text-left px-2 py-2 mt-2"
            style={{ ...eyebrow, color: C.dim }}>
            {showSkipped ? "HIDE" : "SHOW"} SKIPPED · {skipped.length}
          </button>
          {showSkipped && skipped.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-1.5 px-2">
              <div className="rounded-lg overflow-hidden shrink-0" style={{ width: 36, height: 36 }}>
                <Thumb blob={p.thumbBlob || p.blob} />
              </div>
              <span className="flex-1" style={{ fontSize: 12, color: C.dim }}>
                {p.exifDate ? new Date(p.exifDate).toLocaleDateString() : "date unknown"}
              </span>
              <button onClick={async () => { await updatePhoto(p.id, { jobId: "" }); refresh(); }}
                className="wb-t" style={{ fontSize: 11, color: C.dim2 }}>restore</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
