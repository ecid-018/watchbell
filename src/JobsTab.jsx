import React, { lazy, Suspense, useState } from "react";

/* ------------------------------------------------------------------
   The engine room list, grown up: Today, the Backlog pool, PSC readiness,
   a batch photo-attach screen, and reports — behind one segmented control,
   with a single prominent + for quick capture at the machine.
------------------------------------------------------------------ */

import TodayView from "./TodayView.jsx";
import QuickCapture from "./QuickCapture.jsx";

const BacklogView = lazy(() => import("./BacklogView.jsx"));
const PscView = lazy(() => import("./PscView.jsx"));
const BatchAttachView = lazy(() => import("./BatchAttachView.jsx"));
const ReportsView = lazy(() => import("./ReportsView.jsx"));

const SEGMENTS = [["today", "Today"], ["backlog", "Backlog"], ["psc", "PSC"], ["photos", "Photos"], ["reports", "Reports"]];

export default function JobsTab({
  C, dark, wide, jobs, pool, ranks, todayKey, events,
  pscPinnedIds, pscDeferrals, daysToArrival, reportProfile,
  onSet, onPull, onPush, onDefer, onQuickCapture,
}) {
  const [seg, setSeg] = useState("today");
  const [capturing, setCapturing] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex gap-0.5 rounded-xl p-0.5 overflow-x-auto wb-x" style={{ background: C.panel, scrollbarWidth: "none" }}>
          {SEGMENTS.map(([k, label]) => (
            <button key={k} onClick={() => setSeg(k)} className="wb-t rounded-lg py-1.5 px-2.5 shrink-0"
              style={{
                fontSize: 11.5, fontWeight: 600,
                background: seg === k ? C.sub : "transparent",
                color: seg === k ? C.text : C.dim,
              }}>{label}</button>
          ))}
        </div>
        <button onClick={() => setCapturing(true)} className="wb-t shrink-0 rounded-xl flex items-center justify-center"
          style={{ width: 38, height: 38, fontSize: 20, fontWeight: 600, background: C.amber, color: dark ? "#0E1C22" : "#FFFFFF" }}
          aria-label="Quick capture">+</button>
      </div>

      {seg === "today" && (
        <TodayView C={C} dark={dark} wide={wide} jobs={jobs} ranks={ranks} todayKey={todayKey}
          pscPinnedIds={pscPinnedIds} pscDeferrals={pscDeferrals}
          onSet={onSet} onPush={onPush} onDefer={onDefer} />
      )}

      <Suspense fallback={<div className="py-8 text-center" style={{ fontSize: 13, color: C.dim }}>Loading…</div>}>
        {seg === "backlog" && (
          <BacklogView C={C} dark={dark} wide={wide} pool={pool} events={events} todayKey={todayKey} onPull={onPull} />
        )}
        {seg === "psc" && (
          <PscView C={C} dark={dark} wide={wide} jobs={jobs} todayKey={todayKey}
            daysToArrival={daysToArrival} pscDeferrals={pscDeferrals} onSet={onSet} onDefer={onDefer} />
        )}
        {seg === "photos" && (
          <BatchAttachView C={C} dark={dark} wide={wide} jobs={jobs} />
        )}
        {seg === "reports" && (
          <ReportsView C={C} dark={dark} jobs={jobs} profile={reportProfile} todayKey={todayKey} />
        )}
      </Suspense>

      {capturing && (
        <QuickCapture C={C} dark={dark} onClose={() => setCapturing(false)} onSave={onQuickCapture} />
      )}
    </div>
  );
}
