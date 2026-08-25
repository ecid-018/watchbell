import React from "react";
import { renderToString } from "react-dom/server";
import Watchbell from "./src/Watchbell.jsx";
import Setup from "./src/Setup.jsx";
import { appendPhase, migrate, generateLegs, nameOf, lengthOf, legsOf } from "./src/phase.js";
import BodyTab from "./src/BodyTab.jsx";
import JobsTab from "./src/JobsTab.jsx";
import WeekTab from "./src/WeekTab.jsx";
import PlansTab from "./src/PlansTab.jsx";
import { THEME } from "./src/theme.js";
import { doableForLeg, eveningFor, itemsForLeg } from "./src/schedule.js";
import { dayDoable, dayItems, dueSoon, lostTo, recoveryOn } from "./src/events.js";
import { CARRY_WARN, carriedFor, carryLabel, groupByAssignee, jobsInWindow, makeJob } from "./src/jobs.js";
import { DEFAULT_RANKS, SCHEMA } from "./src/store.js";
import { parseRef, toLines, urlFor } from "./src/bible.js";
import { COOLDOWN, PLAN, RULES, WARMUP, buildIntervals, mainBlock, parseDuration, sessionForDate, timerMode } from "./src/training.js";
import { EXERCISE_KEYS, exerciseCue, exerciseLabel } from "./src/components/ExerciseFigure.jsx";
import { LEARNED_AT } from "./src/BodyTab.jsx";

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
  ["Jobs, empty", <JobsTab C={TD} dark wide={false} jobs={[]} ranks={DEFAULT_RANKS} todayKey={NEW} onAdd={noop} onSet={noop} />],
  ["Jobs, loaded", <JobsTab C={TD} dark wide jobs={[j0, { ...j1, status: "dropped", droppedOn: NEW }]} ranks={DEFAULT_RANKS} todayKey={NEW} onAdd={noop} onSet={noop} />],
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

console.log(bad ? `\n${bad} FAILED` : "\nall assertions hold");
process.exit(bad ? 1 : 0);
