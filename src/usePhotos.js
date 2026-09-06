import { useCallback, useEffect, useRef, useState } from "react";
import { getPhotosForJob } from "./photodb.js";
import { blobToDataUrl } from "./imagepipe.js";

/** A job's photos, live — call `refresh` after any write, since
    IndexedDB has no change events of its own to subscribe to. */
export function usePhotosForJob(jobId) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!jobId) { setPhotos([]); setLoading(false); return; }
    setLoading(true);
    getPhotosForJob(jobId).then((rows) => {
      setPhotos(rows.sort((a, b) => (a.capturedAt || "").localeCompare(b.capturedAt || "")));
      setLoading(false);
    });
  }, [jobId]);

  useEffect(() => { refresh(); }, [refresh]);

  /** A metadata-only change, applied in place. Re-reading the record would
      hand back fresh Blob objects for bytes that never changed, and every
      photo on screen would have to swap to a new object URL for nothing —
      churn that buys an accurate before/after tag exactly nothing. */
  const patch = useCallback((id, fields) => {
    setPhotos((rows) => rows.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }, []);

  return { photos, loading, refresh, patch };
}

/* ------------------------------------------------------------------
   Getting a stored photo onto the screen.

   Two ladders, tried in order. Across renditions: the working image
   first, the thumbnail only if that cannot be read — soft and small, but
   a soft photo of the sounding pipe is still evidence and a "?" is not.
   Within a rendition: an object URL first, which is a handle to bytes the
   browser already holds and costs no copy, then a data URL, which is the
   bytes inline and cannot be revoked out from under an <img>.

   Only when every rung is spent is the photo genuinely unreadable, and
   the caller is told so plainly — a photo that cannot be read is a fact
   the engineer needs, not a glyph to puzzle over.
------------------------------------------------------------------ */
export function usePhotoSrc(sources) {
  const list = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
  const head = list[0] || null;

  // Where we are on both ladders, remembered alongside the photo it was
  // decided for, so a different photo starts again at the top without
  // needing a second pass to reset it.
  const [attempt, setAttempt] = useState({ head: null, index: 0, route: "object" });
  const current = attempt.head === head ? attempt : { index: 0, route: "object" };
  const blob = list[current.index] || null;
  const failed = !blob || current.route === "failed";

  const [src, setSrc] = useState(null);
  // The src an error has already been counted for, so that two error
  // events for one load do not skip a rung.
  const reported = useRef(null);
  const route = current.route;

  useEffect(() => {
    if (!blob || route === "failed") { setSrc(null); return; }

    if (route === "object") {
      const url = URL.createObjectURL(blob);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }

    // Never leave a src pointing at the object URL we just gave up on.
    setSrc(null);
    let live = true;
    blobToDataUrl(blob).then(
      (dataUrl) => { if (live) setSrc(dataUrl); },
      () => { if (live) setAttempt(step(head, list, current)); },
    );
    return () => { live = false; };
  }, [blob, route]);

  const onError = useCallback((e) => {
    const bad = e && e.currentTarget ? e.currentTarget.getAttribute("src") : null;
    if (bad && reported.current === bad) return;
    reported.current = bad;
    setAttempt(step(head, list, current));
  }, [head, list.length, current.index, current.route]);

  // Showing a rendition we did not intend to show — the caller has to be
  // able to say so, rather than let a soft thumbnail pass for the photo.
  return { src, failed, degraded: current.index > 0 && !failed, blob: head, onError };
}

/** One rung down: a data URL for the same rendition, else the top of the
    next rendition, else out of road. */
function step(head, list, at) {
  if (at.route === "object") return { head, index: at.index, route: "data" };
  if (at.index + 1 < list.length) return { head, index: at.index + 1, route: "object" };
  return { head, index: at.index, route: "failed" };
}
