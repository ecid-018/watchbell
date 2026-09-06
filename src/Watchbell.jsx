import React, { useState, useMemo, useEffect, lazy, Suspense } from "react";

/* ------------------------------------------------------------------
   WATCHBELL — daily discipline log for a passage
   Apple system typography · auto light/dark

   The clock leads. What you should be doing right now is worked out from
   the ship's time against the day's own schedule and shown at the top;
   everything else on the screen is context for it.

   In landscape the card splits: standing context down the left rail,
   the working list on the right, both fitting one screen with no scroll.
   Portrait keeps the original single column.
------------------------------------------------------------------ */

import { F, THEME, isDark } from "./theme.js";
import {
  TAGS, UTC_CHOICES, currentItem, dayPlan, eveningFor,
  minutesOfDay, nextItem, openForUTC, parseUtcLabel, pretty, utcLabel, windowEnd,
} from "./schedule.js";
import { K, readJSON, readLog, writeJSON, getQuotaInfo } from "./storage.js";
import { addDays, clockDate, dateKey, parseKey, prettyDate } from "./voyage.js";
import { currentPhase, dayOf, endpointsOf, isComplete, legOf, legsOf, lengthOf, nameOf, readingDayOf } from "./phase.js";
import { graceDays, onPlan, rollingSeven } from "./stats.js";
import { useLandscape } from "./useLandscape.js";
import BodyTab from "./BodyTab.jsx";
import JobsTab from "./JobsTab.jsx";
import { readSession, sessionForDate, sessionsInWindow, sessionsDueInWindow, writeSession } from "./training.js";
import { EVENT_TYPES, dayDoable, dayItems, dueSoon, eventOn, recoveryOn } from "./events.js";
import { jobsInWindow, makeJob } from "./jobs.js";
import { DEFAULT_RANKS, exportAll, importAll, loadStore, newId, saveStore } from "./store.js";
import { allRefs, countCached, fetchInto, listBooks, parseRef } from "./bible.js";
import { ADMIN, SLOTS } from "./data/admin-tasks.js";
import { BACKLOG } from "./data/jobs-backlog.js";
import { adminToday, dueTriggers, slotSummary, taskStatus } from "./admin.js";
import { pscPinned, recurringTasksFromBacklog } from "./backlog.js";
import { pscReadiness } from "./psc.js";
import { daysToArrival } from "./phase.js";
import { estimatePhotoBytes, purgeOldPhotos } from "./photodb.js";
import { buildPhotoZip } from "./photozip.js";
import { fileCandidate, mergeRead, mergeReflect, recoveryCandidates } from "./recovery.js";
import {
  applyFastingWindow, canStartProlongedFast, currentStage, hiitPromptEligible,
  isWindowSuspended, prolongedElapsedHours, windowAdherence, windowForDay, windowState,
  PROLONGED_CAP_HOURS,
} from "./fasting.js";

// Lazy-loaded tabs (code-split) — each needs a <Suspense> boundary above it.
const WordTab = lazy(() => import("./WordTab.jsx"));
const WeekTab = lazy(() => import("./WeekTab.jsx"));
const PlansTab = lazy(() => import("./PlansTab.jsx"));

export default function Watchbell({ phases, onEditPhase, onNewPhase }) {
  // `now` lives in state so an app left open on the home screen rolls over at
  // midnight instead of writing ticks into yesterday's record — and so the
  // clock and the current-activity highlight are live rather than paint-time.
  const [now, setNow] = useState(() => new Date());
  const todayKey = dateKey(now);

  const [tab, setTab] = useState("log");
  const [mode, setMode] = useState(() => readJSON(K.mode, "auto"));
  const [done, setDone] = useState(() => readLog(dateKey(new Date())));
  const [read, setRead] = useState(() => readJSON(K.read, {}) || {});
  const [reflect, setReflect] = useState(() => readJSON(K.reflect, {}) || {});
  const [sheet, setSheet] = useState(null); // the reading day the Word tab is on
  // How many times each figure has been opened. Once a movement is familiar it
  // stops asking for attention, so the list quietens down as the passage goes on.
  const [seenFigures, setSeenFigures] = useState(() => readJSON(K.figures, {}) || {});

  // The stores behind Jobs, Week, Plans and ship's business.
  const [jobs, setJobs] = useState(() => loadStore("jobs"));
  const [plans, setPlans] = useState(() => loadStore("plans"));
  const [events, setEvents] = useState(() => loadStore("events"));
  const [weeks, setWeeks] = useState(() => loadStore("weeks"));
  const [ranks, setRanks] = useState(() => loadStore("ranks"));
  const [declaring, setDeclaring] = useState(false);
  // The reading's own text, if it was carried aboard. Never fetched on render.
  const [aboard, setAboard] = useState(null);
  const [books, setBooks] = useState([]);
  const [browse, setBrowse] = useState(null);
  const [marks, setMarks] = useState(() => loadStore("marks"));
  const [loading, setLoading] = useState(null);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [exporting, setExporting] = useState(null);
  const [quota, setQuota] = useState(null);

  // Admin tasks: last-done date and deferred-until date, per task key. Every
  // other fact about a task — due, overdue, carried — is recomputed from
  // these two dates and the calendar, never stored.
  const [adminDone, setAdminDone] = useState(() => readJSON(K.adminCompletions, {}) || {});
  const [adminDeferred, setAdminDeferred] = useState(() => readJSON(K.adminDeferrals, {}) || {});
  const [openAdminSlot, setOpenAdminSlot] = useState(null); // "am" | "pm" | null
  const [openAdminTask, setOpenAdminTask] = useState(null); // task key
  const [vaultOffer, setVaultOffer] = useState(null); // { title } | null, after a defect/survey task

  // PSC defer-with-reason history, per job id, and the report header — both
  // small settings-shaped stores, same ad-hoc pattern as fasting/adminDeferred.
  const [pscDeferrals, setPscDeferrals] = useState(() => readJSON(K.pscDeferrals, {}) || {});
  const [reportProfile, setReportProfileState] = useState(() => readJSON(K.reportProfile, null) ?? {
    vessel: "MV Queen Trader", rank: "", name: "",
  });
  const [photoBytes, setPhotoBytes] = useState(null);

  // Whatever the last seven days of auto-backup, or the one-time schema
  // snapshot, still hold that the live journal is currently missing —
  // recomputed whenever the journal itself changes, so a recovery's own
  // effect (fewer gaps left) is visible immediately.
  const journalRecovery = useMemo(() => recoveryCandidates(reflect), [reflect]);
  const recoverReflections = () => {
    for (const c of journalRecovery) {
      setReflect((r) => mergeReflect(r, c.reflect));
      setRead((r) => mergeRead(r, c.read));
    }
  };

  // The same recovery, from a backup file the engineer still has off the
  // device. Sized up first and applied only on a second tap, because the
  // whole point of not using Import here is that nothing happens by
  // surprise. Throws on a file that is not a Watchbell backup.
  const inspectJournalFile = (backup) => fileCandidate(backup, reflect);
  const mergeJournalFile = (candidate) => {
    setReflect((r) => mergeReflect(r, candidate.reflect));
    setRead((r) => mergeRead(r, candidate.read));
  };

  // Fasting: the ramp's anchor date and any manual stage pin, plus the
  // fasted-training setting. Everything else about today's window — open
  // time, fasting or open, adherence — is recomputed fresh, never stored.
  const [fasting, setFasting] = useState(() => readJSON(K.fasting, null) ?? {
    // Backdated two weeks: stage 1 (the 12-hour week) is skipped on first
    // run, landing directly on stage 2's 14-hour window. The ramp still
    // advances to stage 3 on its own after two more weeks, same as if
    // stage 1 had actually been lived through.
    startDate: dateKey(addDays(parseKey(todayKey), -14)), stagePin: null, breakFastOnHiit: false, hiitPromptShown: false,
  });
  const [prolongedFast, setProlongedFast] = useState(() => readJSON(K.prolongedFast, null));
  const [prolongedFastLog, setProlongedFastLog] = useState(() => readJSON(K.prolongedFastLog, []) || []);
  const [startingFast, setStartingFast] = useState(false); // showing the checklist

  const wide = useLandscape();
  const phase = currentPhase(phases);
  // A port stay mints its synthetic leg on the fly, so without memoising this
  // the identity changes every clock tick and the item memos below never hold.
  const legs = useMemo(() => legsOf(phase), [phase]);
  const atSea = phase.kind !== "port";
  const complete = isComplete(phase, now);

  // Real calendar position. legOverride === null means "live".
  const realDay = dayOf(phase, now);
  const autoLegIdx = legOf(phase, realDay).id;
  const [legOverride, setLegOverride] = useState(null);
  const legIdx = legOverride ?? autoLegIdx;
  const previewing = legOverride !== null && legOverride !== autoLegIdx;

  // The clock walk assumes an even change across the passage; the ship's
  // actual clock does not have to agree with it. Scoped to this phase's
  // start, so a stale correction from a finished passage is never read for
  // a new one — App.jsx remounts Watchbell on every phase change anyway,
  // which is what lets this be a plain lazy initializer rather than an effect.
  const [utcOverride, setUtcOverride] = useState(() => {
    const saved = readJSON(K.utcOverride, null);
    return saved && saved.phaseStart === phase.start ? saved.offset : null;
  });
  const [editingUtc, setEditingUtc] = useState(false);
  const applyUtcOverride = (l) =>
    utcOverride == null || !l.utc ? l : { ...l, utcHours: utcOverride, utc: utcLabel(utcOverride), open: openForUTC(utcOverride) };
  // The legacy route's hand-written legs never carried a plain number, only
  // the formatted label — fall back to parsing it so the picker still opens
  // on the offset actually in force rather than defaulting to −12.
  const utcHoursOf = (l) => l.utcHours ?? parseUtcLabel(l.utc);

  const dark = isDark(mode, now);
  const C = dark ? THEME.dark : THEME.light;

  const rawLeg = legs[legIdx]; // legIdx, not autoLegIdx — may be a previewed leg
  const leg = previewing ? rawLeg : applyUtcOverride(rawLeg);
  // Live, the day is the calendar's. Previewing another leg, fall back to that
  // leg's midpoint — the original component's rule, kept so look-ahead reads the same.
  const day = previewing ? Math.round((leg.d0 + leg.d1) / 2) : realDay;
  const readDay = readingDayOf(phase, day);
  const todayReadDay = readingDayOf(phase, realDay);
  const plan = dayPlan(readDay);

  const shownKeyEarly = previewing
    ? dateKey(addDays(parseKey(phase.start), day - 1))
    : todayKey;
  const event = eventOn(events, shownKeyEarly);
  const recovery = recoveryOn(events, shownKeyEarly);

  // Fasting is a calendar fact like the admin tasks, not a leg-preview one:
  // the window is today's regardless of which leg's schedule is on screen.
  const isHiitToday = sessionForDate(now).kind === "HIIT";
  const fastingStage = currentStage(fasting, now);
  const fastingWindow = windowForDay(fasting, fastingStage, isHiitToday);
  const prolongedActive = !!prolongedFast?.active;
  const windowSuspended = isWindowSuspended(events, todayKey);

  const items = useMemo(
    () => applyFastingWindow(dayItems(leg, shownKeyEarly, events), fastingWindow, prolongedActive),
    [leg, shownKeyEarly, events, fastingStage, isHiitToday, fasting.breakFastOnHiit, prolongedActive],
  );

  // The session is the weekday's, so previewing a leg previews that leg's
  // training too: the leg picks a voyage day, the day picks a date, the date
  // picks the session. Live, that date is simply today.
  const shownDate = previewing ? addDays(parseKey(phase.start), day - 1) : now;
  const shownKey = shownKeyEarly;
  const session = sessionForDate(shownDate);

  // Heavy weather follows the leg — a stood-down leg is the Cape, or whatever
  // stretch you named — until you say otherwise. You are the one who can feel
  // the ship, so a manual call is remembered for the day and wins.
  // Records this session has touched, over whatever is in storage. Keyed by date
  // like the habit log, so previewing another day edits that day and not today.
  const [trainLog, setTrainLog] = useState({});
  const dayRec = shownKey in trainLog ? trainLog[shownKey] : readSession(shownKey);
  const autoHeavy = !leg.trade;
  const heavy = dayRec?.heavy ?? autoHeavy;

  const putSession = (patch) => {
    const next = { key: session.key, completed: false, heavy, ...dayRec, ...patch };
    writeSession(shownKey, next);
    setTrainLog((m) => ({ ...m, [shownKey]: next }));
  };

  const setHeavy = (on) => putSession({ heavy: on });

  // Logging the session closes the 05:50 item with it, the way a reflection
  // closes the 05:35 one.
  const completeSession = (on) => {
    putSession({ completed: on });
    if (!previewing) setDone((d) => ({ ...d, train: on }));
  };

  // Whether a HIIT session felt hard fasted — the only input the break-fast
  // nudge reads. Not a rating, not shown anywhere as a score.
  const flagPoorSession = () => putSession({ poor: !dayRec?.poor });

  // The highlight is always the live day's, never the previewed leg's: it answers
  // "what should I be doing now", which a look-ahead cannot change.
  const liveLeg = applyUtcOverride(legs[autoLegIdx]);
  const liveItems = useMemo(
    () => applyFastingWindow(dayItems(liveLeg, todayKey, events), fastingWindow, prolongedActive),
    [liveLeg, todayKey, events, fastingStage, isHiitToday, fasting.breakFastOnHiit, prolongedActive],
  );
  const nowItem = currentItem(liveItems, minutesOfDay(now));
  const nowEnd = windowEnd(liveItems, nowItem);
  const upNext = nextItem(liveItems, nowItem);

  // The Standing tab always reports today, never the previewed leg — otherwise
  // previewing the Cape would score today's ticks against an 11-item day.
  const todayDoable = useMemo(() => dayDoable(liveLeg, todayKey, events), [liveLeg, todayKey, events]);
  const hit = todayDoable.filter((i) => done[i.id]).length;
  const span = lengthOf(phase);
  const progress = atSea ? Math.min(100, Math.max(0, ((day - 1) / (span - 1)) * 100)) : 0;

  // Computed figures for the Standing tab. Today's record is handed in from state
  // rather than re-read from storage, which is written only in an effect — so the
  // rolling number moves the moment a box is ticked instead of lagging one tick.
  const live = useMemo(() => ({ [todayKey]: done }), [todayKey, done]);
  const r7 = useMemo(() => rollingSeven(phases, now, live, events), [phases, todayKey, live, events]);
  const grace = useMemo(() => graceDays(phases, now, live, events), [phases, todayKey, live, events]);
  const plan7 = useMemo(() => onPlan(phases, now, live, events), [phases, todayKey, live, events]);
  const trained = useMemo(() => sessionsInWindow(now), [todayKey, trainLog]);
  const trainDue = useMemo(() => sessionsDueInWindow(now), [todayKey]);
  const jobFigure = useMemo(() => jobsInWindow(jobs, now), [jobs, todayKey]);

  // The backlog pool, and the PSC figures that drive the pin and the
  // Standing tile. `jobs` is the one flat store — "pooled" is just a
  // status on the same rows Today and the archive already read.
  const pool = useMemo(() => jobs.filter((j) => j.status === "pooled"), [jobs]);
  const pscReady = useMemo(() => pscReadiness(jobs), [jobs]);
  const arrivalDays = useMemo(() => daysToArrival(phase, now), [phase, todayKey]);
  const pscPinnedIds = useMemo(
    () => new Set(pscPinned(jobs, phase, now).map((j) => j.id)),
    [jobs, phase, todayKey],
  );

  // Admin tasks are a calendar fact, not a leg-preview one: they run off
  // today regardless of which leg is on screen. Weekly backlog items
  // (S03/S04) ride this same cadence engine rather than a second one.
  const tasks = useMemo(() => [...ADMIN, ...recurringTasksFromBacklog(BACKLOG)], []);
  const adminCtx = useMemo(
    () => ({ today: now, todayKey, completions: adminDone, deferrals: adminDeferred, events }),
    [now, todayKey, adminDone, adminDeferred, events],
  );
  const amSummary = useMemo(() => slotSummary(tasks, "am", adminCtx, SLOTS.am.minutes), [tasks, adminCtx]);
  const pmSummary = useMemo(() => slotSummary(tasks, "pm", adminCtx, SLOTS.pm.minutes), [tasks, adminCtx]);
  const triggerTasks = useMemo(() => dueTriggers(tasks, adminCtx), [tasks, adminCtx]);
  const adminFigure = useMemo(() => adminToday(tasks, adminCtx), [tasks, adminCtx]);

  const prolongedDates = useMemo(
    () => prolongedFastLog.map((f) => f.date).concat(prolongedFast?.date ? [prolongedFast.date] : []),
    [prolongedFastLog, prolongedFast],
  );
  const windowFigure = useMemo(
    () => windowAdherence(phases, now, live, events, 7, prolongedDates),
    [phases, todayKey, live, events, prolongedDates],
  );
  // Reads storage directly (like sessionsInWindow above), so trainLog acts as
  // the recompute trigger rather than an input the function actually reads.
  const hiitPrompt = useMemo(() => hiitPromptEligible(fasting, now), [fasting, todayKey, trainLog]);

  /* -------- persistence -------- */

  useEffect(() => writeJSON(K.mode, mode), [mode]);
  useEffect(() => writeJSON(K.read, read), [read]);
  useEffect(() => writeJSON(K.reflect, reflect), [reflect]);
  useEffect(() => writeJSON(K.figures, seenFigures), [seenFigures]);
  useEffect(() => writeJSON(K.adminCompletions, adminDone), [adminDone]);
  useEffect(() => writeJSON(K.adminDeferrals, adminDeferred), [adminDeferred]);
  useEffect(() => writeJSON(K.fasting, fasting), [fasting]);
  useEffect(() => writeJSON(K.prolongedFast, prolongedFast), [prolongedFast]);
  useEffect(() => writeJSON(K.prolongedFastLog, prolongedFastLog), [prolongedFastLog]);
  useEffect(() => writeJSON(K.pscDeferrals, pscDeferrals), [pscDeferrals]);
  useEffect(() => writeJSON(K.reportProfile, reportProfile), [reportProfile]);
  // Cheap (byte counts only, no blob reads) but no reason to run it every
  // tick — refreshed on mount and whenever Plans (where it's shown) opens.
  useEffect(() => { if (tab === "plans") estimatePhotoBytes().then(setPhotoBytes); }, [tab]);
  useEffect(() => {
    writeJSON(K.utcOverride, utcOverride == null ? null : { phaseStart: phase.start, offset: utcOverride });
  }, [utcOverride, phase.start]);
  useEffect(() => saveStore("jobs", jobs), [jobs]);
  useEffect(() => saveStore("plans", plans), [plans]);
  useEffect(() => saveStore("events", events), [events]);
  useEffect(() => saveStore("weeks", weeks), [weeks]);
  useEffect(() => saveStore("ranks", ranks), [ranks]);
  useEffect(() => saveStore("marks", marks), [marks]);
  useEffect(() => writeJSON(K.log(todayKey), done), [todayKey, done]);

  // A slot counts as done for the day the moment everything due in it is —
  // vacuously, if nothing is due — folded into the same `done` object the
  // rest of the day's scoring already reads, so nothing downstream needs to
  // know admin tasks exist. The day's carried critical tasks ride along in
  // the same record purely so the Week tab can read history off the log
  // instead of re-guessing it from today's completions.
  useEffect(() => {
    const carried = tasks.filter((t) => t.critical)
      .filter((t) => taskStatus(t, adminCtx).carried)
      .map((t) => t.key);
    setDone((d) => {
      const prevCarried = d.adminCarriedCritical || [];
      const sameCarried = prevCarried.length === carried.length && prevCarried.every((k) => carried.includes(k));
      if (d["admin-am"] === amSummary.allDone && d["admin-pm"] === pmSummary.allDone && sameCarried) return d;
      return { ...d, "admin-am": amSummary.allDone, "admin-pm": pmSummary.allDone, adminCarriedCritical: carried };
    });
  }, [amSummary.allDone, pmSummary.allDone, adminCtx, tasks]);

  // One second, because the clock shows seconds. The heavy figures are memoised
  // on the date key rather than on `now`, so a tick is a repaint and not a
  // recount of the week. Paused while the app is in the background.
  useEffect(() => {
    const sync = () => {
      const fresh = new Date();
      if (dateKey(fresh) !== todayKey) {
        setDone(readLog(dateKey(fresh)));
        setLegOverride(null);
        setSheet(null);
      }
      setNow(fresh);
    };
    let id = setInterval(sync, 1000);
    const onVisible = () => {
      clearInterval(id);
      if (document.visibilityState === "visible") {
        sync();
        id = setInterval(sync, 1000);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [todayKey]);

  // Only so the button can say why it will not work. Nothing acts on this.
  useEffect(() => {
    const mark = () => setOnline(navigator.onLine);
    window.addEventListener("online", mark);
    window.addEventListener("offline", mark);
    return () => {
      window.removeEventListener("online", mark);
      window.removeEventListener("offline", mark);
    };
  }, []);

  // Paint the page behind the card so iOS rubber-band overscroll does not flash
  // white, and keep the installed app's status bar tint in step with the theme.
  useEffect(() => {
    document.documentElement.style.background = C.bg;
    document.body.style.background = C.bg;
    const meta = document.getElementById("theme-color");
    if (meta) meta.setAttribute("content", C.card);
  }, [C]);

  /* -------- the reading gate -------- */

  const isRead = (d) => read[d] ?? d < todayReadDay;

  // Ticking a reading opens the reflection instead of setting the flag. Today's
  // reading also carries the 05:35 item, so writing one closes both.
  const openReflection = (d) => { setSheet(d === readDay ? null : d); setBrowse(null); setTab("word"); };

  const saveReflection = (d, text) => {
    setReflect((r) => ({ ...r, [d]: text }));
    setRead((r) => ({ ...r, [d]: true }));
    if (d === todayReadDay) setDone((x) => ({ ...x, word: true }));
  };

  const clearReading = (d) => {
    setRead((r) => ({ ...r, [d]: false }));
    if (d === todayReadDay) setDone((x) => ({ ...x, word: false }));
  };

  /** An admin slot's tick is derived from its tasks, never set directly. */
  const openAdmin = (id) => { setTab("log"); setOpenAdminSlot(id === "admin-am" ? "am" : "pm"); };

  const toggle = (item) => {
    if (item.stood) return;
    // The reading stays reachable while previewing another leg: the sheet writes
    // against the reading day on screen, and only closes the 05:35 item when
    // that day is today's. Everything else stays read-only in a preview.
    if (item.id === "word") return openReflection(readDay);
    if (item.id === "admin-am" || item.id === "admin-pm") return openAdmin(item.id);
    if (item.id === "fuel-water") return previewing ? undefined : addWater();
    if (previewing) return;
    setDone((d) => ({ ...d, [item.id]: !d[item.id] }));
  };

  /** The band is the live day even mid-preview, so it writes to today's record. */
  const toggleNow = () => {
    if (!nowItem || nowItem.stood) return;
    if (nowItem.id === "word") return openReflection(todayReadDay);
    if (nowItem.id === "admin-am" || nowItem.id === "admin-pm") return openAdmin(nowItem.id);
    if (nowItem.id === "fuel-water") return addWater();
    setDone((d) => ({ ...d, [nowItem.id]: !d[nowItem.id] }));
  };

  /* -------- jobs, plans, weeks, ship's business -------- */

  const addJob = (fields) => setJobs((all) => [...all, makeJob(fields, todayKey)]);
  const setJob = (id, patch) => setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  // A pool item keeps its own id across the flip, which is what makes
  // pushing it back lossless — its photos are keyed by that same id.
  const pullFromPool = (id) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    setJob(id, { status: "open", created: todayKey, assignee: job.assignee || ranks[0] || "Self" });
  };
  const pushToPool = (id) => setJob(id, { status: "pooled" });

  // A defer is a logged reason, not a state change — the job stays open.
  const deferPsc = (id, reason) => {
    const entry = { date: todayKey, reason };
    setJob(id, { lastDeferral: entry });
    setPscDeferrals((m) => ({ ...m, [id]: [...(m[id] || []), entry] }));
  };

  // Quick capture: title and an optional photo, nothing else. The job is
  // built here (not via setJobs' updater) so its id is available
  // immediately for the photo write that follows.
  const quickCapture = (title) => {
    const job = makeJob({ title, assignee: ranks[0] || "Self", priority: "normal" }, todayKey);
    setJobs((all) => [...all, job]);
    return job;
  };

  const setReportProfile = (patch) => setReportProfileState((p) => ({ ...p, ...patch }));

  const purgePhotos = async () => {
    const n = await purgeOldPhotos(jobs, todayKey, 90);
    estimatePhotoBytes().then(setPhotoBytes);
    return n;
  };

  const exportPhotos = () => buildPhotoZip(jobs);

  const addPlan = (d) => setPlans((all) => [...all, {
    id: newId("plan"), title: d.title.trim(), notes: d.notes || "",
    target: d.target || null, source: d.source || null,
    status: "planned", created: todayKey,
  }]);
  const setPlan = (id, patch) => setPlans((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // A plan does not become a job; it puts one on the list and stays in the vault.
  const spawnJob = (plan) => {
    addJob({ title: plan.title, detail: plan.source ? `From the vault · ${plan.source}` : "From the vault", assignee: ranks[0] || "Self", priority: "normal", from: plan.id });
    setPlan(plan.id, { status: "active" });
    setTab("jobs");
  };

  /* -------- admin tasks -------- */

  // Ticking is a toggle, same as every other checkbox in the day: unticking
  // clears the completion outright, which is fine — the whole point of a
  // cadence task is that its cover is one date, not a history to preserve.
  const tickAdminTask = (t) => {
    const wasDone = t.doneToday;
    setAdminDone((m) => {
      if (wasDone) { const n = { ...m }; delete n[t.key]; return n; }
      return { ...m, [t.key]: todayKey };
    });
    if (wasDone) return;
    // A completion clears any deferral — the task is caught up, so the next
    // occurrence starts with its one day of grace intact again.
    setAdminDeferred((m) => {
      if (!(t.key in m)) return m;
      const n = { ...m };
      delete n[t.key];
      return n;
    });
    if (t.vaultPrompt) setVaultOffer({ title: `${t.title} — ${prettyDate(now)}` });
  };

  const deferAdminTask = (t) => {
    setAdminDeferred((m) => ({ ...m, [t.key]: dateKey(addDays(now, 1)) }));
    setOpenAdminTask(null);
  };

  // Hands the task to the engine room without touching its own cadence — a
  // job spawned from it is separate work, not a record of completion.
  const spawnJobFromTask = (t) => {
    addJob({ title: t.title, detail: t.detail, assignee: ranks[0] || "Self", priority: t.critical ? "urgent" : "normal" });
    setTab("jobs");
  };

  const declareEvent = (ev) => {
    setEvents((all) => [...all.filter((e) => e.date !== ev.date), ev]);
    setDeclaring(false);
  };
  const clearEvent = (dk) => setEvents((all) => all.filter((e) => e.date !== dk));

  /* -------- fasting -------- */

  const WATER_TARGET = 8;

  // A tap adds a glass — no undo, no cap. The tick just watches the count.
  const addWater = () => setDone((d) => {
    const count = (d.waterCount || 0) + 1;
    return { ...d, waterCount: count, "fuel-water": count >= WATER_TARGET };
  });

  const holdStage = () => setFasting((f) => ({ ...f, stagePin: fastingStage }));
  const stepBackStage = () => setFasting((f) => ({ ...f, stagePin: Math.max(1, fastingStage - 1) }));
  const resumeAuto = () => setFasting((f) => ({ ...f, stagePin: null }));
  const setBreakFastOnHiit = (on) => setFasting((f) => ({ ...f, breakFastOnHiit: on, hiitPromptShown: true }));
  const dismissHiitPrompt = () => setFasting((f) => ({ ...f, hiitPromptShown: true }));

  const prolongedGate = useMemo(() => canStartProlongedFast(todayKey, phases, events), [todayKey, phases, events]);

  const beginProlongedFast = () => {
    setProlongedFast({ active: true, date: todayKey, startedAt: now.toISOString() });
    setStartingFast(false);
  };

  // One tap, no confirmation, no judgement — ending early is not a failure
  // and is never recorded as one.
  const endProlongedFast = () => {
    if (!prolongedFast) return;
    const hours = prolongedElapsedHours(prolongedFast.startedAt, now);
    setProlongedFastLog((log) => [...log, { date: prolongedFast.date, hours: Math.round(hours * 10) / 10 }]);
    setProlongedFast(null);
  };

  const due = useMemo(() => dueSoon(plans, now), [plans, todayKey]);

  /* -------- the reading's text -------- */

  // Every chapter the rest of this phase will ask for. A port stay is
  // open-ended, so it carries six weeks and no more.
  const bibleRefs = useMemo(() => {
    const last = Math.min(lengthOf(phase), realDay + 44);
    const out = [];
    for (let d = realDay; d <= last; d++) {
      const p = dayPlan(readingDayOf(phase, d));
      for (const ref of [p.psalm, p.nt]) {
        const parsed = parseRef(ref);
        if (parsed) out.push(parsed);
      }
    }
    return out;
  }, [phase, realDay]);

  // What the reader is looking at: the day's two chapters, or a browsed one.
  const shownRefs = useMemo(() => {
    if (browse) {
      const b = books.find((x) => x.id === browse.book);
      return [{ book: browse.book, chapter: browse.chapter, label: `${b?.commonName || browse.book} ${browse.chapter}` }];
    }
    return [parseRef(plan.psalm), parseRef(plan.nt)].filter(Boolean);
  }, [browse, books, plan.psalm, plan.nt]);

  useEffect(() => {
    let alive = true;
    countCached(bibleRefs).then((n) => alive && setAboard((a) => ({ ...a, have: n, total: bibleRefs.length })));
    return () => { alive = false; };
  }, [bibleRefs, loading]);

  useEffect(() => { listBooks().then(setBooks); }, []);

  useEffect(() => { getQuotaInfo().then(setQuota); }, []);

  const carry = async (refs) => {
    setLoading({ done: 0, total: refs.length });
    // Six lanes: enough that 1,189 chapters is a minute rather than three,
    // few enough that a satellite link is not being asked to do something unkind.
    const tally = await fetchInto(refs, (p) => setLoading(p), { concurrency: 6 });
    setLoading(null);
    const have = await countCached(bibleRefs);
    setAboard({ have, total: bibleRefs.length, failed: tally.failed });
  };

  const carryThePassage = () => carry(bibleRefs);
  const carryTheBible = async () => {
    const list = books.length ? books : await listBooks();
    if (!books.length) setBooks(list);
    return carry(allRefs(list));
  };

  /* -------- pieces -------- */

  const seg = (v, label) => (
    <button onClick={() => setMode(v)} className="wb-t px-2.5 py-1 rounded-md" style={{
      fontFamily: F.ui, fontSize: 11, fontWeight: 500,
      background: mode === v ? C.sub : "transparent",
      color: mode === v ? C.text : C.dim,
      border: `1px solid ${mode === v ? C.line2 : "transparent"}`,
    }}>{label}</button>
  );

  const eyebrow = { fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 };

  const tick = (on, size = 20) => (
    <span className="shrink-0 rounded-full flex items-center justify-center wb-t"
      style={{ width: size, height: size, border: `1.5px solid ${on ? C.foam : C.ring}`, background: on ? C.foam : "transparent" }}>
      {on && <span style={{ color: dark ? "#0E1C22" : "#FFFFFF", fontSize: size * 0.6, lineHeight: 1 }}>✓</span>}
    </span>
  );

  /** The one line the whole app exists to answer. */
  const nowBand = () => {
    if (!nowItem) return null;
    const accent = C[TAGS[nowItem.tag].k];
    const on = !!done[nowItem.id];
    return (
      <div className="wb-t rounded-2xl overflow-hidden" style={{ background: C.sub, border: `1px solid ${on ? `${C.foam}55` : accent + "55"}` }}>
        <div className="flex items-center justify-between px-3 pt-2.5">
          <span style={{ ...eyebrow, color: accent }}>
            NOW · {pretty(nowItem.t)}{nowEnd ? ` → ${pretty(nowEnd)}` : ""}
          </span>
          <span style={eyebrow}>{previewing ? "LIVE · TODAY" : TAGS[nowItem.tag].n.toUpperCase()}</span>
        </div>
        <button onClick={toggleNow}
          className="wb-t w-full flex items-center gap-3 px-3 pb-3 pt-1.5 text-left">
          <span className="self-stretch rounded-full" style={{ width: 3, background: accent, opacity: on ? 0.35 : 0.9 }} />
          <span className="flex-1">
            <span className="block" style={{
              fontSize: wide ? 21 : 18, fontWeight: 600, letterSpacing: "-.01em",
              color: on ? C.dim : C.text, textDecoration: on ? "line-through" : "none", textDecorationColor: C.dim2,
            }}>{nowItem.label}</span>
            {nowItem.id === "word" && (
              <span className="block" style={{ fontFamily: F.serif, fontSize: 13, marginTop: 2, color: C.gold }}>
                {dayPlan(todayReadDay).psalm} · {dayPlan(todayReadDay).nt}
              </span>
            )}
            {nowItem.id === "trade" && (
              <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.dim }}>
                cash open {liveLeg.open} · hard stop {pretty(nowItem.endT)}
              </span>
            )}
          </span>
          {tick(on, 26)}
        </button>
        {upNext && (
          <div className="px-3 py-2" style={{ borderTop: `1px solid ${C.line}`, background: C.panel }}>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim2 }}>NEXT {pretty(upNext.t)}</span>
            <span style={{ fontSize: 12, marginLeft: 8, color: C.text2 }}>{upNext.label}</span>
          </div>
        )}
      </div>
    );
  };

  const clockBand = () => (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div style={eyebrow}>SHIP'S TIME</div>
          <div className="flex items-baseline gap-1.5" style={{ marginTop: 2 }}>
            <span style={{
              fontFamily: F.mono, fontSize: wide ? 56 : 46, fontWeight: 600,
              letterSpacing: "-.035em", lineHeight: 1, color: C.text,
              fontVariantNumeric: "tabular-nums",
            }}>
              {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
            </span>
            <span style={{
              fontFamily: F.mono, fontSize: wide ? 20 : 17, fontWeight: 500,
              color: C.dim, fontVariantNumeric: "tabular-nums",
            }}>
              {String(now.getSeconds()).padStart(2, "0")}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: ".08em", color: C.text2 }}>{clockDate(now)}</div>
          {leg.utc ? (
            <button onClick={() => setEditingUtc(!editingUtc)} className="wb-t" style={{
              fontFamily: F.mono, fontSize: 10.5, color: utcOverride != null ? C.oxide : C.amber, marginTop: 2,
            }}>
              UTC {leg.utc}{utcOverride != null ? " · manual" : ""}
            </button>
          ) : (
            <div style={{ fontFamily: F.mono, fontSize: 10.5, color: C.amber, marginTop: 2 }}>ALONGSIDE</div>
          )}
        </div>
      </div>
      {editingUtc && leg.utc && (
        <div className="wb-t rounded-2xl mt-3 p-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
          <div style={eyebrow}>ACTUAL UTC OFFSET ONBOARD</div>
          <select value={utcOverride ?? utcHoursOf(legs[autoLegIdx])} onChange={(e) => setUtcOverride(Number(e.target.value))}
            className="wb-t w-full rounded-xl mt-2 px-3" style={{
              fontFamily: F.mono, fontSize: 16, color: C.text, height: 44,
              background: C.card, border: `1px solid ${C.line2}`,
              WebkitAppearance: "none", colorScheme: dark ? "dark" : "light",
            }}>
            {UTC_CHOICES.map((v) => <option key={v} value={v}>{utcLabel(v)}</option>)}
          </select>
          {utcOverride != null && (
            <button onClick={() => setUtcOverride(null)} className="wb-t w-full rounded-xl mt-2 py-2"
              style={{ fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
              Reset to automatic
            </button>
          )}
          <div style={{ fontSize: 11.5, lineHeight: 1.4, marginTop: 8, color: C.dim2 }}>
            The passage assumes an even clock change from departure to arrival. If the ship actually
            changed clocks on a different day, set the real offset here — cash open and the label
            follow it until you change it again or reset to automatic.
          </div>
        </div>
      )}
    </div>
  );

  const voyageStrip = () => {
    if (!atSea) {
      return (
        <div>
          <div style={eyebrow}>{nameOf(phase).toUpperCase()}</div>
          <div className="flex items-baseline gap-2" style={{ marginTop: 4 }}>
            <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.03em", color: C.foam }}>Day {realDay}</span>
            <span style={{ fontSize: 12.5, color: C.dim }}>alongside</span>
          </div>
          <button onClick={() => onNewPhase("voyage")} className="wb-t w-full rounded-xl mt-3 py-2.5"
            style={{ fontSize: 13, fontWeight: 600, color: C.text2, background: "transparent", border: `1px solid ${C.line2}` }}>
            Put to sea — log the next passage
          </button>
        </div>
      );
    }
    const ends = endpointsOf(phase);
    // The one interior mark on the rail is whatever the passage has to say for
    // itself: the stretch with no session, or the Cape on a legacy passage.
    const marked = legs.find((l) => !l.trade) ?? legs.find((l) => /cape/i.test(l.name));
    const markAt = marked ? ((marked.d0 + marked.d1) / 2 / span) * 100 : null;
    return (
      <div>
        <div className="flex justify-between" style={{ ...eyebrow, letterSpacing: ".1em", marginBottom: 8 }}>
          <span>{(ends.from || "").toUpperCase()}</span>
          <span>{marked ? (marked.trade ? "CAPE" : "NO SESSION") : ""}</span>
          <span>{(ends.to || "").toUpperCase()}</span>
        </div>
        <div className="relative h-[3px] rounded-full" style={{ background: C.track }}>
          <div className="absolute h-[3px] rounded-full" style={{ width: `${progress}%`, background: C.foam }} />
          <div className="absolute -top-[3px] w-[9px] h-[9px] rounded-full" style={{ left: `calc(${progress}% - 4px)`, background: C.amber, boxShadow: dark ? "0 0 10px rgba(233,178,85,.7)" : "none" }} />
          {markAt !== null && (
            <div className="absolute -top-[2px] w-[1px] h-[7px]" style={{ left: `${markAt}%`, background: C.oxide }} />
          )}
        </div>
        <div className={`flex gap-1.5 mt-3 ${wide ? "flex-wrap" : "overflow-x-auto wb-x"}`} style={{ scrollbarWidth: "none" }}>
          {legs.map((l) => (
            <button key={l.id} onClick={() => setLegOverride(l.id === autoLegIdx ? null : l.id)} className="wb-t px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{
                fontSize: 11, fontWeight: 500,
                background: l.id === legIdx ? C.amber : "transparent",
                color: l.id === legIdx ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                border: `1px solid ${l.id === legIdx ? C.amber : C.line2}`,
              }}>{l.short}</button>
          ))}
        </div>
      </div>
    );
  };

  const completeBanner = () => (
    <div className="wb-t rounded-2xl p-4 mb-4" style={{ background: C.sub, border: `1px solid ${C.oxide}66` }}>
      <div style={{ ...eyebrow, color: C.oxide }}>PASSAGE COMPLETE</div>
      <div style={{ fontSize: 14, lineHeight: 1.4, marginTop: 4, color: C.text }}>
        Day {span} of {span} is logged out. The day keeps its shape until you say what the ship is doing.
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onNewPhase("port")} className="wb-t flex-1 rounded-xl py-2.5"
          style={{ fontSize: 13, fontWeight: 600, background: C.amber, color: dark ? "#0E1C22" : "#FFFFFF", border: `1px solid ${C.amber}` }}>
          Go alongside
        </button>
        <button onClick={() => onNewPhase("voyage")} className="wb-t flex-1 rounded-xl py-2.5"
          style={{ fontSize: 13, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
          Next passage
        </button>
      </div>
    </div>
  );

  /* -------- tabs -------- */

  /** Declaring, or standing down, today's ship's business. */
  const eventPanel = () => {
    const [d, setD] = [declaring, setDeclaring];
    if (event) {
      return (
        <div className="wb-t rounded-2xl p-3 mb-3" style={{ background: C.sub, border: `1px solid ${C.oxide}66` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div style={{ ...eyebrow, color: C.oxide }}>SHIP'S BUSINESS — {event.type.toUpperCase()}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.4, marginTop: 3, color: C.text }}>
                {event.start} for {event.hours} h{event.note ? ` · ${event.note}` : ""}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.4, marginTop: 3, color: C.dim }}>
                Suspended work is not owed. The day scores out of what is left.
              </div>
            </div>
            <button onClick={() => clearEvent(shownKey)} className="wb-t shrink-0 rounded-lg px-2.5 py-1.5"
              style={{ fontSize: 11.5, color: C.text2, border: `1px solid ${C.line2}` }}>Stand down</button>
          </div>
        </div>
      );
    }
    if (!d) {
      return (
        <button onClick={() => setD({ date: shownKey, type: "Arrival", start: "06:00", hours: "4", note: "" })}
          className="wb-t w-full rounded-xl py-2.5 mb-3"
          style={{ fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
          Declare ship's business
        </button>
      );
    }
    const ok = d.date && d.start && Number(d.hours) > 0;
    const fld = {
      fontFamily: F.mono, fontSize: 16, color: C.text, height: 44,
      background: C.sub, border: `1px solid ${C.line2}`,
      WebkitAppearance: "none", colorScheme: dark ? "dark" : "light",
      minWidth: 0,
    };
    return (
      <div className="wb-t rounded-2xl p-4 mb-3" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
        <div style={eyebrow}>SHIP'S BUSINESS</div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {EVENT_TYPES.map((t) => (
            <button key={t} onClick={() => setD({ ...d, type: t })} className="wb-t px-2.5 py-1 rounded-full"
              style={{
                fontSize: 11.5, fontWeight: 500,
                background: d.type === t ? C.oxide : "transparent",
                color: d.type === t ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                border: `1px solid ${d.type === t ? C.oxide : C.line2}`,
              }}>{t}</button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex-[1.3] min-w-0">
            <div style={eyebrow}>DATE</div>
            <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })}
              className="wb-t w-full rounded-xl mt-1 px-3" style={fld} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={eyebrow}>START</div>
            <input type="time" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })}
              className="wb-t w-full rounded-xl mt-1 px-3" style={fld} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={eyebrow}>HOURS</div>
            <input type="number" inputMode="decimal" min="0.5" step="0.5" value={d.hours}
              onChange={(e) => setD({ ...d, hours: e.target.value })}
              className="wb-t w-full rounded-xl mt-1 px-3" style={fld} />
          </div>
        </div>
        <input type="text" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })}
          placeholder="Note — optional" autoCapitalize="sentences"
          className="wb-t w-full rounded-xl mt-2 px-3" style={{ ...fld, fontFamily: F.ui, height: 42, fontSize: 14 }} />
        <div className="flex gap-2 mt-3">
          <button onClick={() => setD(false)} className="wb-t flex-1 rounded-xl py-2.5"
            style={{ fontSize: 13, color: C.dim, border: `1px solid ${C.line2}` }}>Cancel</button>
          <button onClick={() => ok && declareEvent({ ...d, hours: Number(d.hours) })} disabled={!ok}
            className="wb-t flex-1 rounded-xl py-2.5" style={{
              fontSize: 13, fontWeight: 600,
              background: ok ? C.oxide : "transparent",
              color: ok ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim2,
              border: `1px solid ${ok ? C.oxide : C.line2}`,
            }}>Declare</button>
        </div>
      </div>
    );
  };

  /** One admin task's row — same expand-in-place pattern as an exercise
      figure: tap the label to open detail and note, one row open at a time. */
  const adminTaskRow = (t) => {
    const isOpen = openAdminTask === t.key;
    const warn = t.critical && t.carried;
    return (
      <div key={t.key}>
        <div className="flex items-center gap-2.5 py-1.5">
          <button onClick={() => tickAdminTask(t)} className="wb-t shrink-0" aria-label={t.title}>
            {tick(t.doneToday, 18)}
          </button>
          <button onClick={() => setOpenAdminTask(isOpen ? null : t.key)} className="wb-t flex-1 text-left">
            <span style={{
              fontSize: 13.5, color: t.doneToday ? C.dim : C.text,
              textDecoration: t.doneToday ? "line-through" : "none", textDecorationColor: C.dim2,
            }}>{t.title}</span>
            {(t.counter || warn) && (
              <span className="block" style={{ fontFamily: F.mono, fontSize: 10, marginTop: 1, color: C.oxide }}>
                {[t.counter, warn ? "carried — compliance" : null].filter(Boolean).join(" · ")}
              </span>
            )}
          </button>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim2 }}>{t.est}m</span>
        </div>
        {isOpen && (
          <div className="wb-t rounded-xl mb-1.5 px-3 py-2.5" style={{ marginLeft: 28, background: C.panel, border: `1px solid ${C.line2}` }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.text2 }}>{t.detail}</div>
            {t.note && <div style={{ fontSize: 11.5, lineHeight: 1.4, marginTop: 4, color: C.dim }}>{t.note}</div>}
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => spawnJobFromTask(t)} className="wb-t flex-1 rounded-lg py-1.5"
                style={{ fontSize: 11.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
                Send to the job list
              </button>
              {t.canDefer && (
                <button onClick={() => deferAdminTask(t)} className="wb-t flex-1 rounded-lg py-1.5"
                  style={{ fontSize: 11.5, fontWeight: 600, color: C.dim, border: `1px solid ${C.line2}` }}>
                  Defer to tomorrow
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /** A slot's row in the day's list: header ticks itself off automatically
      once everything due inside it is done, and expands to the tasks. */
  const adminSlotRow = (item, slot, summary) => {
    const isOpen = openAdminSlot === slot;
    const accent = C[TAGS[item.tag].k];
    return (
      <div key={item.id}>
        <button onClick={() => setOpenAdminSlot(isOpen ? null : slot)}
          className="wb-t w-full flex items-center gap-3 py-2.5 px-2 rounded-xl text-left"
          style={{ background: isOpen || summary.allDone ? C.sub : "transparent", opacity: item.stood ? 0.5 : 1 }}>
          <span style={{ fontFamily: F.mono, fontSize: 12, width: 38, color: C.text2 }}>{pretty(item.t)}</span>
          <span className="self-stretch rounded-full" style={{ width: 3, background: accent, opacity: summary.allDone ? 0.35 : 0.9 }} />
          <span className="flex-1">
            <span style={{
              fontSize: wide ? 15 : 14, color: summary.allDone ? C.dim : C.text,
              textDecoration: summary.allDone ? "line-through" : "none", textDecorationColor: C.dim2,
            }}>{item.label}</span>
            <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: summary.overWindow ? C.oxide : C.dim2 }}>
              {summary.total} task{summary.total === 1 ? "" : "s"} · {summary.minutes} min
              {summary.overWindow ? " · over the window" : ""}
            </span>
            {item.stood && (
              <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.oxide }}>
                suspended — {item.why}
              </span>
            )}
          </span>
          {tick(summary.allDone)}
        </button>
        {isOpen && (
          <div className="px-2 pb-3">
            {summary.due.length === 0 && (
              <div style={{ fontSize: 12.5, color: C.dim, padding: "4px 0" }}>Nothing due in this slot today.</div>
            )}
            {summary.due.map(adminTaskRow)}
            {summary.comingUp.length > 0 && (
              <div style={{ marginTop: summary.due.length ? 8 : 0 }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: ".1em", color: C.dim2 }}>COMING UP</div>
                {summary.comingUp.map((t) => (
                  <div key={t.key} className="flex items-baseline gap-2 py-1">
                    <span className="flex-1" style={{ fontSize: 12.5, color: C.dim }}>{t.title}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.amber }}>{t.est}m</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /** Ship's business, when it lands: the checklist it triggers jumps the
      queue, ahead of both slots and whatever the schedule says the hour is. */
  const adminTriggerBanner = () => triggerTasks.length > 0 && (
    <div className="wb-t rounded-2xl p-3 mb-3" style={{ background: C.sub, border: `1px solid ${C.oxide}` }}>
      <div style={{ ...eyebrow, color: C.oxide }}>SHIP'S BUSINESS — {triggerTasks[0].trigger.toUpperCase()}</div>
      {triggerTasks.map(adminTaskRow)}
    </div>
  );

  const vaultOfferBanner = () => vaultOffer && (
    <div className="wb-t rounded-2xl p-3 mb-3" style={{ background: C.sub, border: `1px solid ${C.foam}66` }}>
      <div style={{ ...eyebrow, color: C.foam }}>ADD TO THE VAULT?</div>
      <div style={{ fontSize: 13, lineHeight: 1.4, marginTop: 3, color: C.text }}>{vaultOffer.title}</div>
      <div className="flex gap-2 mt-2.5">
        <button onClick={() => { addPlan({ title: vaultOffer.title, source: "Own" }); setVaultOffer(null); setTab("plans"); }}
          className="wb-t flex-1 rounded-lg py-2"
          style={{ fontSize: 12.5, fontWeight: 600, background: C.foam, color: dark ? "#0E1C22" : "#FFFFFF", border: `1px solid ${C.foam}` }}>
          Add
        </button>
        <button onClick={() => setVaultOffer(null)} className="wb-t flex-1 rounded-lg py-2"
          style={{ fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
          Skip
        </button>
      </div>
    </div>
  );

  /** The water counter's row: a tap adds a glass, no undo, no cap past the
      target. The tick just reflects whether the target has been reached. */
  const fuelWaterRow = (item) => {
    const count = done.waterCount || 0;
    const on = count >= WATER_TARGET;
    const accent = C[TAGS[item.tag].k];
    return (
      <button key={item.id} onClick={() => !previewing && !item.stood && addWater()}
        className="wb-t w-full flex items-center gap-3 py-2.5 px-2 rounded-xl text-left"
        style={{ background: on ? C.sub : "transparent", opacity: item.stood || previewing ? 0.5 : 1 }}>
        <span style={{ fontFamily: F.mono, fontSize: 12, width: 38, color: C.text2 }}>{pretty(item.t)}</span>
        <span className="self-stretch rounded-full" style={{ width: 3, background: accent, opacity: on ? 0.35 : 0.9 }} />
        <span className="flex-1">
          <span style={{ fontSize: wide ? 15 : 14, color: on ? C.dim : C.text }}>{item.label}</span>
          <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: item.stood ? C.oxide : on ? C.foam : C.dim2 }}>
            {item.stood ? `suspended — ${item.why}` : `${count}/${WATER_TARGET} glasses — tap to add one`}
          </span>
        </span>
        {tick(on)}
      </button>
    );
  };

  /** The single most useful thing on the day's screen: fasting, open, ship's
      business, or a prolonged fast running instead of the ordinary cycle. */
  const windowBand = () => {
    if (prolongedActive) {
      const hrs = prolongedElapsedHours(prolongedFast.startedAt, now);
      return (
        <div className="wb-t rounded-2xl overflow-hidden mb-3" style={{ background: C.sub, border: `1px solid ${C.fuel}` }}>
          <div className="flex items-center justify-between px-3 pt-2.5">
            <span style={{ ...eyebrow, color: C.fuel }}>PROLONGED FAST</span>
            <span style={eyebrow}>{hrs >= PROLONGED_CAP_HOURS ? "CAP REACHED" : `CAP ${PROLONGED_CAP_HOURS} H`}</span>
          </div>
          <div className="px-3 pb-3 pt-1">
            <div style={{ fontSize: wide ? 30 : 26, fontWeight: 700, letterSpacing: "-.03em", color: C.text }}>
              {hrs.toFixed(1)} h elapsed
            </div>
            <button onClick={endProlongedFast} className="wb-t w-full rounded-xl mt-3 py-3"
              style={{ fontSize: 14, fontWeight: 600, background: C.fuel, color: dark ? "#0E1C22" : "#FFFFFF", border: `1px solid ${C.fuel}` }}>
              End fast
            </button>
          </div>
        </div>
      );
    }
    const state = windowState(now, fastingWindow, windowSuspended);
    const accent = state.phase === "suspended" ? C.dim : state.phase === "open" ? C.foam : C.fuel;
    return (
      <div className="wb-t rounded-2xl overflow-hidden mb-3" style={{ background: C.sub, border: `1px solid ${accent}66` }}>
        <div className="px-3 pt-2.5">
          <span style={{ ...eyebrow, color: accent }}>{state.label.toUpperCase()}</span>
        </div>
        <div className="px-3 pb-3 pt-1">
          <div style={{ fontSize: wide ? 21 : 18, fontWeight: 600, letterSpacing: "-.01em", color: C.text }}>
            {state.phase === "suspended" ? state.detail : `${state.label} — ${state.detail}`}
          </div>
          {state.phase !== "suspended" && (
            <div style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 3, color: C.dim }}>
              stage {fastingStage} of 3{fasting.stagePin ? " · held" : ""}
            </div>
          )}
        </div>
      </div>
    );
  };

  /** Deliberately the only path in: a checklist, and one explicit tap past
      it. Nothing about ending a fast goes through anything like this. */
  const prolongedChecklist = () => startingFast && (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3"
      style={{ background: dark ? "rgba(4,10,13,.72)" : "rgba(16,38,46,.42)" }}
      onClick={() => setStartingFast(false)}>
      <div className="wb-t w-full max-w-md rounded-[22px] overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.line2}`, boxShadow: C.shadow }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div style={{ ...eyebrow, color: C.fuel }}>BEFORE YOU START</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", color: C.text, marginTop: 4 }}>
            24-hour fast
          </div>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {[
            "No training, no trading, no port operations today.",
            "Electrolytes with water throughout, sodium included.",
            "Stop immediately on dizziness, confusion or an odd heart rate.",
            "No engine room work aloft or in confined spaces.",
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, marginTop: 6, background: C.fuel }} />
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: C.text2 }}>{line}</span>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={() => setStartingFast(false)} className="wb-t flex-1 rounded-xl py-2.5"
            style={{ fontSize: 13, color: C.dim, border: `1px solid ${C.line2}` }}>
            Not today
          </button>
          <button onClick={beginProlongedFast} className="wb-t flex-1 rounded-xl py-2.5"
            style={{ fontSize: 13, fontWeight: 600, background: C.fuel, color: dark ? "#0E1C22" : "#FFFFFF", border: `1px solid ${C.fuel}` }}>
            Understood — begin
          </button>
        </div>
      </div>
    </div>
  );

  const dueBanner = () => due.length > 0 && (
    <div className="wb-t rounded-2xl p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line2}` }}>
      <div style={{ ...eyebrow, color: due.some((p) => p.overdue) ? C.oxide : C.amber }}>
        COMING UP FROM THE VAULT
      </div>
      {due.slice(0, 4).map((p) => (
        <button key={p.id} onClick={() => setTab("plans")} className="wb-t w-full flex items-baseline gap-2 py-1 text-left">
          <span className="flex-1" style={{ fontSize: 13, color: C.text }}>{p.title}</span>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: p.overdue ? C.oxide : C.dim }}>
            {p.overdue ? "overdue" : p.target}
          </span>
        </button>
      ))}
    </div>
  );

  const logTab = () => (
    <div className="space-y-0.5">
      {prolongedChecklist()}
      {windowBand()}
      {adminTriggerBanner()}
      {dueBanner()}
      {recovery && (
        <div className="wb-t rounded-2xl p-3 mb-3" style={{ background: C.sub, border: `1px solid ${C.amber}66` }}>
          <div style={{ ...eyebrow, color: C.amber }}>RECOVERY DAY</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 3, color: C.text }}>
            {recovery.from} ran past midnight. The morning is {recovery.lost} h later, and the
            session and the desk are stood down. This is not a day you lost.
          </div>
        </div>
      )}
      {eventPanel()}
      {vaultOfferBanner()}
      {items.map((i) => {
        if (i.id === "admin-am") return adminSlotRow(i, "am", amSummary);
        if (i.id === "admin-pm") return adminSlotRow(i, "pm", pmSummary);
        if (i.id === "fuel-water") return fuelWaterRow(i);
        // While previewing another leg the log is read-only: ticking a day
        // that has not happened yet would pre-fill its record.
        const isDone = previewing ? false : !!done[i.id];
        const accent = C[TAGS[i.tag].k];
        const isNow = !previewing && nowItem && i.id === nowItem.id;
        return (
          <button key={i.id} onClick={() => toggle(i)}
            className="wb-t w-full flex items-center gap-3 py-2.5 px-2 rounded-xl text-left"
            style={{
              background: isNow ? C.sub : isDone ? C.sub : "transparent",
              border: `1px solid ${isNow ? accent + "66" : "transparent"}`,
              opacity: i.stood || previewing ? 0.5 : 1,
            }}>
            <span style={{ fontFamily: F.mono, fontSize: 12, width: 38, color: isNow ? accent : isDone ? C.dim2 : C.text2 }}>{pretty(i.t)}</span>
            <span className="self-stretch rounded-full" style={{ width: 3, background: accent, opacity: isDone ? 0.35 : 0.9 }} />
            <span className="flex-1">
              <span style={{ fontSize: wide ? 15 : 14, color: isDone ? C.dim : C.text, textDecoration: isDone ? "line-through" : "none", textDecorationColor: C.dim2 }}>{i.label}</span>
              {i.id === "evening" && (
                <span className="block" style={{ fontSize: 12.5, marginTop: 2, color: C.text2 }}>
                  {eveningFor(shownDate)}
                </span>
              )}
              {i.id === "vespers" && !previewing && (
                <span className="block" style={{ marginTop: 4 }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setDone((d) => ({ ...d, phoneOut: !d.phoneOut })); }}
                    className="wb-t inline-flex items-center gap-1.5 rounded-md px-2 py-0.5"
                    style={{
                      fontFamily: F.mono, fontSize: 9.5, letterSpacing: ".08em",
                      color: done.phoneOut ? (dark ? "#0E1C22" : "#FFFFFF") : C.dim,
                      background: done.phoneOut ? C.foam : "transparent",
                      border: `1px solid ${done.phoneOut ? C.foam : C.line2}`,
                    }}>
                    PHONE OUT {done.phoneOut ? "YES" : "NO"}
                  </span>
                </span>
              )}
              {i.id === "word" && (
                <>
                  <span className="block" style={{ fontFamily: F.serif, fontSize: 12.5, marginTop: 2, color: C.gold }}>{plan.psalm} · {plan.nt}</span>
                  <span className="block truncate" style={{ fontFamily: F.serif, fontSize: 11.5, marginTop: 1, color: C.dim, fontStyle: "italic", maxWidth: wide ? 460 : 200 }}>
                    {reflect[readDay] ? reflect[readDay] : "reflection required to log this"}
                  </span>
                </>
              )}
              {i.id === "trade" && !i.stood && (
                <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.dim }}>
                  checklist {pretty(i.t)} · cash open {leg.open} · hard stop {pretty(i.endT)}
                </span>
              )}
              {i.id === "trade" && i.stood && (
                <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.oxide }}>
                  no session — {i.why || leg.why}
                </span>
              )}
              {i.stood && i.id !== "trade" && (
                <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.oxide }}>
                  suspended — {i.why}
                </span>
              )}
              {i.movedFor && (
                <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.amber }}>
                  moved clear of the {i.movedFor.toLowerCase()}
                </span>
              )}
              {i.shifted && (
                <span className="block" style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 2, color: C.amber }}>
                  later, after the night
                </span>
              )}
            </span>
            {i.id === "trade" && leg.prime && !i.stood && (
              <span className="wb-t px-2 py-0.5 rounded-md shrink-0" style={{ fontSize: 9.5, fontWeight: 600, color: C.foam, background: dark ? "#12302B" : "#E4F1ED", border: `1px solid ${C.foam}40` }}>
                PRIME
              </span>
            )}
            {tick(isDone)}
          </button>
        );
      })}
    </div>
  );

  // The reading day on screen: today's, unless a row in the plan list sent us
  // to another one. Reset by the day rolling over, like every other override.
  const shownReadDay = sheet ?? readDay;
  const shownPlan = dayPlan(shownReadDay);

  const wordTab = () => (
    <div>
      <WordTab
        C={C} dark={dark} wide={wide}
        plan={shownPlan} readDay={shownReadDay}
        isRead={isRead(shownReadDay)} reflection={reflect[shownReadDay]} marks={marks}
        onReflect={(d, text) => setReflect((r) => ({ ...r, [d]: text }))}
        onRead={(d, text) => saveReflection(d, text)}
        onUnread={(d) => clearReading(d)}
        onMarks={setMarks}
        refs={shownRefs} aboard={aboard} loading={loading} online={online}
        onCarry={carryThePassage} onCarryAll={carryTheBible}
        books={books} browse={browse} onBrowse={setBrowse}
      />

      <div style={{ ...eyebrow, margin: "16px 0 6px" }}>THE PASSAGE</div>
      {Array.from({ length: 8 }, (_, k) => readDay - 2 + k).filter((d) => d >= 1).map((d) => {
        const p = dayPlan(d);
        const done_ = isRead(d);
        return (
          <button key={d} onClick={() => { setSheet(d === shownReadDay ? null : d); setBrowse(null); }}
            className="wb-t w-full flex items-center gap-3 py-2.5 px-2 rounded-xl text-left"
            style={{ background: d === shownReadDay ? C.sub : "transparent" }}>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, width: 30, color: d === readDay ? C.amber : C.dim2 }}>
              D{String(d).padStart(2, "0")}
            </span>
            <span className="flex-1" style={{ fontFamily: F.serif, fontSize: 14, color: done_ ? C.dim : C.text }}>
              {p.psalm} · {p.nt}
            </span>
            {reflect[d] && <span style={{ fontFamily: F.serif, fontSize: 11, color: C.dim2 }}>✎</span>}
            <span className="shrink-0 rounded-full" style={{
              width: 15, height: 15,
              border: `1.5px solid ${done_ ? C.gold : C.ring}`,
              background: done_ ? C.gold : "transparent",
            }} />
          </button>
        );
      })}
    </div>
  );

  const scoreTab = () => (
    <div>
      <div className={wide ? "flex gap-3 mb-3 items-stretch" : ""}>
        <div className="wb-t rounded-2xl p-5 mb-3 text-center" style={{
          background: C.sub, border: `1px solid ${C.line2}`,
          ...(wide ? { flex: "0 0 210px" } : {}),
        }}>
          <div style={eyebrow}>ROLLING SEVEN DAYS</div>
          <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: "-.04em", lineHeight: 1.02, marginTop: 4, color: C.foam }}>
            {r7 ? r7.pct : "—"}{r7 && <span style={{ fontSize: 26, fontWeight: 600 }}>%</span>}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 2, color: C.text2 }}>{hit} of {todayDoable.length} logged today</div>
        </div>
        <div className={wide ? "grid grid-cols-3 gap-3 flex-1" : "grid grid-cols-2 gap-2 mb-3"}>
          {[
            ["Grace days", String(grace.left), "left this week", grace.left === 0 ? C.oxide : C.amber],
            ["On plan", plan7 ? `${plan7.hit}/${plan7.total}` : "—", "sessions to rule", C.foam],
            ["Trained", `${trained}/${trainDue}`, "sessions this week", trained ? C.foam : C.dim],
            ["Jobs", `${jobFigure.done}/${jobFigure.total || 0}`, `${jobFigure.carried} carried`, C.amber],
            ["Admin", `${adminFigure.done}/${adminFigure.total || 0}`, `${adminFigure.carried} carried`, adminFigure.carried ? C.oxide : C.amber],
            ["Window", windowFigure ? `${windowFigure.hit}/${windowFigure.total}` : "—", "kept this week", C.fuel],
            ["PSC", pscReady.total ? `${pscReady.closed}/${pscReady.total}` : "—", "readiness",
              pscReady.total > 0 && pscReady.closed === pscReady.total ? C.foam : C.oxide],
          ].map(([t, v, s, col]) => (
            <div key={t} className="wb-t rounded-2xl p-4" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
              <div style={{ ...eyebrow, letterSpacing: ".1em" }}>{t.toUpperCase()}</div>
              <div style={{ fontSize: wide ? 27 : 23, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.05, marginTop: 4, color: col }}>{v}</div>
              <div style={{ fontSize: 10.5, lineHeight: 1.3, color: C.dim }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={wide ? "grid grid-cols-2 gap-3 items-start" : ""}>
        <div className="wb-t rounded-2xl p-4" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
          <div style={{ ...eyebrow, marginBottom: 6 }}>BY THREAD</div>
          {Object.entries(TAGS).map(([k, v]) => {
            const n = todayDoable.filter((i) => i.tag === k);
            const h = n.filter((i) => done[i.id]).length;
            return (
              <div key={k} className="flex items-center gap-3 py-1.5">
                <span style={{ fontSize: 12.5, width: 48, color: C.text2 }}>{v.n}</span>
                <span className="flex-1 rounded-full" style={{ height: 5, background: C.track }}>
                  <span className="block rounded-full" style={{ height: 5, width: `${n.length ? (h / n.length) * 100 : 0}%`, background: C[v.k] }} />
                </span>
                <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>{h}/{n.length}</span>
              </div>
            );
          })}
        </div>

        <div className="wb-t rounded-2xl p-4 mt-3" style={{ background: C.sub, border: `1px solid ${C.line2}`, marginTop: wide ? 0 : undefined }}>
          <div style={{ ...eyebrow, marginBottom: 6 }}>STANDING ORDERS</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{nameOf(phase)}</div>
          <button onClick={onEditPhase} className="wb-t text-left" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 2, color: C.dim2 }}>
            {atSea ? "Departed" : "Alongside since"} {prettyDate(parseKey(phase.start))} · <span style={{ color: C.text2 }}>change</span>
          </button>
          <button onClick={() => onNewPhase(atSea ? "port" : "voyage")} className="wb-t w-full rounded-xl mt-3 py-2.5"
            style={{ fontSize: 13, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
            {atSea ? "Log arrival — go alongside" : "Put to sea — next passage"}
          </button>

          <div style={{ ...eyebrow, marginTop: 16, marginBottom: 6 }}>WHO THE JOBS GO TO</div>
          <div className="flex flex-wrap gap-1.5">
            {ranks.map((r) => (
              <span key={r} className="wb-t inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ fontSize: 11.5, color: C.text2, border: `1px solid ${C.line2}` }}>
                {r}
                <button onClick={() => setRanks(ranks.filter((x) => x !== r))}
                  style={{ fontSize: 12, lineHeight: 1, color: C.dim2 }} aria-label={`Remove ${r}`}>×</button>
              </span>
            ))}
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.target).get("rank").toString().trim();
            if (v && !ranks.includes(v)) setRanks([...ranks, v]);
            e.target.reset();
          }} className="flex gap-2 mt-2">
            <input name="rank" type="text" placeholder="Add a rank" autoCapitalize="characters" autoCorrect="off"
              className="wb-t flex-1 rounded-xl px-3" style={{
                fontFamily: F.ui, fontSize: 16, color: C.text, height: 40, minWidth: 0,
                background: C.card, border: `1px solid ${C.line2}`,
              }} />
            <button type="submit" className="wb-t rounded-xl px-4"
              style={{ fontSize: 13, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>Add</button>
          </form>
          {ranks.length === 0 && (
            <button onClick={() => setRanks(DEFAULT_RANKS)} className="wb-t w-full mt-2"
              style={{ fontSize: 12, color: C.dim }}>Restore the standard list</button>
          )}
        </div>
      </div>

      <div className={wide ? "grid grid-cols-2 gap-3 items-start" : ""} style={{ marginTop: 12 }}>
        <div className="wb-t rounded-2xl p-4" style={{ background: C.sub, border: `1px solid ${C.line2}` }}>
          <div style={{ ...eyebrow, marginBottom: 6 }}>FASTING RAMP</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            Stage {fastingStage} of 3 — window {pretty(fastingWindow.open)}–{pretty(fastingWindow.close)}
          </div>
          <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 2 }}>
            {fasting.stagePin ? "Held manually" : `Started ${prettyDate(parseKey(fasting.startDate))}`}
          </div>
          <div className="flex gap-2 mt-3">
            {fasting.stagePin ? (
              <>
                {fastingStage > 1 && (
                  <button onClick={stepBackStage} className="wb-t flex-1 rounded-xl py-2"
                    style={{ fontSize: 12.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
                    Step back one
                  </button>
                )}
                <button onClick={resumeAuto} className="wb-t flex-1 rounded-xl py-2"
                  style={{ fontSize: 12.5, color: C.dim, border: `1px solid ${C.line2}` }}>
                  Resume the ramp
                </button>
              </>
            ) : (
              <button onClick={holdStage} className="wb-t flex-1 rounded-xl py-2"
                style={{ fontSize: 12.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
                Hold at this stage
              </button>
            )}
          </div>

          <div style={{ ...eyebrow, marginTop: 16, marginBottom: 4 }}>FASTED TRAINING</div>
          <button onClick={() => setBreakFastOnHiit(!fasting.breakFastOnHiit)}
            className="wb-t w-full flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{ border: `1px solid ${C.line2}`, background: fasting.breakFastOnHiit ? C.panel : "transparent" }}>
            <span style={{ fontSize: 13, color: C.text2 }}>Break fast after training on HIIT days</span>
            <span className="shrink-0 rounded-full" style={{
              width: 34, height: 20, background: fasting.breakFastOnHiit ? C.fuel : C.track, position: "relative",
            }}>
              <span className="absolute rounded-full" style={{
                width: 16, height: 16, top: 2, left: fasting.breakFastOnHiit ? 16 : 2,
                background: C.sub, transition: "left .15s ease",
              }} />
            </span>
          </button>
          {hiitPrompt && (
            <div className="wb-t rounded-xl mt-2 p-3" style={{ background: C.panel, border: `1px solid ${C.fuel}66` }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: C.text2 }}>
                A HIIT session or two has felt hard fasted lately. Break the fast after training on
                those days?
              </div>
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => setBreakFastOnHiit(true)} className="wb-t flex-1 rounded-lg py-2"
                  style={{ fontSize: 12, fontWeight: 600, background: C.fuel, color: dark ? "#0E1C22" : "#FFFFFF", border: `1px solid ${C.fuel}` }}>
                  Turn it on
                </button>
                <button onClick={dismissHiitPrompt} className="wb-t flex-1 rounded-lg py-2"
                  style={{ fontSize: 12, color: C.dim, border: `1px solid ${C.line2}` }}>
                  Not now
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="wb-t rounded-2xl p-4 mt-3" style={{ background: C.sub, border: `1px solid ${C.line2}`, marginTop: wide ? 0 : undefined }}>
          <div style={{ ...eyebrow, marginBottom: 6 }}>PROLONGED FAST</div>
          {prolongedActive ? (
            <div style={{ fontSize: 12.5, color: C.dim }}>Running — see the Day tab.</div>
          ) : prolongedGate.ok ? (
            <button onClick={() => setStartingFast(true)} className="wb-t w-full rounded-xl py-2.5"
              style={{ fontSize: 13, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}` }}>
              Start a prolonged fast
            </button>
          ) : (
            <div style={{ fontSize: 12.5, color: C.dim }}>{prolongedGate.reason}</div>
          )}
          {prolongedFastLog.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {prolongedFastLog.slice().reverse().map((f, i) => (
                <div key={i} className="flex items-baseline gap-2 py-1" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                  <span className="flex-1" style={{ fontSize: 13, color: C.text2 }}>{f.date}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: C.dim }}>{f.hours} h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 12, padding: "0 4px", color: C.dim }}>
        A missed day costs a grace day, not the record. Sunday closes the week with the journal review.
      </div>
    </div>
  );

  /* -------- shell -------- */

  const masthead = () => (
    <div className="px-5 pt-5 pb-4 wb-t" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: ".14em", color: C.dim }}>MV QUEEN TRADER</span>
        <div className="flex gap-0.5">{seg("auto", "Auto")}{seg("light", "Light")}{seg("dark", "Dark")}</div>
      </div>
      <div className="flex items-baseline justify-between mt-2">
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.024em", color: C.text }}>Watchbell</span>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: ".05em", color: C.text2, marginTop: 2 }}>
        {atSea
          ? `Day ${String(day).padStart(2, "0")} of ${span} · ${leg.name}`
          : `Day ${String(realDay).padStart(2, "0")} alongside · ${phase.port || "in port"}`}
      </div>
    </div>
  );

  const rail = (
    <>
      {masthead()}
      <div className="px-5 py-4 wb-t" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
        {clockBand()}
        <div className="mt-3">{nowBand()}</div>
      </div>
      <div className="px-5 py-4 wb-t" style={{ borderBottom: wide ? "none" : `1px solid ${C.line}` }}>
        {voyageStrip()}
      </div>
    </>
  );

  const main = (
    <>
      <div className="flex wb-t shrink-0" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[["log", "Day"], ["body", "Body"], ["jobs", "Jobs"], ["word", "Word"],
          ["week", "Week"], ["plans", "Plans"], ["score", "Standing"]].map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)} className="flex-1 py-3 wb-t"
            style={{ fontSize: wide ? 13 : 12.5, fontWeight: tab === k ? 600 : 500, color: tab === k ? C.text : C.dim, borderBottom: `2px solid ${tab === k ? C.amber : "transparent"}` }}>
            {n}
          </button>
        ))}
      </div>
      <div className={`flex-1 px-4 py-4 ${wide ? "overflow-y-auto wb-x min-h-0" : ""}`}>
        {complete && completeBanner()}
        {tab === "log" && logTab()}
        {/* Kept mounted rather than swapped out: a stray tap on another tab
            must not throw away a session that is running. */}
        <div style={{ display: tab === "body" ? "block" : "none" }}>
          <BodyTab
            C={C} dark={dark} wide={wide}
            session={session} heavy={heavy} autoHeavy={autoHeavy && dayRec?.heavy === undefined}
            onHeavy={setHeavy} record={dayRec} onComplete={completeSession} recovery={recovery}
            onFlagPoor={flagPoorSession}
            seen={seenFigures}
            onSeen={(key) => setSeenFigures((m) => ({ ...m, [key]: (m[key] || 0) + 1 }))}
          />
        </div>
        {tab === "jobs" && (
          <JobsTab C={C} dark={dark} wide={wide} jobs={jobs} pool={pool} ranks={ranks} todayKey={todayKey}
            events={events} pscPinnedIds={pscPinnedIds} pscDeferrals={pscDeferrals}
            daysToArrival={arrivalDays} reportProfile={reportProfile}
            onSet={setJob} onPull={pullFromPool} onPush={pushToPool} onDefer={deferPsc}
            onQuickCapture={quickCapture} />
        )}
        <Suspense fallback={<div className="py-8 text-center" style={{ fontSize: 13, color: C.dim }}>Loading…</div>}>
          {tab === "word" && wordTab()}
          {tab === "week" && (
            <WeekTab C={C} dark={dark} wide={wide} weeks={weeks} today={now}
              onSet={(k, v) => setWeeks((all) => ({ ...all, [k]: v }))}
              figures={{ habit: r7 ? r7.pct : null, trained, due: trainDue, jobs: jobFigure, plan: plan7 }} />
          )}
          {tab === "plans" && (
            <PlansTab C={C} dark={dark} wide={wide} plans={plans} today={now}
              onAdd={addPlan} onSet={setPlan} onSpawn={spawnJob}
              onExport={() => JSON.stringify(exportAll(), null, 2)}
              onExportFallback={setExporting}
              onImport={importAll}
              quota={quota}
              reportProfile={reportProfile} onSetReportProfile={setReportProfile}
              photoBytes={photoBytes} onPurgePhotos={purgePhotos} onExportPhotos={exportPhotos}
              journalRecovery={journalRecovery} onRecoverReflections={recoverReflections}
              onInspectJournalFile={inspectJournalFile} onMergeJournalFile={mergeJournalFile} />
          )}
        </Suspense>
        {tab === "score" && scoreTab()}
      </div>
    </>
  );

  return (
    <div className="wb-t w-full flex justify-center px-3" style={{
      background: C.bg, fontFamily: F.ui,
      minHeight: "100dvh",
      paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
      paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
    }}>
      <div className="wb-t w-full rounded-[22px] overflow-hidden flex flex-col"
        style={{
          maxWidth: wide ? 1180 : 384,
          background: C.card, border: `1px solid ${C.line2}`, boxShadow: C.shadow,
          height: wide ? "calc(100dvh - 3rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))" : undefined,
        }}>

        {wide ? (
          <div className="flex flex-1 min-h-0">
            <div className="flex flex-col shrink-0 overflow-y-auto wb-x" style={{
              width: tab === "word" ? 320 : 384, borderRight: `1px solid ${C.line}`,
              transition: "width .18s ease",
            }}>
              {rail}
            </div>
            <div className="flex-1 flex flex-col min-h-0">{main}</div>
          </div>
        ) : (
          <>{rail}{main}</>
        )}

        <div className="px-5 py-3 wb-t shrink-0" style={{ borderTop: `1px solid ${C.line}`, fontFamily: F.mono, fontSize: 9, letterSpacing: ".12em", color: C.dim2 }}>
          {!atSea
            ? "ALONGSIDE — THE DAY KEEPS ITS SHAPE"
            : previewing
              ? `PREVIEW — TAP ${legs[autoLegIdx].short.toUpperCase()} FOR TODAY`
              : "TAP A LEG — THE DAY RETIMES ITSELF"}
        </div>
      </div>

      {exporting !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3"
          style={{ background: dark ? "rgba(4,10,13,.72)" : "rgba(16,38,46,.42)" }}
          onClick={() => setExporting(null)}>
          <div className="wb-t w-full max-w-md rounded-[22px] overflow-hidden"
            style={{ background: C.card, border: `1px solid ${C.line2}`, boxShadow: C.shadow }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div style={eyebrow}>EVERYTHING, AS JSON</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, marginTop: 4, color: C.text2 }}>
                {(exporting.length / 1024).toFixed(1)} KB. Copy it somewhere off the ship before a
                reinstall — a download is not something iOS reliably lets a home-screen app do.
              </div>
            </div>
            <div className="px-5 py-4">
              <textarea readOnly value={exporting} rows={8}
                onFocus={(e) => e.target.select()}
                className="wb-t w-full rounded-xl px-3 py-2" style={{
                  fontFamily: F.mono, fontSize: 11, lineHeight: 1.4, color: C.text2,
                  background: C.sub, border: `1px solid ${C.line2}`, resize: "none",
                }} />
              <div className="flex gap-2 mt-3">
                <button onClick={() => { try { navigator.clipboard?.writeText(exporting); } catch (e) { /* select and copy by hand */ } }}
                  className="wb-t flex-1 rounded-xl py-2.5" style={{
                    fontSize: 13.5, fontWeight: 600, background: C.amber,
                    color: dark ? "#0E1C22" : "#FFFFFF", border: `1px solid ${C.amber}`,
                  }}>Copy</button>
                <a href={`data:application/json;charset=utf-8,${encodeURIComponent(exporting)}`}
                  download={`watchbell-${todayKey}.json`}
                  className="wb-t flex-1 rounded-xl py-2.5 text-center" style={{
                    fontSize: 13.5, fontWeight: 600, color: C.text2, border: `1px solid ${C.line2}`,
                  }}>Save a file</a>
              </div>
              <button onClick={() => setExporting(null)} className="wb-t w-full mt-3"
                style={{ fontSize: 12.5, color: C.dim }}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
