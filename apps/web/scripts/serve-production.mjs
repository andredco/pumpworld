/**
 * Always serve apps/web/dist regardless of process.cwd() (Railway/npm workspaces
 * sometimes leave cwd at the monorepo root, so `serve -s dist` pointed at an empty dir).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(pkgRoot, "dist");
const indexHtml = path.join(distDir, "index.html");

if (!fs.existsSync(indexHtml)) {
  console.error(`[web/start] Missing ${indexHtml} — run npm run build -w @pumpworld/web`);
  try {
    console.error("[web/start] cwd=", process.cwd());
    console.error("[web/start] dist listing:", fs.existsSync(distDir) ? fs.readdirSync(distDir) : "(no dist/)");
  } catch {
    /* ignore */
  }
  process.exit(1);
}

const port = Number(process.env.PORT);
const p = Number.isFinite(port) && port > 0 ? port : 4173;
const listen = `tcp://0.0.0.0:${p}`;

const child = spawn("npx", ["serve", "-s", distDir, "--listen", listen], {
  stdio: "inherit",
  cwd: pkgRoot,
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
