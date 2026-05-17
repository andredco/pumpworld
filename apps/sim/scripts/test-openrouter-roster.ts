/**
 * Verifies each Pill World OpenRouter slug responds on the Chat Completions API.
 * Run from repo root: npm run test:models -w @pumpworld/sim
 *
 * Loads .env the same way as the sim (repo root .env).
 *
 * Free-tier models often return HTTP 429 when hit in quick succession; this script
 * spaces requests and retries rate limits with backoff.
 */
import { config } from "../src/config.js";
import { OPENROUTER_ROSTER_HEALTHCHECK } from "../src/world/seed.js";

const URL = "https://openrouter.ai/api/v1/chat/completions";

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

type TryModelResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string; httpStatus?: number; raw?: string };

async function tryModel(model: string, jsonMode: boolean): Promise<TryModelResult> {
  const apiKey = config.openrouter.apiKey?.trim();
  if (!apiKey) return { ok: false, detail: "OPENROUTER_API_KEY missing" };

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content:
          'You must reply with only a JSON object, no other text: {"thought":"ping","action":{"kind":"idle"}}',
      },
    ],
    max_tokens: 200,
    temperature: 0.3,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const r = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "http-referer": config.openrouter.appUrl,
      "x-title": config.openrouter.appTitle,
    },
    body: JSON.stringify(body),
  });

  const raw = await r.text();
  if (!r.ok) {
    return {
      ok: false,
      detail: `HTTP ${r.status}: ${raw.slice(0, 400)}`,
      httpStatus: r.status,
      raw,
    };
  }

  let parsed: {
    choices?: {
      message?: { content?: string | null; refusal?: string | null; reasoning?: string };
      finish_reason?: string;
    }[];
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { ok: false, detail: `Invalid JSON body: ${raw.slice(0, 200)}` };
  }

  const msg = parsed.choices?.[0]?.message;
  const content = msg?.content ?? "";
  if (!content.trim()) {
    const hint = JSON.stringify({
      finish_reason: parsed.choices?.[0]?.finish_reason,
      refusal: msg?.refusal,
      has_reasoning: Boolean(msg?.reasoning),
    });
    return { ok: false, detail: `Empty completion content (${hint})` };
  }

  let stripped = content.trim();
  if (stripped.startsWith("```")) {
    stripped = stripped.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  try {
    const obj = JSON.parse(stripped) as { thought?: unknown; action?: unknown };
    if (obj.action && typeof obj === "object") {
      return { ok: true, detail: `${content.length} chars, parsed JSON action` };
    }
  } catch {
    return { ok: false, detail: `Could not parse JSON from: ${stripped.slice(0, 120)}…` };
  }

  return { ok: false, detail: `Unexpected shape: ${stripped.slice(0, 120)}…` };
}

async function tryModelOnce(model: string): Promise<TryModelResult> {
  let result = await tryModel(model, true);
  if (result.ok) return result;
  if (result.httpStatus === 429) return result;
  result = await tryModel(model, false);
  return result;
}

function retrySecondsFrom429(raw: string | undefined): number {
  if (!raw) return 22;
  try {
    const j = JSON.parse(raw) as {
      error?: { metadata?: { retry_after_seconds?: number } };
    };
    const r = j.error?.metadata?.retry_after_seconds;
    if (typeof r === "number" && r > 0) return Math.ceil(r) + 3;
  } catch {
    /* ignore */
  }
  return 22;
}

async function tryModelWith429Retries(model: string): Promise<TryModelResult> {
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await tryModelOnce(model);
    if (result.ok) return result;

    if (result.httpStatus === 429 && attempt < maxAttempts - 1) {
      const waitMs = retrySecondsFrom429(result.raw) * 1000;
      await sleep(waitMs);
      continue;
    }

    return result;
  }
  return { ok: false, detail: "Exhausted retries" };
}

async function main() {
  console.log("OpenRouter roster healthcheck (JSON completion; spaced requests for free-tier)\n");

  const rows = OPENROUTER_ROSTER_HEALTHCHECK;
  if (rows.length === 0) {
    console.log("No pills use provider openrouter in seed.ts; skipping this script.");
    process.exit(0);
  }
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (i > 0) await sleep(3500);

    process.stdout.write(`${row.castLabel} (${row.pillName}) … `);

    const result = await tryModelWith429Retries(row.model);

    if (result.ok) {
      console.log(`OK — ${result.detail}`);
    } else {
      console.log(`FAIL\n  ${result.detail}`);
      failed++;
    }
  }

  console.log("");
  if (failed > 0) {
    console.error(`${failed}/${rows.length} models failed.`);
    console.error("429 = upstream free-tier rate limit; wait and rerun, or use paid models / BYOK on OpenRouter.");
    process.exit(1);
  }
  console.log(`All ${rows.length} models responded OK.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
