import React, { useState } from "react";

/* ------------------------------------------------------------------
   A job's photo strip: thumbnails, a camera button, a library button.
   Tap a thumbnail for the full-screen viewer. Capture, view, pair,
   delete — no annotation, no gallery.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { usePhotosForJob } from "./usePhotos.js";
import { renderPhoto } from "./imagepipe.js";
import { readExifDate } from "./exif.js";
import { putPhoto, newPhotoId, deletePhoto, updatePhoto } from "./photodb.js";
import PhotoImage from "./PhotoImage.jsx";
import PhotoViewer from "./PhotoViewer.jsx";

export default function PhotoRow({ C, dark, job, defaultTag }) {
  const { photos, refresh, patch } = usePhotosForJob(job.id);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const ingest = async (files, source) => {
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const exifDate = source === "library" ? await file.arrayBuffer().then(readExifDate).catch(() => null) : null;
        await putPhoto({
          id: newPhotoId(), jobId: job.id, ...(await renderPhoto(file)),
          tag: defaultTag, capturedAt: (exifDate || new Date()).toISOString(),
          exifDate: exifDate ? exifDate.toISOString() : null, source,
        });
      }
    } catch (e) {
      // Say it, rather than leaving the + spinning on a photo that never
      // made it into storage.
      console.warn("Watchbell: could not store a photo.", e);
      setError("That photo could not be read. Try again, or pick another.");
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onCamera = (e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) ingest(f, "camera"); };
  const onLibrary = (e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) ingest(f, "library"); };

  return (
    <div className="mt-2">
      <div className="flex gap-2 overflow-x-auto wb-x" style={{ scrollbarWidth: "none" }}>
        {photos.map((p) => (
          <button key={p.id} onClick={() => setViewing(p.id)} className="wb-t shrink-0 rounded-lg overflow-hidden relative"
            style={{ width: 56, height: 56, border: `1px solid ${C.line2}` }}>
            <PhotoImage sources={[p.thumb, p.image]} C={C} compact
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span className="absolute" style={{
              left: 2, bottom: 2, fontFamily: F.mono, fontSize: 8, fontWeight: 700, letterSpacing: ".04em",
              color: "#fff", background: "rgba(0,0,0,.55)", padding: "1px 4px", borderRadius: 4, textTransform: "uppercase",
            }}>{p.tag}</span>
          </button>
        ))}
        <label className="wb-t shrink-0 rounded-lg flex items-center justify-center"
          style={{ width: 56, height: 56, border: `1px dashed ${C.line2}`, color: C.dim, fontSize: 20, opacity: busy ? 0.5 : 1 }}>
          {busy ? "…" : "+"}
          <input type="file" accept="image/*" capture="environment" hidden onChange={onCamera} disabled={busy} />
        </label>
        <label className="wb-t shrink-0 rounded-lg flex items-center justify-center text-center"
          style={{ width: 56, height: 56, border: `1px dashed ${C.line2}`, color: C.dim2, fontSize: 10.5, opacity: busy ? 0.5 : 1 }}>
          library
          <input type="file" accept="image/*" multiple hidden onChange={onLibrary} disabled={busy} />
        </label>
      </div>
      {error && (
        <div style={{ fontSize: 11.5, lineHeight: 1.4, color: C.oxide, padding: "6px 2px 0" }}>{error}</div>
      )}
      {viewing && (
        <PhotoViewer
          C={C} dark={dark} photos={photos} activeId={viewing}
          onClose={() => setViewing(null)}
          onTag={async (id, tag) => {
            // In place: the tag is the only thing changing, and re-reading
            // the record would swap the blob the viewer is showing.
            patch(id, { tag });
            if (!(await updatePhoto(id, { tag }))) refresh();
          }}
          onDelete={async (id) => { await deletePhoto(id); refresh(); setViewing(null); }}
        />
      )}
    </div>
  );
}
