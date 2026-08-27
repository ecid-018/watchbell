import React, { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   Which screen, and the phase list under it.

   Watchbell is keyed on the current phase so that logging a port stay or
   a new passage remounts it: the leg preview, the tab and the day's
   record all reset to the new footing rather than being nursed across.
------------------------------------------------------------------ */

import Setup from "./Setup.jsx";
import Watchbell from "./Watchbell.jsx";
import { K, readJSON, writeJSON, writeAutoBackup } from "./storage.js";
import { appendPhase, arrivalUTCOf, currentPhase, endpointsOf, migrate, replaceCurrent } from "./phase.js";
import { exportAll, migrateStores } from "./store.js";

// Storage is brought up to the current schema before anything reads it.
migrateStores();

export default function App() {
  const [phases, setPhases] = useState(() => migrate(readJSON(K.phases, null), readJSON(K.start, null)));
  // null | { mode: "edit" | "next", kind }
  const [editing, setEditing] = useState(null);

  // One backup a day, taken once storage is known to be up to schema.
  useEffect(() => {
    writeAutoBackup(exportAll());
  }, []);

  const phase = currentPhase(phases);

  // Carry a pre-phases install forward on first launch after the update, so a
  // passage already under way does not need re-entering.
  useEffect(() => {
    if (phases.length && !readJSON(K.phases, null)) writeJSON(K.phases, phases);
  }, []);

  const save = (list) => {
    setPhases(list);
    writeJSON(K.phases, list);
    // Keep the pre-phases key in step, so rolling back to the previous build
    // still finds a passage rather than asking for the departure date again.
    const cur = currentPhase(list);
    if (cur?.kind === "voyage") writeJSON(K.start, cur.start);
    setEditing(null);
  };

  // Whatever the ship just did is the best guess at what it does next: tie up at
  // the port you were bound for, or sail from the one you are lying in.
  const prefill = (kind) => {
    const sea = [...phases].reverse().find((p) => p.kind !== "port");
    if (kind === "port") return { kind: "port", port: sea ? endpointsOf(sea).to : "" };
    return {
      kind: "voyage",
      from: phase.kind === "port" ? phase.port : sea ? endpointsOf(sea).to : "",
      utc0: sea ? arrivalUTCOf(sea) : undefined,
    };
  };

  if (!phase || editing) {
    const mode = !phase ? "first" : editing.mode;
    const value = mode === "edit" ? phase : editing?.kind ? prefill(editing.kind) : null;
    return (
      <Setup
        mode={mode}
        value={value}
        onSave={(p) => save(mode === "edit" ? replaceCurrent(phases, p) : appendPhase(phases, p))}
        onCancel={phase ? () => setEditing(null) : null}
      />
    );
  }

  return (
    <Watchbell
      key={`${phase.kind}:${phase.start}`}
      phases={phases}
      onEditPhase={() => setEditing({ mode: "edit" })}
      onNewPhase={(kind) => setEditing({ mode: "next", kind })}
    />
  );
}
