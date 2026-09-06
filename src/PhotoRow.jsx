import React, { useState } from "react";

/* ------------------------------------------------------------------
   A job's photo strip: thumbnails, a camera button, a library button.
   Tap a thumbnail for the full-screen viewer. Capture, view, pair,
   delete — no annotation, no gallery.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { usePhotosForJob, useObjectUrl } from "./usePhotos.js";
import { compressImage } from "./imagepipe.js";
import { readExifDate } from "./exif.js";
import { putPhoto, newPhotoId, deletePhoto, updatePhoto } from "./photodb.js";
import PhotoViewer from "./PhotoViewer.jsx";

function Thumb({ blob }) {
  const url = useObjectUrl(blob);
  return url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null;
}

export default function PhotoRow({ C, dark, job, defaultTag }) {
  const { photos, refresh } = usePhotosForJob(job.id);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);

  const ingest = async (files, source) => {
    setBusy(true);
    for (const file of files) {
      const exifDate = source === "library" ? await file.arrayBuffer().then(readExifDate).catch(() => null) : null;
      const full = await compressImage(file);
      const thumb = await compressImage(full.blob, { maxEdge: 240, quality: 0.5 });
      await putPhoto({
        id: newPhotoId(), jobId: job.id, blob: full.blob, thumbBlob: thumb.blob,
        tag: defaultTag, capturedAt: (exifDate || new Date()).toISOString(),
        exifDate: exifDate ? exifDate.toISOString() : null, source,
        width: full.width, height: full.height, bytes: full.blob.size,
      });
    }
    setBusy(false);
    refresh();
  };

  const onCamera = (e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) ingest(f, "camera"); };
  const onLibrary = (e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) ingest(f, "library"); };

  return (
    <div className="mt-2">
      <div className="flex gap-2 overflow-x-auto wb-x" style={{ scrollbarWidth: "none" }}>
        {photos.map((p) => (
          <button key={p.id} onClick={() => setViewing(p.id)} className="wb-t shrink-0 rounded-lg overflow-hidden relative"
            style={{ width: 56, height: 56, border: `1px solid ${C.line2}` }}>
            <Thumb blob={p.thumbBlob || p.blob} />
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
      {viewing && (
        <PhotoViewer
          C={C} dark={dark} photos={photos} activeId={viewing}
          onClose={() => setViewing(null)}
          onTag={async (id, tag) => { await updatePhoto(id, { tag }); refresh(); }}
          onDelete={async (id) => { await deletePhoto(id); refresh(); setViewing(null); }}
        />
      )}
    </div>
  );
}
