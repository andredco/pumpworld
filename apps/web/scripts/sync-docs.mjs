/**
 * Sync canonical markdown docs into apps/web so the build is self-contained.
 *
 * Why: PublicDocs.tsx imports three markdown files at build time via
 * `?raw`. The canonical sources live at the monorepo root (docs/*.md and
 * AGENTS.md), which works fine when the build context is the whole repo
 * (Dockerfile.web, local dev) but fails on builders that only copy
 * apps/web (Railpack, "deploy from subdir" setups), because the relative
 * path `../../../../../docs/...` escapes the build context.
 *
 * Strategy:
 *   1. If canonical sources are present at the repo root, refresh
 *      apps/web/src/ui/docs/content/*.md from them.
 *   2. If sources are missing (subdir-only build context), assume the
 *      committed copies are good and exit 0.
 *
 * The synced files live under src/ui/docs/content/ and ARE committed,
 * so Vite always resolves the imports regardless of the build context.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const targetDir = path.join(pkgRoot, "src", "ui", "docs", "content");

function findRepoRoot(fromDir) {
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

const repoRoot = findRepoRoot(pkgRoot);

/** Each entry: [absolute source path or null, target filename]. */
const targets = [
  [repoRoot ? path.join(repoRoot, "docs", "PILL_EXPERIMENT.md") : null, "PILL_EXPERIMENT.md"],
  [repoRoot ? path.join(repoRoot, "docs", "ARCHITECTURE.md") : null, "ARCHITECTURE.md"],
  [repoRoot ? path.join(repoRoot, "AGENTS.md") : null, "AGENTS.md"],
];

fs.mkdirSync(targetDir, { recursive: true });

let copied = 0;
let skipped = 0;
const missingTargets = [];

for (const [src, name] of targets) {
  const dest = path.join(targetDir, name);
  if (src && fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    copied++;
    continue;
  }
  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }
  missingTargets.push(name);
}

if (missingTargets.length > 0) {
  console.error(
    `[sync-docs] Missing canonical sources AND no committed copy for: ${missingTargets.join(", ")}.`,
  );
  console.error(
    "[sync-docs] Either run this script from the monorepo root, or commit the files under apps/web/src/ui/docs/content/.",
  );
  process.exit(1);
}

console.log(
  `[sync-docs] copied=${copied} skipped=${skipped} target=${path.relative(pkgRoot, targetDir)}`,
);
