/**
 * Same as `npm run dev` but forces genesis (no snapshot resume).
 * Sets PUMPWORLD_FRESH_START=1 for the child process only.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const simRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env, PUMPWORLD_FRESH_START: "1" };

const child = spawn("npx", ["tsx", "watch", "src/index.ts"], {
  cwd: simRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
