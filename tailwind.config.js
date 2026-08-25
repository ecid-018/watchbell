/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // Deliberately no theme extension. Watchbell drives every colour, font and size
  // through the THEME / F objects in src/theme.js as inline styles. Tailwind is here
  // for layout utilities only, so there is nothing to mirror in this config.
  theme: { extend: {} },
  plugins: [],
};
