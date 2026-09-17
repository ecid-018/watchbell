import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App.jsx";
import "./index.css";
import { replayWAL } from "./storage.js";

// Replay any half-written WAL entries before the app reads storage
replayWAL();

// Ask to be kept. A home-screen web app's storage is evictable — iOS may
// clear it under pressure, and everything this app knows is in it. The answer
// is the browser's to give and it is asked once; it never blocks the boot.
// Plans → the storage line reports what the answer was.
navigator.storage?.persist?.().catch(() => {});

// Precache the whole build and take over as soon as a new one lands. There is
// nothing to prompt about — no unsaved server state, and a satellite window may
// be seconds long.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
