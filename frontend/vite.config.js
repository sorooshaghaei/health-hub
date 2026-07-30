import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "demo" ? "/health-hub/" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
}));
