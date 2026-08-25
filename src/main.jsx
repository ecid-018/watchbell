import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App.jsx";
import "./index.css";

// Precache the whole build and take over as soon as a new one lands. There is
// nothing to prompt about — no unsaved server state, and a satellite window may
// be seconds long.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
