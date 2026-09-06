import React, { useRef, useState } from "react";

/* ------------------------------------------------------------------
   Full screen, pinch to zoom, tap the strip below to switch photos.
   Hand-rolled pinch/pan since the app disables the browser's own pinch
   zoom everywhere else (user-scalable=no).
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { useObjectUrl } from "./usePhotos.js";

function ZoomImage({ blob }) {
  const url = useObjectUrl(blob);
  const [xform, setXform] = useState({ scale: 1, x: 0, y: 0 });
  const gesture = useRef(null);

  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      gesture.current = { mode: "pinch", startDist: dist(e.touches), startScale: xform.scale };
    } else if (e.touches.length === 1) {
      gesture.current = { mode: "pan", startX: e.touches[0].clientX, startY: e.touches[0].clientY, origX: xform.x, origY: xform.y };
    }
  };
  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    if (g.mode === "pinch" && e.touches.length === 2) {
      const scale = Math.min(4, Math.max(1, g.startScale * (dist(e.touches) / g.startDist)));
      setXform((s) => ({ ...s, scale }));
    } else if (g.mode === "pan" && e.touches.length === 1 && xform.scale > 1) {
      setXform((s) => ({ ...s, x: g.origX + (e.touches[0].clientX - g.startX), y: g.origY + (e.touches[0].clientY - g.startY) }));
    }
  };
  const reset = () => setXform({ scale: 1, x: 0, y: 0 });

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => { gesture.current = null; }} onDoubleClick={reset}
      style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}>
      {url && (
        <img src={url} alt="" style={{
          maxWidth: "100%", maxHeight: "100%",
          transform: `translate(${xform.x}px, ${xform.y}px) scale(${xform.scale})`,
          transition: gesture.current ? "none" : "transform .15s ease",
        }} />
      )}
    </div>
  );
}

export default function PhotoViewer({ C, dark, photos, activeId, onClose, onTag, onDelete }) {
  const [id, setId] = useState(activeId);
  const idx = photos.findIndex((p) => p.id === id);
  const photo = photos[idx];
  if (!photo) return null;

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: "#9DB2B8" };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(4,10,13,.94)" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span style={eyebrow}>
          {idx + 1} OF {photos.length} · {photo.source === "library" ? "LIBRARY" : "CAMERA"}
          {photo.exifDate ? ` · ${new Date(photo.exifDate).toLocaleDateString()}` : ""}
        </span>
        <button onClick={onClose} style={{ color: "#E9F0EF", fontSize: 22, lineHeight: 1 }} aria-label="Close">×</button>
      </div>

      <ZoomImage key={photo.id} blob={photo.blob} />

      <div className="px-4 pb-4 pt-2 flex items-center gap-2">
        {["before", "after"].map((t) => (
          <button key={t} onClick={() => onTag(photo.id, t)} className="wb-t flex-1 rounded-xl py-2.5"
            style={{
              fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em",
              background: photo.tag === t ? C.amber : "transparent",
              color: photo.tag === t ? "#0E1C22" : "#9DB2B8",
              border: `1px solid ${photo.tag === t ? C.amber : "rgba(157,178,184,.4)"}`,
            }}>{t}</button>
        ))}
        <button onClick={() => onDelete(photo.id)} className="wb-t rounded-xl py-2.5 px-4"
          style={{ fontSize: 13, fontWeight: 600, color: C.oxide, border: `1px solid ${C.oxide}` }}>
          Delete
        </button>
      </div>

      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-4">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setId(p.id)} className="rounded-full" aria-label="Switch photo" style={{
              width: 6, height: 6, background: p.id === id ? "#E9F0EF" : "rgba(157,178,184,.4)",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
