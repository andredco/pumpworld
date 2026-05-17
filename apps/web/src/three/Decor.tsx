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
interface FlowerT { x: number; z: number; c: string }
interface RockT { x: number; z: number; s: number }

const FLOWER_COLOURS = [
  "#ff5577", "#ffd23f", "#b07cff", "#ff9a76", "#ffffff", "#ff8fb1",
  "#5ac8fa", "#ff4d6d", "#34e0a1", "#ffa500", "#e0b3ff",
];
const TREE_GREENS = [
  "#3e7a32", "#4a8d3a", "#356a2c", "#5fa346", "#2f6128",
  "#6dba4a", "#88c25a", "#ff8aa4", // last one = cherry blossom pink
  "#e88a3a", // autumn
];

/**
 * Procedural trees / flowers / rocks. Avoids placing inside buildings or in
 * the central plaza. Everything is deterministic per (seed, world size).
 */
export function Decor({ size, seed, plots, buildings }: Props) {
  const { trees, flowers, rocks } = useMemo(() => {
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
    const flowers: FlowerT[] = [];
    const rocks: RockT[] = [];

    // bias tree density by zoning — wild & agricultural get the most
    const zonePoints = plots.flatMap(p => {
      const density =
        p.zoning === "wild" ? 14 :
        p.zoning === "agricultural" ? 6 :
        p.zoning === "residential" ? 3 :
        p.zoning === "commercial" ? 1 :
        p.zoning === "civic" ? 1 : 2;
      const out: { x: number; z: number; weight: number }[] = [];
      for (let i = 0; i < density; i++) {
        out.push({
          x: p.position.x + (rnd() - 0.5) * p.size.x * 0.9,
          z: p.position.z + (rnd() - 0.5) * p.size.z * 0.9,
          weight: 1,
        });
      }
      return out;
    });

    for (const pt of zonePoints) {
      if (insideBlocker(pt.x, pt.z, 1.5)) continue;
      if (Math.abs(pt.x) > half || Math.abs(pt.z) > half) continue;
      trees.push({
        x: pt.x, z: pt.z,
        s: 1.1 + rnd() * 1.2, // bigger
        tint: Math.floor(rnd() * TREE_GREENS.length),
      });
    }
    // sprinkle border trees so the perimeter feels forested
    for (let i = 0; i < 110; i++) {
      const edge = rnd();
      const along = (rnd() * 2 - 1) * half;
      const x = edge < 0.25 ? -half : edge < 0.5 ? half : along;
      const z = edge < 0.25 ? along : edge < 0.5 ? along : edge < 0.75 ? -half : half;
      const jx = x + (rnd() - 0.5) * 10;
      const jz = z + (rnd() - 0.5) * 10;
      if (insideBlocker(jx, jz, 2)) continue;
      trees.push({ x: jx, z: jz, s: 1.4 + rnd() * 1.6, tint: Math.floor(rnd() * TREE_GREENS.length) });
    }

    // flower density up
    for (let i = 0; i < 420; i++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      if (insideBlocker(x, z, 1)) continue;
      flowers.push({ x, z, c: FLOWER_COLOURS[Math.floor(rnd() * FLOWER_COLOURS.length)]! });
    }
    // explicit flower beds ringing every house — gives a "cared-for" look
    for (const b of buildings) {
      if (b.kind !== "house") continue;
      const beds = 28;
      const bx = b.position.x, bz = b.position.z;
      const radius = Math.max(b.size.x, b.size.z) * 0.62;
      for (let i = 0; i < beds; i++) {
        const a = (i / beds) * Math.PI * 2 + rnd() * 0.1;
        const r = radius + rnd() * 0.4;
        flowers.push({
          x: bx + Math.cos(a) * r,
          z: bz + Math.sin(a) * r,
          c: FLOWER_COLOURS[Math.floor(rnd() * FLOWER_COLOURS.length)]!,
        });
      }
    }

    for (let i = 0; i < 36; i++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      if (insideBlocker(x, z, 1)) continue;
      rocks.push({ x, z, s: 0.4 + rnd() * 0.8 });
    }

    return { trees, flowers, rocks };
  }, [size, seed, plots, buildings]);

  return (
    <group>
      {/* trees — trunks (taller) */}
      <Instances limit={trees.length + 1} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.28, 1.8, 6]} />
        <meshStandardMaterial color="#5a3a22" roughness={1} />
        {trees.map((t, i) => (
          <Instance key={`tt${i}`} position={[t.x, 0.9 * t.s, t.z]} scale={[t.s, t.s, t.s]} />
        ))}
      </Instances>
      {/* trees — foliage spheres, one Instances group per tint for cheap colour variety */}
      {TREE_GREENS.map((green, gi) => (
        <Instances key={gi} limit={trees.length + 1} castShadow>
          <sphereGeometry args={[1.4, 12, 10]} />
          <meshStandardMaterial color={green} roughness={1} />
          {trees.filter(t => t.tint === gi).map((t, i) => (
            <Instance
              key={`tf${gi}-${i}`}
              position={[t.x, 2.2 * t.s, t.z]}
              scale={[t.s * 1.5, t.s * 1.5, t.s * 1.5]}
            />
          ))}
        </Instances>
      ))}

      {/* flowers — group by colour so we keep instancing benefits */}
      {FLOWER_COLOURS.map((c, ci) => (
        <Instances key={c} limit={flowers.length + 1}>
          <sphereGeometry args={[0.13, 6, 4]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} roughness={0.6} />
          {flowers.filter(f => f.c === c).map((f, i) => (
            <Instance key={`fl${ci}-${i}`} position={[f.x, 0.13, f.z]} />
          ))}
        </Instances>
      ))}

      {/* rocks */}
      <Instances limit={rocks.length + 1} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#7a7568" roughness={1} />
        {rocks.map((r, i) => (
          <Instance key={`rk${i}`} position={[r.x, 0.25 * r.s, r.z]} scale={[r.s, r.s * 0.7, r.s]} />
        ))}
      </Instances>
    </group>
  );
}
