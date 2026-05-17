/**
 * Second pass: fix awkward "Sentence. lowercase" or "**bold**. lowercase"
 * artifacts left by the blanket em-dash strip. These are em-dashes that were
 * separating a clause within a sentence, not two sentences.
 *
 * Strategy: find ". " (or ". **") followed by a lowercase letter, replace
 * the period with ", " (comma) or ": " when it follows a bolded label.
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
  // ". lowercase-letter"  → ", lowercase-letter"
  // (but NOT ".\n" line breaks)
  let out = s.replace(/(\S)\. ([a-z])/g, "$1, $2");

  // "**bold**, lowercase"  → "**bold**: lowercase"   (likely a label definition)
  // pattern: bold-end followed by ", word"; only when bold is at start of a bullet
  out = out.replace(/(\*\*[A-Za-z][^*]*\*\*), ([a-z])/g, "$1: $2");

  // " ). lowercase" → "), lowercase"
  out = out.replace(/\)\. ([a-z])/g, "), $1");

  return out;
}

let changed = 0;
for (const rel of FILES) {
  const p = resolve(process.cwd(), rel);
  try { statSync(p); } catch { continue; }
  const before = readFileSync(p, "utf8");
  const after = clean(before);
  if (before !== after) {
    writeFileSync(p, after);
    console.log(`fixed artifacts in ${rel}`);
    changed++;
  }
}
console.log(`\ndone. ${changed} file(s) changed.`);
