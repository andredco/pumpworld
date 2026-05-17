import { useMemo } from "react";
import { Instances, Instance, Html } from "@react-three/drei";
import type { Plot } from "@pumpworld/protocol";

interface Props {
  size: number;
  plots: Plot[];
}

const HORIZONTAL_NAMES = [
  "Pump Avenue",   // central
  "Shard Walk",
  "Capsule Lane",
  "Tide Way",
];
const VERTICAL_NAMES = [
  "Founders Street",
  "Fountain Cross",
  "Old Cinder Street",
  "Templegate Street",
];

/** Pick a street name from an ordered list based on signed coordinate. */
function nameFor(list: string[], coord: number, sortedCoords: number[]): string {
  const centreIndex = sortedCoords.findIndex(c => Math.abs(c) < 0.5);
  const idx = sortedCoords.indexOf(coord);
  if (idx < 0) return list[0]!;
  if (centreIndex >= 0) {
    const offset = Math.abs(idx - centreIndex);
    if (offset === 0) return list[0]!;
    return list[Math.min(offset, list.length - 1)]!;
  }
  return list[idx % list.length]!;
}

/**
 * Procedural road grid. Reconstructs the implicit plot grid from the plot
 * positions and lays down sandy roads in every gap between plot rows/cols.
 * Plus a circle of paving around the plaza (rendered separately in Ground).
 */
interface Sign { x: number; z: number; verticalName: string; horizontalName: string }

export function Roads({ size, plots }: Props) {
  const { roads, lampPosts, signs } = useMemo(() => {
    if (plots.length === 0) return { roads: [], lampPosts: [] as { x: number; z: number }[], signs: [] as Sign[] };

    const xs = [...new Set(plots.map(p => Math.round(p.position.x)))].sort((a, b) => a - b);
    const zs = [...new Set(plots.map(p => Math.round(p.position.z)))].sort((a, b) => a - b);
    if (xs.length < 2 || zs.length < 2) return { roads: [], lampPosts: [], signs: [] };

    const xPitch = xs[1]! - xs[0]!;
    const plotW = plots[0]!.size.x;
    const roadW = Math.max(2, xPitch - plotW);
    const roadHalf = roadW / 2;

    // Road centerlines sit between adjacent plot rows/cols.
    const vCoords: number[] = []; // x-coords for vertical streets
    const hCoords: number[] = []; // z-coords for horizontal streets
    for (let i = 0; i < xs.length - 1; i++) vCoords.push((xs[i]! + xs[i + 1]!) / 2);
    for (let i = 0; i < zs.length - 1; i++) hCoords.push((zs[i]! + zs[i + 1]!) / 2);

    const roads: { x: number; z: number; w: number; d: number }[] = [];
    for (const cx of vCoords) roads.push({ x: cx, z: 0, w: roadW, d: size });
    for (const cz of hCoords) roads.push({ x: 0, z: cz, w: size, d: roadW });

    const lampPosts: { x: number; z: number }[] = [];
    const signs: Sign[] = [];
    for (const cx of vCoords) {
      for (const cz of hCoords) {
        if (Math.hypot(cx, cz) < 16) continue; // skip plaza
        lampPosts.push({ x: cx + roadHalf - 0.2, z: cz + roadHalf - 0.2 });
        signs.push({
          x: cx, z: cz,
          verticalName: nameFor(VERTICAL_NAMES, cx, vCoords),
          horizontalName: nameFor(HORIZONTAL_NAMES, cz, hCoords),
        });
      }
    }
    return { roads, lampPosts, signs };
  }, [size, plots]);

  return (
    <group>
      {roads.map((r, i) => (
        <mesh
          key={i}
          rotation-x={-Math.PI / 2}
          position={[r.x, 0.02, r.z]}
          receiveShadow
        >
          <planeGeometry args={[r.w, r.d]} />
          <meshStandardMaterial color="#cdb98a" roughness={1} />
        </mesh>
      ))}
      <Lamps points={lampPosts} />
      <StreetSigns signs={signs} />
    </group>
  );
}

function StreetSigns({ signs }: { signs: Sign[] }) {
  return (
    <group>
      {signs.map((s, i) => (
        <group key={i} position={[s.x - 2, 0, s.z - 2]}>
          {/* pole */}
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
            <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* sign plate */}
          <Html
            position={[0, 2.5, 0]}
            distanceFactor={11}
            center
            zIndexRange={[5, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <div style={{
              padding: "1px 4px",
              background: "#1d2532",
              color: "#e7eaf0",
              border: "1px solid #43505f",
              borderRadius: 2,
              fontFamily: "var(--pw-font, sans-serif)",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
              textAlign: "center",
              lineHeight: 1.1,
            }}>
              <div>{s.verticalName}</div>
              <div style={{ marginTop: 1, color: "#9aa5b4" }}>×</div>
              <div>{s.horizontalName}</div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function Lamps({ points }: { points: { x: number; z: number }[] }) {
  return (
    <>
      <Instances limit={points.length + 1} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 3.6, 6]} />
        <meshStandardMaterial color="#1a1f2a" roughness={1} />
        {points.map((p, i) => (
          <Instance key={`lp${i}`} position={[p.x, 1.8, p.z]} />
        ))}
      </Instances>
      <Instances limit={points.length + 1}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color="#fff0a8" emissive="#ffb43a" emissiveIntensity={2.6} />
        {points.map((p, i) => (
          <Instance key={`lh${i}`} position={[p.x, 3.7, p.z]} />
        ))}
      </Instances>
    </>
  );
}
