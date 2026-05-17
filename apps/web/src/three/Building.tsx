import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { Building as BuildingT } from "@pumpworld/protocol";
import { accentForBuilding, roofForBuilding } from "./util.js";
import { useWorld } from "../store/worldStore.js";

const ROOF_PITCH = 0.35;

export function Building({ b }: { b: BuildingT }) {
  if (b.kind === "gallows") return <Gallows b={b} />;
  if (b.kind === "town_hall") return <TownHall b={b} />;
  return <GenericBuilding b={b} />;
}

function nightFactor(hourOfDay: number): number {
  // 0 = full day, 1 = full night, smooth transitions around sunrise/sunset
  if (hourOfDay >= 7 && hourOfDay <= 19) return 0;
  if (hourOfDay > 19 && hourOfDay < 21) return (hourOfDay - 19) / 2;
  if (hourOfDay > 5 && hourOfDay < 7)   return (7 - hourOfDay) / 2;
  return 1;
}

function GenericBuilding({ b }: { b: BuildingT }) {
  const meta = useWorld(s => s.meta);
  const hour = meta?.hourOfDay ?? 12;
  const burning = b.status === "burning";
  const rubble = b.status === "rubble";
  const underConstruction = b.status === "under_construction";
  const wallH = rubble ? 0.6 : b.height * (underConstruction ? Math.max(0.15, b.constructionProgress) : Math.max(0.4, b.integrity));
  const wallColor = burning ? "#aa3300" : accentForBuilding(b.id, b.kind);
  const roofColor = roofForBuilding(b.id, b.kind);
  const showRoof = !rubble && (!underConstruction || b.constructionProgress > 0.7);
  const roofH = useMemo(() => Math.min(b.size.x, b.size.z) * ROOF_PITCH, [b.size.x, b.size.z]);
  const night = nightFactor(hour);
  const lightOn = night > 0.2 || burning;
  // Homes are designed see-through so viewers can watch pills inside.
  const seeThrough = b.kind === "house";

  return (
    <group position={[b.position.x, 0, b.position.z]}>
      {/* Walls — semi-transparent for houses so you can see pills inside */}
      <mesh receiveShadow castShadow={!seeThrough} position={[0, wallH / 2, 0]}>
        <boxGeometry args={[b.size.x, wallH, b.size.z]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.8}
          transparent={seeThrough}
          opacity={seeThrough ? 0.42 : 1}
          depthWrite={!seeThrough}
        />
      </mesh>
      {/* Floor inside house — gives a visible interior */}
      {seeThrough && !rubble && !underConstruction && (
        <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[b.size.x * 0.94, b.size.z * 0.94]} />
          <meshStandardMaterial color="#3a2818" roughness={1} />
        </mesh>
      )}

      {/* Glass windows on each side. Two windows per side. */}
      {!rubble && !underConstruction && [-1, 1].map(sx => (
        [0, 1].map(slot => {
          const sign = sx;
          const w = b.size.x * 0.22;
          const h = wallH * 0.28;
          const y = wallH * 0.55;
          const offsetZ = sign * (b.size.z / 2 + 0.05);
          const xOff = (slot === 0 ? -b.size.x * 0.22 : b.size.x * 0.22);
          return <GlassPane key={`zside-${sx}-${slot}`} w={w} h={h} pos={[xOff, y, offsetZ]} faceSign={sign} lightOn={lightOn} />;
        })
      ))}
      {!rubble && !underConstruction && [-1, 1].map(sx => (
        [0, 1].map(slot => {
          const sign = sx;
          const w = b.size.z * 0.22;
          const h = wallH * 0.28;
          const y = wallH * 0.55;
          const offsetX = sign * (b.size.x / 2 + 0.05);
          const zOff = (slot === 0 ? -b.size.z * 0.22 : b.size.z * 0.22);
          return <GlassPaneSide key={`xside-${sx}-${slot}`} w={w} h={h} pos={[offsetX, y, zOff]} faceSign={sign} lightOn={lightOn} />;
        })
      ))}

      {/* Pitched roof */}
      {showRoof && (
        <group position={[0, wallH, 0]}>
          <mesh castShadow position={[0, roofH / 2, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[Math.hypot(b.size.x, b.size.z) / 2, roofH, 4]} />
            <meshStandardMaterial color={roofColor} roughness={0.85} />
          </mesh>
        </group>
      )}

      {/* Door */}
      {!rubble && (
        <mesh position={[0, Math.min(1, wallH * 0.4), b.size.z / 2 + 0.04]} castShadow>
          <boxGeometry args={[Math.min(1.4, b.size.x * 0.18), Math.min(2.2, wallH * 0.7), 0.1]} />
          <meshStandardMaterial color={roofColor} roughness={0.7} />
        </mesh>
      )}

      {/* Fire */}
      {burning && <Fire scale={Math.min(b.size.x, b.size.z) / 6} y={wallH + roofH * 0.4} />}

      {/* Label */}
      <Html
        position={[0, wallH + roofH + 0.7, 0]}
        distanceFactor={18}
        center
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{
          padding: "1px 6px",
          background: "rgba(7,9,12,0.55)",
          color: "#e7dfc8",
          fontSize: 9,
          borderRadius: 3,
          whiteSpace: "nowrap",
          letterSpacing: 0.3,
        }}>
          {b.name}
        </div>
      </Html>
    </group>
  );
}

function GlassPane({ w, h, pos, faceSign, lightOn }: { w: number; h: number; pos: [number, number, number]; faceSign: number; lightOn: boolean }) {
  return (
    <group position={pos}>
      {/* Wooden frame */}
      <mesh>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.03]} />
        <meshStandardMaterial color="#3a2418" roughness={0.7} />
      </mesh>
      {/* Glass pane — proper transparency, slight tint */}
      <mesh position={[0, 0, faceSign * 0.02]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color={lightOn ? "#ffe6a0" : "#9ec9e0"}
          emissive={lightOn ? "#ffb43a" : "#000"}
          emissiveIntensity={lightOn ? 1.2 : 0}
          transparent opacity={lightOn ? 0.55 : 0.28}
          roughness={0.05} metalness={0.05}
          depthWrite={false}
        />
      </mesh>
      {/* Cross muntins */}
      <mesh position={[0, 0, faceSign * 0.025]}>
        <boxGeometry args={[w, 0.035, 0.006]} />
        <meshStandardMaterial color="#3a2418" />
      </mesh>
      <mesh position={[0, 0, faceSign * 0.025]}>
        <boxGeometry args={[0.035, h, 0.006]} />
        <meshStandardMaterial color="#3a2418" />
      </mesh>
    </group>
  );
}

function GlassPaneSide({ w, h, pos, faceSign, lightOn }: { w: number; h: number; pos: [number, number, number]; faceSign: number; lightOn: boolean }) {
  return (
    <group position={pos} rotation-y={Math.PI / 2}>
      <mesh>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.03]} />
        <meshStandardMaterial color="#3a2418" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, faceSign * 0.02]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color={lightOn ? "#ffe6a0" : "#9ec9e0"}
          emissive={lightOn ? "#ffb43a" : "#000"}
          emissiveIntensity={lightOn ? 1.2 : 0}
          transparent opacity={lightOn ? 0.55 : 0.28}
          roughness={0.05} metalness={0.05}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, faceSign * 0.025]}>
        <boxGeometry args={[w, 0.035, 0.006]} />
        <meshStandardMaterial color="#3a2418" />
      </mesh>
      <mesh position={[0, 0, faceSign * 0.025]}>
        <boxGeometry args={[0.035, h, 0.006]} />
        <meshStandardMaterial color="#3a2418" />
      </mesh>
    </group>
  );
}

function Fire({ scale, y }: { scale: number; y: number }) {
  const f1 = useRef<Mesh | null>(null);
  const f2 = useRef<Mesh | null>(null);
  const f3 = useRef<Mesh | null>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (f1.current) f1.current.scale.y = 1 + Math.sin(t * 9) * 0.18;
    if (f2.current) f2.current.scale.y = 1 + Math.sin(t * 11 + 1) * 0.22;
    if (f3.current) f3.current.scale.y = 1 + Math.sin(t * 7 + 2) * 0.14;
  });
  return (
    <group position={[0, y, 0]} scale={[scale, scale, scale]}>
      <mesh ref={f1}>
        <coneGeometry args={[1.4, 3.2, 12]} />
        <meshStandardMaterial color="#ff7733" emissive="#ff3300" emissiveIntensity={1.6} transparent opacity={0.95} />
      </mesh>
      <mesh ref={f2} position={[0, 0.6, 0]}>
        <coneGeometry args={[1.0, 2.4, 12]} />
        <meshStandardMaterial color="#ffaa55" emissive="#ff8822" emissiveIntensity={1.8} transparent opacity={0.95} />
      </mesh>
      <mesh ref={f3} position={[0, 1.0, 0]}>
        <coneGeometry args={[0.6, 1.6, 12]} />
        <meshStandardMaterial color="#ffe07a" emissive="#ffc24a" emissiveIntensity={2.2} transparent opacity={0.95} />
      </mesh>
      <pointLight color="#ff7022" intensity={3.5} distance={25} decay={2} />
    </group>
  );
}

/** Pillared town hall — bigger, stepped front, columns. */
function TownHall({ b }: { b: BuildingT }) {
  const meta = useWorld(s => s.meta);
  const hour = meta?.hourOfDay ?? 12;
  const wallH = b.height * Math.max(0.4, b.integrity);
  const wallColor = accentForBuilding(b.id, b.kind);
  const roofColor = roofForBuilding(b.id, b.kind);
  const colWidth = 0.7;
  const stepH = 0.35;
  const night = nightFactor(hour);
  const lightOn = night > 0.2;

  return (
    <group position={[b.position.x, 0, b.position.z]}>
      {/* Steps */}
      <mesh position={[0, stepH / 2, b.size.z / 2 + 0.8]} castShadow receiveShadow>
        <boxGeometry args={[b.size.x + 1, stepH, 1.6]} />
        <meshStandardMaterial color="#c2b388" roughness={1} />
      </mesh>
      <mesh position={[0, stepH * 1.5, b.size.z / 2 + 0.3]} castShadow receiveShadow>
        <boxGeometry args={[b.size.x, stepH, 1.0]} />
        <meshStandardMaterial color="#cdbf9a" roughness={1} />
      </mesh>
      {/* Main hall */}
      <mesh position={[0, wallH / 2 + stepH, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.size.x, wallH, b.size.z]} />
        <meshStandardMaterial color={wallColor} roughness={0.8} />
      </mesh>
      {/* Columns across the front */}
      {Array.from({ length: 4 }).map((_, i) => {
        const span = b.size.x - 2;
        const x = -span / 2 + (i / 3) * span;
        return (
          <mesh key={i} position={[x, wallH / 2 + stepH, b.size.z / 2 + 0.1]} castShadow>
            <cylinderGeometry args={[colWidth / 2, colWidth / 2, wallH, 12]} />
            <meshStandardMaterial color="#e3d8bb" roughness={0.7} />
          </mesh>
        );
      })}
      {/* Pediment + roof slab */}
      <mesh position={[0, wallH + stepH + 0.4, 0]} castShadow>
        <boxGeometry args={[b.size.x + 0.8, 0.8, b.size.z + 0.8]} />
        <meshStandardMaterial color={roofColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, wallH + stepH + 1.6, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[Math.hypot(b.size.x, b.size.z) / 2 + 0.5, 2.0, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.7} />
      </mesh>
      {/* Side windows */}
      {!lightOn ? null : null}
      {[-1, 1].map(sx => (
        [0, 1, 2].map(slot => {
          const xOff = sx * (b.size.x / 2 + 0.05);
          const zOff = -b.size.z * 0.35 + slot * (b.size.z * 0.35);
          return <GlassPaneSide
            key={`th-${sx}-${slot}`}
            w={b.size.z * 0.18} h={wallH * 0.4}
            pos={[xOff, wallH * 0.6 + stepH, zOff]}
            faceSign={sx} lightOn={lightOn}
          />;
        })
      ))}
      {/* Door */}
      <mesh position={[0, 1.2 + stepH, b.size.z / 2 + 0.06]} castShadow>
        <boxGeometry args={[1.6, 2.4, 0.1]} />
        <meshStandardMaterial color="#3a2818" roughness={0.7} />
      </mesh>
      {/* Flag */}
      <mesh position={[0, wallH + stepH + 4, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 4, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.7, wallH + stepH + 5.2, 0]}>
        <boxGeometry args={[1.4, 0.8, 0.04]} />
        <meshStandardMaterial color="#ff5577" emissive="#ff3355" emissiveIntensity={0.3} />
      </mesh>
      <Html
        position={[0, wallH + stepH + 6.5, 0]}
        distanceFactor={18}
        center
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{
          padding: "1px 6px",
          background: "rgba(7,9,12,0.55)",
          color: "#ffe07a",
          fontSize: 10,
          borderRadius: 3,
          whiteSpace: "nowrap",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}>
          {b.name}
        </div>
      </Html>
    </group>
  );
}

/** Gallows — two posts, crossbeam, dangling rope. Grim by design. */
function Gallows({ b }: { b: BuildingT }) {
  const h = b.height;
  return (
    <group position={[b.position.x, 0, b.position.z]}>
      {/* Wooden platform */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.6, 2.4]} />
        <meshStandardMaterial color="#5a3a22" roughness={1} />
      </mesh>
      {/* Steps */}
      <mesh position={[0, 0.15, 1.3]} castShadow>
        <boxGeometry args={[1.6, 0.3, 0.4]} />
        <meshStandardMaterial color="#5a3a22" roughness={1} />
      </mesh>
      {/* Posts */}
      <mesh position={[-0.9, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, h, 8]} />
        <meshStandardMaterial color="#3a2818" roughness={1} />
      </mesh>
      <mesh position={[0.9, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, h, 8]} />
        <meshStandardMaterial color="#3a2818" roughness={1} />
      </mesh>
      {/* Crossbeam */}
      <mesh position={[0, h - 0.12, 0]} castShadow>
        <boxGeometry args={[2.2, 0.24, 0.24]} />
        <meshStandardMaterial color="#3a2818" roughness={1} />
      </mesh>
      {/* Noose (rope + loop) */}
      <mesh position={[0, h - 0.7, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
        <meshStandardMaterial color="#a08a6a" roughness={1} />
      </mesh>
      <mesh position={[0, h - 1.45, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.18, 0.025, 8, 14]} />
        <meshStandardMaterial color="#a08a6a" roughness={1} />
      </mesh>
      {/* Label */}
      <Html
        position={[0, h + 0.6, 0]}
        distanceFactor={14}
        center
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{
          padding: "1px 6px",
          background: "rgba(40,8,8,0.7)",
          color: "#ff8a8a",
          fontSize: 10,
          borderRadius: 3,
          whiteSpace: "nowrap",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}>
          {b.name}
        </div>
      </Html>
    </group>
  );
}
