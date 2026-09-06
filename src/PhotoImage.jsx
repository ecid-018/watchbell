import React from "react";

/* ------------------------------------------------------------------
   Every photo the app puts on screen goes through here, so that one the
   browser will not render fails the same way everywhere: as a stated
   fact, carrying the byte count that shows the evidence is still in
   storage, rather than as the browser's own "?" glyph — which says
   nothing about whether the photo is lost or merely unrendered.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { usePhotoSrc } from "./usePhotos.js";

export default function PhotoImage({ blob, C, style, compact = false, alt = "" }) {
  const { src, failed, onError } = usePhotoSrc(blob);

  if (blob && !failed) {
    return src ? <img src={src} alt={alt} onError={onError} style={style} /> : null;
  }

  const size = blob ? `${Math.max(1, Math.round(blob.size / 1024))}K ON DISK` : "NO IMAGE STORED";
  return (
    <div className="flex flex-col items-center justify-center" style={{
      width: "100%", height: "100%", padding: 2, gap: compact ? 1 : 4,
      fontFamily: F.mono, textAlign: "center", color: C ? C.oxide : "#D0674A",
    }}>
      <span style={{ fontSize: compact ? 13 : 22, lineHeight: 1 }}>⚠</span>
      <span style={{ fontSize: compact ? 7 : 10, letterSpacing: ".06em", lineHeight: 1.3 }}>
        {compact ? "UNREADABLE" : `PHOTO UNREADABLE · ${size}`}
      </span>
    </div>
  );
}
