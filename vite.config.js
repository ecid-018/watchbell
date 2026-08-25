import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Subpath deploy: GitHub Pages project site at ecid-018.github.io/watchbell/.
  // This AND manifest.start_url AND manifest.scope must stay identical, or the
  // service worker registers with the wrong scope and offline launch will fail.
  base: "/watchbell/",

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],

      manifest: {
        name: "Watchbell",
        short_name: "Watchbell",
        description:
          "Daily discipline log for a passage. New Orleans to India via the Cape of Good Hope.",
        start_url: "/watchbell/",
        scope: "/watchbell/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#08151A",
        theme_color: "#0E1C22",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        // Precache the entire build. The app makes no network calls at runtime, so
        // once this cache is warm the network can stay down indefinitely.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        // Resolve a cold offline launch (and any deep link) back to the shell.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },

      // Lets offline behaviour be exercised in `npm run dev`, not only after a build.
      devOptions: { enabled: true, type: "module" },
    }),
  ],
});
