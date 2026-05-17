/**
 * One-shot ping against OpenAI + Gemini (matches roster backends).
 * Run from repo root: npm run test:brains -w @pumpworld/sim
 */
import { config } from "../src/config.js";
import { GeminiProvider } from "../src/agents/providers/gemini.js";
import { OpenAICompatibleProvider } from "../src/agents/providers/openaiCompatible.js";

const SAMPLE_OPENAI_MODEL = "gpt-4o-mini";
const SAMPLE_GEMINI_MODEL = "gemini-3.1-flash-lite";

const req = {
  pillId: "smoke",
  systemPrompt:
    "You output only valid JSON. No markdown fences. Schema: {\"thought\": string, \"action\": {\"kind\":\"idle\"}}",
  perception: "Smoke test tick 0. You are alone.",
  question: "Reply with exactly one JSON object.",
  maxTokens: 120,
};

async function main() {
  const gKey = config.gemini.apiKey?.trim();
  const oKey = config.openai.apiKey?.trim();

  let oaiOk = false;
  let gemOk = false;

  if (!oKey) {
    console.error("Missing OPENAI_API_KEY or openai_api_key in .env");
  } else {
    console.log("OpenAI (%s) …", SAMPLE_OPENAI_MODEL);
    try {
      const oai = new OpenAICompatibleProvider(
        "openai",
        SAMPLE_OPENAI_MODEL,
        "https://api.openai.com/v1",
        oKey,
      );
      const r = await oai.decide(req);
      console.log("  thought:", r.thought.slice(0, 120));
      console.log("  action:", r.action.kind);
      oaiOk = true;
    } catch (e) {
      console.error("  FAIL:", (e as Error).message);
    }
  }

  if (!gKey) {
    console.error("\nMissing GEMINI_API_KEY / gemini_api_key / GOOGLE_AI_API_KEY in .env");
  } else {
    console.log("\nGemini (%s) …", SAMPLE_GEMINI_MODEL);
    try {
      const gemBase = config.gemini.apiBase?.trim();
      const gem = gemBase
        ? new GeminiProvider(SAMPLE_GEMINI_MODEL, gKey, gemBase)
        : new GeminiProvider(SAMPLE_GEMINI_MODEL, gKey);
      const rGem = await gem.decide(req);
      console.log("  thought:", rGem.thought.slice(0, 120));
      console.log("  action:", rGem.action.kind);
      gemOk = true;
    } catch (e) {
      console.error("  FAIL:", (e as Error).message);
    }
  }

  console.log("");
  if (oaiOk && gemOk) {
    console.log("Both backends OK.");
    process.exit(0);
  }
  if (!oaiOk && !gemOk) {
    console.error("Neither backend succeeded (fix keys, quotas, or model ids).");
    process.exit(1);
  }
  console.error("Partial success: fix the failing provider above.");
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
