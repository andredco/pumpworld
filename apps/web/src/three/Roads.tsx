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

interface Sign { x: number; z: number; verticalName: string; horizontalName: string }

/**
 * Dark glass roads with emissive violet centre lines — circuit traces
 * across the specimen dish. Lamps are vertical neon bars.
 */
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

    const vCoords: number[] = [];
    const hCoords: number[] = [];
    for (let i = 0; i < xs.length - 1; i++) vCoords.push((xs[i]! + xs[i + 1]!) / 2);
    for (let i = 0; i < zs.length - 1; i++) hCoords.push((zs[i]! + zs[i + 1]!) / 2);

    const roads: { x: number; z: number; w: number; d: number; vertical: boolean }[] = [];
    for (const cx of vCoords) roads.push({ x: cx, z: 0, w: roadW, d: size, vertical: true });
    for (const cz of hCoords) roads.push({ x: 0, z: cz, w: size, d: roadW, vertical: false });

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
        <group key={i}>
          {/* Road body — dark glass */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[r.x, 0.02, r.z]}
            receiveShadow
          >
            <planeGeometry args={[r.w, r.d]} />
            <meshStandardMaterial color="#1a1d24" roughness={0.45} metalness={0.25} />
          </mesh>
          {/* Emissive centre trace */}
          <mesh rotation-x={-Math.PI / 2} position={[r.x, 0.028, r.z]}>
            <planeGeometry args={r.vertical ? [0.18, r.d] : [r.w, 0.18]} />
            <meshBasicMaterial color="#7c5fd1" transparent opacity={0.55} />
          </mesh>
        </group>
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
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
            <meshStandardMaterial color="#22232c" metalness={0.7} roughness={0.35} />
          </mesh>
          <Html
            position={[0, 2.5, 0]}
            distanceFactor={11}
            center
            zIndexRange={[5, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <div style={{
              padding: "2px 5px",
              background: "rgba(10,10,16,0.85)",
              color: "#e7e3f8",
              border: "1px solid rgba(167,139,250,0.35)",
              borderRadius: 3,
              fontFamily: "var(--pw-mono, monospace)",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
              textAlign: "center",
              lineHeight: 1.15,
            }}>
              <div>{s.verticalName}</div>
              <div style={{ margin: "1px 0", color: "#7c5fd1" }}>×</div>
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
      {/* Posts */}
      <Instances limit={points.length + 1} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 3.6, 6]} />
        <meshStandardMaterial color="#16181f" roughness={0.6} metalness={0.5} />
        {points.map((p, i) => (
          <Instance key={`lp${i}`} position={[p.x, 1.8, p.z]} />
        ))}
      </Instances>
      {/* Vertical neon bars */}
      <Instances limit={points.length + 1}>
        <cylinderGeometry args={[0.045, 0.045, 1.1, 8]} />
        <meshStandardMaterial color="#c4b5fd" emissive="#a78bfa" emissiveIntensity={2.4} />
        {points.map((p, i) => (
          <Instance key={`lh${i}`} position={[p.x, 3.4, p.z]} />
        ))}
      </Instances>
    </>
  );
}
