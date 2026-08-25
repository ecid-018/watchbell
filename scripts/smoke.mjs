/* Runs the built smoke bundle under a minimal browser stand-in.
   The app is rendered with react-dom/server, so only the globals its module
   bodies touch on the way in need to exist. Anything the app actually calls
   at runtime — localStorage, wake lock, audio — is already written to fail
   soft, which is what lets this run headless at all. */

globalThis.window = {
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  localStorage: { getItem: () => null, setItem() {} },
};
globalThis.document = {
  getElementById: () => null,
  addEventListener() {},
  removeEventListener() {},
  documentElement: { style: {} },
  body: { style: {} },
  visibilityState: "visible",
};

await import("../.smoke-out/smoke.mjs");
