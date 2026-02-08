import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Build output is deployed under /test on SiteGround, so we need relative asset URLs.
  base: command === "build" ? "./" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev convenience so the web app can call the API without CORS setup.
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      }
    }
  }
}));
