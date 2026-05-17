import { ActionSchema, type Action } from "@pumpworld/protocol";
import { brainSamplingTemperature } from "../../config.js";
import { stripCodeFences } from "../../util/brainJson.js";
import type { BrainProvider, BrainRequest, BrainResponse } from "./types.js";

interface OpenAIChatMsg { role: "system" | "user" | "assistant"; content: string }

interface OpenAIChatResp {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_BASE = "https://api.minimax.io/v1";

/** Strip internal reasoning blocks MiniMax returns ahead of user-visible text. */
function stripMiniMaxThinking(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, "").trim();
}

/**
 * MiniMax developer API (OpenAI-compatible chat completions).
 * @see https://platform.minimax.io/docs/api-reference/text-chat-openai
 */
export class MiniMaxProvider implements BrainProvider {
  readonly id = "minimax" as const;

  constructor(
    public readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE,
  ) {}

  isAvailable(): boolean {
    return Boolean(this.apiKey.trim() && this.baseUrl.trim());
  }

  async decide(req: BrainRequest): Promise<BrainResponse> {
    if (!this.isAvailable()) throw new Error("minimax provider not configured");
    const root = this.baseUrl.replace(/\/$/, "");
    const url = `${root}/chat/completions`;

    const messages: OpenAIChatMsg[] = [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: `${req.perception}\n\n${req.question}` },
    ];

    const maxOut = Math.min(Math.max(1, req.maxTokens), 2048);

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: brainSamplingTemperature(),
      max_completion_tokens: maxOut,
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`minimax HTTP ${r.status}: ${await r.text()}`);

    const json = await r.json() as OpenAIChatResp;
    const raw = stripMiniMaxThinking(json.choices?.[0]?.message?.content ?? "");
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
