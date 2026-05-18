import { ActionSchema, type Action } from "@pumpworld/protocol";
import { brainSamplingTemperature } from "../../config.js";
import { stripCodeFences } from "../../util/brainJson.js";
import { fetchWithTimeout } from "./httpFetch.js";
import type { BrainProvider, BrainRequest, BrainResponse } from "./types.js";

interface OpenAIChatMsg { role: "system" | "user" | "assistant"; content: string }

interface OpenAIChatResp {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Single-key, multi-model brain via openrouter.ai.
 *
 * Model slugs use OpenRouter's vendor/model format. The roster lives in
 * `seed.ts`; UI shows `soul.label` only.
 *
 * **Robustness notes:**
 *   - Many free-tier models do NOT support `response_format: json_object`
 *     and return HTTP 400 / 404 if you send it. We start with json mode on
 *     and fall back automatically if the upstream rejects it. The system
 *     prompt itself enforces JSON output, so the result is identical when
 *     the model behaves; we just stop dying for upstream stylistic
 *     differences.
 *   - 429 rate limits on free models are common; we surface them as a
 *     normal error so the Agent records `[brain error: …]` and the world
 *     keeps running. Retries are not added at this layer because the
 *     simulator already reissues `scheduleThink` every few ticks.
 */
export class OpenRouterProvider implements BrainProvider {
  readonly id = "openrouter" as const;

  /**
   * Models we've observed reject `response_format: json_object`. Once we
   * see a model fail with that param, we cache the slug here and never
   * send it again for that model. Cheap optimisation; resets on restart.
   */
  private static jsonModeBlocklist = new Set<string>();

  constructor(
    public readonly model: string,
    private readonly apiKey: string,
    private readonly appUrl: string,
    private readonly appTitle: string,
  ) {}

  isAvailable() { return Boolean(this.apiKey); }

  async decide(req: BrainRequest): Promise<BrainResponse> {
    if (!this.isAvailable()) throw new Error("openrouter provider not configured");
    const messages: OpenAIChatMsg[] = [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: `${req.perception}\n\n${req.question}` },
    ];

    const useJsonMode = !OpenRouterProvider.jsonModeBlocklist.has(this.model);

    let result = await this.callOnce(messages, req, useJsonMode);

    // If the model rejected json_object mode (4xx), retry once without it.
    if (result.kind === "rejected_json_mode" && useJsonMode) {
      OpenRouterProvider.jsonModeBlocklist.add(this.model);
      result = await this.callOnce(messages, req, false);
    }

    if (result.kind === "error") {
      throw new Error(`openrouter HTTP ${result.status}: ${result.body}`);
    }
    if (result.kind === "rejected_json_mode") {
      // Both attempts (with and without json mode) returned this code path —
      // means the upstream is unhappy for unrelated reasons. Treat as error.
      throw new Error(`openrouter rejected request shape twice for model ${this.model}`);
    }

    const json = result.json;
    const raw = json.choices?.[0]?.message?.content ?? "";
    return parseDecision(raw, json.usage?.prompt_tokens, json.usage?.completion_tokens);
  }

  private async callOnce(
    messages: OpenAIChatMsg[],
    req: BrainRequest,
    jsonMode: boolean,
  ): Promise<{ kind: "ok"; json: OpenAIChatResp } | { kind: "rejected_json_mode" } | { kind: "error"; status: number; body: string }> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: brainSamplingTemperature(),
      max_tokens: req.maxTokens,
      ...(req.seed != null ? { seed: req.seed } : {}),
    };
    if (jsonMode) body.response_format = { type: "json_object" };

    const r = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${this.apiKey}`,
        // OpenRouter's optional but recommended headers for app attribution
        "http-referer": this.appUrl,
        "x-title": this.appTitle,
      },
      body: JSON.stringify(body),
    }, { providerLabel: "openrouter" });

    if (r.ok) {
      const json = await r.json() as OpenAIChatResp;
      return { kind: "ok", json };
    }

    const text = await r.text();
    // Detect "this model doesn't support response_format" patterns. Different
    // upstreams say this in different ways; pattern-match conservatively.
    if (
      jsonMode
      && (r.status === 400 || r.status === 404)
      && /response_format|json[_ -]?(object|mode)|json_schema/i.test(text)
    ) {
      return { kind: "rejected_json_mode" };
    }

    return { kind: "error", status: r.status, body: text.slice(0, 600) };
  }
}

function parseDecision(raw: string, inTok?: number, outTok?: number): BrainResponse {
  const stripped = stripCodeFences(raw);
  let obj: unknown;
  try {
    obj = JSON.parse(stripped);
  } catch {
    // Some free models prepend prose then a JSON block. Try to find the first
    // {...} balanced object as a fallback before giving up entirely.
    const recovered = extractFirstJsonObject(stripped);
    if (recovered) {
      try { obj = JSON.parse(recovered); } catch { obj = null; }
    }
    if (!obj) {
      return { thought: `[unparseable JSON; raw="${raw.slice(0, 120)}"]`, action: { kind: "idle" } };
    }
  }
  const o = obj as { thought?: unknown; action?: unknown };
  const thought = typeof o.thought === "string" ? o.thought : "";
  const parsed = ActionSchema.safeParse(o.action);
  const action: Action = parsed.success ? parsed.data : { kind: "idle" };
  return { thought, action, inputTokens: inTok, outputTokens: outTok };
}

/** Tiny brace-balanced JSON extractor for free-model output that wraps the
 *  object in commentary. Returns null if no balanced top-level object is
 *  present; the caller falls back to an `idle` action. */
function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
