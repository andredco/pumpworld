import { useMemo } from "react";
import type { Plot } from "@pumpworld/protocol";
import { hashString, mulberry32 } from "./util.js";

/** Soft, low-saturation overlays per zone — no hard edges, no white lines. */
const ZONE_OVERLAY: Record<Plot["zoning"], string> = {
  residential: "#86b76b",
  commercial:  "#9fae62",
  civic:       "#7da082",
  agricultural:"#bca85f",
  wild:        "#5f8a55",
};

/** Procedural grass + path / fountain plaza. Everything is seeded so each
 *  viewer sees the same town. No stark intersecting roads. */
export function Ground({ size, plots, seed }: { size: number; plots: Plot[]; seed: string }) {
  // tiny grass tufts scattered for visual texture
  const tufts = useMemo(() => {
    const rnd = mulberry32(hashString(seed + ":tufts"));
    const out: { x: number; z: number; s: number; c: string }[] = [];
    const half = size / 2 - 2;
    for (let i = 0; i < 220; i++) {
      out.push({
        x: rnd() * 2 * half - half,
        z: rnd() * 2 * half - half,
        s: 0.4 + rnd() * 0.6,
        c: rnd() < 0.6 ? "#5a8a48" : rnd() < 0.7 ? "#3e6a36" : "#74a55c",
      });
    }
    return out;
  }, [size, seed]);

  return (
    <group>
      {/* base grass — warm green, very slight roughness */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[size * 1.4, size * 1.4, 1, 1]} />
        <meshStandardMaterial color="#6fa256" roughness={1} />
      </mesh>

      {/* soft zone tinting — same level as grass, slightly above to avoid z-fight */}
      {plots.map(p => (
        <mesh
          key={p.id}
          rotation-x={-Math.PI / 2}
          position={[p.position.x, 0.005, p.position.z]}
          receiveShadow
        >
          <planeGeometry args={[p.size.x, p.size.z]} />
          <meshStandardMaterial
            color={ZONE_OVERLAY[p.zoning]}
            roughness={1}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}

      {/* central plaza — sandy paving */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[18, 48]} />
        <meshStandardMaterial color="#d9c9a3" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.014, 0]} receiveShadow>
        <circleGeometry args={[12, 48]} />
        <meshStandardMaterial color="#c2b388" roughness={1} />
      </mesh>

      {/* fountain — three stacked discs at the world centre */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[3, 3.2, 0.5, 32]} />
          <meshStandardMaterial color="#b9a47a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[2.6, 2.6, 0.12, 32]} />
          <meshStandardMaterial color="#62b5d6" roughness={0.4} metalness={0.1} />
        </mesh>
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 1.2, 16]} />
          <meshStandardMaterial color="#cdbf9a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.85, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.1, 0.12, 32]} />
          <meshStandardMaterial color="#cdbf9a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 2.1, 0]}>
          <sphereGeometry args={[0.45, 16, 12]} />
          <meshStandardMaterial color="#7ad0e6" emissive="#3aa6c8" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* grass tufts for texture */}
      {tufts.map((t, i) => (
        <mesh key={i} position={[t.x, 0.02, t.z]}>
          <sphereGeometry args={[t.s, 6, 4]} />
          <meshStandardMaterial color={t.c} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
