import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    ssr: "smoke.test.jsx",
    outDir: ".smoke-out",
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "smoke.mjs" } },
  },
});
