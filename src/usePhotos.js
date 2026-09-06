import { useCallback, useEffect, useState } from "react";
import { getPhotosForJob } from "./photodb.js";

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

  return { photos, loading, refresh };
}

/** An object URL for a blob, revoked automatically when the blob changes
    or the component unmounts. */
export function useObjectUrl(blob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
