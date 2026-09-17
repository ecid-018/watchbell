import React, { useState } from "react";

/* ------------------------------------------------------------------
   The campaign, read the way it will be worked: by phase, against dates.

   The hero is a count, not a percentage — closed over total, the way PSC
   readiness reads, with the percentage beside it rather than instead of
   it. A phase says plainly whether it is behind, due this week, or still
   ahead, because that is the only question being asked of it.

   The rows are the Today row, trimmed: a campaign item is a job and
   behaves like one, so pulling it onto today, finishing it and sending it
   back are the same three acts they are everywhere else.
------------------------------------------------------------------ */

import { F } from "./theme.js";
import { TRACKER_STATUSES, campaignProgress, daysToTarget, shortDue, trackerRows } from "./campaign.js";
import PhotoRow from "./PhotoRow.jsx";

const STATE_LABEL = { overdue: "OVERDUE", "due-soon": "DUE THIS WEEK", done: "DONE", later: "" };

export default function CampaignView({
  C, dark, wide, jobs, campaigns, campaignLog, templates, todayKey,
  onSet, onPull, onPush, onTrack, onSetCampaign, onStart, onDuplicate,
}) {
  const live = campaigns.filter((c) => c.status !== "archived");
  const [pickId, setPickId] = useState(null);
  const [view, setView] = useState("phases");
  const [openPhase, setOpenPhase] = useState(null);
  const [openJob, setOpenJob] = useState(null);
  const [newTarget, setNewTarget] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };
  const field = {
    fontFamily: F.ui, fontSize: 14, color: C.text, height: 44, minWidth: 0,
    background: C.card, border: `1px solid ${C.line2}`,
    WebkitAppearance: "none", colorScheme: dark ? "dark" : "light",
  };

  const campaign = live.find((c) => c.id === pickId) || live[0] || null;
  const unstarted = (templates || []).filter((t) => !campaigns.some((c) => c.templateId === t.id));

  const startRow = (t) => (
    <button key={t.id} onClick={() => onStart(t, t.target)} className="wb-t w-full rounded-xl mt-2 text-left px-3"
      style={{ minHeight: 44, fontSize: 13, color: C.text2, border: `1px solid ${C.line2}` }}>
      Start “{t.title}” · target {shortDue(t.target)}
    </button>
  );

  if (!campaign) {
    return (
      <div>
        <div style={{ fontSize: 13, lineHeight: 1.5, padding: "8px 4px", color: C.dim }}>
          No campaign running. A campaign is a run of work with a date on the end of it —
          an audit, a survey, a docking.
        </div>
        {unstarted.map(startRow)}
      </div>
    );
  }

  const progress = campaignProgress(jobs, campaign, todayKey);
  const left = daysToTarget(campaign, todayKey);
  const tone = left < 0 ? C.oxide : left <= 7 ? C.amber : C.text2;
  const mine = jobs.filter((j) => j.campaign === campaign.id);

  /* -------- one job -------- */

  const row = (j, phase) => {
    const isOpen = openJob === j.id;
    const closed = j.status === "done";
    const state = closed ? "DONE" : j.status === "pooled" ? "BACKLOG" : "ON TODAY";
    return (
      <div key={j.id}>
        <button onClick={() => setOpenJob(isOpen ? null : j.id)}
          className="wb-t w-full flex items-start gap-3 py-2.5 px-2 rounded-xl text-left"
          style={{ minHeight: 44, background: isOpen ? C.sub : "transparent" }}>
          <span className="shrink-0 rounded-full" style={{
            width: 8, height: 8, marginTop: 6,
            background: closed ? C.foam : j.status === "open" ? C.amber : C.ring,
          }} />
          <span className="flex-1" style={{ minWidth: 0 }}>
            <span className="block" style={{
              fontSize: wide ? 14.5 : 13.5, lineHeight: 1.35, color: closed ? C.dim : C.text,
              textDecoration: closed ? "line-through" : "none", textDecorationColor: C.dim2,
            }}>{j.title}</span>
            <span className="block" style={{ fontFamily: F.mono, fontSize: 10, marginTop: 2, color: C.dim2 }}>
              {[state, j.owner, j.assignee].filter(Boolean).join(" · ")}
            </span>
          </span>
        </button>
        {isOpen && (
          <div className="px-2 pb-3">
            {j.detail && (
              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: C.dim, marginBottom: 6 }}>{j.detail}</div>
            )}
            <PhotoRow C={C} dark={dark} job={j} defaultTag={closed ? "after" : "before"} />
            <div className="flex flex-wrap gap-2 mt-3">
              {j.status === "pooled" && (
                <button onClick={() => onPull(j.id)} className="wb-t flex-1 rounded-lg"
                  style={{ minHeight: 44, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
                  Pull to today
                </button>
              )}
              {!closed && (
                <button onClick={() => onSet(j.id, { status: "done", doneOn: todayKey })} className="wb-t flex-1 rounded-lg"
                  style={{ minHeight: 44, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: C.foam, border: `1px solid ${C.line2}` }}>
                  Done
                </button>
              )}
              {j.status === "open" && (
                <button onClick={() => onPush(j.id)} className="wb-t flex-1 rounded-lg"
                  style={{ minHeight: 44, minWidth: 0, fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
                  Back to the campaign
                </button>
              )}
              {closed && (
                <button onClick={() => onSet(j.id, { status: "pooled", doneOn: null })} className="wb-t flex-1 rounded-lg"
                  style={{ minHeight: 44, minWidth: 0, fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
                  Reopen
                </button>
              )}
            </div>
            {phase && (
              <div style={{ fontFamily: F.mono, fontSize: 10, marginTop: 6, color: C.dim2 }}>
                {phase.id} · due {shortDue(phase.due)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* -------- phases -------- */

  const phasePanel = (p) => {
    const isOpen = openPhase === p.id;
    const items = mine.filter((j) => j.phase === p.id && j.status !== "dropped");
    const groups = new Map();
    for (const j of items) {
      const g = j.group || "Ungrouped";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(j);
    }
    const stateTone = p.state === "overdue" ? C.oxide : p.state === "done" ? C.foam : p.state === "due-soon" ? C.amber : C.dim2;
    return (
      <div key={p.id} className="wb-t rounded-2xl mb-2" style={{ background: C.sub, border: `1px solid ${p.state === "overdue" ? C.oxide : C.line2}` }}>
        <button onClick={() => setOpenPhase(isOpen ? null : p.id)} className="wb-t w-full text-left p-3"
          style={{ minHeight: 44 }}>
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ fontSize: wide ? 14.5 : 13.5, color: C.text }}>{p.name}</span>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: C.text2 }}>
              {p.closed}/{p.total}{p.pct === null ? "" : ` · ${p.pct}%`}
            </span>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, marginTop: 3, color: stateTone }}>
            {[STATE_LABEL[p.state], `due ${shortDue(p.due)}`].filter(Boolean).join(" · ")}
          </div>
        </button>
        {isOpen && (
          <div className="px-1 pb-2">
            {[...groups.entries()].map(([name, list]) => (
              <div key={name} className="mb-1">
                <div className="flex items-baseline justify-between px-2" style={{ ...eyebrow, marginBottom: 2 }}>
                  <span>{name.toUpperCase()}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim }}>{list.length}</span>
                </div>
                {list.map((j) => row(j, p))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* -------- the open items -------- */

  const tracker = () => {
    const rows = trackerRows(jobs, campaign, campaignLog);
    if (!rows.length) {
      return <div style={{ fontSize: 13, lineHeight: 1.5, padding: "8px 4px", color: C.dim }}>Nothing tracked on this campaign.</div>;
    }
    return (
      <>
        <div style={{ fontSize: 11.5, lineHeight: 1.5, padding: "0 2px 8px", color: C.dim2 }}>
          The items the office asks about. Closing one here finishes the job itself, so the list
          and the tracker cannot disagree.
        </div>
        {rows.map((j) => (
          <div key={j.id} className="wb-t rounded-2xl mb-2 p-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.4, color: j.closed ? C.dim : C.text }}>{j.title}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, marginTop: 3, color: C.dim2 }}>{j.phase} · {j.owner || "no owner"}</div>

            <input type="text" defaultValue={j.owner || ""} placeholder="Owner"
              onBlur={(e) => { if (e.target.value !== (j.owner || "")) onSet(j.id, { owner: e.target.value }); }}
              className="wb-t w-full rounded-lg mt-2 px-3" style={field} />

            <div className="flex flex-wrap gap-1.5 mt-2">
              {TRACKER_STATUSES.map(([key, label]) => (
                <button key={key} onClick={() => onTrack(j.id, key)} className="wb-t rounded-full px-3"
                  style={{
                    minHeight: 44, minWidth: 0, fontSize: 11.5, fontWeight: 500,
                    background: j.shownStatus === key ? (key === "closed" ? C.foam : C.amber) : "transparent",
                    color: j.shownStatus === key ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                    border: `1px solid ${j.shownStatus === key ? (key === "closed" ? C.foam : C.amber) : C.line2}`,
                  }}>{label}</button>
              ))}
            </div>

            <input type="text" defaultValue={j.evidence || ""} placeholder="Evidence on file"
              onBlur={(e) => { if (e.target.value !== (j.evidence || "")) onSet(j.id, { evidence: e.target.value }); }}
              className="wb-t w-full rounded-lg mt-2 px-3" style={field} />

            {j.history.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {j.history.slice(-6).map((h, i) => (
                  <div key={i} style={{ fontFamily: F.mono, fontSize: 10, marginTop: 2, color: C.dim2 }}>
                    {h.date} — {(TRACKER_STATUSES.find(([k]) => k === h.status) || [null, h.status])[1]}
                    {h.note ? ` · ${h.note}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </>
    );
  };

  /* -------- the whole thing -------- */

  return (
    <div>
      {live.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {live.map((c) => (
            <button key={c.id} onClick={() => { setPickId(c.id); setOpenPhase(null); }} className="wb-t rounded-full px-3"
              style={{
                minHeight: 44, fontSize: 11.5, fontWeight: 500,
                background: c.id === campaign.id ? C.amber : "transparent",
                color: c.id === campaign.id ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                border: `1px solid ${c.id === campaign.id ? C.amber : C.line2}`,
              }}>{c.id}</button>
          ))}
        </div>
      )}

      <div className="wb-t rounded-2xl p-4 mb-3 text-center" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
        <div style={eyebrow}>{campaign.status === "done" ? "CAMPAIGN · CLOSED OUT" : "CAMPAIGN"}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.4, marginTop: 4, color: C.text }}>{campaign.title}</div>
        <div style={{
          fontFamily: F.mono, fontSize: 48, fontWeight: 600, lineHeight: 1.1, marginTop: 6,
          color: progress.total && progress.closed === progress.total ? C.foam : C.text,
        }}>
          {progress.total ? `${progress.closed}/${progress.total}` : "—"}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.dim }}>
          {progress.pct === null ? "nothing to do" : `${progress.pct}% complete`}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 11, marginTop: 6, color: tone }}>
          {left < 0 ? `${-left} days past target` : left === 0 ? "target is today" : `${left} days to target`} · {shortDue(campaign.target)}
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {[["phases", "Phases"], ["tracker", "Open items"]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className="wb-t flex-1 rounded-xl"
            style={{
              minHeight: 44, minWidth: 0, fontSize: 12.5, fontWeight: 600,
              background: view === k ? C.sub : "transparent",
              color: view === k ? C.text : C.dim,
              border: `1px solid ${C.line2}`,
            }}>{label}</button>
        ))}
      </div>

      {view === "phases" ? progress.phases.map(phasePanel) : tracker()}

      <div style={{ ...eyebrow, marginTop: 16, marginBottom: 6 }}>THE CAMPAIGN ITSELF</div>
      {duplicating ? (
        <div className="wb-t rounded-2xl p-3 mb-2" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, color: C.text2 }}>
            Every phase moves by the same offset, and the work comes back to the pool with the
            tracker cleared.
          </div>
          <input type="date" value={newTarget} onChange={(e) => setNewTarget(e.target.value)}
            className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...field, fontFamily: F.mono }} />
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setDuplicating(false); setNewTarget(""); }} className="wb-t flex-1 rounded-xl"
              style={{ minHeight: 44, minWidth: 0, fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
              Cancel
            </button>
            <button onClick={() => { onDuplicate(campaign, newTarget); setDuplicating(false); setNewTarget(""); }}
              disabled={!newTarget} className="wb-t flex-1 rounded-xl"
              style={{
                minHeight: 44, minWidth: 0, fontSize: 12.5, fontWeight: 600,
                background: newTarget ? C.amber : "transparent",
                color: newTarget ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
                border: `1px solid ${newTarget ? C.amber : C.line2}`,
              }}>
              Duplicate
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDuplicating(true)} className="wb-t w-full rounded-xl mb-2"
          style={{ minHeight: 44, fontSize: 12.5, color: C.text2, border: `1px solid ${C.line2}` }}>
          Duplicate with a new target
        </button>
      )}
      {campaign.status === "active" ? (
        <button onClick={() => onSetCampaign(campaign.id, { status: "done" })} className="wb-t w-full rounded-xl mb-2"
          style={{ minHeight: 44, fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
          Close this campaign out
        </button>
      ) : (
        <button onClick={() => onSetCampaign(campaign.id, { status: "archived" })} className="wb-t w-full rounded-xl mb-2"
          style={{ minHeight: 44, fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
          Archive it
        </button>
      )}
      {unstarted.map(startRow)}
    </div>
  );
}
