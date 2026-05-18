import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const previewPort = () => {
  const n = Number(process.env.PORT);
  return Number.isFinite(n) && n > 0 ? n : 4173;
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  /** Railway / Docker: bind public interface and use PORT (fallback 4173 local). */
  preview: {
    host: true,
    port: previewPort(),
    strictPort: true,
  },
  define: {
    __PUMPWORLD_WS__: JSON.stringify(process.env.PUMPWORLD_WS_URL ?? "ws://localhost:8788"),
    __PUMPWORLD_HTTP__: JSON.stringify(process.env.PUMPWORLD_HTTP_URL ?? "http://localhost:8787"),
  },
});
