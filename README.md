# Watchbell

Daily discipline log for a passage. Offline-first PWA, installable to the iPad
home screen. No backend, no accounts, and no network calls at runtime — once the
icon has been launched with a connection, the network can stay down for the rest
of the voyage.

Live at **https://ecid-018.github.io/watchbell/**.

---

## Running it

```bash
npm install
npm run icons     # once — regenerates public/icons, already committed
npm run dev       # http://localhost:5173
npm run build     # → dist/
npm run preview   # serve the production build locally
npm test          # renders every screen and checks the plan reader
```

Node 20.19+ or 22.12+ (built on 24.x).

---

## Deploying

Pushing to `main` is the whole deploy. `.github/workflows/deploy.yml` builds on a
runner and publishes `dist/` to GitHub Pages; nothing needs building locally.

```bash
git push          # → https://ecid-018.github.io/watchbell/ in about 30 seconds
gh run list       # watch it land
```

Because this is a Pages **project site** it is served from the subpath
`/watchbell/`, which three settings must agree on or the service worker registers
with the wrong scope and offline launch fails: `base` in `vite.config.js`, and
`start_url` and `scope` in the manifest block of the same file. All three are
`/watchbell/`. Moving to a root domain means changing all three back to `/`.

> **The one thing that will catch you out at sea.** A service worker only registers on
> **HTTPS** or on **`localhost`**. Serving `dist/` from a laptop on the ship's LAN over
> plain `http://192.168.x.x` will *not* register the worker, and the app will *not* work
> offline — it will look fine until the link drops, then fail. Install from the real
> HTTPS URL above once while the satellite is up.

Any other static host works the same way — `npm run build`, upload `dist/`, over HTTPS.

---

## Installing to the iPad home screen

1. Open the URL in **Safari**. Chrome and Firefox on iOS cannot add to the home screen.
2. Share → **Add to Home Screen** → Add.
3. **Launch it once from the home-screen icon while you still have a connection.** This
   is what fills the precache. It takes a couple of seconds.
4. After that the network can stay down indefinitely.

To confirm it took: turn on Airplane Mode and launch from the icon. You should get the
full app, not a Safari error page.

It opens full screen with no browser chrome, and the header and footer clear the status
bar and the home indicator.

### Portrait and landscape

Both are laid out deliberately. Portrait is a single column. Landscape — anything at
least 780 px wide and wider than it is tall — splits the card: standing context down a
fixed left rail, the working list on the right, each scrolling on its own so a whole
day fits one screen. The test is width *and* shape, because Split View is landscape by
orientation while being a portrait-shaped sliver.

### Updating a deployed copy

The worker is `autoUpdate`: once a push to `main` has deployed, the next launch **with a
connection** picks it up and the one after that runs it. Nothing to tap. Your logged
data is untouched by an update — it lives in `localStorage`, not in the cache.

---

## The clock leads

Ship's time, from the iPad's own clock, sits at the top of the rail, and under it the
activity the current minute belongs to: its window, its thread colour, its tick, and
what is up next.

The current item is the last one to have started. Before the first start of the day
that is the *last* item of the schedule — the night belongs to lights out. Stood-down
items are skipped, so on a day with no session the afternoon belongs to the admin
block rather than to something that is not happening. While you preview another leg
the band stays live and says so, because it answers "what should I be doing now",
which a look-ahead cannot change.

**Set the iPad to ship's time.** "Today" is the device's local date, so the log rolls
over when the ship's day does.

---

## Phases: at sea, or alongside

What the ship is doing is held as an ordered list of phases, oldest first, each stamped
with the day it began. A phase is never closed out — a date resolves by finding the last
phase that had begun by then, so tying up alongside is one append and the day you did it
needs no edit. That is also what keeps the rolling seven honest across the join: the sea
days in the window still score against sea legs.

### A passage

Configured by its two ends, not by a fixed route: departure port, arrival port,
departure date, days at sea, and the UTC offset at each end. The legs draw themselves —
one per hour of clock you put on or take off — and the trading session retimes with
them.

That works because of what the original leg table turned out to be. Every cash open in
it resolves to **13:30 UTC** exactly, from 08:30 at UTC−5 to 19:00 at UTC+5:30. It was
never route data; it was the New York open written in whatever time the ship was
keeping. `openForUTC()` in `schedule.js` derives it, so a passage between any two ports
on earth retimes correctly with no table to maintain.

An optional **no-session** day range cuts its own leg — name days 27 to 29 and you get a
three-day leg, not the two clock legs those days happen to touch. Those days score out
of a shorter day rather than against you, and the reason shows on the session row.

### A port stay

Open-ended, with its own local cash open and a trading-alongside toggle. The day keeps
its shape; only the session retimes. It lasts until you log the next passage.

### After arrival

Day 41 of a 40-day passage raises the question itself, and Standing → *Log arrival*
raises it any time. The next passage prefills from the last: arrive at Mundra, tie up,
put to sea, and the departure port and UTC offset are already filled in.

A passage logged before voyages became configurable keeps its named legs and its
Agulhas stand-down rather than being re-cut mid-ocean. Editing one shows the fields it
would become and says plainly that saving re-cuts it.

---

## The reading

The plan runs on a continuous counter that does not reset when a phase does — day 40 of
a passage is followed by day 41 alongside, not by Psalm 1 again.

**A reading is not logged until it has been thought about.** Tapping it opens a
reflection rather than setting a flag; forty characters — about a sentence — before it
will mark it read. Untick lives in the same sheet, which is what keeps the reflection
reachable afterwards instead of stranded behind a completed checkbox. Writing one closes
both the 05:35 item and that day's entry on the plan, because it is one act. Days
already read before the gate existed keep their tick: the rule applies to the act of
ticking, not retroactively.

---

## The Body tab

`src/data/training-plan.js` is the source of truth: a seven-day rotation, selected by
the weekday of the day on screen. Previewing a leg previews its training too — the leg
picks a voyage day, the day picks a date, the date picks the session.

Three sections: warm-up folded away because you know it, the main block open because it
is the session, finisher and cool-down folded because they come after.

### The session timer

Bouts are read from the plan's own `time` and `rounds` fields. Each movement contributes
one bout per round in plan order, so Monday's hard/easy pair alternates and Wednesday's
four movements cycle. A movement naming both halves on one line (`3:30 work + 3:30 easy`)
splits in two. Where the `format` line names a rest the block does not list as a
movement, it follows every work bout — that is Wednesday's 30 on, 30 off. A line like
`4 × 8–12` has no readable duration and correctly declines to become a bout.

| `kind` | Behaviour |
|---|---|
| HIIT, Easy | Interval run over the plan's bouts |
| Strength | Plain stopwatch — the sets are yours to pace |
| Rest | No timer at all, rather than an invitation |

Three-second count-in before every work bout, a rising two-tone for work and a single
falling tone for rest. Sound is synthesised with WebAudio — there is nothing to fetch
and nothing to fail. The screen is held awake with `navigator.wakeLock`, re-acquired
when the app comes back to the foreground. Everything is timestamp-driven rather than
decremented, so a slept screen or a backgrounded app cannot make the clock lie.

The Body panel stays mounted when you change tabs, so a stray tap cannot throw away a
session that is running.

> iOS mutes WebAudio when the device is muted in Control Centre, and a transition tone
> that falls while the app is backgrounded is missed. The countdown itself stays correct.

### Heavy weather

The toggle in the Body header arms itself from the leg — a stood-down leg is the Cape,
or whatever stretch you named — and your own call overrides it either way, because you
are the one who can feel the ship. It is remembered for the day and logged with the
session. A session with a non-null `heavyWeather` array swaps its whole main block; one
without keeps what it has and says so.

### Form demonstrations

`src/components/ExerciseFigure.jsx` holds animated SVG figures — offline, no images, no
network. Nine movements carry a `figure` key in the plan and open in place to show the
figure with its form cue; the running one also appears above the countdown mid-session.
Open the same movement three times and it stops asking for attention: the chevron goes
quiet, the figure stays a tap away. Counts live in `watchbell:figures`.

The treadmill days (Monday, Saturday) have no figures in their normal block, because
there is nothing to demonstrate about a belt. The figures cluster on the bodyweight
days, which is where form goes wrong.

To add one: draw it in `ExerciseFigure.jsx`, then add `figure: "its-key"` to the
matching movement in the plan. `npm test` fails if a key does not resolve, or if the
same movement name carries two different keys.

---

## The figures on the Standing tab

All computed from the stored daily records on every read — nothing is cached or rolled
up, so back-filling a day immediately corrects everything. The walk is over *dates*, and
each date resolves against whichever phase covered it.

| Figure | How it is worked out |
|---|---|
| **Rolling seven days** | The seven calendar days ending today. Each day's percentage is worked out against *that day's own leg* — a stood-down day is scored out of 11 items, not 12 — and the seven percentages are averaged with equal weight per day. Today is included and still in progress, so the number climbs as you log. A day with no record is a real 0%. |
| **Grace days** | Two per calendar week, reset Monday. Any day finishing under 50% burns one. Only **Monday to yesterday** is judged — today is never scored, or you would burn a grace day at 06:00 every morning. The tile turns oxide red at zero. |
| **On plan** | Over the same seven days, how many trade-enabled days had the trading session ticked. Days on a stood-down leg are excluded from both sides, as is a port stay logged as no trading alongside. |
| **Trained** | Sessions marked complete over the same seven days, against the days that had a session to do at all. Rest days are not counted on either side. |

*By thread* and *X of Y logged today* always report **today**, even while you are
previewing another leg.

---

## Stored data

Everything is in `localStorage` on the iPad. Nothing leaves the ship.

| Key | Holds |
|---|---|
| `watchbell:log:YYYY-MM-DD` | One record per calendar day: `{"wake":true,"word":true,…}` |
| `watchbell:train:YYYY-MM-DD` | The day's session: `{"key":"hiit-floor","completed":true,"heavy":false}` |
| `watchbell:phases` | The ordered phase list — passages and port stays |
| `watchbell:read` | Reading-plan progress, keyed by the continuous reading day |
| `watchbell:reflect` | One reflection per reading day |
| `watchbell:figures` | How many times each form figure has been opened |
| `watchbell:mode` | `"auto"` / `"light"` / `"dark"` |
| `watchbell:voyageStart` | Pre-phases departure date. Still read on first launch after an update, and still written, so a rollback finds it |

Every access is wrapped defensively: if iOS refuses `localStorage` (storage pressure,
private browsing) the app drops to session-only rather than failing to start.

Deleting the home-screen icon deletes this data. If you want a copy, Settings → Safari
is not enough — read the keys out via a desktop browser on the same URL.

---

## Layout of the source

```
index.html                    meta tags; JS-managed theme-color
vite.config.js                React + PWA plugin, manifest, workbox precache rules
scripts/gen-icons.mjs         one-shot icon generator (ship's bell, sharp)
scripts/smoke.mjs             headless runner for the checks below
smoke.test.jsx                renders every screen; checks the plan reader
src/
  main.jsx                    mount + service-worker registration
  App.jsx                     phase list, and which screen
  Setup.jsx                   standing orders — a passage or a port stay
  Watchbell.jsx               the shell: clock, now-band, rail, tabs
  BodyTab.jsx                 the day's training
  Timer.jsx                   interval run and stopwatch
  Reflection.jsx              the reading gate
  components/
    ExerciseFigure.jsx        animated SVG form demonstrations
  data/
    training-plan.js          the seven-day rotation and the safety rules
  theme.js                    F (fonts) and THEME (colours)
  schedule.js                 BASE, TAGS, itemsForLeg(), the cash-open derivation
  phase.js                    routes, generated legs, the phase list
  voyage.js                   date arithmetic, and nothing else
  training.js                 reading the plan; the bout queue
  stats.js                    rolling seven, grace days, on plan, trained
  storage.js                  localStorage keys and safe accessors
  useLandscape.js             is there room to work side by side
watchbell.original.jsx        the untouched component this was built from
```

Tailwind is doing layout only (`flex`, `px-5`, `rounded-[22px]`). Every colour, font
and size comes from the inline styles driven by `theme.js`, which is why
`tailwind.config.js` has no theme extension to keep in sync.

Every typeface is a system stack — SF Pro, New York, SF Mono. No webfonts are
fetched, which is part of why the app is genuinely usable with the network down.
