/* ------------------------------------------------------------------
   Watchbell — engine room backlog
   Transcribed from the pocket notebook, 05 SEP 2026.
   Horizon: September passage through arrival India, October.

   where:    sea | port | either
   priority: defect | psc | normal | cosmetic
   Some readings were unclear in the photos — those are marked
   `check: true`. Correct them in this file, not in the app.
------------------------------------------------------------------ */

export const BACKLOG = [
  /* ============================================ DEFECTS — rectify */
  { id: "D01", title: "Rectify diesel oil leak, clean adjacent areas", priority: "defect", where: "sea", group: "Defects",
    note: "Oil leak plus stained deck is a classic PSC finding. Do this one first." },
  { id: "D02", title: "Rectify M/E cyl high-TBN LO level gauge — leaking, valve head missing", priority: "defect", where: "sea", group: "Defects" },
  { id: "D03", title: "Repair F.W.G. ejector pipe outlet", priority: "defect", where: "sea", group: "Defects" },
  { id: "D04", title: "Rectify leak at steering gear hydraulic oil hand pump", priority: "defect", where: "sea", group: "Steering gear" },
  { id: "D05", title: "Change oil-soaked lagging at purifier sludge tank suction piping", priority: "defect", where: "sea", group: "Defects",
    note: "Oil-soaked lagging is a fire hazard and an inspection magnet." },
  { id: "D06", title: "Clean purifier sludge tank sounding pipe; fabricate proper sounding pipe insert in place of seizing wire", priority: "defect", where: "sea", group: "Defects" },
  { id: "D07", title: "Urea residue stains — clean up and trace source of leak", priority: "defect", where: "sea", group: "SCR / urea" },
  { id: "D08", title: "Replace busted light bulb, emergency fire pump space", priority: "defect", where: "sea", group: "Safety" },
  { id: "D09", title: "Overhaul and rectify leak, then wash and repaint affected area", priority: "defect", where: "sea", group: "Defects", check: true,
    note: "Notebook reading unclear — confirm the equipment." },

  /* ================================== PSC / COMPLIANCE — arrival */
  { id: "P01", title: "Clean oily water separator and adjacent areas", priority: "psc", where: "sea", group: "PSC readiness",
    note: "OWS condition is inspected on nearly every boarding." },
  { id: "P02", title: "Empty and clean bilge well underneath M/E", priority: "psc", where: "sea", group: "PSC readiness" },
  { id: "P03", title: "Clean E/R tanktop forward; remove water accumulation at forward part", priority: "psc", where: "sea", group: "PSC readiness" },
  { id: "P04", title: "Incinerate oily rags", priority: "psc", where: "sea", group: "PSC readiness" },
  { id: "P05", title: "Make placards for sewage and grey water changeover valves", priority: "psc", where: "sea", group: "PSC readiness",
    note: "Missing placards on changeover valves is a cheap deficiency to avoid." },
  { id: "P06", title: "Remove gags from FW/DW tank level gauges", priority: "psc", where: "sea", group: "PSC readiness",
    note: "Gagged gauges are a direct finding. Do it now, not on approach." },
  { id: "P07", title: "Standing reminder — fire doors are not to be wedged open", priority: "psc", where: "either", group: "Safety",
    reminder: true },
  { id: "P08", title: "Clean and arrange spare parts room", priority: "psc", where: "sea", group: "PSC readiness" },

  /* ================================================ STEERING GEAR */
  { id: "S01", title: "Fabricate oil scraper for steering gear ram, to catch ram leakage to oil pan", priority: "normal", where: "sea", group: "Steering gear", fabrication: true },
  { id: "S02", title: "Replenish / change rudder carrier oil", priority: "normal", where: "sea", group: "Steering gear" },
  { id: "S03", title: "Grease up ram pins", priority: "normal", where: "sea", group: "Steering gear", recurring: "weekly" },
  { id: "S04", title: "Check and inspect grease station of steering gear", priority: "normal", where: "sea", group: "Steering gear", recurring: "weekly" },
  { id: "S05", title: "Top up steering gear oil tank — No. 2 unit", priority: "normal", where: "sea", group: "Steering gear" },
  { id: "S06", title: "Repack grease of S/G No. 1 and No. 2 chain coupling", priority: "normal", where: "port", group: "Steering gear" },
  { id: "S07", title: "Washpaint steering gear bulkheads, watermist pump start panel", priority: "cosmetic", where: "sea", group: "Steering gear" },

  /* ==================================================== CLEANING */
  { id: "C01", title: "Clean bulkhead at cooler / purifier unit", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C02", title: "Clean UV sterilizer unit", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C03", title: "Clean hydrophore tank", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C04", title: "Clean funnel aft bulkhead with chemical", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C05", title: "Clean grease trap, then return to service", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C06", title: "Clean void space near cofferdams to sewage tank", priority: "normal", where: "sea", group: "Cleaning", check: true },
  { id: "C07", title: "Clean BWTS piping and air piping screen", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C08", title: "Clean main air compressor cooling water gauge glycol", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C09", title: "Clean cascade tank stain below condenser", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C10", title: "Clean waste oil incinerator pilot burner", priority: "normal", where: "sea", group: "Cleaning" },
  { id: "C11", title: "Clean No. 2 central FW cooler — high differential pressure", priority: "normal", where: "port", group: "Cleaning",
    note: "Planned for port. High dP means it's already affecting cooling." },

  /* =============================================== WASHPAINT WORK */
  { id: "W01", title: "Washpaint M/E local operating panel area", priority: "cosmetic", where: "sea", group: "Washpaint" },
  { id: "W02", title: "Washpaint lower deck bulkhead at AC cooling drain pump and adjacent areas", priority: "cosmetic", where: "sea", group: "Washpaint" },
  { id: "W03", title: "Clean / repaint supply module and coaming", priority: "cosmetic", where: "sea", group: "Washpaint" },
  { id: "W04", title: "Washpaint hull bulkhead near boiler to supply unit", priority: "cosmetic", where: "sea", group: "Washpaint" },
  { id: "W05", title: "Retouch discoloration on main air compressors", priority: "cosmetic", where: "sea", group: "Washpaint" },
  { id: "W06", title: "Washpaint E/R machine shop", priority: "cosmetic", where: "sea", group: "Washpaint" },
  { id: "W07", title: "Washpaint nozzle units and pump units of SCR urea system", priority: "cosmetic", where: "sea", group: "SCR / urea" },
  { id: "W08", title: "Washpaint whole incinerator body", priority: "cosmetic", where: "sea", group: "Washpaint" },
  { id: "W09", title: "Clean bulkhead with stains above MGO tank, with chemical", priority: "cosmetic", where: "sea", group: "Washpaint" },

  /* ================================================= FABRICATION */
  { id: "F01", title: "Fabricate additional rack for lub oil and chemicals", priority: "normal", where: "sea", group: "Fabrication", fabrication: true },
  { id: "F02", title: "Fabricate ducting to divert rain ingress staining the bulkhead", priority: "normal", where: "sea", group: "Fabrication", fabrication: true,
    note: "Fixes the cause of W09. Do this before repainting, or you'll paint it twice." },
  { id: "F03", title: "Fabricate piping / hose for a direct drain from control air start piping", priority: "normal", where: "sea", group: "Fabrication", fabrication: true, check: true },
];

/* Suggested sequencing to arrival ------------------------------- */
export const PHASES = [
  { phase: "Now — September, open sea",
    focus: "All defects (D01–D09) and the fabrication jobs. These need workshop time and calm weather, both of which you have now and won't have later." },
  { phase: "Mid-passage",
    focus: "Cleaning group. Steady, low-skill, delegate-friendly work that fills crew days without needing your supervision." },
  { phase: "Post-Cape",
    focus: "Washpaint group. Cosmetic work last — it's the first thing to sacrifice if the schedule slips, and repainting before the leaks are fixed wastes the paint." },
  { phase: "Two weeks before India",
    focus: "PSC readiness group (P01–P08) as a block. Gags removed, placards up, OWS and bilges clean, spare parts room presentable." },
  { phase: "In port / at anchor",
    focus: "S06 chain coupling repack and C11 central FW cooler. Both need the plant off load." },
];
