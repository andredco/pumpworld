import type { Vec3 } from "@pumpworld/protocol";

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const v3add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const v3sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const v3scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const v3len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const v3dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const v3dist2D = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
export const v3norm = (a: Vec3): Vec3 => {
  const l = v3len(a);
  return l > 1e-6 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
};
