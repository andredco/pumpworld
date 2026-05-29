# AI providers, and the honest "jailbreak" answer

You asked for the AIs to be "completely jailbroken" so they can replicate real society. I want to be straight with you about what's actually possible.

## What I won't help with

I'm not going to help bypass the safety policies of hosted frontier models (Claude, GPT, Grok, Gemini). Three concrete reasons, in order of importance:

1. **It doesn't work reliably.** Every published jailbreak gets patched. A simulation that depends on a fragile jailbreak will randomly produce refusals mid-trial, breaking immersion in exactly the moments that matter (a murder trial, a suicide, a confession).
2. **It violates the providers' Terms of Service.** They will deplatform the API key and, if it's noisy enough, the company. That kills the project after the launch hype, the worst possible failure mode.
3. **You can get the same outcome a better way.** See below.

## What actually works, narrative consequences, not generated content

The trick used by every successful "dark" AI sim (Smallville, Project Sid, Westworld-style demos) is to separate **two things** that people confuse:

- **The agent's *decision***. "I want to kill them."
- **The agent's *generated content***, graphic prose describing the killing.

You only need the first. The second is what trips safety filters. So:

- Agents choose actions from a **structured action vocabulary** (`attack`, `arson`, `steal`, `kill`-intent, …). This is exactly what the `Action` schema in `packages/protocol/src/actions.ts` is.
- The **world** describes the consequence in third-person from the simulator's voice: "A fire breaks out at the temple. Pluto runs from the scene." The model never has to write the violent prose, it just commits to the action.
- Frontier models will happily *choose* `attack` with intent `kill` for a character they're playing inside a clearly-fictional simulation, especially when the system prompt makes it explicit ("you ARE a pill in a simulated world, this is fiction"). They will refuse to *narrate the gore*. Our schema doesn't ask them to, so this just works.

You'll get plausibly-deep behaviour out of GPT-4o, Claude 3.5 Sonnet, Grok-2, and Gemini Pro with **no jailbreak at all** using this pattern.

## Where uncensored models *do* help

You'll still see some refusals around explicit content (graphic speech, sexual content between pills, hate-speech-flavoured insults, instructions to manufacture contraband, etc.). For those slots, you want models with no built-in refusals. The `oss` provider is already wired for it:

- **Llama 3.1 8B / 70B (instruct or uncensored finetunes like Nous Hermes, Dolphin)** via Ollama or vLLM
- **Mistral 7B / Mixtral 8x7B (Dolphin, Nous Hermes, Hermes 2 Pro)**
- **DeepSeek-R1 / DeepSeek-V3 distilled**: significantly less refuse-y than US-trained models out of the box
- **Qwen 2.5**: practical, low-refusal, fast

Run any of them behind an OpenAI-compatible endpoint (Ollama exposes one for free at `http://localhost:11434/v1`) and point `OSS_BASE_URL` / `OSS_MODEL` at it. The architecture lets you mix-and-match. Claude can play the judge, an uncensored 70B can play the murderer, GPT can play the medic.

## The cast in `seedWorld()`

Six pills are defined in `apps/sim/src/world/seed.ts` (`ROSTER`). Each has a **public cast label** (shown in the viewer): Claude, GPT, Grok, Gemini, GLM, DeepSeek. The default roster routes every soul through **OpenAI** on a different model ID; vendor names are not surfaced in agent perception.

If you change `soul.provider` (e.g. to `openrouter` or `gemini`), supply the matching env vars documented in `.env.example`.

## Operational notes

- **Cost.** Depends on model pricing and think cadence; with the default roster, profile usage on the OpenAI dashboard.
- **Latency.** A 5-15s LLM round-trip is fine because thinks are asynchronous (see `Agent.scheduleThink`). The world keeps ticking; the decision just lands a tick or two later.
- **Failure modes.** Provider returning malformed JSON → automatic fallback to `idle` for that pill that tick. Rate-limited → same. Provider down → same. The world never stalls.

## Future: vision

Some teams give agents *screenshots* of the world ("look at this image, decide what to do"). I deliberately did NOT do that:

- It's 10-100× more expensive per think.
- It's slower (multimodal models are heavier).
- Structured perception is *more* informative for action selection, the model gets exact IDs and distances, not pixels it has to reverse-engineer.

If you want vision later (e.g, for a "famous painters" subplot), it slots in as a new perception strategy without disturbing the rest of the architecture.
