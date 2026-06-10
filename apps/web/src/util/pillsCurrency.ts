/** In-world currency is $SOULS; older snapshots used "$pills" or "$pump" in item names. */
export function isPillsCurrencyName(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith("$souls") || n.startsWith("$pills") || n.startsWith("$pump");
}
