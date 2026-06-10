import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import type { Building, Plot } from "@pumpworld/protocol";
import { hashString, mulberry32 } from "./util.js";

interface Props {
  size: number;
  seed: string;
  plots: Plot[];
  buildings: Building[];
}

interface TreeT { x: number; z: number; s: number; tint: number }
interface SporeT { x: number; z: number; c: string }
interface RockT { x: number; z: number; s: number }

/** Glowing micro-flora dotted across the dish. */
const SPORE_COLOURS = [
  "#a78bfa", "#38bdf8", "#f472b6", "#34d399", "#fbbf24", "#c4b5fd", "#7dd3fc",
];

/**
 * Tree tints — mostly deep teal conifers, with a few luminous "soul trees"
 * (emissive foliage) scattered through the wild zones.
 */
const TREE_TINTS: { color: string; emissive: boolean }[] = [
  { color: "#1f4d44", emissive: false },
  { color: "#26594a", emissive: false },
  { color: "#1a4036", emissive: false },
  { color: "#2e6653", emissive: false },
  { color: "#35735c", emissive: false },
  { color: "#7c5fd1", emissive: true },  // violet soul tree
  { color: "#3aa6b8", emissive: true },  // cyan soul tree
  { color: "#c95f9b", emissive: true },  // pink soul tree
];

/**
 * Procedural conifers / spores / crystal rocks. Avoids placing inside
 * buildings or in the central plaza. Deterministic per (seed, world size).
 */
export function Decor({ size, seed, plots, buildings }: Props) {
  const { trees, spores, rocks } = useMemo(() => {
    const rnd = mulberry32(hashString(seed + ":decor"));
    const half = size / 2 - 4;
    const PLAZA_R2 = 18 * 18;
    const blockers = buildings.map(b => ({
      x: b.position.x, z: b.position.z,
      r: Math.max(b.size.x, b.size.z) * 0.7,
    }));

    const insideBlocker = (x: number, z: number, pad: number) => {
      if (x * x + z * z < PLAZA_R2) return true;
      for (const b of blockers) {
        const dx = x - b.x, dz = z - b.z;
        if (dx * dx + dz * dz < (b.r + pad) * (b.r + pad)) return true;
      }
      return false;
    };

    const trees: TreeT[] = [];
    const spores: SporeT[] = [];
    const rocks: RockT[] = [];

    /** Soul trees are rare — bias tint selection toward the naturals. */
    const pickTint = () => {
      const roll = rnd();
      if (roll < 0.85) return Math.floor(rnd() * 5);        // naturals 0–4
      return 5 + Math.floor(rnd() * 3);                     // soul trees 5–7
    };

    // bias tree density by zoning — wild & agricultural get the most
    const zonePoints = plots.flatMap(p => {
      const density =
        p.zoning === "wild" ? 14 :
        p.zoning === "agricultural" ? 6 :
        p.zoning === "residential" ? 3 :
        p.zoning === "commercial" ? 1 :
        p.zoning === "civic" ? 1 : 2;
      const out: { x: number; z: number }[] = [];
      for (let i = 0; i < density; i++) {
        out.push({
          x: p.position.x + (rnd() - 0.5) * p.size.x * 0.9,
          z: p.position.z + (rnd() - 0.5) * p.size.z * 0.9,
        });
      }
      return out;
    });

    for (const pt of zonePoints) {
      if (insideBlocker(pt.x, pt.z, 1.5)) continue;
      if (Math.abs(pt.x) > half || Math.abs(pt.z) > half) continue;
      trees.push({ x: pt.x, z: pt.z, s: 1.0 + rnd() * 1.2, tint: pickTint() });
    }
    // border forest so the dish edge feels alive
    for (let i = 0; i < 110; i++) {
      const edge = rnd();
      const along = (rnd() * 2 - 1) * half;
      const x = edge < 0.25 ? -half : edge < 0.5 ? half : along;
      const z = edge < 0.25 ? along : edge < 0.5 ? along : edge < 0.75 ? -half : half;
      const jx = x + (rnd() - 0.5) * 10;
      const jz = z + (rnd() - 0.5) * 10;
      if (insideBlocker(jx, jz, 2)) continue;
      trees.push({ x: jx, z: jz, s: 1.3 + rnd() * 1.6, tint: pickTint() });
    }

    // glowing spores
    for (let i = 0; i < 420; i++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      if (insideBlocker(x, z, 1)) continue;
      spores.push({ x, z, c: SPORE_COLOURS[Math.floor(rnd() * SPORE_COLOURS.length)]! });
    }
    // spore rings around every house — a "tended garden" of light
    for (const b of buildings) {
      if (b.kind !== "house") continue;
      const beds = 24;
      const bx = b.position.x, bz = b.position.z;
      const radius = Math.max(b.size.x, b.size.z) * 0.62;
      for (let i = 0; i < beds; i++) {
        const a = (i / beds) * Math.PI * 2 + rnd() * 0.1;
        const r = radius + rnd() * 0.4;
        spores.push({
          x: bx + Math.cos(a) * r,
          z: bz + Math.sin(a) * r,
          c: SPORE_COLOURS[Math.floor(rnd() * SPORE_COLOURS.length)]!,
        });
      }
    }

    for (let i = 0; i < 36; i++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      if (insideBlocker(x, z, 1)) continue;
      rocks.push({ x, z, s: 0.4 + rnd() * 0.8 });
    }

    return { trees, spores, rocks };
  }, [size, seed, plots, buildings]);

  return (
    <group>
      {/* tree trunks */}
      <Instances limit={trees.length + 1} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.24, 1.6, 6]} />
        <meshStandardMaterial color="#241f2b" roughness={1} />
        {trees.map((t, i) => (
          <Instance key={`tt${i}`} position={[t.x, 0.8 * t.s, t.z]} scale={[t.s, t.s, t.s]} />
        ))}
      </Instances>
      {/* conifer foliage — one Instances group per tint */}
      {TREE_TINTS.map((tint, gi) => (
        <Instances key={gi} limit={trees.length + 1} castShadow>
          <coneGeometry args={[1.2, 3.0, 7]} />
          <meshStandardMaterial
            color={tint.color}
            emissive={tint.emissive ? tint.color : "#000000"}
            emissiveIntensity={tint.emissive ? 0.55 : 0}
            roughness={0.9}
          />
          {trees.filter(t => t.tint === gi).map((t, i) => (
            <Instance
              key={`tf${gi}-${i}`}
              position={[t.x, 2.4 * t.s, t.z]}
              scale={[t.s * 1.15, t.s * 1.15, t.s * 1.15]}
            />
          ))}
        </Instances>
      ))}

      {/* spores — grouped by colour to keep instancing benefits */}
      {SPORE_COLOURS.map((c, ci) => (
        <Instances key={c} limit={spores.length + 1}>
          <sphereGeometry args={[0.1, 6, 4]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.3} roughness={0.4} />
          {spores.filter(f => f.c === c).map((f, i) => (
            <Instance key={`sp${ci}-${i}`} position={[f.x, 0.1, f.z]} />
          ))}
        </Instances>
      ))}

      {/* dark crystal rocks */}
      <Instances limit={rocks.length + 1} castShadow receiveShadow>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#3a3d46" roughness={0.5} metalness={0.3} />
        {rocks.map((r, i) => (
          <Instance key={`rk${i}`} position={[r.x, 0.28 * r.s, r.z]} scale={[r.s, r.s * 0.8, r.s]} />
        ))}
      </Instances>
    </group>
  );
}
