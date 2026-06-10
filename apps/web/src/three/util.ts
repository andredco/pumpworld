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

/**
 * Specimen-dish palette: graphite / porcelain bodies, one neon accent per
 * building kind. The accent drives roof tint, trim glow, and door frame.
 */
export function accentForBuilding(id: string, kind: string): string {
  const palette: Record<string, string[]> = {
    house: ["#34343e", "#3a3744", "#2f3340", "#3c3340", "#33383b", "#3a3038"],
    shop: ["#2e3440", "#343048", "#2c3a3e"],
    tavern: ["#3e2e34", "#42303a"],
    temple: ["#403c50", "#46405a"],
    courthouse: ["#2b3344", "#2e3850"],
    town_hall: ["#383848", "#3e3e52"],
    gallows: ["#241d18"],
    jail: ["#26262e", "#2a2a34"],
    farm: ["#33392f", "#383e30"],
    workshop: ["#3a332c", "#403830"],
    monument: ["#3c3848", "#443e52"],
    ruin: ["#2a2a2c", "#303032"],
  };
  const arr = palette[kind] ?? ["#33343c"];
  return arr[hashString(id) % arr.length]!;
}

/** Roof colour — desaturated slab tones, slightly lighter than walls. */
export function roofForBuilding(id: string, kind: string): string {
  const palette: Record<string, string[]> = {
    house: ["#4c4658", "#445064", "#50445c", "#465a58", "#5a4a50"],
    shop: ["#46506a", "#504668"],
    tavern: ["#523a42", "#4a343c"],
    temple: ["#5a5474", "#605a7e"],
    courthouse: ["#3a455c", "#404e6a"],
    town_hall: ["#4c4c66", "#525270"],
    gallows: ["#2c241c"],
    jail: ["#33333f", "#393945"],
    farm: ["#48503c", "#4e5640"],
    workshop: ["#4e443a", "#544a40"],
    monument: ["#544c68", "#5c5472"],
    ruin: ["#36363a", "#3c3c40"],
  };
  const arr = palette[kind] ?? ["#46465a"];
  return arr[(hashString(id) >>> 7) % arr.length]!;
}

/** Neon trim per building kind — the glow that identifies it at night. */
export function neonForBuilding(id: string, kind: string): string {
  const palette: Record<string, string[]> = {
    house: ["#a78bfa", "#38bdf8", "#f472b6", "#34d399", "#fbbf24", "#fb7185"],
    shop: ["#fbbf24", "#f59e0b"],
    tavern: ["#fb7185", "#f472b6"],
    temple: ["#a78bfa", "#c4b5fd"],
    courthouse: ["#38bdf8", "#7dd3fc"],
    town_hall: ["#c4b5fd", "#a78bfa"],
    gallows: ["#f87171"],
    jail: ["#f87171", "#fb7185"],
    farm: ["#34d399", "#4ade80"],
    workshop: ["#fb923c", "#fbbf24"],
    monument: ["#e9d5ff", "#c4b5fd"],
    ruin: ["#52525b"],
  };
  const arr = palette[kind] ?? ["#a78bfa"];
  return arr[(hashString(id) >>> 3) % arr.length]!;
}
