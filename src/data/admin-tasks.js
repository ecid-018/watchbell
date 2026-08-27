/* ------------------------------------------------------------------
   Watchbell — Chief Engineer admin tasks
   The source of truth for what shows up in the two admin slots. Edit
   this file directly to add, remove or re-cadence a task — there is no
   in-app editor beyond ticking one off or deferring it a day.

   Shape of a task:
     key      stable id — storage key for completion/deferral, never reuse
     title    shown on the row
     detail   shown when the row is expanded
     note     optional — extra line shown under detail when expanded
     est      minutes, used for the slot's "N tasks · M min" header and
              for flagging a slot that is running over its window
     critical true for compliance items: cannot be deferred more than
              one day, and show a warning once carried
     slot     "am" | "pm" — which admin block the task lives in.
              Omit for cadence "trigger": those ignore slots entirely.
     cadence  "daily"    — due every day
              "3day"     — due once 3+ days have passed since last done
              "weekly"   — due on `day`; missed, it stays due and carries
              "monthly"  — due once ~30 days have passed since last done
              "quarterly"— due once ~90 days have passed since last done
              "trigger"  — due only when today's Ship Event matches `trigger`
     day      "mon".."sun" — required when cadence is "weekly"
     trigger  "Arrival" | "Departure" | "Bunkering" — required when
              cadence is "trigger"
     vaultPrompt  true — completing the task offers to add a dated entry
                  to the Plans vault
------------------------------------------------------------------ */

export const ADMIN = [
  // ---- daily ----
  {
    key: "sounding-log",
    title: "Daily sounding log",
    detail: "FO, DO, LO, FW, bilge and sludge tank soundings. Log ROB and compute the day's consumption.",
    est: 15,
    critical: true,
    slot: "am",
    cadence: "daily",
  },
  {
    key: "orb",
    title: "Oil Record Book entries",
    detail: "Part I. Any transfer, purification, sludge or bilge operation from the day. Entries made same day, signed, no blank lines, no pencil.",
    note: "The single most-inspected book in a PSC boarding. Never let it run behind.",
    est: 15,
    critical: true,
    slot: "pm",
    cadence: "daily",
  },
  {
    key: "email-am",
    title: "Email — morning",
    detail: "Read and triage only. Anything needing a considered reply goes to the PM slot.",
    est: 10,
    critical: false,
    slot: "am",
    cadence: "daily",
  },
  {
    key: "email-pm",
    title: "Email — afternoon",
    detail: "Write the replies deferred from the morning. Office correspondence, superintendent, technical queries.",
    est: 20,
    critical: false,
    slot: "pm",
    cadence: "daily",
  },
  {
    key: "logbook",
    title: "Engine room logbook review",
    detail: "Check and countersign the watchkeepers' entries. Query anything inconsistent the same day, not at month end.",
    est: 10,
    critical: true,
    slot: "am",
    cadence: "daily",
  },
  {
    key: "params",
    title: "Machinery parameter check",
    detail: "ME/AE exhaust temps, scavenge, bearing temps, LO pressures. You're looking for drift over days, not absolute values.",
    est: 10,
    critical: false,
    slot: "am",
    cadence: "daily",
  },
  {
    key: "jobs-brief",
    title: "Set the day's jobs",
    detail: "Assign work to the engine crew, review yesterday's carry-overs.",
    est: 10,
    critical: false,
    slot: "am",
    cadence: "daily",
  },

  // ---- 3-day ----
  {
    key: "night-orders",
    title: "Night Order Book",
    detail: "Written instructions for the UMS/duty engineer. Reissue on any change of condition — weather, machinery status, port approach — regardless of when the last one was written.",
    est: 15,
    critical: true,
    slot: "pm",
    cadence: "3day",
  },

  // ---- weekly ----
  {
    key: "pms",
    title: "PMS jobs — due and overdue",
    detail: "Review what falls due this week, raise the jobs, close out completed ones with proper remarks.",
    est: 30,
    critical: true,
    slot: "pm",
    cadence: "weekly",
    day: "mon",
  },
  {
    key: "spares",
    title: "Spares and stores review",
    detail: "Stock levels against critical spares list. Raise requisitions early — lead times to the next port are the constraint, not the need.",
    est: 25,
    critical: false,
    slot: "pm",
    cadence: "weekly",
    day: "wed",
  },
  {
    key: "emergency-test",
    title: "Emergency equipment tests",
    detail: "Emergency generator on load, emergency fire pump, steering gear, quick-closing valves as scheduled. Log every test.",
    est: 30,
    critical: true,
    slot: "pm",
    cadence: "weekly",
    day: "thu",
  },
  {
    key: "garbage-log",
    title: "Garbage Record Book",
    detail: "Entries current and signed. Cross-check against actual disposals and incinerator running hours.",
    est: 10,
    critical: false,
    slot: "pm",
    cadence: "weekly",
    day: "fri",
  },
  {
    key: "consumption",
    title: "Consumption and ROB report",
    detail: "FO/DO/LO/FW consumption to the office. Reconcile against the daily soundings — a mismatch found now is a leak found now.",
    est: 20,
    critical: false,
    slot: "pm",
    cadence: "weekly",
    day: "fri",
  },
  {
    key: "toolbox",
    title: "Engine department meeting",
    detail: "Toolbox talk, coming week's work, any safety item. Minute it.",
    est: 20,
    critical: false,
    slot: "pm",
    cadence: "weekly",
    day: "sat",
  },

  // ---- monthly ----
  {
    key: "lo-samples",
    title: "Lube oil samples",
    detail: "Draw ME/AE system oil and cylinder drain samples, label, log, land at next port.",
    est: 40,
    critical: false,
    slot: "pm",
    cadence: "monthly",
  },
  {
    key: "defect-list",
    title: "Machinery defect list update",
    detail: "Open defects, repair status, what needs office or shore assistance.",
    est: 30,
    critical: true,
    slot: "pm",
    cadence: "monthly",
    vaultPrompt: true,
  },
  {
    key: "monthly-report",
    title: "Monthly technical report",
    detail: "Office report — machinery condition, running hours, consumption, defects, spares status.",
    est: 60,
    critical: false,
    slot: "pm",
    cadence: "monthly",
  },
  {
    key: "dcs-cii",
    title: "Fuel data — DCS / CII",
    detail: "IMO Data Collection System figures and CII tracking. Verify before submission, not after.",
    est: 25,
    critical: true,
    slot: "pm",
    cadence: "monthly",
  },
  {
    key: "refrigerant",
    title: "Refrigerant / ODS record",
    detail: "Ozone Depleting Substances Record Book. Log any top-up, leak or recharge.",
    est: 10,
    critical: false,
    slot: "pm",
    cadence: "monthly",
  },
  {
    key: "critical-equip",
    title: "Critical equipment test log",
    detail: "Blackout recovery, emergency steering, bilge alarm and OWS function. Log results.",
    est: 45,
    critical: true,
    slot: "pm",
    cadence: "monthly",
  },

  // ---- quarterly ----
  {
    key: "standing-orders",
    title: "Review CE Standing Orders",
    detail: "Reissue on crew change or any change of operating regime, whichever comes first.",
    est: 30,
    critical: false,
    slot: "pm",
    cadence: "quarterly",
  },
  {
    key: "manuals",
    title: "Manuals and procedures currency",
    detail: "Oil transfer procedures, SOPEP/SMPEP engine sections, SEEMP. Check revisions against office circulars.",
    est: 40,
    critical: false,
    slot: "pm",
    cadence: "quarterly",
  },

  // ---- trigger (ignore slots, appear only when the matching Ship Event
  // is set for today, and take priority over everything else in the list) ----
  {
    key: "pre-arrival",
    title: "Pre-arrival engine checks",
    detail: "Machinery to manoeuvring condition, steering gear test, telegraph test, ballast plan reviewed, ORB current.",
    est: 45,
    critical: true,
    cadence: "trigger",
    trigger: "Arrival",
  },
  {
    key: "psc-prep",
    title: "PSC readiness sweep",
    detail: "ORB, Garbage Book, sample locker, OWS and 15 ppm alarm, emergency generator, fire dampers, ER cleanliness.",
    est: 90,
    critical: true,
    cadence: "trigger",
    trigger: "Arrival",
  },
  {
    key: "bunker-plan",
    title: "Bunkering plan and checklist",
    detail: "Tank plan, sequence, overflow margins, agreed rate, communication and shutdown signals, pre-transfer conference.",
    est: 60,
    critical: true,
    cadence: "trigger",
    trigger: "Bunkering",
  },
  {
    key: "bunker-close",
    title: "Bunkering close-out",
    detail: "BDN filed, MARPOL retained sample sealed and stowed in the locker, ORB entry made, soundings recorded.",
    est: 30,
    critical: true,
    cadence: "trigger",
    trigger: "Bunkering",
  },
  {
    key: "pre-departure",
    title: "Pre-departure checks",
    detail: "Sea-going condition, sludge and bilge status confirmed adequate for the passage, stores and spares landed or received.",
    est: 30,
    critical: false,
    cadence: "trigger",
    trigger: "Departure",
  },
];

/** The two admin slots' time windows, in minutes — used to flag a slot
    that is carrying more estimated work than it has room for. */
export const SLOTS = {
  am: { minutes: 30 },
  pm: { minutes: 60 },
};
