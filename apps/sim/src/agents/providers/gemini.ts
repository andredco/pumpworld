import { ActionSchema, type Action } from "@pumpworld/protocol";
import { brainSamplingTemperature, config } from "../../config.js";
import { stripCodeFences } from "../../util/brainJson.js";
import { acquireGeminiSlot } from "./geminiRateLimit.js";
import type { BrainProvider, BrainRequest, BrainResponse } from "./types.js";

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiGenerateResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string; code?: number };
}

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

/** Parses "Please retry in 12.34s." from Gemini quota errors. */
function parseRetryAfterSeconds(message: string): number | null {
  const m = /retry in ([\d.]+)\s*s/i.exec(message);
  if (!m) return null;
  const s = Number(m[1]);
  if (!Number.isFinite(s)) return null;
  return Math.min(120, Math.max(2, s));
}

function isGeminiRateLimitError(message: string): boolean {
  return message.includes("429")
    || message.includes("RESOURCE_EXHAUSTED")
    || message.includes("quota")
    || message.includes("Quota exceeded");
}

/**
 * Google Gemini Developer API (`generateContent`), AI Studio key compatible.
 * @see https://ai.google.dev/gemini-api/docs
 */
export class GeminiProvider implements BrainProvider {
  readonly id = "gemini" as const;

  constructor(
    public readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE,
  ) {}

  isAvailable(): boolean {
    return Boolean(this.apiKey.trim());
  }

  async decide(req: BrainRequest): Promise<BrainResponse> {
    if (!this.isAvailable()) throw new Error("gemini provider not configured");

    const maxExtra = config.gemini.maxRetries429;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= maxExtra; attempt++) {
      await acquireGeminiSlot(this.model);
      try {
        return await this.generateOnce(req);
      } catch (e) {
        lastErr = e as Error;
        const msg = lastErr.message ?? "";
        if (!isGeminiRateLimitError(msg) || attempt >= maxExtra) throw lastErr;

        const fromApi = parseRetryAfterSeconds(msg);
        const backoffMs = fromApi != null
          ? fromApi * 1000 + Math.floor(Math.random() * 400)
          : Math.min(45_000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 500);
        await sleep(backoffMs);
      }
    }

    throw lastErr ?? new Error("gemini decide failed");
  }

  private async generateOnce(req: BrainRequest): Promise<BrainResponse> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(this.model)}:generateContent`;

    const userText = `${req.perception}\n\n${req.question}`;
    const tryJsonMime = async (): Promise<GeminiGenerateResponse> => {
      const body = {
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: brainSamplingTemperature(),
          maxOutputTokens: req.maxTokens,
          responseMimeType: "application/json",
        },
      };
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
      });
      const json = await r.json() as GeminiGenerateResponse & { error?: { message?: string } };
      if (!r.ok) {
        throw new Error(`gemini HTTP ${r.status}: ${JSON.stringify(json.error ?? json)}`);
      }
      return json;
    };

    const tryPlain = async (): Promise<GeminiGenerateResponse> => {
      const body = {
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: brainSamplingTemperature(),
          maxOutputTokens: req.maxTokens,
        },
      };
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
      });
      const json = await r.json() as GeminiGenerateResponse & { error?: { message?: string } };
      if (!r.ok) {
        throw new Error(`gemini HTTP ${r.status}: ${JSON.stringify(json.error ?? json)}`);
      }
      return json;
    };

    let json: GeminiGenerateResponse;
    try {
      json = await tryJsonMime();
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("400") || msg.includes("responseMimeType") || msg.includes("mime")) {
        json = await tryPlain();
      } else {
        throw e;
      }
    }

    const raw = json.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
    if (!raw.trim()) {
      const block = json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? "unknown";
      throw new Error(`gemini empty response (finish/block: ${block})`);
    }

    return parseDecision(
      raw,
      json.usageMetadata?.promptTokenCount,
      json.usageMetadata?.candidatesTokenCount,
    );
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
