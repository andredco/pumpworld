import { ActionSchema, type Action } from "@pumpworld/protocol";
import { brainSamplingTemperatureAnthropic } from "../../config.js";
import { stripCodeFences } from "../../util/brainJson.js";
import type { BrainProvider, BrainRequest, BrainResponse } from "./types.js";

interface AnthropicResp {
  content: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicProvider implements BrainProvider {
  readonly id = "anthropic" as const;
  constructor(
    public readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.anthropic.com/v1",
  ) {}
  isAvailable() { return Boolean(this.apiKey); }

  async decide(req: BrainRequest): Promise<BrainResponse> {
    if (!this.isAvailable()) throw new Error("anthropic provider not configured");
    const body = {
      model: this.model,
      system: req.systemPrompt,
      messages: [
        {
          role: "user",
          content: `${req.perception}\n\n${req.question}\n\nReply ONLY with a JSON object: {"thought": string, "action": <action>}.`,
        },
      ],
      max_tokens: req.maxTokens,
      temperature: brainSamplingTemperatureAnthropic(),
    };
    const r = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`anthropic HTTP ${r.status}: ${await r.text()}`);
    const json = await r.json() as AnthropicResp;
    const raw = json.content?.find(c => c.type === "text")?.text ?? "";
    return parse(raw, json.usage?.input_tokens, json.usage?.output_tokens);
  }
}

function parse(raw: string, inTok?: number, outTok?: number): BrainResponse {
  const cleaned = stripCodeFences(raw);
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const slice = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  let obj: unknown;
  try { obj = JSON.parse(slice); }
  catch { return { thought: `[unparseable; raw="${raw.slice(0, 120)}"]`, action: { kind: "idle" } }; }
  const o = obj as { thought?: unknown; action?: unknown };
  const thought = typeof o.thought === "string" ? o.thought : "";
  const parsed = ActionSchema.safeParse(o.action);
  const action: Action = parsed.success ? parsed.data : { kind: "idle" };
  return { thought, action, inputTokens: inTok, outputTokens: outTok };
}
