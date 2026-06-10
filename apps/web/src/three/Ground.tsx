import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { Plot } from "@pumpworld/protocol";
import { hashString, mulberry32 } from "./util.js";

/** Muted zone tints over the graphite dish — readable but never loud. */
const ZONE_OVERLAY: Record<Plot["zoning"], string> = {
  residential: "#3d3650",
  commercial:  "#33405a",
  civic:       "#324a52",
  agricultural:"#3c4a38",
  wild:        "#2c4440",
};

/**
 * The specimen dish. The whole town sits on a circular graphite platter
 * floating in the void — emissive rim, glass plaza rings, and a crystal
 * Spring at the exact centre. Everything seeded so each viewer sees the
 * same dish.
 */
export function Ground({ size, plots, seed }: { size: number; plots: Plot[]; seed: string }) {
  const discR = size * 0.72;

  // Little moss clusters scattered for texture.
  const moss = useMemo(() => {
    const rnd = mulberry32(hashString(seed + ":moss"));
    const out: { x: number; z: number; s: number; c: string }[] = [];
    const half = size / 2 - 2;
    for (let i = 0; i < 240; i++) {
      const x = rnd() * 2 * half - half;
      const z = rnd() * 2 * half - half;
      out.push({
        x, z,
        s: 0.25 + rnd() * 0.45,
        c: rnd() < 0.55 ? "#2e4f46" : rnd() < 0.75 ? "#26433c" : "#3a5f50",
      });
    }
    return out;
  }, [size, seed]);

  return (
    <group>
      {/* Dish surface */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[discR, 96]} />
        <meshStandardMaterial color="#2b2e36" roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Dish side wall + underside */}
      <mesh position={[0, -3, 0]}>
        <cylinderGeometry args={[discR, discR * 1.015, 6, 96, 1, true]} />
        <meshStandardMaterial color="#15171c" roughness={0.9} side={2} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, -6, 0]}>
        <circleGeometry args={[discR * 1.015, 96]} />
        <meshStandardMaterial color="#0d0e12" roughness={1} />
      </mesh>

      {/* Emissive rim — the dish's signature glow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <ringGeometry args={[discR - 1.2, discR - 0.4, 128]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[discR - 2.4, discR - 1.2, 128]} />
        <meshBasicMaterial color="#7c5fd1" transparent opacity={0.15} />
      </mesh>

      {/* Soft zone tinting */}
      {plots.map(p => (
        <mesh
          key={p.id}
          rotation-x={-Math.PI / 2}
          position={[p.position.x, 0.006, p.position.z]}
          receiveShadow
        >
          <planeGeometry args={[p.size.x, p.size.z]} />
          <meshStandardMaterial
            color={ZONE_OVERLAY[p.zoning]}
            roughness={1}
            transparent
            opacity={0.42}
          />
        </mesh>
      ))}

      {/* Central plaza — dark glass discs + glowing concentric rings */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#1d2026" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, 0]} receiveShadow>
        <circleGeometry args={[12, 64]} />
        <meshStandardMaterial color="#23262d" roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.024, 0]}>
        <ringGeometry args={[11.6, 12, 96]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.6} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.024, 0]}>
        <ringGeometry args={[17.5, 17.9, 96]} />
        <meshBasicMaterial color="#7c5fd1" transparent opacity={0.4} />
      </mesh>

      <SpringCrystal />

      {/* Moss clusters for organic texture */}
      {moss.map((t, i) => (
        <mesh key={i} position={[t.x, 0.02, t.z]}>
          <coneGeometry args={[t.s, t.s * 0.9, 5]} />
          <meshStandardMaterial color={t.c} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The Spring — a levitating violet crystal above a dark basin, with three
 * small shard satellites orbiting it. This is the economic heart of the
 * town, so it has the strongest glow in the scene.
 */
function SpringCrystal() {
  const crystalRef = useRef<Mesh | null>(null);
  const orbitRef = useRef<Group | null>(null);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.5;
      crystalRef.current.position.y = 3.1 + Math.sin(t * 1.4) * 0.18;
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.y = -t * 0.9;
    }
  });

  return (
    <group>
      {/* Basin */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.2, 3.5, 0.6, 48]} />
        <meshStandardMaterial color="#262932" roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Glowing pool */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.62, 0]}>
        <circleGeometry args={[2.8, 48]} />
        <meshStandardMaterial
          color="#5b4ba8"
          emissive="#7c5fd1"
          emissiveIntensity={0.9}
          roughness={0.2}
        />
      </mesh>
      {/* Pedestal column */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.5, 1.4, 12]} />
        <meshStandardMaterial color="#33363f" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* The crystal */}
      <mesh ref={crystalRef} position={[0, 3.1, 0]} castShadow>
        <octahedronGeometry args={[0.95, 0]} />
        <meshStandardMaterial
          color="#b794ff"
          emissive="#a78bfa"
          emissiveIntensity={1.8}
          roughness={0.15}
          metalness={0.3}
        />
      </mesh>

      {/* Orbiting shards */}
      <group ref={orbitRef} position={[0, 3.1, 0]}>
        {[0, 1, 2].map(i => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.8, Math.sin(a * 2) * 0.3, Math.sin(a) * 1.8]}>
              <octahedronGeometry args={[0.18, 0]} />
              <meshStandardMaterial
                color="#c4b5fd"
                emissive="#c4b5fd"
                emissiveIntensity={1.6}
              />
            </mesh>
          );
        })}
      </group>

      <pointLight position={[0, 3.4, 0]} color="#a78bfa" intensity={3} distance={26} decay={2} />
    </group>
  );
}
