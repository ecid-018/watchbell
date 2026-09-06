import React from "react";
import { renderToString } from "react-dom/server";
import Watchbell from "./src/Watchbell.jsx";
import Setup from "./src/Setup.jsx";
import { appendPhase, migrate, generateLegs, nameOf, lengthOf, legsOf, daysToArrival, daysToArrivalSigned } from "./src/phase.js";
import BodyTab from "./src/BodyTab.jsx";
import JobsTab from "./src/JobsTab.jsx";
import WeekTab from "./src/WeekTab.jsx";
import PlansTab from "./src/PlansTab.jsx";
import { THEME } from "./src/theme.js";
import { doableForLeg, eveningFor, itemsForLeg, parseUtcLabel } from "./src/schedule.js";
import { dayDoable, dayItems, dueSoon, lostTo, recoveryOn } from "./src/events.js";
import { CARRY_WARN, PRIORITY_RANK, autoPhotoTag, canDrop, carriedFor, carryLabel, groupByAssignee, jobsInWindow, makeJob } from "./src/jobs.js";
import { isFromBacklog, portItemVisible, pscPinned, recurringTasksFromBacklog } from "./src/backlog.js";
import { BACKLOG } from "./src/data/jobs-backlog.js";
import { pscReadiness } from "./src/psc.js";
import { readExifDate } from "./src/exif.js";
import { DEFAULT_RANKS, SCHEMA } from "./src/store.js";
import { allRefs, fetchInto, parseRef, readCached, toLines, urlFor } from "./src/bible.js";
import { colourOf, marksIn, quote, toggleMark } from "./src/marks.js";
import WordTab, { REFLECT_MIN } from "./src/WordTab.jsx";
import { COOLDOWN, PLAN, RULES, WARMUP, buildIntervals, mainBlock, parseDuration, sessionForDate, timerMode } from "./src/training.js";
import { EXERCISE_KEYS, exerciseCue, exerciseLabel } from "./src/components/ExerciseFigure.jsx";
import { LEARNED_AT } from "./src/BodyTab.jsx";
import { adminToday, criticalCarriedInWeek, slotSummary, taskStatus } from "./src/admin.js";
import { addDays, dateKey, parseKey } from "./src/voyage.js";
import {
  applyFastingWindow, canStartProlongedFast, currentStage, hiitPromptEligible,
  isWindowSuspended, naturalStage, prolongedElapsedHours, windowAdherence, windowForDay, windowState,
} from "./src/fasting.js";

const noop = () => {};
// renderToString separates interpolated text nodes with comment markers; strip
// them so an assertion can match the sentence a reader actually sees.
const render = (phases) =>
  renderToString(<Watchbell phases={phases} onEditPhase={noop} onNewPhase={noop} />).replace(/<!--.*?-->/g, "");

const day = (n) => { const d = new Date(Date.now() - (n - 1) * 864e5); return d.toISOString().slice(0, 10); };

const legacy = migrate(null, day(15));                                   // pre-phases install
const conf = [{ kind: "voyage", start: day(9), from: "Singapore", to: "Rotterdam",
                days: 34, utc0: 8, utc1: 1, readOffset: 1 }];            // day 9, ship's time +6
const stood = [{ kind: "voyage", start: day(8), from: "Jeddah", to: "Djibouti",
                 days: 20, utc0: 3, utc1: 3, stand0: 7, stand1: 9,
                 standWhy: "Bab-el-Mandeb transit — armed watch", readOffset: 1 }];
const hop = [{ kind: "voyage", start: day(2), from: "Houston", to: "Veracruz",
               days: 4, utc0: -6, utc1: -6, readOffset: 1 }];
const port = appendPhase(migrate(null, day(60)), { kind: "port", start: day(3), port: "Mundra", open: "09:30", trade: true });

let bad = 0;
const t = (name, cond) => { if (!cond) bad++; console.log((cond ? "  ok  " : "  XX  ") + name); };

const L = render(legacy), S = render(conf), D = render(stood), H = render(hop), P = render(port);

t("legacy passage keeps its named legs",        L.includes("South Atlantic") && L.includes("NEW ORLEANS"));
t("legacy passage keeps its cash open",         /cash open 12:30/.test(L));

t("configured passage names its own ports",     S.includes("SINGAPORE") && S.includes("ROTTERDAM"));
t("no outbound/homeward wording survives",      !/Outbound|Homeward/.test(S + L + P));
t("legs are the clock, chips and all",          S.includes(">+6<") && S.includes(">+8<"));
// Day 9 of 34 falls on the +7 leg, so the desk should be reading 20:30.
t("cash open follows the clock",                /cash open 20:30/.test(S) && S.includes("Ship&#x27;s time +7"));
t("arrival leg is named for its port",          generateLegs(conf[0]).at(-1).name === "Arrival, Rotterdam");
t("departure leg is named for its port",        generateLegs(conf[0])[0].name === "Departure, Singapore");

t("stand-down cuts the days named",             D.includes("Bab-el-Mandeb transit — armed watch"));
t("stand-down marks the rail",                  D.includes("NO SESSION"));
t("stand-down shows no cash open",              !/cash open/.test(D));

t("a same-zone hop is one leg",                 legsOf(hop[0]).length === 1);
t("the hop still retimes its session",          /cash open 07:30/.test(H));

t("port stay is unaffected",                    /Day \d+ alongside · Mundra/.test(P));

t("passage length follows the field",           lengthOf(conf[0]) === 34 && lengthOf(legacy[0]) === 40);
t("name is the ports",                          nameOf(conf[0]) === "Singapore → Rotterdam");
t("legacy name is preserved",                   nameOf(legacy[0]) === "New Orleans → India");

// Every generated passage must cover its days exactly once, contiguously.
let covers = true;
for (const d of [1, 2, 5, 13, 34, 40, 77]) {
  for (const [a, b] of [[-5, 5.5], [8, 1], [0, 0], [12, -4], [-11, 13]]) {
    const legs = generateLegs({ from: "A", to: "B", days: d, utc0: a, utc1: b, stand0: 2, stand1: 4 });
    const n = legs.reduce((x, l) => x + (l.d1 - l.d0 + 1), 0);
    const contiguous = legs.every((l, i) => (i === 0 ? l.d0 === 1 : l.d0 === legs[i - 1].d1 + 1));
    if (n !== d || !contiguous || legs[legs.length - 1].d1 !== d) covers = false;
  }
}
t("legs cover every passage exactly", covers);

const forms = ["first", "next", "edit"];
for (const m of forms) {
  try {
    renderToString(<Setup mode={m} value={m === "edit" ? legacy[0] : { kind: "voyage" }} onSave={noop} onCancel={noop} />);
    t(`setup renders: ${m}`, true);
  } catch (e) { t(`setup renders: ${m} — ${e.message}`, false); }
}
try {
  const e = renderToString(<Setup mode="edit" value={legacy[0]} onSave={noop} onCancel={noop} />).replace(/<!--.*?-->/g, "");
  t("editing a legacy passage prefills and warns", e.includes("New Orleans") && e.includes("re-cuts it"));
} catch (e) { t("editing a legacy passage — " + e.message, false); }

/* -------- the training layer -------- */

const clean = (el) => renderToString(el).replace(/<!--.*?-->/g, "");
const bodyOf = (session, heavy) => clean(
  <BodyTab C={THEME.dark} dark wide={false} session={session} heavy={heavy} autoHeavy={false}
    onHeavy={noop} record={null} onComplete={noop} />);

const byKey = (k) => PLAN.find((p) => p.key === k);
const mon = byKey("hiit-tread-a"), wed = byKey("hiit-floor"), fri = byKey("hiit-tread-b");
const tue = byKey("str-push"), sat = byKey("zone2"), sun = byKey("rest");

// 2026-08-24 is a Monday.
t("session is picked by weekday",        sessionForDate(new Date(2026, 7, 24)).key === "hiit-tread-a"
                                      && sessionForDate(new Date(2026, 7, 30)).key === "rest");

t("nothing invented: every key is the plan's",
  PLAN.every((p) => bodyOf(p, false).includes(p.name)));

t("main block is the plan's, verbatim",  mainBlock(mon, false) === mon.main);
t("heavy weather swaps the whole block", mainBlock(mon, true) === mon.heavyWeather);
t("no heavy block means no swap",        mainBlock(tue, true) === tue.main);

t("Monday alternates hard and easy",     (() => { const q = buildIntervals(mon, false);
  return q.length === 16 && q[0].kind === "work" && q[0].secs === 60
      && q[1].kind === "rest" && q[1].secs === 90 && q[15].round === 8; })());
t("Wednesday inserts the format's rest", (() => { const q = buildIntervals(wed, false);
  return q.length === 48 && q[1].name === "Rest" && q[1].secs === 30; })());
t("Friday splits the compound bout",     (() => { const q = buildIntervals(fri, false);
  return q[0].kind === "work" && q[0].secs === 210 && q[1].kind === "rest" && q[1].secs === 210
      && q[2].secs === 120 && q.length === 9; })());
t("Saturday is one long bout",           buildIntervals(sat, false).length === 1);
t("reps decline to become bouts",        parseDuration("4 × 8–12") === null && parseDuration("1 × max") === null);

t("strength days fall back to stopwatch", timerMode(tue) === "stopwatch");
t("rest day gets no timer",               timerMode(sun) === "none");
t("HIIT days get intervals",              timerMode(mon) === "intervals" && timerMode(wed) === "intervals");

const monBody = bodyOf(mon, false), monHeavy = bodyOf(mon, true), tueBody = bodyOf(tue, false);
t("treadmill days carry the lanyard rule", monBody.includes(RULES.treadmillLanyard));
t("bodyweight days do not",                !tueBody.includes(RULES.treadmillLanyard));
t("other rules sit behind a tap",          !monBody.includes(RULES.hardDayCap) && monBody.includes("The standing rules"));
t("heavy weather shows the oxide strip",   monHeavy.includes("HEAVY WEATHER") && monHeavy.includes("swapped for the heavy-weather set"));
t("heavy block replaces what is listed",   monHeavy.includes("Squat pulses") && !monHeavy.includes("Hard interval"));

t("warm-up is collapsed by default",       !monBody.includes("Build to jog"));
t("main block is open by default",         monBody.includes("Hard interval") && monBody.includes("8.5–10 km/h"));
t("finisher and cool-down are collapsed",  !monBody.includes("Child&#x27;s pose"));
t("rounds show as a badge",                monBody.includes("×8"));
t("reps and times are right-aligned mono", monBody.includes("60 s") && tueBody.includes("4 × 8–12"));

/* -------- the form demonstrations -------- */

const movements = [];
for (const k of Object.keys(WARMUP)) movements.push(...WARMUP[k]);
movements.push(...COOLDOWN);
for (const p of PLAN) for (const b of ["main", "finisher", "heavyWeather"]) movements.push(...(p[b] || []));
const tagged = movements.filter((m) => m.figure);

t("every figure key is a real figure",   tagged.every((m) => EXERCISE_KEYS.includes(m.figure)));
t("every figure key is used somewhere",  EXERCISE_KEYS.every((k) => tagged.some((m) => m.figure === k)));
t("all nine are tagged in the plan",     tagged.length === 9);
t("no key was invented",                 tagged.every((m) => exerciseCue(m.figure) && exerciseLabel(m.figure)));
t("same name, same key, everywhere",     (() => {
  const byName = new Map();
  for (const m of movements) {
    if (byName.has(m.name) && byName.get(m.name) !== m.figure) return false;
    byName.set(m.name, m.figure);
  }
  return true;
})());

// The queue carries the key through, or the timer has nothing to show mid-round.
const wedQueue = buildIntervals(byKey("hiit-floor"), false);
t("bouts carry the figure key",          wedQueue.find((b) => b.name === "Bear crawl").figure === "bear-crawl");
t("rest bouts carry no figure",          wedQueue.filter((b) => b.kind === "rest").every((b) => !b.figure));

const bodySeen = (session, heavy, seen) => renderToString(
  <BodyTab C={THEME.dark} dark wide={false} session={session} heavy={heavy} autoHeavy={false}
    onHeavy={noop} record={null} onComplete={noop} seen={seen} onSeen={noop} />).replace(/<!--.*?-->/g, "");

const wedFresh = bodySeen(byKey("hiit-floor"), false, {});
const wedKnown = bodySeen(byKey("hiit-floor"), false, { "bear-crawl": LEARNED_AT, "renegade-row": LEARNED_AT });
const satPlain = bodySeen(byKey("zone2"), false, {});

t("tagged rows get an affordance",       (wedFresh.match(/<svg width="11"/g) || []).length === 2);
t("untagged rows render no control",     !satPlain.includes('<svg width="11"'));
t("fresh movements draw the eye",        wedFresh.includes(THEME.dark.amber));
t("learned movements go quiet",          (() => {
  const amber = (str) => (str.match(new RegExp(THEME.dark.amber, "g")) || []).length;
  return amber(wedKnown) < amber(wedFresh);
})());
t("collapsed rows draw no figure",       !wedFresh.includes('class="xf"'));
t("the component is used as supplied",   exerciseCue("renegade-row").startsWith("Feet wide for balance"));

/* -------- the evening, and the template's own history -------- */

const OLD = "2026-08-01", NEW = "2026-08-26";
// A leg keeping UTC−5, so the trading session sits at 08:00 and a morning
// arrival actually collides with it. On a UTC+8 leg the desk is a night desk
// and the same arrival would leave it alone — correctly, but it would prove
// nothing about suspension.
const seaLeg = legsOf({ kind: "voyage", from: "A", to: "B", days: 40, utc0: -5, utc1: -5 })[0];
const ids = (dk) => itemsForLeg(seaLeg, dk).map((i) => i.id);

t("the evening is filled in",            ids(NEW).includes("evening") && ids(NEW).includes("shower-pm"));
t("both showers stand alone",            ids(NEW).filter((i) => i === "prep" || i === "shower-pm").length === 2);
t("21:30 merges cabin and prayer",       itemsForLeg(seaLeg, NEW).find((i) => i.id === "vespers").label === "Cabin reset and evening prayer");
t("the past is scored as it was",        ids(OLD).includes("cabin") && !ids(OLD).includes("evening"));
t("adding items did not rewrite history", doableForLeg(seaLeg, OLD).length === 12 && doableForLeg(seaLeg, NEW).length === 13);
t("the evening block rotates all seven", new Set([0,1,2,3,4,5,6].map((d) => eveningFor(new Date(2026, 7, 23 + d)))).size === 6);
t("Wednesday is the journal review",     eveningFor(new Date(2026, 7, 26)) === "Trading journal review");

/* -------- ship's business -------- */

const arrival = { date: NEW, type: "Arrival", start: "05:00", hours: 6 };
const overnight = { date: NEW, type: "Bunkering", start: "20:00", hours: 7 };
const byId = (list) => Object.fromEntries(list.map((i) => [i.id, i]));

const plain = byId(dayItems(seaLeg, NEW, []));
const arr = byId(dayItems(seaLeg, NEW, [arrival]));
t("trading and exercise suspend",        arr.trade.stood && arr.train.stood);
t("the reason is the event",             arr.trade.why === "arrival");
t("Bible reading is moved, not lost",    !arr.word.stood && arr.word.movedFor === "Arrival" && arr.word.t > plain.word.t);
t("the morning shower moves with it",    !arr.prep.stood && arr.prep.movedFor === "Arrival");
t("lights out is untouched off-window",  arr.sleep.t === plain.sleep.t);
t("a shorter day, not a failed one",     dayDoable(seaLeg, NEW, [arrival]).length < dayDoable(seaLeg, NEW, []).length);
t("suspended work is never owed",        dayDoable(seaLeg, NEW, [arrival]).every((i) => !i.stood));

const night = byId(dayItems(seaLeg, NEW, [overnight]));
t("the evening block suspends at night", night.evening.stood);
t("the evening shower is moved late",    night["shower-pm"].movedFor === "Bunkering");

/* -------- graveyard -------- */

const after = "2026-08-27";
const rec = recoveryOn([overnight], after);
t("an overnight run earns recovery",     rec && rec.lost === 3 && rec.from === "Bunkering");
t("the shift is capped at three hours",  lostTo({ start: "20:00", hours: 12 }) === 3);
t("a day that ends before midnight does not", recoveryOn([arrival], "2026-08-27") === null);
const morning = byId(dayItems(seaLeg, after, [overnight]));
t("the wake moves later by what was lost", morning.wake.t === "0830" && morning.wake.shifted);
t("the morning keeps its spacing",       morning.word.t === "0835" && morning.prep.t === "0940");
t("the desk stands down on recovery",    morning.trade.stood && /recovery/.test(morning.trade.why));

/* -------- the legacy route's offsets, read back out of its own labels -------- */

t("parseUtcLabel reverses utcLabel for the legacy leg table", (() => {
  return parseUtcLabel("−5") === -5
    && parseUtcLabel("+5:30") === 5.5
    && parseUtcLabel("+1") === 1
    && parseUtcLabel("0") === 0;
})());

/* -------- jobs -------- */

const j0 = makeJob({ title: "Purifier overhaul", assignee: "2/E", priority: "urgent" }, "2026-08-20");
const j1 = makeJob({ title: "Sounding pipes", assignee: "Oiler" }, NEW);
t("a job starts open and owned",         j0.status === "open" && j0.assignee === "2/E");
t("carry is read off the calendar",      carriedFor(j0, NEW) === 6 && carriedFor(j1, NEW) === 0);
t("the carry label reads plainly",       carryLabel(0) === "today" && carryLabel(2) === "3rd day");
t("carrying past three days warns",      carriedFor(j0, NEW) >= CARRY_WARN);
t("urgent sorts to the top",             groupByAssignee([j1, j0], ["2/E", "Oiler"], NEW)[0][0] === "2/E");
t("dropped is archived, not deleted",    (() => {
  const dropped = { ...j1, status: "dropped", droppedOn: NEW };
  return [j0, dropped].filter((j) => j.status === "dropped").length === 1;
})());
t("jobs are counted, never averaged in", (() => {
  const w = jobsInWindow([{ ...j0, status: "done", doneOn: NEW }, j1], new Date(2026, 7, 26));
  return w.done === 1 && typeof w.total === "number" && !("pct" in w);
})());
t("PSC and defect lead urgent, which leads normal", (() => {
  const rank = (p) => PRIORITY_RANK[p];
  return rank("psc") < rank("defect") && rank("defect") < rank("urgent") && rank("urgent") < rank("normal");
})());
t("PSC/defect items sort ahead of urgent in a group", (() => {
  const psc = { ...j1, priority: "psc", assignee: "2/E" };
  const groups = groupByAssignee([j0, psc], ["2/E"], NEW);
  return groups[0][1][0].priority === "psc";
})());
t("only PSC and defect items refuse a drop", canDrop({ priority: "psc" }) === false
  && canDrop({ priority: "defect" }) === false
  && canDrop({ priority: "urgent" }) === true
  && canDrop({ priority: "normal" }) === true);
t("a pooled job's photo defaults to before, everything else to after",
  autoPhotoTag({ status: "pooled" }) === "before"
    && autoPhotoTag({ status: "open" }) === "after"
    && autoPhotoTag({ status: "done" }) === "after");

/* -------- the backlog pool and PSC readiness -------- */

t("importing the backlog twice does not double it", (() => {
  const once = [];
  const have1 = new Set(once.map((j) => j.id));
  const additions1 = BACKLOG.filter((i) => i.recurring !== "weekly" && !have1.has(i.id));
  const after1 = [...once, ...additions1.map((i) => ({ id: i.id, status: "pooled" }))];
  const have2 = new Set(after1.map((j) => j.id));
  const additions2 = BACKLOG.filter((i) => i.recurring !== "weekly" && !have2.has(i.id));
  return additions1.length > 0 && additions2.length === 0;
})());
t("a promoted backlog item keeps the notebook's own id", (() => {
  const item = BACKLOG.find((i) => i.recurring !== "weekly");
  return isFromBacklog(item.id) && !isFromBacklog("not-a-real-id");
})());
t("weekly recurring items never enter the pool", (() => {
  const weekly = BACKLOG.filter((i) => i.recurring === "weekly").map((i) => i.id);
  return weekly.length > 0 && weekly.every((id) => BACKLOG.find((i) => i.id === id).recurring === "weekly");
})());
t("recurring backlog items arrive admin-shaped", (() => {
  const tasks = recurringTasksFromBacklog(BACKLOG);
  return tasks.length > 0 && tasks.every((t2) => t2.cadence === "weekly" && t2.key.startsWith("backlog:"));
})());
t("a port item hides at sea and surfaces on a future Arrival", (() => {
  const item = { where: "port" };
  const noEvents = portItemVisible(item, [], "2026-08-26");
  const futureArrival = portItemVisible(item, [{ type: "Arrival", date: "2026-09-10" }], "2026-08-26");
  return !noEvents && futureArrival;
})());
t("a sea item is always visible regardless of events", portItemVisible({ where: "sea" }, [], "2026-08-26"));

const backlogToday = parseKey(NEW);
const arrivingSoon = { kind: "voyage", start: dateKey(addDays(backlogToday, -35)), days: 40, utc0: 0, utc1: 0 };
const arrivingFar = { kind: "voyage", start: dateKey(backlogToday), days: 40, utc0: 0, utc1: 0 };
const portPhase = { kind: "port", start: dateKey(backlogToday) };
t("days to arrival counts down and clamps at zero", daysToArrival(arrivingSoon, backlogToday) === 4
  && daysToArrival(arrivingFar, backlogToday) === 39
  && daysToArrival(portPhase, backlogToday) === null);
t("the signed variant goes negative once overrun",
  daysToArrivalSigned({ kind: "voyage", start: dateKey(addDays(backlogToday, -45)), days: 40, utc0: 0, utc1: 0 }, backlogToday) < 0);
t("open PSC/defect items pin inside 21 days, pooled ones do not", (() => {
  const openPsc = { id: "x1", status: "open", priority: "psc" };
  const pooledDefect = { id: "x2", status: "pooled", priority: "defect" };
  const pinned = pscPinned([openPsc, pooledDefect], arrivingSoon, backlogToday);
  return pinned.length === 1 && pinned[0].id === "x1";
})());
t("nothing pins outside the 21-day window",
  pscPinned([{ id: "x1", status: "open", priority: "psc" }], arrivingFar, backlogToday).length === 0);
t("PSC readiness counts psc and defect together, closed over total", (() => {
  const r = pscReadiness([
    { priority: "psc", status: "done" }, { priority: "defect", status: "open" },
    { priority: "urgent", status: "done" },
  ]);
  return r.closed === 1 && r.total === 2;
})());
t("EXIF parsing never throws — no Exif segment comes back null",
  readExifDate(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer) === null);
t("EXIF parsing never throws — garbage input comes back null",
  readExifDate(new Uint8Array([1, 2, 3]).buffer) === null);

/* -------- admin cadence -------- */

const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const ADAY = new Date(2026, 7, 26);
const ADAY_KEY = dateKey(ADAY);
const ctx = (over) => ({ today: ADAY, todayKey: ADAY_KEY, completions: {}, deferrals: {}, events: [], ...over });

t("daily is always due", taskStatus({ key: "d", cadence: "daily" }, ctx()).due);

t("3day is not due at two days", !taskStatus(
  { key: "t3", cadence: "3day" }, ctx({ completions: { t3: dateKey(addDays(ADAY, -2)) } }),
).due);
t("3day is due at three days, and again at four", (() => {
  const at3 = taskStatus({ key: "t3", cadence: "3day" }, ctx({ completions: { t3: dateKey(addDays(ADAY, -3)) } }));
  const at4 = taskStatus({ key: "t3", cadence: "3day" }, ctx({ completions: { t3: dateKey(addDays(ADAY, -4)) } }));
  return at3.due && !at3.overdue && at4.due && at4.overdue && at4.counter === "day 5";
})());

t("weekly is due on its day, not yet carried, and carried once missed", (() => {
  const onDay = taskStatus({ key: "w", cadence: "weekly", day: WD[ADAY.getDay()] }, ctx());
  const missed = taskStatus({ key: "w", cadence: "weekly", day: WD[(ADAY.getDay() + 6) % 7] }, ctx());
  return onDay.due && !onDay.carried && missed.due && missed.carried;
})());
t("a weekly task done since its last occurrence is not due again", !taskStatus(
  // Scheduled two days ago; done yesterday — inside the current cycle.
  { key: "w", cadence: "weekly", day: WD[(ADAY.getDay() + 5) % 7] },
  ctx({ completions: { w: dateKey(addDays(ADAY, -1)) } }),
).due);
t("a weekly task never done carries from its last occurrence, whatever today's weekday is",
  taskStatus({ key: "w", cadence: "weekly", day: WD[(ADAY.getDay() + 1) % 7] }, ctx()).due);

t("monthly surfaces as coming up before it is due, then falls due", (() => {
  const soon = taskStatus({ key: "m", cadence: "monthly" }, ctx({ completions: { m: dateKey(addDays(ADAY, -28)) } }));
  const due = taskStatus({ key: "m", cadence: "monthly" }, ctx({ completions: { m: dateKey(addDays(ADAY, -30)) } }));
  return soon.comingUp && !soon.due && due.due && !due.comingUp;
})());

t("trigger is due only with a matching event today, and ignores other events", (() => {
  const none = taskStatus({ key: "arr", cadence: "trigger", trigger: "Arrival" }, ctx());
  const wrong = taskStatus({ key: "arr", cadence: "trigger", trigger: "Arrival" },
    ctx({ events: [{ date: ADAY_KEY, type: "Bunkering" }] }));
  const right = taskStatus({ key: "arr", cadence: "trigger", trigger: "Arrival" },
    ctx({ events: [{ date: ADAY_KEY, type: "Arrival" }] }));
  return !none.due && !wrong.due && right.due;
})());

t("a deferred task drops out today and returns tomorrow", (() => {
  const tomorrow = dateKey(addDays(ADAY, 1));
  const today = taskStatus({ key: "d", cadence: "daily" }, ctx({ deferrals: { d: tomorrow } }));
  const next = taskStatus({ key: "d", cadence: "daily" },
    ctx({ today: addDays(ADAY, 1), todayKey: tomorrow, deferrals: { d: tomorrow } }));
  return !today.due && next.due;
})());

t("a critical task cannot be deferred twice, a routine one can", (() => {
  // Deferred until today — the one day of grace has already been spent, so
  // it is due and carried again, not still mid-defer.
  const critical = taskStatus({ key: "c", cadence: "3day", critical: true },
    ctx({ completions: { c: dateKey(addDays(ADAY, -3)) }, deferrals: { c: ADAY_KEY } }));
  const routine = taskStatus({ key: "r", cadence: "3day", critical: false },
    ctx({ completions: { r: dateKey(addDays(ADAY, -3)) }, deferrals: { r: ADAY_KEY } }));
  return !critical.canDefer && critical.carried && routine.canDefer;
})());

t("a slot totals its due tasks' minutes and flags going over the window", (() => {
  const tasks = [
    { key: "a", slot: "am", cadence: "daily", est: 20 },
    { key: "b", slot: "am", cadence: "daily", est: 20 },
    { key: "c", slot: "pm", cadence: "daily", est: 15 },
  ];
  const am = slotSummary(tasks, "am", ctx(), 30);
  return am.total === 2 && am.minutes === 40 && am.overWindow;
})());
t("a slot with nothing due counts as done", slotSummary([], "am", ctx(), 30).allDone);

t("today's admin figure counts due tasks, not a percentage", (() => {
  const tasks = [{ key: "a", slot: "am", cadence: "daily", critical: false }];
  const fig = adminToday(tasks, ctx({ completions: { a: ADAY_KEY } }));
  return fig.done === 1 && fig.total === 1 && !("pct" in fig);
})());
t("a carried critical task counts toward the admin figure's carried total", (() => {
  const tasks = [{ key: "c", cadence: "3day", critical: true }];
  const fig = adminToday(tasks, ctx({ completions: { c: dateKey(addDays(ADAY, -4)) } }));
  return fig.total === 1 && fig.done === 0 && fig.carried === 1;
})());

t("a week's carried critical tasks are read off each day's own log", (() => {
  const tasks = [{ key: "orb", title: "ORB entries", critical: true }];
  const logs = { [dateKey(addDays(ADAY, -2))]: { adminCarriedCritical: ["orb"] } };
  const readLog = (dk) => logs[dk] || {};
  const carried = criticalCarriedInWeek(tasks, addDays(ADAY, -6), ADAY, readLog);
  return carried.length === 1 && carried[0].title === "ORB entries" && carried[0].date === dateKey(addDays(ADAY, -2));
})());

/* -------- fasting -------- */

const FADAY = new Date(2026, 7, 26);
const FADAY_KEY = dateKey(FADAY);
const nextSunday = (from) => addDays(from, (7 - from.getDay()) % 7);

t("the ramp advances on the calendar: weeks 1-2, 3-4, then 16:8", (() => {
  const start = dateKey(FADAY);
  return naturalStage(start, FADAY) === 1
    && naturalStage(start, addDays(FADAY, 13)) === 1
    && naturalStage(start, addDays(FADAY, 14)) === 2
    && naturalStage(start, addDays(FADAY, 27)) === 2
    && naturalStage(start, addDays(FADAY, 28)) === 3;
})());

t("a pin overrides the calendar and never advances on its own", (() => {
  const fasting = { startDate: dateKey(addDays(FADAY, -30)), stagePin: 1 };
  return currentStage(fasting, FADAY) === 1;
})());
t("no pin follows the calendar", currentStage({ startDate: dateKey(FADAY), stagePin: null }, addDays(FADAY, 14)) === 2);

t("the HIIT override only moves a later stage's open time earlier", (() => {
  const on = { breakFastOnHiit: true };
  const off = { breakFastOnHiit: false };
  const stage3Hiit = windowForDay(on, 3, true);
  const stage3Rest = windowForDay(on, 3, false);
  const stage1Hiit = windowForDay(on, 1, true);
  const stage3Off = windowForDay(off, 3, true);
  return stage3Hiit.open === "0700" && stage3Rest.open === "1130"
    && stage1Hiit.open === "0700" // already 07:00 at stage 1 — a no-op, not a conflict
    && stage3Off.open === "1130" // the setting has to be on
    && stage3Hiit.close === "1900" && stage3Rest.close === "1900"; // close never moves
})());

t("the window items retime to today's window and the list re-sorts around them", (() => {
  const items = [
    { id: "wake", t: "0530" },
    { id: "fuel-open", t: "1130" },
    { id: "work", t: "0800" },
    { id: "fuel-close", t: "1900" },
  ];
  const out = applyFastingWindow(items, { open: "0700", close: "1900" });
  return out[0].id === "wake" && out[1].id === "fuel-open" && out[1].t === "0700" && out[2].id === "work";
})());

t("a prolonged fast stands the whole Fuel thread down rather than racking up misses", (() => {
  const items = [
    { id: "wake", tag: "reset", t: "0530" },
    { id: "fuel-open", tag: "fuel", t: "1130" },
    { id: "fuel-protein", tag: "fuel", t: "1905" },
  ];
  const out = applyFastingWindow(items, { open: "1130", close: "1900" }, true);
  const wake = out.find((i) => i.id === "wake");
  const open = out.find((i) => i.id === "fuel-open");
  const protein = out.find((i) => i.id === "fuel-protein");
  return !wake.stood && open.stood && protein.stood && open.why === "prolonged fast";
})());

t("any Ship Event suspends the window for the day, not just an overlapping one",
  isWindowSuspended([{ date: FADAY_KEY, type: "Bunkering", start: "03:00", hours: 2 }], FADAY_KEY)
  && !isWindowSuspended([], FADAY_KEY));

t("the window state reads exactly as the feature was specified", (() => {
  const window = { open: "1130", close: "1900" };
  // 01:20 is 6h20m past the previous day's 19:00 close.
  const fasting = windowState(new Date(2026, 7, 26, 1, 20), window, false);
  // 16:45 is 2h15m short of today's 19:00 close.
  const open = windowState(new Date(2026, 7, 26, 16, 45), window, false);
  return `${fasting.label} — ${fasting.detail}` === "Fasting — 6 h 20 m elapsed"
    && `${open.label} — ${open.detail}` === "Window open — closes in 2 h 15 m";
})());
t("a suspended day never claims a fasting or open state", windowState(new Date(2026, 7, 26, 12, 0), { open: "1130", close: "1900" }, true).phase === "suspended");

// A voyage that certainly covers "now" and the recent past, built the same
// relative-to-today way as the fixtures at the top of this file — a
// hardcoded date here would quietly stop covering "now" months from now.
const fastingPhase = [{ kind: "voyage", start: day(400), from: "A", to: "B", days: 800, utc0: 0, utc1: 0, readOffset: 1 }];
const today = new Date();
const thisSunday = nextSunday(today);
const thisSundayKey = dateKey(thisSunday);

t("window adherence counts a day only when both ends were ticked, and skips a suspended day", (() => {
  const day1 = dateKey(today), day0 = dateKey(addDays(today, -1));
  const live = { [day1]: { "fuel-open": true, "fuel-close": true } };
  const events = [{ date: day0, type: "Arrival", start: "06:00", hours: 4 }];
  const fig = windowAdherence(fastingPhase, today, live, events, 2);
  return fig && fig.total === 1 && fig.hit === 1; // yesterday excluded (event), today hit
})());
t("a prolonged-fast day is excluded from window adherence too", (() => {
  const day0 = dateKey(addDays(today, -1));
  const fig = windowAdherence(fastingPhase, today, {}, [], 2, [day0]);
  return fig && fig.total === 1; // only today counted, day0 excluded as a prolonged-fast date
})());

t("a prolonged fast is Sunday-only", (() => {
  const notSunday = addDays(thisSunday, 1);
  return !canStartProlongedFast(dateKey(notSunday), fastingPhase, []).ok
    && canStartProlongedFast(thisSundayKey, fastingPhase, []).ok;
})());
t("a prolonged fast is blocked by ship's business today or yesterday", (() => {
  const eventToday = [{ date: thisSundayKey, type: "Arrival", start: "06:00", hours: 2 }];
  const eventYesterday = [{ date: dateKey(addDays(thisSunday, -1)), type: "Arrival", start: "06:00", hours: 2 }];
  return !canStartProlongedFast(thisSundayKey, fastingPhase, eventToday).ok
    && !canStartProlongedFast(thisSundayKey, fastingPhase, eventYesterday).ok;
})());
t("a prolonged fast is blocked on a recovery day", (() => {
  // An event the night before that runs past midnight into Sunday morning.
  const overnight = [{ date: dateKey(addDays(thisSunday, -1)), type: "Bunkering", start: "22:00", hours: 8 }];
  return !canStartProlongedFast(thisSundayKey, fastingPhase, overnight).ok;
})());

t("elapsed hours on a prolonged fast are hard-capped at 24", (() => {
  const startedAt = new Date(2026, 7, 26, 0, 0).toISOString();
  const at30h = new Date(2026, 7, 27, 6, 0);
  return prolongedElapsedHours(startedAt, at30h) === 24;
})());

t("the HIIT nudge never fires before the override is off, unshown, and three weeks in", (() => {
  const today = new Date(2026, 7, 26);
  const base = { startDate: dateKey(today), stagePin: null, breakFastOnHiit: false, hiitPromptShown: false };
  return !hiitPromptEligible({ ...base, breakFastOnHiit: true }, today)
    && !hiitPromptEligible({ ...base, hiitPromptShown: true }, today)
    && !hiitPromptEligible({ ...base, startDate: null }, today)
    && !hiitPromptEligible(base, today); // day zero of the ramp — nowhere near three weeks
})());

/* -------- plans -------- */

const soon = { id: "p1", title: "Class survey", status: "planned", target: "2026-09-02" };
const far = { id: "p2", title: "Dry dock", status: "planned", target: "2027-01-01" };
const shut = { id: "p3", title: "Done thing", status: "done", target: "2026-08-26" };
const surfaced = dueSoon([soon, far, shut], new Date(2026, 7, 26));
t("plans inside fourteen days surface",  surfaced.length === 1 && surfaced[0].id === "p1");
t("finished plans stay down",            !surfaced.some((p) => p.id === "p3"));

/* -------- the stores -------- */

t("the schema is versioned",             SCHEMA >= 2);
t("ranks are ranks, not names",          DEFAULT_RANKS[0] === "Self" && DEFAULT_RANKS.includes("Fitter"));

/* -------- the new tabs render -------- */

const TD = THEME.dark;
const tabRenders = [
  ["Jobs, empty", <JobsTab C={TD} dark wide={false} jobs={[]} pool={[]} ranks={DEFAULT_RANKS} todayKey={NEW} events={[]}
      pscPinnedIds={new Set()} pscDeferrals={{}} daysToArrival={null} reportProfile={{ vessel: "", rank: "", name: "" }}
      onSet={noop} onPull={noop} onPush={noop} onDefer={noop} onQuickCapture={noop} />],
  ["Jobs, loaded", <JobsTab C={TD} dark wide jobs={[j0, { ...j1, status: "dropped", droppedOn: NEW }]} pool={[]} ranks={DEFAULT_RANKS} todayKey={NEW} events={[]}
      pscPinnedIds={new Set()} pscDeferrals={{}} daysToArrival={12} reportProfile={{ vessel: "MV Queen Trader", rank: "C/E", name: "" }}
      onSet={noop} onPull={noop} onPush={noop} onDefer={noop} onQuickCapture={noop} />],
  ["Week, blank", <WeekTab C={TD} dark wide={false} weeks={{}} today={new Date(2026, 7, 26)} onSet={noop}
      figures={{ habit: 71, trained: 3, due: 6, jobs: { done: 2, total: 5, carried: 3 }, plan: { hit: 4, total: 5 } }} />],
  ["Week, with history", <WeekTab C={TD} dark wide weeks={{ "2026-08-17": { review: "r", plan: "p", priorities: [{ text: "Purifier", done: true }, { text: "", done: false }, { text: "", done: false }] } }}
      today={new Date(2026, 7, 26)} onSet={noop}
      figures={{ habit: null, trained: 0, due: 0, jobs: { done: 0, total: 0, carried: 0 }, plan: null }} />],
  ["Plans, empty", <PlansTab C={TD} dark wide={false} plans={[]} today={new Date(2026, 7, 26)} onAdd={noop} onSet={noop} onSpawn={noop} onExport={noop} />],
  ["Plans, loaded", <PlansTab C={TD} dark wide plans={[soon, far, shut]} today={new Date(2026, 7, 26)} onAdd={noop} onSet={noop} onSpawn={noop} onExport={noop} />],
];
for (const [label, el] of tabRenders) {
  try { renderToString(el); t(`renders: ${label}`, true); }
  catch (e) { t(`renders: ${label} — ${e.message}`, false); }
}

const weekLoaded = renderToString(tabRenders[3][1]).replace(/<!--.*?-->/g, "");
t("last week's three carry forward",     weekLoaded.includes("LAST WEEK&#x27;S THREE") && weekLoaded.includes("Purifier"));
const plansLoaded = renderToString(tabRenders[5][1]).replace(/<!--.*?-->/g, "");
t("the vault offers its own backup",     plansLoaded.includes("Export everything to JSON"));

/* -------- evening prayer is non-negotiable too -------- */

const longNight = { date: NEW, type: "Bunkering", start: "20:00", hours: 7 };
const nightItems = byId(dayItems(seaLeg, NEW, [longNight]));
t("evening prayer is moved, not missed",  !nightItems.vespers.stood && nightItems.vespers.movedFor === "Bunkering");
t("the whole Word thread is protected",   dayItems(seaLeg, NEW, [longNight])
  .filter((i) => i.tag === "word").every((i) => !i.stood));

/* -------- the form reference -------- */

const bodyRef = renderToString(
  <BodyTab C={TD} dark wide={false} session={byKey("hiit-tread-a")} heavy={false} autoHeavy={false}
    onHeavy={noop} record={null} onComplete={noop} />).replace(/<!--.*?-->/g, "");
t("a treadmill day still offers the figures", bodyRef.includes("Form reference"));
t("the reference is closed until asked",  !bodyRef.includes('class="xf"'));

/* -------- the reading's text -------- */

t("the plan's books resolve",             parseRef("Psalm 23").book === "PSA"
                                       && parseRef("Matthew 12").book === "MAT"
                                       && parseRef("Mark 3").book === "MRK");
t("anything else declines",               parseRef("Genesis 1") === null && parseRef("") === null);
t("the URL is the free-use API",          urlFor(parseRef("Psalm 23")) === "https://bible.helloao.org/api/BSB/PSA/23.json");
t("verses flatten, footnotes drop",       (() => {
  const lines = toLines({ chapter: { content: [
    { type: "heading", content: ["The LORD Is My Shepherd"] },
    { type: "hebrew_subtitle", content: ["A Psalm of David."] },
    { type: "verse", number: 1, content: [{ text: "The LORD is my shepherd;", poem: 1 }, { noteId: 50 }, { text: "I shall not want.", poem: 2 }] },
    { type: "line_break" },
  ] } });
  return lines.length === 3
      && lines[0].kind === "heading"
      && lines[2].text === "The LORD is my shepherd; I shall not want."
      && !JSON.stringify(lines).includes("noteId");
})());
t("a missing chapter yields nothing, quietly", toLines(null).length === 0 && toLines({}).length === 0);

/* -------- carrying the text: the whole round trip -------- */

// A Cache API and a network, in memory. The point is to prove that what
// fetchInto stores is what readCached later finds, without going near a real
// link — the failure the live build had was in exactly that seam.
const shelf = new Map();
globalThis.caches = {
  open: async () => ({
    keys: async () => [...shelf.keys()].map((url) => ({ url })),
    match: async (url) => (shelf.has(url)
      ? { json: async () => JSON.parse(shelf.get(url)) }
      : undefined),
    put: async (url, res) => { shelf.set(url, JSON.stringify(await res.json())); },
  }),
  delete: async () => { shelf.clear(); return true; },
};

const CHAPTER = { chapter: { content: [
  { type: "heading", content: ["The LORD Is My Shepherd"] },
  { type: "verse", number: 1, content: [{ text: "The LORD is my shepherd;" }, { noteId: 50 }] },
] } };
let calls = 0, failNext = false;
globalThis.fetch = async () => {
  calls++;
  if (failNext) return { ok: false, status: 503, clone: () => ({}), json: async () => ({}) };
  const body = JSON.stringify(CHAPTER);
  const make = () => ({ ok: true, status: 200, json: async () => JSON.parse(body), clone: () => make() });
  return make();
};

const psalm = parseRef("Psalm 23");
const before = await readCached(psalm);
t("nothing is aboard to begin with",      before === null);
t("and nothing was fetched to find out",  calls === 0);

const first = await fetchInto([psalm]);
t("the carry reports what it got",        first.got === 1 && first.failed === 0 && first.done === 1);

const carried = await readCached(psalm);
t("what was carried is what is read",     carried !== null && toLines(carried)[1].text === "The LORD is my shepherd;");
t("reading the cache uses no network",    calls === 1);

const second = await fetchInto([psalm]);
t("a second carry does not re-fetch",     second.already === 1 && second.got === 0 && calls === 1);

// The same must hold when the cache will not enumerate itself, or a resumed
// download would quietly pull thirteen megabytes a second time.
const noKeys = globalThis.caches.open;
globalThis.caches.open = async () => { const c = await noKeys(); delete c.keys; return c; };
const blind = await fetchInto([psalm]);
t("and not even without cache.keys()",    blind.already === 1 && blind.got === 0 && calls === 1);
globalThis.caches.open = noKeys;

failNext = true;
const bad3 = await fetchInto([parseRef("Mark 3")]);
t("a refused chapter is counted, not thrown", bad3.failed === 1 && bad3.got === 0);
failNext = false;

let seen = 0;
await fetchInto([parseRef("Matthew 1"), parseRef("Matthew 2")], () => { seen++; });
t("progress is reported per chapter",     seen === 2);

/* -------- marks -------- */

const psa23 = { book: "PSA", chapter: 23, label: "Psalm 23" };
let m = {};
m = toggleMark(m, psa23, 1, "gold");
t("a verse takes a colour",               colourOf(m, psa23, 1) === "gold");
t("a different verse is untouched",       colourOf(m, psa23, 2) === null);
m = toggleMark(m, psa23, 1, "foam");
t("a second colour replaces the first",   colourOf(m, psa23, 1) === "foam");
m = toggleMark(m, psa23, 1, "foam");
t("the same colour lifts the mark",       colourOf(m, psa23, 1) === null);
t("marks key by book, chapter and verse", Object.keys(toggleMark({}, psa23, 6, "gold"))[0] === "PSA.23.6");

const lines = [
  { kind: "heading", text: "The LORD Is My Shepherd" },
  { kind: "verse", n: 1, text: "The LORD is my shepherd; I shall not want." },
  { kind: "verse", n: 2, text: "He makes me lie down in green pastures;" },
];
const found = marksIn(toggleMark({}, psa23, 2, "oxide"), psa23, lines);
t("marked verses come back in order",     found.length === 1 && found[0].verse === 2);
t("headings are never marked",            marksIn({ "PSA.23.1": "gold" }, psa23, lines).every((x) => x.verse));
t("a mark quotes itself for the note",    quote(found[0]) === '"He makes me lie down in green pastures;" — Psalm 23:2');

/* -------- the reading is a place, not a pop-out -------- */

const wordSide = renderToString(
  <WordTab C={TD} dark wide plan={{ psalm: "Psalm 23", nt: "Matthew 1" }} readDay={23}
    isRead={false} reflection="" marks={{}} onReflect={noop} onRead={noop} onUnread={noop}
    onMarks={noop} refs={[psa23]} aboard={{ have: 2, total: 80 }} loading={null} online
    onCarry={noop} onCarryAll={noop} books={[]} browse={null} onBrowse={noop} />,
).replace(/<!--.*?-->/g, "");
t("the reflection sits with the reading", wordSide.includes("REFLECTION · READING DAY 23") && wordSide.includes("<textarea"));
t("the marker is there to pick up",       wordSide.includes("MARKER") && wordSide.includes("tap a verse") === false);
t("the whole Bible can be carried",       wordSide.includes("Carry the whole Bible"));
t("the gate still holds at forty",        REFLECT_MIN === 40 && wordSide.includes("40 more"));

// Freeze panes: the references and the note stay put, the chapter goes past.
const sticky = (wordSide.match(/position:sticky/g) || []).length;
t("the reference head is frozen",         wordSide.includes("TODAY") && sticky >= 2);
t("a browsed chapter names itself frozen", (() => {
  const browsed = renderToString(
    <WordTab C={TD} dark wide plan={{ psalm: "Psalm 23", nt: "Matthew 1" }} readDay={23}
      isRead={false} reflection="" marks={{}} onReflect={noop} onRead={noop} onUnread={noop}
      onMarks={noop} refs={[{ book: "GEN", chapter: 3, label: "Genesis 3" }]}
      aboard={{ have: 1, total: 1 }} loading={null} online onCarry={noop} onCarryAll={noop}
      books={[{ id: "GEN", commonName: "Genesis", numberOfChapters: 50 }]}
      browse={{ book: "GEN", chapter: 3 }} onBrowse={noop} />).replace(/<!--.*?-->/g, "");
  return browsed.includes("Genesis 3") && !browsed.includes(">TODAY<");
})());

/* -------- the whole canon -------- */

t("every book has chapters",              allRefs([{ id: "GEN", name: "Genesis", numberOfChapters: 50 }]).length === 50);
t("refs carry a readable label",          allRefs([{ id: "PSA", commonName: "Psalms", numberOfChapters: 2 }])[1].label === "Psalms 2");

console.log(bad ? `\n${bad} FAILED` : "\nall assertions hold");
process.exit(bad ? 1 : 0);
