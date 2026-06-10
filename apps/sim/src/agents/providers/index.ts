import type { ModelProvider, PillSoul } from "@pumpworld/protocol";
import { config } from "../../config.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { MiniMaxProvider } from "./minimax.js";
import { OpenAICompatibleProvider } from "./openaiCompatible.js";
import { OpenRouterProvider } from "./openrouter.js";
import type { BrainProvider } from "./types.js";

/** Lazily-instantiated cache, keyed by `${provider}::${model}`. */
const cache = new Map<string, BrainProvider>();

export function providerFor(soul: PillSoul): BrainProvider {
  const key = `${soul.provider}::${soul.model}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const made = build(soul.provider, soul.model);
  cache.set(key, made);
  return made;
}

/** Fail fast if any pill's brain cannot be constructed (missing API keys, etc.). */
export function ensureBrainsConfigured(world: { pills: Map<string, { soul: PillSoul }> }): void {
  for (const pill of world.pills.values()) {
    providerFor(pill.soul);
  }
}

function build(p: ModelProvider, model: string): BrainProvider {
  switch (p) {
    case "openrouter": {
      const key = config.openrouter.apiKey?.trim();
      if (!key) {
        throw new Error("OPENROUTER_API_KEY is required for souls configured with provider openrouter.");
      }
      return new OpenRouterProvider(
        model || config.openrouter.defaultModel,
        key,
        config.openrouter.appUrl,
        config.openrouter.appTitle,
      );
    }
    case "gemini": {
      const key = config.gemini.apiKey?.trim();
      if (!key) {
        throw new Error(
          "GEMINI_API_KEY, gemini_api_key, or GOOGLE_AI_API_KEY is required for souls configured with provider gemini.",
        );
      }
      const base = config.gemini.apiBase || undefined;
      return base ? new GeminiProvider(model, key, base) : new GeminiProvider(model, key);
    }
    case "minimax": {
      const key = config.minimax.apiKey?.trim();
      if (!key) {
        throw new Error("MINIMAX_API_KEY is required for souls configured with provider minimax.");
      }
      const base = config.minimax.apiBase?.trim() || "https://api.minimax.io/v1";
      return new MiniMaxProvider(model, key, base);
    }
    case "openai": {
      const key = config.openai.apiKey?.trim();
      if (!key) {
        // Diagnostic: list env var NAMES (never values) that look key-ish, so
        // remote deploy logs reveal typos like "OPENAI_API_KEY " or wrong service.
        const candidates = Object.keys(process.env)
          .filter(k => /openai|api[_-]?key/i.test(k))
          .map(k => JSON.stringify(k));
        throw new Error(
          "OPENAI_API_KEY is required for souls configured with provider openai. "
          + "Local: put it in .env at the repo root. "
          + "Railway/Docker: .env is not shipped — add OPENAI_API_KEY as a service variable "
          + "on the SIM service (Variables tab) and APPLY/DEPLOY the staged change. "
          + (candidates.length
            ? `Key-like env names visible in this container: ${candidates.join(", ")}`
            : "No key-like env names are visible in this container at all."),
        );
      }
      return new OpenAICompatibleProvider("openai", model, "https://api.openai.com/v1", key);
    }
    case "xai": {
      const key = config.xai.apiKey?.trim();
      if (!key) throw new Error("XAI_API_KEY is required for souls configured with provider xai.");
      return new OpenAICompatibleProvider("xai", model, "https://api.x.ai/v1", key);
    }
    case "anthropic": {
      const key = config.anthropic.apiKey?.trim();
      if (!key) throw new Error("ANTHROPIC_API_KEY is required for souls configured with provider anthropic.");
      return new AnthropicProvider(model, key);
    }
    case "oss": {
      const base = config.oss.baseUrl?.trim();
      if (!base) throw new Error("OSS_BASE_URL is required for souls configured with provider oss.");
      return new OpenAICompatibleProvider("oss", config.oss.model || model, base, config.oss.apiKey ?? "");
    }
    default: {
      const _never: never = p;
      throw new Error(`Unsupported model provider: ${_never}`);
    }
  }
}
