/* ------------------------------------------------------------------
   Typography and colour tokens.
   Lifted verbatim out of the original watchbell.jsx so that non-React
   modules can reference them. Values are unchanged.
------------------------------------------------------------------ */

export const F = {
  ui: '-apple-system, "SF Pro Text", "SF Pro Display", BlinkMacSystemFont, "Helvetica Neue", sans-serif',
  serif: 'ui-serif, "New York", Iowan Old Style, Georgia, serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
};

export const THEME = {
  dark: {
    bg: "#08151A", card: "#0E1C22", panel: "#0B1A20", sub: "#12262C",
    line: "#1B333B", line2: "#24404A", text: "#E9F0EF", text2: "#9DB2B8",
    dim: "#5E7C87", dim2: "#48646E", amber: "#E9B255", foam: "#6FB9A6",
    oxide: "#D0674A", gold: "#C7A86B", fuel: "#7C9CC4", ring: "#2C4A54", track: "#1B333B",
    shadow: "0 24px 60px rgba(0,0,0,.55)",
  },
  light: {
    bg: "#DDE5E8", card: "#F7FAFA", panel: "#EDF2F4", sub: "#FFFFFF",
    line: "#DCE5E8", line2: "#C7D6DB", text: "#10262E", text2: "#3E5B66",
    dim: "#6C848D", dim2: "#8AA0A8", amber: "#96650F", foam: "#1C7A64",
    oxide: "#A2422A", gold: "#7E6428", fuel: "#375C87", ring: "#BDCDD3", track: "#D8E2E5",
    shadow: "0 16px 40px rgba(16,38,46,.14)",
  },
};

/** Resolve the Auto/Light/Dark setting to a concrete boolean for a given moment. */
export const isDark = (mode, now) => {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  const hour = now.getHours();
  return hour >= 18 || hour < 7;
};
