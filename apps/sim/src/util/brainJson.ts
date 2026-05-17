/**
 * Models occasionally wrap JSON in fences despite schema hints — normalize once.
 */
export function stripCodeFences(raw: string): string {
  let stripped = raw.trim();
  if (stripped.startsWith("```")) {
    stripped = stripped.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return stripped;
}
