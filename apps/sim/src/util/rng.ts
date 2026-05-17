import seedrandom from "seedrandom";

export interface Rng {
  next(): number;            // [0,1)
  int(min: number, max: number): number; // inclusive
  float(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  bool(p?: number): boolean;
  /** Spawn a derived rng so subsystems are deterministic & independent. */
  fork(label: string): Rng;
}

export function makeRng(seed: string): Rng {
  const prng = seedrandom(seed);
  const r: Rng = {
    next: () => prng(),
    int(min, max) { return Math.floor(prng() * (max - min + 1)) + min; },
    float(min, max) { return prng() * (max - min) + min; },
    pick(arr) {
      if (arr.length === 0) throw new Error("pick from empty");
      return arr[Math.floor(prng() * arr.length)]!;
    },
    bool(p = 0.5) { return prng() < p; },
    fork(label) { return makeRng(`${seed}::${label}`); },
  };
  return r;
}
