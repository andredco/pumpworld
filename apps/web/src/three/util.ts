/**
 * Deterministic clientside RNG + hash. Used for procedurally placing decor
 * (trees, flowers, paths) seeded from the world meta — no protocol changes
 * required, and every viewer sees the same town.
 */

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a saturated accent colour for a building from its id. */
export function accentForBuilding(id: string, kind: string): string {
  const palette: Record<string, string[]> = {
    house: ["#f6a6c1", "#a8d8ff", "#c8e6b8", "#ffe4a3", "#d4a3ff", "#ffb6a3", "#a8e6cf", "#fad2e1"],
    shop: ["#ff9a76", "#fdd56a", "#c0e57b", "#a3d8f4", "#f7b2bd"],
    tavern: ["#c4634d", "#a85432", "#d97757"],
    temple: ["#f4ecd6", "#fff8e0", "#ffe9b3"],
    courthouse: ["#7290b8", "#6e8aa8", "#5a7da3"],
    town_hall: ["#d8cdb5", "#c9b894"],
    gallows: ["#5a3a22"],
    jail: ["#3f3f4f", "#494957", "#525266"],
    farm: ["#cdbd6e", "#d8c879", "#bba858"],
    workshop: ["#b08968", "#9b7855", "#c79972"],
    monument: ["#e8c1a0", "#dfae8a", "#d49a73"],
    ruin: ["#6a6a6a", "#7a7a7a", "#5e5e5e"],
  };
  const arr = palette[kind] ?? ["#cccccc"];
  return arr[hashString(id) % arr.length]!;
}

/** Roof colour, slightly darker / warmer than wall. */
export function roofForBuilding(id: string, kind: string): string {
  const palette: Record<string, string[]> = {
    house: ["#cf5566", "#5a7fa8", "#7ca85c", "#c69b3e", "#8a5fc0", "#c46d50", "#5fb39b"],
    shop: ["#a04a35", "#b88a2e", "#7ba33d", "#4d83a3", "#a85d6e"],
    tavern: ["#5a2a1a", "#4b2010"],
    temple: ["#d4a83b", "#c89a26"],
    courthouse: ["#2a3a55", "#324466"],
    town_hall: ["#7a5a2a", "#6a4a22"],
    gallows: ["#3a2818"],
    jail: ["#222230", "#2a2a3a"],
    farm: ["#7a5a2a", "#6a4f24"],
    workshop: ["#6a4a30", "#5a3e26"],
    monument: ["#a06a4a", "#8a5a3e"],
    ruin: ["#3a3a3a", "#444"],
  };
  const arr = palette[kind] ?? ["#444"];
  return arr[(hashString(id) >>> 7) % arr.length]!;
}
