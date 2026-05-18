import { config } from "../../config.js";

/**
 * `fetch` with an `AbortController` timeout so a hung upstream cannot wedge a
 * pill forever. All brain providers should use this instead of bare `fetch`.
 *
 * On timeout we throw `Error("<provider> timed out after <N>ms")` so the agent's
 * try/catch in `Agent.scheduleThink` can fall back to `idle` and clear `inflight`.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  opts: { providerLabel: string; timeoutMs?: number } = { providerLabel: "brain" },
): Promise<Response> {
  const ms = opts.timeoutMs ?? config.brainCallTimeoutMs;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new Error(`${opts.providerLabel} timed out after ${ms}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
