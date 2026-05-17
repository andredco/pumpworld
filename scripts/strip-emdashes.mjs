/**
 * One-shot utility to strip em-dashes from project docs.
 *
 * Replacement strategy:
 *   " — "  → ". "    (sentence break is the natural meaning)
 *   "— "   → ". "
 *   " —"   → "."
 *   "—"    → ", "    (any orphan, treat as a comma)
 *   "–"    → "-"     (en-dash to hyphen-minus)
 *
 * Run: node scripts/strip-emdashes.mjs
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const FILES = [
  "README.md",
  "WHITEPAPER.md",
  "AGENTS.md",
  "docs/TOKEN.md",
  "docs/DEPLOY.md",
  "docs/AGENTS.md",
  "docs/ARCHITECTURE.md",
  "docs/AI_PROVIDERS.md",
  "docs/ROADMAP.md",
];

function clean(s) {
  return s
    .replace(/ — /g, ". ")
    .replace(/— /g, ". ")
    .replace(/ —/g, ".")
    .replace(/—/g, ", ")
    .replace(/–/g, "-");
}

let changed = 0;
for (const rel of FILES) {
  const p = resolve(process.cwd(), rel);
  try { statSync(p); } catch { console.log(`skip (missing): ${rel}`); continue; }
  const before = readFileSync(p, "utf8");
  const after = clean(before);
  if (before !== after) {
    writeFileSync(p, after);
    const diff = (before.match(/—/g) ?? []).length + (before.match(/–/g) ?? []).length;
    console.log(`cleaned ${rel} (${diff} chars)`);
    changed++;
  } else {
    console.log(`clean already: ${rel}`);
  }
}
console.log(`\ndone. ${changed} file(s) changed.`);
