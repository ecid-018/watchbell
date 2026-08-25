# Watchbell

Daily discipline log for a passage — New Orleans to India via the Cape of Good Hope.
Offline-first PWA, installable to the iPad home screen. No backend, no accounts, and
no network calls at runtime.

---

## Running it

```bash
npm install
npm run icons     # once — regenerates public/icons, already committed
npm run dev       # http://localhost:5173
npm run build     # → dist/
npm run preview   # serve the production build locally
```

Node 20.19+ or 22.12+ (built on 24.x).

---

## Deploying

Build, then put `dist/` on any static host **over HTTPS**:

```bash
npm run build
```

Netlify Drop, Vercel, Cloudflare Pages and GitHub Pages all work — the app is a
directory of static files with nothing behind it.

> **The one thing that will catch you out at sea.** A service worker only registers on
> **HTTPS** or on **`localhost`**. Serving `dist/` from a laptop on the ship's LAN over
> plain `http://192.168.x.x` will *not* register the worker, and the app will *not* work
> offline — it will look fine until the link drops, then fail. Deploy it to a real HTTPS
> URL once while the satellite is up.

Deploying to a **subpath** (e.g. `example.com/watchbell/`) means changing three things
together, or the worker registers with the wrong scope: `base` in `vite.config.js`, and
`start_url` and `scope` in the manifest block of the same file.

---

## Installing to the iPad home screen

1. Open the URL in **Safari**. Chrome and Firefox on iOS cannot add to the home screen.
2. Share → **Add to Home Screen** → Add.
3. **Launch it once from the home-screen icon while you still have a connection.** This
   is what fills the precache. It takes a couple of seconds.
4. After that the network can stay down indefinitely.

To confirm it took: turn on Airplane Mode and launch from the icon. You should get the
full app, not a Safari error page.

It opens full screen with no browser chrome, locked to portrait, and the header and
footer clear the status bar and the home indicator.

### Updating a deployed copy

The worker is `autoUpdate`: when a new build is deployed, the next launch **with a
connection** picks it up and the one after that runs it. Nothing to tap. Your logged
data is untouched by an update — it lives in `localStorage`, not in the cache.

---

## How it decides what day it is

On first launch it asks for the departure date and stores it. From then on the day
count and the leg come from the iPad's own clock:

```
voyage day = (today − departure) + 1        clamped to 1..40
leg        = the LEGS entry whose d0..d1 contains that day
```

**Set the iPad to ship's time.** "Today" is the device's local date, so the log rolls
over when the ship's day does. The `UTC ±n` in the header is the leg's own metadata and
is not used for this.

Tapping a leg is a **look-ahead preview**: the day retimes and the schedule shows, but
the checkboxes go inert and dim so you cannot accidentally pre-tick a day that has not
happened. The footer tells you how to get back; tapping today's own leg snaps back to
live. Days past 40 hold at day 40 rather than running off the end.

To change the departure date later: **Standing** tab → *Passage began … · change*.

---

## The figures on the Standing tab

All three are computed from the stored daily records on every read — nothing is
cached or rolled up, so back-filling a day immediately corrects everything.

| Figure | How it is worked out |
|---|---|
| **Rolling seven days** | The seven calendar days ending today. Each day's percentage is worked out against *that day's own leg* — a Cape day is scored out of 11 items, not 12 — and the seven percentages are averaged with equal weight per day. Today is included and still in progress, so the number climbs as you log. A day with no record is a real 0%. |
| **Grace days** | Two per calendar week, reset Monday. Any day finishing under 50% burns one. Only **Monday to yesterday** is judged — today is never scored, or you would burn a grace day at 06:00 every morning. The tile turns oxide red at zero. |
| **On plan** | Over the same seven days, how many trade-enabled days had the trading session ticked. Days on a stood-down leg (rounding the Cape) are excluded from both sides, so the Agulhas transit does not count against the record. |

*By thread* and *X of Y logged today* always report **today**, even while you are
previewing another leg.

---

## Stored data

Everything is in `localStorage` on the iPad. Nothing leaves the ship.

| Key | Holds |
|---|---|
| `watchbell:log:YYYY-MM-DD` | One record per calendar day: `{"wake":true,"word":true,…}` |
| `watchbell:read` | Bible-plan progress, keyed by **voyage day**: `{"12":true,…}` |
| `watchbell:mode` | `"auto"` / `"light"` / `"dark"` |
| `watchbell:voyageStart` | Departure date, `"YYYY-MM-DD"` |

Every access is wrapped defensively: if iOS refuses `localStorage` (storage pressure,
private browsing) the app drops to session-only rather than failing to start.

Deleting the home-screen icon deletes this data. If you want a copy, Settings → Safari
is not enough — read the keys out via a desktop browser on the same URL, or export
before removing.

---

## Layout of the source

```
index.html            meta tags; JS-managed theme-color
vite.config.js        React + PWA plugin, manifest, workbox precache rules
scripts/gen-icons.mjs one-shot icon generator (ship's bell, sharp)
src/
  main.jsx            mount + service-worker registration
  App.jsx             first-run gate → Watchbell
  Setup.jsx           departure-date screen
  Watchbell.jsx       the UI
  theme.js            F (fonts) and THEME (colours)
  schedule.js         LEGS, BASE, TAGS, the reading plan, itemsForLeg()
  voyage.js           date ↔ voyage day ↔ leg
  stats.js            rolling seven, grace days, on plan
  storage.js          localStorage keys and safe accessors
watchbell.original.jsx  the untouched component this was built from
```

`theme.js` and `schedule.js` hold constants lifted **verbatim** out of the original
component so that `stats.js` can score past days without rendering anything. Layout,
colours and typography are unchanged from `watchbell.original.jsx` — diff against it
to confirm.

Tailwind is doing layout only (`flex`, `px-5`, `rounded-[22px]`). Every colour, font
and size comes from the inline styles driven by `theme.js`, which is why
`tailwind.config.js` has no theme extension to keep in sync.

Every typeface is a system stack — SF Pro, New York, SF Mono. No webfonts are
fetched, which is part of why the app is genuinely usable with the network down.
