/* ------------------------------------------------------------------
   Watchbell — training plan
   7-day rotation. Shipboard: treadmill + bodyweight only.
   Every session fits the 05:50–06:40 window.

   heavyWeather[] replaces the whole main block when the sea state
   makes the treadmill or airborne movements unsafe.
------------------------------------------------------------------ */

export const WARMUP = {
  tread: [
    { name: "Easy walk", detail: "5 km/h", time: "3 min" },
    { name: "Build to jog", detail: "6–7 km/h", time: "2 min" },
    { name: "Leg swings, each side", detail: "front-back, then side-side", reps: "10 each" },
  ],
  floor: [
    { name: "Arm circles", detail: "forward then back", reps: "15 each" },
    { name: "Bodyweight squats", detail: "slow, full depth", reps: "15" },
    { name: "World's greatest stretch", detail: "lunge, rotate, reach", reps: "5 each side", figure: "worlds-greatest-stretch" },
    { name: "Inchworm to push-up", detail: "walk hands out, one push-up", reps: "6" },
  ],
};

export const COOLDOWN = [
  { name: "Easy walk", detail: "5 km/h or deck pacing", time: "4 min" },
  { name: "Hip flexor stretch", detail: "half-kneeling, tuck the pelvis", time: "45 s each" },
  { name: "Hamstring stretch", detail: "foot on bench, hinge at hip", time: "45 s each" },
  { name: "Doorway chest stretch", detail: "forearm on frame, step through", time: "45 s each" },
  { name: "Child's pose", detail: "breathe into the ribs", time: "60 s" },
];

export const PLAN = [
  /* ---------------------------------------------------------- MONDAY */
  {
    day: "Mon",
    key: "hiit-tread-a",
    kind: "HIIT",
    name: "Treadmill intervals",
    gear: "Treadmill",
    duration: 26,
    warmup: "tread",
    format: "60 s hard / 90 s easy · 8 rounds",
    main: [
      { name: "Hard interval", detail: "8.5–10 km/h, flat. RPE 8/10.", time: "60 s", rounds: 8 },
      { name: "Easy interval", detail: "5 km/h walk. Stay on the belt.", time: "90 s", rounds: 8 },
    ],
    finisher: [{ name: "Plank", detail: "elbows under shoulders, ribs down", time: "3 × 45 s" }],
    progression: "Add one round every second week, to a ceiling of 10. Then raise the hard pace by 0.5 km/h and drop back to 8.",
    heavyWeather: [
      { name: "Squat pulses", detail: "bottom third of the range", time: "40 s", rounds: 5 },
      { name: "Mountain climbers", detail: "hips low, controlled", time: "40 s", rounds: 5 },
      { name: "Dead bug", detail: "opposite arm and leg, lower back flat", time: "40 s", rounds: 5, figure: "dead-bug" },
      { name: "Glute bridge march", detail: "hips high, alternate knees", time: "40 s", rounds: 5, figure: "glute-bridge-march" },
    ],
  },

  /* --------------------------------------------------------- TUESDAY */
  {
    day: "Tue",
    key: "str-push",
    kind: "Strength",
    name: "Push and core",
    gear: "Bodyweight",
    duration: 35,
    warmup: "floor",
    format: "4 sets · 90 s rest between sets",
    main: [
      { name: "Feet-elevated push-ups", detail: "feet on bunk or chair, chest to deck", reps: "4 × 8–12" },
      { name: "Pike push-ups", detail: "hips high, crown toward the deck", reps: "4 × 6–10", figure: "pike-push-up" },
      { name: "Bench dips", detail: "hands on bunk edge, elbows back not out", reps: "4 × 10–15" },
      { name: "Hollow hold", detail: "lower back pressed flat", time: "4 × 30 s", figure: "hollow-hold" },
      { name: "Side plank", detail: "stack the feet, hips high", time: "3 × 30 s each" },
    ],
    finisher: [{ name: "Push-up burnout", detail: "one set to two reps short of failure", reps: "1 × max" }],
    progression: "When you clear 12 reps on all four push-up sets, raise the feet higher or slow the lowering to 3 seconds.",
    heavyWeather: null,
  },

  /* ------------------------------------------------------- WEDNESDAY */
  {
    day: "Wed",
    key: "hiit-floor",
    kind: "HIIT",
    name: "Upper conditioning",
    gear: "Bodyweight",
    duration: 20,
    warmup: "floor",
    format: "30 s work / 30 s rest · 6 rounds through",
    main: [
      { name: "Push-up to shoulder tap", detail: "resist the hip rotation", time: "30 s", rounds: 6 },
      { name: "Bear crawl", detail: "knees an inch off the deck, short steps", time: "30 s", rounds: 6, figure: "bear-crawl" },
      { name: "Renegade row", detail: "wide feet, row a water bottle or dumbbell", time: "30 s", rounds: 6, figure: "renegade-row" },
      { name: "Flutter kicks", detail: "hands under the hips, small fast kicks", time: "30 s", rounds: 6 },
    ],
    finisher: [{ name: "Dead hang", detail: "from the pull-up bar, shoulders active", time: "3 × 30 s" }],
    progression: "Cut the rest to 20 s before adding rounds.",
    heavyWeather: [
      { name: "Floor press", detail: "lying, elbows to the deck", time: "30 s", rounds: 6 },
      { name: "Seated knee tuck", detail: "braced against the bulkhead", time: "30 s", rounds: 6 },
      { name: "Plank shoulder tap", detail: "wide base for stability", time: "30 s", rounds: 6 },
    ],
  },

  /* -------------------------------------------------------- THURSDAY */
  {
    day: "Thu",
    key: "str-pull",
    kind: "Strength",
    name: "Pull and legs",
    gear: "Bodyweight",
    duration: 35,
    warmup: "floor",
    format: "4 sets · 90 s rest between sets",
    main: [
      { name: "Pull-ups or inverted rows", detail: "full hang, chest to the bar", reps: "4 × 5–10" },
      { name: "Reverse lunges", detail: "step back, front shin vertical", reps: "4 × 10 each" },
      { name: "Bulgarian split squat", detail: "rear foot on the bunk, slow down", reps: "3 × 8 each", figure: "bulgarian-split-squat" },
      { name: "Calf raises", detail: "on a step, full stretch at the bottom", reps: "4 × 15–20" },
      { name: "Superman hold", detail: "squeeze the glutes, look at the deck", time: "3 × 30 s" },
    ],
    finisher: [{ name: "Wall sit", detail: "thighs parallel, back flat", time: "2 × 60 s" }],
    progression: "Add a slow 3-second lowering phase before adding reps. On lunges, hold a full water can in each hand.",
    heavyWeather: null,
  },

  /* ---------------------------------------------------------- FRIDAY */
  {
    day: "Fri",
    key: "hiit-tread-b",
    kind: "HIIT",
    name: "Treadmill pyramid",
    gear: "Treadmill",
    duration: 28,
    warmup: "tread",
    format: "30 / 45 / 60 / 45 / 30 s hard, equal easy between · 3 blocks",
    main: [
      { name: "Pyramid block", detail: "raise the incline to 4–6 %, hold 7–8 km/h. Match each hard bout with equal easy walking.", time: "3:30 work + 3:30 easy", rounds: 3 },
      { name: "Full recovery", detail: "walk 5 km/h, flat, until breathing settles", time: "2 min between blocks" },
    ],
    finisher: [{ name: "Hanging knee raise", detail: "no swing, control the lower", reps: "3 × 10", figure: "hanging-knee-raise" }],
    progression: "Raise the incline by 1 % every two weeks before touching the speed. Incline is safer than pace on a moving deck.",
    heavyWeather: [
      { name: "Wall sit", detail: "back flat to the bulkhead", time: "45 s", rounds: 4 },
      { name: "Glute bridge hold", detail: "hips locked out", time: "45 s", rounds: 4 },
      { name: "Seated flutter", detail: "braced, legs low", time: "45 s", rounds: 4 },
      { name: "Plank", detail: "wide feet for stability", time: "45 s", rounds: 4 },
    ],
  },

  /* -------------------------------------------------------- SATURDAY */
  {
    day: "Sat",
    key: "zone2",
    kind: "Easy",
    name: "Zone 2 jog",
    gear: "Treadmill",
    duration: 40,
    warmup: "tread",
    format: "35 min conversational pace",
    main: [
      { name: "Steady jog", detail: "6–7 km/h, flat. You should be able to speak a full sentence. If you can't, slow down.", time: "35 min" },
    ],
    finisher: [{ name: "Full mobility circuit", detail: "run the whole cool-down list twice", time: "8 min" }],
    progression: "Add 5 minutes every second week to a ceiling of 50. Do not add pace — this session stays easy by design.",
    heavyWeather: [
      { name: "Deck circuit walk", detail: "handrails, inside decks only, brief the bridge first", time: "25 min" },
      { name: "Full mobility circuit", detail: "in the cabin", time: "10 min" },
    ],
  },

  /* ---------------------------------------------------------- SUNDAY */
  {
    day: "Sun",
    key: "rest",
    kind: "Rest",
    name: "Rest day",
    gear: null,
    duration: 0,
    warmup: null,
    format: "Nothing. Rest is part of the plan.",
    main: [],
    finisher: [],
    progression: "If you feel like training, that's a sign the week was calibrated correctly. Still rest.",
    heavyWeather: null,
  },
];

/* Safety rules the UI enforces --------------------------------- */
export const RULES = {
  treadmillLanyard: "Clip the emergency stop lanyard every session, without exception.",
  seaState: "No treadmill and no airborne movement when the ship is rolling. The Cape leg is treated as heavy weather by default.",
  effort: "RPE 8 of 10 on hard intervals, not 10. The session you can repeat on Friday beats the one that empties you on Monday.",
  hardDayCap: "Never more than three hard days a week, never two back to back.",
};
