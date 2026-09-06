import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------
   The evidence, read the way it will be read at arrival: scroll the jobs
   and look at the work, rather than opening one row at a time to squint
   at a 56px strip.

   Photos are loaded as they come into view and kept once loaded. The
   whole store is a few dozen frames on one ship, so there is nothing to
   be gained by unloading them again on the way past — but decoding forty
   of them up front, before the engineer has scrolled to any, is a cost
   worth not paying.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { PRIORITY_RANK } from "./jobs.js";
import { allPhotos, deletePhoto, updatePhoto } from "./photodb.js";
import PhotoImage from "./PhotoImage.jsx";
import PhotoViewer from "./PhotoViewer.jsx";

/** True once the element has been near the viewport, and true from then
    on. Without an observer to hand, everything is in view — a browser
    that cannot defer the work still has to show the photos. */
function useInView(ref, rootMargin = "600px") {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") { setSeen(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return seen;
}

const badge = {
  fontFamily: F.mono, fontSize: 8, fontWeight: 700, letterSpacing: ".04em",
  color: "#fff", padding: "1px 4px", borderRadius: 4, textTransform: "uppercase",
};

function GalleryPhoto({ C, photo, onOpen }) {
  const ref = useRef(null);
  const seen = useInView(ref);
  const [degraded, setDegraded] = useState(false);

  return (
    <button ref={ref} onClick={onOpen} className="wb-t relative rounded-xl overflow-hidden"
      style={{ aspectRatio: "4 / 3", background: C.panel, border: `1px solid ${C.line2}` }}>
      {seen && (
        <PhotoImage sources={[photo.image, photo.thumb]} C={C} onDegraded={setDegraded}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      <span className="absolute" style={{ ...badge, left: 4, bottom: 4, background: "rgba(0,0,0,.55)" }}>
        {photo.tag}
      </span>
      {degraded && (
        <span className="absolute" style={{ ...badge, right: 4, top: 4, background: C.oxide }}>thumb only</span>
      )}
    </button>
  );
}

export default function PhotoGallery({ C, dark, wide, jobs }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null); // { jobId, photoId }

  const refresh = useCallback(() => {
    allPhotos().then((rows) => { setPhotos(rows); setLoading(false); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const patch = (id, fields) =>
    setPhotos((rows) => rows.map((p) => (p.id === id ? { ...p, ...fields } : p)));

  const groups = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, j]));
    const byJob = new Map();
    for (const p of photos) {
      // Photos set aside in batch attach are not evidence of anything yet;
      // they stay on the attach screen until they are paired or dropped.
      if (p.jobId === "skipped") continue;
      const key = p.jobId || "";
      if (!byJob.has(key)) byJob.set(key, []);
      byJob.get(key).push(p);
    }

    const out = [...byJob.entries()].map(([jobId, list]) => ({
      jobId,
      job: byId.get(jobId) || null,
      // Before then after, as a report lays them out, and oldest first
      // within each — the order the work actually happened in.
      photos: list.slice().sort((a, b) =>
        (a.tag === b.tag ? 0 : a.tag === "before" ? -1 : 1)
        || (a.capturedAt || "").localeCompare(b.capturedAt || "")),
    }));

    return out.sort((a, b) => {
      if (!a.job || !b.job) return a.job ? -1 : b.job ? 1 : 0; // unfiled last
      return (PRIORITY_RANK[a.job.priority] ?? 9) - (PRIORITY_RANK[b.job.priority] ?? 9)
        || a.job.title.localeCompare(b.job.title);
    });
  }, [photos, jobs]);

  const shown = groups.reduce((n, g) => n + g.photos.length, 0);
  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const open = viewing && groups.find((g) => g.jobId === viewing.jobId);

  if (loading) {
    return <div className="py-8 text-center" style={{ fontSize: 13, color: C.dim }}>Loading…</div>;
  }

  return (
    <div>
      <div style={{ ...eyebrow, padding: "0 2px 10px" }}>
        {shown === 0 ? "NO PHOTOS ABOARD"
          : `${shown} PHOTO${shown === 1 ? "" : "S"} · ${groups.length} ITEM${groups.length === 1 ? "" : "S"}`}
      </div>

      {shown === 0 && (
        <div style={{ fontSize: 13, lineHeight: 1.5, padding: "0 2px", color: C.dim }}>
          Nothing photographed yet. Open a job on Today or PSC and use the camera
          on its photo strip, or bring a batch in from the library on Attach.
        </div>
      )}

      {groups.map((g) => (
        <div key={g.jobId || "unfiled"} className="mb-4">
          <div className="px-0.5" style={{ marginBottom: 6 }}>
            <div style={{ fontSize: wide ? 15 : 14, lineHeight: 1.35, color: C.text }}>
              {g.job ? g.job.title : "Unfiled"}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, marginTop: 2, color: C.dim2 }}>
              {g.job
                ? [
                  g.job.priority === "psc" || g.job.priority === "defect" ? g.job.priority.toUpperCase() : null,
                  g.job.status === "pooled" ? "backlog" : g.job.status,
                  g.job.group || null,
                ].filter(Boolean).join(" · ")
                : "not yet paired to a job"}
              {` · ${g.photos.length} photo${g.photos.length === 1 ? "" : "s"}`}
            </div>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${wide ? 3 : 2}, minmax(0, 1fr))` }}>
            {g.photos.map((p) => (
              <GalleryPhoto key={p.id} C={C} photo={p}
                onOpen={() => setViewing({ jobId: g.jobId, photoId: p.id })} />
            ))}
          </div>
        </div>
      ))}

      {open && (
        <PhotoViewer
          C={C} dark={dark} photos={open.photos} activeId={viewing.photoId}
          onClose={() => setViewing(null)}
          onTag={async (id, tag) => {
            patch(id, { tag });
            if (!(await updatePhoto(id, { tag }))) refresh();
          }}
          onDelete={async (id) => { await deletePhoto(id); setViewing(null); refresh(); }}
        />
      )}
    </div>
  );
}
