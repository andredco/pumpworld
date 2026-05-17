import { ActionSchema, type Action } from "@pumpworld/protocol";
import { brainSamplingTemperature } from "../../config.js";
import { stripCodeFences } from "../../util/brainJson.js";
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
 */
export class OpenRouterProvider implements BrainProvider {
  readonly id = "openrouter" as const;
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
    const body = {
      model: this.model,
      messages,
      temperature: brainSamplingTemperature(),
      max_tokens: req.maxTokens,
      response_format: { type: "json_object" } as const,
      ...(req.seed != null ? { seed: req.seed } : {}),
    };
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${this.apiKey}`,
        // OpenRouter's optional but recommended headers for app attribution
        "http-referer": this.appUrl,
        "x-title": this.appTitle,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`openrouter HTTP ${r.status}: ${await r.text()}`);
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
