/** In-world currency is $PILLS; older snapshots used "$pump" in item names. */
export function isPillsCurrencyName(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith("$pills") || n.startsWith("$pump");
}
