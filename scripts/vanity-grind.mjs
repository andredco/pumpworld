/**
 * Solana vanity address grinder.
 *
 * Spawns one worker per CPU core. Each worker generates Ed25519 keypairs in a
 * tight loop, base58-encodes the public key, and checks the suffix. First
 * worker to find a hit wins; main thread saves a `solana-keygen`-compatible
 * JSON keypair (64-byte secretKey array — that's the standard format).
 *
 * Usage: node scripts/vanity-grind.mjs <suffix>
 *   e.g. node scripts/vanity-grind.mjs P1LL
 *
 * Output:
 *   <address>.json next to the script. Treat it like a password — that file
 *   IS the wallet.
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { cpus } from "node:os";
import { writeFileSync } from "node:fs";
import nacl from "tweetnacl";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET = new Set(BASE58);

function base58Encode(bytes) {
  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);
  let s = "";
  while (num > 0n) {
    const r = Number(num % 58n);
    num /= 58n;
    s = BASE58[r] + s;
  }
  // Preserve leading zero bytes as '1' chars.
  for (const b of bytes) {
    if (b === 0) s = "1" + s;
    else break;
  }
  return s;
}

if (isMainThread) {
  const suffix = process.argv[2];
  if (!suffix) {
    console.error("usage: node scripts/vanity-grind.mjs <suffix>");
    process.exit(1);
  }
  for (const ch of suffix) {
    if (!ALPHABET.has(ch)) {
      console.error(`'${ch}' is not in Solana's base58 alphabet — pick another character.`);
      console.error(`Allowed chars: ${BASE58}`);
      process.exit(1);
    }
  }

  const cores = Math.max(1, cpus().length - 1); // leave one core for OS
  console.log(`grinding for suffix "${suffix}" across ${cores} workers…`);
  const startedMs = Date.now();
  let totalAttempts = 0;
  let solved = false;

  // Periodic stats heartbeat
  const tick = setInterval(() => {
    if (solved) return;
    const sec = (Date.now() - startedMs) / 1000;
    const rate = totalAttempts / sec;
    process.stdout.write(`\r  ${totalAttempts.toLocaleString()} attempts · ${rate.toFixed(0)}/s · ${sec.toFixed(1)}s elapsed   `);
  }, 1000);

  const here = fileURLToPath(import.meta.url);
  const workers = [];
  for (let i = 0; i < cores; i++) {
    const w = new Worker(here, { workerData: { suffix } });
    w.on("message", msg => {
      if (msg.type === "stats") {
        totalAttempts += msg.batch;
      } else if (msg.type === "hit" && !solved) {
        solved = true;
        clearInterval(tick);
        process.stdout.write("\n");
        const sec = ((Date.now() - startedMs) / 1000).toFixed(1);
        console.log(`\n✓ found ${msg.address} in ${sec}s after ~${totalAttempts.toLocaleString()} attempts`);

        // Save in solana-keygen-compatible format: 64-byte array (secret + public).
        // tweetnacl already returns secretKey as 64 bytes (32 priv + 32 pub).
        const out = `${msg.address}.json`;
        writeFileSync(out, JSON.stringify(Array.from(msg.secretKey)));
        console.log(`  saved keypair to: ${out}`);
        console.log(`  → import with: solana-keygen pubkey ${out}`);
        console.log(`  → never share this file. It IS the wallet.`);

        for (const w of workers) w.terminate();
        process.exit(0);
      }
    });
    w.on("error", err => console.error("[worker]", err));
    workers.push(w);
  }
} else {
  const { suffix } = workerData;
  const REPORT_EVERY = 5000;
  let n = 0;
  let done = false;
  while (!done) {
    const kp = nacl.sign.keyPair();
    const addr = base58Encode(kp.publicKey);
    if (addr.endsWith(suffix)) {
      parentPort.postMessage({
        type: "hit",
        address: addr,
        publicKey: Array.from(kp.publicKey),
        secretKey: Array.from(kp.secretKey),
      });
      done = true;
      break;
    }
    n++;
    if (n >= REPORT_EVERY) {
      parentPort.postMessage({ type: "stats", batch: n });
      n = 0;
    }
  }
}
