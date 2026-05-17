import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  define: {
    __PUMPWORLD_WS__: JSON.stringify(process.env.PUMPWORLD_WS_URL ?? "ws://localhost:8788"),
    __PUMPWORLD_HTTP__: JSON.stringify(process.env.PUMPWORLD_HTTP_URL ?? "http://localhost:8787"),
  },
});
