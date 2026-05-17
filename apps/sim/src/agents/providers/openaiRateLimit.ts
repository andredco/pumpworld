/**
 * Global throttle for OpenAI Chat Completions so six parallel agents cannot
 * burst hundreds of requests per minute. Uses a sliding 60s window; acquisitions
 * are serialized so concurrent thinkers queue cleanly.
 */
import { config } from "../../config.js";

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

const windowMs = 60_000;
const timestamps: number[] = [];
let chain: Promise<void> = Promise.resolve();

export function acquireOpenAiSlot(): Promise<void> {
  const maxPerMinute = config.openaiMaxCallsPerMinute;
  if (maxPerMinute <= 0) return Promise.resolve();

  let release!: () => void;
  const done = new Promise<void>(res => {
    release = res;
  });

  chain = chain.then(async () => {
    try {
      for (;;) {
        const now = Date.now();
        while (timestamps.length > 0 && now - timestamps[0]! >= windowMs) {
          timestamps.shift();
        }
        if (timestamps.length < maxPerMinute) {
          timestamps.push(now);
          return;
        }
        const oldest = timestamps[0]!;
        const wait = oldest + windowMs - Date.now() + 20;
        await sleep(Math.max(50, wait));
      }
    } finally {
      release();
    }
  });

  return done;
}
