import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { Building as BuildingT } from "@pumpworld/protocol";
import { accentForBuilding, neonForBuilding, roofForBuilding } from "./util.js";
import { useWorld } from "../store/worldStore.js";

const ROOF_PITCH = 0.32;

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

/**
 * Graphite shells with a neon identity trim. Each building kind carries
 * its own glow colour (homes are the pill palette; the jail glows red).
 * Windows are full emissive strips that burn brighter at night.
 */
function GenericBuilding({ b }: { b: BuildingT }) {
  const meta = useWorld(s => s.meta);
  const hour = meta?.hourOfDay ?? 12;
  const burning = b.status === "burning";
  const rubble = b.status === "rubble";
  const underConstruction = b.status === "under_construction";
  const wallH = rubble ? 0.6 : b.height * (underConstruction ? Math.max(0.15, b.constructionProgress) : Math.max(0.4, b.integrity));
  const wallColor = burning ? "#5a2014" : accentForBuilding(b.id, b.kind);
  const roofColor = roofForBuilding(b.id, b.kind);
  const neon = neonForBuilding(b.id, b.kind);
  const showRoof = !rubble && (!underConstruction || b.constructionProgress > 0.7);
  const roofH = useMemo(() => Math.min(b.size.x, b.size.z) * ROOF_PITCH, [b.size.x, b.size.z]);
  const night = nightFactor(hour);
  const lightOn = night > 0.2 || burning;
  // Homes are designed see-through so viewers can watch pills inside.
  const seeThrough = b.kind === "house";

  const windowGlow = lightOn ? 1.6 : 0.25;

  return (
    <group position={[b.position.x, 0, b.position.z]}>
      {/* Walls */}
      <mesh receiveShadow castShadow={!seeThrough} position={[0, wallH / 2, 0]}>
        <boxGeometry args={[b.size.x, wallH, b.size.z]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.7}
          metalness={0.15}
          transparent={seeThrough}
          opacity={seeThrough ? 0.45 : 1}
          depthWrite={!seeThrough}
        />
      </mesh>

      {/* Neon trim band at the top of the walls */}
      {!rubble && !underConstruction && (
        <mesh position={[0, wallH - 0.08, 0]}>
          <boxGeometry args={[b.size.x + 0.08, 0.12, b.size.z + 0.08]} />
          <meshStandardMaterial
            color={neon}
            emissive={neon}
            emissiveIntensity={lightOn ? 1.8 : 0.6}
          />
        </mesh>
      )}

      {/* Floor inside see-through homes */}
      {seeThrough && !rubble && !underConstruction && (
        <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[b.size.x * 0.94, b.size.z * 0.94]} />
          <meshStandardMaterial color="#22242c" roughness={0.9} />
        </mesh>
      )}

      {/* Window strips on all four sides */}
      {!rubble && !underConstruction && (
        <>
          {[-1, 1].map(sign => (
            <mesh key={`wz${sign}`} position={[0, wallH * 0.58, sign * (b.size.z / 2 + 0.03)]}>
              <planeGeometry args={[b.size.x * 0.62, wallH * 0.2]} />
              <meshStandardMaterial
                color={lightOn ? "#ffe9c2" : "#1a2230"}
                emissive={lightOn ? "#ffc46a" : "#26344a"}
                emissiveIntensity={windowGlow}
                side={2}
              />
            </mesh>
          ))}
          {[-1, 1].map(sign => (
            <mesh key={`wx${sign}`} position={[sign * (b.size.x / 2 + 0.03), wallH * 0.58, 0]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[b.size.z * 0.62, wallH * 0.2]} />
              <meshStandardMaterial
                color={lightOn ? "#ffe9c2" : "#1a2230"}
                emissive={lightOn ? "#ffc46a" : "#26344a"}
                emissiveIntensity={windowGlow}
                side={2}
              />
            </mesh>
          ))}
        </>
      )}

      {/* Pitched roof */}
      {showRoof && (
        <group position={[0, wallH, 0]}>
          <mesh castShadow position={[0, roofH / 2, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[Math.hypot(b.size.x, b.size.z) / 2, roofH, 4]} />
            <meshStandardMaterial color={roofColor} roughness={0.75} metalness={0.1} />
          </mesh>
          {/* Roof beacon */}
          <mesh position={[0, roofH + 0.12, 0]}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={lightOn ? 2.4 : 0.8} />
          </mesh>
        </group>
      )}

      {/* Door + glowing frame */}
      {!rubble && (
        <group position={[0, 0, b.size.z / 2]}>
          <mesh position={[0, Math.min(1.1, wallH * 0.4), 0.05]}>
            <boxGeometry args={[Math.min(1.5, b.size.x * 0.2), Math.min(2.3, wallH * 0.72), 0.08]} />
            <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={lightOn ? 0.9 : 0.35} transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, Math.min(1, wallH * 0.38), 0.09]} castShadow>
            <boxGeometry args={[Math.min(1.3, b.size.x * 0.17), Math.min(2.1, wallH * 0.66), 0.07]} />
            <meshStandardMaterial color="#13151c" roughness={0.6} />
          </mesh>
        </group>
      )}

      {/* Fire */}
      {burning && <Fire scale={Math.min(b.size.x, b.size.z) / 6} y={wallH + roofH * 0.4} />}

      <Label text={b.name} y={wallH + roofH + 0.8} accent={neon} />
    </group>
  );
}

function Label({ text, y, accent }: { text: string; y: number; accent: string }) {
  return (
    <Html
      position={[0, y, 0]}
      distanceFactor={18}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div style={{
        padding: "2px 7px",
        background: "rgba(10,10,16,0.72)",
        color: "#e7e3f8",
        border: `1px solid ${accent}55`,
        fontSize: 9,
        borderRadius: 4,
        whiteSpace: "nowrap",
        letterSpacing: 0.4,
        backdropFilter: "blur(4px)",
      }}>
        {text}
      </div>
    </Html>
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

/** Pillared town hall — stepped front, porcelain columns, violet banner. */
function TownHall({ b }: { b: BuildingT }) {
  const meta = useWorld(s => s.meta);
  const hour = meta?.hourOfDay ?? 12;
  const wallH = b.height * Math.max(0.4, b.integrity);
  const wallColor = accentForBuilding(b.id, b.kind);
  const roofColor = roofForBuilding(b.id, b.kind);
  const neon = neonForBuilding(b.id, b.kind);
  const colWidth = 0.7;
  const stepH = 0.35;
  const night = nightFactor(hour);
  const lightOn = night > 0.2;

  return (
    <group position={[b.position.x, 0, b.position.z]}>
      {/* Steps */}
      <mesh position={[0, stepH / 2, b.size.z / 2 + 0.8]} castShadow receiveShadow>
        <boxGeometry args={[b.size.x + 1, stepH, 1.6]} />
        <meshStandardMaterial color="#34363f" roughness={0.85} />
      </mesh>
      <mesh position={[0, stepH * 1.5, b.size.z / 2 + 0.3]} castShadow receiveShadow>
        <boxGeometry args={[b.size.x, stepH, 1.0]} />
        <meshStandardMaterial color="#3c3e48" roughness={0.85} />
      </mesh>
      {/* Main hall */}
      <mesh position={[0, wallH / 2 + stepH, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.size.x, wallH, b.size.z]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Porcelain columns across the front */}
      {Array.from({ length: 4 }).map((_, i) => {
        const span = b.size.x - 2;
        const x = -span / 2 + (i / 3) * span;
        return (
          <mesh key={i} position={[x, wallH / 2 + stepH, b.size.z / 2 + 0.1]} castShadow>
            <cylinderGeometry args={[colWidth / 2, colWidth / 2, wallH, 12]} />
            <meshStandardMaterial color="#d9d4e8" roughness={0.4} />
          </mesh>
        );
      })}
      {/* Pediment + neon trim + roof */}
      <mesh position={[0, wallH + stepH + 0.4, 0]} castShadow>
        <boxGeometry args={[b.size.x + 0.8, 0.8, b.size.z + 0.8]} />
        <meshStandardMaterial color={roofColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, wallH + stepH + 0.86, 0]}>
        <boxGeometry args={[b.size.x + 0.9, 0.1, b.size.z + 0.9]} />
        <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={lightOn ? 1.8 : 0.6} />
      </mesh>
      <mesh position={[0, wallH + stepH + 1.7, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[Math.hypot(b.size.x, b.size.z) / 2 + 0.5, 2.0, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.6} />
      </mesh>
      {/* Side window strips */}
      {[-1, 1].map(sx => (
        <mesh key={`th-w${sx}`} position={[sx * (b.size.x / 2 + 0.03), wallH * 0.6 + stepH, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[b.size.z * 0.7, wallH * 0.3]} />
          <meshStandardMaterial
            color={lightOn ? "#ffe9c2" : "#1a2230"}
            emissive={lightOn ? "#ffc46a" : "#26344a"}
            emissiveIntensity={lightOn ? 1.6 : 0.25}
            side={2}
          />
        </mesh>
      ))}
      {/* Door */}
      <mesh position={[0, 1.2 + stepH, b.size.z / 2 + 0.06]} castShadow>
        <boxGeometry args={[1.6, 2.4, 0.1]} />
        <meshStandardMaterial color="#13151c" roughness={0.6} />
      </mesh>
      {/* Banner mast */}
      <mesh position={[0, wallH + stepH + 4, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 4, 6]} />
        <meshStandardMaterial color="#16181f" />
      </mesh>
      <mesh position={[0.7, wallH + stepH + 5.2, 0]}>
        <boxGeometry args={[1.4, 0.8, 0.04]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.8} />
      </mesh>
      <Label text={b.name} y={wallH + stepH + 6.5} accent={neon} />
    </group>
  );
}

/** Gallows — two posts, crossbeam, dangling rope. Grim by design. */
function Gallows({ b }: { b: BuildingT }) {
  const h = b.height;
  return (
    <group position={[b.position.x, 0, b.position.z]}>
      {/* Platform */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.6, 2.4]} />
        <meshStandardMaterial color="#241d18" roughness={1} />
      </mesh>
      {/* Steps */}
      <mesh position={[0, 0.15, 1.3]} castShadow>
        <boxGeometry args={[1.6, 0.3, 0.4]} />
        <meshStandardMaterial color="#241d18" roughness={1} />
      </mesh>
      {/* Posts */}
      <mesh position={[-0.9, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, h, 8]} />
        <meshStandardMaterial color="#1c1612" roughness={1} />
      </mesh>
      <mesh position={[0.9, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, h, 8]} />
        <meshStandardMaterial color="#1c1612" roughness={1} />
      </mesh>
      {/* Crossbeam */}
      <mesh position={[0, h - 0.12, 0]} castShadow>
        <boxGeometry args={[2.2, 0.24, 0.24]} />
        <meshStandardMaterial color="#1c1612" roughness={1} />
      </mesh>
      {/* Noose */}
      <mesh position={[0, h - 0.7, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
        <meshStandardMaterial color="#6a5a44" roughness={1} />
      </mesh>
      <mesh position={[0, h - 1.45, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.18, 0.025, 8, 14]} />
        <meshStandardMaterial color="#6a5a44" roughness={1} />
      </mesh>
      {/* Warning ring on the platform */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.61, 0]}>
        <ringGeometry args={[0.9, 1.05, 32]} />
        <meshBasicMaterial color="#f87171" transparent opacity={0.5} />
      </mesh>
      <Html
        position={[0, h + 0.6, 0]}
        distanceFactor={14}
        center
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{
          padding: "2px 7px",
          background: "rgba(30,6,8,0.8)",
          color: "#ff8a8a",
          border: "1px solid rgba(248,113,113,0.4)",
          fontSize: 10,
          borderRadius: 4,
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
