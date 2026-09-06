/* ------------------------------------------------------------------
   PLACEHOLDER DATA — replace with the real 41-job transcription.

   This file stands in for the notebook backlog until it is replaced. The
   rows below cover every field variant the importer and the UI understand
   — the exact ids the spec named (S03/S04 recurring, D09/C06/F03 uncertain
   wording, S06/C11 port-only) — so once the real list is pasted in over
   this array, nothing else in the app needs to change: this schema is
   what everything downstream reads.

   Fields:
     id           stable notebook id — never regenerated, never reused.
                  Promoting an item to today's list keeps this id, which
                  is what makes re-importing the list idempotent.
     group        batches the PSC view and the backlog status report —
                  "no point sending someone to the bilges twice."
     title, note  note becomes the job's `detail` once promoted.
     priority     "normal" | "urgent" | "psc" | "defect" — psc/defect
                  items cannot be dropped, only done or deferred.
     where        "sea" | "port" (default "sea") — a "port" item stays
                  hidden until a Ship Event of type Arrival is declared.
     check        true = the notebook transcription is uncertain and
                  needs confirming against the original.
     fabrication  true = needs workshop/fabrication time.
     recurring    null | "weekly" — a weekly item goes to the admin
                  cadence system instead of the pool (see day, below).
     day          "mon".."sun" — required when recurring is "weekly".
------------------------------------------------------------------ */

export const BACKLOG = [
  {
    id: "S03",
    group: "Sounding & Tanks",
    title: "Weekly bilge well sounding round",
    note: "All engine room bilge wells, forward and aft. Log any abnormal accumulation.",
    priority: "normal",
    where: "sea",
    check: false,
    fabrication: false,
    recurring: "weekly",
    day: "mon",
  },
  {
    id: "S04",
    group: "Sounding & Tanks",
    title: "Weekly sludge tank sounding",
    note: "Cross-check against the ORB's running total.",
    priority: "normal",
    where: "sea",
    check: false,
    fabrication: false,
    recurring: "weekly",
    day: "thu",
  },
  {
    id: "D09",
    group: "Deck & Hull",
    title: "Fabricate a blanking flange for the No.2 sea chest",
    note: "Uncertain wording — check the size called for against the notebook.",
    priority: "normal",
    where: "sea",
    check: true,
    fabrication: true,
    recurring: null,
  },
  {
    id: "C06",
    group: "Cargo Systems",
    title: "Renew the cargo pump gland packing, No.3",
    note: "Uncertain wording — confirm which pump this refers to against the notebook.",
    priority: "psc",
    where: "sea",
    check: true,
    fabrication: false,
    recurring: null,
  },
  {
    id: "F03",
    group: "Fire & Safety",
    title: "Replace the corroded fire main isolation valve, frame 84",
    note: "Uncertain wording — the frame number in the notebook is smudged.",
    priority: "defect",
    where: "sea",
    check: true,
    fabrication: false,
    recurring: null,
  },
  {
    id: "S06",
    group: "Sounding & Tanks",
    title: "Gauge and certify the fresh water tanks before loading stores",
    note: "Port task — surfaces once an Arrival is declared.",
    priority: "normal",
    where: "port",
    check: false,
    fabrication: false,
    recurring: null,
  },
  {
    id: "C11",
    group: "Cargo Systems",
    title: "Open up and inspect the cargo manifold valves alongside",
    note: "Port task — surfaces once an Arrival is declared.",
    priority: "urgent",
    where: "port",
    check: false,
    fabrication: false,
    recurring: null,
  },
];

/** Suggested sequencing — not enforced anywhere, just a reading order for
    working through the pool. */
export const PHASES = [
  { id: "before-departure", title: "Before departure", jobIds: ["D09", "C06", "F03"] },
  { id: "at-sea", title: "At sea", jobIds: ["S03", "S04"] },
  { id: "before-arrival", title: "Before arrival", jobIds: ["S06", "C11"] },
];
