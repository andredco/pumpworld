/**
 * Always serve apps/web/dist regardless of process.cwd() (Railway/npm workspaces
 * sometimes leave cwd at the monorepo root, so `serve -s dist` pointed at an empty dir).
 *
 * If dist/ is missing (e.g. Railpack ran `npm start` without a separate build step),
 * run the workspace web build once then serve.
 */
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(pkgRoot, "dist");
const indexHtml = path.join(distDir, "index.html");

function findWorkspaceRoot(fromDir) {
  let dir = path.resolve(fromDir);
  for (let i = 0; i < 16; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (Array.isArray(pkg.workspaces) || pkg.workspaces?.packages) {
          return dir;
        }
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function runNpm(args, cwd) {
  return spawnSync("npm", args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
}

function ensureDist() {
  if (fs.existsSync(indexHtml)) return;

  console.error("[web/start] dist/ missing — running a production build…");
  try {
    console.error("[web/start] cwd=", process.cwd(), " pkgRoot=", pkgRoot);
  } catch {
    /* ignore */
  }

  const root = findWorkspaceRoot(pkgRoot);
  const result = root
    ? runNpm(["run", "build", "-w", "@pumpworld/web"], root)
    : runNpm(["run", "build"], pkgRoot);

  if (result.error) {
    console.error("[web/start] Failed to run npm:", result.error.message);
    process.exit(1);
  }

  const code = result.status ?? 1;
  if (code !== 0) {
    console.error(
      "[web/start] Build failed. If vite/tsc are missing, install devDependencies or deploy with Dockerfile.web (see RAILWAY.md).",
    );
    process.exit(code);
  }

  if (!fs.existsSync(indexHtml)) {
    console.error(`[web/start] Still missing ${indexHtml} after build.`);
    process.exit(1);
  }
}

ensureDist();

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
