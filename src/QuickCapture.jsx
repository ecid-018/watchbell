import React, { useState } from "react";

/* ------------------------------------------------------------------
   Logging a defect while standing at the machine has to take under ten
   seconds: a title, a camera button, nothing else. Assignee, priority and
   detail get filled in later from the list.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { compressImage } from "./imagepipe.js";
import { putPhoto, newPhotoId } from "./photodb.js";

export default function QuickCapture({ C, dark, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const full = await compressImage(file);
    const thumb = await compressImage(full.blob, { maxEdge: 240, quality: 0.5 });
    setPhoto({ full, thumb });
    setBusy(false);
  };

  const save = async () => {
    if (!title.trim()) return;
    const job = onSave(title.trim());
    if (photo && job) {
      await putPhoto({
        id: newPhotoId(), jobId: job.id, blob: photo.full.blob, thumbBlob: photo.thumb.blob,
        tag: "after", capturedAt: new Date().toISOString(), exifDate: null, source: "camera",
        width: photo.full.width, height: photo.full.height, bytes: photo.full.blob.size,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3"
      style={{ background: dark ? "rgba(4,10,13,.72)" : "rgba(16,38,46,.42)" }}
      onClick={onClose}>
      <div className="wb-t w-full max-w-md rounded-[22px] overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.line2}`, boxShadow: C.shadow }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>QUICK CAPTURE</div>
        </div>
        <div className="px-5 py-4">
          <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="What did you find" autoCapitalize="sentences"
            className="wb-t w-full rounded-xl px-3" style={{
              fontFamily: F.ui, fontSize: 16, color: C.text, height: 46,
              background: C.sub, border: `1px solid ${C.line2}`, WebkitAppearance: "none",
              colorScheme: dark ? "dark" : "light",
            }} />

          <label className="wb-t w-full flex items-center justify-center gap-2 rounded-xl mt-3 py-3"
            style={{ border: `1px dashed ${C.line2}`, color: photo ? C.foam : C.dim, fontSize: 13.5, fontWeight: 600 }}>
            {busy ? "Compressing…" : photo ? "Photo attached ✓" : "Camera"}
            <input type="file" accept="image/*" capture="environment" hidden onChange={onFile} disabled={busy} />
          </label>

          <button onClick={save} disabled={!title.trim() || busy} className="wb-t w-full rounded-xl mt-4 py-3"
            style={{
              fontSize: 14, fontWeight: 600,
              background: title.trim() ? C.amber : "transparent",
              color: title.trim() ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
              border: `1px solid ${title.trim() ? C.amber : C.line2}`,
            }}>Save</button>
          <button onClick={onClose} className="wb-t w-full mt-2" style={{ fontSize: 12.5, color: C.dim }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
