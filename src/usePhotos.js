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

   An object URL is the cheap route: a handle to bytes the browser already
   holds, no copy made. It is also the fragile one — the handle is only
   good for as long as the browser keeps honouring it, and iOS has been
   seen to serve a broken image back for a URL that rendered fine moments
   earlier, for every photo at once, without the page ever reloading.

   So a failed load is not the end of the road. The <img>'s own error
   escalates to a data URL: the same bytes inline, slower to build and a
   third larger, but nothing can revoke or collect it out from under the
   element. Only when that fails too is the photo genuinely unreadable,
   and the caller is told so plainly — a photo that cannot be read is a
   fact the engineer needs, not a glyph to puzzle over.
------------------------------------------------------------------ */
export function usePhotoSrc(blob) {
  // Which route this blob is on, remembered alongside the blob it was
  // decided for, so a different blob starts back at the cheap route
  // without needing a second pass to reset it.
  const [chosen, setChosen] = useState({ blob: null, route: "object" });
  const route = chosen.blob === blob ? chosen.route : "object";
  const [src, setSrc] = useState(null);
  // The src an error has already been counted for, so that two error
  // events for one load do not skip a rung of the ladder.
  const reported = useRef(null);

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
      () => { if (live) setChosen({ blob, route: "failed" }); },
    );
    return () => { live = false; };
  }, [blob, route]);

  const onError = useCallback((e) => {
    const bad = e && e.currentTarget ? e.currentTarget.getAttribute("src") : null;
    if (bad && reported.current === bad) return;
    reported.current = bad;
    setChosen((c) => ({ blob, route: c.blob === blob && c.route === "data" ? "failed" : "data" }));
  }, [blob]);

  return { src, failed: route === "failed", onError };
}
