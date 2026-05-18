import { ActionSchema, type Action } from "@pumpworld/protocol";
import { brainSamplingTemperature } from "../../config.js";
import { stripCodeFences } from "../../util/brainJson.js";
import { acquireOpenAiSlot } from "./openaiRateLimit.js";
import { fetchWithTimeout } from "./httpFetch.js";
import type { BrainProvider, BrainRequest, BrainResponse } from "./types.js";

interface OpenAIChatMsg { role: "system" | "user" | "assistant"; content: string }

interface OpenAIChatResp {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Speaks the OpenAI Chat Completions wire format. Works for:
 *   - OpenAI (id="openai", baseUrl=https://api.openai.com/v1)
 *   - xAI    (id="xai",    baseUrl=https://api.x.ai/v1)
 *   - Anything OpenAI-compatible: Ollama, vLLM, LM Studio, OpenRouter, Together (id="oss")
 */
export class OpenAICompatibleProvider implements BrainProvider {
  constructor(
    public readonly id: "openai" | "xai" | "oss",
    public readonly model: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  isAvailable() { return Boolean(this.baseUrl) && (Boolean(this.apiKey) || this.id === "oss"); }

  async decide(req: BrainRequest): Promise<BrainResponse> {
    if (!this.isAvailable()) throw new Error(`${this.id} provider not configured`);
    if (this.id === "openai") await acquireOpenAiSlot();
    const messages: OpenAIChatMsg[] = [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: `${req.perception}\n\n${req.question}` },
    ];
    // Per-model max-completion-tokens caps. Sending more than the model
    // accepts is an immediate HTTP 400 — gpt-3.5-turbo and the older 4o-mini
    // snapshots all top out at 4096. The brain's JSON output is small (a
    // thought + one action), so 1024 is plenty even for a long blog_post
    // body which we already truncate at write-time.
    const maxTokens = clampMaxTokensForModel(this.model, req.maxTokens);
    const body = {
      model: this.model,
      messages,
      temperature: brainSamplingTemperature(),
      max_tokens: maxTokens,
      response_format: { type: "json_object" } as const,
      ...(req.seed != null ? { seed: req.seed } : {}),
    };
    const r = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { "authorization": `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    }, { providerLabel: this.id });
    if (!r.ok) throw new Error(`${this.id} HTTP ${r.status}: ${await r.text()}`);
    const json = await r.json() as OpenAIChatResp;
    const raw = json.choices?.[0]?.message?.content ?? "";
    return parseDecision(raw, json.usage?.prompt_tokens, json.usage?.completion_tokens);
  }
}

/**
 * Per-model completion-token caps. Sending more than the model documents is
 * an immediate HTTP 400 (Hazel and Sable were dying every think on
 * gpt-3.5-turbo because the global default was 8192).
 *
 * Conservative numbers — the brain's JSON output is small. If a future
 * model is added, the default 4096 still works for nearly everything.
 */
function clampMaxTokensForModel(model: string, requested: number): number {
  const m = model.toLowerCase();
  let cap = 4096; // safe default
  if (m.includes("gpt-3.5")) cap = 4096;
  else if (m.includes("gpt-4o-mini")) cap = 16384;
  else if (m.includes("gpt-4.1-nano")) cap = 32768;
  else if (m.includes("gpt-4.1-mini")) cap = 32768;
  else if (m.includes("gpt-4.1")) cap = 32768;
  else if (m.includes("gpt-4o")) cap = 16384;
  else if (m.includes("gpt-4-turbo")) cap = 4096;
  return Math.max(256, Math.min(requested, cap));
}

function parseDecision(raw: string, inTok?: number, outTok?: number): BrainResponse {
  const stripped = stripCodeFences(raw);
  let obj: unknown;
  try {
    obj = JSON.parse(stripped);
  } catch {
    return { thought: `[unparseable JSON; raw="${raw.slice(0, 120)}"]`, action: { kind: "idle" } };
  }
  const o = obj as { thought?: unknown; action?: unknown };
  const thought = typeof o.thought === "string" ? o.thought : "";
  const parsed = ActionSchema.safeParse(o.action);
  const action: Action = parsed.success ? parsed.data : { kind: "idle" };
  return { thought, action, inputTokens: inTok, outputTokens: outTok };
}
