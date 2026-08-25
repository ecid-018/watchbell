/* ------------------------------------------------------------------
   Is there room to work side by side.

   Keyed off width *and* shape rather than orientation alone: an iPad in
   Split View is landscape by orientation while being a portrait-shaped
   sliver, and the two-column layout would be unreadable in it.
------------------------------------------------------------------ */

import { useEffect, useState } from "react";

const QUERY = "(min-width: 780px) and (min-aspect-ratio: 1/1)";

const match = () => typeof window !== "undefined" && window.matchMedia(QUERY).matches;

export function useLandscape() {
  const [wide, setWide] = useState(match);

  useEffect(() => {
    const m = window.matchMedia(QUERY);
    const on = (e) => setWide(e.matches);
    m.addEventListener("change", on);
    setWide(m.matches); // rotation between first paint and this effect
    return () => m.removeEventListener("change", on);
  }, []);

  return wide;
}
