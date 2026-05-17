/**
 * Per-model throttle for Gemini Developer API so parallel pills cannot burst past
 * RPM limits (free tier is often ~5 RPM / ~20 RPD per model).
 * Serialized acquisitions queue cleanly within each model key.
 */
import { config } from "../../config.js";

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

const windowMs = 60_000;

interface ModelWindow {
  timestamps: number[];
  chain: Promise<void>;
}

const byModel = new Map<string, ModelWindow>();

function windowFor(model: string): ModelWindow {
  let w = byModel.get(model);
  if (!w) {
    w = { timestamps: [], chain: Promise.resolve() };
    byModel.set(model, w);
  }
  return w;
}

export function acquireGeminiSlot(model: string): Promise<void> {
  const maxPerMinute = config.gemini.maxCallsPerMinute;
  if (maxPerMinute <= 0) return Promise.resolve();

  const state = windowFor(model);

  let release!: () => void;
  const done = new Promise<void>(res => {
    release = res;
  });

  state.chain = state.chain.then(async () => {
    try {
      for (;;) {
        const now = Date.now();
        while (state.timestamps.length > 0 && now - state.timestamps[0]! >= windowMs) {
          state.timestamps.shift();
        }
        if (state.timestamps.length < maxPerMinute) {
          state.timestamps.push(now);
          return;
        }
        const oldest = state.timestamps[0]!;
        const wait = oldest + windowMs - Date.now() + 20;
        await sleep(Math.max(50, wait));
      }
    } finally {
      release();
    }
  });

  return done;
}
