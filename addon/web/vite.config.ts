import { defineConfig } from "vite";

// Ingress serves the add-on under a session-rotating prefix like
// /api/hassio_ingress/<token>/ — using relative `base` keeps asset
// references valid regardless of the actual prefix.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          lit: ["lit", "@lit/context"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8099",
      "/ws": { target: "ws://localhost:8099", ws: true },
    },
  },
});
