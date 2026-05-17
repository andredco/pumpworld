import { ActionSchema, type Action } from "@pumpworld/protocol";
import { brainSamplingTemperature } from "../../config.js";
import { stripCodeFences } from "../../util/brainJson.js";
import { acquireOpenAiSlot } from "./openaiRateLimit.js";
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
    const body = {
      model: this.model,
      messages,
      temperature: brainSamplingTemperature(),
      max_tokens: req.maxTokens,
      response_format: { type: "json_object" } as const,
      ...(req.seed != null ? { seed: req.seed } : {}),
    };
    const r = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { "authorization": `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${this.id} HTTP ${r.status}: ${await r.text()}`);
    const json = await r.json() as OpenAIChatResp;
    const raw = json.choices?.[0]?.message?.content ?? "";
    return parseDecision(raw, json.usage?.prompt_tokens, json.usage?.completion_tokens);
  }
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
